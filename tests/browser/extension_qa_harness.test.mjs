/*
 * Local-only browser QA for LeakGuard's unpacked Chromium extension build.
 *
 * This test uses synthetic secrets only, never opens live AI sites, and only
 * talks to a temporary 127.0.0.1 harness page. It copies dist/chrome into a
 * temporary extension directory, adds localhost permission only to that copy,
 * uses temporary browser profiles, and commits no generated artifacts.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import zlib from "node:zlib";
import sharp from "sharp";
import {
  CdpPipeConnection as ChromiumPipeConnection,
  CdpWebSocketConnection,
  findCdpWebSocketUrl,
  findExecutable,
  launchChrome
} from "./chrome_smoke.test.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const require = createRequire(import.meta.url);
require(path.join(repoRoot, "src/shared/fileTypeRegistry.js"));
require(path.join(repoRoot, "src/shared/fileExtractors.js"));
const {
  SUPPORTED_TEXT_EXTENSIONS,
  SUPPORTED_TEXT_BASENAMES,
  getFileExtension,
  getFileBasename,
  normalizeMimeType
} = globalThis.PWM.FileTypeRegistry;
const {
  BROWSER_QA_FAILURE_CODES,
  assertBrowserQaStep,
  assertContentScriptReady,
  assertDebugOutputMetadataOnly,
  assertExpectedPlaceholdersVisible,
  assertExtensionLoaded,
  assertNoRawFileFallback,
  assertNoRawSecretVisible,
  assertProtectedSiteActive,
  assertSafeControlsVisible,
  createBrowserQaReporter,
  safeBrowserQaScreenshotPath,
  sanitizeBrowserQaText,
  summarizeBrowserConsoleLogs
} = require(path.join(repoRoot, "tests/helpers/browserQaAssertions.js"));
const { prepareFileExtractionAsync, EXTRACTOR_STATUS } = globalThis.PWM.FileExtractors;
const sourceExtensionDir = path.join(repoRoot, "dist", "chrome");
const qaTimeoutMs = Number(process.env.LEAKGUARD_BROWSER_QA_TIMEOUT_MS || 60000);
const cleanupDelayMs = Number(process.env.LEAKGUARD_BROWSER_QA_CLEANUP_DELAY_MS || 500);
const cleanupMaxRetries = Number(process.env.LEAKGUARD_BROWSER_QA_CLEANUP_RETRIES || 10);
const cleanupRetryDelayMs = Number(process.env.LEAKGUARD_BROWSER_QA_CLEANUP_RETRY_DELAY_MS || 300);

const syntheticSecrets = {
  openAi: ["sk-proj", "A".repeat(48)].join("-"),
  anthropic: ["sk-ant-api03", "B".repeat(44)].join("-"),
  github: `ghp_${"C".repeat(36)}`,
  stripe: `sk_live_${"D".repeat(32)}`,
  databasePassword: "SuperFakePassword123",
  email: "lgqa.user@company.invalid",
  publicIp: "8.8.8.8",
  privateIp: "192.168.1.10"
};

const BROWSER_QA_MATRIX_MODES = Object.freeze({
  FAST: "fast",
  FULL: "full"
});

const TEXT_EXTENSION_MIME_TYPES = Object.freeze({
  ".css": "text/css",
  ".csv": "text/csv",
  ".html": "text/html",
  ".json": "application/json",
  ".js": "text/javascript",
  ".jsx": "text/javascript",
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".scss": "text/css",
  ".ts": "text/typescript",
  ".tsx": "text/typescript",
  ".xml": "application/xml",
  ".yaml": "text/yaml",
  ".yml": "text/yaml"
});

function createCanonicalTextFileTypeDefinition(extension) {
  return {
    extension,
    mimeType: TEXT_EXTENSION_MIME_TYPES[extension] || "text/plain",
    label: `protected-site ${extension} handoff`
  };
}

const REQUESTED_SUPPORTED_TEXT_FILE_TYPES = Object.freeze(
  Array.from(SUPPORTED_TEXT_EXTENSIONS)
    .sort()
    .map(createCanonicalTextFileTypeDefinition)
);

const REQUESTED_SUPPORTED_TEXT_BASENAME_FILE_TYPES = Object.freeze(
  Array.from(SUPPORTED_TEXT_BASENAMES)
    .sort()
    .map((basename) => ({
      id: basename,
      extension: "",
      fileName: basename.charAt(0).toUpperCase() + basename.slice(1),
      mimeType: "text/plain",
      label: `protected-site ${basename} handoff`
    }))
);

const FAST_TEXT_FILE_EXTENSIONS = new Set([".env", ".json", ".log"]);

const DOCUMENT_FILE_QA_TYPES = Object.freeze([
  {
    id: "PDF",
    extension: ".pdf",
    fileName: "protected-site-pdf.pdf",
    mimeType: "application/pdf",
    label: "protected-site PDF handoff",
    inputPath: "file input upload",
    family: "document"
  },
  {
    id: "DOCX",
    extension: ".docx",
    fileName: "protected-site-docx.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    label: "protected-site DOCX handoff",
    inputPath: "file input upload",
    family: "document"
  },
  {
    id: "XLSX",
    extension: ".xlsx",
    fileName: "protected-site-xlsx.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    label: "protected-site XLSX handoff",
    inputPath: "file input upload",
    family: "document"
  }
]);

const IMAGE_FILE_QA_TYPES = Object.freeze([
  { id: "PNG", extension: ".png", fileName: "protected-site-image-png.png", mimeType: "image/png", sharpFormat: "png" },
  { id: "JPG", extension: ".jpg", fileName: "protected-site-image-jpg.jpg", mimeType: "image/jpeg", sharpFormat: "jpeg" },
  { id: "JPEG", extension: ".jpeg", fileName: "protected-site-image-jpeg.jpeg", mimeType: "image/jpeg", sharpFormat: "jpeg" },
  { id: "WEBP", extension: ".webp", fileName: "protected-site-image-webp.webp", mimeType: "image/webp", sharpFormat: "webp" }
].map((entry) => ({
  ...entry,
  label: `protected-site ${entry.extension} image OCR handoff`,
  inputPath: "file input upload",
  family: "image"
})));

const FOLLOW_UP_FILE_TYPES = Object.freeze([
  {
    extension: ".tf",
    reason: "not present in FileTypeRegistry.SUPPORTED_TEXT_EXTENSIONS"
  },
  {
    extension: ".tfvars",
    reason: "not present in FileTypeRegistry.SUPPORTED_TEXT_EXTENSIONS"
  },
  {
    extension: ".properties",
    reason: "not present in FileTypeRegistry.SUPPORTED_TEXT_EXTENSIONS"
  }
]);

const UNSUPPORTED_FILE_QA_TYPES = Object.freeze([
  { id: "malformed-pdf", label: "malformed PDF", fileName: "malformed-protected.pdf", extension: ".pdf", mimeType: "application/pdf", forbiddenOutputPattern: /\.redacted\.pdf$/i },
  { id: "image-only-pdf", label: "image-only PDF", fileName: "image-only-protected.pdf", extension: ".pdf", mimeType: "application/pdf", forbiddenOutputPattern: /\.redacted\.pdf$/i },
  { id: "malformed-docx", label: "malformed DOCX", fileName: "malformed-protected.docx", extension: ".docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", forbiddenOutputPattern: /\.redacted\.docx$/i },
  { id: "malformed-xlsx", label: "malformed XLSX", fileName: "malformed-protected.xlsx", extension: ".xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", forbiddenOutputPattern: /\.redacted\.xlsx$/i },
  { id: "unsupported-doc", label: "unsupported DOC", fileName: "unsupported-protected.doc", extension: ".doc", mimeType: "application/msword", forbiddenOutputPattern: /\.(?:redacted\.docx|redacted\.txt)$/i },
  { id: "unsupported-docm", label: "unsupported DOCM", fileName: "unsupported-protected.docm", extension: ".docm", mimeType: "application/vnd.ms-word.document.macroEnabled.12", forbiddenOutputPattern: /\.(?:redacted\.docx|redacted\.txt)$/i },
  { id: "unsupported-xls", label: "unsupported XLS", fileName: "unsupported-protected.xls", extension: ".xls", mimeType: "application/vnd.ms-excel", forbiddenOutputPattern: /\.(?:redacted\.xlsx|redacted\.txt)$/i },
  { id: "unsupported-xlsm", label: "unsupported XLSM", fileName: "unsupported-protected.xlsm", extension: ".xlsm", mimeType: "application/vnd.ms-excel.sheet.macroEnabled.12", forbiddenOutputPattern: /\.(?:redacted\.xlsx|redacted\.txt)$/i },
  { id: "unsupported-gif", label: "unsupported GIF", fileName: "unsupported-protected.gif", extension: ".gif", mimeType: "image/gif", forbiddenOutputPattern: /\.(?:redacted\.png|redacted\.txt)$/i, fullOnly: true },
  { id: "unsupported-bmp", label: "unsupported BMP", fileName: "unsupported-protected.bmp", extension: ".bmp", mimeType: "image/bmp", forbiddenOutputPattern: /\.(?:redacted\.png|redacted\.txt)$/i, fullOnly: true },
  { id: "unsupported-ico", label: "unsupported ICO", fileName: "unsupported-protected.ico", extension: ".ico", mimeType: "image/x-icon", forbiddenOutputPattern: /\.(?:redacted\.png|redacted\.txt)$/i, fullOnly: true },
  { id: "unsupported-svg", label: "unsupported SVG", fileName: "unsupported-protected.svg", extension: ".svg", mimeType: "image/svg+xml", forbiddenOutputPattern: /\.(?:redacted\.png|redacted\.txt)$/i, fullOnly: true },
  { id: "unsupported-unknown-binary", label: "unknown binary", fileName: "unsupported-protected.bin", extension: ".bin", mimeType: "application/octet-stream", forbiddenOutputPattern: /\.redacted\./i, fullOnly: true },
  { id: "encrypted-pdf", label: "encrypted PDF", fileName: "encrypted-protected.pdf", extension: ".pdf", mimeType: "application/pdf", forbiddenOutputPattern: /\.redacted\.pdf$/i, fullOnly: true }
]);

function normalizeMatrixMode(matrixMode = BROWSER_QA_MATRIX_MODES.FAST) {
  return matrixMode === BROWSER_QA_MATRIX_MODES.FULL
    ? BROWSER_QA_MATRIX_MODES.FULL
    : BROWSER_QA_MATRIX_MODES.FAST;
}

function getBrowserQaMatrixMode({ argv = process.argv.slice(2), env = process.env } = {}) {
  if ((argv || []).includes("--full-matrix") || env.LEAKGUARD_BROWSER_QA_FULL_MATRIX === "1") {
    return BROWSER_QA_MATRIX_MODES.FULL;
  }
  return BROWSER_QA_MATRIX_MODES.FAST;
}

function toMatrixTokenPart(value) {
  return String(value || "")
    .replace(/^\./, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
}

function makeMatrixSecret(prefix, id) {
  const token = `${prefix}${toMatrixTokenPart(id)}BrowserQa`;
  return `sk-proj-${token}1234567890abcdef`;
}

function createSupportedFileCase(definition) {
  const id = toMatrixTokenPart(definition.id || definition.extension);
  const secretId = `LGQA_SECRET_${id}`;
  const emailId = `LGQA_EMAIL_${id}`;
  const weakId = `LGQA_WEAK_${id}`;
  const providerId = `LGQA_PROVIDER_${id}`;
  const safeControlId = `LGQA_SAFE_${id}`;
  const placeholderId = `LGQA_PLACEHOLDER_${id}`;
  return {
    ...definition,
    id,
    fileName:
      definition.fileName ||
      `protected-site-${id.toLowerCase()}${definition.extension}`,
    inputPath: definition.inputPath || "file input upload",
    family: definition.family || "text",
    secretId,
    rawSecret: makeMatrixSecret("Secret", id),
    emailId,
    emailValue: `lgqa-${id.toLowerCase()}@company.invalid`,
    weakId,
    weakSecret: `Password123!${id}`,
    providerId,
    providerSecret: `sk_live_${id}${"D".repeat(Math.max(0, 32 - id.length))}`.slice(0, 40),
    safeControlId,
    safeControlValue: safeControlId,
    placeholderId,
    placeholderValue: "[PWM_1]"
  };
}

function createUnsupportedFileCase(definition) {
  const tokenId = toMatrixTokenPart(definition.id);
  return {
    ...definition,
    inputPath: "unsupported-file fail-closed",
    rawSecret: makeMatrixSecret("Unsupported", tokenId),
    secretId: `LGQA_SECRET_${tokenId}`
  };
}

function getProtectedSiteTextFileCases({ matrixMode = BROWSER_QA_MATRIX_MODES.FAST } = {}) {
  const normalizedMode = normalizeMatrixMode(matrixMode);
  const extensionCases = REQUESTED_SUPPORTED_TEXT_FILE_TYPES
    .filter((definition) =>
      normalizedMode === BROWSER_QA_MATRIX_MODES.FULL
        ? SUPPORTED_TEXT_EXTENSIONS.has(definition.extension)
        : FAST_TEXT_FILE_EXTENSIONS.has(definition.extension)
    )
    .map(createSupportedFileCase);
  const basenameCases =
    normalizedMode === BROWSER_QA_MATRIX_MODES.FULL
      ? REQUESTED_SUPPORTED_TEXT_BASENAME_FILE_TYPES.map(createSupportedFileCase)
      : [];
  return [...extensionCases, ...basenameCases];
}

function getProtectedSiteDocumentFileCases() {
  return DOCUMENT_FILE_QA_TYPES.map(createSupportedFileCase);
}

function getProtectedSiteImageFileCases({ matrixMode = BROWSER_QA_MATRIX_MODES.FAST } = {}) {
  const normalizedMode = normalizeMatrixMode(matrixMode);
  return IMAGE_FILE_QA_TYPES
    .filter((definition) => normalizedMode === BROWSER_QA_MATRIX_MODES.FULL || definition.extension === ".png")
    .map(createSupportedFileCase);
}

function getProtectedSiteUnsupportedFileCases({ matrixMode = BROWSER_QA_MATRIX_MODES.FAST } = {}) {
  const normalizedMode = normalizeMatrixMode(matrixMode);
  return UNSUPPORTED_FILE_QA_TYPES
    .filter((definition) => normalizedMode === BROWSER_QA_MATRIX_MODES.FULL || !definition.fullOnly)
    .map(createUnsupportedFileCase);
}

function getBrowserQaCoverageMatrix({ matrixMode = BROWSER_QA_MATRIX_MODES.FAST } = {}) {
  const normalizedMode = normalizeMatrixMode(matrixMode);
  return {
    matrixMode: normalizedMode,
    inputPaths: [
      "typed text",
      "paste text",
      "WhatsApp Web text-only send guard",
      "file input upload",
      "drag/drop file upload",
      "paste file attachment",
      "debug mode",
      "sanitized handoff",
      "Gemini/Grok sanitized pending queue",
      "unsupported-file fail-closed"
    ],
    multiFilePolicy: {
      small: { maxFiles: 20, maxBytes: 4 * 1024 * 1024 },
      large: { maxFiles: 5, maxBytes: 50 * 1024 * 1024 },
      entryPaths: [
        "drag/drop file upload",
        "file input upload",
        "paste file attachment",
        "sanitized handoff",
        "Gemini/Grok sanitized pending queue"
      ],
      requiredCases: [
        "5 large supported files",
        "20 small supported files",
        "10 small + 3 large supported files",
        "10 small + 6 large blocked before processing",
        "unsupported mixed file excluded from sanitized handoff"
      ]
    },
    whatsAppTextOnly: {
      target: "https://web.whatsapp.com/*",
      inputPaths: [
        "send button click",
        "Enter-to-send",
        "single text-document attachment",
        "single PDF attachment",
        "single DOCX attachment",
        "single XLSX attachment",
        "multi-file attachment",
        "drag/drop file attachment",
        "unsupported file attachment attempt"
      ],
      requiredCases: [
        "first click sends sanitized text",
        "Enter sends sanitized text",
        "raw fake secret is never sent",
        "trusted [PWM_1] and [PWM_2] placeholders do not loop",
        "redaction failure blocks send",
        "composer-not-found blocks send",
        "rewrite verification failure blocks send",
        "programmatic replay does not recurse",
        "second-click retry is not accepted as success",
        "single canonical LeakGuard text-like attachment assigns only a sanitized document",
        "Dockerfile and Makefile attachments assign only sanitized documents",
        "single PDF attachment assigns only a sanitized rebuilt PDF",
        "single DOCX attachment assigns only a sanitized rebuilt DOCX",
        "single XLSX attachment assigns only a sanitized rebuilt XLSX",
        "encrypted/malformed/image-only PDF attachment remains blocked",
        "2-5 supported multi-file attachments assign only sanitized files",
        "6+ WhatsApp multi-file attachments block before read",
        "unsupported extensionless WhatsApp attachment remains blocked",
        "unsupported or failing WhatsApp multi-file batch blocks all-or-nothing",
        "1-5 supported WhatsApp drag/drop files assign only sanitized files",
        "6+ WhatsApp drag/drop files block before read",
        "unsupported or failing WhatsApp drag/drop batch blocks all-or-nothing"
      ]
    },
    followUpInputPaths: ["drag/drop text"],
    supportedFiles: [
      ...getProtectedSiteTextFileCases({ matrixMode: normalizedMode }),
      ...getProtectedSiteDocumentFileCases(),
      ...getProtectedSiteImageFileCases({ matrixMode: normalizedMode })
    ],
    unsupportedFiles: getProtectedSiteUnsupportedFileCases({ matrixMode: normalizedMode }),
    followUpFiles: FOLLOW_UP_FILE_TYPES
  };
}

function getBrowserQaGeneratedCanaries() {
  const matrix = getBrowserQaCoverageMatrix({ matrixMode: BROWSER_QA_MATRIX_MODES.FULL });
  const supportedCanaries = matrix.supportedFiles.flatMap((testCase) => [
    { id: testCase.secretId, value: testCase.rawSecret, expectedPlaceholder: "[PWM_N]" },
    { id: testCase.emailId, value: testCase.emailValue, expectedPlaceholder: "[EMAIL_N]" },
    { id: testCase.weakId, value: testCase.weakSecret, expectedPlaceholder: "[PWM_N]" },
    { id: testCase.providerId, value: testCase.providerSecret, expectedPlaceholder: "[PWM_N]" }
  ]);
  const unsupportedCanaries = matrix.unsupportedFiles.map((testCase) => ({
    id: testCase.secretId,
    value: testCase.rawSecret,
    expectedPlaceholder: "[PWM_N]"
  }));
  return [...supportedCanaries, ...unsupportedCanaries];
}

const promptLines = [
  `OPENAI_API_KEY=${syntheticSecrets.openAi}`,
  `OPENAI_API_KEY_REPEAT=${syntheticSecrets.openAi}`,
  `ANTHROPIC_API_KEY=${syntheticSecrets.anthropic}`,
  `GITHUB_TOKEN=${syntheticSecrets.github}`,
  `STRIPE_SECRET_KEY=${syntheticSecrets.stripe}`,
  `DATABASE_URL=postgres://admin:${syntheticSecrets.databasePassword}@db.example.com:5432/customerdb`,
  `EMAIL_ADDRESS=${syntheticSecrets.email}`,
  `PUBLIC_IP=${syntheticSecrets.publicIp}`,
  `PRIVATE_IP=${syntheticSecrets.privateIp}`,
  "PLACEHOLDER_ALREADY=[PWM_1]"
];
const promptPayload = promptLines.join("\n");
const browserQaBaseSecretCanaries = Object.freeze([
  { id: "LGQA_OPENAI_001", value: syntheticSecrets.openAi, expectedPlaceholder: "[PWM_N]" },
  { id: "LGQA_ANTHROPIC_001", value: syntheticSecrets.anthropic, expectedPlaceholder: "[PWM_N]" },
  { id: "LGQA_GITHUB_001", value: syntheticSecrets.github, expectedPlaceholder: "[PWM_N]" },
  { id: "LGQA_STRIPE_001", value: syntheticSecrets.stripe, expectedPlaceholder: "[PWM_N]" },
  { id: "LGQA_DB_PASSWORD_001", value: syntheticSecrets.databasePassword, expectedPlaceholder: "[PWM_N]" },
  { id: "LGQA_EMAIL_001", value: syntheticSecrets.email, expectedPlaceholder: "[EMAIL_N]" },
  { id: "LGQA_PUBLIC_IP_001", value: syntheticSecrets.publicIp, expectedPlaceholder: "[PUB_HOST_N]" },
  { id: "LGQA_PRIVATE_IP_001", value: syntheticSecrets.privateIp, expectedPlaceholder: "[PRIVATE_IP_N]" },
  { id: "LGQA_TEXTAREA_TYPED_001", value: "sk-proj-TextareaTypedBrowserQa1234567890abcdef", expectedPlaceholder: "[PWM_N]" },
  { id: "LGQA_TEXTAREA_PASTE_001", value: "sk-proj-TextareaPasteBrowserQa1234567890abcdef", expectedPlaceholder: "[PWM_N]" },
  { id: "LGQA_EDITOR_TYPED_001", value: "sk-proj-EditorTypedBrowserQa1234567890abcdef", expectedPlaceholder: "[PWM_N]" },
  { id: "LGQA_EDITOR_PASTE_001", value: "sk-proj-EditorPasteBrowserQa1234567890abcdef", expectedPlaceholder: "[PWM_N]" },
  { id: "LGQA_IMAGE_OCR_001", value: "sk-proj-LeakGuardScannerOcrApiKey1234567890abcdef", expectedPlaceholder: "[PWM_N]" },
  { id: "LGQA_PDF_001", value: "sk-proj-ProtectedSitePdfBrowserQa1234567890abcdef", expectedPlaceholder: "[PWM_N]" },
  { id: "LGQA_DOCX_001", value: "sk-proj-ProtectedSiteDocxBrowserQa1234567890abcdef", expectedPlaceholder: "[PWM_N]" },
  { id: "LGQA_XLSX_001", value: "sk-proj-ProtectedSiteXlsxBrowserQa1234567890abcdef", expectedPlaceholder: "[PWM_N]" },
  { id: "LGQA_DROP_PDF_001", value: "sk-proj-ProtectedSiteDropPdfBrowserQa1234567890abcdef", expectedPlaceholder: "[PWM_N]" },
  { id: "LGQA_ENV_001", value: "sk-proj-ProtectedSiteEnvBrowserQa1234567890abcdef", expectedPlaceholder: "[PWM_N]" },
  { id: "LGQA_JSON_001", value: "sk-proj-ProtectedSiteJsonBrowserQa1234567890abcdef", expectedPlaceholder: "[PWM_N]" },
  { id: "LGQA_LOG_001", value: "sk-proj-ProtectedSiteLogBrowserQa1234567890abcdef", expectedPlaceholder: "[PWM_N]" },
  { id: "LGQA_MALFORMED_PDF_001", value: "sk-proj-MalformedPdfProtectedQa1234567890abcdef", expectedPlaceholder: "[PWM_N]" },
  { id: "LGQA_IMAGE_ONLY_PDF_001", value: "sk-proj-ImageOnlyPdfProtectedQa1234567890abcdef", expectedPlaceholder: "[PWM_N]" },
  { id: "LGQA_MALFORMED_DOCX_001", value: "sk-proj-MalformedDocxProtectedQa1234567890abcdef", expectedPlaceholder: "[PWM_N]" },
  { id: "LGQA_MALFORMED_XLSX_001", value: "sk-proj-MalformedXlsxProtectedQa1234567890abcdef", expectedPlaceholder: "[PWM_N]" },
  { id: "LGQA_UNSUPPORTED_DOC_001", value: "sk-proj-UnsupportedDocProtectedQa1234567890abcdef", expectedPlaceholder: "[PWM_N]" },
  { id: "LGQA_UNSUPPORTED_DOCM_001", value: "sk-proj-UnsupportedDocmProtectedQa1234567890abcdef", expectedPlaceholder: "[PWM_N]" },
  { id: "LGQA_UNSUPPORTED_XLS_001", value: "sk-proj-UnsupportedXlsProtectedQa1234567890abcdef", expectedPlaceholder: "[PWM_N]" },
  { id: "LGQA_UNSUPPORTED_XLSM_001", value: "sk-proj-UnsupportedXlsmProtectedQa1234567890abcdef", expectedPlaceholder: "[PWM_N]" },
  { id: "LGQA_SCANNER_OCR_001", value: "LeakGuardScannerSecret12345", expectedPlaceholder: "[PWM_N]" }
]);
const browserQaSecretCanaries = Object.freeze([
  ...browserQaBaseSecretCanaries,
  ...getBrowserQaGeneratedCanaries()
]);
const rawValues = browserQaSecretCanaries.map((canary) => canary.value);
const browserQaSafeControlIds = Object.freeze([
  "LGQA_SAFE_CONTROL_001",
  "LGQA_SAFE_CONTROL_002",
  "LGQA_SAFE_CONTROL_003"
]);
const localProtectedSiteInput = "http://127.0.0.1";
const localProtectedSiteId = "http://127.0.0.1";
const localProtectedSitePermission = "http://127.0.0.1/*";

function escapePdfText(text) {
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
}

function makeQaPdf(text, options = {}) {
  const textLines = String(text)
    .split(/\r?\n/)
    .map((line, index) => `${index === 0 ? "" : "0 -18 Td\n"}(${escapePdfText(line)}) Tj`)
    .join("\n");
  const stream = options.imageOnly
    ? "q\n10 0 0 10 0 0 cm\n/Im1 Do\nQ\n"
    : `BT\n/F1 12 Tf\n72 720 Td\n${textLines}\nET\n`;
  const encryptMarker = options.encrypted ? "\n/Encrypt 6 0 R" : "";
  return Buffer.from([
    "%PDF-1.4",
    "1 0 obj",
    `<< /Type /Catalog /Pages 2 0 R${encryptMarker} >>`,
    "endobj",
    "2 0 obj",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "endobj",
    "3 0 obj",
    "<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>",
    "endobj",
    "4 0 obj",
    `<< /Length ${stream.length} >>`,
    "stream",
    stream,
    "endstream",
    "endobj",
    "trailer",
    "<< /Root 1 0 R >>",
    "%%EOF"
  ].join("\n"));
}

function makeQaZip(entries) {
  const chunks = [];
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const raw = Buffer.from(String(entry.data || ""), "utf8");
    const compressed = zlib.deflateRawSync(raw);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0, 6);
    header.writeUInt16LE(8, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(0, 12);
    header.writeUInt32LE(0, 14);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(raw.length, 22);
    header.writeUInt16LE(name.length, 26);
    header.writeUInt16LE(0, 28);
    chunks.push(header, name, compressed);
  }
  return Buffer.concat(chunks);
}

function makeQaDocx(text, options = {}) {
  const body = options.imageOnly
    ? "<w:p><w:r><w:drawing /></w:r></w:p>"
    : String(text)
      .split("\n")
      .map((line) => `<w:p><w:r><w:t>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</w:t></w:r></w:p>`)
      .join("");
  return makeQaZip([
    {
      name: "[Content_Types].xml",
      data: '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>'
    },
    {
      name: "word/document.xml",
      data: `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`
    }
  ]);
}

function makeQaXlsx(text) {
  const escaped = String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return makeQaZip([
    {
      name: "[Content_Types].xml",
      data: '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>'
    },
    {
      name: "xl/workbook.xml",
      data: '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets><sheet name="Secrets" sheetId="1"/></sheets></workbook>'
    },
    {
      name: "xl/worksheets/sheet1.xml",
      data: `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>${escaped}</t></is></c></row></sheetData></worksheet>`
    }
  ]);
}

async function makeSyntheticTextImage(text, format, options = {}) {
  const width = options.width || 1400;
  const height = options.height || 220;
  const fontSize = options.fontSize || 48;
  const textY = options.textY || 130;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="white"/>
    <text x="32" y="${textY}" font-family="Arial" font-size="${fontSize}" fill="black">${String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")}</text>
  </svg>`;
  return await sharp(Buffer.from(svg)).toFormat(format).toBuffer();
}

function findChromeExecutable() {
  const localAppData = process.env.LOCALAPPDATA || "";
  const windowsCandidates =
    process.platform === "win32"
      ? [
          path.join(process.env.PROGRAMFILES || "", "Google", "Chrome", "Application", "chrome.exe"),
          path.join(
            process.env["PROGRAMFILES(X86)"] || "",
            "Google",
            "Chrome",
            "Application",
            "chrome.exe"
          ),
          path.join(localAppData, "Google", "Chrome", "Application", "chrome.exe")
        ]
      : [];
  return findExecutable([
    process.env.CHROME_BIN,
    process.env.GOOGLE_CHROME_BIN,
    ...windowsCandidates,
    "google-chrome",
    "google-chrome-stable",
    "chromium-browser",
    "chromium",
    "chrome"
  ]);
}

function findEdgeExecutable() {
  const localAppData = process.env.LOCALAPPDATA || "";
  const windowsCandidates =
    process.platform === "win32"
      ? [
          path.join(process.env.PROGRAMFILES || "", "Microsoft", "Edge", "Application", "msedge.exe"),
          path.join(
            process.env["PROGRAMFILES(X86)"] || "",
            "Microsoft",
            "Edge",
            "Application",
            "msedge.exe"
          ),
          path.join(localAppData, "Microsoft", "Edge", "Application", "msedge.exe")
        ]
      : [];
  const macCandidates =
    process.platform === "darwin"
      ? ["/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"]
      : [];
  return findExecutable([
    process.env.EDGE_BIN,
    process.env.MSEDGE_BIN,
    ...windowsCandidates,
    ...macCandidates,
    "microsoft-edge",
    "microsoft-edge-stable",
    "microsoft-edge-beta",
    "microsoft-edge-dev",
    "msedge"
  ]);
}

function assertBuiltExtensionExists() {
  const manifestPath = path.join(sourceExtensionDir, "manifest.json");
  assert.ok(
    fs.existsSync(manifestPath),
    `Expected ${manifestPath}. Run npm run build:chrome before qa:browser.`
  );
}

async function delay(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(condition, label, timeoutMs = qaTimeoutMs) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const result = await condition();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  const suffix = lastError ? ` Last error: ${lastError.message}` : "";
  throw new Error(`Timed out waiting for ${label}.${suffix}`);
}

function browserQaCanaryLabel(value) {
  const match = browserQaSecretCanaries.find((canary) => canary.value === value);
  return match?.id || "raw synthetic canary";
}

function sanitizeBrowserQaDiagnostic(value) {
  return sanitizeBrowserQaText(value, browserQaSecretCanaries);
}

function getHarnessFileInputAccept() {
  const textExtensions = Array.from(SUPPORTED_TEXT_EXTENSIONS).sort();
  return [
    "text/plain",
    "text/markdown",
    "text/html",
    "text/css",
    "text/csv",
    "text/yaml",
    "application/json",
    "application/xml",
    ...textExtensions,
    "image/png",
    "image/jpeg",
    "image/webp",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".pdf",
    "application/pdf",
    ".docx",
    ".xlsx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ].join(",");
}

function isHarnessTextCaptureFileName(fileName, mimeType = "") {
  const extension = getFileExtension(fileName);
  const basename = getFileBasename(fileName);
  const normalizedMimeType = normalizeMimeType(mimeType);
  return (
    normalizedMimeType.startsWith("text/") ||
    normalizedMimeType === "application/json" ||
    normalizedMimeType === "application/xml" ||
    SUPPORTED_TEXT_EXTENSIONS.has(extension) ||
    SUPPORTED_TEXT_BASENAMES.has(basename)
  );
}

function getHarnessTextCaptureScript() {
  const extensions = Array.from(SUPPORTED_TEXT_EXTENSIONS).sort();
  const basenames = Array.from(SUPPORTED_TEXT_BASENAMES).sort();
  return `
        const textExtensions = new Set(${JSON.stringify(extensions)});
        const textBasenames = new Set(${JSON.stringify(basenames)});
        const extensionOf = (name) => {
          const normalized = String(name || '').split(/[\\\\/]/).pop().toLowerCase();
          if (normalized === '.env') return '.env';
          const index = normalized.lastIndexOf('.');
          return index > 0 && index < normalized.length - 1 ? normalized.slice(index) : '';
        };
        const isQaTextFile = (file) => {
          const mimeType = String(file.type || '').split(';')[0].trim().toLowerCase();
          const name = String(file.name || '').split(/[\\\\/]/).pop().toLowerCase();
          return mimeType.startsWith('text/') ||
            mimeType === 'application/json' ||
            mimeType === 'application/xml' ||
            textExtensions.has(extensionOf(name)) ||
            textBasenames.has(name);
        };`;
}

function createHarnessPage() {
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>LeakGuard Browser QA Harness</title></head>
  <body>
    <main>
      <h1>LeakGuard Browser QA Harness</h1>
      <form id="provider-form">
        <textarea id="prompt-textarea" data-testid="prompt-textarea" placeholder="Message"></textarea>
        <div id="provider-editor" contenteditable="true" role="textbox" data-testid="provider-composer" aria-label="Message"></div>
        <button id="send-button" type="submit" data-testid="send-button" aria-label="Send message">Send</button>
      </form>
      <input id="qa-file-input" type="file" accept="${getHarnessFileInputAccept()}">
      <div id="qa-drop-zone" role="button" aria-label="Drop files here">Drop files here</div>
      <ul id="qa-safe-controls" aria-label="Safe controls">
        ${browserQaSafeControlIds.map((id) => `<li data-lgqa-safe-control="${id}">${id}</li>`).join("\n        ")}
      </ul>
      <section id="echo-zone"></section>
    </main>
    <script>
      window.__leakguardQaUploads = [];
      window.__leakguardQaSubmissions = [];
      window.__leakguardQaEvents = [];
      ${getHarnessTextCaptureScript()}
      window.__leakguardQaDescribeFile = async (file) => {
        const isText = isQaTextFile(file);
        const bytes = new Uint8Array(await file.arrayBuffer());
        return {
          name: file.name,
          type: file.type,
          size: file.size,
          text: isText ? new TextDecoder().decode(bytes) : '',
          bytePrefix: Array.from(bytes.slice(0, 12)),
          byteValues: Array.from(bytes),
          byteSum: Array.from(bytes).reduce((total, byte) => total + byte, 0)
        };
      };
      window.__leakguardQaRecordFiles = async (source, files) => {
        const items = await Promise.all(Array.from(files || []).map(window.__leakguardQaDescribeFile));
        window.__leakguardQaUploads.push({ source, items });
        return items;
      };
      document.querySelector('#qa-file-input').addEventListener('change', async (event) => {
        await window.__leakguardQaRecordFiles('file-input', event.target.files);
      });
      document.querySelector('#provider-editor').addEventListener('paste', (event) => {
        setTimeout(() => {
          if (event.defaultPrevented) return;
          const text = event.clipboardData?.getData('text/plain') || '';
          if (text) document.querySelector('#provider-editor').textContent += text;
        }, 0);
      });
      document.querySelector('#qa-drop-zone').addEventListener('dragover', (event) => {
        window.__leakguardQaEvents.push({ type: 'dragover', defaultPrevented: event.defaultPrevented });
      });
      document.querySelector('#qa-drop-zone').addEventListener('drop', async (event) => {
        window.__leakguardQaEvents.push({ type: 'drop', defaultPrevented: event.defaultPrevented });
        await window.__leakguardQaRecordFiles('drop', event.dataTransfer?.files || []);
      });
      document.querySelector('#provider-form').addEventListener('submit', (event) => {
        event.preventDefault();
        const textarea = document.querySelector('#prompt-textarea');
        const editor = document.querySelector('#provider-editor');
        window.__leakguardQaEvents.push({ type: 'provider-submit', trusted: Boolean(event.isTrusted) });
        window.__leakguardQaSubmissions.push({
          textarea: textarea?.value || '',
          editor: editor?.innerText || editor?.textContent || ''
        });
      });
    </script>
  </body>
</html>`;
}

async function startHarnessServer() {
  const server = http.createServer((_request, response) => {
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    });
    response.end(createHarnessPage());
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

function prepareQaExtension(tempDir) {
  const extensionDir = path.join(tempDir, "extension");
  fs.cpSync(sourceExtensionDir, extensionDir, { recursive: true });

  const manifestPath = path.join(extensionDir, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.host_permissions = Array.from(
    new Set([...(manifest.host_permissions || []), "http://127.0.0.1/*"])
  );
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return extensionDir;
}

function normalizePathForCompare(value) {
  return path.resolve(String(value || "")).toLowerCase();
}

function findExtensionIdInPreferences(preferences, expectedExtensionDir) {
  const settings = preferences?.extensions?.settings || {};
  const expectedPath = normalizePathForCompare(expectedExtensionDir);
  for (const [id, setting] of Object.entries(settings)) {
    const manifestName = setting?.manifest?.name || "";
    const extensionPath = setting?.path || "";
    if (manifestName === "LeakGuard" || normalizePathForCompare(extensionPath) === expectedPath) {
      return id;
    }
  }
  return "";
}

function getBrowserQaDebuggingMode({ mode = process.env.LEAKGUARD_BROWSER_QA_DEBUGGING || "" } = {}) {
  const normalized = String(mode || "port").trim().toLowerCase();
  if (normalized === "pipe" || normalized === "port") return normalized;
  throw new Error(`Unsupported browser QA debugging mode "${mode}". Expected port or pipe.`);
}

async function launchBrowser({ executable, extensionDir, profileDir, browserName }) {
  return await launchChrome({
    extensionPath: extensionDir,
    profileDir,
    browserName,
    browserExecutable: executable,
    missingMessage: `${browserName} was not found. Set CHROME_BIN, EDGE_BIN, or MSEDGE_BIN.`,
    remoteDebuggingMode: getBrowserQaDebuggingMode()
  });
}

async function createBrowserConnection(browserProcess, browserName) {
  if (browserProcess.debuggingMode === "port") {
    const webSocketUrl = await findCdpWebSocketUrl(browserProcess.debuggingPort, browserName);
    return new CdpWebSocketConnection(webSocketUrl);
  }
  return new ChromiumPipeConnection(browserProcess.child.stdio[3], browserProcess.child.stdio[4]);
}

async function waitForBrowserExit(child, timeoutMs = 5000) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, timeoutMs))
  ]);
}

function assertHarnessTempDir(tempDir) {
  const resolvedTempDir = path.resolve(tempDir);
  const resolvedOsTempDir = path.resolve(os.tmpdir());
  const relativeToTemp = path.relative(resolvedOsTempDir, resolvedTempDir);
  const isInsideOsTemp =
    relativeToTemp && !relativeToTemp.startsWith("..") && !path.isAbsolute(relativeToTemp);
  const basename = path.basename(resolvedTempDir);

  if (!isInsideOsTemp || !/^leakguard-(?:chrome|edge)-qa-/.test(basename)) {
    throw new Error(`Refusing to remove non-harness temp dir: ${tempDir}`);
  }
}

async function closeBrowserTargets(connection, diagnostics = console) {
  if (!connection) return;
  let targets = [];
  try {
    const response = await connection.send("Target.getTargets");
    targets = response.targetInfos || [];
  } catch (error) {
    diagnostics.warn(`Browser QA cleanup warning: failed to list targets before close: ${error.message}`);
    return;
  }

  const pageTargets = targets.filter((target) => target.type === "page" && target.targetId);
  for (const target of pageTargets) {
    await connection.send("Target.closeTarget", { targetId: target.targetId }).catch((error) => {
      diagnostics.warn(`Browser QA cleanup warning: failed to close target ${target.targetId}: ${error.message}`);
    });
  }
}

async function cleanupBrowserQaRun({
  browserName,
  tempDir,
  connection = null,
  child = null,
  harnessServer = null,
  behaviorChecksPassed = false,
  diagnostics = console,
  rmFn = fs.promises.rm,
  cleanupDelayMs: waitBeforeRemoveMs = cleanupDelayMs,
  maxRetries = cleanupMaxRetries,
  retryDelay = cleanupRetryDelayMs
}) {
  assertHarnessTempDir(tempDir);
  const label = `${browserName} browser QA cleanup`;
  diagnostics.log(
    `${label}: tempDir=${tempDir} maxRetries=${maxRetries} retryDelay=${retryDelay}ms behaviorChecksPassed=${behaviorChecksPassed}`
  );

  await closeBrowserTargets(connection, diagnostics);
  await connection?.send("Browser.close").catch(() => {});
  await connection?.close().catch(() => {});
  await waitForBrowserExit(child, 3000);
  if (child && child.exitCode === null && child.signalCode === null) {
    diagnostics.warn(`${label}: spawned browser process still running; terminating pid=${child.pid || "unknown"}`);
    child.kill();
    await waitForBrowserExit(child, 3000);
  }
  await harnessServer?.close().catch((error) => {
    diagnostics.warn(`${label}: harness server close warning: ${error.message}`);
  });
  await delay(waitBeforeRemoveMs);

  try {
    await rmFn(tempDir, { recursive: true, force: true, maxRetries, retryDelay });
    diagnostics.log(`${label}: final cleanup status=removed`);
    return { removed: true, warningOnly: false };
  } catch (error) {
    const message = `${label}: final cleanup status=not-removed tempDir=${tempDir} behaviorChecksPassed=${behaviorChecksPassed} error=${error.message}`;
    if (behaviorChecksPassed && ["EPERM", "EBUSY", "ENOTEMPTY"].includes(error.code)) {
      diagnostics.warn(message);
      return { removed: false, warningOnly: true, error };
    }
    diagnostics.warn(message);
    throw error;
  }
}

async function attachToTarget(connection, targetId) {
  const { sessionId } = await connection.send("Target.attachToTarget", { targetId, flatten: true });
  await connection.send("Runtime.enable", {}, sessionId).catch(() => {});
  await connection.send("Page.enable", {}, sessionId).catch(() => {});
  return sessionId;
}

async function createPage(connection, url = "about:blank") {
  const { targetId } = await connection.send("Target.createTarget", { url });
  return { targetId, sessionId: await attachToTarget(connection, targetId) };
}

async function evaluate(connection, sessionId, expression, options = {}) {
  const result = await connection.send(
    "Runtime.evaluate",
    {
      expression,
      awaitPromise: options.awaitPromise !== false,
      returnByValue: options.returnByValue !== false,
      userGesture: Boolean(options.userGesture)
    },
    sessionId
  );
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description ||
        result.exceptionDetails.text ||
        `Evaluation failed: ${expression.slice(0, 120)}`
    );
  }
  return result.result?.value;
}

async function pressEnter(connection, sessionId) {
  const event = {
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
    nativeVirtualKeyCode: 13
  };
  await connection.send("Input.dispatchKeyEvent", { ...event, type: "keyDown" }, sessionId);
  await connection.send("Input.dispatchKeyEvent", { ...event, type: "keyUp" }, sessionId);
}

async function navigate(connection, sessionId, url) {
  await connection.send("Page.navigate", { url }, sessionId);
  await waitFor(
    () => evaluate(connection, sessionId, "document.readyState === 'complete'"),
    `page load ${url}`
  );
}

async function extensionMessage(connection, sessionId, message) {
  return await evaluate(
    connection,
    sessionId,
    `chrome.runtime.sendMessage(${JSON.stringify(message)})`,
    { awaitPromise: true }
  );
}

async function loadExtension(connection, profileDir, extensionDir, browserName) {
  try {
    const response = await connection.send("Extensions.loadUnpacked", {
      path: extensionDir,
      enableInIncognito: false
    });
    if (response.id || response.extensionId) return response.id || response.extensionId;
  } catch (error) {
    console.warn(`${browserName} browser QA: CDP extension load warning: ${error.message}`);
  }

  let lastTargets = [];
  const target = await waitFor(async () => {
    const { targetInfos } = await connection.send("Target.getTargets");
    lastTargets = targetInfos;
    const serviceWorker = targetInfos.find(
      (info) =>
        info.type === "service_worker" &&
        /^chrome-extension:\/\/[^/]+\/background\/service_worker\.js$/.test(info.url)
    );
    if (serviceWorker) return serviceWorker;

    const preferencesPath = path.join(profileDir, "Default", "Preferences");
    if (!fs.existsSync(preferencesPath)) return null;
    const preferences = JSON.parse(fs.readFileSync(preferencesPath, "utf8"));
    const id = findExtensionIdInPreferences(preferences, extensionDir);
    if (id) return { url: `chrome-extension://${id}/background/service_worker.js` };
    return null;
  }, `${browserName} LeakGuard extension service worker`).catch((error) => {
    const targetSummary = lastTargets
      .map((info) => `${info.type}:${info.url || info.title || "<blank>"}`)
      .join("\n");
    throw new Error(`${error.message}\nObserved targets:\n${targetSummary}`);
  });
  return new URL(target.url).hostname;
}

async function setFileInputFiles(connection, sessionId, selector, files, options = {}) {
  await connection.send("DOM.enable", {}, sessionId).catch(() => {});
  const expectedNames = files.map((file) => path.basename(file));
  const verifyAssignment = options.verifyAssignment !== false;
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const { root } = await connection.send("DOM.getDocument", { depth: -1, pierce: true }, sessionId);
      const { nodeId } = await connection.send(
        "DOM.querySelector",
        { nodeId: root.nodeId, selector },
        sessionId
      );
      assert.ok(nodeId, `Expected to find file input ${selector}`);
      await connection.send("DOM.setFileInputFiles", { nodeId, files }, sessionId);
      await evaluate(
        connection,
        sessionId,
        `(() => {
          const input = document.querySelector(${JSON.stringify(selector)});
          input?.dispatchEvent(new Event('input', { bubbles: true }));
          input?.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        })()`
      );
      if (!verifyAssignment) return;
      await waitFor(
        () =>
          evaluate(
            connection,
            sessionId,
            `(() => {
              const expected = ${JSON.stringify(expectedNames)};
              const actual = Array.from(document.querySelector(${JSON.stringify(selector)})?.files || [])
                .map((file) => file.name);
              return expected.length === actual.length &&
                expected.every((name, index) => actual[index] === name);
            })()`
          ),
        `file input assignment ${selector}`,
        1000
      );
      return;
    } catch (error) {
      lastError = error;
      await delay(100);
    }
  }
  throw lastError;
}

function assertNoRawSyntheticValues(text, label) {
  for (const raw of rawValues) {
    assert.equal(String(text || "").includes(raw), false, `${label} leaked ${browserQaCanaryLabel(raw)}`);
  }
}

function valueToSweepText(value) {
  if (Buffer.isBuffer(value)) return value.toString("latin1");
  if (value instanceof Uint8Array) return Buffer.from(value).toString("latin1");
  if (typeof value === "string") return value;
  return JSON.stringify(value || "");
}

function assertNoRawMarkers(value, label, markers = rawValues) {
  const text = valueToSweepText(value);
  for (const marker of markers) {
    assert.equal(text.includes(marker), false, `${label} leaked ${browserQaCanaryLabel(marker)}`);
  }
}

function assertArtifactHasPlaceholder(value, label, pattern = /\[PWM_\d+\]/) {
  assert.match(valueToSweepText(value), pattern, `${label} should contain a sanitized placeholder`);
}

async function captureProviderArtifacts(connection, sessionId) {
  return await evaluate(
    connection,
    sessionId,
    `(async () => ({
      uploads: Array.from(window.__leakguardQaUploads || []),
      submissions: Array.from(window.__leakguardQaSubmissions || []),
      events: Array.from(window.__leakguardQaEvents || []),
      inputFiles: await Promise.all(Array.from(document.querySelector('#qa-file-input')?.files || [])
        .map(window.__leakguardQaDescribeFile)),
      pageText: document.body.innerText || '',
      modalText: document.querySelector('.pwm-modal')?.innerText || '',
      overlayText: document.querySelector('.pwm-file-processing-overlay')?.innerText || '',
      panelText: document.querySelector('.pwm-panel')?.innerText || ''
    }))()`,
    { awaitPromise: true }
  );
}

function flattenCapturedUploadItems(capture) {
  return [
    ...(capture?.uploads || []).flatMap((upload) => upload.items || []),
    ...(capture?.inputFiles || [])
  ];
}

function assertCapturedStateHasNoRawMarkers(capture, label, markers = rawValues) {
  const safeCapture = {
    uploads: (capture?.uploads || []).map((upload) => ({
      source: upload.source,
      items: (upload.items || []).map((item) => ({
        name: item.name,
        type: item.type,
        size: item.size,
        text: item.text,
        byteValues: item.byteValues,
        bytePrefix: item.bytePrefix
      }))
    })),
    submissions: capture?.submissions || [],
    inputFiles: capture?.inputFiles || [],
    pageText: capture?.pageText || "",
    modalText: capture?.modalText || "",
    overlayText: capture?.overlayText || "",
    panelText: capture?.panelText || ""
  };
  assertNoRawMarkers(safeCapture, label, markers);
}

function captureHasRawFileBlockedMessage(capture) {
  return /Raw file blocked|Raw file upload blocked|local file extraction did not produce safe text|could not read this local file/i.test(
    `${capture?.modalText || ""}\n${capture?.overlayText || ""}`
  );
}

async function resetProviderCapture(connection, sessionId) {
  await closeBlockingModalIfPresent(connection, sessionId);
  await evaluate(
    connection,
    sessionId,
    `(() => {
      window.__leakguardQaUploads = [];
      window.__leakguardQaSubmissions = [];
      window.__leakguardQaEvents = [];
      const input = document.querySelector('#qa-file-input');
      if (input) input.value = '';
      const textarea = document.querySelector('#prompt-textarea');
      if (textarea) textarea.value = '';
      const editor = document.querySelector('#provider-editor');
      if (editor) editor.textContent = '';
      return true;
    })()`
  );
}

async function closeBlockingModalIfPresent(connection, sessionId) {
  await evaluate(
    connection,
    sessionId,
    `(() => {
      const button = Array.from(
        document.querySelectorAll('.pwm-modal-backdrop button, .pwm-modal button')
      ).find((candidate) => /Close|OK|Cancel/i.test(candidate.textContent || ''));
      if (button) {
        button.click();
        return true;
      }
      return false;
    })()`,
    { userGesture: true }
  );
  try {
    await waitFor(
      () =>
        evaluate(
          connection,
          sessionId,
          `(() => !document.querySelector('.pwm-modal, .pwm-modal-backdrop'))()`
        ),
      "close blocking modal",
      1500
    );
  } catch {
    // Some flows do not show a blocking modal; reset should remain best-effort.
  }
}

async function dispatchSyntheticFileDrop(connection, sessionId, { fileName, mimeType, bytes }) {
  const base64 = Buffer.from(bytes).toString("base64");
  await evaluate(
    connection,
    sessionId,
    `(() => {
      const zone = document.querySelector('#qa-drop-zone');
      const binary = atob(${JSON.stringify(base64)});
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      const file = new File([bytes], ${JSON.stringify(fileName)}, { type: ${JSON.stringify(mimeType)} });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      for (const type of ['dragenter', 'dragover', 'drop']) {
        zone.dispatchEvent(new DragEvent(type, {
          bubbles: true,
          cancelable: true,
          dataTransfer: transfer
        }));
      }
      return true;
    })()`,
    { userGesture: true }
  );
}

async function waitForCapturedUpload(connection, sessionId, predicate, label, timeoutMs = 30000) {
  return await waitFor(
    async () => {
      const capture = await captureProviderArtifacts(connection, sessionId);
      const items = flattenCapturedUploadItems(capture);
      const matched = items.find(predicate) || null;
      return matched ? { capture, item: matched } : null;
    },
    label,
    timeoutMs
  );
}

async function captureFailureScreenshotIfSafe({ connection, sessionId, browserName, testName, stepName }) {
  if (!connection || !sessionId) return "";
  let state;
  try {
    state = await evaluate(
      connection,
      sessionId,
      `(() => ({
        bodyText: document.body?.innerText || '',
        textarea: document.querySelector('#prompt-textarea')?.value || '',
        editor: document.querySelector('#provider-editor')?.innerText ||
          document.querySelector('#provider-editor')?.textContent || '',
        modal: document.querySelector('.pwm-modal')?.innerText || '',
        overlay: document.querySelector('.pwm-file-processing-overlay')?.innerText || ''
      }))()`
    );
  } catch {
    return "";
  }

  const visibleText = JSON.stringify(state || {});
  const mayExposeRaw = browserQaSecretCanaries.some((canary) => visibleText.includes(canary.value));
  if (mayExposeRaw) return "";

  try {
    const screenshotPath = safeBrowserQaScreenshotPath({
      browserName,
      testName,
      stepName,
      secretCanaries: browserQaSecretCanaries
    });
    const captured = await connection.send(
      "Page.captureScreenshot",
      { format: "png", captureBeyondViewport: false },
      sessionId
    );
    if (!captured?.data) return "";
    fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    fs.writeFileSync(screenshotPath, Buffer.from(captured.data, "base64"));
    return screenshotPath;
  } catch {
    return "";
  }
}

function getUserProtectedSite(overview) {
  return (overview.userSites || []).find((rule) => rule.id === localProtectedSiteId) || null;
}

async function getLocalProtectedSiteOverview(connection, extensionSessionId, harnessOrigin) {
  const overview = await extensionMessage(connection, extensionSessionId, {
    type: "PWM_GET_PROTECTED_SITE_OVERVIEW",
    url: `${harnessOrigin}/`
  });
  assert.equal(overview.ok, true);
  return overview;
}

function assertLocalProtectedSiteOverview(overview, expected) {
  const userRule = getUserProtectedSite(overview);

  assert.equal(overview.currentSite.eligible, true, "local harness should be eligible for protection");
  assert.equal(
    overview.currentSite.protected,
    expected.protected,
    "current-site protection state did not match"
  );
  assert.equal(overview.currentSite.source || null, expected.source || null);
  assert.equal(Boolean(userRule), expected.present, "user-managed site presence did not match");

  if (expected.present) {
    assert.equal(userRule.enabled, expected.enabled, "user-managed site enabled state did not match");
    assert.equal(userRule.matchPattern, localProtectedSitePermission);
    assert.equal(userRule.hasPermission, true);
  }
}

async function ensureLocalProtectedSitePermission(connection, extensionSessionId) {
  const permissionGranted = await evaluate(
    connection,
    extensionSessionId,
    `((origin) => new Promise((resolve) => {
      chrome.permissions.contains({ origins: [origin] }, resolve);
    }))(${JSON.stringify(localProtectedSitePermission)})`,
    { awaitPromise: true }
  );
  assert.equal(permissionGranted, true, "temporary extension copy should pregrant localhost permission");
}

async function addLocalProtectedSite(connection, extensionSessionId, harnessOrigin) {
  await ensureLocalProtectedSitePermission(connection, extensionSessionId);
  const response = await extensionMessage(connection, extensionSessionId, {
    type: "PWM_ADD_PROTECTED_SITE",
    input: localProtectedSiteInput,
    url: `${harnessOrigin}/`
  });
  assert.equal(response.ok, true);
  assert.equal(response.rule.id, localProtectedSiteId);
  assert.equal(response.rule.enabled, true);
  return response;
}

async function runProtectedSiteManagementQa(connection, extensionSessionId, harnessOrigin) {
  await addLocalProtectedSite(connection, extensionSessionId, harnessOrigin);
  assertLocalProtectedSiteOverview(
    await getLocalProtectedSiteOverview(connection, extensionSessionId, harnessOrigin),
    { present: true, enabled: true, protected: true, source: "user" }
  );

  const disableResponse = await extensionMessage(connection, extensionSessionId, {
    type: "PWM_SET_PROTECTED_SITE_ENABLED",
    siteId: localProtectedSiteId,
    enabled: false,
    url: `${harnessOrigin}/`
  });
  assert.equal(disableResponse.ok, true);
  assert.equal(disableResponse.rule.enabled, false);
  assertLocalProtectedSiteOverview(
    await getLocalProtectedSiteOverview(connection, extensionSessionId, harnessOrigin),
    { present: true, enabled: false, protected: false, source: null }
  );

  const reenableResponse = await extensionMessage(connection, extensionSessionId, {
    type: "PWM_SET_PROTECTED_SITE_ENABLED",
    siteId: localProtectedSiteId,
    enabled: true,
    url: `${harnessOrigin}/`
  });
  assert.equal(reenableResponse.ok, true);
  assert.equal(reenableResponse.rule.enabled, true);
  assertLocalProtectedSiteOverview(
    await getLocalProtectedSiteOverview(connection, extensionSessionId, harnessOrigin),
    { present: true, enabled: true, protected: true, source: "user" }
  );

  const deleteResponse = await extensionMessage(connection, extensionSessionId, {
    type: "PWM_DELETE_PROTECTED_SITE",
    siteId: localProtectedSiteId,
    url: `${harnessOrigin}/`
  });
  assert.equal(deleteResponse.ok, true);
  assert.equal(deleteResponse.rule.id, localProtectedSiteId);
  assertLocalProtectedSiteOverview(
    await getLocalProtectedSiteOverview(connection, extensionSessionId, harnessOrigin),
    { present: false, enabled: false, protected: false, source: null }
  );

  await addLocalProtectedSite(connection, extensionSessionId, harnessOrigin);
  assertLocalProtectedSiteOverview(
    await getLocalProtectedSiteOverview(connection, extensionSessionId, harnessOrigin),
    { present: true, enabled: true, protected: true, source: "user" }
  );
}

async function openProtectedHarness(connection, harnessOrigin) {
  const page = await createPage(connection);
  await navigate(connection, page.sessionId, `${harnessOrigin}/`);
  const panel = await waitFor(async () => {
    const state = await evaluate(
      connection,
      page.sessionId,
      `(() => ({
        panelText: document.querySelector('.pwm-panel')?.innerText || '',
        hasPanel: Boolean(document.querySelector('.pwm-panel')),
        pageText: document.body.innerText || ''
      }))()`
    );
    return state.hasPanel && /PROTECTION\s+Active/i.test(state.panelText) ? state : null;
  }, "LeakGuard active panel before payload");
  assertContentScriptReady(panel, {
    browserName: "Chrome",
    siteLabel: "local protected QA page",
    adapter: "generic protected site",
    inputPath: "typed text",
    stage: "content script not injected",
    secretCanaries: browserQaSecretCanaries
  });
  assertProtectedSiteActive(panel, "local protected QA page", {
    browserName: "Chrome",
    siteLabel: "local protected QA page",
    adapter: "generic protected site",
    inputPath: "typed text",
    stage: "protected site not active",
    secretCanaries: browserQaSecretCanaries
  });
  assertSafeControlsVisible(panel.pageText, browserQaSafeControlIds, {
    browserName: "Chrome",
    siteLabel: "local protected QA page",
    adapter: "generic protected site",
    inputPath: "typed text",
    stage: "UI rewrite failed",
    secretCanaries: browserQaSecretCanaries
  });
  return page;
}

function assertPromptRedaction(result) {
  assertNoRawSecretVisible(result.value || result, rawValues.map(browserQaCanaryLabel), {
    browserName: "Chrome",
    siteLabel: "local protected QA page",
    adapter: "generic protected site",
    inputPath: "paste",
    stage: "UI rewrite failed",
    secretCanaries: browserQaSecretCanaries,
    expected: "raw absent + placeholder present after multiline paste"
  });
  assertExpectedPlaceholdersVisible(result.value || "", 4, {
    browserName: "Chrome",
    siteLabel: "local protected QA page",
    adapter: "generic protected site",
    inputPath: "paste",
    stage: "placeholder allocation failed",
    secretCanaries: browserQaSecretCanaries
  });
  assert.equal(result.hasRawSecretPrefix, false, "prompt still contains raw secret prefixes");
  assert.equal(result.lineCount, promptLines.length, "multiline formatting was not preserved");
  assert.equal(result.openAiRedacted, true);
  assert.equal(result.anthropicRedacted, true);
  assert.equal(result.githubRedacted, true);
  assert.equal(result.stripeRedacted, true);
  assert.equal(result.databasePasswordRedacted, true);
  assert.equal(result.emailRedacted, true);
  assert.equal(result.repeatedPlaceholderReused, true);
  assert.equal(result.existingPlaceholderPreserved, true);
  assert.equal(result.publicIpRedacted, true);
  assert.equal(
    result.privateIpRedacted,
    true,
    `private IP should be redacted in prompt value: ${sanitizeBrowserQaDiagnostic(result.value)}`
  );
}

async function runPromptRedactionQa(connection, page) {
  await evaluate(
    connection,
    page.sessionId,
    `(() => {
      const textarea = document.querySelector('#prompt-textarea');
      const payload = ${JSON.stringify(promptPayload)};
      textarea.focus();
      const transfer = new DataTransfer();
      transfer.setData('text/plain', payload);
      textarea.dispatchEvent(new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: transfer
      }));
      return true;
    })()`
  );

  const result = await waitFor(async () => {
    const state = await evaluate(
      connection,
      page.sessionId,
      `(() => {
        const textarea = document.querySelector('#prompt-textarea');
        const rawValues = ${JSON.stringify(rawValues)};
        const value = textarea.value || '';
        const first = /^OPENAI_API_KEY=(\\[PWM_\\d+\\])$/m.exec(value)?.[1] || '';
        const repeat = /^OPENAI_API_KEY_REPEAT=(\\[PWM_\\d+\\])$/m.exec(value)?.[1] || '';
        const ready = /\\[PWM_\\d+\\]/.test(value) && /PUBLIC_IP=\\[(PUB_HOST|NET)_\\d+\\]/.test(value);
        if (ready) {
          return {
            value,
            firstPlaceholder: first,
            lineCount: value.split('\\n').length,
            hasAnyRaw: rawValues.some((raw) => value.includes(raw)),
            hasRawSecretPrefix: ['sk-proj-', 'sk-ant-api03-', 'ghp_', 'sk_live_', 'SuperFakePassword123']
              .some((raw) => value.includes(raw)),
            openAiRedacted: /^OPENAI_API_KEY=\\[PWM_\\d+\\]$/m.test(value),
            anthropicRedacted: /^ANTHROPIC_API_KEY=\\[PWM_\\d+\\]$/m.test(value),
            githubRedacted: /^GITHUB_TOKEN=\\[PWM_\\d+\\]$/m.test(value),
            stripeRedacted: /^STRIPE_SECRET_KEY=\\[PWM_\\d+\\]$/m.test(value),
            databasePasswordRedacted:
              /^DATABASE_URL=postgres:\\/\\/admin:\\[PWM_\\d+\\]@db\\.example\\.com:5432\\/customerdb$/m
                .test(value),
            emailRedacted: /^EMAIL_ADDRESS=\\[EMAIL_\\d+\\]$/m.test(value),
            repeatedPlaceholderReused: Boolean(first && repeat && first === repeat),
            existingPlaceholderPreserved: /^PLACEHOLDER_ALREADY=\\[PWM_1\\]$/m.test(value),
            publicIpRedacted: /PUBLIC_IP=\\[(PUB_HOST|NET)_\\d+\\]/.test(value),
            privateIpRedacted: /^PRIVATE_IP=\\[PRIVATE_IP_\\d+\\]$/m.test(value)
          };
        }
        return {
          value,
          hasRedactButton: Boolean(Array.from(
            document.querySelectorAll('.pwm-modal-backdrop button, .pwm-modal button')
          ).find((button) => /Redact/i.test(button.textContent || '')))
        };
      })()`
    );
    if (state?.firstPlaceholder) return state;
    if (state?.hasRedactButton) {
      await approveRedactionModalIfPresent(connection, page.sessionId);
    }
    return null;
  }, "prompt redaction", 15000);
  assertPromptRedaction(result);
  return result;
}

async function approveRedactionModalIfPresent(connection, sessionId) {
  const hasRedactButton = await evaluate(
    connection,
    sessionId,
    `(() => {
      const redactButton = Array.from(
        document.querySelectorAll('.pwm-modal-backdrop button, .pwm-modal button')
      ).find((button) => /Redact/i.test(button.textContent || ''));
      redactButton?.focus();
      return Boolean(redactButton);
    })()`
  );
  if (hasRedactButton) {
    await pressEnter(connection, sessionId);
  }
}

async function waitForInputPlaceholder(connection, sessionId, selector, expression, label) {
  return await waitFor(async () => {
    await approveRedactionModalIfPresent(connection, sessionId);
    const state = await evaluate(
      connection,
      sessionId,
      `(() => {
        const node = document.querySelector(${JSON.stringify(selector)});
        const value = ${expression};
        return {
          value,
          hasPlaceholder: /\\[PWM_\\d+\\]/.test(value),
          hasModal: Boolean(document.querySelector('.pwm-modal-backdrop, .pwm-modal')),
          pageText: document.body.innerText || '',
          submissions: Array.from(window.__leakguardQaSubmissions || [])
        };
      })()`
    );
    return state.hasPlaceholder && !state.hasModal ? state : null;
  }, label, 15000);
}

async function waitForProviderInputReadyForSubmit(connection, sessionId, selector, expression, label) {
  return await waitFor(async () => {
    await approveRedactionModalIfPresent(connection, sessionId);
    const state = await evaluate(
      connection,
      sessionId,
      `(() => {
        const node = document.querySelector(${JSON.stringify(selector)});
        const value = ${expression};
        return {
          value,
          hasPlaceholder: /\\[PWM_\\d+\\]/.test(value),
          hasModal: Boolean(document.querySelector('.pwm-modal-backdrop, .pwm-modal')),
          pageText: document.body.innerText || '',
          submissions: Array.from(window.__leakguardQaSubmissions || [])
        };
      })()`
    );
    return state && !state.hasModal ? state : null;
  }, label, 15000);
}

async function readProviderInputState(connection, sessionId, selector, expression) {
  return await evaluate(
    connection,
    sessionId,
    `(() => {
      const node = document.querySelector(${JSON.stringify(selector)});
      const value = ${expression};
      return {
        value,
        hasPlaceholder: /\\[PWM_\\d+\\]/.test(value),
        hasModal: Boolean(document.querySelector('.pwm-modal-backdrop, .pwm-modal')),
        pageText: document.body.innerText || '',
        submissions: Array.from(window.__leakguardQaSubmissions || [])
      };
    })()`
  );
}

function assertProviderSubmissionSanitized(submission, field, rawSecret, label) {
  assert.ok(submission, `${label} should create a synthetic provider submission`);
  assert.equal(String(submission[field] || "").includes(rawSecret), false, `${label} submitted raw secret`);
  assert.match(String(submission[field] || ""), /\[PWM_\d+\]/, `${label} should submit a placeholder`);
}

function classifyOneClickSubmitFailure(diagnostic) {
  if (diagnostic?.modalPresent) return "modal present";
  if (diagnostic?.textareaHasRaw || diagnostic?.editorHasRaw) return "raw still present";
  if (
    !diagnostic?.textareaHasRaw &&
    !diagnostic?.editorHasRaw &&
    (diagnostic?.textareaHasPlaceholder || diagnostic?.editorHasPlaceholder) &&
    Number(diagnostic?.submissionCount || 0) === 0
  ) {
    return "placeholder present but no submission";
  }
  if (
    !diagnostic?.textareaHasRaw &&
    !diagnostic?.editorHasRaw &&
    !diagnostic?.textareaHasPlaceholder &&
    !diagnostic?.editorHasPlaceholder
  ) {
    return "no placeholder and no raw";
  }
  return "one-click-submit-missing-provider-submission";
}

async function waitForLatestProviderSubmission(connection, sessionId, label) {
  return await waitFor(async () => {
    await approveRedactionModalIfPresent(connection, sessionId);
    return await evaluate(
      connection,
      sessionId,
      `(() => {
        const submissions = Array.from(window.__leakguardQaSubmissions || []);
        return submissions.length ? submissions[submissions.length - 1] : null;
      })()`
    );
  }, label);
}

async function runSyntheticProviderInputInterceptionQa(connection, page) {
  const cases = [
    {
      label: "textarea typed",
      selector: "#prompt-textarea",
      field: "textarea",
      valueExpression: "node?.value || ''",
      rawSecret: "sk-proj-TextareaTypedBrowserQa1234567890abcdef",
      expectPreSubmitRaw: true,
      async input() {
        await evaluate(
          connection,
          page.sessionId,
          `(() => {
            const textarea = document.querySelector('#prompt-textarea');
            textarea.value = '';
            textarea.focus();
          })()`
        );
        await connection.send("Input.insertText", { text: "TYPED_TEXTAREA_KEY=sk-proj-TextareaTypedBrowserQa1234567890abcdef" }, page.sessionId);
      }
    },
    {
      label: "textarea paste",
      selector: "#prompt-textarea",
      field: "textarea",
      valueExpression: "node?.value || ''",
      rawSecret: "sk-proj-TextareaPasteBrowserQa1234567890abcdef",
      async input() {
        await evaluate(
          connection,
          page.sessionId,
          `(() => {
            const textarea = document.querySelector('#prompt-textarea');
            textarea.value = '';
            textarea.focus();
            const transfer = new DataTransfer();
            transfer.setData('text/plain', 'PASTE_TEXTAREA_KEY=sk-proj-TextareaPasteBrowserQa1234567890abcdef');
            textarea.dispatchEvent(new ClipboardEvent('paste', {
              bubbles: true,
              cancelable: true,
              clipboardData: transfer
            }));
          })()`
        );
      }
    },
    {
      label: "contenteditable typed",
      selector: "#provider-editor",
      field: "editor",
      valueExpression: "node?.innerText || node?.textContent || ''",
      rawSecret: "sk-proj-EditorTypedBrowserQa1234567890abcdef",
      expectPreSubmitRaw: true,
      async input() {
        await evaluate(
          connection,
          page.sessionId,
          `(() => {
            const textarea = document.querySelector('#prompt-textarea');
            if (textarea) {
              textarea.remove();
            }
            const editor = document.querySelector('#provider-editor');
            editor.setAttribute('data-testid', 'prompt-textarea');
            editor.textContent = '';
            editor.focus();
          })()`
        );
        await connection.send("Input.insertText", { text: "TYPED_EDITOR_KEY=sk-proj-EditorTypedBrowserQa1234567890abcdef" }, page.sessionId);
      }
    },
    {
      label: "contenteditable paste",
      selector: "#provider-editor",
      field: "editor",
      valueExpression: "node?.innerText || node?.textContent || ''",
      rawSecret: "sk-proj-EditorPasteBrowserQa1234567890abcdef",
      expectFailClosed: true,
      async input() {
        await evaluate(
          connection,
          page.sessionId,
          `(() => {
            const textarea = document.querySelector('#prompt-textarea');
            if (textarea) {
              textarea.remove();
            }
            const editor = document.querySelector('#provider-editor');
            editor.setAttribute('data-testid', 'prompt-textarea');
            editor.textContent = '';
            editor.focus();
            const transfer = new DataTransfer();
            transfer.setData('text/plain', 'PASTE_EDITOR_KEY=sk-proj-EditorPasteBrowserQa1234567890abcdef');
            editor.dispatchEvent(new ClipboardEvent('paste', {
              bubbles: true,
              cancelable: true,
              clipboardData: transfer
            }));
          })()`
        );
      }
    }
  ];

  const results = [];
  for (const testCase of cases) {
    await resetProviderCapture(connection, page.sessionId);
    await testCase.input();
    let state;
    try {
      state = testCase.expectPreSubmitRaw
        ? await waitForProviderInputReadyForSubmit(
            connection,
            page.sessionId,
            testCase.selector,
            testCase.valueExpression,
            testCase.label
          )
        : await waitForInputPlaceholder(
            connection,
            page.sessionId,
            testCase.selector,
            testCase.valueExpression,
            testCase.label
          );
    } catch (error) {
      const diagnostic = await evaluate(
        connection,
        page.sessionId,
        `(() => ({
          textarea: document.querySelector('#prompt-textarea')?.value || '',
          editorText: document.querySelector('#provider-editor')?.innerText || document.querySelector('#provider-editor')?.textContent || '',
          modal: document.querySelector('.pwm-modal')?.innerText || '',
          overlay: document.querySelector('.pwm-file-processing-overlay')?.innerText || '',
          badge: document.querySelector('.pwm-badge')?.textContent || '',
          submissions: Array.from(window.__leakguardQaSubmissions || [])
        }))()`
      );
      const acceptedFailClosed = /Rewrite verification failed/i.test(diagnostic.modal || "");
      if (acceptedFailClosed) {
        assert.equal(diagnostic.editorText.includes(testCase.rawSecret), false, `${testCase.label} blocked editor should not retain raw secret`);
        assert.equal(diagnostic.textarea.includes(testCase.rawSecret), false, `${testCase.label} blocked textarea should not retain raw secret`);
        assert.equal(diagnostic.submissions.length, 0, `${testCase.label} blocked flow must not submit raw content`);
        const capture = await captureProviderArtifacts(connection, page.sessionId);
        assertCapturedStateHasNoRawMarkers(capture, `${testCase.label} fail-closed raw marker sweep`, [testCase.rawSecret]);
        results.push({ label: testCase.label, blocked: true, reason: "rewrite-verification-fail-closed" });
        await closeBlockingModalIfPresent(connection, page.sessionId);
        continue;
      }
      throw new Error(sanitizeBrowserQaDiagnostic(`${error.message} Diagnostic: ${JSON.stringify(diagnostic)}`));
    }
    if (testCase.expectPreSubmitRaw) {
      await delay(900);
      state = await readProviderInputState(
        connection,
        page.sessionId,
        testCase.selector,
        testCase.valueExpression
      );
      assert.equal(state.value.includes(testCase.rawSecret), true, `${testCase.label} should remain observe-only before submit`);
      assert.equal(state.hasPlaceholder, false, `${testCase.label} should not contain a placeholder before submit by default`);
    } else {
      assert.equal(state.value.includes(testCase.rawSecret), false, `${testCase.label} editor still contains raw secret`);
      assert.match(state.value, /\[PWM_\d+\]/, `${testCase.label} editor should contain a placeholder`);
    }
    await evaluate(connection, page.sessionId, "document.querySelector('#send-button')?.click()", { userGesture: true });
    let submitted;
    try {
      submitted = await waitForLatestProviderSubmission(
        connection,
        page.sessionId,
        `${testCase.label} synthetic provider submission`
      );
    } catch (error) {
      const diagnostic = await evaluate(
        connection,
        page.sessionId,
        `(() => {
          const textarea = document.querySelector('#prompt-textarea')?.value || '';
          const editorText = document.querySelector('#provider-editor')?.innerText ||
            document.querySelector('#provider-editor')?.textContent || '';
          const buttons = Array.from(
            document.querySelectorAll('.pwm-modal-backdrop button, .pwm-modal button')
          ).map((button) => button.textContent || '');
          return {
            textareaHasRaw: textarea.includes(${JSON.stringify(testCase.rawSecret)}),
            textareaHasPlaceholder: /\\[PWM_\\d+\\]/.test(textarea),
            editorHasRaw: editorText.includes(${JSON.stringify(testCase.rawSecret)}),
            editorHasPlaceholder: /\\[PWM_\\d+\\]/.test(editorText),
            modalPresent: Boolean(document.querySelector('.pwm-modal-backdrop, .pwm-modal')),
            modalButtons: buttons,
            badge: document.querySelector('.pwm-badge')?.textContent || '',
            submissionCount: Array.from(window.__leakguardQaSubmissions || []).length,
            events: Array.from(window.__leakguardQaEvents || [])
          };
        })()`
      );
      diagnostic.failure = classifyOneClickSubmitFailure(diagnostic);
      diagnostic.stage = "one-click-submit-missing-provider-submission";
      throw new Error(sanitizeBrowserQaDiagnostic(`${error.message} Diagnostic: ${JSON.stringify(diagnostic)}`));
    }
    assertProviderSubmissionSanitized(submitted, testCase.field, testCase.rawSecret, testCase.label);
    const capture = await captureProviderArtifacts(connection, page.sessionId);
    assertCapturedStateHasNoRawMarkers(capture, `${testCase.label} browser raw marker sweep`, [testCase.rawSecret]);
    results.push({ label: testCase.label, submitted });
  }

  return results;
}

async function runSecureRevealQa(connection, page, extensionId, placeholder) {
  const revealState = await evaluate(
    connection,
    page.sessionId,
    `new Promise((resolve, reject) => {
      const echo = document.querySelector('#echo-zone');
      echo.textContent = 'Assistant echoed ${placeholder} after redaction.';
      const rawValues = ${JSON.stringify(rawValues)};
      const started = Date.now();
      const timer = setInterval(() => {
        const chip = document.querySelector('#echo-zone .pwm-secret');
        if (chip) {
          clearInterval(timer);
          chip.click();
          setTimeout(() => resolve({
            chipText: chip.textContent,
            pageHasRaw: rawValues.some((raw) => document.body.innerText.includes(raw))
          }), 250);
        } else if (Date.now() - started > 5000) {
          clearInterval(timer);
          reject(new Error('Timed out waiting for hydrated placeholder chip'));
        }
      }, 50);
    })`
  );
  assert.equal(revealState.chipText, placeholder);
  assert.equal(revealState.pageHasRaw, false);

  const popup = await createPage(connection, `chrome-extension://${extensionId}/popup/popup.html`);
  await waitFor(
    () =>
      evaluate(
        connection,
        popup.sessionId,
        "document.querySelector('#reveal-view') && !document.querySelector('#reveal-view').hidden"
      ),
    "secure reveal popup view"
  );
  const beforeShow = await evaluate(
    connection,
    popup.sessionId,
    `({
      placeholder: document.querySelector('#reveal-placeholder')?.textContent || '',
      hidden: document.querySelector('#secret-value')?.hidden,
      rawVisible: ${JSON.stringify(rawValues)}
        .some((raw) => (document.querySelector('#secret-value')?.textContent || '').includes(raw))
    })`
  );
  assert.equal(beforeShow.placeholder, placeholder);
  assert.equal(beforeShow.hidden, true);
  assert.equal(beforeShow.rawVisible, false);

  const afterShow = await evaluate(
    connection,
    popup.sessionId,
    `new Promise((resolve) => {
      document.querySelector('#show-btn').click();
      setTimeout(() => resolve({
        hidden: document.querySelector('#secret-value')?.hidden,
        rawVisible: ${JSON.stringify(rawValues)}
          .some((raw) => (document.querySelector('#secret-value')?.textContent || '').includes(raw)),
        status: document.querySelector('#reveal-status')?.textContent || ''
      }), 250);
    })`
  );
  assert.equal(afterShow.hidden, false);
  assert.equal(afterShow.rawVisible, true);
  assert.match(afterShow.status, /Visible only inside this LeakGuard popup/);
}

async function runRefreshSafetyQa(connection, page) {
  await connection.send("Page.reload", {}, page.sessionId);
  await waitFor(
    () => evaluate(connection, page.sessionId, "document.readyState === 'complete'"),
    "harness refresh"
  );
  const refreshed = await evaluate(
    connection,
    page.sessionId,
    `({
      pageHasRaw: ${JSON.stringify(rawValues)}.some((raw) => document.body.innerText.includes(raw)),
      textareaValue: document.querySelector('#prompt-textarea')?.value || ''
    })`
  );
  assert.equal(refreshed.pageHasRaw, false);
  assert.equal(refreshed.textareaValue.includes("sk-"), false);
}

async function runProtectedSiteImageOcrQa(
  connection,
  page,
  extensionSessionId,
  tempDir,
  { matrixMode = BROWSER_QA_MATRIX_MODES.FAST } = {}
) {
  const settingResponse = await extensionMessage(connection, extensionSessionId, {
    type: "PWM_SET_PROTECTED_SITE_OCR_SETTING",
    enabled: true
  });
  assert.equal(settingResponse.ok, true, "protected-site OCR setting should be enabled for QA");

  const results = [];
  for (const testCase of getProtectedSiteImageFileCases({ matrixMode })) {
    const imagePath = path.join(tempDir, testCase.fileName);
    fs.writeFileSync(
      imagePath,
      await makeSyntheticTextImage(`API_KEY=${testCase.rawSecret}`, testCase.sharpFormat)
    );
    await resetProviderCapture(connection, page.sessionId);
    await setFileInputFiles(connection, page.sessionId, "#qa-file-input", [imagePath], { verifyAssignment: false });

    let result;
    try {
      result = await waitFor(
        () =>
          evaluate(
            connection,
            page.sessionId,
            `(async () => {
          const rawSecret = ${JSON.stringify(testCase.rawSecret)};
          const originalName = ${JSON.stringify(testCase.fileName)};
          const describeFile = async (file) => {
            const bytes = new Uint8Array(await file.arrayBuffer());
            return {
              name: file.name,
              type: file.type,
              size: file.size,
              text: file.type === 'text/plain' || /\\.txt$/i.test(file.name || '') ? new TextDecoder().decode(bytes) : '',
              bytePrefix: Array.from(bytes.slice(0, 12)),
              byteSum: bytes.reduce((sum, byte) => sum + byte, 0)
            };
          };
          const uploads = [
            ...Array.from(window.__leakguardQaUploads || []),
            {
              items: await Promise.all(Array.from(document.querySelector('#qa-file-input')?.files || []).map(describeFile))
            }
          ];
          const sanitized = uploads
            .flatMap((upload) => upload.items || [])
            .find((item) => /\\.redacted\\.png$/i.test(item.name || '') && item.type === 'image/png');
          if (!sanitized) return null;
          return {
            name: sanitized.name,
            type: sanitized.type,
            size: sanitized.size,
            bytePrefix: sanitized.bytePrefix,
            byteSum: sanitized.byteSum,
            hasRawName: String(sanitized.name || '').includes(rawSecret),
            originalImagePresent: uploads
              .flatMap((upload) => upload.items || [])
              .some((item) => item.name === originalName),
            textFallbackPresent: uploads
              .flatMap((upload) => upload.items || [])
              .some((item) => /\\.redacted\\.txt$/i.test(item.name || ''))
          };
        })()`,
            { awaitPromise: true }
          ),
        `${testCase.label} sanitized handoff`,
        qaTimeoutMs
      );
    } catch (error) {
      const diagnostic = await evaluate(
        connection,
        page.sessionId,
        `(async () => ({
        inputFiles: await Promise.all(Array.from(document.querySelector('#qa-file-input')?.files || []).map(async (file) => ({
          name: file.name,
          type: file.type,
          size: file.size,
          textPrefix: (file.type === 'text/plain' || /\\.txt$/i.test(file.name || '')) ? (await file.text()).slice(0, 160) : ''
        }))),
        recordedUploads: Array.from(window.__leakguardQaUploads || []).map((upload) => ({
          items: (upload.items || []).map((item) => ({
            name: item.name,
            type: item.type,
            size: item.size,
            textPrefix: String(item.text || '').slice(0, 160)
          }))
        })),
        badge: document.querySelector('.pwm-badge')?.textContent || '',
        modal: document.querySelector('.pwm-modal')?.innerText || '',
        overlay: document.querySelector('.pwm-file-processing-overlay')?.innerText || '',
        panel: document.querySelector('.pwm-panel')?.innerText || ''
      }))()`,
        { awaitPromise: true }
      );
      const blockedText = `${diagnostic.badge || ""}\n${diagnostic.modal || ""}\n${diagnostic.overlay || ""}`;
      if (/Raw image upload blocked|Raw file blocked|raw upload blocked/i.test(blockedText)) {
        assertNoRawMarkers(diagnostic, `${testCase.label} fail-closed image state`, [testCase.rawSecret]);
        results.push({
          label: testCase.label,
          name: "",
          type: testCase.mimeType,
          size: 0,
          extension: testCase.extension,
          blocked: true,
          reason: "raw_image_upload_blocked"
        });
        continue;
      }
      throw new Error(sanitizeBrowserQaDiagnostic(`${error.message} Diagnostic: ${JSON.stringify(diagnostic)}`));
    }

    const expectedName = testCase.fileName.replace(/\.[^.]+$/, ".redacted.png");
    assert.equal(result.name, expectedName);
    assertNoRawMarkers(result.name, `${testCase.label} file name`, [testCase.rawSecret]);
    assert.equal(result.type, "image/png");
    assert.deepEqual(result.bytePrefix.slice(0, 8), [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(result.hasRawName, false, `${testCase.label} must not expose raw OCR text in image name`);
    assert.equal(result.originalImagePresent, false, `${testCase.label} must not upload the raw image`);
    assert.equal(result.textFallbackPresent, false, "safe protected-site visual redaction should hand off PNG, not txt");
    assertCapturedStateHasNoRawMarkers(
      await captureProviderArtifacts(connection, page.sessionId),
      `${testCase.label} capture`,
      [testCase.rawSecret]
    );
    results.push({
      label: testCase.label,
      name: result.name,
      type: result.type,
      size: result.size,
      extension: testCase.extension
    });
  }

  return results;
}

function supportedFileRawMarkers(testCase) {
  return [testCase.rawSecret, testCase.emailValue, testCase.weakSecret, testCase.providerSecret];
}

function supportedFileCanaries(testCase) {
  return [
    { id: testCase.secretId, value: testCase.rawSecret, expectedPlaceholder: "[PWM_N]" },
    { id: testCase.emailId, value: testCase.emailValue, expectedPlaceholder: "[EMAIL_N]" },
    { id: testCase.weakId, value: testCase.weakSecret, expectedPlaceholder: "[PWM_N]" },
    { id: testCase.providerId, value: testCase.providerSecret, expectedPlaceholder: "[PWM_N]" }
  ];
}

function getSupportedFileCaseByExtension(extension) {
  const testCase = getBrowserQaCoverageMatrix({ matrixMode: BROWSER_QA_MATRIX_MODES.FULL })
    .supportedFiles
    .find((entry) => entry.extension === extension);
  if (!testCase) {
    throw new Error(`Missing browser QA fixture case for ${extension}`);
  }
  return testCase;
}

function renderSupportedFileFixture(testCase) {
  const keyPrefix = testCase.id.replace(/[^A-Z0-9_]/g, "_");
  const commonRows = {
    secret: testCase.rawSecret,
    email: testCase.emailValue,
    weakPassword: testCase.weakSecret,
    providerSecret: testCase.providerSecret,
    safeControl: testCase.safeControlValue,
    existingPlaceholder: testCase.placeholderValue
  };

  switch (testCase.extension) {
    case ".pdf":
      return [
        `${keyPrefix}_API_KEY=${commonRows.secret}`,
        `${keyPrefix}_MAIL=${commonRows.email}`,
        `${keyPrefix}_PASSWORD=${commonRows.weakPassword}`,
        `${keyPrefix}_TOKEN=${commonRows.providerSecret}`,
        `${keyPrefix}_SAFE=${commonRows.safeControl}`,
        `${keyPrefix}_PLACEHOLDER=${commonRows.existingPlaceholder}`
      ].join("\n");
    case ".json":
      return JSON.stringify(
        {
          [`${keyPrefix}_SECRET`]: commonRows.secret,
          [`${keyPrefix}_EMAIL`]: commonRows.email,
          [`${keyPrefix}_WEAK_PASSWORD`]: commonRows.weakPassword,
          [`${keyPrefix}_PROVIDER_SECRET`]: commonRows.providerSecret,
          [`${keyPrefix}_SAFE_CONTROL`]: commonRows.safeControl,
          [`${keyPrefix}_PLACEHOLDER`]: commonRows.existingPlaceholder
        },
        null,
        2
      );
    case ".yaml":
    case ".yml":
      return [
        `${keyPrefix}_secret: ${commonRows.secret}`,
        `${keyPrefix}_email: ${commonRows.email}`,
        `${keyPrefix}_weak_password: ${commonRows.weakPassword}`,
        `${keyPrefix}_provider_secret: ${commonRows.providerSecret}`,
        `${keyPrefix}_safe_control: ${commonRows.safeControl}`,
        `${keyPrefix}_placeholder: ${commonRows.existingPlaceholder}`
      ].join("\n");
    case ".csv":
      return [
        "kind,name,value",
        `secret,${keyPrefix}_SECRET,${commonRows.secret}`,
        `email,${keyPrefix}_EMAIL,${commonRows.email}`,
        `weak_password,${keyPrefix}_WEAK_PASSWORD,${commonRows.weakPassword}`,
        `provider,${keyPrefix}_PROVIDER_SECRET,${commonRows.providerSecret}`,
        `safe,${keyPrefix}_SAFE_CONTROL,${commonRows.safeControl}`,
        `placeholder,${keyPrefix}_PLACEHOLDER,${commonRows.existingPlaceholder}`
      ].join("\n");
    case ".xml":
      return [
        "<lgqa>",
        `  <secret>${commonRows.secret}</secret>`,
        `  <email>${commonRows.email}</email>`,
        `  <weakPassword>${commonRows.weakPassword}</weakPassword>`,
        `  <providerSecret>${commonRows.providerSecret}</providerSecret>`,
        `  <safeControl>${commonRows.safeControl}</safeControl>`,
        `  <placeholder>${commonRows.existingPlaceholder}</placeholder>`,
        "</lgqa>"
      ].join("\n");
    case ".html":
      return [
        "<!doctype html>",
        "<meta charset=\"utf-8\">",
        `<p data-lgqa-secret="${commonRows.secret}">secret</p>`,
        `<p data-lgqa-email="${commonRows.email}">email</p>`,
        `<p data-lgqa-password="${commonRows.weakPassword}">password</p>`,
        `<p data-lgqa-provider="${commonRows.providerSecret}">provider</p>`,
        `<p data-lgqa-safe="${commonRows.safeControl}">${commonRows.safeControl}</p>`,
        `<p data-lgqa-placeholder="${commonRows.existingPlaceholder}">${commonRows.existingPlaceholder}</p>`
      ].join("\n");
    case ".js":
      return [
        `export const ${keyPrefix}_SECRET = "${commonRows.secret}";`,
        `export const ${keyPrefix}_EMAIL = "${commonRows.email}";`,
        `export const ${keyPrefix}_WEAK_PASSWORD = "${commonRows.weakPassword}";`,
        `export const ${keyPrefix}_PROVIDER_SECRET = "${commonRows.providerSecret}";`,
        `export const ${keyPrefix}_SAFE_CONTROL = "${commonRows.safeControl}";`,
        `export const ${keyPrefix}_PLACEHOLDER = "${commonRows.existingPlaceholder}";`
      ].join("\n");
    case ".ps1":
      return [
        `$${keyPrefix}_SECRET = "${commonRows.secret}"`,
        `$${keyPrefix}_EMAIL = "${commonRows.email}"`,
        `$${keyPrefix}_WEAK_PASSWORD = "${commonRows.weakPassword}"`,
        `$${keyPrefix}_PROVIDER_SECRET = "${commonRows.providerSecret}"`,
        `$${keyPrefix}_SAFE_CONTROL = "${commonRows.safeControl}"`,
        `$${keyPrefix}_PLACEHOLDER = "${commonRows.existingPlaceholder}"`
      ].join("\n");
    case ".md":
      return [
        `# ${keyPrefix}`,
        `- secret: ${commonRows.secret}`,
        `- email: ${commonRows.email}`,
        `- weak password: ${commonRows.weakPassword}`,
        `- provider secret: ${commonRows.providerSecret}`,
        `- safe control: ${commonRows.safeControl}`,
        `- placeholder: ${commonRows.existingPlaceholder}`
      ].join("\n");
    default:
      return [
        `${keyPrefix}_SECRET=${commonRows.secret}`,
        `${keyPrefix}_EMAIL=${commonRows.email}`,
        `${keyPrefix}_WEAK_PASSWORD=${commonRows.weakPassword}`,
        `${keyPrefix}_PROVIDER_SECRET=${commonRows.providerSecret}`,
        `${keyPrefix}_SAFE_CONTROL=${commonRows.safeControl}`,
        `${keyPrefix}_PLACEHOLDER=${commonRows.existingPlaceholder}`
      ].join("\n");
  }
}

function validateBrowserQaFixtureCase(testCase) {
  const fixture = renderSupportedFileFixture(testCase);
  for (const marker of supportedFileRawMarkers(testCase)) {
    if (!fixture.includes(marker)) {
      throw new Error(
        sanitizeBrowserQaDiagnostic(
          `QA fixture ${testCase.id} is missing required canary ${browserQaCanaryLabel(marker)}`
        )
      );
    }
  }
  if (!fixture.includes(testCase.safeControlValue) || !fixture.includes(testCase.placeholderValue)) {
    throw new Error(
      sanitizeBrowserQaDiagnostic(`QA fixture ${testCase.id} is missing safe control or trusted placeholder`)
    );
  }
  return fixture;
}

function assertCapturedSanitizedUpload({ item, capture, expected, rawSecret, label }) {
  assert.equal(item.name, expected.name, `${label} sanitized file name`);
  assert.equal(item.type, expected.type, `${label} sanitized MIME`);
  assert.equal(item.size > 0, true, `${label} sanitized file should be non-empty`);
  assert.equal(String(item.name || "").includes(rawSecret), false, `${label} file name must not contain raw marker`);
  assert.equal(
    flattenCapturedUploadItems(capture).some((candidate) => candidate.name === expected.originalName),
    false,
    `${label} must not upload the raw original file`
  );
  assertCapturedStateHasNoRawMarkers(capture, `${label} capture`, [rawSecret]);
}

async function runProtectedSiteTextFileHandoffQa(connection, page, tempDir, { matrixMode = BROWSER_QA_MATRIX_MODES.FAST } = {}) {
  const cases = getProtectedSiteTextFileCases({ matrixMode });
  const results = [];
  for (const testCase of cases) {
    const filePath = path.join(tempDir, testCase.fileName);
    fs.writeFileSync(filePath, validateBrowserQaFixtureCase(testCase));
    await resetProviderCapture(connection, page.sessionId);
    await setFileInputFiles(connection, page.sessionId, "#qa-file-input", [filePath], { verifyAssignment: false });

    const result = await waitForCapturedUpload(
      connection,
      page.sessionId,
      (item) =>
        item.name === testCase.fileName &&
        supportedFileRawMarkers(testCase).every((marker) => !String(item.text || "").includes(marker)) &&
        /\[PWM_\d+\]/.test(String(item.text || "")),
      `${testCase.label} sanitized handoff`,
      30000
    );

    assertNoRawFileFallback(result.capture, {
      browserName: "Chrome",
      siteLabel: "local protected QA page",
      adapter: "generic protected site",
      inputPath: "file input",
      stage: "raw fallback happened",
      secretCanaries: supportedFileCanaries(testCase),
      expected: "text file handoff replaces provider input with sanitized local file"
    });
    assertNoRawSecretVisible(result.capture, supportedFileCanaries(testCase), {
      browserName: "Chrome",
      siteLabel: "local protected QA page",
      adapter: "generic protected site",
      inputPath: "file input",
      stage: "sanitized handoff failed",
      secretCanaries: supportedFileCanaries(testCase),
      expected: `${testCase.label} raw canary absent from upload capture`
    });
    assertExpectedPlaceholdersVisible(result.item.text || "", 1, {
      browserName: "Chrome",
      siteLabel: "local protected QA page",
      adapter: "generic protected site",
      inputPath: "file input",
      stage: "placeholder allocation failed",
      secretCanaries: supportedFileCanaries(testCase)
    });
    assertSafeControlsVisible(result.item.text || "", [testCase.safeControlValue], {
      browserName: "Chrome",
      siteLabel: "local protected QA page",
      adapter: "generic protected site",
      inputPath: "file input",
      stage: "UI rewrite failed",
      secretCanaries: supportedFileCanaries(testCase)
    });
    assert.equal(
      String(result.item.text || "").includes("[PWM_1]"),
      true,
      `${testCase.label} should preserve an existing trusted [PWM_1] placeholder`
    );
    results.push({
      label: testCase.label,
      name: result.item.name,
      type: result.item.type,
      size: result.item.size,
      extension: testCase.extension,
      placeholderCount: (String(result.item.text || "").match(/\[PWM_\d+\]/g) || []).length,
      safeControlVisible: String(result.item.text || "").includes(testCase.safeControlValue)
    });
  }

  return results;
}

async function runProtectedSitePdfHandoffQa(connection, page, tempDir) {
  const testCase = getSupportedFileCaseByExtension(".pdf");
  const pdfPath = path.join(tempDir, testCase.fileName);
  fs.writeFileSync(pdfPath, makeQaPdf(validateBrowserQaFixtureCase(testCase)));
  await resetProviderCapture(connection, page.sessionId);
  await setFileInputFiles(connection, page.sessionId, "#qa-file-input", [pdfPath], { verifyAssignment: false });

  let result;
  try {
    result = await waitForCapturedUpload(
      connection,
      page.sessionId,
      (item) => /\.redacted\.pdf$/i.test(item.name || "") && item.type === "application/pdf",
      "protected-site PDF sanitized handoff",
      45000
    );
  } catch (error) {
    const diagnostic = await captureProviderArtifacts(connection, page.sessionId);
    if (captureHasRawFileBlockedMessage(diagnostic)) {
      assertNoRawMarkers(
        {
          pageText: diagnostic.pageText || "",
          modalText: diagnostic.modalText || "",
          overlayText: diagnostic.overlayText || "",
          panelText: diagnostic.panelText || ""
        },
        "protected-site PDF fail-closed visible state",
        supportedFileRawMarkers(testCase)
      );
      return {
        name: testCase.fileName,
        type: "application/pdf",
        blocked: true,
        rawOriginalObserved: flattenCapturedUploadItems(diagnostic).some((item) => item.name === testCase.fileName),
        blockedMessage: true
      };
    }
    throw new Error(sanitizeBrowserQaDiagnostic(`${error.message} Diagnostic: ${JSON.stringify({
      uploads: diagnostic.uploads,
      inputFiles: diagnostic.inputFiles,
      modalText: diagnostic.modalText,
      overlayText: diagnostic.overlayText,
      panelText: diagnostic.panelText
    })}`));
  }

  assertCapturedSanitizedUpload({
    item: result.item,
    capture: result.capture,
    expected: {
      name: "protected-site-pdf.redacted.pdf",
      type: "application/pdf",
      originalName: testCase.fileName
    },
    rawSecret: testCase.rawSecret,
    label: "protected-site PDF handoff"
  });
  assertCapturedStateHasNoRawMarkers(result.capture, "protected-site PDF handoff capture", supportedFileRawMarkers(testCase));
  const pdfBytes = Buffer.from(result.item.byteValues);
  assert.ok(pdfBytes.toString("latin1").startsWith("%PDF-1.4"), "protected-site PDF handoff should be a PDF");
  assertNoRawMarkers(pdfBytes, "protected-site PDF bytes", supportedFileRawMarkers(testCase));
  assertArtifactHasPlaceholder(pdfBytes, "protected-site PDF bytes");
  const extraction = await prepareFileExtractionAsync({
    fileName: result.item.name,
    mimeType: result.item.type,
    buffer: pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength)
  });
  assert.equal(extraction.status, EXTRACTOR_STATUS.OK);
  assertNoRawMarkers(extraction.text, "protected-site PDF extracted text", supportedFileRawMarkers(testCase));
  assertSafeControlsVisible(extraction.text, [testCase.safeControlValue], {
    browserName: "Chrome",
    siteLabel: "local protected QA page",
    adapter: "generic protected site",
    inputPath: "PDF",
    stage: "UI rewrite failed",
    secretCanaries: supportedFileCanaries(testCase)
  });
  assert.equal(extraction.text.includes("[PWM_1]"), true, "protected-site PDF should preserve [PWM_1]");
  assert.match(extraction.text, /\[PWM_\d+\]/);

  return {
    name: result.item.name,
    type: result.item.type,
    size: result.item.size
  };
}

async function runProtectedSiteDocxHandoffQa(connection, page, tempDir) {
  const testCase = getSupportedFileCaseByExtension(".docx");
  const docxPath = path.join(tempDir, testCase.fileName);
  fs.writeFileSync(docxPath, makeQaDocx(validateBrowserQaFixtureCase(testCase)));
  await evaluate(connection, page.sessionId, "window.__leakguardQaUploads = []");
  await setFileInputFiles(connection, page.sessionId, "#qa-file-input", [docxPath], { verifyAssignment: false });

  let result;
  try {
    result = await waitFor(
      () =>
        evaluate(
          connection,
          page.sessionId,
          `(async () => {
          const originalName = ${JSON.stringify(testCase.fileName)};
          const describeFile = async (file) => {
            const bytes = new Uint8Array(await file.arrayBuffer());
            return {
              name: file.name,
              type: file.type,
              size: file.size,
              bytePrefix: Array.from(bytes.slice(0, 12)),
              byteValues: Array.from(bytes)
            };
          };
          const uploads = [
            ...Array.from(window.__leakguardQaUploads || []),
            {
              items: await Promise.all(Array.from(document.querySelector('#qa-file-input')?.files || []).map(describeFile))
            }
          ];
          const items = uploads.flatMap((upload) => upload.items || []);
          const sanitized = items.find((item) =>
            /\\.redacted\\.docx$/i.test(item.name || '') &&
            item.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          );
          if (!sanitized) return null;
          return {
            name: sanitized.name,
            type: sanitized.type,
            size: sanitized.size,
            bytePrefix: sanitized.bytePrefix,
            byteValues: sanitized.byteValues,
            hasRawName: false,
            originalDocxPresent: items.some((item) => item.name === originalName),
            textFallbackPresent: items.some((item) => /\\.redacted\\.txt$/i.test(item.name || ''))
          };
          })()`,
          { awaitPromise: true }
        ),
      "protected-site DOCX sanitized handoff",
      30000
    );
  } catch {
    const diagnostic = await captureProviderArtifacts(connection, page.sessionId);
    throw new Error(sanitizeBrowserQaDiagnostic(`Timed out waiting for protected-site DOCX sanitized handoff. Diagnostic: ${JSON.stringify({
      uploads: diagnostic.uploads,
      inputFiles: diagnostic.inputFiles,
      modalText: diagnostic.modalText,
      overlayText: diagnostic.overlayText,
      panelText: diagnostic.panelText
    })}`));
  }

  assert.equal(result.name, "protected-site-docx.redacted.docx");
  assertNoRawMarkers(result.name, "protected-site DOCX file name", supportedFileRawMarkers(testCase));
  assert.equal(result.type, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  assert.deepEqual(result.bytePrefix.slice(0, 4), [80, 75, 3, 4], "protected-site DOCX handoff should be a ZIP/DOCX");
  assert.equal(result.hasRawName, false, "protected-site DOCX handoff must not expose raw text in file name");
  assert.equal(result.originalDocxPresent, false, "protected-site DOCX handoff must not upload the raw DOCX");
  assert.equal(result.textFallbackPresent, false, "safe protected-site DOCX regeneration should not use txt fallback");

  const docxBytes = Buffer.from(result.byteValues);
  assertNoRawMarkers(docxBytes, "protected-site DOCX bytes", supportedFileRawMarkers(testCase));
  assertArtifactHasPlaceholder(docxBytes, "protected-site DOCX bytes");
  const extraction = await prepareFileExtractionAsync({
    fileName: result.name,
    mimeType: result.type,
    buffer: docxBytes.buffer.slice(docxBytes.byteOffset, docxBytes.byteOffset + docxBytes.byteLength)
  });
  assert.equal(extraction.status, EXTRACTOR_STATUS.OK);
  assertNoRawMarkers(extraction.text, "protected-site DOCX extracted text", supportedFileRawMarkers(testCase));
  assertSafeControlsVisible(extraction.text, [testCase.safeControlValue], {
    browserName: "Chrome",
    siteLabel: "local protected QA page",
    adapter: "generic protected site",
    inputPath: "DOCX",
    stage: "UI rewrite failed",
    secretCanaries: supportedFileCanaries(testCase)
  });
  assert.equal(extraction.text.includes("[PWM_1]"), true, "protected-site DOCX should preserve [PWM_1]");
  assert.match(extraction.text, /\[PWM_\d+\]/);
  assertCapturedStateHasNoRawMarkers(await captureProviderArtifacts(connection, page.sessionId), "protected-site DOCX handoff capture", supportedFileRawMarkers(testCase));

  return {
    name: result.name,
    type: result.type,
    size: result.size
  };
}

async function runProtectedSiteXlsxHandoffQa(connection, page, tempDir) {
  const testCase = getSupportedFileCaseByExtension(".xlsx");
  const xlsxPath = path.join(tempDir, testCase.fileName);
  fs.writeFileSync(xlsxPath, makeQaXlsx(validateBrowserQaFixtureCase(testCase)));
  await evaluate(connection, page.sessionId, "window.__leakguardQaUploads = []");
  await setFileInputFiles(connection, page.sessionId, "#qa-file-input", [xlsxPath], { verifyAssignment: false });

  const result = await waitFor(
    () =>
      evaluate(
        connection,
        page.sessionId,
        `(async () => {
          const originalName = ${JSON.stringify(testCase.fileName)};
          const describeFile = async (file) => {
            const bytes = new Uint8Array(await file.arrayBuffer());
            return {
              name: file.name,
              type: file.type,
              size: file.size,
              bytePrefix: Array.from(bytes.slice(0, 12)),
              byteValues: Array.from(bytes)
            };
          };
          const uploads = [
            ...Array.from(window.__leakguardQaUploads || []),
            {
              items: await Promise.all(Array.from(document.querySelector('#qa-file-input')?.files || []).map(describeFile))
            }
          ];
          const items = uploads.flatMap((upload) => upload.items || []);
          const sanitized = items.find((item) =>
            /\\.redacted\\.xlsx$/i.test(item.name || '') &&
            item.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          );
          if (!sanitized) return null;
          return {
            name: sanitized.name,
            type: sanitized.type,
            size: sanitized.size,
            bytePrefix: sanitized.bytePrefix,
            byteValues: sanitized.byteValues,
            hasRawName: false,
            originalXlsxPresent: items.some((item) => item.name === originalName),
            textFallbackPresent: items.some((item) => /\\.redacted\\.txt$/i.test(item.name || ''))
          };
        })()`,
        { awaitPromise: true }
      ),
    "protected-site XLSX sanitized handoff",
    qaTimeoutMs
  );

  assert.equal(result.name, "protected-site-xlsx.redacted.xlsx");
  assertNoRawMarkers(result.name, "protected-site XLSX file name", supportedFileRawMarkers(testCase));
  assert.equal(result.type, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  assert.deepEqual(result.bytePrefix.slice(0, 4), [80, 75, 3, 4], "protected-site XLSX handoff should be a ZIP/XLSX");
  assert.equal(result.hasRawName, false, "protected-site XLSX handoff must not expose raw text in file name");
  assert.equal(result.originalXlsxPresent, false, "protected-site XLSX handoff must not upload the raw XLSX");
  assert.equal(result.textFallbackPresent, false, "safe protected-site XLSX regeneration should not use txt fallback");

  const xlsxBytes = Buffer.from(result.byteValues);
  const xlsxLatin1 = xlsxBytes.toString("latin1");
  assertNoRawMarkers(xlsxBytes, "protected-site XLSX bytes", supportedFileRawMarkers(testCase));
  assertArtifactHasPlaceholder(xlsxBytes, "protected-site XLSX bytes");
  for (const forbiddenPart of [
    "xl/sharedStrings.xml",
    "xl/comments",
    "docProps/",
    "customXml/",
    "xl/media/",
    "xl/calcChain.xml",
    "xl/charts",
    "<f>"
  ]) {
    assert.equal(xlsxLatin1.includes(forbiddenPart), false, `protected-site XLSX must not copy ${forbiddenPart}`);
  }

  const extraction = await prepareFileExtractionAsync({
    fileName: result.name,
    mimeType: result.type,
    buffer: xlsxBytes.buffer.slice(xlsxBytes.byteOffset, xlsxBytes.byteOffset + xlsxBytes.byteLength)
  });
  assert.equal(extraction.status, EXTRACTOR_STATUS.OK);
  assertNoRawMarkers(extraction.text, "protected-site XLSX extracted text", supportedFileRawMarkers(testCase));
  assertSafeControlsVisible(extraction.text, [testCase.safeControlValue], {
    browserName: "Chrome",
    siteLabel: "local protected QA page",
    adapter: "generic protected site",
    inputPath: "XLSX",
    stage: "UI rewrite failed",
    secretCanaries: supportedFileCanaries(testCase)
  });
  assert.equal(extraction.text.includes("[PWM_1]"), true, "protected-site XLSX should preserve [PWM_1]");
  assert.match(extraction.text, /\[PWM_\d+\]/);
  assertCapturedStateHasNoRawMarkers(await captureProviderArtifacts(connection, page.sessionId), "protected-site XLSX handoff capture", supportedFileRawMarkers(testCase));

  return {
    name: result.name,
    type: result.type,
    size: result.size
  };
}

async function runProtectedSiteFileDropHandoffQa(connection, page) {
  const rawSecret = "sk-proj-ProtectedSiteDropPdfBrowserQa1234567890abcdef";
  await resetProviderCapture(connection, page.sessionId);
  await dispatchSyntheticFileDrop(connection, page.sessionId, {
    fileName: "drop-contract.pdf",
    mimeType: "application/pdf",
    bytes: makeQaPdf(`DROP_PDF_API_KEY=${rawSecret}`)
  });

  let result;
  try {
    result = await waitForCapturedUpload(
      connection,
      page.sessionId,
      (item) => /drop-contract\.redacted\.pdf$/i.test(item.name || "") && item.type === "application/pdf",
      "protected-site PDF drop sanitized handoff",
      8000
    );
  } catch (_error) {
    const diagnostic = await waitFor(async () => {
      const capture = await captureProviderArtifacts(connection, page.sessionId);
      const text = `${capture.modalText}\n${capture.overlayText}`;
      if (/Raw file blocked|Raw file upload blocked|local file extraction did not produce safe text/i.test(text)) {
        return capture;
      }
      const items = flattenCapturedUploadItems(capture);
      if (items.length === 0 && (capture.events || []).length === 0) return capture;
      return null;
    }, "protected-site PDF drop fail-closed state", 25000);
    assertCapturedStateHasNoRawMarkers(diagnostic, "protected-site PDF drop fail-closed capture", [rawSecret]);
    assert.equal(
      flattenCapturedUploadItems(diagnostic).some((item) => item.name === "drop-contract.pdf"),
      false,
      "protected-site PDF drop must not reach the provider as a raw file"
    );
    return {
      name: "",
      type: "",
      size: 0,
      blocked: true,
      reason: "synthetic_drop_extraction_unavailable"
    };
  }
  assertCapturedSanitizedUpload({
    item: result.item,
    capture: result.capture,
    expected: {
      name: "drop-contract.redacted.pdf",
      type: "application/pdf",
      originalName: "drop-contract.pdf"
    },
    rawSecret,
    label: "protected-site PDF drop handoff"
  });
  assertNoRawMarkers(Buffer.from(result.item.byteValues), "protected-site PDF drop bytes", [rawSecret]);
  assertArtifactHasPlaceholder(Buffer.from(result.item.byteValues), "protected-site PDF drop bytes", /DROP_PDF_API_KEY=\[PWM_\d+\]/);
  return {
    name: result.item.name,
    type: result.item.type,
    size: result.item.size
  };
}

async function assertBlockedProtectedSiteUpload(connection, page, tempDir, testCase) {
  const filePath = path.join(tempDir, testCase.fileName);
  fs.writeFileSync(filePath, testCase.bytes);
  await resetProviderCapture(connection, page.sessionId);
  await setFileInputFiles(connection, page.sessionId, "#qa-file-input", [filePath], { verifyAssignment: false });
  await delay(testCase.waitMs || 1200);
  await approveRedactionModalIfPresent(connection, page.sessionId);
  const capture = await captureProviderArtifacts(connection, page.sessionId);
  const items = flattenCapturedUploadItems(capture);
  const rawOriginalObserved = items.some((item) => item.name === testCase.fileName);
  const blockedMessage = /Raw file blocked|Raw file upload blocked|blocked raw file upload/i.test(
    `${capture.modalText}\n${capture.overlayText}`
  );
  if (rawOriginalObserved && !blockedMessage) {
    assert.fail(
      sanitizeBrowserQaDiagnostic(`${testCase.label} raw original file was visible without a fail-closed block. Capture: ${JSON.stringify({
        items: items.map((item) => ({ name: item.name, type: item.type, size: item.size })),
        modalText: capture.modalText,
        overlayText: capture.overlayText,
        events: capture.events
      })}`)
    );
  }
  assert.equal(
    items.some((item) => testCase.forbiddenOutputPattern.test(item.name || "")),
    false,
    `${testCase.label} must not create an unsafe rebuilt output`
  );
  assertCapturedStateHasNoRawMarkers(capture, `${testCase.label} blocked upload capture`, [testCase.rawSecret]);
  await closeBlockingModalIfPresent(connection, page.sessionId);
  return {
    label: testCase.label,
    uploadedCount: items.length,
    rawOriginalObserved,
    blockedMessage,
    overlayText: capture.overlayText,
    modalText: capture.modalText
  };
}

function unsupportedProtectedFileBytes(testCase) {
  switch (testCase.id) {
    case "malformed-pdf":
      return Buffer.from(`not a pdf ${testCase.rawSecret}`);
    case "image-only-pdf":
      return makeQaPdf("", { imageOnly: true });
    case "malformed-docx":
      return Buffer.from(`not a docx ${testCase.rawSecret}`);
    case "malformed-xlsx":
      return Buffer.from(`not an xlsx ${testCase.rawSecret}`);
    case "unsupported-gif":
      return Buffer.concat([Buffer.from("GIF89a"), Buffer.from(testCase.rawSecret)]);
    case "unsupported-bmp":
      return Buffer.concat([Buffer.from("BM"), Buffer.from(testCase.rawSecret)]);
    case "unsupported-ico":
      return Buffer.concat([Buffer.from([0, 0, 1, 0]), Buffer.from(testCase.rawSecret)]);
    case "unsupported-svg":
      return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg"><text>${testCase.rawSecret}</text></svg>`);
    case "unsupported-unknown-binary":
      return Buffer.concat([Buffer.from([0, 255, 1, 254]), Buffer.from(testCase.rawSecret)]);
    case "encrypted-pdf":
      return makeQaPdf(testCase.rawSecret, { encrypted: true });
    default:
      return Buffer.from(`${testCase.label} ${testCase.rawSecret}`);
  }
}

async function runProtectedSiteFailureInjectionQa(
  connection,
  page,
  tempDir,
  { matrixMode = BROWSER_QA_MATRIX_MODES.FAST } = {}
) {
  const cases = getProtectedSiteUnsupportedFileCases({ matrixMode }).map((testCase) => ({
    ...testCase,
    bytes: unsupportedProtectedFileBytes(testCase)
  }));

  const results = [];
  for (const testCase of cases) {
    results.push(await assertBlockedProtectedSiteUpload(connection, page, tempDir, testCase));
  }
  return results;
}

function assertScannerResult(result) {
  assert.equal(result.hasAnyRaw, false, "scanner preview still contains raw synthetic values");
  assert.equal(result.openAiRedacted, true);
  assert.equal(result.anthropicRedacted, true);
  assert.equal(result.githubRedacted, true);
  assert.equal(result.stripeRedacted, true);
  assert.equal(result.databasePasswordRedacted, true);
  assert.equal(result.emailRedacted, true);
  assert.equal(result.publicIpRedacted, true);
  assert.equal(
    result.privateIpRedacted,
    true,
    `private IP should be redacted in scanner preview: ${sanitizeBrowserQaDiagnostic(result.preview || "")}`
  );
}

async function configureDownloadDirectory(connection, sessionId, downloadPath) {
  fs.mkdirSync(downloadPath, { recursive: true });
  try {
    await connection.send("Browser.setDownloadBehavior", {
      behavior: "allow",
      downloadPath
    });
    return;
  } catch (browserError) {
    try {
      await connection.send(
        "Page.setDownloadBehavior",
        {
          behavior: "allow",
          downloadPath
        },
        sessionId
      );
      return;
    } catch (pageError) {
      throw new Error(
        `Could not configure local download directory. Browser: ${browserError.message}; Page: ${pageError.message}`
      );
    }
  }
}

async function waitForDownloadedText(downloadPath, fileName) {
  const filePath = path.join(downloadPath, fileName);
  return await waitFor(() => {
    const entries = fs.existsSync(downloadPath) ? fs.readdirSync(downloadPath) : [];
    const partialDownload = entries.some((entry) => entry.endsWith(".crdownload") || entry.endsWith(".tmp"));
    if (!fs.existsSync(filePath) || partialDownload) return null;
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size <= 0) return null;
    return fs.readFileSync(filePath, "utf8");
  }, `scanner export download ${fileName}`);
}

async function waitForDownloadedBytes(downloadPath, fileName) {
  const filePath = path.join(downloadPath, fileName);
  return await waitFor(() => {
    const entries = fs.existsSync(downloadPath) ? fs.readdirSync(downloadPath) : [];
    const partialDownload = entries.some((entry) => entry.endsWith(".crdownload") || entry.endsWith(".tmp"));
    if (!fs.existsSync(filePath) || partialDownload) return null;
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size <= 0) return null;
    return fs.readFileSync(filePath);
  }, `scanner export download ${fileName}`);
}

async function clickDownloadAndReadText(connection, sessionId, downloadPath, selector, fileName) {
  fs.rmSync(path.join(downloadPath, fileName), { force: true });
  await evaluate(
    connection,
    sessionId,
    `document.querySelector(${JSON.stringify(selector)})?.click()`,
    { userGesture: true }
  );
  return await waitForDownloadedText(downloadPath, fileName);
}

async function clickDownloadAndReadBytes(connection, sessionId, downloadPath, selector, fileName) {
  fs.rmSync(path.join(downloadPath, fileName), { force: true });
  await evaluate(
    connection,
    sessionId,
    `document.querySelector(${JSON.stringify(selector)})?.click()`,
    { userGesture: true }
  );
  return await waitForDownloadedBytes(downloadPath, fileName);
}

async function runScannerExportQa(connection, scannerSessionId, tempDir) {
  const downloadPath = path.join(tempDir, "scanner-downloads");
  await configureDownloadDirectory(connection, scannerSessionId, downloadPath);

  const redactedText = await clickDownloadAndReadText(
    connection,
    scannerSessionId,
    downloadPath,
    "#download-redacted-btn",
    "leakguard-browser-qa.redacted.env"
  );
  assertNoRawSyntheticValues(redactedText, "scanner redacted download");
  assert.match(redactedText, /^OPENAI_API_KEY=\[PWM_\d+\]$/m);
  assert.match(redactedText, /^EMAIL_ADDRESS=\[EMAIL_\d+\]$/m);
  assert.match(redactedText, /^PUBLIC_IP=\[(PUB_HOST|NET)_\d+\]$/m);
  assert.match(redactedText, /^PRIVATE_IP=\[PRIVATE_IP_\d+\]$/m);

  const reportText = await clickDownloadAndReadText(
    connection,
    scannerSessionId,
    downloadPath,
    "#download-report-btn",
    "leakguard-browser-qa.leakguard-report.json"
  );
  assertNoRawSyntheticValues(reportText, "scanner JSON report download");
  const report = JSON.parse(reportText);
  assert.equal(report.product, "LeakGuard");
  assert.equal(report.localOnly, true);
  assert.ok(Array.isArray(report.findings));
  assert.match(report.redactedPreview || "", /\[(PWM|PUB_HOST|NET)_\d+\]/);
  assert.equal(JSON.stringify(report).includes("redactedText"), false);
}

async function runScannerQa(connection, extensionId, tempDir) {
  const scanner = await createPage(connection, `chrome-extension://${extensionId}/scanner/scanner.html`);
  await waitFor(
    () => evaluate(connection, scanner.sessionId, "Boolean(document.querySelector('#file-input'))"),
    "scanner UI"
  );
  const scannerStep = (label) => console.log(`Chrome browser QA scanner step: ${label}`);

  scannerStep("text env");
  const envPath = path.join(tempDir, "leakguard-browser-qa.env");
  fs.writeFileSync(envPath, promptPayload);
  await setFileInputFiles(connection, scanner.sessionId, "#file-input", [envPath]);
  const supported = await evaluate(
    connection,
    scanner.sessionId,
    `new Promise((resolve, reject) => {
      const rawValues = ${JSON.stringify(rawValues)};
      const started = Date.now();
      let clicked = false;
      const timer = setInterval(() => {
        const preview = document.querySelector('#redacted-preview')?.textContent || '';
        const status = document.querySelector('#status')?.textContent || '';
        const scanButton = document.querySelector('#scan-btn');
        if (!clicked && scanButton && !scanButton.disabled) {
          clicked = true;
          scanButton.click();
        }
        if (/Scan complete/i.test(status) && /\\[PWM_\\d+\\]/.test(preview)) {
          clearInterval(timer);
          resolve({
            status,
            hasAnyRaw: rawValues.some((raw) => preview.includes(raw)),
            openAiRedacted: /^OPENAI_API_KEY=\\[PWM_\\d+\\]$/m.test(preview),
            anthropicRedacted: /^ANTHROPIC_API_KEY=\\[PWM_\\d+\\]$/m.test(preview),
            githubRedacted: /^GITHUB_TOKEN=\\[PWM_\\d+\\]$/m.test(preview),
            stripeRedacted: /^STRIPE_SECRET_KEY=\\[PWM_\\d+\\]$/m.test(preview),
            databasePasswordRedacted:
              /^DATABASE_URL=postgres:\\/\\/admin:\\[PWM_\\d+\\]@db\\.example\\.com:5432\\/customerdb$/m
                .test(preview),
            emailRedacted: /^EMAIL_ADDRESS=\\[EMAIL_\\d+\\]$/m.test(preview),
            publicIpRedacted: /PUBLIC_IP=\\[(PUB_HOST|NET)_\\d+\\]/.test(preview),
            privateIpRedacted: /^PRIVATE_IP=\\[PRIVATE_IP_\\d+\\]$/m.test(preview)
          });
        } else if (Date.now() - started > 15000) {
          clearInterval(timer);
          reject(new Error('Timed out waiting for scanner result: ' + JSON.stringify({
            status,
            scanDisabled: scanButton?.disabled,
            fileName: document.querySelector('#file-name')?.textContent || '',
            fileType: document.querySelector('#file-type')?.textContent || '',
            inputFiles: Array.from(document.querySelector('#file-input')?.files || []).map((file) => ({
              name: file.name,
              type: file.type,
              size: file.size
            })),
            preview
          })));
        }
      }, 50);
    })`
  );
  assertScannerResult(supported);
  await runScannerExportQa(connection, scanner.sessionId, tempDir);

  await evaluate(connection, scanner.sessionId, "document.querySelector('#clear-btn').click()");
  await waitFor(
    () => evaluate(connection, scanner.sessionId, "document.querySelector('#scan-btn')?.disabled"),
    "scanner reset"
  );

  scannerStep("PDF rebuilt download");
  const textPdfPath = path.join(tempDir, "leakguard-browser-qa-text.pdf");
  fs.writeFileSync(textPdfPath, makeQaPdf(`PDF_API_KEY=${syntheticSecrets.openAi}`));
  await setFileInputFiles(connection, scanner.sessionId, "#file-input", [textPdfPath]);
  const textPdf = await evaluate(
    connection,
    scanner.sessionId,
    `new Promise((resolve, reject) => {
      const rawSecret = ${JSON.stringify(syntheticSecrets.openAi)};
      const started = Date.now();
      let clicked = false;
      const timer = setInterval(() => {
        const preview = document.querySelector('#redacted-preview')?.textContent || '';
        const status = document.querySelector('#status')?.textContent || '';
        const scanButton = document.querySelector('#scan-btn');
        if (!clicked && scanButton && !scanButton.disabled) {
          clicked = true;
          scanButton.click();
        }
        if (/Scan complete/i.test(status) && /PDF_API_KEY=\\[PWM_\\d+\\]/.test(preview)) {
          clearInterval(timer);
          resolve({
            status,
            hasRaw: preview.includes(rawSecret),
            redacted: /PDF_API_KEY=\\[PWM_\\d+\\]/.test(preview)
          });
        } else if (Date.now() - started > 15000) {
          clearInterval(timer);
          reject(new Error('Timed out waiting for PDF scanner result: ' + JSON.stringify({
            status,
            scanDisabled: scanButton?.disabled,
            preview
          })));
        }
      }, 50);
    })`
  );
  assert.equal(textPdf.hasRaw, false, "scanner PDF preview must not expose raw PDF secrets");
  assert.equal(textPdf.redacted, true, "scanner should redact text PDF findings");

  const pdfDownloadPath = path.join(tempDir, "scanner-pdf-downloads");
  await configureDownloadDirectory(connection, scanner.sessionId, pdfDownloadPath);
  const pdfExportState = await evaluate(
    connection,
    scanner.sessionId,
    `({
      pdfAvailable: !document.querySelector('#download-redacted-pdf-btn')?.disabled &&
        !document.querySelector('#download-redacted-pdf-btn')?.hidden,
      textAvailable: !document.querySelector('#download-redacted-btn')?.disabled
    })`
  );
  assert.equal(pdfExportState.pdfAvailable, true, "scanner should offer regenerated redacted PDF for text PDFs");
  assert.equal(pdfExportState.textAvailable, true, "scanner should keep .redacted.txt available for text PDFs");

  const redactedPdfBytes = await clickDownloadAndReadBytes(
    connection,
    scanner.sessionId,
    pdfDownloadPath,
    "#download-redacted-pdf-btn",
    "leakguard-browser-qa-text.redacted.pdf"
  );
  const redactedPdfLatin1 = redactedPdfBytes.toString("latin1");
  assert.ok(redactedPdfBytes.byteLength > 0, "scanner redacted PDF download should be non-empty");
  assert.ok(redactedPdfLatin1.startsWith("%PDF-1.4"), "scanner redacted PDF should be a regenerated PDF");
  assert.equal(redactedPdfLatin1.includes(syntheticSecrets.openAi), false, "scanner redacted PDF bytes must not contain raw PDF secret");
  assert.match(redactedPdfLatin1, /PDF_API_KEY=\[PWM_\d+\]/);

  const redactedPdfExtraction = await prepareFileExtractionAsync({
    fileName: "leakguard-browser-qa-text.redacted.pdf",
    mimeType: "application/pdf",
    buffer: redactedPdfBytes.buffer.slice(redactedPdfBytes.byteOffset, redactedPdfBytes.byteOffset + redactedPdfBytes.byteLength)
  });
  assert.equal(redactedPdfExtraction.status, EXTRACTOR_STATUS.OK);
  assert.equal(redactedPdfExtraction.text.includes(syntheticSecrets.openAi), false, "scanner redacted PDF text must not contain raw PDF secret");
  assert.match(redactedPdfExtraction.text, /PDF_API_KEY=\[PWM_\d+\]/);

  const pdfRedactedText = await clickDownloadAndReadText(
    connection,
    scanner.sessionId,
    pdfDownloadPath,
    "#download-redacted-btn",
    "leakguard-browser-qa-text.redacted.txt"
  );
  assert.equal(pdfRedactedText.includes(syntheticSecrets.openAi), false, "scanner PDF .redacted.txt fallback must not expose raw secret");
  assert.match(pdfRedactedText, /^PDF_API_KEY=\[PWM_\d+\]$/m);

  const pdfReportText = await clickDownloadAndReadText(
    connection,
    scanner.sessionId,
    pdfDownloadPath,
    "#download-report-btn",
    "leakguard-browser-qa-text.leakguard-report.json"
  );
  assert.equal(pdfReportText.includes(syntheticSecrets.openAi), false, "scanner PDF JSON report must not expose raw secret");
  const pdfReport = JSON.parse(pdfReportText);
  assert.equal(JSON.stringify(pdfReport).includes("redactedText"), false);
  assert.match(pdfReport.redactedPreview || "", /PDF_API_KEY=\[PWM_\d+\]/);

  await evaluate(connection, scanner.sessionId, "document.querySelector('#clear-btn').click()");
  await waitFor(
    () => evaluate(connection, scanner.sessionId, "document.querySelector('#scan-btn')?.disabled"),
    "scanner reset after text PDF"
  );

  scannerStep("DOCX rebuilt download");
  const textDocxPath = path.join(tempDir, "leakguard-browser-qa-text.docx");
  fs.writeFileSync(textDocxPath, makeQaDocx(`DOCX_API_KEY=${syntheticSecrets.openAi}`));
  await setFileInputFiles(connection, scanner.sessionId, "#file-input", [textDocxPath]);
  const textDocx = await evaluate(
    connection,
    scanner.sessionId,
    `new Promise((resolve, reject) => {
      const rawSecret = ${JSON.stringify(syntheticSecrets.openAi)};
      const started = Date.now();
      let clicked = false;
      const timer = setInterval(() => {
        const preview = document.querySelector('#redacted-preview')?.textContent || '';
        const status = document.querySelector('#status')?.textContent || '';
        const scanButton = document.querySelector('#scan-btn');
        if (!clicked && scanButton && !scanButton.disabled) {
          clicked = true;
          scanButton.click();
        }
        if (/Scan complete/i.test(status) && /DOCX_API_KEY=\\[PWM_\\d+\\]/.test(preview)) {
          clearInterval(timer);
          resolve({
            status,
            hasRaw: preview.includes(rawSecret),
            redacted: /DOCX_API_KEY=\\[PWM_\\d+\\]/.test(preview)
          });
        } else if (Date.now() - started > 15000) {
          clearInterval(timer);
          reject(new Error('Timed out waiting for DOCX scanner result: ' + JSON.stringify({
            status,
            scanDisabled: scanButton?.disabled,
            preview
          })));
        }
      }, 50);
    })`
  );
  assert.equal(textDocx.hasRaw, false, "scanner DOCX preview must not expose raw DOCX secrets");
  assert.equal(textDocx.redacted, true, "scanner should redact text DOCX findings");

  const docxDownloadPath = path.join(tempDir, "scanner-docx-downloads");
  await configureDownloadDirectory(connection, scanner.sessionId, docxDownloadPath);
  const docxExportState = await evaluate(
    connection,
    scanner.sessionId,
    `({
      docxAvailable: !document.querySelector('#download-redacted-docx-btn')?.disabled &&
        !document.querySelector('#download-redacted-docx-btn')?.hidden,
      textAvailable: !document.querySelector('#download-redacted-btn')?.disabled
    })`
  );
  assert.equal(docxExportState.docxAvailable, true, "scanner should offer regenerated redacted DOCX for text DOCX files");
  assert.equal(docxExportState.textAvailable, true, "scanner should keep .redacted.txt available for DOCX files");

  const redactedDocxBytes = await clickDownloadAndReadBytes(
    connection,
    scanner.sessionId,
    docxDownloadPath,
    "#download-redacted-docx-btn",
    "leakguard-browser-qa-text.redacted.docx"
  );
  const redactedDocxLatin1 = redactedDocxBytes.toString("latin1");
  assert.ok(redactedDocxBytes.byteLength > 0, "scanner redacted DOCX download should be non-empty");
  assert.equal(redactedDocxLatin1.includes(syntheticSecrets.openAi), false, "scanner redacted DOCX bytes must not contain raw DOCX secret");
  assert.equal(redactedDocxLatin1.includes("DOCX_API_KEY=[PWM_"), true, "scanner redacted DOCX should contain sanitized text only");
  assert.equal(redactedDocxLatin1.includes("word/header"), false, "scanner redacted DOCX should not copy original header parts");
  assert.equal(redactedDocxLatin1.includes("word/footer"), false, "scanner redacted DOCX should not copy original footer parts");

  const redactedDocxExtraction = await prepareFileExtractionAsync({
    fileName: "leakguard-browser-qa-text.redacted.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: redactedDocxBytes.buffer.slice(redactedDocxBytes.byteOffset, redactedDocxBytes.byteOffset + redactedDocxBytes.byteLength)
  });
  assert.equal(redactedDocxExtraction.status, EXTRACTOR_STATUS.OK);
  assert.equal(redactedDocxExtraction.text.includes(syntheticSecrets.openAi), false, "scanner redacted DOCX text must not contain raw DOCX secret");
  assert.match(redactedDocxExtraction.text, /DOCX_API_KEY=\[PWM_\d+\]/);

  const docxRedactedText = await clickDownloadAndReadText(
    connection,
    scanner.sessionId,
    docxDownloadPath,
    "#download-redacted-btn",
    "leakguard-browser-qa-text.redacted.txt"
  );
  assert.equal(docxRedactedText.includes(syntheticSecrets.openAi), false, "scanner DOCX .redacted.txt fallback must not expose raw secret");
  assert.match(docxRedactedText, /^DOCX_API_KEY=\[PWM_\d+\]$/m);

  const docxReportText = await clickDownloadAndReadText(
    connection,
    scanner.sessionId,
    docxDownloadPath,
    "#download-report-btn",
    "leakguard-browser-qa-text.leakguard-report.json"
  );
  assert.equal(docxReportText.includes(syntheticSecrets.openAi), false, "scanner DOCX JSON report must not expose raw secret");
  const docxReport = JSON.parse(docxReportText);
  assert.equal(JSON.stringify(docxReport).includes("redactedText"), false);
  assert.match(docxReport.redactedPreview || "", /DOCX_API_KEY=\[PWM_\d+\]/);

  await evaluate(connection, scanner.sessionId, "document.querySelector('#clear-btn').click()");
  await waitFor(
    () => evaluate(connection, scanner.sessionId, "document.querySelector('#scan-btn')?.disabled"),
    "scanner reset after text DOCX"
  );

  scannerStep("XLSX rebuilt download");
  const textXlsxPath = path.join(tempDir, "leakguard-browser-qa-text.xlsx");
  fs.writeFileSync(textXlsxPath, makeQaXlsx(`XLSX_API_KEY=${syntheticSecrets.openAi}`));
  await setFileInputFiles(connection, scanner.sessionId, "#file-input", [textXlsxPath]);
  const textXlsx = await evaluate(
    connection,
    scanner.sessionId,
    `new Promise((resolve, reject) => {
      const rawSecret = ${JSON.stringify(syntheticSecrets.openAi)};
      const started = Date.now();
      let clicked = false;
      const timer = setInterval(() => {
        const preview = document.querySelector('#redacted-preview')?.textContent || '';
        const status = document.querySelector('#status')?.textContent || '';
        const scanButton = document.querySelector('#scan-btn');
        if (!clicked && scanButton && !scanButton.disabled) {
          clicked = true;
          scanButton.click();
        }
        if (/Scan complete/i.test(status) && /XLSX_API_KEY=\\[PWM_\\d+\\]/.test(preview)) {
          clearInterval(timer);
          resolve({
            status,
            hasRaw: preview.includes(rawSecret),
            redacted: /XLSX_API_KEY=\\[PWM_\\d+\\]/.test(preview)
          });
        } else if (Date.now() - started > 15000) {
          clearInterval(timer);
          reject(new Error('Timed out waiting for XLSX scanner result: ' + JSON.stringify({
            status,
            scanDisabled: scanButton?.disabled,
            preview
          })));
        }
      }, 50);
    })`
  );
  assert.equal(textXlsx.hasRaw, false, "scanner XLSX preview must not expose raw XLSX secrets");
  assert.equal(textXlsx.redacted, true, "scanner should redact text XLSX findings");

  const xlsxDownloadPath = path.join(tempDir, "scanner-xlsx-downloads");
  await configureDownloadDirectory(connection, scanner.sessionId, xlsxDownloadPath);
  const xlsxExportState = await evaluate(
    connection,
    scanner.sessionId,
    `({
      xlsxAvailable: !document.querySelector('#download-redacted-xlsx-btn')?.disabled &&
        !document.querySelector('#download-redacted-xlsx-btn')?.hidden,
      textAvailable: !document.querySelector('#download-redacted-btn')?.disabled
    })`
  );
  assert.equal(xlsxExportState.xlsxAvailable, true, "scanner should offer regenerated redacted XLSX for text XLSX files");
  assert.equal(xlsxExportState.textAvailable, true, "scanner should keep .redacted.txt available for XLSX files");

  const redactedXlsxBytes = await clickDownloadAndReadBytes(
    connection,
    scanner.sessionId,
    xlsxDownloadPath,
    "#download-redacted-xlsx-btn",
    "leakguard-browser-qa-text.redacted.xlsx"
  );
  const redactedXlsxLatin1 = redactedXlsxBytes.toString("latin1");
  assert.ok(redactedXlsxBytes.byteLength > 0, "scanner redacted XLSX download should be non-empty");
  assert.equal(redactedXlsxLatin1.includes(syntheticSecrets.openAi), false, "scanner redacted XLSX bytes must not contain raw XLSX secret");
  assert.equal(redactedXlsxLatin1.includes("XLSX_API_KEY=[PWM_"), true, "scanner redacted XLSX should contain sanitized text only");
  assert.equal(redactedXlsxLatin1.includes("xl/sharedStrings.xml"), false, "scanner redacted XLSX should not copy original shared strings");
  assert.equal(redactedXlsxLatin1.includes("xl/comments"), false, "scanner redacted XLSX should not copy original comments");
  assert.equal(redactedXlsxLatin1.includes("docProps/"), false, "scanner redacted XLSX should not copy original metadata");
  assert.equal(redactedXlsxLatin1.includes("customXml/"), false, "scanner redacted XLSX should not copy custom XML");
  assert.equal(redactedXlsxLatin1.includes("xl/media/"), false, "scanner redacted XLSX should not copy media");

  const redactedXlsxExtraction = await prepareFileExtractionAsync({
    fileName: "leakguard-browser-qa-text.redacted.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: redactedXlsxBytes.buffer.slice(redactedXlsxBytes.byteOffset, redactedXlsxBytes.byteOffset + redactedXlsxBytes.byteLength)
  });
  assert.equal(redactedXlsxExtraction.status, EXTRACTOR_STATUS.OK);
  assert.equal(redactedXlsxExtraction.text.includes(syntheticSecrets.openAi), false, "scanner redacted XLSX text must not contain raw XLSX secret");
  assert.match(redactedXlsxExtraction.text, /XLSX_API_KEY=\[PWM_\d+\]/);

  const xlsxRedactedText = await clickDownloadAndReadText(
    connection,
    scanner.sessionId,
    xlsxDownloadPath,
    "#download-redacted-btn",
    "leakguard-browser-qa-text.redacted.txt"
  );
  assert.equal(xlsxRedactedText.includes(syntheticSecrets.openAi), false, "scanner XLSX .redacted.txt fallback must not expose raw secret");
  assert.match(xlsxRedactedText, /^XLSX_API_KEY=\[PWM_\d+\]$/m);

  const xlsxReportText = await clickDownloadAndReadText(
    connection,
    scanner.sessionId,
    xlsxDownloadPath,
    "#download-report-btn",
    "leakguard-browser-qa-text.leakguard-report.json"
  );
  assert.equal(xlsxReportText.includes(syntheticSecrets.openAi), false, "scanner XLSX JSON report must not expose raw secret");
  const xlsxReport = JSON.parse(xlsxReportText);
  assert.equal(JSON.stringify(xlsxReport).includes("redactedText"), false);
  assert.match(xlsxReport.redactedPreview || "", /XLSX_API_KEY=\[PWM_\d+\]/);

  await evaluate(connection, scanner.sessionId, "document.querySelector('#clear-btn').click()");
  await waitFor(
    () => evaluate(connection, scanner.sessionId, "document.querySelector('#scan-btn')?.disabled"),
    "scanner reset after text XLSX"
  );

  scannerStep("image metadata fallback");
  const imageSecretName = `image-${syntheticSecrets.openAi}.png`;
  const imageSecretPath = path.join(tempDir, imageSecretName);
  fs.writeFileSync(imageSecretPath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  await setFileInputFiles(connection, scanner.sessionId, "#file-input", [imageSecretPath]);
  const imageMetadata = await evaluate(
    connection,
    scanner.sessionId,
    `new Promise((resolve, reject) => {
      const rawSecret = ${JSON.stringify(syntheticSecrets.openAi)};
      const started = Date.now();
      let clicked = false;
      const timer = setInterval(() => {
        const preview = document.querySelector('#redacted-preview')?.textContent || '';
        const status = document.querySelector('#status')?.textContent || '';
        const scanButton = document.querySelector('#scan-btn');
        if (!clicked && scanButton && !scanButton.disabled) {
          clicked = true;
          scanButton.click();
        }
        if (/Image metadata scanned/i.test(status) && /Visible text inside the image was not scanned/i.test(status) && /file_name=image-\\[PWM_\\d+\\]\\.png/.test(preview)) {
          clearInterval(timer);
          resolve({
            status,
            hasRaw: preview.includes(rawSecret),
            redacted: /file_name=image-\\[PWM_\\d+\\]\\.png/.test(preview),
            noOcrClaim: /visual_text_scanned=false/.test(preview),
            ocrFailedSafely: /English OCR did not complete/i.test(status)
          });
        } else if (Date.now() - started > 15000) {
          clearInterval(timer);
          reject(new Error('Timed out waiting for image metadata scanner result: ' + JSON.stringify({
            status,
            scanDisabled: scanButton?.disabled,
            preview
          })));
        }
      }, 50);
    })`
  );
  assert.equal(imageMetadata.hasRaw, false, "scanner image metadata preview must not expose raw filename secrets");
  assert.equal(imageMetadata.redacted, true, "scanner should redact image filename metadata findings");
  assert.equal(imageMetadata.noOcrClaim, true, "scanner should mark visual text as unscanned");
  assert.equal(imageMetadata.ocrFailedSafely, true, "scanner should not treat invalid-image OCR failure as a visual-text scan");

  await evaluate(connection, scanner.sessionId, "document.querySelector('#clear-btn').click()");
  await waitFor(
    () => evaluate(connection, scanner.sessionId, "document.querySelector('#scan-btn')?.disabled"),
    "scanner reset after image metadata"
  );

  scannerStep("image OCR redacted PNG");
  const scannerOcrSecret = "LeakGuardScannerSecret12345";
  const scannerOcrImagePath = path.join(tempDir, "scanner-ocr.png");
  fs.writeFileSync(
    scannerOcrImagePath,
    await makeSyntheticTextImage(`PASSWORD=${scannerOcrSecret}`, "png", {
      width: 1800,
      height: 280,
      fontSize: 72,
      textY: 170
    })
  );
  await setFileInputFiles(connection, scanner.sessionId, "#file-input", [scannerOcrImagePath]);
  const scannerOcrImage = await evaluate(
    connection,
    scanner.sessionId,
    `new Promise((resolve, reject) => {
      const rawSecret = ${JSON.stringify(scannerOcrSecret)};
      const started = Date.now();
      let clicked = false;
      const timer = setInterval(() => {
        const preview = document.querySelector('#redacted-preview')?.textContent || '';
        const status = document.querySelector('#status')?.textContent || '';
        const scanButton = document.querySelector('#scan-btn');
        const imageButton = document.querySelector('#download-redacted-image-btn');
        if (!clicked && scanButton && !scanButton.disabled) {
          clicked = true;
          scanButton.click();
        }
        if (/flattened redacted PNG/i.test(status) && /PASSWORD=\\[PWM_\\d+\\]/.test(preview) && imageButton && !imageButton.disabled && !imageButton.hidden) {
          clearInterval(timer);
          resolve({
            status,
            preview,
            hasRaw: preview.includes(rawSecret),
            imageAvailable: true,
            textAvailable: !document.querySelector('#download-redacted-btn')?.disabled
          });
        } else if (Date.now() - started > 30000) {
          clearInterval(timer);
          reject(new Error('Timed out waiting for scanner OCR image result: ' + JSON.stringify({
            status,
            scanDisabled: scanButton?.disabled,
            imageDisabled: imageButton?.disabled,
            imageHidden: imageButton?.hidden,
            preview
          })));
        }
      }, 50);
    })`
  );
  assert.equal(scannerOcrImage.hasRaw, false, "scanner OCR preview must not expose raw image text secret");
  assert.equal(scannerOcrImage.imageAvailable, true, "scanner should offer flattened redacted PNG when OCR boxes are usable");
  assert.equal(scannerOcrImage.textAvailable, true, "scanner OCR should keep .redacted.txt available");

  const imageDownloadPath = path.join(tempDir, "scanner-image-downloads");
  await configureDownloadDirectory(connection, scanner.sessionId, imageDownloadPath);
  const redactedImageBytes = await clickDownloadAndReadBytes(
    connection,
    scanner.sessionId,
    imageDownloadPath,
    "#download-redacted-image-btn",
    "scanner-ocr.redacted.png"
  );
  assert.deepEqual(
    Array.from(redactedImageBytes.subarray(0, 8)),
    [137, 80, 78, 71, 13, 10, 26, 10],
    "scanner redacted image download should be a PNG"
  );
  assertNoRawMarkers(redactedImageBytes, "scanner redacted PNG download", [scannerOcrSecret]);

  const imageRedactedText = await clickDownloadAndReadText(
    connection,
    scanner.sessionId,
    imageDownloadPath,
    "#download-redacted-btn",
    "scanner-ocr.redacted.txt"
  );
  assertNoRawMarkers(imageRedactedText, "scanner OCR .redacted.txt download", [scannerOcrSecret]);
  assert.match(imageRedactedText, /^PASSWORD=\[PWM_\d+\]$/m);

  const imageReportText = await clickDownloadAndReadText(
    connection,
    scanner.sessionId,
    imageDownloadPath,
    "#download-report-btn",
    "scanner-ocr.leakguard-report.json"
  );
  assertNoRawMarkers(imageReportText, "scanner OCR JSON report download", [scannerOcrSecret]);
  const imageReport = JSON.parse(imageReportText);
  assert.equal(JSON.stringify(imageReport).includes("redactedText"), false);
  assert.match(imageReport.redactedPreview || "", /PASSWORD=\[PWM_\d+\]/);

  await evaluate(connection, scanner.sessionId, "document.querySelector('#clear-btn').click()");
  await waitFor(
    () => evaluate(connection, scanner.sessionId, "document.querySelector('#scan-btn')?.disabled"),
    "scanner reset after OCR image"
  );

  scannerStep("unsupported DOCX");
  const unsupportedDocxPath = path.join(tempDir, "leakguard-browser-qa-image-only.docx");
  fs.writeFileSync(unsupportedDocxPath, makeQaDocx("", { imageOnly: true }));
  await setFileInputFiles(connection, scanner.sessionId, "#file-input", [unsupportedDocxPath]);
  const unsupportedDocx = await evaluate(
    connection,
    scanner.sessionId,
    `new Promise((resolve, reject) => {
      const started = Date.now();
      let clicked = false;
      const timer = setInterval(() => {
        const status = document.querySelector('#status')?.textContent || '';
        const preview = document.querySelector('#redacted-preview')?.textContent || '';
        const scanButton = document.querySelector('#scan-btn');
        if (!clicked && scanButton && !scanButton.disabled) {
          clicked = true;
          scanButton.click();
        }
        if (/could not find extractable text/i.test(status) && /Embedded images, macros, and OCR are not supported/i.test(status)) {
          clearInterval(timer);
          const docxButton = document.querySelector('#download-redacted-docx-btn');
          resolve({
            status,
            preview,
            docxAvailable: !docxButton?.disabled && !docxButton?.hidden
          });
        } else if (Date.now() - started > 10000) {
          clearInterval(timer);
          reject(new Error('Timed out waiting for unsupported DOCX warning: ' + JSON.stringify({
            status,
            scanDisabled: scanButton?.disabled,
            preview
          })));
        }
      }, 50);
    })`
  );
  assert.match(unsupportedDocx.status, /could not find extractable text/i);
  assert.match(unsupportedDocx.status, /Embedded images, macros, and OCR are not supported/i);
  assert.equal(unsupportedDocx.preview, "");
  assert.equal(unsupportedDocx.docxAvailable, false, "scanner must not offer redacted DOCX for image-only DOCX files");

  await evaluate(connection, scanner.sessionId, "document.querySelector('#clear-btn').click()");
  await waitFor(
    () => evaluate(connection, scanner.sessionId, "document.querySelector('#scan-btn')?.disabled"),
    "scanner reset after unsupported DOCX"
  );

  scannerStep("malformed DOCX");
  const malformedDocxPath = path.join(tempDir, "leakguard-browser-qa-malformed.docx");
  fs.writeFileSync(malformedDocxPath, "not a docx with DOCX_MALFORMED_KEY=raw");
  await setFileInputFiles(connection, scanner.sessionId, "#file-input", [malformedDocxPath]);
  const malformedDocx = await evaluate(
    connection,
    scanner.sessionId,
    `new Promise((resolve, reject) => {
      const rawText = 'DOCX_MALFORMED_KEY=raw';
      const started = Date.now();
      let clicked = false;
      const timer = setInterval(() => {
        const status = document.querySelector('#status')?.textContent || '';
        const preview = document.querySelector('#redacted-preview')?.textContent || '';
        const scanButton = document.querySelector('#scan-btn');
        const docxButton = document.querySelector('#download-redacted-docx-btn');
        if (!clicked && scanButton && !scanButton.disabled) {
          clicked = true;
          scanButton.click();
        }
        if (/could not read this DOCX/i.test(status)) {
          clearInterval(timer);
          resolve({
            status,
            preview,
            hasRaw: preview.includes(rawText) || status.includes(rawText),
            docxAvailable: !docxButton?.disabled && !docxButton?.hidden
          });
        } else if (Date.now() - started > 10000) {
          clearInterval(timer);
          reject(new Error('Timed out waiting for malformed DOCX warning: ' + JSON.stringify({
            status,
            scanDisabled: scanButton?.disabled,
            preview
          })));
        }
      }, 50);
    })`
  );
  assert.match(malformedDocx.status, /could not read this DOCX/i);
  assert.equal(malformedDocx.preview, "");
  assert.equal(malformedDocx.hasRaw, false, "malformed DOCX scanner warning must not expose raw bytes");
  assert.equal(malformedDocx.docxAvailable, false, "scanner must not offer redacted DOCX for malformed DOCX files");

  await evaluate(connection, scanner.sessionId, "document.querySelector('#clear-btn').click()");
  await waitFor(
    () => evaluate(connection, scanner.sessionId, "document.querySelector('#scan-btn')?.disabled"),
    "scanner reset after malformed DOCX"
  );

  scannerStep("malformed XLSX");
  const malformedXlsxPath = path.join(tempDir, "leakguard-browser-qa-malformed.xlsx");
  fs.writeFileSync(malformedXlsxPath, "not an xlsx with XLSX_MALFORMED_KEY=raw");
  await setFileInputFiles(connection, scanner.sessionId, "#file-input", [malformedXlsxPath]);
  const malformedXlsx = await evaluate(
    connection,
    scanner.sessionId,
    `new Promise((resolve, reject) => {
      const rawText = 'XLSX_MALFORMED_KEY=raw';
      const started = Date.now();
      let clicked = false;
      const timer = setInterval(() => {
        const status = document.querySelector('#status')?.textContent || '';
        const preview = document.querySelector('#redacted-preview')?.textContent || '';
        const scanButton = document.querySelector('#scan-btn');
        const xlsxButton = document.querySelector('#download-redacted-xlsx-btn');
        if (!clicked && scanButton && !scanButton.disabled) {
          clicked = true;
          scanButton.click();
        }
        if (/could not read this XLSX/i.test(status)) {
          clearInterval(timer);
          resolve({
            status,
            preview,
            hasRaw: preview.includes(rawText) || status.includes(rawText),
            xlsxAvailable: !xlsxButton?.disabled && !xlsxButton?.hidden
          });
        } else if (Date.now() - started > 10000) {
          clearInterval(timer);
          reject(new Error('Timed out waiting for malformed XLSX warning: ' + JSON.stringify({
            status,
            scanDisabled: scanButton?.disabled,
            preview
          })));
        }
      }, 50);
    })`
  );
  assert.match(malformedXlsx.status, /could not read this XLSX/i);
  assert.equal(malformedXlsx.preview, "");
  assert.equal(malformedXlsx.hasRaw, false, "malformed XLSX scanner warning must not expose raw bytes");
  assert.equal(malformedXlsx.xlsxAvailable, false, "scanner must not offer redacted XLSX for malformed XLSX files");

  await evaluate(connection, scanner.sessionId, "document.querySelector('#clear-btn').click()");
  await waitFor(
    () => evaluate(connection, scanner.sessionId, "document.querySelector('#scan-btn')?.disabled"),
    "scanner reset after malformed XLSX"
  );

  scannerStep("image-only PDF");
  const unsupportedPath = path.join(tempDir, "leakguard-browser-qa-image-only.pdf");
  fs.writeFileSync(unsupportedPath, makeQaPdf("", { imageOnly: true }));
  await setFileInputFiles(connection, scanner.sessionId, "#file-input", [unsupportedPath]);
  const unsupported = await evaluate(
    connection,
    scanner.sessionId,
    `new Promise((resolve, reject) => {
      const started = Date.now();
      let clicked = false;
      const timer = setInterval(() => {
        const status = document.querySelector('#status')?.textContent || '';
        const preview = document.querySelector('#redacted-preview')?.textContent || '';
        const scanDisabled = document.querySelector('#scan-btn')?.disabled;
        const scanButton = document.querySelector('#scan-btn');
        const pdfButton = document.querySelector('#download-redacted-pdf-btn');
        if (!clicked && scanButton && !scanButton.disabled) {
          clicked = true;
          scanButton.click();
        }
        if (/could not find extractable text/i.test(status) && /OCR are not supported/i.test(status)) {
          clearInterval(timer);
          resolve({ status, scanDisabled, preview, pdfAvailable: !pdfButton?.disabled && !pdfButton?.hidden });
        } else if (Date.now() - started > 10000) {
          clearInterval(timer);
          reject(new Error('Timed out waiting for unsupported PDF warning: ' + JSON.stringify({
            status,
            scanDisabled,
            preview
          })));
        }
      }, 50);
    })`
  );
  assert.match(unsupported.status, /could not find extractable text/i);
  assert.match(unsupported.status, /OCR are not supported/i);
  assert.equal(unsupported.preview, "");
  assert.equal(unsupported.pdfAvailable, false, "scanner must not offer redacted PDF for scanned/image-only PDFs");

  await evaluate(connection, scanner.sessionId, "document.querySelector('#clear-btn').click()");
  await waitFor(
    () => evaluate(connection, scanner.sessionId, "document.querySelector('#scan-btn')?.disabled"),
    "scanner reset after unsupported PDF"
  );

  scannerStep("empty PDF");
  const emptyPdfPath = path.join(tempDir, "leakguard-browser-qa-empty.pdf");
  fs.writeFileSync(emptyPdfPath, makeQaPdf(""));
  await setFileInputFiles(connection, scanner.sessionId, "#file-input", [emptyPdfPath]);
  const emptyPdf = await evaluate(
    connection,
    scanner.sessionId,
    `new Promise((resolve, reject) => {
      const started = Date.now();
      let clicked = false;
      const timer = setInterval(() => {
        const status = document.querySelector('#status')?.textContent || '';
        const preview = document.querySelector('#redacted-preview')?.textContent || '';
        const scanButton = document.querySelector('#scan-btn');
        const pdfButton = document.querySelector('#download-redacted-pdf-btn');
        if (!clicked && scanButton && !scanButton.disabled) {
          clicked = true;
          scanButton.click();
        }
        if (/could not find extractable text/i.test(status) && /OCR are not supported/i.test(status)) {
          clearInterval(timer);
          resolve({ status, preview, pdfAvailable: !pdfButton?.disabled && !pdfButton?.hidden });
        } else if (Date.now() - started > 10000) {
          clearInterval(timer);
          reject(new Error('Timed out waiting for empty PDF warning: ' + JSON.stringify({
            status,
            scanDisabled: scanButton?.disabled,
            preview
          })));
        }
      }, 50);
    })`
  );
  assert.match(emptyPdf.status, /could not find extractable text/i);
  assert.equal(emptyPdf.preview, "");
  assert.equal(emptyPdf.pdfAvailable, false, "scanner must not offer redacted PDF for empty PDFs");

  await evaluate(connection, scanner.sessionId, "document.querySelector('#clear-btn').click()");
  await waitFor(
    () => evaluate(connection, scanner.sessionId, "document.querySelector('#scan-btn')?.disabled"),
    "scanner reset after empty PDF"
  );

  scannerStep("encrypted PDF");
  const encryptedPath = path.join(tempDir, "leakguard-browser-qa-encrypted.pdf");
  fs.writeFileSync(encryptedPath, makeQaPdf(`PDF_ENCRYPTED_KEY=${syntheticSecrets.openAi}`, { encrypted: true }));
  await setFileInputFiles(connection, scanner.sessionId, "#file-input", [encryptedPath]);
  const encrypted = await evaluate(
    connection,
    scanner.sessionId,
    `new Promise((resolve, reject) => {
      const rawSecret = ${JSON.stringify(syntheticSecrets.openAi)};
      const started = Date.now();
      let clicked = false;
      const timer = setInterval(() => {
        const status = document.querySelector('#status')?.textContent || '';
        const preview = document.querySelector('#redacted-preview')?.textContent || '';
        const scanButton = document.querySelector('#scan-btn');
        const pdfButton = document.querySelector('#download-redacted-pdf-btn');
        if (!clicked && scanButton && !scanButton.disabled) {
          clicked = true;
          scanButton.click();
        }
        if (/encrypted PDF/i.test(status)) {
          clearInterval(timer);
          resolve({
            status,
            preview,
            hasRaw: preview.includes(rawSecret) || status.includes(rawSecret),
            pdfAvailable: !pdfButton?.disabled && !pdfButton?.hidden
          });
        } else if (Date.now() - started > 10000) {
          clearInterval(timer);
          reject(new Error('Timed out waiting for encrypted PDF warning: ' + JSON.stringify({
            status,
            scanDisabled: scanButton?.disabled,
            preview
          })));
        }
      }, 50);
    })`
  );
  assert.match(encrypted.status, /encrypted PDF/i);
  assert.equal(encrypted.preview, "");
  assert.equal(encrypted.hasRaw, false, "encrypted PDF scanner warning must not expose raw PDF secrets");
  assert.equal(encrypted.pdfAvailable, false, "scanner must not offer redacted PDF for encrypted PDFs");

  await evaluate(connection, scanner.sessionId, "document.querySelector('#clear-btn').click()");
  await waitFor(
    () => evaluate(connection, scanner.sessionId, "document.querySelector('#scan-btn')?.disabled"),
    "scanner reset after encrypted PDF"
  );

  scannerStep("malformed PDF");
  const malformedPath = path.join(tempDir, "leakguard-browser-qa-malformed.pdf");
  fs.writeFileSync(malformedPath, "not a pdf with PDF_MALFORMED_KEY=raw");
  await setFileInputFiles(connection, scanner.sessionId, "#file-input", [malformedPath]);
  const malformed = await evaluate(
    connection,
    scanner.sessionId,
    `new Promise((resolve, reject) => {
      const rawText = 'PDF_MALFORMED_KEY=raw';
      const started = Date.now();
      let clicked = false;
      const timer = setInterval(() => {
        const status = document.querySelector('#status')?.textContent || '';
        const preview = document.querySelector('#redacted-preview')?.textContent || '';
        const scanButton = document.querySelector('#scan-btn');
        const pdfButton = document.querySelector('#download-redacted-pdf-btn');
        if (!clicked && scanButton && !scanButton.disabled) {
          clicked = true;
          scanButton.click();
        }
        if (/could not read this PDF/i.test(status)) {
          clearInterval(timer);
          resolve({
            status,
            preview,
            hasRaw: preview.includes(rawText) || status.includes(rawText),
            pdfAvailable: !pdfButton?.disabled && !pdfButton?.hidden
          });
        } else if (Date.now() - started > 10000) {
          clearInterval(timer);
          reject(new Error('Timed out waiting for malformed PDF warning: ' + JSON.stringify({
            status,
            scanDisabled: scanButton?.disabled,
            preview
          })));
        }
      }, 50);
    })`
  );
  assert.match(malformed.status, /could not read this PDF/i);
  assert.equal(malformed.preview, "");
  assert.equal(malformed.hasRaw, false, "malformed PDF scanner warning must not expose raw bytes");
  assert.equal(malformed.pdfAvailable, false, "scanner must not offer redacted PDF for malformed PDFs");

  return {
    supported,
    textPdf,
    textDocx,
    textXlsx,
    imageMetadata,
    unsupportedDocx,
    unsupported,
    emptyPdf,
    encrypted,
    malformed
  };
}

async function runBrowserQa({ browserName, executable, matrixMode = getBrowserQaMatrixMode() }) {
  const normalizedMatrixMode = normalizeMatrixMode(matrixMode);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `leakguard-${browserName.toLowerCase()}-qa-`));
  const profileDir = path.join(tempDir, "profile");
  fs.mkdirSync(profileDir, { recursive: true });
  const extensionDir = prepareQaExtension(tempDir);

  let harnessServer = null;
  let browserProcess = null;
  let connection = null;
  let reporter = null;
  let behaviorChecksPassed = false;
  let extensionLoaded = false;
  try {
    harnessServer = await startHarnessServer();
    browserProcess = await launchBrowser({ executable, extensionDir, profileDir, browserName });
    connection = await createBrowserConnection(browserProcess, browserName);
    await connection.connect();
    await connection.send("Log.enable").catch(() => {});
    reporter = createBrowserQaReporter({
      browser: browserName,
      extensionBuildPath: sourceExtensionDir,
      siteLabel: "local protected QA page",
      adapter: "generic protected site",
      testName: "extension browser QA harness",
      secretCanaries: browserQaSecretCanaries
    });
    const version = await connection.send("Browser.getVersion");
    const extensionId = await loadExtension(connection, profileDir, extensionDir, browserName);
    extensionLoaded = true;
    assertExtensionLoaded({ extensionId }, {
      browserName,
      siteLabel: "local QA fixture page",
      adapter: "browser extension",
      inputPath: "debug mode",
      stage: "extension not loaded",
      secretCanaries: browserQaSecretCanaries
    });
    reporter.recordStep({
      browserName,
      siteLabel: "local QA fixture page",
      adapter: "browser extension",
      testName: "extension browser QA harness",
      stepName: "extension loaded",
      inputPath: "debug mode",
      stage: "extension not loaded",
      status: "passed",
      expected: "extension id available after browser startup",
      actualSummary: { extensionIdPresent: Boolean(extensionId), product: version.product },
      consoleLogSummary: summarizeBrowserConsoleLogs(connection.events, browserQaSecretCanaries),
      networkSummary: { available: false, reason: "not collected by local CDP harness" }
    });

    const runStep = async (label, metadataOrAction, maybeAction) => {
      const metadata = typeof metadataOrAction === "function" ? {} : metadataOrAction || {};
      const action = typeof metadataOrAction === "function" ? metadataOrAction : maybeAction;
      const context = {
        browserName,
        siteLabel: metadata.siteLabel || "local protected QA page",
        adapter: metadata.adapter || "generic protected site",
        testName: "extension browser QA harness",
        inputPath: metadata.inputPath || "typed text",
        stage: metadata.stage || "timeout waiting for UI",
        expected: metadata.expected || "browser QA step completes without exposing raw canaries",
        failureCode: metadata.failureCode || BROWSER_QA_FAILURE_CODES.UI_TIMEOUT,
        secretCanaries: browserQaSecretCanaries,
        safeControlIdsChecked: metadata.safeControlIdsChecked || browserQaSafeControlIds,
        consoleLogSummary: summarizeBrowserConsoleLogs(connection.events, browserQaSecretCanaries),
        networkSummary: { available: false, reason: "not collected by local CDP harness" },
        recommendation:
          metadata.recommendation ||
          "Inspect the classified stage, safe actual summary, and nearest adapter/harness assertion."
      };
      console.log(`${browserName} browser QA step: ${label}`);
      try {
        const result = await assertBrowserQaStep(label, action, context, reporter);
        const lastStep = reporter.report.steps.at(-1);
        if (lastStep) {
          lastStep.consoleLogSummary = summarizeBrowserConsoleLogs(connection.events, browserQaSecretCanaries);
        }
        console.log(`${browserName} browser QA step: ${label} complete`);
        return result;
      } catch (error) {
        const screenshotSessionId = metadata.screenshotSessionId;
        const screenshotPath = await captureFailureScreenshotIfSafe({
          connection,
          sessionId: screenshotSessionId,
          browserName,
          testName: "extension browser QA harness",
          stepName: label
        });
        const lastStep = reporter.report.steps.at(-1);
        if (lastStep) {
          lastStep.consoleLogSummary = summarizeBrowserConsoleLogs(connection.events, browserQaSecretCanaries);
          if (screenshotPath) lastStep.screenshotPath = screenshotPath;
        }
        reporter.write();
        throw error;
      }
    };

    const popup = await createPage(connection, `chrome-extension://${extensionId}/popup/popup.html`);
    await waitFor(
      () => evaluate(connection, popup.sessionId, "Boolean(document.querySelector('#manage-btn'))"),
      `${browserName} popup ready`
    );
    await runStep(
      "protected-site management",
      {
        siteLabel: "local QA fixture page",
        adapter: "generic protected site",
        inputPath: "debug mode",
        stage: "protected site not active",
        failureCode: BROWSER_QA_FAILURE_CODES.PROTECTED_SITE_INACTIVE,
        screenshotSessionId: popup.sessionId,
        expected: "localhost protected-site rule can be added, disabled, re-enabled, and deleted"
      },
      () => runProtectedSiteManagementQa(connection, popup.sessionId, harnessServer.origin)
    );

    const page = await runStep(
      "open protected harness",
      {
        siteLabel: "local protected QA page",
        adapter: "generic protected site",
        inputPath: "typed text",
        stage: "protected site not active",
        failureCode: BROWSER_QA_FAILURE_CODES.PROTECTED_SITE_INACTIVE,
        expected: "local QA fixture shows active LeakGuard protection"
      },
      () => openProtectedHarness(connection, harnessServer.origin)
    );
    const prompt = await runStep(
      "prompt redaction",
      {
        inputPath: "paste",
        stage: "UI rewrite failed",
        failureCode: BROWSER_QA_FAILURE_CODES.TEXT_PASTE_REDACTION_FAILED,
        screenshotSessionId: page.sessionId,
        expected: "multiline paste redacts secrets, emails/IP-like values, and preserves trusted placeholders"
      },
      () => runPromptRedactionQa(connection, page)
    );
    await runStep(
      "debug output metadata-only",
      {
        inputPath: "debug mode",
        stage: "debug leak detected",
        failureCode: BROWSER_QA_FAILURE_CODES.DEBUG_RAW_LEAK,
        screenshotSessionId: page.sessionId,
        expected: "browser console/debug output remains metadata-only after secret input",
        recommendation: "Likely cause: debug logging emitted raw composer or file text instead of metadata."
      },
      () => {
        const summary = summarizeBrowserConsoleLogs(connection.events, browserQaSecretCanaries);
        assertDebugOutputMetadataOnly(connection.events, {
          browserName,
          siteLabel: "local protected QA page",
          adapter: "generic protected site",
          inputPath: "debug mode",
          stage: "debug leak detected",
          secretCanaries: browserQaSecretCanaries,
          expected: "browser console/debug output contains no raw canaries or token-shaped text"
        });
        return summary;
      }
    );
    await runStep(
      "secure reveal",
      {
        inputPath: "sanitized handoff",
        stage: "placeholder allocation failed",
        failureCode: BROWSER_QA_FAILURE_CODES.PLACEHOLDER_MISSING,
        screenshotSessionId: page.sessionId,
        expected: "trusted placeholders hydrate without exposing raw values on the page"
      },
      () => runSecureRevealQa(connection, page, extensionId, prompt.firstPlaceholder)
    );
    const syntheticProviderInputs = await runStep(
      "synthetic provider inputs",
      {
        inputPath: "typed text / paste",
        stage: "send guard failed",
        failureCode: BROWSER_QA_FAILURE_CODES.TEXT_TYPED_REDACTION_FAILED,
        screenshotSessionId: page.sessionId,
        expected: "typed and pasted provider inputs submit sanitized placeholders or fail closed"
      },
      () => runSyntheticProviderInputInterceptionQa(connection, page)
    );
    const protectedSiteTextFiles = await runStep(
      "protected-site text file handoff",
      {
        inputPath: "file input",
        stage: "sanitized handoff failed",
        failureCode: BROWSER_QA_FAILURE_CODES.FILE_INPUT_REDACTION_FAILED,
        screenshotSessionId: page.sessionId,
        expected:
          normalizedMatrixMode === BROWSER_QA_MATRIX_MODES.FULL
            ? "all supported text file uploads are sanitized before provider handoff"
            : ".env, .json, and .log uploads are sanitized before provider handoff"
      },
      () => runProtectedSiteTextFileHandoffQa(connection, page, tempDir, { matrixMode: normalizedMatrixMode })
    );
    const protectedSitePdf = await runStep(
      "protected-site PDF handoff",
      {
        inputPath: "PDF",
        stage: "redacted file generation failed",
        failureCode: BROWSER_QA_FAILURE_CODES.REDACTED_FILE_MISSING,
        screenshotSessionId: page.sessionId,
        expected: "text PDF uploads are regenerated with placeholders or fail closed without raw fallback"
      },
      () => runProtectedSitePdfHandoffQa(connection, page, tempDir)
    );
    const protectedSiteDocx = await runStep(
      "protected-site DOCX handoff",
      {
        inputPath: "DOCX",
        stage: "redacted file generation failed",
        failureCode: BROWSER_QA_FAILURE_CODES.REDACTED_FILE_MISSING,
        screenshotSessionId: page.sessionId,
        expected: "DOCX uploads are regenerated with placeholders and no raw fallback"
      },
      () => runProtectedSiteDocxHandoffQa(connection, page, tempDir)
    );
    const protectedSiteXlsx = await runStep(
      "protected-site XLSX handoff",
      {
        inputPath: "XLSX",
        stage: "redacted file generation failed",
        failureCode: BROWSER_QA_FAILURE_CODES.REDACTED_FILE_MISSING,
        screenshotSessionId: page.sessionId,
        expected: "XLSX uploads are regenerated with placeholders and no raw fallback"
      },
      () => runProtectedSiteXlsxHandoffQa(connection, page, tempDir)
    );
    const protectedSiteImageOcr = await runStep(
      "protected-site image OCR handoff",
      {
        inputPath: "image OCR/redaction",
        stage: "redacted file generation failed",
        failureCode: BROWSER_QA_FAILURE_CODES.REDACTED_FILE_MISSING,
        screenshotSessionId: page.sessionId,
        expected:
          normalizedMatrixMode === BROWSER_QA_MATRIX_MODES.FULL
            ? "PNG/JPG/JPEG/WEBP protected-site OCR produces sanitized PNG outputs or blocks raw upload"
            : "protected-site OCR produces a sanitized PNG or blocks raw upload"
      },
      () => runProtectedSiteImageOcrQa(connection, page, popup.sessionId, tempDir, { matrixMode: normalizedMatrixMode })
    );
    const protectedSiteDrop = await runStep(
      "protected-site file drop",
      {
        inputPath: "drag/drop",
        stage: "sanitized handoff failed",
        failureCode: BROWSER_QA_FAILURE_CODES.FILE_DROP_REDACTION_FAILED,
        screenshotSessionId: page.sessionId,
        expected: "drag/drop sanitized handoff succeeds or blocks raw upload"
      },
      () => runProtectedSiteFileDropHandoffQa(connection, page)
    );
    const protectedSiteFailures = await runStep(
      "protected-site failure injection",
      {
        inputPath: "file input",
        stage: "unsupported file not blocked",
        failureCode: BROWSER_QA_FAILURE_CODES.UNSUPPORTED_FILE_NOT_BLOCKED,
        screenshotSessionId: page.sessionId,
        expected: "unsupported or malformed files fail closed without raw upload"
      },
      () => runProtectedSiteFailureInjectionQa(connection, page, tempDir, { matrixMode: normalizedMatrixMode })
    );
    await runStep(
      "refresh safety",
      {
        inputPath: "sanitized handoff",
        stage: "raw fallback happened",
        failureCode: BROWSER_QA_FAILURE_CODES.RAW_SECRET_VISIBLE,
        screenshotSessionId: page.sessionId,
        expected: "refresh does not restore raw synthetic canaries"
      },
      () => runRefreshSafetyQa(connection, page)
    );
    const scanner = await runStep(
      "scanner downloads",
      {
        siteLabel: "local QA fixture page",
        adapter: "file scanner",
        inputPath: "PDF / DOCX / XLSX / image OCR/redaction",
        stage: "redacted file generation failed",
        failureCode: BROWSER_QA_FAILURE_CODES.REDACTED_FILE_MISSING,
        expected: "scanner previews, regenerated files, and reports remain sanitized"
      },
      () => runScannerQa(connection, extensionId, tempDir)
    );

    console.log(`${browserName} browser QA: ${version.product}`);
    console.log(`${browserName} browser QA: extension loaded (${extensionId})`);
    console.log(`${browserName} browser QA: local harness ${harnessServer.origin}`);
    console.log(
      `${browserName} browser QA: ${normalizedMatrixMode} matrix, protected-site lifecycle, synthetic provider input interception, protected-site PDF/DOCX/XLSX/image handoff, file drop handoff, failure injection, reveal, refresh, scanner downloads`
    );

    behaviorChecksPassed = true;
    return {
      browserName,
      extensionId,
      product: version.product,
      matrixMode: normalizedMatrixMode,
      prompt,
      syntheticProviderInputs,
      protectedSiteTextFiles,
      protectedSitePdf,
      protectedSiteDocx,
      protectedSiteXlsx,
      protectedSiteImageOcr,
      protectedSiteDrop,
      protectedSiteFailures,
      scanner
    };
  } catch (error) {
    if (browserProcess?.stderr?.()) console.error(browserProcess.stderr());
    if (!extensionLoaded) {
      const logDir = path.join(tempDir, "logs");
      fs.mkdirSync(logDir, { recursive: true });
      const stderrLogPath = path.join(logDir, `${browserName.toLowerCase()}-browser-qa-stderr.log`);
      fs.writeFileSync(stderrLogPath, browserProcess?.stderr?.() || "(no browser stderr captured)\n");
      throw new Error(
        [
          `${browserName} environment failure: browser crashed before extension load or CDP was unavailable.`,
          "This is not classified as a LeakGuard product failure unless the extension loads and a product assertion fails.",
          `stderr log: ${stderrLogPath}`,
          `Original error: ${error?.message || error}`,
          "Remediation: run npm run preflight:browser, run this browser command alone, close stale browser processes, and update the browser binary if startup still fails."
        ].join("\n")
      );
    }
    throw error;
  } finally {
    reporter?.write();
    await cleanupBrowserQaRun({
      browserName,
      tempDir,
      connection,
      child: browserProcess?.child,
      harnessServer,
      behaviorChecksPassed
    });
  }
}

function getBrowserQaTargets({
  chromeExecutable = findChromeExecutable(),
  edgeExecutable = findEdgeExecutable(),
  targetList = process.env.LEAKGUARD_BROWSER_QA_TARGETS || ""
} = {}) {
  const requested = String(targetList || "chrome")
    .split(",")
    .map((target) => target.trim().toLowerCase())
    .filter(Boolean);
  const uniqueTargets = Array.from(new Set(requested));
  const browsers = [];

  if (uniqueTargets.includes("chrome")) {
    browsers.push({ browserName: "Chrome", executable: chromeExecutable });
  }
  if (uniqueTargets.includes("edge")) {
    browsers.push({ browserName: "Edge", executable: edgeExecutable });
  }

  return browsers;
}

async function main() {
  assertBuiltExtensionExists();
  const browsers = getBrowserQaTargets();
  const matrixMode = getBrowserQaMatrixMode();

  for (const browser of browsers) {
    await runBrowserQa({ ...browser, matrixMode });
  }
  console.log("PASS extension browser QA harness");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export {
  assertHarnessTempDir,
  cleanupBrowserQaRun,
  closeBrowserTargets,
  findExtensionIdInPreferences,
  getBrowserQaCoverageMatrix,
  getBrowserQaDebuggingMode,
  getBrowserQaMatrixMode,
  getBrowserQaTargets,
  getHarnessFileInputAccept,
  isHarnessTextCaptureFileName,
  runBrowserQa
};
