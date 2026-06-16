const assert = require("assert");
const path = require("path");
const { loadCore, root } = require("../helpers/load_core.js");
loadCore();
require(path.join(root, "src/shared/fileLimits.js"));
require(path.join(root, "src/shared/fileTypeRegistry.js"));
require(path.join(root, "src/shared/fileExtractors.js"));
require(path.join(root, "src/shared/fileScanner.js"));
require(path.join(root, "src/shared/transformOutboundPromptWithAi.js"));
require(path.join(root, "src/shared/streamingFileRedactor.js"));

const { Detector, PlaceholderManager, Redactor, transformOutboundPrompt, FileScanner, StreamingFileRedactor } = globalThis.PWM;

const SAMPLE = [
  "private 10.10.20.30",
  "cidr 10.10.20.0/24",
  "unc \\\\fs-prod-weu-01\\FSA1234567",
  "spn cifs/stdeberfileprd1234567.file.core.windows.net",
  "dn CN=svc-backup-prod,OU=Service Accounts,DC=corp,DC=local",
  "share FSA1234567",
  "tenantId: 99999999-8888-7777-6666-555555555555",
  "subscriptionId: 11111111-2222-3333-4444-555555555555"
].join("\n");

function encode(text) {
  return new TextEncoder().encode(text);
}

function redactPrompt(text, manager = new PlaceholderManager()) {
  const detector = new Detector();
  const findings = detector.scan(text, { manager });
  return transformOutboundPrompt(text, { manager, findings, mode: "hide_public" }).redactedText;
}

function assertInternalPlaceholders(redactedText, label) {
  for (const family of ["PRIVATE_IP", "PRIVATE_CIDR", "UNC_PATH", "SPN", "LDAP_DN", "FILE_SHARE", "AZURE_TENANT_ID", "AZURE_SUBSCRIPTION_ID"]) {
    assert.ok(new RegExp(`\\[${family}_\\d+\\]`).test(redactedText), `${label}: missing ${family}: ${redactedText}`);
  }
  assert.strictEqual(redactedText.includes("10.10.20.30"), false, `${label}: private IP leaked`);
  assert.strictEqual(redactedText.includes("99999999-8888-7777-6666-555555555555"), false, `${label}: tenant ID leaked`);
}

function testTypedPasteAndPlaceholderRerunSafety() {
  const manager = new PlaceholderManager();
  const typedText = redactPrompt(SAMPLE, manager);
  assertInternalPlaceholders(typedText, "typed text");

  const pasteText = redactPrompt(`pasted\n${SAMPLE}`, new PlaceholderManager());
  assertInternalPlaceholders(pasteText, "paste");

  const rerunFindings = new Detector().scan(typedText, { manager });
  assert.deepStrictEqual(rerunFindings, [], "typed internal placeholders should not be re-redacted");
  assert.strictEqual(new Redactor(manager).redact(typedText, []).redactedText, typedText);
}

function testTextAndExtractedFilePipelines() {
  const txt = FileScanner.scanTextContent({
    fileName: "internal.txt",
    mimeType: "text/plain",
    sizeBytes: encode(SAMPLE).byteLength,
    text: SAMPLE,
    mode: "hide_public"
  });
  assertInternalPlaceholders(txt.redactedText, "drag/drop txt");

  for (const [fileName, label] of [
    ["internal.pdf", "PDF extraction"],
    ["internal.docx", "DOCX extraction"],
    ["internal.xlsx", "XLSX extraction"],
    ["internal-image-ocr.txt", "image OCR"]
  ]) {
    const result = FileScanner.scanTextContent({
      fileName,
      mimeType: "text/plain",
      sizeBytes: encode(SAMPLE).byteLength,
      text: SAMPLE,
      extractedText: true,
      mode: "hide_public"
    });
    assertInternalPlaceholders(result.redactedText, label);
  }
}

async function testLargeTextStreamingPipeline() {
  const text = `${"safe filler\n".repeat(4096)}${SAMPLE}\n${"more safe filler\n".repeat(4096)}`;
  const bytes = encode(text);
  const file = {
    name: "large-internal.txt",
    type: "text/plain",
    size: bytes.byteLength,
    stream() {
      let offset = 0;
      return new ReadableStream({
        pull(controller) {
          if (offset >= bytes.byteLength) {
            controller.close();
            return;
          }
          const end = Math.min(bytes.byteLength, offset + 8192);
          controller.enqueue(bytes.slice(offset, end));
          offset = end;
        }
      });
    }
  };

  const streamingManager = new PlaceholderManager();
  const result = await StreamingFileRedactor.redactTextFileStream(file, {
    chunkSize: 8192,
    overlapSize: 4096,
    async redactText(chunk) {
      const detector = new Detector();
      const findings = detector.scan(chunk, { manager: streamingManager });
      return transformOutboundPrompt(chunk, { manager: streamingManager, findings, mode: "hide_public" });
    },
    createFile({ parts, name, type }) {
      return {
        name,
        type,
        async text() {
          return parts.join("");
        }
      };
    }
  });

  assert.strictEqual(result.action, "redacted");
  const redactedText = await result.sanitizedFile.text();
  assertInternalPlaceholders(redactedText, "large text streaming");
}

async function run() {
  testTypedPasteAndPlaceholderRerunSafety();
  testTextAndExtractedFilePipelines();
  await testLargeTextStreamingPipeline();
  console.log("PASS internal metadata input/file pipeline contract regressions");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
