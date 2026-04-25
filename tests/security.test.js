const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const repoRoot = path.join(__dirname, "..");
require(path.join(repoRoot, "src/shared/placeholders.js"));
const contentSource = fs.readFileSync(path.join(repoRoot, "src/content/content.js"), "utf8");
const backgroundSource = fs.readFileSync(
  path.join(repoRoot, "src/background/core.js"),
  "utf8"
);
const popupSource = fs.readFileSync(path.join(repoRoot, "src/popup/popup.js"), "utf8");
const harnessSource = fs.readFileSync(
  path.join(repoRoot, "sandbox/composer-harness.js"),
  "utf8"
);
const {
  PLACEHOLDER_TOKEN_REGEX,
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

function testContentPublicStateIsMinimized() {
  const toPublicStateSource = extractFunctionSource(backgroundSource, "toPublicState");

  assertNotIncludes(
    toPublicStateSource,
    "knownPlaceholders: publicState.knownPlaceholders",
    "background should not expose the placeholder list to the content script"
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
  const { buildManifest } = await import(
    pathToFileURL(path.join(repoRoot, "scripts/build-extension.mjs")).href
  );
  const manifest = buildManifest("chrome", "consumer");

  testUnsafeContentRevealPathRemoved();
  testSafeRevealUiExists();
  testContentPublicStateIsMinimized();
  testRevealNeverInjectsHostDomContainers();
  testHostPageHydrationRequiresPlausibleSessionPlaceholders();
  testContentRuntimeInvalidationIsHandled();
  testManifestNoLongerExposesRevealUiToWebPages(manifest);
  testExtensionPagesUseRestrictiveCsp(manifest);
  testPageUiNoLongerLeaksClassificationsOrMaskedFragments();
  testOnlyPwmPlaceholdersRemainCanonical();
  console.log("PASS security hardening static regressions");
}

function testManifestNoLongerExposesRevealUiToWebPages(manifest) {
  const entries = Array.isArray(manifest.web_accessible_resources) ? manifest.web_accessible_resources : [];
  const resources = entries.flatMap((entry) => entry.resources || []);

  assert.strictEqual(entries.length, 1, "manifest should expose only the AI runtime asset group");
  assert.deepStrictEqual(
    [...resources].sort(),
    [
      "ai/models/leakguard_secret_classifier.features.json",
      "ai/models/leakguard_secret_classifier.onnx",
      "vendor/onnxruntime/ort-wasm-simd-threaded.wasm",
      "vendor/onnxruntime/ort-wasm-simd.wasm",
      "vendor/onnxruntime/ort-wasm-threaded.wasm",
      "vendor/onnxruntime/ort-wasm.wasm"
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
