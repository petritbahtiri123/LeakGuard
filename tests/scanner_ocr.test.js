const assert = require("assert");
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

const ScannerOcr = globalThis.PWM.ScannerOcr;
const FileScanner = globalThis.PWM.FileScanner;

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
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="140">
    <rect width="100%" height="100%" fill="white"/>
    <text x="24" y="82" font-family="Arial" font-size="36" fill="black">${String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>
  </svg>`;
  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
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

async function testRuntimeTimeoutFailsSafelyWithoutRawText() {
  const rawSecret = "sk-proj-TimeoutLeakGuardSecret1234567890";
  const never = new Promise(() => {});
  const runtime = {
    recognizeImageBytes() {
      return never;
    }
  };
  const file = makeFile("scan.png", "image/png", 2048, bufferFromText(rawSecret));
  const result = await ScannerOcr.recognizeScannerImageFile(file, { runtime, timeoutMs: 1 });
  const serialized = JSON.stringify(result);

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.status, "ocr_timeout");
  assert.strictEqual(serialized.includes(rawSecret), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(result, "text"), false);
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
  await testRuntimeRecognitionUsesExplicitMessageAndTimeout();
  await testRuntimeTimeoutFailsSafelyWithoutRawText();
  testDownloadedImageOutputNameIsRedactedTxtCompatible();
  console.log("PASS scanner OCR v1 regressions");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
