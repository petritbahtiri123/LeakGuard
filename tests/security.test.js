const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { pathToFileURL } = require("url");

const repoRoot = path.join(__dirname, "..");
require(path.join(repoRoot, "src/shared/placeholders.js"));
require(path.join(repoRoot, "src/shared/sessionMapStore.js"));
require(path.join(repoRoot, "src/content/diagnostics/safeSnapshots.js"));
const contentSource = fs.readFileSync(path.join(repoRoot, "src/content/content.js"), "utf8");
const responseObserverSource = fs.readFileSync(
  path.join(repoRoot, "src/content/rehydration/responseObserver.js"),
  "utf8"
);
const revealControllerSource = fs.readFileSync(
  path.join(repoRoot, "src/content/rehydration/revealController.js"),
  "utf8"
);
const fileHandoffFlowSource = fs.readFileSync(
  path.join(repoRoot, "src/content/file_handoff_flow.js"),
  "utf8"
);
const geminiFallbackWriterSource = fs.readFileSync(
  path.join(repoRoot, "src/content/adapters/geminiFallbackWriter.js"),
  "utf8"
);
const backgroundSource = fs.readFileSync(
  path.join(repoRoot, "src/background/core.js"),
  "utf8"
);
const platformSource = fs.readFileSync(path.join(repoRoot, "src/compat/platform.js"), "utf8");
const filePasteHelperSource = fs.readFileSync(
  path.join(repoRoot, "src/content/file_paste_helpers.js"),
  "utf8"
);
const fileExtractorsSource = fs.readFileSync(
  path.join(repoRoot, "src/shared/fileExtractors.js"),
  "utf8"
);
const fileScannerSource = fs.readFileSync(
  path.join(repoRoot, "src/shared/fileScanner.js"),
  "utf8"
);
const scannerSource = fs.readFileSync(path.join(repoRoot, "src/scanner/scanner.js"), "utf8");
const fileAttachPipelineSource = fs.readFileSync(
  path.join(repoRoot, "src/content/files/fileAttachPipeline.js"),
  "utf8"
);
const popupSource = fs.readFileSync(path.join(repoRoot, "src/popup/popup.js"), "utf8");
const harnessSource = fs.readFileSync(
  path.join(repoRoot, "sandbox/composer-harness.js"),
  "utf8"
);
const {
  PLACEHOLDER_TOKEN_REGEX,
  PlaceholderManager,
  createSessionState,
  migrateSessionState,
  normalizeTransformMode,
  DEFAULT_TRANSFORM_MODE,
  normalizeVisiblePlaceholders,
  canonicalizePlaceholderToken,
  containsLegacyTypedPlaceholder
} = globalThis.PWM;

function assertNotIncludes(source, needle, message) {
  assert.strictEqual(source.includes(needle), false, message);
}

function extractFunctionSource(source, name) {
  const match = source.match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`));
  assert.ok(match, `expected to find function ${name}`);
  return match[0];
}

function createStorageArea(store) {
  return {
    async get(keys) {
      if (keys === null || keys === undefined) return { ...store };
      const requested = Array.isArray(keys) ? keys : [keys];
      return requested.reduce((output, key) => {
        if (Object.prototype.hasOwnProperty.call(store, key)) output[key] = store[key];
        return output;
      }, {});
    },
    async set(values) {
      Object.assign(store, values);
    },
    async remove(keys) {
      const requested = Array.isArray(keys) ? keys : [keys];
      requested.forEach((key) => {
        delete store[key];
      });
    }
  };
}

function createBackgroundSecuritySandbox({ allowReveal = true, auditMode = "metadata-only" } = {}) {
  const storageState = {};
  const storageArea = createStorageArea(storageState);
  const noopEvent = { addListener() {} };
  const ext = {
    action: {},
    permissions: {
      contains: async () => true,
      remove: async () => true,
      onAdded: noopEvent,
      onRemoved: noopEvent
    },
    runtime: {
      id: "security-test-extension",
      getURL: (relativePath = "") => `chrome-extension://security-test/${relativePath}`,
      onInstalled: noopEvent,
      onMessage: noopEvent,
      onStartup: noopEvent,
      openOptionsPage: async () => {}
    },
    storage: {
      local: storageArea,
      onChanged: noopEvent
    },
    scripting: {
      executeScript: async () => {},
      getRegisteredContentScripts: async () => [],
      insertCSS: async () => {},
      registerContentScripts: async () => {},
      unregisterContentScripts: async () => {}
    },
    tabs: {
      onRemoved: noopEvent,
      reload: async () => {},
      sendMessage: async () => ({ ok: true })
    }
  };
  const sandbox = {
    URL,
    Promise,
    console,
    setTimeout,
    clearTimeout,
    queueMicrotask,
    crypto: {
      randomUUID: () => `security-${Object.keys(storageState).length + 1}`
    }
  };

  sandbox.globalThis = sandbox;
  sandbox.PWM = {
    PlaceholderManager,
    canonicalizePlaceholderToken,
    createSessionState,
    migrateSessionState,
    normalizeTransformMode,
    DEFAULT_TRANSFORM_MODE,
    Detector: null,
    transformOutboundPrompt: () => ({ redactedText: "", replacements: [] }),
    BUILTIN_PROTECTED_SITES: [],
    USER_PROTECTED_SITES_STORAGE_KEY: "security:sites",
    normalizeProtectedSiteInput: () => ({ ok: false, error: "not used" }),
    normalizeProtectedSiteList: (rules) => (Array.isArray(rules) ? rules : []),
    isBuiltinProtectedSiteRule: () => false,
    loadPolicy: async () => ({
      policy: {
        allowReveal,
        allowSiteRemoval: true,
        allowUserAddedSites: true,
        managedProtectedSites: []
      }
    }),
    getPolicySummary: async () => ({
      auditMode,
      enterpriseMode: true
    }),
    evaluateDestinationPolicy: () => ({ blocked: false }),
    invalidatePolicyCache: () => {},
    ext,
    supportsDynamicContentScripts: true,
    supportsStorageSession: false,
    getSessionStorageArea: () => storageArea
  };

  vm.runInNewContext(backgroundSource, sandbox, {
    filename: "core.js"
  });

  return { sandbox, storageState };
}

