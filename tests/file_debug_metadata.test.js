const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/content/diagnostics/fileDebugMetadata.js"));
require(path.join(repoRoot, "src/content/diagnostics/debugLogger.js"));
const ContentDebugFacade = require(path.join(repoRoot, "src/content/diagnostics/contentDebugFacade.js"));

const { FileDebugMetadata } = globalThis.PWM;

const payload = FileDebugMetadata.createSafeFileAttachDebugPayload({
  action: "Gemini Upload!",
  host: "gemini.google.com/path?raw=secret",
  bytesProcessed: Number.POSITIVE_INFINITY,
  file: {
    name: "../customer-secret.env",
    type: "text/plain;token=raw",
    size: 1234,
    supportedText: true,
    sanitized: false
  },
  sanitizedFile: {
    name: "redacted-output.TXT",
    type: "text/plain",
    sizeBytes: 456,
    supportedText: true,
    sanitized: true
  },
  input: {
    tag: "INPUT",
    source: "Gemini Menu",
    disabled: false,
    hidden: true,
    multiple: false,
    filesLength: 1
  },
  adapter: {
    id: "gemini",
    siteLabel: "Gemini",
    hosts: ["gemini.google.com"],
    supportsDirectDropReplay: false,
    supportsPendingAttach: true,
    supportsTrustedAttachButton: true,
    pendingAttachEnabled: true
  },
  error: {
    name: "TypeError",
    message: "raw secret sk-test-should-not-appear",
    code: "UPLOAD_BLOCKED"
  },
  progress: {
    bytesProcessed: 100,
    totalBytes: 200,
    chunks: 2
  },
  events: ["DROP start", "paste/raw?secret=true", "../unsafe"]
});

assert.strictEqual(payload.action, "gemini-upload-");
assert.strictEqual(payload.host, "gemini.google.com-path-raw-secret");
assert.strictEqual(payload.bytesProcessed, 0);
assert.deepStrictEqual(payload.file, {
  sizeBytes: 1234,
  extension: "",
  category: "unknown",
  mimeCategory: "",
  supportedText: true,
  sanitized: false
});
assert.deepStrictEqual(payload.sanitizedFile, {
  sizeBytes: 456,
  extension: "txt",
  category: "txt",
  mimeCategory: "",
  supportedText: true,
  sanitized: true
});
assert.deepStrictEqual(payload.input, {
  tag: "input",
  source: "gemini-menu",
  disabled: false,
  hidden: true,
  multiple: false,
  filesLength: 1
});
assert.deepStrictEqual(payload.adapter, {
  id: "gemini",
  siteLabel: "gemini",
  hostCount: 1,
  supportsDirectDropReplay: false,
  supportsPendingAttach: true,
  supportsTrustedAttachButton: true,
  pendingAttachEnabled: true
});
assert.strictEqual(payload.errorName, "TypeError");
assert.strictEqual(payload.messageLength, "raw secret sk-test-should-not-appear".length);
assert.strictEqual(payload.codeIfSafe, "UPLOAD_BLOCKED");
assert.deepStrictEqual(payload.progress, {
  bytesProcessed: 100,
  totalBytes: 200,
  chunks: 2
});
assert.deepStrictEqual(payload.events, ["drop-start", "sensitive-event", "file-event"]);
assert.strictEqual(JSON.stringify(payload).includes("sk-test-should-not-appear"), false);
assert.strictEqual(JSON.stringify(payload).includes("customer-secret.env"), false);

{
  const rawSecret = "sk-file-debug-secret-value-123456789";
  const facade = ContentDebugFacade.createContentDebugFacade({
    DebugLogger: globalThis.PWM.DebugLogger,
    FileDebugMetadata,
    createSafeFileAttachDebugPayload: FileDebugMetadata.createSafeFileAttachDebugPayload
  });
  const fileDescription = facade.describeFileForDebug({
    name: `customer-${rawSecret}.env`,
    type: "text/plain;token=raw-secret",
    size: 42,
    lastModified: 123
  });
  const elementDescription = facade.describeElementForDebug(
    {
      tagName: "BUTTON",
      id: `upload-${rawSecret}`,
      className: `button-${rawSecret}`,
      hidden: false,
      disabled: false,
      getAttribute(name) {
        return name === "aria-label" ? `Attach ${rawSecret}` : "";
      }
    },
    "file-debug"
  );
  const serialized = JSON.stringify({ fileDescription, elementDescription });
  assert.strictEqual(serialized.includes(rawSecret), false, "facade debug descriptions must not expose raw strings");
  assert.strictEqual(fileDescription.nameLength, `customer-${rawSecret}.env`.length);
  assert.strictEqual(fileDescription.size, 42);
  assert.strictEqual(elementDescription.idLength, `upload-${rawSecret}`.length);
  assert.strictEqual(elementDescription.ariaLabelLength, `Attach ${rawSecret}`.length);
}

console.log("PASS file debug metadata");
