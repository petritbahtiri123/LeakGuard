const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/content/files/fileTransferPolicy.js"));

function createEvent() {
  return {
    defaultPrevented: false,
    target: {
      tagName: "INPUT",
      type: "file"
    },
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopped: false,
    stopPropagation() {
      this.stopped = true;
    }
  };
}

function createGate(overrides = {}) {
  const calls = {
    badges: [],
    clearedInputs: [],
    consumed: 0,
    errors: [],
    hiddenOverlays: [],
    hiddenBadges: [],
    modals: [],
    notices: [],
    refreshed: 0
  };
  const gate = globalThis.PWM.FileTransferPolicy.createLocalFileTransferPolicyGate({
    clearLocalFileInputSelection: (input) => calls.clearedInputs.push(input),
    consumeInterceptionEvent: (event) => {
      calls.consumed += 1;
      event.preventDefault();
      event.stopPropagation();
    },
    getCurrentHandoffDriverId: () => "chatgpt",
    getUnsupportedFileBlockedMessage: (policy) => policy.message || "blocked message",
    getUnsupportedFileBlockedTitle: () => "Raw archive upload blocked",
    hideBadgeSoon: (delayMs) => calls.hiddenBadges.push(delayMs),
    hideFileProcessingOverlay: (reason) => calls.hiddenOverlays.push(reason),
    refreshBadgeFromCurrentInput: () => {
      calls.refreshed += 1;
    },
    setBadge: (message) => calls.badges.push(message),
    shouldBlockUnsupportedFileTransfer: () => false,
    shouldFailClosedProtectedUnsupportedFileTransfer: () => false,
    showFileProcessingError: (title, details) => calls.errors.push({ title, details }),
    showMessageModal: async (title, message) => calls.modals.push({ title, message }),
    showUnsupportedFilePassThroughNotice: (policy) => calls.notices.push(policy),
    ...overrides
  });
  return { gate, calls };
}

async function testAllowPolicyFailsClosedBeforeRawFallback() {
  const { gate, calls } = createGate({
    shouldFailClosedProtectedUnsupportedFileTransfer: () => true
  });
  const event = createEvent();
  const policy = {
    action: "allow",
    reason: "unsupported_file_pass_through",
    message: "zip files are unsupported"
  };

  const result = await gate.maybeHandleLocalFileTransferPolicy(event, policy, {
    contentExtractionFile: null
  });

  assert.deepStrictEqual(result, {
    handled: true,
    ok: false,
    reason: "unsupported_protected_file_blocked"
  });
  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(event.stopped, true);
  assert.strictEqual(calls.consumed, 1);
  assert.strictEqual(calls.clearedInputs.length, 1);
  assert.deepStrictEqual(calls.errors, [
    {
      title: "Raw archive upload blocked",
      details: {
        site: "chatgpt",
        reason: "unsupported_protected_file_blocked"
      }
    }
  ]);
  assert.deepStrictEqual(calls.hiddenOverlays, ["unsupported_protected_file_blocked"]);
  assert.deepStrictEqual(calls.badges, ["Raw archive upload blocked"]);
  assert.strictEqual(calls.modals[0].message, "zip files are unsupported");
  assert.strictEqual(calls.notices.length, 0);
  assert.strictEqual(calls.refreshed, 1);
}

async function testAllowPolicyCanPassThroughWhenSafe() {
  const { gate, calls } = createGate();
  const event = createEvent();
  const policy = {
    action: "allow",
    reason: "unsupported_file_pass_through"
  };

  const result = await gate.maybeHandleLocalFileTransferPolicy(event, policy, {
    contentExtractionFile: null
  });

  assert.strictEqual(result, false);
  assert.strictEqual(event.defaultPrevented, false);
  assert.strictEqual(calls.consumed, 0);
  assert.strictEqual(calls.notices.length, 1);
  assert.strictEqual(calls.errors.length, 0);
}

(async () => {
  await testAllowPolicyFailsClosedBeforeRawFallback();
  await testAllowPolicyCanPassThroughWhenSafe();
  console.log("PASS file transfer policy gate");
})();