function testUnsafeContentRevealPathRemoved() {
  assertNotIncludes(
    contentSource,
    "PWM_GET_RAW_BY_PLACEHOLDER",
    "content script must not request raw secrets for page rendering"
  );
  assertNotIncludes(
    backgroundSource,
    "PWM_GET_RAW_BY_PLACEHOLDER",
    "background must not expose the legacy raw placeholder lookup handler"
  );
  assertNotIncludes(
    contentSource,
    "lookupRawByPlaceholder",
    "legacy page-DOM raw lookup helper should be removed"
  );
  assertNotIncludes(
    contentSource,
    "span.textContent = raw",
    "content script must never write revealed raw values into page DOM"
  );
}

function testSafeRevealUiExists() {
  assert.ok(
    contentSource.includes("PWM_OPEN_POPUP_REVEAL"),
    "content script should stage opaque reveal requests for the popup"
  );
  assert.ok(
    !contentSource.includes("window.open("),
    "content script should no longer open a separate reveal window"
  );
  assert.ok(
    backgroundSource.includes("PWM_EXTENSION_REVEAL_SECRET"),
    "background should expose a reveal handler for extension UI"
  );
  assert.ok(
    backgroundSource.includes("isRuntimeUiSender"),
    "background reveal handler should verify extension UI sender context"
  );
  assert.ok(
    backgroundSource.includes("requestMatchesState"),
    "background reveal handler should bind reveal requests to the active tab session"
  );
  assert.ok(
    popupSource.includes("secretValueEl.textContent = response.raw"),
    "raw secret rendering should be confined to the extension-owned popup UI"
  );
}

async function testSessionStorageFallbackIsEphemeralOnly() {
  let localGetCalls = 0;
  let localSetCalls = 0;
  let localRemoveCalls = 0;
  const sandbox = {
    navigator: { userAgent: "TestBrowser" },
    chrome: {
      storage: {
        local: {
          async get() {
            localGetCalls += 1;
            return {};
          },
          async set() {
            localSetCalls += 1;
          },
          async remove() {
            localRemoveCalls += 1;
          }
        }
      }
    }
  };
  sandbox.globalThis = sandbox;

  vm.runInNewContext(platformSource, sandbox, {
    filename: "platform.js"
  });

  const sessionArea = sandbox.PWM.getSessionStorageArea();
  await sessionArea.set({
    privateState: {
      raw: "SessionOnlySecret123",
      placeholder: "[PWM_1]"
    }
  });
  const loaded = await sessionArea.get("privateState");
  loaded.privateState.raw = "mutated";
  const loadedAgain = await sessionArea.get("privateState");
  await sessionArea.remove("privateState");
  const removed = await sessionArea.get("privateState");

  assert.strictEqual(sandbox.PWM.supportsStorageSession, false);
  assert.strictEqual(sandbox.PWM.usingEphemeralSessionStorage, true);
  assert.strictEqual(loadedAgain.privateState.raw, "SessionOnlySecret123");
  assert.deepStrictEqual(Object.keys(removed), []);
  assert.strictEqual(localGetCalls + localSetCalls + localRemoveCalls, 0);
  assertNotIncludes(
    platformSource,
    "ext.storage.local",
    "session storage fallback must not persist private placeholder/reveal state in storage.local"
  );
}

function testAuditMetadataObjectsExcludeRawSecrets() {
  const { sandbox } = createBackgroundSecuritySandbox();
  const rawSecret = "AuditBoundarySecret123!";
  const rawApiKey = "AuditApiKeyBoundary123456";
  const entry = sandbox.buildAuditEventEntry({
    action: "blocked",
    reason: "destination_not_approved",
    url: `https://chat.example.com/path?token=${rawSecret}`,
    findings: [
      {
        type: "PASSWORD",
        placeholderType: "PASSWORD",
        raw: rawSecret
      },
      {
        type: "API_KEY",
        placeholderType: "API_KEY",
        raw: rawApiKey
      }
    ],
    policySummary: {
      auditMode: "metadata-only",
      enterpriseMode: true
    }
  });
  const serialized = JSON.stringify(entry);

  assert.strictEqual(serialized.includes(rawSecret), false, "audit metadata must exclude raw password text");
  assert.strictEqual(serialized.includes(rawApiKey), false, "audit metadata must exclude raw API key text");
  assert.strictEqual(serialized.includes(`/path?token=${rawSecret}`), false, "audit metadata must exclude full URLs");
  assert.strictEqual(entry.urlOrigin, "https://chat.example.com");
  assert.strictEqual(entry.siteHost, "chat.example.com");
  assert.deepStrictEqual(Array.from(entry.findingTypes).sort(), ["api_key", "password"]);
}

