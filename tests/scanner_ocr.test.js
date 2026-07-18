const assert = require("assert");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/shared/entropy.js"));
require(path.join(repoRoot, "src/shared/patterns.js"));
require(path.join(repoRoot, "src/shared/detector.js"));
require(path.join(repoRoot, "src/shared/placeholders.js"));
require(path.join(repoRoot, "src/shared/sessionMapStore.js"));
require(path.join(repoRoot, "src/shared/ipClassification.js"));
require(path.join(repoRoot, "src/shared/ipDetection.js"));
require(path.join(repoRoot, "src/shared/networkHierarchy.js"));
require(path.join(repoRoot, "src/shared/placeholderAllocator.js"));
require(path.join(repoRoot, "src/shared/knownSecretReuse.js"));
require(path.join(repoRoot, "src/shared/transformOutboundPrompt.js"));
require(path.join(repoRoot, "src/shared/fileLimits.js"));
require(path.join(repoRoot, "src/shared/fileTypeRegistry.js"));
require(path.join(repoRoot, "src/shared/fileScanner.js"));
require(path.join(repoRoot, "src/shared/scannerOcr.js"));
require(path.join(repoRoot, "src/shared/imageRedactor.js"));

const ScannerOcr = globalThis.PWM.ScannerOcr;
const FileScanner = globalThis.PWM.FileScanner;
const ImageRedactor = globalThis.PWM.ImageRedactor;

function bufferFromText(text) {
  return new TextEncoder().encode(String(text)).buffer;
}

function makeFile(name, type, size, buffer = bufferFromText("image bytes")) {
  return {
    name,
    type,
    size,
    async arrayBuffer() {
      return buffer;
    }
  };
}

function testDefaultOcrTimeoutAllowsBrokerToSettleFirst() {
  assert.strictEqual(ScannerOcr.DEFAULT_SCANNER_OCR_TIMEOUT_MS, 50000);
  const runtimeSource = fs.readFileSync(path.join(repoRoot, "src/shared/ocr/ocrRuntime.js"), "utf8");
  const brokerSource = fs.readFileSync(path.join(repoRoot, "src/content/files/protectedSiteOcrBroker.js"), "utf8");
  assert.ok(runtimeSource.includes("const DEFAULT_IMAGE_RECOGNITION_TIMEOUT_MS = 40000;"));
  assert.ok(brokerSource.includes("const DEFAULT_TIMEOUT_MS = 45000;"));
}

async function makeSyntheticApiKeyPng(text) {
  return makeSyntheticTextImage(text, "png");
}

