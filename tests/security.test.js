const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { pathToFileURL } = require("url");

const repoRoot = path.join(__dirname, "..");
require(path.join(repoRoot, "src/shared/placeholders.js"));
require(path.join(repoRoot, "src/shared/sessionMapStore.js"));
require(path.join(repoRoot, "src/shared/runtime_scripts.js"));
require(path.join(repoRoot, "src/background/auditLog.js"));
require(path.join(repoRoot, "src/content/diagnostics/safeSnapshots.js"));
require(path.join(repoRoot, "src/content/diagnostics/debugLogger.js"));
const ContentDebugFacade = require(path.join(repoRoot, "src/content/diagnostics/contentDebugFacade.js"));
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
const fileLimitsSource = fs.readFileSync(path.join(repoRoot, "src/shared/fileLimits.js"), "utf8");
const fileTransferPolicySource = fs.readFileSync(
  path.join(repoRoot, "src/content/files/fileTransferPolicy.js"),
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
const pdfRedactorSource = fs.readFileSync(
  path.join(repoRoot, "src/shared/pdfRedactor.js"),
  "utf8"
);
const docxRedactorSource = fs.readFileSync(
  path.join(repoRoot, "src/shared/docxRedactor.js"),
  "utf8"
);
const xlsxRedactorSource = fs.readFileSync(
  path.join(repoRoot, "src/shared/xlsxRedactor.js"),
  "utf8"
);
const scannerSource = fs.readFileSync(path.join(repoRoot, "src/scanner/scanner.js"), "utf8");
const fileAttachPipelineSource = fs.readFileSync(
  path.join(repoRoot, "src/content/files/fileAttachPipeline.js"),
  "utf8"
);
const contentFileExtractionPipelineSource = fs.readFileSync(
  path.join(repoRoot, "src/content/files/contentFileExtractionPipeline.js"),
  "utf8"
);
const protectedSiteOcrBrokerSource = fs.readFileSync(
  path.join(repoRoot, "src/content/files/protectedSiteOcrBroker.js"),
  "utf8"
);
const protectedSiteOcrBrokerPageSource = fs.readFileSync(
  path.join(repoRoot, "src/content/protected_site_ocr_broker_page.js"),
  "utf8"
);
const policySource = fs.readFileSync(path.join(repoRoot, "src/shared/policy.js"), "utf8");
const optionsSource = fs.readFileSync(path.join(repoRoot, "src/options/options.js"), "utf8");
const popupSource = fs.readFileSync(path.join(repoRoot, "src/popup/popup.js"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
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
const { RuntimeScripts } = globalThis.PWM;
const { BackgroundAuditLog } = globalThis.PWM;

function assertNotIncludes(source, needle, message) {
  assert.strictEqual(source.includes(needle), false, message);
}

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
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
    RuntimeScripts,
    BackgroundAuditLog,
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
  const entry = sandbox.PWM.BackgroundAuditLog.buildAuditEventEntry({
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
    placeholder: "[EMAIL_999]"
  };
  const unknownContext = await sandbox.getRevealContext(requestId);
  assert.strictEqual(unknownContext.available, false, "unknown typed placeholders must not become revealable");
  assert.strictEqual(await sandbox.revealSecret(requestId), null, "unknown typed placeholders must not reveal raw values");

  storageState[requestKey] = {
    ...storageState[requestKey],
    placeholder,
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
    ["pdfRedactor", pdfRedactorSource],
    ["docxRedactor", docxRedactorSource],
    ["scanner page", scannerSource]
  ]) {
    assertNotIncludes(source, "localStorage", `${label} must not persist extracted PDF/DOCX/XLSX/image metadata text to localStorage`);
    assertNotIncludes(source, "sessionStorage", `${label} must not persist extracted PDF/DOCX/XLSX/image metadata text to sessionStorage`);
    assertNotIncludes(source, "chrome.storage", `${label} must not persist extracted PDF/DOCX/XLSX/image metadata text to extension storage`);
    assertNotIncludes(source, "browser.storage", `${label} must not persist extracted PDF/DOCX/XLSX/image metadata text to extension storage`);
    assertNotIncludes(source, "pwm:audit", `${label} must not write extracted PDF/DOCX/XLSX/image metadata text to audit metadata`);
  }

  for (const [label, source] of [
    ["fileExtractors", fileExtractorsSource],
    ["fileScanner", fileScannerSource],
    ["pdfRedactor", pdfRedactorSource],
    ["docxRedactor", docxRedactorSource],
    ["xlsxRedactor", xlsxRedactorSource]
  ]) {
    assertNotIncludes(source, "console.log", `${label} must not log extracted PDF/DOCX/XLSX/image metadata text`);
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

function testXlsxRedactedOutputStaysTextDerived() {
  assert.ok(
    scannerSource.includes("createRedactedXlsxFromExtraction") &&
      scannerSource.includes("sanitizedText: result?.redactedText") &&
      scannerSource.includes("download-redacted-xlsx-btn"),
    "scanner page should generate redacted XLSX only from sanitized scanner text"
  );
  assert.ok(
    scannerSource.includes("redactedXlsx.mimeType") &&
      scannerSource.includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    "scanner redacted XLSX download should use generated XLSX bytes and XLSX MIME"
  );
  assert.ok(
    contentFileExtractionPipelineSource.includes("createRedactedXlsxFromExtraction") &&
      contentFileExtractionPipelineSource.includes("outputKind: \"redacted_xlsx_file\"") &&
      contentFileExtractionPipelineSource.includes("xlsx-redaction:xlsx_redacted_text_truncated"),
    "protected-site extraction pipeline should generate redacted XLSX only through sanitized extraction with truncation fallback"
  );
  for (const [label, source] of [
    ["file attach pipeline", fileAttachPipelineSource],
    ["content script", contentSource],
    ["file paste helper", filePasteHelperSource],
    ["Gemini fallback writer", geminiFallbackWriterSource]
  ]) {
    assertNotIncludes(source, "createRedactedXlsxFromExtraction", `${label} must not build .redacted.xlsx outputs`);
    assertNotIncludes(source, "download-redacted-xlsx-btn", `${label} must not reference scanner XLSX UI`);
  }
  for (const forbidden of [
    "xl/sharedStrings.xml",
    "xl/comments",
    "docProps/",
    "customXml/",
    "xl/media/",
    "xl/calcChain.xml",
    "vbaProject.bin",
    "localStorage",
    "sessionStorage",
    "chrome.storage",
    "browser.storage",
    "pwm:audit",
    "console.log",
    "console.warn",
    "console.error"
  ]) {
    assertNotIncludes(xlsxRedactorSource, forbidden, `XLSX redactor must not copy/persist/log unsafe spreadsheet data: ${forbidden}`);
  }
}

function testPdfRedactedOutputStaysTextDerived() {
  assert.ok(
    scannerSource.includes("createRedactedPdfFromExtraction") &&
      scannerSource.includes("sanitizedText: result?.redactedText") &&
      scannerSource.includes("download-redacted-pdf-btn"),
    "scanner page should generate redacted PDFs only from sanitized scanner text"
  );
  assert.ok(
    contentFileExtractionPipelineSource.includes("createRedactedPdfFromExtraction") &&
      contentFileExtractionPipelineSource.includes("sanitizedText") &&
      contentFileExtractionPipelineSource.includes("redactedPdf.truncated !== true"),
    "protected-site pipeline should generate redacted PDFs only from complete sanitized extracted text"
  );
  assert.ok(
    contentFileExtractionPipelineSource.includes("pdf-redaction:pdf_redacted_text_truncated") &&
      contentFileExtractionPipelineSource.includes("const outputKind = EXTRACTED_TEXT_OUTPUT_KINDS.has(extractedKind)") &&
      contentFileExtractionPipelineSource.includes('"redacted_text_file"'),
    "protected-site truncated PDF regeneration should fall back to sanitized redacted text"
  );
  assert.ok(
    scannerSource.includes("new Blob([redactedPdf.bytes]") &&
      scannerSource.includes('redactedPdf.mimeType || "application/pdf"'),
    "scanner redacted PDF download should use regenerated PDF bytes and application/pdf MIME"
  );
  for (const [label, source] of [
    ["file attach pipeline", fileAttachPipelineSource],
    ["content script", contentSource],
    ["file paste helper", filePasteHelperSource],
    ["Gemini fallback writer", geminiFallbackWriterSource]
  ]) {
    assertNotIncludes(source, "createRedactedPdfFromExtraction", `${label} must not build .redacted.pdf outputs`);
    assertNotIncludes(source, "download-redacted-pdf-btn", `${label} must not reference scanner PDF UI`);
  }
  assertNotIncludes(contentFileExtractionPipelineSource, "download-redacted-pdf-btn", "protected-site pipeline must not reference scanner PDF UI");
  assertNotIncludes(contentFileExtractionPipelineSource, "originalPdf", "protected-site pipeline must not copy original PDF bytes");
  assertNotIncludes(pdfRedactorSource, "drawImage", "PDF redactor must not overlay or rasterize original PDF pages");
  assertNotIncludes(pdfRedactorSource, "fillRect", "PDF redactor must not overlay black rectangles on original PDF pages");
}

function testDocxRedactedOutputStaysTextDerived() {
  assert.ok(
    scannerSource.includes("createRedactedDocxFromText") &&
      scannerSource.includes("text: result?.redactedText") &&
      scannerSource.includes("download-redacted-docx-btn"),
    "scanner page should generate redacted DOCX only from sanitized scanner text"
  );
  assert.ok(
    scannerSource.includes("originalBytes") &&
      scannerSource.includes("selectedFile?.name") &&
      scannerSource.includes("redactedDocx.mimeType"),
    "scanner DOCX generation should validate the source envelope and download DOCX bytes with the DOCX MIME"
  );
  for (const [label, source] of [
    ["file attach pipeline", fileAttachPipelineSource],
    ["content script", contentSource],
    ["file paste helper", filePasteHelperSource],
    ["Gemini fallback writer", geminiFallbackWriterSource]
  ]) {
    assertNotIncludes(source, "createRedactedDocxFromText", `${label} must not build .redacted.docx outputs`);
    assertNotIncludes(source, "download-redacted-docx-btn", `${label} must not reference scanner DOCX UI`);
  }
  assert.ok(
    contentFileExtractionPipelineSource.includes("createRedactedDocxFromText") &&
      contentFileExtractionPipelineSource.includes("text: sanitizedText") &&
      contentFileExtractionPipelineSource.includes("redactedDocx.truncated !== true") &&
      contentFileExtractionPipelineSource.includes("redacted_docx_file") &&
      contentFileExtractionPipelineSource.includes("docx-redaction:docx_redacted_text_truncated"),
    "protected-site pipeline should generate redacted DOCX only from complete sanitized extracted text"
  );
  assertNotIncludes(
    contentFileExtractionPipelineSource,
    "download-redacted-docx-btn",
    "protected-site pipeline must not reference scanner DOCX UI"
  );
  assertNotIncludes(docxRedactorSource, "word/header", "DOCX redactor must not copy original header parts");
  assertNotIncludes(docxRedactorSource, "word/footer", "DOCX redactor must not copy original footer parts");
  assertNotIncludes(docxRedactorSource, "word/footnotes", "DOCX redactor must not copy original footnote parts");
  assertNotIncludes(docxRedactorSource, "word/endnotes", "DOCX redactor must not copy original endnote parts");
  assertNotIncludes(docxRedactorSource, "drawImage", "DOCX redactor must not attempt embedded image redaction");
}

function testStaticAndDynamicFilePasteInjectionOrderStaysAligned() {
  const baseManifest = JSON.parse(fs.readFileSync(path.join(repoRoot, "manifests/base.json"), "utf8"));
  const staticScripts = baseManifest.content_scripts[0].js;
  const dynamicScripts = RuntimeScripts.contentScripts;
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
  const staticPdfRedactor = staticScripts.indexOf("shared/pdfRedactor.js");
  const staticDocxRedactor = staticScripts.indexOf("shared/docxRedactor.js");
  const staticXlsxRedactor = staticScripts.indexOf("shared/xlsxRedactor.js");
  const staticOcrRuntime = staticScripts.indexOf("shared/ocr/ocrRuntime.js");
  const staticScannerOcr = staticScripts.indexOf("shared/scannerOcr.js");
  const staticImageRedactor = staticScripts.indexOf("shared/imageRedactor.js");
  const staticFilePaste = staticScripts.indexOf("content/file_paste_helpers.js");
  const staticFileHandoffState = staticScripts.indexOf("content/file_handoff_state.js");
  const staticFileHandoffPending = staticScripts.indexOf("content/file_handoff_pending.js");
  const staticFileHandoffFlow = staticScripts.indexOf("content/file_handoff_flow.js");
  const staticRewriteVerificationText = staticScripts.indexOf("content/input/rewriteVerificationText.js");
  const staticFileTransferPolicy = staticScripts.indexOf("content/files/fileTransferPolicy.js");
  const staticFileExtractionSessionCache = staticScripts.indexOf("content/files/fileExtractionSessionCache.js");
  const staticProtectedSiteOcrBroker = staticScripts.indexOf("content/files/protectedSiteOcrBroker.js");
  const staticContentFileExtractionPipeline = staticScripts.indexOf("content/files/contentFileExtractionPipeline.js");
  const staticHostMatching = staticScripts.indexOf("content/adapters/hostMatching.js");
  const staticAdapterIndexes = adapterScripts.map((script) => staticScripts.indexOf(script));
  const staticGeminiFallbackWriter = staticScripts.indexOf("content/adapters/geminiFallbackWriter.js");
  const staticSafeSnapshots = staticScripts.indexOf("content/diagnostics/safeSnapshots.js");
  const staticFileAttachPipeline = staticScripts.indexOf("content/files/fileAttachPipeline.js");
  const staticPlaceholderRehydrator = staticScripts.indexOf("content/rehydration/placeholderRehydrator.js");
  const staticResponseObserver = staticScripts.indexOf("content/rehydration/responseObserver.js");
  const staticRevealController = staticScripts.indexOf("content/rehydration/revealController.js");
  const staticDebugLogger = staticScripts.indexOf("content/diagnostics/debugLogger.js");
  const staticContentDebugFacade = staticScripts.indexOf("content/diagnostics/contentDebugFacade.js");
  const staticContentEventBindings = staticScripts.indexOf("content/bootstrap/eventBindings.js");
  const staticContent = staticScripts.indexOf("content/content.js");
  const dynamicFileLimits = dynamicScripts.indexOf("shared/fileLimits.js");
  const dynamicFileTypeRegistry = dynamicScripts.indexOf("shared/fileTypeRegistry.js");
  const dynamicFileExtractors = dynamicScripts.indexOf("shared/fileExtractors.js");
  const dynamicFileScanner = dynamicScripts.indexOf("shared/fileScanner.js");
  const dynamicPdfRedactor = dynamicScripts.indexOf("shared/pdfRedactor.js");
  const dynamicDocxRedactor = dynamicScripts.indexOf("shared/docxRedactor.js");
  const dynamicXlsxRedactor = dynamicScripts.indexOf("shared/xlsxRedactor.js");
  const dynamicOcrRuntime = dynamicScripts.indexOf("shared/ocr/ocrRuntime.js");
  const dynamicScannerOcr = dynamicScripts.indexOf("shared/scannerOcr.js");
  const dynamicImageRedactor = dynamicScripts.indexOf("shared/imageRedactor.js");
  const dynamicFilePaste = dynamicScripts.indexOf("content/file_paste_helpers.js");
  const dynamicFileHandoffState = dynamicScripts.indexOf("content/file_handoff_state.js");
  const dynamicFileHandoffPending = dynamicScripts.indexOf("content/file_handoff_pending.js");
  const dynamicFileHandoffFlow = dynamicScripts.indexOf("content/file_handoff_flow.js");
  const dynamicRewriteVerificationText = dynamicScripts.indexOf("content/input/rewriteVerificationText.js");
  const dynamicFileTransferPolicy = dynamicScripts.indexOf("content/files/fileTransferPolicy.js");
  const dynamicFileExtractionSessionCache = dynamicScripts.indexOf("content/files/fileExtractionSessionCache.js");
  const dynamicProtectedSiteOcrBroker = dynamicScripts.indexOf("content/files/protectedSiteOcrBroker.js");
  const dynamicContentFileExtractionPipeline = dynamicScripts.indexOf("content/files/contentFileExtractionPipeline.js");
  const dynamicHostMatching = dynamicScripts.indexOf("content/adapters/hostMatching.js");
  const dynamicAdapterIndexes = adapterScripts.map((script) => dynamicScripts.indexOf(script));
  const dynamicGeminiFallbackWriter = dynamicScripts.indexOf("content/adapters/geminiFallbackWriter.js");
  const dynamicSafeSnapshots = dynamicScripts.indexOf("content/diagnostics/safeSnapshots.js");
  const dynamicFileAttachPipeline = dynamicScripts.indexOf("content/files/fileAttachPipeline.js");
  const dynamicPlaceholderRehydrator = dynamicScripts.indexOf("content/rehydration/placeholderRehydrator.js");
  const dynamicResponseObserver = dynamicScripts.indexOf("content/rehydration/responseObserver.js");
  const dynamicRevealController = dynamicScripts.indexOf("content/rehydration/revealController.js");
  const dynamicDebugLogger = dynamicScripts.indexOf("content/diagnostics/debugLogger.js");
  const dynamicContentDebugFacade = dynamicScripts.indexOf("content/diagnostics/contentDebugFacade.js");
  const dynamicContentEventBindings = dynamicScripts.indexOf("content/bootstrap/eventBindings.js");
  const dynamicContent = dynamicScripts.indexOf("content/content.js");

  assert.ok(
    staticFileLimits > -1 &&
      staticFileTypeRegistry > -1 &&
      staticFileExtractors > -1 &&
      staticFileScanner > -1 &&
      staticPdfRedactor > -1 &&
      staticDocxRedactor > -1 &&
      staticXlsxRedactor > -1 &&
      staticOcrRuntime > -1 &&
      staticScannerOcr > -1 &&
      staticImageRedactor > -1 &&
      staticFilePaste > -1 &&
      staticFileHandoffState > -1 &&
      staticFileHandoffPending > -1 &&
      staticFileHandoffFlow > -1 &&
      staticRewriteVerificationText > -1 &&
      staticFileTransferPolicy > -1 &&
      staticFileExtractionSessionCache > -1 &&
      staticProtectedSiteOcrBroker > -1 &&
      staticContentFileExtractionPipeline > -1 &&
      staticHostMatching > -1 &&
      staticAdapterIndexes.every((index) => index > -1) &&
      staticGeminiFallbackWriter > -1 &&
      staticSafeSnapshots > -1 &&
      staticFileAttachPipeline > -1 &&
      staticPlaceholderRehydrator > -1 &&
      staticResponseObserver > -1 &&
      staticRevealController > -1 &&
      staticDebugLogger > -1 &&
      staticContentDebugFacade > -1 &&
      staticContentEventBindings > -1 &&
      staticContent > -1,
    "static manifest should include file limits, scanner, file paste helper, file handoff helpers, adapter helpers, pure helpers, and content script"
  );
  assert.ok(
    dynamicFileLimits > -1 &&
      dynamicFileTypeRegistry > -1 &&
      dynamicFileExtractors > -1 &&
      dynamicFileScanner > -1 &&
      dynamicPdfRedactor > -1 &&
      dynamicDocxRedactor > -1 &&
      dynamicXlsxRedactor > -1 &&
      dynamicOcrRuntime > -1 &&
      dynamicScannerOcr > -1 &&
      dynamicImageRedactor > -1 &&
      dynamicFilePaste > -1 &&
      dynamicFileHandoffState > -1 &&
      dynamicFileHandoffPending > -1 &&
      dynamicFileHandoffFlow > -1 &&
      dynamicRewriteVerificationText > -1 &&
      dynamicFileTransferPolicy > -1 &&
      dynamicFileExtractionSessionCache > -1 &&
      dynamicProtectedSiteOcrBroker > -1 &&
      dynamicContentFileExtractionPipeline > -1 &&
      dynamicHostMatching > -1 &&
      dynamicAdapterIndexes.every((index) => index > -1) &&
      dynamicGeminiFallbackWriter > -1 &&
      dynamicSafeSnapshots > -1 &&
      dynamicFileAttachPipeline > -1 &&
      dynamicPlaceholderRehydrator > -1 &&
      dynamicResponseObserver > -1 &&
      dynamicRevealController > -1 &&
      dynamicDebugLogger > -1 &&
      dynamicContentDebugFacade > -1 &&
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
      staticFileScanner < staticPdfRedactor &&
      staticPdfRedactor < staticDocxRedactor &&
      staticDocxRedactor < staticXlsxRedactor &&
      staticXlsxRedactor < staticOcrRuntime &&
      staticOcrRuntime < staticScannerOcr &&
      staticScannerOcr < staticImageRedactor &&
      staticImageRedactor < staticFilePaste &&
      staticFilePaste < staticFileHandoffState &&
      staticFileHandoffState < staticFileHandoffPending &&
      staticFileHandoffPending < staticFileHandoffFlow &&
      staticFileHandoffFlow < staticRewriteVerificationText &&
      staticRewriteVerificationText < staticFileTransferPolicy &&
      staticFileTransferPolicy < staticFileExtractionSessionCache &&
      staticFileExtractionSessionCache < staticProtectedSiteOcrBroker &&
      staticProtectedSiteOcrBroker < staticContentFileExtractionPipeline &&
      staticContentFileExtractionPipeline < staticHostMatching &&
      staticHostMatching < staticAdapterIndexes[0] &&
      staticAdapterOrderAligned &&
      staticAdapterIndexes.at(-1) < staticGeminiFallbackWriter &&
      staticGeminiFallbackWriter < staticSafeSnapshots &&
      staticSafeSnapshots < staticFileAttachPipeline &&
      staticFileAttachPipeline < staticPlaceholderRehydrator &&
      staticPlaceholderRehydrator < staticResponseObserver &&
      staticResponseObserver < staticRevealController &&
      staticRevealController < staticDebugLogger &&
      staticDebugLogger < staticContentDebugFacade &&
      staticContentDebugFacade < staticContentEventBindings &&
      staticContentEventBindings < staticContent,
    "static manifest file paste order should load dependencies before content.js"
  );
  assert.ok(
    dynamicFileLimits < dynamicFileTypeRegistry &&
      dynamicFileTypeRegistry < dynamicFileExtractors &&
      dynamicFileExtractors < dynamicFileScanner &&
      dynamicFileScanner < dynamicPdfRedactor &&
      dynamicPdfRedactor < dynamicDocxRedactor &&
      dynamicDocxRedactor < dynamicXlsxRedactor &&
      dynamicXlsxRedactor < dynamicOcrRuntime &&
      dynamicOcrRuntime < dynamicScannerOcr &&
      dynamicScannerOcr < dynamicImageRedactor &&
      dynamicImageRedactor < dynamicFilePaste &&
      dynamicFilePaste < dynamicFileHandoffState &&
      dynamicFileHandoffState < dynamicFileHandoffPending &&
      dynamicFileHandoffPending < dynamicFileHandoffFlow &&
      dynamicFileHandoffFlow < dynamicRewriteVerificationText &&
      dynamicRewriteVerificationText < dynamicFileTransferPolicy &&
      dynamicFileTransferPolicy < dynamicFileExtractionSessionCache &&
      dynamicFileExtractionSessionCache < dynamicProtectedSiteOcrBroker &&
      dynamicProtectedSiteOcrBroker < dynamicContentFileExtractionPipeline &&
      dynamicContentFileExtractionPipeline < dynamicHostMatching &&
      dynamicHostMatching < dynamicAdapterIndexes[0] &&
      dynamicAdapterOrderAligned &&
      dynamicAdapterIndexes.at(-1) < dynamicGeminiFallbackWriter &&
      dynamicGeminiFallbackWriter < dynamicSafeSnapshots &&
      dynamicSafeSnapshots < dynamicFileAttachPipeline &&
      dynamicFileAttachPipeline < dynamicPlaceholderRehydrator &&
      dynamicPlaceholderRehydrator < dynamicResponseObserver &&
      dynamicResponseObserver < dynamicRevealController &&
      dynamicRevealController < dynamicDebugLogger &&
      dynamicDebugLogger < dynamicContentDebugFacade &&
      dynamicContentDebugFacade < dynamicContentEventBindings &&
      dynamicContentEventBindings < dynamicContent,
    "dynamic injection file paste order should load dependencies before content.js"
  );
}

function testBackgroundDeterministicRescanBackstopExists() {
  const serviceWorkerSource = fs.readFileSync(
    path.join(repoRoot, "src/background/service_worker.js"),
    "utf8"
  );
  const placeholderFamiliesIndex = serviceWorkerSource.indexOf("../shared/placeholders/families.js");
  const placeholdersIndex = serviceWorkerSource.indexOf("../shared/placeholders.js");
  const detectorIndex = serviceWorkerSource.indexOf("../shared/detector.js");
  const detectionModuleScripts = [
    "../shared/detection/constants/enterpriseTokens.js",
    "../shared/detection/constants/providerTokens.js",
    "../shared/detection/constants/contextRegexes.js",
    "../shared/detection/contextWindow.js",
    "../shared/detection/cloudScoring.js",
    "../shared/detection/enterprise/shared.js",
    "../shared/detection/enterprise/uncPaths.js",
    "../shared/detection/enterprise/directoryMetadata.js",
    "../shared/detection/enterprise/internalNetwork.js",
    "../shared/detection/enterprise/fileShares.js",
    "../shared/detection/enterprise/adGroups.js",
    "../shared/detection/enterprise/hostnames.js",
    "../shared/detection/enterprise/identity.js",
    "../shared/detection/enterprise/storageAccounts.js",
    "../shared/detection/enterprise/azureResourceGroups.js",
    "../shared/detection/enterprise/cloudResourceNames.js",
    "../shared/detection/enterprise/index.js",
    "../shared/detection/providers/azure.js",
    "../shared/detection/providers/azureIds.js",
    "../shared/detection/providers/aws.js",
    "../shared/detection/providers/gcp.js",
    "../shared/detection/providers/otcOpenStack.js",
    "../shared/detection/providers/kubernetes.js",
    "../shared/detection/providers/genericEndpoints.js",
    "../shared/detection/providers/index.js",
    "../shared/detection/urlUserinfo.js"
  ];
  const detectionModuleIndexes = detectionModuleScripts.map((script) => serviceWorkerSource.indexOf(script));

  assert.ok(
    serviceWorkerSource.indexOf("../shared/detector.js") > serviceWorkerSource.indexOf("../shared/patterns.js"),
    "background service worker should load deterministic detector dependencies"
  );
  assert.ok(placeholderFamiliesIndex > -1, "background service worker should load placeholder family registry");
  assert.ok(
    detectionModuleIndexes.every((index) => index > -1),
    "background service worker should load modular enterprise/cloud detection helpers"
  );
  assert.ok(
    placeholderFamiliesIndex < placeholdersIndex &&
      detectionModuleIndexes.every((index) => index < detectorIndex),
    "background service worker should load typed placeholder families before placeholders.js and detection modules before detector.js"
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
  assert.ok(
    contentSource.includes("ANY_PLACEHOLDER_TOKEN_REGEX") &&
      contentSource.includes("placeholderTokenRegex") &&
      contentSource.includes("trustedPlaceholders: currentPublicState.trustedPlaceholders") &&
      contentSource.includes("knownPlaceholders: currentPublicState.trustedPlaceholders") &&
      contentSource.includes("canonicalizePlaceholderToken: globalThis.PWM?.canonicalizePlaceholderToken"),
    "content response hydration should use the broad placeholder regex and latest trusted placeholder list"
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

function testContentDebugFacadeDiagnosticsStayMetadataOnly() {
  const rawSecret = "sk-live-content-debug-secret-value-123456789";
  const rawComposerText = `send ${rawSecret} to [PWM_1]`;
  const calls = [];
  const facade = ContentDebugFacade.createContentDebugFacade({
    root: {},
    DebugLogger: globalThis.PWM.DebugLogger,
    normalizeText: (value) => String(value || ""),
    normalizeEditorInnerText: (value) => String(value || ""),
    normalizeVisiblePlaceholders: (value) => String(value || ""),
    placeholderTokenRegex: /\[PWM_\d+\]/g,
    getInputText: (input) => input.text,
    getSelectionOffsets: () => ({ start: 0, end: 0 }),
    findSendButton: () => ({ disabled: false, getAttribute: () => null }),
    getHost: () => "chatgpt.com",
    isChatGptHost: () => true,
    createSafeFileAttachDebugPayload: (payload) => payload,
    console: {
      groupCollapsed(label) { calls.push(["groupCollapsed", label]); },
      log(payload) { calls.push(["log", payload]); },
      groupEnd() { calls.push(["groupEnd"]); }
    },
    localStorage: { getItem: () => "1" },
    sessionStorage: { getItem: () => null }
  });

  const snapshot = facade.collectComposerDebugSnapshot(
    { text: rawComposerText, innerText: rawComposerText, textContent: rawComposerText },
    rawComposerText,
    rawComposerText
  );
  const sync = facade.getChatGptComposerSyncDebug(
    {
      text: rawComposerText,
      innerText: rawComposerText,
      textContent: rawComposerText,
      tagName: "DIV",
      id: "secret-composer-id",
      className: `composer ${rawSecret}`,
      getAttribute(name) {
        return name === "data-testid" ? `prompt-${rawSecret}` : "";
      }
    },
    rawComposerText,
    rawComposerText
  );
  const serialized = JSON.stringify({ snapshot, sync });

  assert.strictEqual(serialized.includes(rawSecret), false, "content debug facade must not expose raw secret text");
  assert.strictEqual(serialized.includes("secret-composer-id"), false, "content debug facade must not expose raw element identifiers");
  assert.deepStrictEqual(Object.keys(snapshot.expected).sort(), ["length", "lineCount", "placeholderCount"]);
  assert.strictEqual(sync.expectedLength, rawComposerText.length);
  assert.strictEqual(sync.actualPlaceholderCount, 1);
  assert.strictEqual(sync.input.classLength, `composer ${rawSecret}`.length);
  assert.strictEqual(sync.input.dataTestIdLength, `prompt-${rawSecret}`.length);
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
  testPdfRedactedOutputStaysTextDerived();
  testDocxRedactedOutputStaysTextDerived();
  testXlsxRedactedOutputStaysTextDerived();
  testStaticAndDynamicFilePasteInjectionOrderStaysAligned();
  testBackgroundDeterministicRescanBackstopExists();
  testContentPublicStateIsMinimized();
  testRevealNeverInjectsHostDomContainers();
  testHostPageHydrationRequiresPlausibleSessionPlaceholders();
  testPlaceholderRehydrationStaysBoundedOnLargeDomMutations();
  testContentRuntimeInvalidationIsHandled();
  testManifestNoLongerExposesRevealUiToWebPages(manifest, runtimeResources);
  testExtensionPagesUseRestrictiveCsp(manifest);
  testOcrSpikeDoesNotEnterProductionPackage(manifest);
  testProtectedSiteOcrOptInStaysLocalAndGateBound();
  testImageRedactionCopyDoesNotPromiseRawUploadPassThrough();
  testUnsupportedProtectedImagesCannotReachRawReplayBranch();
  await testProtectedSiteOcrBrokerLoadTimeoutIsHandledAsBlockedResult();
  await testProtectedSiteOcrBrokerRejectsMalformedMessages();
  testProtectedSiteOcrBrokerMessageSurfaceIsNarrow();
  testPageUiNoLongerLeaksClassificationsOrMaskedFragments();
  testOnlyPwmPlaceholdersRemainCanonical();
  testContentDebugFacadeDiagnosticsStayMetadataOnly();
  console.log("PASS security hardening static regressions");
}

function testManifestNoLongerExposesRevealUiToWebPages(manifest, runtimeResources) {
  const entries = Array.isArray(manifest.web_accessible_resources) ? manifest.web_accessible_resources : [];
  const resources = entries.flatMap((entry) => entry.resources || []);
  const ocrResources = [
    "shared/ocr/ocrWorker.js",
    "shared/ocr/ocrWasmProbe.wasm",
    "shared/ocr/tesseract-core/tesseract-core.js",
    "shared/ocr/tesseract-core/tesseract-core.wasm",
    "shared/ocr/tessdata/eng.traineddata.gz",
    "shared/ocr/fixtures/synthetic-test-ocr.png",
    "content/protected_site_ocr_broker.html",
    "content/protected_site_ocr_broker_page.js"
  ];
  const aiEntry = entries.find((entry) =>
    (entry.resources || []).includes("ai/models/leakguard_secret_classifier.onnx")
  );
  const ocrEntry = entries.find((entry) => (entry.resources || []).includes("shared/ocr/ocrWorker.js"));

  assert.strictEqual(entries.length, 2, "manifest should expose only AI runtime and protected-site OCR asset groups");
  assert.deepStrictEqual(
    [...resources].sort(),
    [
      "ai/models/leakguard_secret_classifier.features.json",
      "ai/models/leakguard_secret_classifier.onnx",
      ...runtimeResources,
      ...ocrResources
    ].sort(),
    "manifest should expose only packaged AI model/runtime assets and local OCR worker assets"
  );
  assert.ok(
    resources.every((resource) => !resource.startsWith("popup/") && !resource.startsWith("ui/")),
    "manifest must not expose popup-only reveal assets to web pages"
  );
  assert.deepStrictEqual(
    aiEntry?.matches,
    manifest.content_scripts[0].matches,
    "AI runtime assets should only be web-accessible on protected content-script origins"
  );
  assert.deepStrictEqual(
    [...(ocrEntry?.resources || [])].sort(),
    [...ocrResources].sort(),
    "protected-site OCR should expose only the worker and local English OCR assets required by content scripts"
  );
  assert.deepStrictEqual(
    [...(ocrEntry?.matches || [])].sort(),
    ["http://*/*", "https://*/*"].sort(),
    "protected-site OCR worker assets must cover user-managed protected origins without adding host permissions"
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
        "script-src 'self' 'wasm-unsafe-eval'; object-src 'none'; base-uri 'none'; frame-ancestors 'none';",
      sandbox: "sandbox allow-scripts; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; object-src 'none'; base-uri 'none';"
    },
    "manifest should lock extension pages to packaged scripts, local WASM compilation, and disallow framing/base overrides"
  );
  assert.deepStrictEqual(
    manifest.sandbox,
    { pages: ["content/protected_site_ocr_broker.html"] },
    "only the protected-site OCR broker should run as a sandbox page"
  );
  const scriptSources =
    manifest.content_security_policy.extension_pages
      .split(";")
      .find((directive) => directive.trim().startsWith("script-src"))
      ?.trim()
      .split(/\s+/)
      .slice(1) || [];
  assert.ok(scriptSources.includes("'wasm-unsafe-eval'"), "CSP should allow local WASM compilation only");
  assert.strictEqual(scriptSources.includes("'unsafe-eval'"), false, "CSP must not allow unsafe-eval");
  assert.strictEqual(
    scriptSources.some((source) => /^(?:https?:|wss?:|data:|blob:)|cdn|unpkg/i.test(source)),
    false,
    "CSP must not allow remote, CDN, data, or blob script sources"
  );
}

function testOcrSpikeDoesNotEnterProductionPackage(manifest) {
  const allowedTesseractCoreProofPaths = new Set([
    "shared/ocr/tesseract-core/tesseract-core.js",
    "shared/ocr/tesseract-core/tesseract-core.wasm",
    "shared/ocr/tessdata/eng.traineddata.gz",
    "shared/ocr/fixtures/synthetic-test-ocr.png"
  ]);
  const dependencyNames = Object.keys(packageJson.dependencies || {}).map((name) => name.toLowerCase());
  for (const forbidden of ["tesseract.js", "tesseract.js-core", "@tesseract.js-data/eng", "ocrad.js"]) {
    assert.strictEqual(
      dependencyNames.includes(forbidden),
      false,
      `OCR spike package ${forbidden} must not be a production dependency`
    );
  }

  assert.deepStrictEqual(
    manifest.content_security_policy,
    {
      extension_pages:
        "script-src 'self' 'wasm-unsafe-eval'; object-src 'none'; base-uri 'none'; frame-ancestors 'none';",
      sandbox: "sandbox allow-scripts; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; object-src 'none'; base-uri 'none';"
    },
    "OCR WASM proof must not weaken extension-page CSP beyond local WASM compilation"
  );
  assert.strictEqual(
    String(manifest.content_security_policy?.extension_pages || "")
      .split(";")
      .find((directive) => directive.trim().startsWith("script-src"))
      ?.trim()
      .split(/\s+/)
      .includes("'unsafe-eval'") || false,
    false,
    "OCR spike must not require unsafe-eval"
  );

  const productionSources = [
    contentSource,
    backgroundSource,
    fileExtractorsSource,
    fileScannerSource,
    scannerSource,
    fileAttachPipelineSource,
    popupSource,
  ].join("\n").toLowerCase();
  for (const forbidden of ["tesseract", "ocrad", "traineddata", "cdn.jsdelivr", "unpkg.com"]) {
    assert.strictEqual(
      productionSources.includes(forbidden),
      false,
      `production runtime source must not include OCR package or remote asset string: ${forbidden}`
    );
  }

  const defaultDistTargets = ["chrome", "chrome-enterprise", "firefox", "firefox-enterprise"];
  const distFiles = [];
  for (const target of defaultDistTargets) {
    const defaultOcrRuntimePath = path.join(repoRoot, "dist", target, "shared", "ocr");
    const targetRoot = path.join(repoRoot, "dist", target);
    if (fs.existsSync(targetRoot)) {
      assert.deepStrictEqual(
        fs.existsSync(defaultOcrRuntimePath)
          ? fs.readdirSync(defaultOcrRuntimePath).sort()
          : [],
        ["fixtures", "ocrRuntime.js", "ocrWasmProbe.wasm", "ocrWorker.js", "tessdata", "tesseract-core"],
        `default target ${target} should package only the OCR worker proof shell, tiny WASM probe asset, isolated tesseract.js-core proof directory, English tessdata proof directory, and synthetic fixture directory`
      );
      assert.deepStrictEqual(
        fs.readdirSync(path.join(defaultOcrRuntimePath, "fixtures")).sort(),
        ["synthetic-test-ocr.png"],
        `default target ${target} should package only the synthetic OCR recognition proof fixture`
      );
      assert.deepStrictEqual(
        fs.readdirSync(path.join(defaultOcrRuntimePath, "tesseract-core")).sort(),
        ["tesseract-core.js", "tesseract-core.wasm"],
        `default target ${target} should package only the minimal tesseract.js-core proof loader and WASM`
      );
      assert.deepStrictEqual(
        fs.readdirSync(path.join(defaultOcrRuntimePath, "tessdata")).sort(),
        ["eng.traineddata.gz"],
        `default target ${target} should package only English traineddata for the language proof`
      );
      distFiles.push(...walkFiles(targetRoot));
    }
  }

  for (const file of distFiles) {
    const relative = path.relative(repoRoot, file).split(path.sep).join("/").toLowerCase();
    const isAllowedTesseractCoreProof = allowedTesseractCoreProofPaths.has(
      path.relative(path.join(repoRoot, relative.split("/")[0], relative.split("/")[1]), file)
        .split(path.sep)
        .join("/")
        .toLowerCase()
    );
    if (!isAllowedTesseractCoreProof) {
      assert.strictEqual(
        /tesseract|ocrad|traineddata|ocr[-_.](?!wasmprobe\.wasm).*\.wasm|\.traineddata/.test(relative),
        false,
        `dist must not contain OCR runtime asset: ${relative}`
      );
    }
    assert.strictEqual(
      /shared\/ocr\/tessdata\/(?!eng\.traineddata\.gz$).*traineddata/i.test(relative),
      false,
      `dist must not contain non-English traineddata: ${relative}`
    );
    if (/\.(js|json|html|css|txt|md)$/i.test(file)) {
      const text = fs.readFileSync(file, "utf8").toLowerCase();
      for (const forbidden of ["tesseract", "ocrad", "traineddata", "cdn.jsdelivr", "unpkg.com"]) {
        const tesseractCoreProofText =
          forbidden === "tesseract" &&
          (relative.includes("/shared/ocr/") || relative.endsWith("/content/protected_site_ocr_broker_page.js"));
        const englishTrainedDataProofText =
          forbidden === "traineddata" &&
          (relative.includes("/shared/ocr/") || relative.endsWith("/manifest.json")) &&
          text.includes("eng.traineddata.gz") &&
          !/tessdata\/(?!eng\.traineddata\.gz)/i.test(text);
        const manifestOcrWarText =
          relative.endsWith("/manifest.json") &&
          forbidden === "tesseract" &&
          text.includes("shared/ocr/tesseract-core/tesseract-core.js") &&
          text.includes("shared/ocr/tesseract-core/tesseract-core.wasm");
        if (!tesseractCoreProofText && !englishTrainedDataProofText && !manifestOcrWarText) {
          assert.strictEqual(
            text.includes(forbidden),
            false,
            `dist production file must not include OCR package or remote asset string ${forbidden}: ${relative}`
          );
        }
      }
      assert.strictEqual(
        /https?:\/\//i.test(text) && relative.includes("/shared/ocr/"),
        false,
        `dist OCR proof file must not include remote URL strings: ${relative}`
      );
      assert.strictEqual(
        /importscripts\s*\([^)]*(?:https?:|cdn|unpkg)/i.test(text),
        false,
        `dist production file must not import OCR worker code from a remote URL: ${relative}`
      );
      assert.strictEqual(
        /\beval\s*\(|\bnew\s+Function\b|\bFunction\s*\(/.test(text) && relative.includes("/shared/ocr/"),
        false,
        `OCR proof shell must not use eval or Function: ${relative}`
      );
    }
  }
}

function testProtectedSiteOcrOptInStaysLocalAndGateBound() {
  assert.ok(
    policySource.includes('PROTECTED_SITE_OCR_ENABLED_STORAGE_KEY = "pwm:protectedSiteOcrEnabled"'),
    "protected-site OCR setting should use the expected local storage key"
  );
  assert.ok(
    policySource.includes("async function isProtectedSiteOcrEnabled"),
    "protected-site OCR helper should be available from shared policy"
  );
  assert.ok(
    policySource.includes("ext?.storage?.local"),
    "protected-site OCR setting should read extension local storage"
  );
  assert.strictEqual(
    /storage\.sync|syncStorageArea/.test(policySource),
    false,
    "protected-site OCR policy helper must not use sync storage"
  );
  assert.strictEqual(
    /storage\.sync/.test(optionsSource),
    false,
    "protected-site OCR options plumbing must not use sync storage"
  );
  assert.ok(
    contentFileExtractionPipelineSource.includes("isProtectedSiteOcrEnabled"),
    "protected-site image upload path should consult the opt-in gate"
  );
  assert.ok(
    contentFileExtractionPipelineSource.includes("recognizeScannerImageFile") &&
      contentFileExtractionPipelineSource.indexOf("isProtectedSiteOcrEnabled") <
        contentFileExtractionPipelineSource.indexOf("recognizeScannerImageFile"),
    "protected-site OCR should stay behind the settings gate and reuse the shared scanner OCR helper"
  );
  assert.ok(
    contentFileExtractionPipelineSource.includes("safeForUpload: false") &&
      contentFileExtractionPipelineSource.includes("fallbackReason: ocrExtraction.status"),
    "failed protected-site OCR attempts should return a blocked result rather than raw upload fallback"
  );
  assert.ok(
    contentFileExtractionPipelineSource.includes('outputKind: "redacted_image_file"') &&
      contentFileExtractionPipelineSource.includes("fileOnlyUpload: true") &&
      contentFileExtractionPipelineSource.includes("skipTextFallback: true") &&
      contentFileExtractionPipelineSource.includes("protected_site_image_ocr_disabled"),
    "successful protected-site image redaction should produce a file-only redacted image and disabled OCR should block"
  );
  assert.ok(
    contentSource.includes("payload.allowFileOnlyHandoff = true;") &&
      contentSource.includes("payload.imageRedactionMode = true;") &&
      fileAttachPipelineSource.includes("Sanitized image attached."),
    "content handoff should disable image OCR text fallback and report image file attachment success"
  );
  assert.strictEqual(
    contentFileExtractionPipelineSource.includes("fallbackTextOnly"),
    false,
    "protected-site image redaction must not keep a sanitized text-only success fallback"
  );
  assert.strictEqual(
    /new\s+Worker|chrome\.storage|browser\.storage|localStorage|sessionStorage|console\.(?:log|warn|error)/.test(
      contentFileExtractionPipelineSource
    ),
    false,
    "protected-site OCR pipeline must not directly construct workers, persist OCR text, or log OCR text"
  );
}

function testImageRedactionCopyDoesNotPromiseRawUploadPassThrough() {
  for (const [label, source] of [
    ["file limits", fileLimitsSource],
    ["file paste helper", filePasteHelperSource],
    ["file transfer policy", fileTransferPolicySource],
    ["content script", contentSource]
  ]) {
    assertNotIncludes(
      source,
      "PDF, DOCX, images, archives, executables, and binary files",
      `${label} must not describe supported images as unsupported files`
    );
    assertNotIncludes(
      source,
      "Normal upload may continue through the site.",
      `${label} must not promise raw upload continuation for protected-site file failures`
    );
  }
}

function testUnsupportedProtectedImagesCannotReachRawReplayBranch() {
  assert.ok(
    contentSource.includes("isUnsupportedImageFileForProtectedUpload"),
    "content script should identify unsupported image uploads for protected fail-closed handling"
  );
  for (const extension of ['".gif"', '".bmp"', '".ico"', '".svg"']) {
    assert.ok(contentSource.includes(extension), `protected unsupported image guard should cover ${extension}`);
  }
  assert.ok(
    contentSource.includes("image/"),
    "protected unsupported image guard should cover unsupported image/* MIME types"
  );
  assert.ok(
    contentSource.includes("Raw image upload blocked. This image type is not supported for safe redaction."),
    "protected unsupported image UX should explain fail-closed image blocking"
  );

  const failClosedSource = extractFunctionSource(contentSource, "shouldFailClosedProtectedUnsupportedFileTransfer");
  assert.ok(
    failClosedSource.includes("isUnsupportedImageFileForProtectedUpload"),
    "protected unsupported fail-closed helper should include unsupported images"
  );

  const blockIndex = contentSource.indexOf("shouldFailClosedProtectedUnsupportedFileTransfer(transferPolicy)");
  const replayIndex = contentSource.indexOf('handOffOriginalLocalFile(event, snapshotDataTransfer, "drop")');
  assert.notStrictEqual(blockIndex, -1, "drop handler should check protected unsupported fail-closed policy");
  if (replayIndex !== -1) {
    assert.ok(
      blockIndex < replayIndex,
      "protected unsupported image block must run before any raw original Gemini replay"
    );
  }
}

function testProtectedSiteOcrBrokerMessageSurfaceIsNarrow() {
  assert.ok(
    protectedSiteOcrBrokerSource.includes("new root.MessageChannel()") &&
      protectedSiteOcrBrokerSource.includes("channel.port1.onmessage"),
    "content broker should receive raw OCR results only through a private MessageChannel"
  );
  assert.ok(
    protectedSiteOcrBrokerSource.includes("channelId: brokerChannelId"),
    "content broker should bind sandbox messages to a private channel id"
  );
  assert.ok(
    protectedSiteOcrBrokerPageSource.includes("window.parent") &&
      protectedSiteOcrBrokerPageSource.includes("event.source !== window.parent"),
    "sandbox broker page should only accept messages from its parent content frame"
  );
  assert.ok(
    protectedSiteOcrBrokerPageSource.includes("isValidRequestMessage"),
    "sandbox broker page should validate request message shape before OCR"
  );
  assert.ok(
    protectedSiteOcrBrokerPageSource.includes("allowedMimeTypes") &&
      protectedSiteOcrBrokerPageSource.includes("image/png") &&
      protectedSiteOcrBrokerPageSource.includes("image/jpeg") &&
      protectedSiteOcrBrokerPageSource.includes("image/webp"),
    "sandbox broker page should allow only PNG, JPG/JPEG, and WEBP OCR payloads"
  );
  assert.strictEqual(
    /target\?\.postMessage|event\.source\.postMessage|window\.parent\.postMessage/.test(protectedSiteOcrBrokerPageSource),
    false,
    "sandbox broker page must not post raw OCR results onto the page window message stream"
  );
  assert.strictEqual(
    /console\.(?:log|warn|error)|localStorage|sessionStorage|chrome\.storage|browser\.storage/.test(
      protectedSiteOcrBrokerPageSource
    ),
    false,
    "sandbox broker page must not log or persist OCR text"
  );
}

async function testProtectedSiteOcrBrokerLoadTimeoutIsHandledAsBlockedResult() {
  assert.ok(
    protectedSiteOcrBrokerSource.includes("iframeReady.catch"),
    "broker frame readiness timeout should be explicitly handled to avoid Chrome extension error noise"
  );

  const timers = [];
  const sandbox = {
    ArrayBuffer,
    Date,
    Error,
    Math,
    Number,
    Object,
    Promise,
    clearTimeout(id) {
      const timer = timers.find((entry) => entry.id === id);
      if (timer) timer.cleared = true;
    },
    setTimeout(callback, delay) {
      const id = timers.length + 1;
      timers.push({ id, callback, delay, cleared: false });
      return id;
    },
    crypto: {
      randomUUID() {
        return "test-channel";
      }
    },
    chrome: {
      runtime: {
        getURL(pathname) {
          return `chrome-extension://test/${pathname}`;
        }
      }
    },
    document: {
      documentElement: {
        appendChild(node) {
          node.parentNode = this;
        },
        removeChild(node) {
          node.parentNode = null;
        }
      },
      createElement(tagName) {
        assert.strictEqual(tagName, "iframe");
        return {
          hidden: false,
          style: {},
          contentWindow: {
            postMessage() {
              throw new Error("load timeout should block before posting to the iframe");
            }
          },
          addEventListener() {},
          setAttribute() {}
        };
      }
    },
    MessageChannel: function MessageChannel() {
      this.port1 = {
        onmessage: null,
        close() {}
      };
      this.port2 = {};
    },
    PWM: {}
  };
  vm.createContext(sandbox);
  vm.runInContext(protectedSiteOcrBrokerSource, sandbox, {
    filename: "protectedSiteOcrBroker.js"
  });

  const resultPromise = sandbox.PWM.ProtectedSiteOcrBroker.prepare({ timeoutMs: 10000 });
  const loadTimeout = timers.find((entry) => entry.delay === 5000);
  assert.ok(loadTimeout, "broker should install a frame load timeout");
  loadTimeout.callback();

  const result = await resultPromise;
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.status, "ocr_recognition_blocked");
  assert.deepStrictEqual(Array.from(result.warnings), ["protected_site_ocr_broker_load_timeout"]);
  assert.strictEqual(result.reason, "protected_site_ocr_broker_load_timeout");
}

async function testProtectedSiteOcrBrokerRejectsMalformedMessages() {
  let handler = null;
  let runtimeCalls = 0;
  const parent = {};
  const replies = [];
  const sandbox = {
    ArrayBuffer,
    Set,
    Object,
    String,
    window: {
      parent,
      PWM: {
        OcrRuntime: {
          async recognizeImageBytes(payload) {
            runtimeCalls += 1;
            return {
              ok: true,
              status: "ocr_recognition_ready",
              language: "eng",
              text: `OCR:${payload.mimeType}`,
              textLength: 13,
              confidenceBucket: "high",
              warnings: []
            };
          }
        }
      },
      addEventListener(type, callback) {
        if (type === "message") handler = callback;
      }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(protectedSiteOcrBrokerPageSource, sandbox, {
    filename: "protected_site_ocr_broker_page.js"
  });

  assert.strictEqual(typeof handler, "function", "broker page should register a message handler");
  const makePort = () => ({
    postMessage(message) {
      replies.push(message);
    }
  });

  await handler({
    source: {},
    ports: [makePort()],
    data: {
      source: "LeakGuardProtectedSiteOcr",
      channelId: "channel",
      requestId: "foreign",
      payload: {
        imageBytes: new ArrayBuffer(1),
        mimeType: "image/png",
        language: "eng"
      }
    }
  });
  await handler({
    source: parent,
    ports: [],
    data: {
      source: "LeakGuardProtectedSiteOcr",
      channelId: "channel",
      requestId: "missing-port",
      payload: {
        imageBytes: new ArrayBuffer(1),
        mimeType: "image/png",
        language: "eng"
      }
    }
  });
  await handler({
    source: parent,
    ports: [makePort()],
    data: {
      source: "LeakGuardProtectedSiteOcr",
      channelId: "channel",
      requestId: "unsupported",
      payload: {
        imageBytes: new ArrayBuffer(1),
        mimeType: "image/gif",
        language: "eng"
      }
    }
  });
  await handler({
    source: parent,
    ports: [makePort()],
    data: {
      source: "LeakGuardProtectedSiteOcr",
      channelId: "channel",
      requestId: "malformed-prepare-extra-payload",
      prepare: true,
      payload: {
        imageBytes: new ArrayBuffer(1),
        mimeType: "image/png",
        language: "eng"
      }
    }
  });
  await handler({
    source: parent,
    ports: [makePort()],
    data: {
      source: "LeakGuardProtectedSiteOcr",
      channelId: "channel",
      requestId: "malformed-prepare-timeout",
      prepare: true,
      timeoutMs: -1
    }
  });

  assert.strictEqual(runtimeCalls, 0, "malformed broker messages must not call OCR");
  assert.strictEqual(replies.length, 0, "malformed broker messages must not receive replies");

  await handler({
    source: parent,
    ports: [makePort()],
    data: {
      source: "LeakGuardProtectedSiteOcr",
      channelId: "channel",
      requestId: "valid-prepare",
      prepare: true,
      timeoutMs: 1000
    }
  });

  assert.strictEqual(runtimeCalls, 0, "valid broker prepare should not call OCR or expose OCR text");
  assert.strictEqual(replies.length, 1, "valid broker prepare should reply through the private port");
  assert.strictEqual(replies[0].requestId, "valid-prepare");
  assert.strictEqual(replies[0].result.ok, true);
  assert.strictEqual(replies[0].result.status, "protected_site_ocr_broker_ready");
  assert.strictEqual(replies[0].result.language, "eng");
  assert.strictEqual(Object.prototype.hasOwnProperty.call(replies[0].result, "text"), false);

  await handler({
    source: parent,
    ports: [makePort()],
    data: {
      source: "LeakGuardProtectedSiteOcr",
      channelId: "channel",
      requestId: "valid",
      payload: {
        imageBytes: new ArrayBuffer(1),
        mimeType: "image/webp",
        language: "eng"
      }
    }
  });

  assert.strictEqual(runtimeCalls, 1, "valid private-channel broker message should call OCR once");
  assert.strictEqual(replies.length, 2, "valid broker message should reply through the private port");
  assert.strictEqual(replies[1].requestId, "valid");
  assert.strictEqual(replies[1].result.text, "OCR:image/webp");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
