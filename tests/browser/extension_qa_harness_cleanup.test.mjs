import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const harness = await import(pathToFileURL(path.resolve("tests/browser/extension_qa_harness.test.mjs")).href);

function createChild({ exited = true } = {}) {
  return {
    exitCode: exited ? 0 : null,
    signalCode: null,
    killed: false,
    once() {},
    kill() {
      this.killed = true;
      this.exitCode = 0;
      return true;
    }
  };
}

async function testCleanupRejectsNonHarnessTempDir() {
  const tempDir = path.join(os.tmpdir(), "not-leakguard-browser-qa");

  await assert.rejects(
    () =>
      harness.cleanupBrowserQaRun({
        browserName: "Chrome",
        tempDir,
        behaviorChecksPassed: true,
        diagnostics: { warn() {}, log() {} },
        rmFn: async () => {}
      }),
    /Refusing to remove non-harness temp dir/
  );
}

async function testCleanupWarnsAfterPassedBehaviorChecks() {
  const warnings = [];
  const tempDir = path.join(os.tmpdir(), "leakguard-chrome-qa-test");
  const result = await harness.cleanupBrowserQaRun({
    browserName: "Chrome",
    tempDir,
    behaviorChecksPassed: true,
    child: createChild(),
    diagnostics: { warn: (message) => warnings.push(message), log() {} },
    rmFn: async () => {
      const error = new Error("locked");
      error.code = "EPERM";
      throw error;
    },
    cleanupDelayMs: 0
  });

  assert.equal(result.removed, false);
  assert.equal(result.warningOnly, true);
  assert.ok(warnings.some((message) => message.includes("behaviorChecksPassed=true")));
}

async function testCleanupFailsBeforeBehaviorChecksPass() {
  const tempDir = path.join(os.tmpdir(), "leakguard-edge-qa-test");

  await assert.rejects(
    () =>
      harness.cleanupBrowserQaRun({
        browserName: "Edge",
        tempDir,
        behaviorChecksPassed: false,
        child: createChild(),
        diagnostics: { warn() {}, log() {} },
        rmFn: async () => {
          const error = new Error("locked");
          error.code = "EPERM";
          throw error;
        },
        cleanupDelayMs: 0
      }),
    /locked/
  );
}

await testCleanupRejectsNonHarnessTempDir();
await testCleanupWarnsAfterPassedBehaviorChecks();
await testCleanupFailsBeforeBehaviorChecksPass();
console.log("PASS browser QA cleanup regressions");
