const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/content/files/sanitizedFileHandoff.js"));

function createInput() {
  return {
    type: "file",
    files: [],
    events: [],
    dispatchEvent(event) {
      this.events.push(event.type);
      return true;
    }
  };
}

function createTransfer(files) {
  return {
    files,
    items: {
      add() {}
    }
  };
}

function createHandoff(overrides = {}) {
  const calls = {
    marks: [],
    debug: [],
    logs: [],
    replacements: []
  };
  const handoff = globalThis.PWM.SanitizedFileHandoff.createSanitizedFileHandoff({
    EventRef: class {
      constructor(type) {
        this.type = type;
      }
    },
    isFileInputElement: (input) => input?.type === "file",
    isFirefoxRuntime: () => false,
    canAssignFilesToInput: () => true,
    getCurrentHandoffDriverId: () => "chatgpt",
    isProtectedFileDropDriver: () => false,
    markFirefoxFileInputTransactionReplaced: (...args) => calls.replacements.push(args),
    markSanitizedFileHandoff: (...args) => calls.marks.push(args),
    markUntrackedSanitizedFileInputHandoff: () => {},
    deleteSanitizedFileHandoffMark: () => {},
    assignSafeFileAttachErrorMetadata: () => {},
    describeFileForDebug: (file) => ({ name: file?.name || "" }),
    describeFileInputForDebug: () => ({ source: "test" }),
    debugFileAttachMetadata: (label, payload) => calls.debug.push({ label, payload }),
    debugReveal: (label, payload) => calls.debug.push({ label, payload }),
    logFileInterception: (label, payload) => calls.logs.push({ label, payload }),
    createSanitizedDataTransfer: (files) => createTransfer(files),
    dispatchSanitizedFileEvent: () => false,
    prepareFileInputForSanitizedHandoff: () => () => {},
    resolveFileInputForHandoff: () => null,
    shouldUseWhatsAppDocumentInputForFiles: () => false,
    resolveWhatsAppDocumentDropInputForHandoff: async () => null,
    verifyWhatsAppSanitizedMultiFileAttach: () => false,
    ...overrides
  });
  return { handoff, calls };
}

function testSingleInputAssignmentDispatchesInputAndChange() {
  const input = createInput();
  const files = [{ name: "safe.txt" }];
  const details = {};
  const { handoff, calls } = createHandoff();

  assert.strictEqual(handoff.handOffSanitizedFileInput(input, createTransfer(files), { details }), true);
  assert.deepStrictEqual(input.files, files);
  assert.deepStrictEqual(input.events, ["input", "change"]);
  assert.strictEqual(details.inputFilesAssignmentSucceeded, true);
  assert.strictEqual(calls.marks.length, 1);
}

async function testBatchHandoffUsesResolvedInput() {
  const input = createInput();
  const files = [{ name: "one.txt" }, { name: "two.txt" }];
  const { handoff } = createHandoff({
    resolveFileInputForHandoff: () => input
  });

  assert.strictEqual(await handoff.handOffSanitizedFileBatch({ type: "drop" }, null, files, "drop"), true);
  assert.deepStrictEqual(input.files, files);
}

async function testBatchHandoffUsesPreparedFallbackRestore() {
  const input = createInput();
  const files = [{ name: "one.txt" }, { name: "two.txt" }];
  const originalFiles = [{ name: "one.txt" }, { name: "two.txt" }];
  let restored = false;
  const { handoff } = createHandoff({
    resolveFileInputForHandoff: (event, sourceInput, options = {}) => (options.allowIncompatible ? input : null),
    prepareFileInputForSanitizedHandoff: () => () => {
      restored = true;
    },
    verifyWhatsAppSanitizedMultiFileAttach: () => ({ ok: true, assignedCount: 2 })
  });

  assert.strictEqual(
    await handoff.handOffSanitizedFileBatch({ type: "drop" }, null, files, "drop", {
      originalFiles,
      verifyWhatsAppBatch: true
    }),
    true
  );
  assert.deepStrictEqual(input.files, files);
  assert.strictEqual(restored, true);
}

