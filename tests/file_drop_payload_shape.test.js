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
    code: "unknown_blocked"
  });
  assert.strictEqual(JSON.stringify(summary).includes("customer-"), false);
}

testMultiFileAttachPlanLimitsAndMetadata();

function testMultiFileStatusSummaryFormatsSafeDetailsOnly() {
  const pipeline = globalThis.PWM.FileAttachPipeline;
  const rawSecret = "sk-proj-SummaryReasonSecret1234567890abcdef";
  const summary = pipeline.createMultiFileStatusSummary({
    sanitizedItems: [
      {
        summary: pipeline.createMultiFileItemSummary({
          index: 0,
          status: "sanitized",
          file: { name: `safe-${rawSecret}.env`, type: "text/plain", size: 11 },
          metadata: { extension: ".env", mimeCategory: "text", sizeBytes: 11 }
        })
      },
      {
        summary: pipeline.createMultiFileItemSummary({
          index: 2,
          status: "attached",
          file: { name: "config.json", type: "application/json", size: 22 },
          metadata: { extension: ".json", mimeCategory: "application", sizeBytes: 22 }
        })
      }
    ],
    blockedItems: [
      {
        summary: pipeline.createMultiFileItemSummary({
          index: 1,
          status: "failed",
          code: `boom-${rawSecret}`,
          file: { name: `C:\\Users\\owner\\${rawSecret}.svg`, type: "image/svg+xml", size: 33 },
          metadata: { extension: ".svg", mimeCategory: "image", sizeBytes: 33 }
        })
      }
    ]
  });

  assert.strictEqual(summary.sanitizedCount, 2);
  assert.strictEqual(summary.blockedCount, 1);
  assert.deepStrictEqual(summary.attached.map((item) => item.label), ["file-1", "file-3"]);
  assert.deepStrictEqual(summary.blocked.map((item) => item.code), ["unknown_blocked"]);
  const message = pipeline.formatMultiFileStatusMessage(summary, { blockedBeforeProcessing: false });
  assert.match(message, /LeakGuard attached 2 sanitized file\(s\) and blocked 1 file\(s\)\./);
  assert.match(message, /No raw files were uploaded\./);
  assert.match(message, /Attached files:\n- file-1 \(\.env, text, 11 bytes, attached\)\n- file-3 \(\.json, application, 22 bytes, attached\)/);
  assert.match(message, /Blocked files:\n- file-2 \(\.svg, image, 33 bytes, failed, reason: unknown_blocked\)/);
  assert.strictEqual(message.includes(rawSecret), false);
  assert.strictEqual(message.includes("C:\\Users"), false);
  assert.strictEqual(message.includes("config.json"), false);

  const blockedBeforeProcessing = pipeline.formatMultiFileStatusMessage(
    pipeline.createMultiFileStatusSummary({
      blockedItems: Array.from({ length: 6 }, (_, index) => ({
        summary: pipeline.createMultiFileItemSummary({
          index,
          status: "blocked",
          code: "blocked_by_policy",
          metadata: { extension: ".env", mimeCategory: "text", sizeBytes: 10 }
        })
      }))
    }),
    { blockedBeforeProcessing: true, maxFiles: 5 }
  );
  assert.match(blockedBeforeProcessing, /blocked before reading or processing/);
  assert.match(blockedBeforeProcessing, /LeakGuard supports up to 5 files/);
}

testMultiFileStatusSummaryFormatsSafeDetailsOnly();

console.log("PASS file drop payload shape regressions");
