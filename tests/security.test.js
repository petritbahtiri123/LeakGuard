const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { pathToFileURL } = require("url");

const repoRoot = path.join(__dirname, "..");
require(path.join(repoRoot, "src/shared/placeholders.js"));
require(path.join(repoRoot, "src/shared/sessionMapStore.js"));
const contentSource = fs.readFileSync(path.join(repoRoot, "src/content/content.js"), "utf8");
const backgroundSource = fs.readFileSync(
  path.join(repoRoot, "src/background/core.js"),
  "utf8"
);
const filePasteHelperSource = fs.readFileSync(
  path.join(repoRoot, "src/content/file_paste_helpers.js"),
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
  const createSecretSpanSource = extractFunctionSource(contentSource, "createSecretSpan");
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
    localFileSource.includes("redacted_insertion_failed") &&
      localFileSource.includes("LeakGuard blocked raw file upload. Redacted insertion failed"),
    "local file paste/drop should fail closed when redacted insertion cannot be verified"
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

function testStaticAndDynamicFilePasteInjectionOrderStaysAligned() {
  const baseManifest = JSON.parse(fs.readFileSync(path.join(repoRoot, "manifests/base.json"), "utf8"));
  const staticScripts = baseManifest.content_scripts[0].js;
  const dynamicScripts = Array.from(
    backgroundSource.matchAll(/"([^"]+(?:fileScanner|file_paste_helpers|content)\.js)"/g)
  ).map((match) => match[1]);

  const staticFileScanner = staticScripts.indexOf("shared/fileScanner.js");
  const staticFilePaste = staticScripts.indexOf("content/file_paste_helpers.js");
  const staticContent = staticScripts.indexOf("content/content.js");
  const dynamicFileScanner = dynamicScripts.indexOf("shared/fileScanner.js");
  const dynamicFilePaste = dynamicScripts.indexOf("content/file_paste_helpers.js");
  const dynamicContent = dynamicScripts.indexOf("content/content.js");

  assert.ok(
    staticFileScanner > -1 && staticFilePaste > -1 && staticContent > -1,
    "static manifest should include scanner, file paste helper, and content script"
  );
  assert.ok(
    dynamicFileScanner > -1 && dynamicFilePaste > -1 && dynamicContent > -1,
    "dynamic injection should include scanner, file paste helper, and content script"
  );
  assert.ok(
    staticFileScanner < staticFilePaste && staticFilePaste < staticContent,
    "static manifest file paste order should load dependencies before content.js"
  );
  assert.ok(
    dynamicFileScanner < dynamicFilePaste && dynamicFilePaste < dynamicContent,
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
    contentSource.includes("function shouldHydratePlaceholder"),
    "content script should gate placeholder hydration on plausible current-session state"
  );
  assert.ok(
    contentSource.includes("currentPublicState.placeholderCount"),
    "host-page hydration should rely only on safe public placeholder counts"
  );
}

function testPlaceholderRehydrationStaysBoundedOnLargeDomMutations() {
  const observerSource = extractFunctionSource(contentSource, "startRehydrationObserver");
  const urlChangeSource = extractFunctionSource(contentSource, "handleUrlChange");

  assert.ok(
    observerSource.includes("const containsPlaceholder = PLACEHOLDER_TOKEN_REGEX.test(normalizedText);") &&
      observerSource.includes("if (!containsPlaceholder) return;") &&
      observerSource.indexOf("if (!containsPlaceholder) return;") <
        observerSource.indexOf("rehydrateTree(node);"),
    "added element subtrees should be skipped before TreeWalker scanning when they contain no placeholders"
  );
  assert.ok(
    contentSource.includes(".pwm-modal-backdrop, .pwm-secret, form, textarea") &&
      contentSource.includes("[role='textbox']") &&
      contentSource.includes("[contenteditable='true']"),
    "already hydrated placeholders and editable composers should be excluded from page-DOM rehydration"
  );
  assert.ok(
    urlChangeSource.includes("if (location.href === currentUrl) return;") &&
      urlChangeSource.indexOf("if (location.href === currentUrl) return;") <
        urlChangeSource.indexOf("rehydrateTree(document.body);"),
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
  testAuditMetadataObjectsExcludeRawSecrets();
  await testSecureRevealRemainsBoundedToRequestSessionAndExtensionUi();
  testPlaceholderLabelsDoNotExposeRawValues();
  testLocalFilePasteDoesNotExposeRawFileContent();
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