function createSanitizedFixture(name, text) {
  return {
    name,
    type: "text/plain",
    size: text.length,
    lastModified: 777,
    async text() {
      return text;
    }
  };
}

async function testBatchHandoffRenamesMetadataCollisionsWithoutChangingBytesOrOrder() {
  const input = createInput();
  const files = [
    createSanitizedFixture("collision.env", "MARKER=alpha-safe-marker\nPASSWORD=[PWM_1]\n"),
    createSanitizedFixture("collision.env", "MARKER=bravo-safe-marker\nPASSWORD=[PWM_2]\n")
  ];
  let transferredFiles = [];
  const { handoff } = createHandoff({
    createSanitizedDataTransfer: (batch) => {
      transferredFiles = Array.from(batch || []);
      return createTransfer(transferredFiles);
    },
    cloneSanitizedFileWithName: (file, name) => ({
      ...file,
      name,
      async text() {
        return file.text();
      }
    })
  });

  const handedOff = await handoff.handOffSanitizedFileBatch(
    { type: "change", target: input },
    null,
    files,
    "file-input"
  );

  assert.strictEqual(handedOff, true);
  assert.deepStrictEqual(transferredFiles.map((file) => file.name), ["file-1.env", "file-2.env"]);
  assert.deepStrictEqual(input.files, transferredFiles);
  assert.deepStrictEqual(input.events, ["input", "change"], "one sanitized batch should dispatch exactly once");
  assert.notStrictEqual(transferredFiles[0], files[0]);
  assert.notStrictEqual(transferredFiles[1], files[1]);
  assert.deepStrictEqual(
    await Promise.all(transferredFiles.map((file) => file.text())),
    await Promise.all(files.map((file) => file.text())),
    "collision-safe filenames must preserve distinct sanitized bytes and order"
  );
  assert.deepStrictEqual(
    transferredFiles.map((file) => [file.type, file.size, file.lastModified]),
    files.map((file) => [file.type, file.size, file.lastModified])
  );
}

async function testBatchHandoffFailsClosedWhenCollisionCloneFails() {
  const input = createInput();
  const files = [
    createSanitizedFixture("collision.env", "alpha-safe-marker [PWM_1]"),
    createSanitizedFixture("collision.env", "bravo-safe-marker [PWM_2]")
  ];
  let transferCalls = 0;
  const { handoff } = createHandoff({
    cloneSanitizedFileWithName: () => null,
    createSanitizedDataTransfer: (batch) => {
      transferCalls += 1;
      return createTransfer(batch);
    }
  });

  assert.strictEqual(
    await handoff.handOffSanitizedFileBatch({ type: "change", target: input }, null, files, "file-input"),
    false
  );
  assert.strictEqual(transferCalls, 0, "failed sanitized clones must never reach host handoff");
  assert.deepStrictEqual(input.files, []);
  assert.deepStrictEqual(input.events, []);
}

async function testBatchHandoffPreservesCompoundRedactedSuffixes() {
  const input = createInput();
  const files = [
    createSanitizedFixture("report.redacted.pdf", "alpha-safe-marker [PWM_1]"),
    createSanitizedFixture("report.redacted.pdf", "bravo-safe-marker [PWM_2]")
  ];
  let transferredFiles = [];
  const { handoff } = createHandoff({
    createSanitizedDataTransfer: (batch) => {
      transferredFiles = Array.from(batch || []);
      return createTransfer(transferredFiles);
    },
    cloneSanitizedFileWithName: (file, name) => ({ ...file, name }),
    verifyWhatsAppSanitizedMultiFileAttach: (target, expectedFiles) => ({
      ok:
        target.files.length === expectedFiles.length &&
        expectedFiles.every((file, index) => file === target.files[index] && /\.redacted\.pdf$/i.test(file.name)),
      assignedCount: target.files.length,
      expectedCount: expectedFiles.length
    })
  });

  assert.strictEqual(
    await handoff.handOffSanitizedFileBatch({ type: "change", target: input }, null, files, "file-input", {
      originalFiles: [],
      verifyWhatsAppBatch: true
    }),
    true,
    "collision-safe regenerated documents must still satisfy WhatsApp sanitized-name verification"
  );
  assert.deepStrictEqual(transferredFiles.map((file) => file.name), [
    "file-1.redacted.pdf",
    "file-2.redacted.pdf"
  ]);
  assert.deepStrictEqual(input.events, ["input", "change"]);
}

