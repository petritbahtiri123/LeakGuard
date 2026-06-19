const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/content/diagnostics/safeSnapshots.js"));
require(path.join(repoRoot, "src/content/files/fileAttachPipeline.js"));

function testFileAttachPipelineCreatesSanitizedPayloadMetadata() {
  const rawSecret = "sk-proj-PayloadFileNameSecret1234567890abcdef";
  const sanitizedFile = {
    name: "service.env",
    type: "text/plain",
    size: 24
  };
  const localFile = {
    text: "API_KEY=raw-secret",
    file: {
      name: `service-${rawSecret}.env`,
      type: `text/plain;token=${rawSecret}`,
      size: 42,
      lastModified: 1234
    }
  };
  const result = {
    replacements: [
      {
        id: "secret-1",
        start: "8",
        end: "18",
        placeholder: "[PWM_1]"
      }
    ]
  };

  const payload = globalThis.PWM.FileAttachPipeline.createSanitizedPayload(
    sanitizedFile,
    "API_KEY=[PWM_1]\nHOST=[NET_2]\nTOKEN=[PWM_1]",
    localFile,
    {
      secretFindings: [{ raw: "redacted" }, { raw: "also-redacted" }]
    },
    result
  );

  assert.deepStrictEqual(Object.keys(payload), [
    "sanitizedFile",
    "redactedText",
    "rawText",
    "originalFile",
    "placeholders",
    "replacements",
    "findingCount"
  ]);
  assert.strictEqual(payload.sanitizedFile, sanitizedFile);
  assert.strictEqual(payload.redactedText, "API_KEY=[PWM_1]\nHOST=[NET_2]\nTOKEN=[PWM_1]");
  assert.strictEqual(payload.rawText, "API_KEY=raw-secret");
  assert.deepStrictEqual(payload.originalFile, {
    name: "file.env",
    type: "text/plain",
    size: 42,
    lastModified: 1234
  });
  assert.strictEqual(JSON.stringify(payload.originalFile).includes(rawSecret), false);
  assert.deepStrictEqual(payload.placeholders, ["[PWM_1]", "[NET_2]"]);
  assert.deepStrictEqual(payload.replacements, [
    {
      id: "secret-1",
      start: 8,
      end: 18,
      placeholder: "[PWM_1]"
    }
  ]);
  assert.strictEqual(payload.findingCount, 2);
}

testFileAttachPipelineCreatesSanitizedPayloadMetadata();
function testMultiFileAttachPlanLimitsAndMetadata() {
  const pipeline = globalThis.PWM.FileAttachPipeline;
  assert.strictEqual(pipeline.MAX_MULTI_FILE_ATTACHMENTS, 5);

  const one = pipeline.createMultiFileAttachPlan([{}]);
  assert.deepStrictEqual(one, {
    mode: "single",
    ok: true,
    fileCount: 1,
    acceptedCount: 1,
    blockedCount: 0,
    maxFiles: 5,
    reason: ""
  });

  const two = pipeline.createMultiFileAttachPlan([{}, {}]);
  assert.strictEqual(two.mode, "multi");
  assert.strictEqual(two.ok, true);
  assert.strictEqual(two.acceptedCount, 2);
  assert.strictEqual(two.blockedCount, 0);

  const five = pipeline.createMultiFileAttachPlan([{}, {}, {}, {}, {}]);
  assert.strictEqual(five.mode, "multi");
  assert.strictEqual(five.ok, true);
  assert.strictEqual(five.acceptedCount, 5);

  const six = pipeline.createMultiFileAttachPlan([{}, {}, {}, {}, {}, {}]);
  assert.strictEqual(six.mode, "blocked");
  assert.strictEqual(six.ok, false);
  assert.strictEqual(six.acceptedCount, 0);
  assert.strictEqual(six.blockedCount, 6);
  assert.strictEqual(six.reason, "too_many_files");

  const rawSecret = "sk-proj-MultiFileNameSecret1234567890abcdef";
  const summary = pipeline.createMultiFileItemSummary({
    index: 2,
    status: "sanitized",
    code: `secret-${rawSecret}`,
    file: {
      name: `customer-${rawSecret}.env`,
      type: "text/plain",
      size: 123
    },
    metadata: {
      extension: ".env",
      mimeCategory: "text/plain",
      sizeBytes: 123
    }
  });
  assert.deepStrictEqual(summary, {
    index: 2,
    label: "file-3",
    status: "sanitized",
    extension: ".env",
    mimeCategory: "text",
    sizeBytes: 123,
    code: "sensitive-code"
  });
  assert.strictEqual(JSON.stringify(summary).includes("customer-"), false);
}

testMultiFileAttachPlanLimitsAndMetadata();

console.log("PASS file drop payload shape regressions");