async function testSecureRevealRemainsBoundedToRequestSessionAndExtensionUi() {
  const { sandbox, storageState } = createBackgroundSecuritySandbox();
  const rawSecret = "RevealBoundarySecret123!";
  const tabId = 7;
  const state = createSessionState("https://chat.example.com/thread");
  const manager = new PlaceholderManager();
  manager.setPrivateState(state);
  const placeholder = manager.getPlaceholder(rawSecret);
  const privateState = {
    ...state,
    ...manager.exportPrivateState()
  };

  storageState[`pwm:tab:${tabId}`] = privateState;

  const requestId = await sandbox.createRevealRequest(tabId, placeholder);
  const requestKey = `pwm:reveal:${requestId}`;
  const requestJson = JSON.stringify(storageState[requestKey]);
  const context = await sandbox.getRevealContext(requestId);

  assert.strictEqual(requestJson.includes(rawSecret), false, "reveal request metadata must not store raw secret text");
  assert.strictEqual(context.available, true, "known placeholder should be revealable in the matching session");
  assert.strictEqual(JSON.stringify(context).includes(rawSecret), false, "reveal context must not include raw secret text");
  assert.strictEqual(await sandbox.revealSecret(requestId), rawSecret, "extension reveal flow should recover the raw value");

  storageState[requestKey] = {
    ...storageState[requestKey],
    sessionId: "wrong-session"
  };

  assert.strictEqual(await sandbox.revealSecret(requestId), null, "mismatched sessions must not reveal raw values");
}

function testPlaceholderLabelsDoNotExposeRawValues() {
  const createSecretSpanSource = extractFunctionSource(revealControllerSource, "createSecretSpan");
  const renderRevealContextSource = extractFunctionSource(popupSource, "renderRevealContext");

  assert.ok(
    createSecretSpanSource.includes("span.textContent = placeholder"),
    "page placeholder labels should render only the placeholder token"
  );
  assert.ok(
    createSecretSpanSource.includes(
      'span.setAttribute("aria-label", "LeakGuard redacted sensitive content. Open secure reveal in LeakGuard.")'
    ),
    "page placeholder aria labels should stay generic"
  );
  assertNotIncludes(
    createSecretSpanSource,
    ".raw",
    "page placeholder labels must not read raw secret fields"
  );
  assert.ok(
    renderRevealContextSource.includes('revealPlaceholderEl.textContent = context?.placeholder || "[PWM]"'),
    "popup reveal context should label the selected placeholder, not the raw value"
  );
  assertNotIncludes(
    renderRevealContextSource,
    "context.raw",
    "popup reveal context must not render raw values before explicit reveal"
  );
}

function testLocalFilePasteDoesNotExposeRawFileContent() {
  const fileInsertSource = extractFunctionSource(contentSource, "maybeHandleLocalFileInsert");
  const localFileSource = `${filePasteHelperSource}\n${fileInsertSource}`;

  assert.ok(
    localFileSource.includes("validateFileForTextScan") &&
      localFileSource.includes("decodeUtf8Text"),
    "local file paste/drop should reuse file scanner validation and UTF-8 decoding"
  );
  assert.ok(
    fileInsertSource.includes("consumeInterceptionEvent(event);") &&
      fileInsertSource.indexOf("consumeInterceptionEvent(event);") <
        fileInsertSource.indexOf("readLocalTextFileFromDataTransfer(dataTransfer)"),
    "local file paste/drop should prevent host delivery before reading local file bytes"
  );
  assert.ok(
    localFileSource.includes("requestRedaction(analysis.normalizedText, analysis.secretFindings)"),
    "local file paste/drop should use background-owned placeholder redaction"
  );
  assert.ok(
    localFileSource.includes("createSanitizedTextFile(localFile.file, result.redactedText)") &&
      localFileSource.includes("handOffSanitizedLocalFile(event, input, sanitizedFile, context)") &&
      fileHandoffFlowSource.includes("function handOffSanitizedLocalFile") &&
      contentSource.includes("fileInput.files = transfer.files") &&
      contentSource.includes("function handOffGeminiSanitizedFileUpload") &&
      contentSource.includes("function handOffGrokSanitizedFileUpload") &&
      contentSource.includes("file-handoff:fail-closed"),
    "local file paste/drop should create sanitized in-memory files and use native upload adapters for site file drops"
  );
  assert.ok(
    (localFileSource.includes("sanitized_file_handoff_failed") ||
      fileAttachPipelineSource.includes("sanitized_file_handoff_failed")) &&
      fileHandoffFlowSource.includes("handoffSanitizedPayload") &&
      fileHandoffFlowSource.includes("downloadSanitizedFileFallback") &&
      fileHandoffFlowSource.includes("formatSanitizedFileFallbackText(payload)") &&
      localFileSource.includes("LeakGuard blocked raw file upload. Sanitized file handoff failed"),
    "local file paste/drop should fail closed only after sanitized attachment, sanitized text fallback, and sanitized download fallback cannot be completed"
  );
  assert.ok(
    contentSource.includes("async function applySanitizedTextFallback") &&
      geminiFallbackWriterSource.includes("async function applyGeminiSanitizedTextFallback") &&
      contentSource.includes("createGeminiFallbackWriter") &&
      contentSource.includes("Sanitized content inserted as text because the site did not accept a sanitized file upload.") &&
      contentSource.includes("Sanitized content inserted as text because Gemini rejected sanitized file upload.") &&
      contentSource.includes('"file-text-fallback"') &&
      !contentSource.includes("async function applyLocalFileRedactedText") &&
      !contentSource.includes("setInputTextDirect(input, next.text") &&
      !contentSource.includes("insertContentEditableTextCommand(input, next.text"),
    "local file paste/drop text fallback should only insert sanitized text after a sanitized handoff failure"
  );
  assertNotIncludes(
    localFileSource,
    "scanTextContent(",
    "composer file insertion must not use the scanner's independent PlaceholderManager"
  );
  assertNotIncludes(
    localFileSource,
    "console.log",
    "local file paste/drop helper must not log local file contents"
  );
  assertNotIncludes(
    localFileSource,
    "console.error",
    "local file paste/drop helper must not log local file contents on errors"
  );
  assertNotIncludes(
    localFileSource,
    "localStorage",
    "local file paste/drop helper must not persist local file contents"
  );
  assertNotIncludes(
    localFileSource,
    "sessionStorage",
    "local file paste/drop helper must not persist local file contents"
  );
}