async function testWhatsAppCollisionNormalizationRejectsRawOriginalsBeforeCloning() {
  const input = createInput();
  const rawFiles = [
    createSanitizedFixture("secrets.txt", "RAW_ALPHA"),
    createSanitizedFixture("secrets.txt", "RAW_BRAVO")
  ];
  let cloneCalls = 0;
  let transferCalls = 0;
  const { handoff } = createHandoff({
    cloneSanitizedFileWithName: (file, name) => {
      cloneCalls += 1;
      return { ...file, name };
    },
    createSanitizedDataTransfer: (batch) => {
      transferCalls += 1;
      return createTransfer(batch);
    },
    verifyWhatsAppSanitizedMultiFileAttach: (target, expectedFiles, originalFiles) => {
      const rawOriginals = new Set(originalFiles);
      return {
        ok: expectedFiles.every((file) => !rawOriginals.has(file)),
        assignedCount: target.files.length,
        expectedCount: expectedFiles.length
      };
    }
  });

  assert.strictEqual(
    await handoff.handOffSanitizedFileBatch({ type: "change", target: input }, null, rawFiles, "file-input", {
      originalFiles: rawFiles,
      verifyWhatsAppBatch: true
    }),
    false,
    "duplicate names must not clone away raw-original provenance before WhatsApp verification"
  );
  assert.strictEqual(cloneCalls, 0, "raw originals must be rejected before collision-safe cloning");
  assert.strictEqual(transferCalls, 0, "raw originals must never reach a host DataTransfer");
  assert.deepStrictEqual(input.events, []);
}

async function testBatchHandoffOnlyRenamesCollidingEntries() {
  const input = createInput();
  const files = [
    createSanitizedFixture("collision.env", "alpha-safe-marker [PWM_1]"),
    createSanitizedFixture("collision.env", "bravo-safe-marker [PWM_2]"),
    createSanitizedFixture("audit.json", '{"safe":true}')
  ];
  let transferredFiles = [];
  const { handoff } = createHandoff({
    createSanitizedDataTransfer: (batch) => {
      transferredFiles = Array.from(batch || []);
      return createTransfer(transferredFiles);
    },
    cloneSanitizedFileWithName: (file, name) => ({ ...file, name })
  });

  assert.strictEqual(
    await handoff.handOffSanitizedFileBatch({ type: "change", target: input }, null, files, "file-input"),
    true
  );
  assert.deepStrictEqual(transferredFiles.map((file) => file.name), ["file-1.env", "file-2.env", "audit.json"]);
  assert.strictEqual(transferredFiles[2], files[2], "a unique safe filename should not be regenerated");
}

async function testBatchHandoffNormalizesSingleBlankFilename() {
  const input = createInput();
  const files = [createSanitizedFixture("", "alpha-safe-marker [PWM_1]")];
  let transferredFiles = [];
  const { handoff } = createHandoff({
    createSanitizedDataTransfer: (batch) => {
      transferredFiles = Array.from(batch || []);
      return createTransfer(transferredFiles);
    },
    cloneSanitizedFileWithName: (file, name) => ({ ...file, name })
  });

  assert.strictEqual(
    await handoff.handOffSanitizedFileBatch({ type: "change", target: input }, null, files, "file-input"),
    true
  );
  assert.deepStrictEqual(transferredFiles.map((file) => file.name), ["file-1"]);
  assert.notStrictEqual(transferredFiles[0], files[0]);
}

