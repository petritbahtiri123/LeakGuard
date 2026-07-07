const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/content/files/localFileSanitizationOrchestration.js"));

function createHarness(overrides = {}) {
  const calls = {
    analysis: [],
    createdFiles: [],
    dmzStates: [],
    overlays: [],
    redactions: []
  };
  const localFile = {
    file: {
      name: "secrets.env",
      type: "text/plain",
      sizeBytes: 128
    },
    text: "API_KEY=LeakGuardLocalFileSecret123456"
  };
  const redactedFile = {
    name: "secrets.env",
    type: "text/plain",
    text: "API_KEY=[PWM_1]"
  };
  const orchestration =
    globalThis.PWM.LocalFileSanitizationOrchestration.createLocalFileSanitizationOrchestration({
      analyzeText: (text) => {
        calls.analysis.push(text);
        return {
          normalizedText: text,
          secretFindings: [{ raw: "LeakGuardLocalFileSecret123456" }],
          findings: [{ raw: "LeakGuardLocalFileSecret123456" }]
        };
      },
      createSanitizedTextFile: (file, text) => {
        calls.createdFiles.push({ file, text });
        return redactedFile;
      },
      requestRedaction: async (text, findings) => {
        calls.redactions.push({ text, findings });
        return {
          redactedText: "API_KEY=[PWM_1]",
          replacements: [{ placeholder: "[PWM_1]" }]
        };
      },
      setDmzOverlayState: (status, mode) => calls.dmzStates.push({ status, mode }),
      updateFileProcessingOverlay: (details) => calls.overlays.push(details),
      ...overrides
    });

  return { orchestration, calls, localFile, redactedFile };
}

function createPreflightPlan() {
  return {
    sanitizationStatus: {
      shouldSetDmzRedacting: true,
      dmzStatus: "Redacting sanitized file",
      dmzMode: "redacting",
      processingStatus: "Redacting file locally...",
      processingProgress: "In progress",
      processingBlocking: true
    },
    optimizedStatus: {
      cleanupOnSanitizationFailure: "sanitize-failure"
    }
  };
}

async function testTextFileSanitizationReturnsAttachInputs() {
  const { orchestration, calls, localFile, redactedFile } = createHarness();

  const result = await orchestration.sanitizeLocalFileForAttach({
    localFile,
    contentExtractionResult: null,
    context: "drop",
    processingSite: "chatgpt",
    sizeInfo: { zone: "fast", bytes: 128 },
    preflightPlan: createPreflightPlan(),
    optimizedStatus: false,
    imageRedactionMode: false,
    controls: {
      failProcessing: () => {
        throw new Error("success path should not fail processing");
      }
    }
  });

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.analysis.secretFindings.length, 1);
  assert.deepStrictEqual(result.result, {
    redactedText: "API_KEY=[PWM_1]",
    replacements: [{ placeholder: "[PWM_1]" }]
  });
  assert.strictEqual(result.sanitizedFile, redactedFile);
  assert.deepStrictEqual(calls.analysis, [localFile.text]);
  assert.strictEqual(calls.redactions.length, 1);
  assert.strictEqual(calls.redactions[0].text, localFile.text);
  assert.deepStrictEqual(calls.createdFiles, [
    {
      file: localFile.file,
      text: "API_KEY=[PWM_1]"
    }
  ]);
  assert.deepStrictEqual(calls.dmzStates, [
    {
      status: "Redacting sanitized file",
      mode: "redacting"
    }
  ]);
  assert.deepStrictEqual(calls.overlays, [
    {
      site: "chatgpt",
      status: "Redacting file locally...",
      progress: "In progress",
      blocking: true
    }
  ]);
}

(async () => {
  await testTextFileSanitizationReturnsAttachInputs();
  console.log("PASS local file sanitization orchestration");
})();