function testFileAttachPipelineStaysPureAndContentOwnsFileAttachSideEffects() {
  const fileInsertSource = extractFunctionSource(contentSource, "maybeHandleLocalFileInsert");
  const contentOwnedSideEffects = [
    "consumeInterceptionEvent(event);",
    "readLocalTextFileFromDataTransfer(dataTransfer)",
    "streamRedactLocalTextFile(localFile.sourceFile, localFile.file)",
    "handOffSanitizedLocalFile(event, input, sanitizedFile, context)",
    "queuePendingSanitizedFileHandoff(",
    "showFileProcessingOverlay({",
    "showFileProcessingError(",
    "setBadge(",
    "showMessageModal("
  ];
  for (const sideEffect of contentOwnedSideEffects) {
    assert.ok(
      fileInsertSource.includes(sideEffect),
      `maybeHandleLocalFileInsert should continue to own file attach side effect: ${sideEffect}`
    );
  }

  const forbiddenDirectApis = [
    "document.",
    "documentRef",
    ".querySelector",
    ".querySelectorAll",
    ".createElement",
    ".dispatchEvent",
    ".addEventListener",
    ".removeEventListener",
    ".preventDefault",
    ".stopPropagation",
    ".stopImmediatePropagation",
    "DataTransfer",
    "FileReader",
    "MutationObserver",
    "HTMLElement",
    "HTMLInputElement",
    ".files =",
    ".click(",
    ".showPicker(",
    "globalThis.browser",
    "globalThis.chrome",
    "ext.runtime",
    "browser.",
    "chrome.",
    "queuePendingSanitizedFileHandoff",
    "clearPendingSanitizedFileHandoff",
    "attemptPendingSanitizedFileHandoff",
    "pendingGeminiSanitizedFileHandoff",
    "pendingGrokSanitizedFileHandoff"
  ];
  for (const forbidden of forbiddenDirectApis) {
    assertNotIncludes(
      fileAttachPipelineSource,
      forbidden,
      `FileAttachPipeline helpers must stay pure and avoid direct side effects: ${forbidden}`
    );
  }

  assert.ok(
      fileAttachPipelineSource.includes("classifyPendingAttachFallbackDecision") &&
      fileAttachPipelineSource.includes("classifyFileAttachDisposition") &&
      fileAttachPipelineSource.includes("classifyFileAttachPreflightPlan") &&
      fileAttachPipelineSource.includes("classifyStreamingAttachPlan") &&
      fileAttachPipelineSource.includes("runSanitizedPayloadHandoffOrder") &&
      fileAttachPipelineSource.includes("runSanitizedFileAttachFlow"),
    "FileAttachPipeline should remain limited to data construction, classification, and injected callbacks"
  );
}

function testFileSnapshotDebugPayloadsStayMetadataOnly() {
  const rawSecret = "SnapshotPayloadRawSecret123!";
  const file = {
    name: "service.env",
    type: "text/plain",
    size: 123,
    lastModified: 456,
    text: `API_KEY=${rawSecret}`,
    raw: rawSecret,
    path: `C:\\fakepath\\${rawSecret}.env`
  };
  const description = globalThis.PWM.SafeSnapshots.describeFileForDebug(file);
  const metadata = globalThis.PWM.SafeSnapshots.originalFileMetadataFromLocalFile({
    text: `API_KEY=${rawSecret}`,
    file
  });
  const snapshotSourceStart = contentSource.indexOf("function describeDataTransferFileSnapshot");
  const snapshotSourceEnd = contentSource.indexOf("function snapshotLocalFileDataTransfer", snapshotSourceStart);
  assert.notStrictEqual(snapshotSourceStart, -1, "expected DataTransfer snapshot debug helper");
  assert.notStrictEqual(snapshotSourceEnd, -1, "expected snapshot helper boundary");
  const describeSnapshotSource = contentSource.slice(snapshotSourceStart, snapshotSourceEnd);

  assert.deepStrictEqual(Object.keys(description), ["name", "type", "size"]);
  assert.deepStrictEqual(Object.keys(metadata), ["name", "type", "size", "lastModified"]);
  assert.strictEqual(JSON.stringify({ description, metadata }).includes(rawSecret), false);
  assertNotIncludes(
    describeSnapshotSource,
    "file.name",
    "DataTransfer snapshot debug payloads must not include file names or raw path-like values"
  );
  assertNotIncludes(
    describeSnapshotSource,
    ".text",
    "DataTransfer snapshot debug payloads must not read or include file text"
  );
  assertNotIncludes(
    describeSnapshotSource,
    "arrayBuffer",
    "DataTransfer snapshot debug payloads must not read file bytes"
  );
}

