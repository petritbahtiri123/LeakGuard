const assert = require("assert");
const fs = require("fs");
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

const LIVE_QA_CSV_TABLE_FIXTURE = path.join(root, "tests/fixtures/detection/enterprise_metadata_live_qa_csv_table_payload.csv");
const LIVE_QA_HTML_RENDERED_FIXTURE = path.join(root, "tests/fixtures/detection/enterprise_metadata_live_qa_html_rendered_copy.txt");
const LIVE_QA_HTML_SOURCE_FIXTURE = path.join(root, "tests/fixtures/detection/enterprise_metadata_live_qa.html");
const LIVE_QA_CSV_TABLE_FAMILIES = [
  "AZURE_RG",
  "STORAGE_ACCOUNT",
  "AZURE_TENANT_ID",
  "AZURE_SUBSCRIPTION_ID",
  "AWS_ARN",
  "AWS_ACCOUNT_ID",
  "GCP_PROJECT",
  "OTC_RESOURCE",
  "OPENSTACK_PROJECT_ID",
  "K8S_NAMESPACE",
  "K8S_SECRET",
  "PRIVATE_IP",
  "PRIVATE_CIDR",
  "UNC_PATH",
  "SPN",
  "LDAP_DN",
  "FILE_SHARE",
  "AD_GROUP",
  "HOSTNAME",
  "USERNAME",
  "EMAIL"
];
const LIVE_QA_CSV_TABLE_RAW_VALUES = [
  "rg-prod-weu-files-001",
  "stdeberfileprd1234567",
  "99999999-8888-7777-6666-555555555555",
  "11111111-2222-3333-4444-555555555555",
  "arn:aws:iam::123456789012:role/LeakGuardQaRole",
  "210987654321",
  "lg-prod-project-123",
  "otc-prod-de-ecs-001",
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "prod-payments",
  "secret/db-password",
  "10.10.20.30",
  "10.10.20.0/24",
  "\\\\fs-prod-weu-01\\FSA1234567",
  "cifs/stdeberfileprd1234567.file.core.windows.net",
  "CN=svc-backup-prod,OU=Service Accounts,OU=SH070,DC=corp,DC=local",
  "FSA1234567",
  "AD123-SH070-FILE-L-STFSA1234567R",
  "fs-prod-weu-01.corp.local",
  "CORP\\adm-test.user",
  "test.user@example.com"
];
const LIVE_QA_CSV_TABLE_HARMLESS_VALUES = [
  "rg-blue",
  "rg-test",
  "product-roadmap-item",
  "invoice 123456789012",
  "docs/page",
  "service/name",
  "random GUID 123e4567-e89b-12d3-a456-426614174000",
  "report.final.docx",
  "package.name"
];

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

function assertLiveQaCsvTableRedacted(redactedText, label) {
  for (const family of LIVE_QA_CSV_TABLE_FAMILIES) {
    assert.ok(new RegExp(`\\[${family}_\\d+\\]`).test(redactedText), `${label}: missing ${family}: ${redactedText}`);
  }
  for (const raw of LIVE_QA_CSV_TABLE_RAW_VALUES) {
    assert.strictEqual(redactedText.includes(raw), false, `${label}: leaked ${raw}`);
  }
  for (const harmless of LIVE_QA_CSV_TABLE_HARMLESS_VALUES) {
    assert.ok(redactedText.includes(harmless), `${label}: should preserve harmless value ${harmless}`);
  }
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

function testLiveQaCsvTableAcrossTextAndExtractedFilePipelines() {
  const csv = fs.readFileSync(LIVE_QA_CSV_TABLE_FIXTURE, "utf8");
  for (const [fileName, mimeType, extractedText, label] of [
    ["enterprise_metadata_live_qa.csv", "text/csv", false, "CSV file"],
    ["enterprise_metadata_live_qa.txt", "text/plain", false, "text file"],
    ["enterprise_metadata_live_qa.pdf", "text/plain", true, "PDF extracted text"],
    ["enterprise_metadata_live_qa.docx", "text/plain", true, "DOCX extracted text"],
    ["enterprise_metadata_live_qa.xlsx", "text/plain", true, "XLSX extracted text"]
  ]) {
    const result = FileScanner.scanTextContent({
      fileName,
      mimeType,
      sizeBytes: encode(csv).byteLength,
      text: csv,
      extractedText,
      mode: "hide_public"
    });
    assertLiveQaCsvTableRedacted(result.redactedText, label);
  }
}

function testLiveQaHtmlTablesAcrossTextHtmlAndImageOcrPipelines() {
  const renderedCopy = fs.readFileSync(LIVE_QA_HTML_RENDERED_FIXTURE, "utf8");
  const htmlSource = fs.readFileSync(LIVE_QA_HTML_SOURCE_FIXTURE, "utf8");

  for (const [text, fileName, mimeType, extractedText, label] of [
    [renderedCopy, "enterprise_metadata_live_qa_rendered.txt", "text/plain", false, "HTML rendered text copy"],
    [renderedCopy, "enterprise_metadata_live_qa.png", "image/png", true, "image OCR extracted text"],
    [htmlSource, "enterprise_metadata_live_qa.html", "text/html", false, "HTML source file"]
  ]) {
    const result = FileScanner.scanTextContent({
      fileName,
      mimeType,
      sizeBytes: encode(text).byteLength,
      text,
      extractedText,
      mode: "hide_public"
    });
    assertLiveQaCsvTableRedacted(result.redactedText, label);
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
  testLiveQaCsvTableAcrossTextAndExtractedFilePipelines();
  testLiveQaHtmlTablesAcrossTextHtmlAndImageOcrPipelines();
  await testLargeTextStreamingPipeline();
  console.log("PASS internal metadata input/file pipeline contract regressions");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