async function makeSyntheticTextImage(text, format, options = {}) {
  const width = options.width || 900;
  const height = options.height || 140;
  const rotate = options.rotate || 0;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="140">
    <rect width="100%" height="100%" fill="white"/>
    <text x="24" y="82" font-family="Arial" font-size="36" fill="black">${String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>
  </svg>`;
  let image = sharp(Buffer.from(svg)).resize(width, height, { fit: "contain", background: "white" });
  if (rotate) image = image.rotate(rotate, { background: "white" });
  const buffer = await image.toFormat(format).toBuffer();
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function scanOcrText(text, fileName = "scan.png") {
  return FileScanner.scanTextContent({
    fileName,
    mimeType: "image/png",
    sizeBytes: text.length,
    text,
    extractedText: true,
    mode: "hide_public"
  });
}

function wordBox(text, start, box, confidence = 94) {
  return {
    text,
    start,
    end: start + text.length,
    confidence,
    box
  };
}

function lineBox(text, start, box, confidence = 88) {
  return {
    text,
    start,
    end: start + text.length,
    confidence,
    box
  };
}

async function sharpCanvasAdapter({ imageBytes, boxes }) {
  let image = sharp(Buffer.from(imageBytes));
  for (const box of boxes) {
    image = image.composite([
      {
        input: {
          create: {
            width: Math.ceil(box.width),
            height: Math.ceil(box.height),
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 1 }
          }
        },
        left: Math.floor(box.x),
        top: Math.floor(box.y)
      }
    ]);
  }
  const output = await image.png().toBuffer();
  return new Blob([output], { type: "image/png" });
}

async function testSupportedImageTypesOnly() {
  for (const [name, type] of [
    ["scan.png", "image/png"],
    ["scan.jpg", "image/jpeg"],
    ["scan.jpeg", "image/jpeg"],
    ["scan.webp", "image/webp"]
  ]) {
    assert.strictEqual(ScannerOcr.isSupportedScannerOcrImage({ fileName: name, mimeType: type }), true, name);
  }

  for (const [name, type] of [
    ["scan.gif", "image/gif"],
    ["scan.svg", "image/svg+xml"],
    ["scan.pdf", "application/pdf"],
    ["scan.txt", "text/plain"],
    ["scan.png", "application/octet-stream"]
  ]) {
    assert.strictEqual(ScannerOcr.isSupportedScannerOcrImage({ fileName: name, mimeType: type }), false, name);
  }
}

async function testOversizedImageFailsSafely() {
  const result = ScannerOcr.validateScannerOcrImage({
    fileName: "huge.png",
    mimeType: "image/png",
    sizeBytes: ScannerOcr.MAX_SCANNER_OCR_IMAGE_BYTES + 1
  });

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, "ocr_image_too_large");
  assert.ok(result.message.includes("too large"));
}

async function testOversizedDimensionsFailSafely() {
  const result = ScannerOcr.validateScannerOcrImage({
    fileName: "wide.png",
    mimeType: "image/png",
    sizeBytes: 1024,
    dimensions: {
      width: ScannerOcr.MAX_SCANNER_OCR_IMAGE_DIMENSION + 1,
      height: 100
    }
  });

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, "ocr_image_dimensions_too_large");
  assert.ok(result.message.includes("dimensions"));
}

async function testOcrTextFeedsDetectorRedactorAndReportIsSanitized() {
  const rawSecret = "sk-proj-LeakGuardOcrApiKey1234567890abcdef";
  const scanText = ScannerOcr.buildScannerOcrScanText({
    metadataText: "file_name=scan.png\nvisual_text_scanned=false",
    ocrText: `API_KEY=${rawSecret}`,
    ocrMetadata: {
      language: "eng",
      textLength: rawSecret.length + 8,
      confidenceBucket: "high",
      warnings: []
    }
  });
  const result = scanOcrText(scanText);
  const report = FileScanner.buildSanitizedReport(result);
  const reportJson = JSON.stringify(report);

  assert.ok(result.summary.findingsCount > 0);
  assert.strictEqual(result.redactedText.includes(rawSecret), false);
  assert.strictEqual(reportJson.includes(rawSecret), false);
  assert.ok(report.redactedPreview.includes("[PWM_"));
  assert.strictEqual(reportJson.includes("API_KEY=sk-proj"), false);
}

async function testUserLikeImageFormatsFeedSanitizedScannerOutput() {
  const fixtures = [
    { fileName: "scan.png", mimeType: "image/png", format: "png", magic: [137, 80, 78, 71] },
    { fileName: "scan.jpg", mimeType: "image/jpeg", format: "jpeg", magic: [255, 216, 255] },
    { fileName: "scan.jpeg", mimeType: "image/jpeg", format: "jpeg", magic: [255, 216, 255] }
  ];

  try {
    await sharp({
      create: {
        width: 1,
        height: 1,
        channels: 3,
        background: "white"
      }
    }).webp().toBuffer();
    fixtures.push({ fileName: "scan.webp", mimeType: "image/webp", format: "webp", magicText: "RIFF" });
  } catch {
    // Sharp builds without WEBP are allowed; browser build gates cover WEBP packaging support.
  }

  for (const fixture of fixtures) {
    const rawSecret = `sk-proj-LeakGuard${fixture.format}OcrApiKey1234567890abcdef`;
    const imageBuffer = await makeSyntheticTextImage(`API_KEY=${rawSecret}`, fixture.format);
    const runtime = {
      recognizeImageBytes(payload) {
        const prefix = Array.from(payload.imageBytes.slice(0, fixture.magic?.length || 4));
        if (fixture.magic) {
          assert.deepStrictEqual(prefix, fixture.magic, `${fixture.fileName}: expected image magic`);
        } else {
          assert.strictEqual(new TextDecoder("ascii").decode(payload.imageBytes.slice(0, 4)), fixture.magicText);
        }
        return Promise.resolve({
          ok: true,
          status: "ocr_recognition_ready",
          language: "eng",
          text: `API_KEY=${rawSecret}`,
          textLength: rawSecret.length + 8,
          confidenceBucket: "high",
          warnings: []
        });
      }
    };
    const file = makeFile(fixture.fileName, fixture.mimeType, imageBuffer.byteLength, imageBuffer);
    const ocr = await ScannerOcr.recognizeScannerImageFile(file, { runtime, timeoutMs: 1000 });
    const result = scanOcrText(
      ScannerOcr.buildScannerOcrScanText({
        metadataText: `file_name=${fixture.fileName}`,
        ocrText: ocr.text,
        ocrMetadata: ocr
      }),
      fixture.fileName
    );
    const reportJson = JSON.stringify(FileScanner.buildSanitizedReport(result));

    assert.strictEqual(ocr.ok, true, `${fixture.fileName}: OCR should complete`);
    assert.ok(result.summary.findingsCount > 0, `${fixture.fileName}: expected API key finding`);
    assert.strictEqual(result.redactedText.includes(rawSecret), false, `${fixture.fileName}: redacted text leaked raw OCR`);
    assert.strictEqual(reportJson.includes(rawSecret), false, `${fixture.fileName}: JSON report leaked raw OCR`);
    assert.ok(result.redactedText.includes("API_KEY=[PWM_"), `${fixture.fileName}: API key label should remain visible`);
  }
}

async function testSafeImageProducesSanitizedNoFindingReport() {
  const ocrText = "HELLO FROM LOCAL RECEIPT";
  const imageBuffer = await makeSyntheticTextImage(ocrText, "png");
  const runtime = {
    recognizeImageBytes() {
      return Promise.resolve({
        ok: true,
        status: "ocr_recognition_ready",
        language: "eng",
        text: ocrText,
        textLength: ocrText.length,
        confidenceBucket: "high",
        warnings: []
      });
    }
  };
  const ocr = await ScannerOcr.recognizeScannerImageFile(
    makeFile("receipt.png", "image/png", imageBuffer.byteLength, imageBuffer),
    { runtime, timeoutMs: 1000 }
  );
  const result = scanOcrText(
    ScannerOcr.buildScannerOcrScanText({
      metadataText: "file_name=receipt.png",
      ocrText: ocr.text,
      ocrMetadata: ocr
    }),
    "receipt.png"
  );
  const reportJson = JSON.stringify(FileScanner.buildSanitizedReport(result));

  assert.strictEqual(ocr.ok, true);
  assert.strictEqual(result.summary.findingsCount, 0);
  assert.ok(reportJson.includes("HELLO FROM LOCAL RECEIPT"));
  assert.strictEqual(reportJson.includes("[PWM_"), false);
}

async function testLowConfidenceRotatedImageWarnsAndStillRedacts() {
  const rawSecret = "sk-proj-LowConfidenceRotatedOcrApiKey1234567890abcdef";
  const imageBuffer = await makeSyntheticTextImage(`API_KEY=${rawSecret}`, "png", { rotate: 90 });
  const runtime = {
    recognizeImageBytes() {
      return Promise.resolve({
        ok: true,
        status: "ocr_recognition_ready",
        language: "eng",
        text: `API_KEY=${rawSecret}`,
        textLength: rawSecret.length + 8,
        confidenceBucket: "low",
        warnings: ["ocr_low_confidence"]
      });
    }
  };
  const ocr = await ScannerOcr.recognizeScannerImageFile(
    makeFile("rotated.png", "image/png", imageBuffer.byteLength, imageBuffer),
    { runtime, timeoutMs: 1000 }
  );
  const result = scanOcrText(
    ScannerOcr.buildScannerOcrScanText({
      metadataText: "file_name=rotated.png",
      ocrText: ocr.text,
      ocrMetadata: ocr
    }),
    "rotated.png"
  );
  result.reportWarnings.push(...ocr.warnings.map((warning) => `ocr:${warning}`));
  const reportJson = JSON.stringify(FileScanner.buildSanitizedReport(result));

  assert.strictEqual(ocr.ok, true);
  assert.strictEqual(ocr.confidenceBucket, "low");
  assert.deepStrictEqual(ocr.warnings, ["ocr_low_confidence"]);
  assert.strictEqual(result.redactedText.includes(rawSecret), false);
  assert.strictEqual(reportJson.includes(rawSecret), false);
  assert.ok(reportJson.includes("ocr:ocr_low_confidence"));
}

async function testRuntimeRecognitionUsesExplicitMessageAndTimeout() {
  const messages = [];
  const fakeApiKeyLine = "API_KEY=sk-proj-LeakGuardOcrApiKey1234567890abcdef";
  const imageBuffer = await makeSyntheticApiKeyPng(fakeApiKeyLine);
  const runtime = {
    recognizeImageBytes(payload) {
      messages.push(payload);
      return Promise.resolve({
        ok: true,
        status: "ocr_recognition_ready",
        language: "eng",
        text: fakeApiKeyLine,
        textLength: fakeApiKeyLine.length,
        confidenceBucket: "high",
        warnings: []
      });
    }
  };
  const file = makeFile("scan.png", "image/png", imageBuffer.byteLength, imageBuffer);
  const result = await ScannerOcr.recognizeScannerImageFile(file, { runtime, timeoutMs: 1000 });

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.language, "eng");
  assert.ok(result.text.includes("API_KEY="));
  assert.strictEqual(result.text.includes("sk-proj-LeakGuardOcrApiKey"), true);
  assert.deepStrictEqual(Object.keys(result).sort(), [
    "confidenceBucket",
    "language",
    "layout",
    "ok",
    "status",
    "text",
    "textLength",
    "warnings"
  ].sort());
  assert.strictEqual(messages.length, 1);
  assert.strictEqual(messages[0].type, "ocr_recognize_image");
  assert.strictEqual(messages[0].language, "eng");
  assert.strictEqual(messages[0].mimeType, "image/png");
  assert.ok(messages[0].imageBytes instanceof Uint8Array);
  assert.deepStrictEqual(Array.from(messages[0].imageBytes.slice(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
}

async function testReadDimensionsReusesImageBytesForRuntimePayload() {
  const ocrText = "HELLO FROM LOCAL RECEIPT";
  const imageBuffer = await makeSyntheticTextImage(ocrText, "png");
  const expectedMagic = [137, 80, 78, 71, 13, 10, 26, 10];
  const hadCreateImageBitmap = Object.prototype.hasOwnProperty.call(globalThis, "createImageBitmap");
  const originalCreateImageBitmap = globalThis.createImageBitmap;
  let arrayBufferCalls = 0;
  let bitmapClosed = false;
  let probedMagic = [];

  globalThis.createImageBitmap = async (blob) => {
    probedMagic = Array.from(new Uint8Array(await blob.arrayBuffer()).slice(0, expectedMagic.length));
    return {
      width: 900,
      height: 140,
      close() {
        bitmapClosed = true;
      }
    };
  };

  try {
    const file = {
      name: "dimension-probe.png",
      type: "image/png",
      size: imageBuffer.byteLength,
      async arrayBuffer() {
        arrayBufferCalls += 1;
        return imageBuffer;
      }
    };
    const runtime = {
      recognizeImageBytes(payload) {
        assert.ok(payload.imageBytes instanceof Uint8Array);
        assert.strictEqual(payload.imageBytes.buffer, imageBuffer);
        assert.deepStrictEqual(Array.from(payload.imageBytes.slice(0, expectedMagic.length)), expectedMagic);
        return Promise.resolve({
          ok: true,
          status: "ocr_recognition_ready",
          language: "eng",
          text: ocrText,
          textLength: ocrText.length,
          confidenceBucket: "high",
          warnings: []
        });
      }
    };
    const ocr = await ScannerOcr.recognizeScannerImageFile(file, { runtime, timeoutMs: 1000, readDimensions: true });

    assert.strictEqual(ocr.ok, true);
    assert.strictEqual(arrayBufferCalls, 1);
    assert.strictEqual(bitmapClosed, true);
    assert.deepStrictEqual(probedMagic, expectedMagic);
  } finally {
    if (hadCreateImageBitmap) {
      globalThis.createImageBitmap = originalCreateImageBitmap;
    } else {
      delete globalThis.createImageBitmap;
    }
  }
}

async function testOcrLayoutFallbackIndexesRemainStableForWordAndLineResults() {
  const imageBuffer = bufferFromText("image bytes");
  const wordText = "alpha beta alpha";
  const wordRuntime = {
    recognizeImageBytes() {
      return Promise.resolve({
        ok: true,
        status: "ocr_recognition_ready",
        language: "eng",
        text: wordText,
        textLength: wordText.length,
        confidenceBucket: "high",
        warnings: [],
        words: [
          { text: "alpha", confidence: 94, box: { x: 1, y: 2, width: 10, height: 5 } },
          { text: "alpha", confidence: 94, box: { x: 30, y: 2, width: 11, height: 5 } }
        ]
      });
    }
  };
  const wordOcr = await ScannerOcr.recognizeScannerImageFile(
    makeFile("word-fallback.png", "image/png", imageBuffer.byteLength, imageBuffer),
    { runtime: wordRuntime, timeoutMs: 1000, dimensions: { width: 100, height: 20 } }
  );

  assert.strictEqual(wordOcr.layout.source, "word");
  assert.deepStrictEqual(
    wordOcr.layout.boxes.map((box) => ({ start: box.start, end: box.end, boxKind: box.boxKind })),
    [
      { start: 0, end: 5, boxKind: "word" },
      { start: 11, end: 16, boxKind: "word" }
    ]
  );
  assert.strictEqual(wordOcr.layout.fallbackUsed, false);
  assert.strictEqual(wordOcr.layout.visualRedactionSafe, true);
  assert.strictEqual(wordOcr.layout.protectedSiteEligible, true);

  const lineText = "first line\nsecond line\nthird line";
  const lineRuntime = {
    recognizeImageBytes() {
      return Promise.resolve({
        ok: true,
        status: "ocr_recognition_ready",
        language: "eng",
        text: lineText,
        textLength: lineText.length,
        confidenceBucket: "high",
        warnings: [],
        lines: [{ text: "second line", confidence: 80, box: { x: 4, y: 12, width: 64, height: 11 } }]
      });
    }
  };
  const lineOcr = await ScannerOcr.recognizeScannerImageFile(
    makeFile("line-fallback.png", "image/png", imageBuffer.byteLength, imageBuffer),
    { runtime: lineRuntime, timeoutMs: 1000, dimensions: { width: 100, height: 40 } }
  );

  assert.strictEqual(lineOcr.layout.source, "line");
  assert.deepStrictEqual(
    lineOcr.layout.boxes.map((box) => ({ start: box.start, end: box.end, boxKind: box.boxKind })),
    [{ start: 11, end: 22, boxKind: "line" }]
  );
  assert.strictEqual(lineOcr.layout.fallbackUsed, false);
  assert.strictEqual(lineOcr.layout.visualRedactionSafe, true);
  assert.strictEqual(lineOcr.layout.protectedSiteEligible, true);
}

async function testOcrWordBoxesMapDetectedSecretToRedactionBoxes() {
  const rawSecret = "sk-proj-LeakGuardVisualApiKey1234567890abcdef";
  const ocrText = `API_KEY=${rawSecret}`;
  const runtime = {
    recognizeImageBytes() {
      return Promise.resolve({
        ok: true,
        status: "ocr_recognition_ready",
        language: "eng",
        text: ocrText,
        textLength: ocrText.length,
        confidenceBucket: "high",
        warnings: [],
        words: [
          wordBox("API_KEY=", 0, { x: 24, y: 44, width: 142, height: 42 }),
          wordBox(rawSecret, 8, { x: 170, y: 44, width: 620, height: 42 })
        ]
      });
    }
  };
  const imageBuffer = await makeSyntheticApiKeyPng(ocrText);
  const ocr = await ScannerOcr.recognizeScannerImageFile(
    makeFile("visual.png", "image/png", imageBuffer.byteLength, imageBuffer),
    { runtime, timeoutMs: 1000, dimensions: { width: 900, height: 140 } }
  );
  const scanText = ScannerOcr.buildScannerOcrScanText({
    metadataText: "file_name=visual.png",
    ocrText: ocr.text,
    ocrMetadata: ocr
  });
  const result = scanOcrText(scanText, "visual.png");
  const boxes = ScannerOcr.redactionBoxesForOcrFindings({ ocr, scanResult: result, scanText, ocrText: ocr.text });
  const serializedBoxes = JSON.stringify(boxes);

  assert.strictEqual(ocr.ok, true);
  assert.ok(Array.isArray(ocr.layout?.boxes), "OCR success should expose sanitized layout boxes");
  assert.strictEqual(JSON.stringify(ocr.layout).includes(rawSecret), false, "layout metadata must be raw-safe");
  assert.ok(result.summary.findingsCount > 0, "fake API key should be detected from OCR text");
  assert.ok(boxes.ok, boxes.message);
  assert.strictEqual(boxes.boxes.length, 1);
  assert.strictEqual(serializedBoxes.includes(rawSecret), false, "redaction box metadata must not contain raw OCR text");
  assert.strictEqual(boxes.boxKind, "word");
  assert.strictEqual(boxes.fallbackUsed, false);
  assert.strictEqual(boxes.visualRedactionSafe, true);
  assert.strictEqual(boxes.protectedSiteEligible, true);
  assert.deepStrictEqual(boxes.warnings, []);
  assert.strictEqual(boxes.boxes[0].boxKind, "word");
  assert.strictEqual(boxes.boxes[0].fallbackUsed, false);
  assert.strictEqual(boxes.boxes[0].visualRedactionSafe, true);
  assert.ok(boxes.boxes[0].width > 0);
  assert.ok(boxes.boxes[0].height > 0);
}

async function testOcrWordBoxesArePreferredOverLineBoxes() {
  const rawSecret = "sk-proj-PreferWordBoxes1234567890abcdef";
  const ocrText = `API_KEY=${rawSecret}`;
  const runtime = {
    recognizeImageBytes() {
      return Promise.resolve({
        ok: true,
        status: "ocr_recognition_ready",
        language: "eng",
        text: ocrText,
        textLength: ocrText.length,
        confidenceBucket: "high",
        warnings: [],
        words: [wordBox(rawSecret, 8, { x: 220, y: 42, width: 360, height: 40 })],
        lines: [lineBox(ocrText, 0, { x: 20, y: 30, width: 820, height: 70 })]
      });
    }
  };
  const imageBuffer = await makeSyntheticApiKeyPng(ocrText);
  const ocr = await ScannerOcr.recognizeScannerImageFile(
    makeFile("prefer-word.png", "image/png", imageBuffer.byteLength, imageBuffer),
    { runtime, timeoutMs: 1000, dimensions: { width: 900, height: 140 } }
  );
  const scanText = ScannerOcr.buildScannerOcrScanText({
    metadataText: "file_name=prefer-word.png",
    ocrText: ocr.text,
    ocrMetadata: ocr
  });
  const result = scanOcrText(scanText, "prefer-word.png");
  const boxes = ScannerOcr.redactionBoxesForOcrFindings({ ocr, scanResult: result, scanText, ocrText: ocr.text });

  assert.strictEqual(ocr.layout.source, "word");
  assert.strictEqual(ocr.layout.boxes[0].boxKind, "word");
  assert.strictEqual(boxes.ok, true);
  assert.strictEqual(boxes.boxKind, "word");
  assert.strictEqual(boxes.boxes[0].width, 360);
  assert.deepStrictEqual(boxes.warnings, []);
}

async function testLowConfidenceWordBoxRecoversWithEligibleContainingLine() {
  const rawSecret = "sk-proj-MultilineRecovery1234567890abcdef";
  const lines = Array.from({ length: 12 }, (_, index) =>
    index === 7 ? `API_KEY=${rawSecret}` : `SAFE_LINE_${index + 1}=visible`
  );
  const ocrText = lines.join("\n");
  const secretStart = ocrText.indexOf(rawSecret);
  const secretLine = `API_KEY=${rawSecret}`;
  const secretLineStart = ocrText.indexOf(secretLine);
  const runtime = {
    recognizeImageBytes() {
      return Promise.resolve({
        ok: true,
        status: "ocr_recognition_ready",
        language: "eng",
        text: ocrText,
        textLength: ocrText.length,
        confidenceBucket: "medium",
        warnings: [],
        layout: {
          source: "word",
          boxes: [
            {
              start: secretStart,
              end: secretStart + rawSecret.length,
              x: 260,
              y: 350,
              width: 900,
              height: 42,
              confidenceBucket: "low",
              text: rawSecret
            }
          ],
          lineBoxes: [
            {
              boxKind: "line",
              start: secretLineStart,
              end: secretLineStart + secretLine.length,
              x: 24,
              y: 340,
              width: 1180,
              height: 62,
              confidenceBucket: "medium",
              text: secretLine
            }
          ]
        }
      });
    }
  };
  const imageBuffer = await makeSyntheticApiKeyPng(ocrText);
  const ocr = await ScannerOcr.recognizeScannerImageFile(
    makeFile("multiline.png", "image/png", imageBuffer.byteLength, imageBuffer),
    { runtime, timeoutMs: 1000, dimensions: { width: 1400, height: 720 } }
  );
  const scanText = ScannerOcr.buildScannerOcrScanText({
    metadataText: "file_name=multiline.png",
    ocrText,
    ocrMetadata: ocr
  });
  const scanResult = scanOcrText(scanText, "multiline.png");
  const result = ScannerOcr.redactionBoxesForOcrFindings({ ocr, scanResult, scanText, ocrText });

  assert.strictEqual(ocr.layout.boxes[0].boxKind, "word");
  assert.strictEqual(ocr.layout.lineBoxes[0].boxKind, "line");
  assert.strictEqual(ocr.layout.lineBoxes[0].protectedSiteEligible, true);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(ocr.layout.lineBoxes[0], "text"), false);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.boxKind, "line");
  assert.strictEqual(result.boxes[0].x, 24);
  assert.strictEqual(result.boxes[0].width, 1180);
  assert.ok(result.warnings.includes("ocr_line_boxes_used"));
  assert.strictEqual(JSON.stringify(ocr.layout).includes(rawSecret), false);
}

async function testLineRecoveryRequiresContainmentAndPreservesIndependentFindings() {
  const firstSecret = "sk-proj-MultilineFirst1234567890abcdef";
  const secondSecret = "sk-proj-MultilineSecond1234567890abcdef";
  const lines = [
    "SAFE_LINE_1=visible",
    `FIRST_KEY=${firstSecret}`,
    "SAFE_LINE_3=visible",
    `SECOND_KEY=${secondSecret}`
  ];
  const ocrText = lines.join("\n");
  const firstStart = ocrText.indexOf(firstSecret);
  const secondStart = ocrText.indexOf(secondSecret);
  const firstLineStart = ocrText.indexOf(lines[1]);
  const secondLineStart = ocrText.indexOf(lines[3]);
  const imageBuffer = await makeSyntheticApiKeyPng(ocrText);

  async function recognize(linesOverride, dimensions = { width: 900, height: 240 }) {
    return ScannerOcr.recognizeScannerImageFile(
      makeFile("line-recovery.png", "image/png", imageBuffer.byteLength, imageBuffer),
      {
        runtime: {
          recognizeImageBytes() {
            return Promise.resolve({
              ok: true,
              status: "ocr_recognition_ready",
              language: "eng",
              text: ocrText,
              textLength: ocrText.length,
              confidenceBucket: "medium",
              warnings: [],
              words: [
                wordBox(firstSecret, firstStart, { x: 180, y: 70, width: 600, height: 34 }, 42),
                wordBox(secondSecret, secondStart, { x: 180, y: 170, width: 600, height: 34 }, 42)
              ],
              lines: linesOverride
            });
          }
        },
        timeoutMs: 1000,
        dimensions
      }
    );
  }

  function mapFindings(ocr) {
    const scanText = ScannerOcr.buildScannerOcrScanText({
      metadataText: "file_name=line-recovery.png",
      ocrText,
      ocrMetadata: ocr
    });
    return ScannerOcr.redactionBoxesForOcrFindings({
      ocr,
      scanResult: scanOcrText(scanText, "line-recovery.png"),
      scanText,
      ocrText
    });
  }

  const partialOcr = await recognize([
    {
      ...lineBox(lines[1], firstLineStart, { x: 16, y: 60, width: 820, height: 50 }, 78),
      end: firstStart + firstSecret.length - 1
    }
  ]);
  const partialContainmentResult = mapFindings(partialOcr);
  assert.strictEqual(partialContainmentResult.ok, false);
  assert.strictEqual(partialContainmentResult.status, "ocr_box_confidence_too_low");

  const eligibleLines = [
    lineBox(lines[1], firstLineStart, { x: 16, y: 60, width: 820, height: 50 }, 78),
    lineBox(lines[3], secondLineStart, { x: 16, y: 160, width: 820, height: 50 }, 78)
  ];
  const multipleSecretResult = mapFindings(await recognize(eligibleLines));
  assert.strictEqual(multipleSecretResult.ok, true);
  assert.strictEqual(multipleSecretResult.boxes.length, 2);
  assert.strictEqual(multipleSecretResult.boxes.every((box) => box.boxKind === "line"), true);

  const lowResolutionResult = mapFindings(await recognize(eligibleLines, { width: 320, height: 240 }));
  assert.strictEqual(lowResolutionResult.ok, true);
  assert.strictEqual(lowResolutionResult.protectedSiteEligible, true);
}

async function testOcrLineBoxesAcceptedWithWarning() {
  const rawSecret = "sk-proj-LineBoxVisual1234567890abcdef";
  const ocrText = `API_KEY=${rawSecret}`;
  const runtime = {
    recognizeImageBytes() {
      return Promise.resolve({
        ok: true,
        status: "ocr_recognition_ready",
        language: "eng",
        text: ocrText,
        textLength: ocrText.length,
        confidenceBucket: "high",
        warnings: [],
        lines: [lineBox(ocrText, 0, { x: 24, y: 36, width: 780, height: 58 }, 82)]
      });
    }
  };
  const imageBuffer = await makeSyntheticApiKeyPng(ocrText);
  const ocr = await ScannerOcr.recognizeScannerImageFile(
    makeFile("line.png", "image/png", imageBuffer.byteLength, imageBuffer),
    { runtime, timeoutMs: 1000, dimensions: { width: 900, height: 140 } }
  );
  const scanText = ScannerOcr.buildScannerOcrScanText({
    metadataText: "file_name=line.png",
    ocrText: ocr.text,
    ocrMetadata: ocr
  });
  const result = scanOcrText(scanText, "line.png");
  const boxes = ScannerOcr.redactionBoxesForOcrFindings({ ocr, scanResult: result, scanText, ocrText: ocr.text });

  assert.strictEqual(ocr.layout.source, "line");
  assert.strictEqual(ocr.layout.boxes[0].boxKind, "line");
  assert.strictEqual(boxes.ok, true);
  assert.strictEqual(boxes.boxKind, "line");
  assert.strictEqual(boxes.visualRedactionSafe, true);
  assert.strictEqual(boxes.protectedSiteEligible, true);
  assert.ok(boxes.warnings.includes("ocr_line_boxes_used"));
}

async function testFallbackBoxesAreMarkedScannerOnlyAndNotProtectedSiteEligible() {
  const rawSecret = "sk-proj-FallbackVisual1234567890abcdef";
  const ocrText = `API_KEY=${rawSecret}`;
  const runtime = {
    recognizeImageBytes() {
      return Promise.resolve({
        ok: true,
        status: "ocr_recognition_ready",
        language: "eng",
        text: ocrText,
        textLength: ocrText.length,
        confidenceBucket: "high",
        warnings: [],
        layout: {
          source: "fallback",
          fallbackUsed: true,
          visualRedactionSafe: false,
          boxes: [
            {
              boxKind: "fallback",
              kind: "fallback",
              start: 0,
              end: ocrText.length,
              x: 0,
              y: 0,
              width: 900,
              height: 140,
              confidenceBucket: "high",
              fallbackUsed: true,
              visualRedactionSafe: false
            }
          ]
        }
      });
    }
  };
  const imageBuffer = await makeSyntheticApiKeyPng(ocrText);
  const ocr = await ScannerOcr.recognizeScannerImageFile(
    makeFile("fallback.png", "image/png", imageBuffer.byteLength, imageBuffer),
    { runtime, timeoutMs: 1000, dimensions: { width: 900, height: 140 } }
  );
  const scanText = ScannerOcr.buildScannerOcrScanText({
    metadataText: "file_name=fallback.png",
    ocrText: ocr.text,
    ocrMetadata: ocr
  });
  const result = scanOcrText(scanText, "fallback.png");
  const boxes = ScannerOcr.redactionBoxesForOcrFindings({ ocr, scanResult: result, scanText, ocrText: ocr.text });

  assert.strictEqual(ocr.layout.source, "fallback");
  assert.strictEqual(ocr.layout.fallbackUsed, true);
  assert.strictEqual(ocr.layout.visualRedactionSafe, false);
  assert.strictEqual(boxes.ok, true);
  assert.strictEqual(boxes.boxKind, "fallback");
  assert.strictEqual(boxes.fallbackUsed, true);
  assert.strictEqual(boxes.visualRedactionSafe, false);
  assert.strictEqual(boxes.protectedSiteEligible, false);
  assert.ok(boxes.warnings.includes("ocr_fallback_boxes_used_scanner_only"));
}

async function testMissingBoxesFailClosedForVisualRedaction() {
  const rawSecret = "sk-proj-MissingBoxes1234567890abcdef";
  const ocrText = `API_KEY=${rawSecret}`;
  const ocr = {
    ok: true,
    text: ocrText,
    layout: {
      source: "none",
      boxes: []
    }
  };
  const scanText = ScannerOcr.buildScannerOcrScanText({
    metadataText: "file_name=missing.png",
    ocrText,
    ocrMetadata: { textLength: ocrText.length, confidenceBucket: "high" }
  });
  const result = scanOcrText(scanText, "missing.png");
  const boxes = ScannerOcr.redactionBoxesForOcrFindings({ ocr, scanResult: result, scanText, ocrText });

  assert.strictEqual(result.summary.findingsCount > 0, true);
  assert.strictEqual(boxes.ok, false);
  assert.strictEqual(boxes.status, "ocr_boxes_missing");
  assert.strictEqual(boxes.protectedSiteEligible, false);
}

async function testRedactedPngProofGeneratesFlattenedOutputAndRescanIsClean() {
  const rawSecret = "sk-proj-LeakGuardVisualPngProof1234567890abcdef";
  const ocrText = `API_KEY=${rawSecret}`;
  const imageBuffer = await makeSyntheticApiKeyPng(ocrText);
  const redaction = await ImageRedactor.createRedactedPng({
    imageBytes: imageBuffer,
    mimeType: "image/png",
    fileName: "visual.png",
    boxes: [{ x: 160, y: 38, width: 720, height: 58, confidenceBucket: "high" }],
    canvasAdapter: sharpCanvasAdapter
  });
  const redactedBytes = new Uint8Array(await redaction.blob.arrayBuffer());
  const originalBytes = new Uint8Array(imageBuffer);
  const redactedOcrText = "API_KEY=[PWM_1]";
  const rescan = scanOcrText(
    ScannerOcr.buildScannerOcrScanText({
      metadataText: "file_name=visual.redacted.png",
      ocrText: redactedOcrText,
      ocrMetadata: { textLength: redactedOcrText.length, confidenceBucket: "high" }
    }),
    "visual.redacted.png"
  );

  assert.strictEqual(redaction.ok, true);
  assert.strictEqual(redaction.fileName, "visual.redacted.png");
  assert.strictEqual(redaction.blob.type, "image/png");
  assert.ok(redactedBytes.length > 0);
  assert.notDeepStrictEqual(Buffer.from(redactedBytes), Buffer.from(originalBytes));
  assert.strictEqual(rescan.redactedText.includes(rawSecret), false);
  assert.strictEqual(rescan.summary.findingsCount, 0);
}

async function testVisualRedactionHandlesDifferentSafeImageSizes() {
  for (const fixture of [
    { name: "small.png", width: 320, height: 120, box: { x: 54, y: 28, width: 230, height: 52 } },
    { name: "medium.png", width: 1024, height: 320, box: { x: 190, y: 92, width: 760, height: 120 } },
    { name: "large.png", width: 2048, height: 720, box: { x: 380, y: 210, width: 1450, height: 220 } }
  ]) {
    const rawSecret = `sk-proj-SizeProof${fixture.width}x${fixture.height}1234567890abcdef`;
    const imageBuffer = await makeSyntheticTextImage(`API_KEY=${rawSecret}`, "png", {
      width: fixture.width,
      height: fixture.height
    });
    const originalBytes = new Uint8Array(imageBuffer);
    const redaction = await ImageRedactor.createRedactedPng({
      imageBytes: imageBuffer,
      mimeType: "image/png",
      fileName: fixture.name,
      dimensions: { width: fixture.width, height: fixture.height },
      boxes: [{ ...fixture.box, confidenceBucket: "high" }],
      canvasAdapter: sharpCanvasAdapter
    });
    const redactedBytes = new Uint8Array(await redaction.blob.arrayBuffer());
    const metadata = await sharp(Buffer.from(redactedBytes)).metadata();

    assert.strictEqual(redaction.ok, true, fixture.name);
    assert.strictEqual(redaction.fileName, fixture.name.replace(/\.png$/i, ".redacted.png"), fixture.name);
    assert.strictEqual(redaction.blob.type, "image/png", fixture.name);
    assert.notDeepStrictEqual(Buffer.from(redactedBytes), Buffer.from(originalBytes), fixture.name);
    assert.strictEqual(metadata.width, fixture.width, fixture.name);
    assert.strictEqual(metadata.height, fixture.height, fixture.name);
  }
}

async function testCleanImagesWithDifferentSizesCanPassThroughAsSafePngs() {
  for (const fixture of [
    { name: "receipt-small.png", text: "SAFE RECEIPT TOTAL 12.40", width: 240, height: 96 },
    { name: "diagram-medium.png", text: "DEPLOYMENT DIAGRAM PUBLIC", width: 960, height: 360 },
    { name: "whiteboard-large.png", text: "ROADMAP NOTES WITHOUT SECRETS", width: 1800, height: 640 }
  ]) {
    const imageBuffer = await makeSyntheticTextImage(fixture.text, "png", {
      width: fixture.width,
      height: fixture.height
    });
    const ocr = await ScannerOcr.recognizeScannerImageFile(
      makeFile(fixture.name, "image/png", imageBuffer.byteLength, imageBuffer),
      {
        runtime: {
          recognizeImageBytes() {
            return Promise.resolve({
              ok: true,
              status: "ocr_recognition_ready",
              language: "eng",
              text: fixture.text,
              textLength: fixture.text.length,
              confidenceBucket: "high",
              warnings: []
            });
          }
        },
        timeoutMs: 1000,
        dimensions: { width: fixture.width, height: fixture.height }
      }
    );
    const result = scanOcrText(
      ScannerOcr.buildScannerOcrScanText({
        metadataText: `file_name=${fixture.name}`,
        ocrText: ocr.text,
        ocrMetadata: ocr
      }),
      fixture.name
    );
    const png = await ImageRedactor.createRedactedPng({
      imageBytes: imageBuffer,
      mimeType: "image/png",
      fileName: fixture.name,
      dimensions: { width: fixture.width, height: fixture.height },
      boxes: [],
      allowNoBoxes: true,
      canvasAdapter: sharpCanvasAdapter
    });
    const metadata = await sharp(Buffer.from(await png.blob.arrayBuffer())).metadata();

    assert.strictEqual(ocr.ok, true, fixture.name);
    assert.strictEqual(result.summary.findingsCount, 0, fixture.name);
    assert.strictEqual(result.redactedText.includes("[PWM_"), false, fixture.name);
    assert.strictEqual(png.ok, true, fixture.name);
    assert.strictEqual(png.fileName, fixture.name.replace(/\.png$/i, ".redacted.png"), fixture.name);
    assert.strictEqual(png.blob.type, "image/png", fixture.name);
    assert.strictEqual(metadata.width, fixture.width, fixture.name);
    assert.strictEqual(metadata.height, fixture.height, fixture.name);
  }
}

async function testImageRedactorRejectsEmptyPngOutput() {
  const imageBuffer = await makeSyntheticApiKeyPng("API_KEY=sk-proj-EmptyPngOutput1234567890abcdef");
  const redaction = await ImageRedactor.createRedactedPng({
    imageBytes: imageBuffer,
    mimeType: "image/png",
    fileName: "visual.png",
    boxes: [{ x: 160, y: 38, width: 720, height: 58, confidenceBucket: "high" }],
    canvasAdapter: async () => new Blob([], { type: "image/png" })
  });

  assert.strictEqual(redaction.ok, false);
  assert.strictEqual(redaction.status, "image_redaction_empty_output");
  assert.strictEqual(Object.prototype.hasOwnProperty.call(redaction, "blob"), false);
}

async function testJpgAndJpegVisualRedactionOutputsPng() {
  for (const [fileName, format] of [
    ["photo.jpg", "jpeg"],
    ["photo.jpeg", "jpeg"]
  ]) {
    const imageBuffer = await makeSyntheticTextImage("API_KEY=sk-proj-JpegVisualProof1234567890abcdef", format);
    const redaction = await ImageRedactor.createRedactedPng({
      imageBytes: imageBuffer,
      mimeType: "image/jpeg",
      fileName,
      boxes: [{ x: 120, y: 38, width: 680, height: 58, confidenceBucket: "high" }],
      canvasAdapter: sharpCanvasAdapter
    });

    assert.strictEqual(redaction.ok, true, fileName);
    assert.strictEqual(redaction.fileName, fileName.replace(/\.(?:jpg|jpeg)$/i, ".redacted.png"));
    assert.strictEqual(redaction.blob.type, "image/png");
  }
}

async function testWebpVisualRedactionOutputsPngWhenSharpSupportsWebp() {
  let imageBuffer;
  try {
    imageBuffer = await makeSyntheticTextImage("API_KEY=sk-proj-WebpVisualProof1234567890abcdef", "webp");
  } catch {
    return;
  }

  const redaction = await ImageRedactor.createRedactedPng({
    imageBytes: imageBuffer,
    mimeType: "image/webp",
    fileName: "photo.webp",
    boxes: [{ x: 120, y: 38, width: 680, height: 58, confidenceBucket: "high" }],
    canvasAdapter: sharpCanvasAdapter
  });

  assert.strictEqual(redaction.ok, true);
  assert.strictEqual(redaction.fileName, "photo.redacted.png");
  assert.strictEqual(redaction.blob.type, "image/png");
}

async function testVisualRedactionFailsClosedForMissingLowConfidenceAndOversizedBoxes() {
  const imageBuffer = await makeSyntheticApiKeyPng("API_KEY=sk-proj-FailClosedVisual1234567890");

  for (const options of [
    { boxes: [] },
    { boxes: [{ x: 10, y: 10, width: 50, height: 20, confidenceBucket: "low" }] },
    { boxes: [{ x: -1, y: 10, width: 50, height: 20, confidenceBucket: "high" }] }
  ]) {
    const result = await ImageRedactor.createRedactedPng({
      imageBytes: imageBuffer,
      mimeType: "image/png",
      fileName: "visual.png",
      ...options,
      canvasAdapter: sharpCanvasAdapter
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(result, "blob"), false);
  }

  const oversized = await ImageRedactor.createRedactedPng({
    imageBytes: imageBuffer,
    mimeType: "image/png",
    fileName: "visual.png",
    boxes: [{ x: 0, y: 0, width: 20, height: 20, confidenceBucket: "high" }],
    dimensions: { width: ScannerOcr.MAX_SCANNER_OCR_IMAGE_DIMENSION + 1, height: 100 },
    canvasAdapter: sharpCanvasAdapter
  });
  assert.strictEqual(oversized.ok, false);
  assert.strictEqual(oversized.status, "image_dimensions_too_large");

  const corrupted = await ImageRedactor.createRedactedPng({
    imageBytes: bufferFromText("not an image"),
    mimeType: "image/png",
    fileName: "corrupt.png",
    boxes: [{ x: 0, y: 0, width: 20, height: 20, confidenceBucket: "high" }]
  });
  assert.strictEqual(corrupted.ok, false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(corrupted, "blob"), false);
}

async function testLowConfidenceOcrBoxesFailClosedForVisualMapping() {
  const rawSecret = "sk-proj-LowBoxConfidence1234567890abcdef";
  const ocrText = `API_KEY=${rawSecret}`;
  const ocr = {
    ok: true,
    text: ocrText,
    layout: {
      source: "word",
      boxes: [
        {
          boxKind: "word",
          kind: "word",
          start: 8,
          end: ocrText.length,
          x: 120,
          y: 40,
          width: 600,
          height: 48,
          confidenceBucket: "low",
          fallbackUsed: false,
          visualRedactionSafe: false
        }
      ]
    }
  };
  const scanText = ScannerOcr.buildScannerOcrScanText({
    metadataText: "file_name=low-box.png",
    ocrText,
    ocrMetadata: { textLength: ocrText.length, confidenceBucket: "low" }
  });
  const result = scanOcrText(scanText, "low-box.png");
  const boxes = ScannerOcr.redactionBoxesForOcrFindings({ ocr, scanResult: result, scanText, ocrText });

  assert.strictEqual(boxes.ok, false);
  assert.strictEqual(boxes.status, "ocr_box_confidence_too_low");
  assert.strictEqual(boxes.protectedSiteEligible, false);
}

function testRawVisualRedactionMetadataIsNotPersistedOrLoggedByScannerCode() {
  const imageRedactorSource = fs.readFileSync(path.join(repoRoot, "src/shared/imageRedactor.js"), "utf8");
  const sources = [
    ["scanner OCR helper", fs.readFileSync(path.join(repoRoot, "src/shared/scannerOcr.js"), "utf8")],
    ["image redactor helper", imageRedactorSource]
  ];

  for (const [label, source] of sources) {
    assert.strictEqual(source.includes("localStorage"), false, `${label} must not persist raw OCR text to localStorage`);
    assert.strictEqual(source.includes("sessionStorage"), false, `${label} must not persist raw OCR text to sessionStorage`);
    assert.strictEqual(source.includes("chrome.storage"), false, `${label} must not persist raw OCR text to extension storage`);
    assert.strictEqual(source.includes("browser.storage"), false, `${label} must not persist raw OCR text to extension storage`);
    assert.strictEqual(source.includes("pwm:audit"), false, `${label} must not write raw OCR text to audit metadata`);
    assert.strictEqual(source.includes("console.log"), false, `${label} must not log raw OCR text`);
    assert.strictEqual(source.includes("console.warn"), false, `${label} must not warn with raw OCR text`);
    assert.strictEqual(source.includes("console.error"), false, `${label} must not error-log raw OCR text`);
  }
}

function testProtectedSiteUploadPathUsesVisualImageRedactorOnlyBehindEligibilityGate() {
  const pipelineSource = fs.readFileSync(
    path.join(repoRoot, "src/content/files/contentFileExtractionPipeline.js"),
    "utf8"
  );
  const brokerSource = fs.readFileSync(path.join(repoRoot, "src/content/files/protectedSiteOcrBroker.js"), "utf8");
  const manifestSource = fs.readFileSync(path.join(repoRoot, "manifests/base.json"), "utf8");

  assert.ok(pipelineSource.includes("ImageRedactor"));
  assert.ok(pipelineSource.includes("protectedSiteEligible"));
  assert.ok(pipelineSource.includes("fallbackUsed"));
  assert.ok(pipelineSource.includes("redacted_image_file"));
  assert.strictEqual(brokerSource.includes("ImageRedactor"), false);
  assert.strictEqual(manifestSource.includes("shared/imageRedactor.js"), true);
}

async function testRuntimeTimeoutFailsSafelyWithoutRawText() {
  const rawSecret = "sk-proj-TimeoutLeakGuardSecret1234567890";
  const never = new Promise(() => {});
  let terminated = 0;
  const runtime = {
    recognizeImageBytes() {
      return never;
    },
    terminate() {
      terminated += 1;
    }
  };
  const file = makeFile("scan.png", "image/png", 2048, bufferFromText(rawSecret));
  const result = await ScannerOcr.recognizeScannerImageFile(file, { runtime, timeoutMs: 1 });
  const serialized = JSON.stringify(result);

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.status, "ocr_timeout");
  assert.strictEqual(serialized.includes(rawSecret), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(result, "text"), false);
  assert.strictEqual(terminated, 1, "scanner OCR timeout should terminate the worker/runtime cleanup path");
}

async function testCorruptedImageFailsSafelyWithoutRawBytesOrText() {
  const rawSecret = "sk-proj-CorruptedImageSecret1234567890";
  const file = makeFile("corrupt.png", "image/png", 128, bufferFromText(rawSecret));
  const runtime = {
    recognizeImageBytes() {
      return Promise.reject(new Error(`decoder saw ${rawSecret}`));
    }
  };
  const result = await ScannerOcr.recognizeScannerImageFile(file, { runtime, timeoutMs: 1000 });
  const serialized = JSON.stringify(result);

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.status, "ocr_failed");
  assert.strictEqual(Object.prototype.hasOwnProperty.call(result, "text"), false);
  assert.strictEqual(serialized.includes(rawSecret), false);
}

function testUnsupportedImageTypeFailsSafely() {
  const result = ScannerOcr.validateScannerOcrImage({
    fileName: "animated.gif",
    mimeType: "image/gif",
    sizeBytes: 512
  });

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, "ocr_unsupported_image_type");
  assert.ok(result.message.includes("PNG, JPG, JPEG, and WEBP images only"));
}

function testRawOcrTextIsNotPersistedOrLoggedByScannerCode() {
  const scannerSource = fs.readFileSync(path.join(repoRoot, "src/scanner/scanner.js"), "utf8");
  const scannerOcrSource = fs.readFileSync(path.join(repoRoot, "src/shared/scannerOcr.js"), "utf8");
  const ocrRuntimeSource = fs.readFileSync(path.join(repoRoot, "src/shared/ocr/ocrRuntime.js"), "utf8");
  const sources = [
    ["scanner page", scannerSource],
    ["scanner OCR helper", scannerOcrSource],
    ["OCR runtime shell", ocrRuntimeSource]
  ];

  for (const [label, source] of sources) {
    assert.strictEqual(source.includes("localStorage"), false, `${label} must not persist raw OCR text to localStorage`);
    assert.strictEqual(source.includes("sessionStorage"), false, `${label} must not persist raw OCR text to sessionStorage`);
    assert.strictEqual(source.includes("chrome.storage"), false, `${label} must not persist raw OCR text to extension storage`);
    assert.strictEqual(source.includes("browser.storage"), false, `${label} must not persist raw OCR text to extension storage`);
    assert.strictEqual(source.includes("pwm:audit"), false, `${label} must not write raw OCR text to audit metadata`);
    assert.strictEqual(source.includes("console.log"), false, `${label} must not log raw OCR text`);
    assert.strictEqual(source.includes("console.warn"), false, `${label} must not warn with raw OCR text`);
    assert.strictEqual(source.includes("console.error"), false, `${label} must not error-log raw OCR text`);
  }
}

function testScannerUiCopyScopesOcrV1() {
  const scannerHtml = fs.readFileSync(path.join(repoRoot, "src/scanner/scanner.html"), "utf8");

  assert.ok(scannerHtml.includes("Image OCR is English-only"));
  assert.ok(scannerHtml.includes("Files are not uploaded, sent to APIs, or stored by LeakGuard"));
  assert.ok(scannerHtml.includes("limited to image files on this scanner page"));
  assert.ok(scannerHtml.includes("Scanner image visual redaction outputs a flattened PNG"));
  assert.ok(scannerHtml.includes("JPG, JPEG, and WEBP inputs are not preserved as their original format"));
  assert.ok(scannerHtml.includes("Download Redacted PNG"));
  assert.ok(scannerHtml.includes("../shared/imageRedactor.js"));
  assert.ok(scannerHtml.includes("Scanned PDF OCR"));
  assert.ok(scannerHtml.includes("Text PDF, DOCX, and XLSX scans can also export regenerated .redacted.pdf, .redacted.docx, or .redacted.xlsx files"));
  assert.ok(scannerHtml.includes("original XLSX XML parts are not preserved"));
  assert.ok(scannerHtml.includes("Formulas, charts, styles, comments, hidden sheets, metadata, custom XML, calc chains, media"));
  assert.ok(scannerHtml.includes("Protected-site PDF, DOCX, and XLSX output can hand off regenerated redacted files when complete"));
  assert.ok(scannerHtml.includes("truncated or unsafe regeneration falls back to .redacted.txt or blocks raw upload"));
  assert.ok(scannerHtml.includes("Download Redacted DOCX"));
  assert.ok(scannerHtml.includes("../shared/docxRedactor.js"));
  assert.ok(scannerHtml.includes("not layout-preserving"));
  assert.ok(scannerHtml.includes(".redacted.txt remains available as the fallback"));
  assert.ok(scannerHtml.includes("Protected-site upload OCR is on by default for supported image uploads"));
  assert.ok(scannerHtml.includes("can be turned off in settings"));
  assert.ok(scannerHtml.includes("flattened redacted PNG only when OCR box confidence is eligible"));
  assert.ok(scannerHtml.includes("layout-preserving PDF/DOCX/XLSX redaction"));
  assert.ok(scannerHtml.includes("image format preservation"));
}

function testScannerUiSerializesRepeatedScansAndRestoresControls() {
  const scannerSource = fs.readFileSync(path.join(repoRoot, "src/scanner/scanner.js"), "utf8");

  assert.ok(scannerSource.includes("let scanInFlight"), "scanner UI should track an active scan");
  assert.ok(scannerSource.includes("return scanInFlight"), "repeated Scan clicks should serialize behind the active scan");
  assert.ok(scannerSource.includes(".finally("), "scanner UI should restore controls through a single cleanup path");
  assert.ok(
    scannerSource.includes("globalThis.PWM?.OcrRuntime?.terminate"),
    "scanner UI should expose a worker cleanup path after OCR scan completion or failure"
  );
  assert.ok(scannerSource.includes("currentRedactedImage"), "scanner UI should track generated redacted PNG state");
  assert.ok(
    scannerSource.includes("imageRedactor.createRedactedPng"),
    "scanner UI should generate flattened redacted PNGs through the image redactor helper"
  );
  assert.ok(
    scannerSource.includes("download-redacted-image-btn") || scannerSource.includes("downloadRedactedImageBtn"),
    "scanner UI should expose a separate redacted PNG export control"
  );
  assert.ok(
    scannerSource.includes("download-redacted-pdf-btn") || scannerSource.includes("downloadRedactedPdf"),
    "scanner UI should expose a separate regenerated redacted PDF export control"
  );
  assert.ok(
    scannerSource.includes("download-redacted-docx-btn") || scannerSource.includes("downloadRedactedDocx"),
    "scanner UI should expose a separate regenerated redacted DOCX export control"
  );
}

async function testTinySyntheticOcrBenchmarkStaysResponsive() {
  const tinyText = "SAFE RECEIPT";
  const imageBuffer = await makeSyntheticTextImage(tinyText, "png", { width: 220, height: 72 });
  const startedAt = performance.now();
  const runtime = {
    recognizeImageBytes() {
      return Promise.resolve({
        ok: true,
        status: "ocr_recognition_ready",
        language: "eng",
        text: tinyText,
        textLength: tinyText.length,
        confidenceBucket: "high",
        warnings: []
      });
    }
  };
  const ocr = await ScannerOcr.recognizeScannerImageFile(
    makeFile("tiny.png", "image/png", imageBuffer.byteLength, imageBuffer),
    { runtime, timeoutMs: 1000 }
  );
  const elapsedMs = performance.now() - startedAt;

  assert.strictEqual(ocr.ok, true);
  assert.ok(elapsedMs < 250, `tiny synthetic OCR boundary should stay responsive, took ${elapsedMs.toFixed(1)}ms`);
}

function testDownloadedImageOutputNameIsRedactedTxtCompatible() {
  assert.strictEqual(ScannerOcr.redactedTextFileNameForImage("scan.png"), "scan.redacted.txt");
  assert.strictEqual(ScannerOcr.redactedTextFileNameForImage("scan.jpg"), "scan.redacted.txt");
  assert.strictEqual(ScannerOcr.redactedTextFileNameForImage("scan.jpeg"), "scan.redacted.txt");
  assert.strictEqual(ScannerOcr.redactedTextFileNameForImage("scan.webp"), "scan.redacted.txt");
}

(async () => {
  testDefaultOcrTimeoutAllowsBrokerToSettleFirst();
  await testSupportedImageTypesOnly();
  await testOversizedImageFailsSafely();
  await testOversizedDimensionsFailSafely();
  await testOcrTextFeedsDetectorRedactorAndReportIsSanitized();
  await testUserLikeImageFormatsFeedSanitizedScannerOutput();
  await testSafeImageProducesSanitizedNoFindingReport();
  await testLowConfidenceRotatedImageWarnsAndStillRedacts();
  await testRuntimeRecognitionUsesExplicitMessageAndTimeout();
  await testReadDimensionsReusesImageBytesForRuntimePayload();
  await testOcrLayoutFallbackIndexesRemainStableForWordAndLineResults();
  await testOcrWordBoxesMapDetectedSecretToRedactionBoxes();
  await testOcrWordBoxesArePreferredOverLineBoxes();
  await testLowConfidenceWordBoxRecoversWithEligibleContainingLine();
  await testLineRecoveryRequiresContainmentAndPreservesIndependentFindings();
  await testOcrLineBoxesAcceptedWithWarning();
  await testFallbackBoxesAreMarkedScannerOnlyAndNotProtectedSiteEligible();
  await testMissingBoxesFailClosedForVisualRedaction();
  await testRedactedPngProofGeneratesFlattenedOutputAndRescanIsClean();
  await testVisualRedactionHandlesDifferentSafeImageSizes();
  await testCleanImagesWithDifferentSizesCanPassThroughAsSafePngs();
  await testImageRedactorRejectsEmptyPngOutput();
  await testJpgAndJpegVisualRedactionOutputsPng();
  await testWebpVisualRedactionOutputsPngWhenSharpSupportsWebp();
  await testVisualRedactionFailsClosedForMissingLowConfidenceAndOversizedBoxes();
  await testLowConfidenceOcrBoxesFailClosedForVisualMapping();
  await testRuntimeTimeoutFailsSafelyWithoutRawText();
  await testCorruptedImageFailsSafelyWithoutRawBytesOrText();
  testUnsupportedImageTypeFailsSafely();
  testRawOcrTextIsNotPersistedOrLoggedByScannerCode();
  testRawVisualRedactionMetadataIsNotPersistedOrLoggedByScannerCode();
  testProtectedSiteUploadPathUsesVisualImageRedactorOnlyBehindEligibilityGate();
  testScannerUiCopyScopesOcrV1();
  testScannerUiSerializesRepeatedScansAndRestoresControls();
  await testTinySyntheticOcrBenchmarkStaysResponsive();
  testDownloadedImageOutputNameIsRedactedTxtCompatible();
  console.log("PASS scanner OCR v1 regressions");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