function testDocumentExtractionDoesNotWriteRawTextToDebugStorageOrAuditSurfaces() {
  for (const [label, source] of [
    ["fileExtractors", fileExtractorsSource],
    ["fileScanner", fileScannerSource],
    ["scanner page", scannerSource]
  ]) {
    assertNotIncludes(source, "localStorage", `${label} must not persist extracted PDF/DOCX/XLSX text to localStorage`);
    assertNotIncludes(source, "sessionStorage", `${label} must not persist extracted PDF/DOCX/XLSX text to sessionStorage`);
    assertNotIncludes(source, "chrome.storage", `${label} must not persist extracted PDF/DOCX/XLSX text to extension storage`);
    assertNotIncludes(source, "browser.storage", `${label} must not persist extracted PDF/DOCX/XLSX text to extension storage`);
    assertNotIncludes(source, "pwm:audit", `${label} must not write extracted PDF/DOCX/XLSX text to audit metadata`);
  }

  for (const [label, source] of [
    ["fileExtractors", fileExtractorsSource],
    ["fileScanner", fileScannerSource]
  ]) {
    assertNotIncludes(source, "console.log", `${label} must not log extracted PDF/DOCX/XLSX text`);
    assertNotIncludes(source, "console.error", `${label} must not log extracted document extraction failures`);
    assertNotIncludes(source, "debugReveal", `${label} must not send extracted document text to debug diagnostics`);
    assertNotIncludes(source, "debugLogSnapshot", `${label} must not send extracted document text to debug diagnostics`);
    assertNotIncludes(source, "debugFileAttachMetadata", `${label} must not send document text to file metadata debug logs`);
  }

  assert.ok(
    scannerSource.includes("result.redactedPreview") &&
      scannerSource.includes("finding.preview") &&
      scannerSource.includes("buildSanitizedReport(currentScanResult)"),
    "scanner DOM/report paths should use sanitized scanner outputs, not raw extracted document text directly"
  );
  assertNotIncludes(
    scannerSource,
    "downloadBlob(currentScanResult.redactedText",
    "scanner downloads should not bypass the redacted-copy helper path"
  );
}

