const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");
require(path.join(repoRoot, "shared/placeholders.js"));
const contentSource = fs.readFileSync(path.join(repoRoot, "content/content.js"), "utf8");
const backgroundSource = fs.readFileSync(
  path.join(repoRoot, "background/service_worker.js"),
  "utf8"
);
const harnessSource = fs.readFileSync(
  path.join(repoRoot, "sandbox/composer-harness.js"),
  "utf8"
);
const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, "manifest.json"), "utf8"));
const {
  PLACEHOLDER_TOKEN_REGEX,
  normalizeVisiblePlaceholders,
  canonicalizePlaceholderToken
} = globalThis.PWM;

function assertNotIncludes(source, needle, message) {
  assert.strictEqual(source.includes(needle), false, message);
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
    contentSource.includes("PWM_CREATE_REVEAL_REQUEST"),
    "content script should create opaque reveal requests"
  );
  assert.ok(
    contentSource.includes("ui/reveal_panel.html"),
    "content script should open the secure reveal iframe"
  );
  assert.ok(
    backgroundSource.includes("PWM_EXTENSION_REVEAL_SECRET"),
    "background should expose a reveal handler for extension UI"
  );
  assert.ok(
    backgroundSource.includes("isExtensionUiSender"),
    "background reveal handler should verify extension UI sender context"
  );
}

function testManifestExposeOnlyRevealUiAssets() {
  const resourceBlock = manifest.web_accessible_resources.find((entry) =>
    (entry.resources || []).includes("ui/reveal_panel.html")
  );

  assert.ok(resourceBlock, "manifest must expose the secure reveal UI to the content script");
  assert.ok(
    resourceBlock.resources.includes("ui/reveal_panel.css") &&
      resourceBlock.resources.includes("ui/reveal_panel.js"),
    "manifest should expose the reveal UI assets together"
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

  assert.strictEqual(/\[(?!PWM_)[A-Z][A-Z0-9_]*_\d+\]/.test(normalized), false);
  assert.ok(normalized.includes(`API_KEY=${canonicalizePlaceholderToken("[API_KEY_1]")}`));
}

function run() {
  testUnsafeContentRevealPathRemoved();
  testSafeRevealUiExists();
  testManifestExposeOnlyRevealUiAssets();
  testPageUiNoLongerLeaksClassificationsOrMaskedFragments();
  testOnlyPwmPlaceholdersRemainCanonical();
  console.log("PASS security hardening static regressions");
}

run();
