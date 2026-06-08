const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/content/diagnostics/safeSnapshots.js"));
require(path.join(repoRoot, "src/content/files/fileAttachPipeline.js"));

function testFileAttachPipelineCreatesSanitizedPayloadMetadata() {
  const sanitizedFile = {
    name: "service.env",
    type: "text/plain",
    size: 24
  };
  const localFile = {
    text: "API_KEY=raw-secret",
    file: {
      name: "service.env",
      type: "text/plain",
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
    name: "service.env",
    type: "text/plain",
    size: 42,
    lastModified: 1234
  });
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

console.log("PASS file drop payload shape regressions");