function testStaticAndDynamicFilePasteInjectionOrderStaysAligned() {
  const baseManifest = JSON.parse(fs.readFileSync(path.join(repoRoot, "manifests/base.json"), "utf8"));
  const staticScripts = baseManifest.content_scripts[0].js;
  const dynamicScripts = Array.from(
    backgroundSource.matchAll(
      /"([^"]+(?:fileLimits|fileTypeRegistry|fileExtractors|fileScanner|file_paste_helpers|file_handoff_state|file_handoff_pending|file_handoff_flow|rewriteVerificationText|fileTransferPolicy|hostMatching|chatgptAdapter|openaiAdapter|geminiDiagnosticsAdapter|geminiAdapter|claudeAdapter|grokAdapter|xAdapter|index|geminiFallbackWriter|safeSnapshots|fileAttachPipeline|placeholderRehydrator|responseObserver|revealController|debugLogger|eventBindings|content)\.js)"/g
    )
  ).map((match) => match[1]);
  const adapterScripts = [
    "content/adapters/chatgptAdapter.js",
    "content/adapters/openaiAdapter.js",
    "content/adapters/geminiAdapter.js",
    "content/adapters/claudeAdapter.js",
    "content/adapters/grokAdapter.js",
    "content/adapters/xAdapter.js",
    "content/adapters/index.js"
  ];

  const staticFileLimits = staticScripts.indexOf("shared/fileLimits.js");
  const staticFileTypeRegistry = staticScripts.indexOf("shared/fileTypeRegistry.js");
  const staticFileExtractors = staticScripts.indexOf("shared/fileExtractors.js");
  const staticFileScanner = staticScripts.indexOf("shared/fileScanner.js");
  const staticFilePaste = staticScripts.indexOf("content/file_paste_helpers.js");
  const staticFileHandoffState = staticScripts.indexOf("content/file_handoff_state.js");
  const staticFileHandoffPending = staticScripts.indexOf("content/file_handoff_pending.js");
  const staticFileHandoffFlow = staticScripts.indexOf("content/file_handoff_flow.js");
  const staticRewriteVerificationText = staticScripts.indexOf("content/input/rewriteVerificationText.js");
  const staticFileTransferPolicy = staticScripts.indexOf("content/files/fileTransferPolicy.js");
  const staticHostMatching = staticScripts.indexOf("content/adapters/hostMatching.js");
  const staticAdapterIndexes = adapterScripts.map((script) => staticScripts.indexOf(script));
  const staticGeminiFallbackWriter = staticScripts.indexOf("content/adapters/geminiFallbackWriter.js");
  const staticSafeSnapshots = staticScripts.indexOf("content/diagnostics/safeSnapshots.js");
  const staticFileAttachPipeline = staticScripts.indexOf("content/files/fileAttachPipeline.js");
  const staticPlaceholderRehydrator = staticScripts.indexOf("content/rehydration/placeholderRehydrator.js");
  const staticResponseObserver = staticScripts.indexOf("content/rehydration/responseObserver.js");
  const staticRevealController = staticScripts.indexOf("content/rehydration/revealController.js");
  const staticDebugLogger = staticScripts.indexOf("content/diagnostics/debugLogger.js");
  const staticContentEventBindings = staticScripts.indexOf("content/bootstrap/eventBindings.js");
  const staticContent = staticScripts.indexOf("content/content.js");
  const dynamicFileLimits = dynamicScripts.indexOf("shared/fileLimits.js");
  const dynamicFileTypeRegistry = dynamicScripts.indexOf("shared/fileTypeRegistry.js");
  const dynamicFileExtractors = dynamicScripts.indexOf("shared/fileExtractors.js");
  const dynamicFileScanner = dynamicScripts.indexOf("shared/fileScanner.js");
  const dynamicFilePaste = dynamicScripts.indexOf("content/file_paste_helpers.js");
  const dynamicFileHandoffState = dynamicScripts.indexOf("content/file_handoff_state.js");
  const dynamicFileHandoffPending = dynamicScripts.indexOf("content/file_handoff_pending.js");
  const dynamicFileHandoffFlow = dynamicScripts.indexOf("content/file_handoff_flow.js");
  const dynamicRewriteVerificationText = dynamicScripts.indexOf("content/input/rewriteVerificationText.js");
  const dynamicFileTransferPolicy = dynamicScripts.indexOf("content/files/fileTransferPolicy.js");
  const dynamicHostMatching = dynamicScripts.indexOf("content/adapters/hostMatching.js");
  const dynamicAdapterIndexes = adapterScripts.map((script) => dynamicScripts.indexOf(script));
  const dynamicGeminiFallbackWriter = dynamicScripts.indexOf("content/adapters/geminiFallbackWriter.js");
  const dynamicSafeSnapshots = dynamicScripts.indexOf("content/diagnostics/safeSnapshots.js");
  const dynamicFileAttachPipeline = dynamicScripts.indexOf("content/files/fileAttachPipeline.js");
  const dynamicPlaceholderRehydrator = dynamicScripts.indexOf("content/rehydration/placeholderRehydrator.js");
  const dynamicResponseObserver = dynamicScripts.indexOf("content/rehydration/responseObserver.js");
  const dynamicRevealController = dynamicScripts.indexOf("content/rehydration/revealController.js");
  const dynamicDebugLogger = dynamicScripts.indexOf("content/diagnostics/debugLogger.js");
  const dynamicContentEventBindings = dynamicScripts.indexOf("content/bootstrap/eventBindings.js");
  const dynamicContent = dynamicScripts.indexOf("content/content.js");

  assert.ok(
    staticFileLimits > -1 &&
      staticFileTypeRegistry > -1 &&
      staticFileExtractors > -1 &&
      staticFileScanner > -1 &&
      staticFilePaste > -1 &&
      staticFileHandoffState > -1 &&
      staticFileHandoffPending > -1 &&
      staticFileHandoffFlow > -1 &&
      staticRewriteVerificationText > -1 &&
      staticFileTransferPolicy > -1 &&
      staticHostMatching > -1 &&
      staticAdapterIndexes.every((index) => index > -1) &&
      staticGeminiFallbackWriter > -1 &&
      staticSafeSnapshots > -1 &&
      staticFileAttachPipeline > -1 &&
      staticPlaceholderRehydrator > -1 &&
      staticResponseObserver > -1 &&
      staticRevealController > -1 &&
      staticDebugLogger > -1 &&
      staticContentEventBindings > -1 &&
      staticContent > -1,
    "static manifest should include file limits, scanner, file paste helper, file handoff helpers, adapter helpers, pure helpers, and content script"
  );
  assert.ok(
    dynamicFileLimits > -1 &&
      dynamicFileTypeRegistry > -1 &&
      dynamicFileExtractors > -1 &&
      dynamicFileScanner > -1 &&
      dynamicFilePaste > -1 &&
      dynamicFileHandoffState > -1 &&
      dynamicFileHandoffPending > -1 &&
      dynamicFileHandoffFlow > -1 &&
      dynamicRewriteVerificationText > -1 &&
      dynamicFileTransferPolicy > -1 &&
      dynamicHostMatching > -1 &&
      dynamicAdapterIndexes.every((index) => index > -1) &&
      dynamicGeminiFallbackWriter > -1 &&
      dynamicSafeSnapshots > -1 &&
      dynamicFileAttachPipeline > -1 &&
      dynamicPlaceholderRehydrator > -1 &&
      dynamicResponseObserver > -1 &&
      dynamicRevealController > -1 &&
      dynamicDebugLogger > -1 &&
      dynamicContentEventBindings > -1 &&
      dynamicContent > -1,
    "dynamic injection should include file limits, scanner, file paste helper, file handoff helpers, adapter helpers, pure helpers, and content script"
  );
  const staticAdapterOrderAligned = staticAdapterIndexes.every(
    (index, offset) => offset === 0 || staticAdapterIndexes[offset - 1] < index
  );
  const dynamicAdapterOrderAligned = dynamicAdapterIndexes.every(
    (index, offset) => offset === 0 || dynamicAdapterIndexes[offset - 1] < index
  );
  assert.ok(
    staticFileLimits < staticFileTypeRegistry &&
      staticFileTypeRegistry < staticFileExtractors &&
      staticFileExtractors < staticFileScanner &&
      staticFileScanner < staticFilePaste &&
      staticFilePaste < staticFileHandoffState &&
      staticFileHandoffState < staticFileHandoffPending &&
      staticFileHandoffPending < staticFileHandoffFlow &&
      staticFileHandoffFlow < staticRewriteVerificationText &&
      staticRewriteVerificationText < staticFileTransferPolicy &&
      staticFileTransferPolicy < staticHostMatching &&
      staticHostMatching < staticAdapterIndexes[0] &&
      staticAdapterOrderAligned &&
      staticAdapterIndexes.at(-1) < staticGeminiFallbackWriter &&
      staticGeminiFallbackWriter < staticSafeSnapshots &&
      staticSafeSnapshots < staticFileAttachPipeline &&
      staticFileAttachPipeline < staticPlaceholderRehydrator &&
      staticPlaceholderRehydrator < staticResponseObserver &&
      staticResponseObserver < staticRevealController &&
      staticRevealController < staticDebugLogger &&
      staticDebugLogger < staticContentEventBindings &&
      staticContentEventBindings < staticContent,
    "static manifest file paste order should load dependencies before content.js"
  );
  assert.ok(
    dynamicFileLimits < dynamicFileTypeRegistry &&
      dynamicFileTypeRegistry < dynamicFileExtractors &&
      dynamicFileExtractors < dynamicFileScanner &&
      dynamicFileScanner < dynamicFilePaste &&
      dynamicFilePaste < dynamicFileHandoffState &&
      dynamicFileHandoffState < dynamicFileHandoffPending &&
      dynamicFileHandoffPending < dynamicFileHandoffFlow &&
      dynamicFileHandoffFlow < dynamicRewriteVerificationText &&
      dynamicRewriteVerificationText < dynamicFileTransferPolicy &&
      dynamicFileTransferPolicy < dynamicHostMatching &&
      dynamicHostMatching < dynamicAdapterIndexes[0] &&
      dynamicAdapterOrderAligned &&
      dynamicAdapterIndexes.at(-1) < dynamicGeminiFallbackWriter &&
      dynamicGeminiFallbackWriter < dynamicSafeSnapshots &&
      dynamicSafeSnapshots < dynamicFileAttachPipeline &&
      dynamicFileAttachPipeline < dynamicPlaceholderRehydrator &&
      dynamicPlaceholderRehydrator < dynamicResponseObserver &&
      dynamicResponseObserver < dynamicRevealController &&
      dynamicRevealController < dynamicDebugLogger &&
      dynamicDebugLogger < dynamicContentEventBindings &&
      dynamicContentEventBindings < dynamicContent,
    "dynamic injection file paste order should load dependencies before content.js"
  );
}

