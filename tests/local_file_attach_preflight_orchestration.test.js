const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/content/files/localFileAttachPreflightOrchestration.js"));

function createHarness(overrides = {}) {
  const calls = {
    blockedPayloads: [],
    failures: [],
    optimizationStatus: [],
    preflightOptions: [],
    sizePayloads: []
  };
  const preflightPlan = {
    optimizedStatus: {
      shouldShow: true
    },
    attachFlowOptions: {
      allowPendingFallback: true
    }
  };
  const orchestration =
    globalThis.PWM.LocalFileAttachPreflightOrchestration.createLocalFileAttachPreflightOrchestration({
      blockLargeLocalTextPayload: async (event, sizeInfo) => calls.blockedPayloads.push({ event, sizeInfo }),
      classifyLocalTextPayloadSize: (payload) => {
        calls.sizePayloads.push(payload);
        return { zone: "optimized", bytes: 4096 };
      },
      fileAttachPipeline: {
        classifyFileAttachPreflightPlan: (options) => {
          calls.preflightOptions.push(options);
          return preflightPlan;
        }
      },
      getCurrentHandoffDriver: () => ({ usesDmzOverlay: true }),
      isFirefoxRuntime: () => false,
      isGeminiHost: () => false,
      localTextHardBlockTitle: "Large payload blocked for browser stability",
      showLocalPayloadOptimizationStatus: (sizeInfo) => calls.optimizationStatus.push(sizeInfo),
      ...overrides
    });

  return { orchestration, calls, preflightPlan };
}

async function testOptimizedPayloadPreparesPreflightPlan() {
  const { orchestration, calls, preflightPlan } = createHarness({
    isFirefoxRuntime: () => true,
    isGeminiHost: () => true
  });
  const localFile = {
    file: { sizeBytes: 4096 },
    text: "token=LeakGuardLocalFileSecret123456"
  };

  const result = await orchestration.prepareLocalFileAttachPreflight({
    event: { type: "drop" },
    localFile,
    context: "file-input",
    attachModes: {
      textDocument: false,
      pdf: true,
      docx: false,
      xlsx: false
    },
    controls: {
      failProcessing: () => {
        throw new Error("optimized path should not fail processing");
      }
    }
  });

  assert.strictEqual(result.done, false);
  assert.strictEqual(result.imageRedactionMode, false);
  assert.deepStrictEqual(result.sizeInfo, { zone: "optimized", bytes: 4096 });
  assert.strictEqual(result.shouldSkipTextFallback, true);
  assert.strictEqual(result.preflightPlan, preflightPlan);
  assert.strictEqual(result.optimizedStatus, true);
  assert.deepStrictEqual(calls.sizePayloads, [
    {
      text: localFile.text,
      sizeBytes: 4096
    }
  ]);
  assert.deepStrictEqual(calls.preflightOptions, [
    {
      context: "file-input",
      sizeZone: "optimized",
      usesDmzOverlay: true,
      skipTextFallback: true,
      imageRedactionMode: false,
      allowPendingFallback: false
    }
  ]);
  assert.deepStrictEqual(calls.optimizationStatus, [{ zone: "optimized", bytes: 4096 }]);
  assert.deepStrictEqual(calls.failures, []);
}

async function testImagePayloadUsesFastSizeWithoutTextClassification() {
  const { orchestration, calls } = createHarness();
  const localFile = {
    file: { sizeBytes: 512 },
    fileOnlyUpload: true,
    text: ""
  };

  const result = await orchestration.prepareLocalFileAttachPreflight({
    event: { type: "drop" },
    localFile,
    context: "drop",
    attachModes: {
      textDocument: false,
      pdf: false,
      docx: false,
      xlsx: false
    },
    controls: {
      failProcessing: () => {
        throw new Error("image path should not fail processing");
      }
    }
  });

  assert.strictEqual(result.done, false);
  assert.strictEqual(result.imageRedactionMode, true);
  assert.deepStrictEqual(result.sizeInfo, { zone: "fast", bytes: 512 });
  assert.deepStrictEqual(calls.sizePayloads, []);
  assert.strictEqual(calls.preflightOptions[0].allowPendingFallback, true);
  assert.strictEqual(calls.preflightOptions[0].imageRedactionMode, true);
}

async function testBlockedPayloadFailsClosed() {
  const event = { type: "paste" };
  const blockedSizeInfo = { zone: "blocked", bytes: 12 * 1024 * 1024 };
  const { orchestration, calls } = createHarness({
    classifyLocalTextPayloadSize: () => blockedSizeInfo,
    fileAttachPipeline: {
      classifyFileAttachPreflightPlan: () => {
        throw new Error("blocked payload should not build an attach plan");
      }
    }
  });
  const localFile = {
    file: { sizeBytes: blockedSizeInfo.bytes },
    text: "x".repeat(32)
  };

  const result = await orchestration.prepareLocalFileAttachPreflight({
    event,
    localFile,
    context: "paste",
    attachModes: {
      textDocument: false,
      pdf: false,
      docx: false,
      xlsx: false
    },
    controls: {
      failProcessing: (reason, title) => calls.failures.push({ reason, title })
    }
  });

  assert.deepStrictEqual(result, { done: true, value: true });
  assert.deepStrictEqual(calls.failures, [
    {
      reason: "local_text_payload_too_large",
      title: "Large payload blocked for browser stability"
    }
  ]);
  assert.deepStrictEqual(calls.blockedPayloads, [{ event, sizeInfo: blockedSizeInfo }]);
  assert.deepStrictEqual(calls.optimizationStatus, []);
}

(async () => {
  await testOptimizedPayloadPreparesPreflightPlan();
  await testImagePayloadUsesFastSizeWithoutTextClassification();
  await testBlockedPayloadFailsClosed();
  console.log("PASS local file attach preflight orchestration");
})();
