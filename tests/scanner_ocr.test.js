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
  assert.ok(scannerHtml.includes("Text PDF scanner results can also export a .redacted.pdf regenerated from sanitized extracted text"));
  assert.ok(scannerHtml.includes("DOCX scanner results can also export a .redacted.docx regenerated from sanitized extracted text"));
  assert.ok(scannerHtml.includes("XLSX scanner results can also export a .redacted.xlsx regenerated from sanitized extracted text"));
  assert.ok(scannerHtml.includes("original XLSX XML parts are not copied"));
  assert.ok(scannerHtml.includes("formulas, charts, styles, comments, hidden sheets, metadata, custom XML, calc chains, and media are not preserved"));
  assert.ok(scannerHtml.includes("Protected-site DOCX output can hand off a regenerated .redacted.docx when complete"));
  assert.ok(scannerHtml.includes("truncated or unsafe DOCX regeneration falls back to .redacted.txt or blocks raw upload"));
  assert.ok(scannerHtml.includes("Protected-site XLSX output can hand off a regenerated .redacted.xlsx when complete"));
  assert.ok(scannerHtml.includes("truncated or unsafe XLSX regeneration falls back to .redacted.txt or blocks raw upload"));
  assert.ok(scannerHtml.includes("Download Redacted DOCX"));
  assert.ok(scannerHtml.includes("../shared/docxRedactor.js"));
  assert.ok(scannerHtml.includes("not layout-preserving"));
  assert.ok(scannerHtml.includes(".redacted.txt remains available as the fallback"));
  assert.ok(scannerHtml.includes("Protected-site text PDF output can hand off a regenerated .redacted.pdf when complete"));
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
  await testSupportedImageTypesOnly();
  await testOversizedImageFailsSafely();
  await testOversizedDimensionsFailSafely();
  await testOcrTextFeedsDetectorRedactorAndReportIsSanitized();
  await testUserLikeImageFormatsFeedSanitizedScannerOutput();
  await testSafeImageProducesSanitizedNoFindingReport();
  await testLowConfidenceRotatedImageWarnsAndStillRedacts();
  await testRuntimeRecognitionUsesExplicitMessageAndTimeout();
  await testOcrWordBoxesMapDetectedSecretToRedactionBoxes();
  await testOcrWordBoxesArePreferredOverLineBoxes();
  await testOcrLineBoxesAcceptedWithWarning();
  await testFallbackBoxesAreMarkedScannerOnlyAndNotProtectedSiteEligible();
  await testMissingBoxesFailClosedForVisualRedaction();
  await testRedactedPngProofGeneratesFlattenedOutputAndRescanIsClean();
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