function testBackgroundDeterministicRescanBackstopExists() {
  const serviceWorkerSource = fs.readFileSync(
    path.join(repoRoot, "src/background/service_worker.js"),
    "utf8"
  );

  assert.ok(
    serviceWorkerSource.indexOf("../shared/detector.js") > serviceWorkerSource.indexOf("../shared/patterns.js"),
    "background service worker should load deterministic detector dependencies"
  );
  assert.ok(
    backgroundSource.includes(".scan(text, { manager })") &&
      backgroundSource.includes("mergeFindings(normalizedFindings, backgroundFindings)"),
    "background redaction should rescan text and merge deterministic findings"
  );
}

function testContentPublicStateIsMinimized() {
  const toPublicStateSource = extractFunctionSource(backgroundSource, "toPublicState");

  assertNotIncludes(
    toPublicStateSource,
    "knownPlaceholders: publicState.knownPlaceholders",
    "background should not expose the private-state field name to the content script"
  );
  assertNotIncludes(
    toPublicStateSource,
    "sessionId: state?.sessionId",
    "background should not expose session ids to the content script"
  );
  assertNotIncludes(
    toPublicStateSource,
    "urlKey: state?.urlKey",
    "background should not expose url keys to the content script"
  );
  assert.ok(
    toPublicStateSource.includes("placeholderCount: publicState.knownPlaceholders.length"),
    "background should expose only the safe placeholder count for content-side UI/debug needs"
  );
  assert.ok(
    toPublicStateSource.includes("trustedPlaceholders: publicState.knownPlaceholders"),
    "background should expose sanitized trusted placeholders for trust-aware detection"
  );
  assertNotIncludes(
    contentSource,
    "currentPublicState.sessionId",
    "content script should not depend on session ids from background public state"
  );
  assertNotIncludes(
    contentSource,
    "currentPublicState.urlKey",
    "content script should not depend on url keys from background public state"
  );
  assertNotIncludes(
    contentSource,
    "currentPublicState.knownPlaceholders",
    "content script should not depend on placeholder registries from background public state"
  );
  assert.ok(
    contentSource.includes("currentPublicState.trustedPlaceholders"),
    "content script should use the sanitized trusted placeholder list for detection"
  );
}

function testRevealNeverInjectsHostDomContainers() {
  assertNotIncludes(
    contentSource,
    'createElement("iframe")',
    "host page reveal must not create iframe reveal containers in the page DOM"
  );
  assertNotIncludes(
    contentSource,
    ".pwm-reveal-host",
    "host page reveal must not maintain a reveal host subtree"
  );
  assertNotIncludes(
    contentSource,
    "document.documentElement.appendChild(host)",
    "host page reveal must not append a reveal container to the page DOM"
  );
  assertNotIncludes(
    contentSource,
    "allow-same-origin",
    "host page reveal must not embed extension UI with same-origin iframe permissions"
  );
}

function testHostPageHydrationRequiresPlausibleSessionPlaceholders() {
  assert.ok(
    contentSource.includes("placeholderCount: currentPublicState.placeholderCount"),
    "content script should inject only safe public placeholder counts into host-page hydration"
  );
  assert.ok(
    responseObserverSource.includes("tokenizePlaceholderText(normalizedText, options)"),
    "response observer should delegate placeholder trust decisions to injected tokenizer options"
  );
}

function testPlaceholderRehydrationStaysBoundedOnLargeDomMutations() {
  const observerSource = extractFunctionSource(responseObserverSource, "startRehydrationObserver");
  const urlChangeSource = extractFunctionSource(contentSource, "handleUrlChange");

  assert.ok(
    observerSource.includes("const containsPlaceholder = placeholderTokenRegex.test(normalizedText);") &&
      observerSource.includes("if (!containsPlaceholder) return;") &&
      observerSource.indexOf("if (!containsPlaceholder) return;") <
        observerSource.indexOf("rehydrateTree(node, options);"),
    "added element subtrees should be skipped before TreeWalker scanning when they contain no placeholders"
  );
  assert.ok(
    responseObserverSource.includes(".pwm-modal-backdrop, .pwm-secret, form, textarea") &&
      responseObserverSource.includes("[role='textbox']") &&
      responseObserverSource.includes("[contenteditable='true']"),
    "already hydrated placeholders and editable composers should be excluded from page-DOM rehydration"
  );
  assert.ok(
    urlChangeSource.includes("if (location.href === currentUrl) return;") &&
      urlChangeSource.indexOf("if (location.href === currentUrl) return;") <
        urlChangeSource.indexOf("ResponseObserver.rehydrateTree(document.body"),
    "URL-change polling should return before full-body rehydration when the URL is unchanged"
  );
}

