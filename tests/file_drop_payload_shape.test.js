const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/content/diagnostics/safeSnapshots.js"));
require(path.join(repoRoot, "src/shared/fileLimits.js"));
require(path.join(repoRoot, "src/content/files/fileAttachPipeline.js"));

const MiB = 1024 * 1024;

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
  assert.strictEqual(pipeline.MAX_MULTI_FILE_LARGE_ATTACHMENTS, 5);
  assert.strictEqual(pipeline.MAX_MULTI_FILE_SMALL_ATTACHMENTS, 20);
  assert.strictEqual(pipeline.MULTI_FILE_SMALL_MAX_BYTES, 4 * MiB);
  assert.strictEqual(pipeline.MULTI_FILE_SUPPORTED_MAX_BYTES, 50 * MiB);

  const one = pipeline.createMultiFileAttachPlan([{}]);
  assert.strictEqual(one.mode, "single");
  assert.strictEqual(one.ok, true);
  assert.strictEqual(one.fileCount, 1);
  assert.strictEqual(one.smallCount, 1);
  assert.strictEqual(one.largeCount, 0);
  assert.strictEqual(one.maxSmallFiles, 20);
  assert.strictEqual(one.maxLargeFiles, 5);

  const two = pipeline.createMultiFileAttachPlan([{}, {}]);
  assert.strictEqual(two.mode, "multi");
  assert.strictEqual(two.ok, true);
  assert.strictEqual(two.acceptedCount, 2);
  assert.strictEqual(two.blockedCount, 0);

  const five = pipeline.createMultiFileAttachPlan([{}, {}, {}, {}, {}]);
  assert.strictEqual(five.mode, "multi");
  assert.strictEqual(five.ok, true);
  assert.strictEqual(five.acceptedCount, 5);

  const sixSmall = pipeline.createMultiFileAttachPlan(Array.from({ length: 6 }, () => ({ size: 1024 })));
  assert.strictEqual(sixSmall.mode, "multi");
  assert.strictEqual(sixSmall.ok, true);
  assert.strictEqual(sixSmall.acceptedCount, 6);

  const twentySmall = pipeline.createMultiFileAttachPlan(Array.from({ length: 20 }, () => ({ size: 1024 })));
  assert.strictEqual(twentySmall.mode, "multi");
  assert.strictEqual(twentySmall.ok, true);
  assert.strictEqual(twentySmall.acceptedCount, 20);
  assert.strictEqual(twentySmall.smallCount, 20);
  assert.strictEqual(twentySmall.largeCount, 0);

  const twentyOneSmall = pipeline.createMultiFileAttachPlan(Array.from({ length: 21 }, () => ({ size: 1024 })));
  assert.strictEqual(twentyOneSmall.mode, "blocked");
  assert.strictEqual(twentyOneSmall.ok, false);
  assert.strictEqual(twentyOneSmall.reason, "small_file_count_exceeded");

  const fiveLarge = pipeline.createMultiFileAttachPlan([1, 5, 10, 25, 50].map((sizeMb) => ({ size: sizeMb * MiB })));
  assert.strictEqual(fiveLarge.mode, "multi");
  assert.strictEqual(fiveLarge.ok, true);
  assert.strictEqual(fiveLarge.smallCount, 1);
  assert.strictEqual(fiveLarge.largeCount, 4);

  const sixLarge = pipeline.createMultiFileAttachPlan(Array.from({ length: 6 }, () => ({ size: 5 * MiB })));
  assert.strictEqual(sixLarge.mode, "blocked");
  assert.strictEqual(sixLarge.ok, false);
  assert.strictEqual(sixLarge.reason, "large_file_count_exceeded");

  const tooLarge = pipeline.createMultiFileAttachPlan([{ size: 51 * MiB }, { size: 1024 }]);
  assert.strictEqual(tooLarge.mode, "blocked");
  assert.strictEqual(tooLarge.ok, false);
  assert.strictEqual(tooLarge.reason, "file_exceeds_supported_size");

  const mixed = pipeline.createMultiFileAttachPlan([
    ...Array.from({ length: 10 }, () => ({ size: 1024 })),
    ...Array.from({ length: 3 }, () => ({ size: 10 * MiB }))
  ]);
  assert.strictEqual(mixed.ok, true);
  assert.strictEqual(mixed.smallCount, 10);
  assert.strictEqual(mixed.largeCount, 3);

  const invalidMixed = pipeline.createMultiFileAttachPlan([
    ...Array.from({ length: 10 }, () => ({ size: 1024 })),
    ...Array.from({ length: 6 }, () => ({ size: 10 * MiB }))
  ]);
  assert.strictEqual(invalidMixed.ok, false);
  assert.strictEqual(invalidMixed.reason, "large_file_count_exceeded");

  const sixDefaultSized = pipeline.createMultiFileAttachPlan([{}, {}, {}, {}, {}, {}]);
  assert.strictEqual(sixDefaultSized.mode, "multi");
  assert.strictEqual(sixDefaultSized.ok, true);
  assert.strictEqual(sixDefaultSized.acceptedCount, 6);
  assert.strictEqual(sixDefaultSized.blockedCount, 0);

  const twentySix = pipeline.createMultiFileAttachPlan([
    ...Array.from({ length: 20 }, () => ({ size: 1024 })),
    ...Array.from({ length: 6 }, () => ({ size: 5 * MiB }))
  ]);
  assert.strictEqual(twentySix.mode, "blocked");
  assert.strictEqual(twentySix.ok, false);
  assert.strictEqual(twentySix.acceptedCount, 0);
  assert.strictEqual(twentySix.blockedCount, 26);
  assert.strictEqual(twentySix.reason, "large_file_count_exceeded");

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
  assert.match(message, /Attached files:\n- file-1 \(\.env, text, 11 bytes\) - attached\n- file-3 \(\.json, application, 22 bytes\) - attached/);
  assert.match(message, /Blocked files:\n- file-2 \(\.svg, image, 33 bytes\) - failed, reason: unknown_blocked/);
  assert.strictEqual(message.includes(rawSecret), false);
  assert.strictEqual(message.includes("C:\\Users"), false);
  assert.strictEqual(message.includes("config.json"), false);

  const blockedBeforeProcessing = pipeline.formatMultiFileStatusMessage(
    pipeline.createMultiFileStatusSummary({
      blockedItems: Array.from({ length: 6 }, (_, index) => ({
        summary: pipeline.createMultiFileItemSummary({
          index,
          status: "blocked",
          code: "large_file_count_exceeded",
          metadata: { extension: ".env", mimeCategory: "text", sizeBytes: 5 * MiB }
        })
      }))
    }),
    { blockedBeforeProcessing: true, reason: "large_file_count_exceeded" }
  );
  assert.match(blockedBeforeProcessing, /blocked before reading or processing/);
  assert.match(blockedBeforeProcessing, /Up to 5 large files/);
  assert.match(blockedBeforeProcessing, /5\.0 MB/);
}

testMultiFileStatusSummaryFormatsSafeDetailsOnly();

console.log("PASS file drop payload shape regressions");