function testInputHandoffRejectsEmptyTransfer() {
  const input = createInput();
  const { handoff, calls } = createHandoff();

  assert.strictEqual(handoff.handOffSanitizedFileInput(input, createTransfer([]), {}), false);
  assert.deepStrictEqual(input.events, []);
  assert.strictEqual(calls.marks.length, 0);
}

async function testBatchHandoffRejectsEmptyBatchBeforeTransfer() {
  const input = createInput();
  let transferCalls = 0;
  const { handoff } = createHandoff({
    createSanitizedDataTransfer: () => {
      transferCalls += 1;
      return createTransfer([]);
    }
  });

  assert.strictEqual(
    await handoff.handOffSanitizedFileBatch({ type: "change", target: input }, null, [], "file-input"),
    false
  );
  assert.strictEqual(transferCalls, 0);
  assert.deepStrictEqual(input.events, []);
}

async function testBatchHandoffRejectsTruncatedGenericInputAssignment() {
  const input = {
    type: "file",
    events: [],
    _files: [],
    get files() {
      return this._files;
    },
    set files(value) {
      this._files = Array.from(value || []).slice(0, 1);
    },
    dispatchEvent(event) {
      this.events.push(event.type);
      return true;
    }
  };
  const files = [
    createSanitizedFixture("one.env", "alpha-safe-marker [PWM_1]"),
    createSanitizedFixture("two.env", "bravo-safe-marker [PWM_2]")
  ];
  const { handoff } = createHandoff({
    clearLocalFileInputSelection: (target) => {
      target.files = [];
    }
  });

  assert.strictEqual(
    await handoff.handOffSanitizedFileBatch({ type: "change", target: input }, null, files, "file-input"),
    false,
    "generic handoff must reject a host input that retains only part of the sanitized batch"
  );
  assert.deepStrictEqual(input.files, []);
  assert.deepStrictEqual(input.events, [], "partial assignment must fail before host input/change events");
}

async function testBatchHandoffRejectsReorderedGenericInputAssignment() {
  const input = {
    type: "file",
    events: [],
    _files: [],
    get files() {
      return this._files;
    },
    set files(value) {
      this._files = Array.from(value || []).reverse();
    },
    dispatchEvent(event) {
      this.events.push(event.type);
      return true;
    }
  };
  const files = [
    createSanitizedFixture("one.env", "alpha-safe-marker [PWM_1]"),
    createSanitizedFixture("two.env", "bravo-safe-marker [PWM_2]")
  ];
  const { handoff } = createHandoff({
    clearLocalFileInputSelection: (target) => {
      target._files = [];
    }
  });

  assert.strictEqual(
    await handoff.handOffSanitizedFileBatch({ type: "change", target: input }, null, files, "file-input"),
    false,
    "generic handoff must reject a same-count batch with changed sanitized file order"
  );
  assert.deepStrictEqual(input.files, []);
  assert.deepStrictEqual(input.events, [], "identity/order mismatch must fail before host input/change events");
}

async function run() {
  testSingleInputAssignmentDispatchesInputAndChange();
  await testBatchHandoffUsesResolvedInput();
  await testBatchHandoffUsesPreparedFallbackRestore();
  await testBatchHandoffRenamesMetadataCollisionsWithoutChangingBytesOrOrder();
  await testBatchHandoffFailsClosedWhenCollisionCloneFails();
  await testBatchHandoffPreservesCompoundRedactedSuffixes();
  await testWhatsAppCollisionNormalizationRejectsRawOriginalsBeforeCloning();
  await testBatchHandoffOnlyRenamesCollidingEntries();
  await testBatchHandoffNormalizesSingleBlankFilename();
  testInputHandoffRejectsEmptyTransfer();
  await testBatchHandoffRejectsEmptyBatchBeforeTransfer();
  await testBatchHandoffRejectsTruncatedGenericInputAssignment();
  await testBatchHandoffRejectsReorderedGenericInputAssignment();
  console.log("PASS sanitized file handoff");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