function testPageUiNoLongerLeaksClassificationsOrMaskedFragments() {
  assertNotIncludes(
    contentSource,
    "Shield:",
    "page badge should not classify sensitive content by type"
  );
  assertNotIncludes(
    contentSource,
    "finding.type",
    "page modal should not render secret types"
  );
  assertNotIncludes(
    contentSource,
    "finding.raw",
    "page modal should not render raw-derived preview fragments"
  );
  assertNotIncludes(
    harnessSource,
    "span.textContent = raw",
    "local harness should not codify unsafe raw-to-page reveal patterns"
  );
}

function testOnlyPwmPlaceholdersRemainCanonical() {
  assert.strictEqual(
    PLACEHOLDER_TOKEN_REGEX.test("[PWM_1]"),
    true,
    "generic PWM placeholders must remain canonical"
  );
  PLACEHOLDER_TOKEN_REGEX.lastIndex = 0;
  assert.strictEqual(
    PLACEHOLDER_TOKEN_REGEX.test("[API_KEY_1]"),
    false,
    "typed placeholders must not remain canonical"
  );
  PLACEHOLDER_TOKEN_REGEX.lastIndex = 0;

  const normalized = normalizeVisiblePlaceholders(
    "API_KEY=[API_KEY_1] PASSWORD=[PASSWORD_2] TOKEN=[TOKEN_1]"
  );

  assert.strictEqual(containsLegacyTypedPlaceholder(normalized), false);
  assert.ok(normalized.includes(`API_KEY=${canonicalizePlaceholderToken("[API_KEY_1]")}`));
  assert.strictEqual(
    PLACEHOLDER_TOKEN_REGEX.test("[NET_1_SUB_2]"),
    true,
    "semantic network placeholders should also be treated as canonical placeholders"
  );
  PLACEHOLDER_TOKEN_REGEX.lastIndex = 0;
}

async function run() {
  const { buildManifest, getOnnxRuntimeWebAccessibleResources } = await import(
    pathToFileURL(path.join(repoRoot, "scripts/build-extension.mjs")).href
  );
  const manifest = buildManifest("chrome", "consumer");
  const runtimeResources = getOnnxRuntimeWebAccessibleResources();

  testUnsafeContentRevealPathRemoved();
  testSafeRevealUiExists();
  await testSessionStorageFallbackIsEphemeralOnly();
  testAuditMetadataObjectsExcludeRawSecrets();
  await testSecureRevealRemainsBoundedToRequestSessionAndExtensionUi();
  testPlaceholderLabelsDoNotExposeRawValues();
  testLocalFilePasteDoesNotExposeRawFileContent();
  testFileAttachPipelineStaysPureAndContentOwnsFileAttachSideEffects();
  testFileSnapshotDebugPayloadsStayMetadataOnly();
  testDocumentExtractionDoesNotWriteRawTextToDebugStorageOrAuditSurfaces();
  testStaticAndDynamicFilePasteInjectionOrderStaysAligned();
  testBackgroundDeterministicRescanBackstopExists();
  testContentPublicStateIsMinimized();
  testRevealNeverInjectsHostDomContainers();
  testHostPageHydrationRequiresPlausibleSessionPlaceholders();
  testPlaceholderRehydrationStaysBoundedOnLargeDomMutations();
  testContentRuntimeInvalidationIsHandled();
  testManifestNoLongerExposesRevealUiToWebPages(manifest, runtimeResources);
  testExtensionPagesUseRestrictiveCsp(manifest);
  testPageUiNoLongerLeaksClassificationsOrMaskedFragments();
  testOnlyPwmPlaceholdersRemainCanonical();
  console.log("PASS security hardening static regressions");
}

function testManifestNoLongerExposesRevealUiToWebPages(manifest, runtimeResources) {
  const entries = Array.isArray(manifest.web_accessible_resources) ? manifest.web_accessible_resources : [];
  const resources = entries.flatMap((entry) => entry.resources || []);

  assert.strictEqual(entries.length, 1, "manifest should expose only the AI runtime asset group");
  assert.deepStrictEqual(
    [...resources].sort(),
    [
      "ai/models/leakguard_secret_classifier.features.json",
      "ai/models/leakguard_secret_classifier.onnx",
      ...runtimeResources
    ].sort(),
    "manifest should expose only packaged AI model/runtime assets"
  );
  assert.ok(
    resources.every((resource) => !resource.startsWith("popup/") && !resource.startsWith("ui/")),
    "manifest must not expose popup-only reveal assets to web pages"
  );
  assert.deepStrictEqual(
    entries[0].matches,
    manifest.content_scripts[0].matches,
    "AI runtime assets should only be web-accessible on protected content-script origins"
  );
}

function testContentRuntimeInvalidationIsHandled() {
  assert.ok(
    contentSource.includes("function sendRuntimeMessage"),
    "content script should route background calls through a runtime messaging wrapper"
  );
  assert.ok(
    contentSource.includes("extension_context_invalidated"),
    "content script should classify extension reload/invalidation errors"
  );
  assert.ok(
    contentSource.includes("LeakGuard reloaded. Refresh this page."),
    "content script should show a user-facing refresh hint after extension reload"
  );
  assertNotIncludes(
    contentSource,
    ".catch(console.error)",
    "content script async event handlers should suppress expected invalidation errors"
  );
  assert.strictEqual(
    (contentSource.match(/ext\.runtime\.sendMessage/g) || []).length,
    1,
    "content script should call ext.runtime.sendMessage only inside sendRuntimeMessage"
  );
}

function testExtensionPagesUseRestrictiveCsp(manifest) {
  assert.deepStrictEqual(
    manifest.content_security_policy,
    {
      extension_pages:
        "script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none';"
    },
    "manifest should lock extension pages to packaged scripts and disallow framing/base overrides"
  );
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
