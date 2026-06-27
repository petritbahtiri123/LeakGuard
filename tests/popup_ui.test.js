const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");
const popupHtml = fs.readFileSync(path.join(repoRoot, "src/popup/popup.html"), "utf8");
const popupSource = fs.readFileSync(path.join(repoRoot, "src/popup/popup.js"), "utf8");
const contentSource = fs.readFileSync(path.join(repoRoot, "src/content/content.js"), "utf8");
const backgroundSource = fs.readFileSync(path.join(repoRoot, "src/background/core.js"), "utf8");

function extractFunctionSource(source, name) {
  const match = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(source);
  assert.ok(match, `expected to find function ${name}`);
  const start = match.index;
  const openBrace = source.indexOf("{", source.indexOf(")", start));
  assert.notStrictEqual(openBrace, -1, `expected ${name} body`);

  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = openBrace; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`expected ${name} to close`);
}

function testPauseButtonVisibleOnlyForProtectedOrPausedTab() {
  assert.ok(popupHtml.includes('id="pause-btn"'), "popup should render a Pause Protection button");
  assert.ok(
    popupSource.includes("let currentSiteProtectionEligible = false"),
    "popup should track whether the current tab is actually protected before showing pause controls"
  );

  const renderOverviewSource = extractFunctionSource(popupSource, "renderOverview");
  assert.ok(
    renderOverviewSource.indexOf("const site = overview?.currentSite || null") <
      renderOverviewSource.indexOf("currentSiteProtectionEligible = Boolean(site?.protected)"),
    "popup should derive pause visibility from the current site overview"
  );
  assert.ok(
    renderOverviewSource.indexOf("currentSiteProtectionEligible = Boolean(site?.protected)") <
      renderOverviewSource.indexOf("updateProtection("),
    "popup should update pause visibility after current-site protection status is known"
  );

  const updateProtectionSource = extractFunctionSource(popupSource, "updateProtection");
  assert.ok(
    updateProtectionSource.includes("!currentProtection.allowProtectionPause") &&
      updateProtectionSource.includes("!currentSiteProtectionEligible && !currentProtection.paused"),
    "Pause Protection should be hidden on unprotected tabs unless a visible Resume action is needed"
  );
  assert.ok(
    updateProtectionSource.includes('currentProtection.paused ? "Resume Protection" : "Pause Protection"'),
    "pause button label should reflect the stored pause state"
  );
}

function testPauseMessagesAndStorageScopeAreTabScoped() {
  const popupPauseSource = extractFunctionSource(popupSource, "setProtectionPaused");
  assert.ok(popupPauseSource.includes('type: "PWM_SET_PROTECTION_PAUSED"'));
  assert.ok(popupPauseSource.includes("url: activeTab.url"));
  assert.ok(popupPauseSource.includes("tabId: activeTab.id"));
  assert.ok(popupPauseSource.includes("durationMinutes: currentPolicy.protectionPauseMaxMinutes || 15"));
  assert.ok(popupPauseSource.includes("updateProtection(response.state?.protection)"));

  const backgroundPauseSource = extractFunctionSource(backgroundSource, "setProtectionPaused");
  assert.ok(backgroundPauseSource.includes("initState(tabId, url)"));
  assert.ok(backgroundPauseSource.includes("protectionPause"));
  assert.ok(backgroundPauseSource.includes("pausedUntil: paused ? Date.now() + minutes * 60 * 1000 : 0"));
  assert.ok(backgroundPauseSource.includes("return toPublicState(nextState, policySummary)"));
}

function testPauseDoesNotBypassEnforcedPolicyButPausesFileSafety() {
  const pauseGateSource = extractFunctionSource(contentSource, "isProtectionPauseActiveAfterPolicy");
  assert.ok(pauseGateSource.includes("if (protection.protectionEnforced) return false"));
  assert.ok(pauseGateSource.includes("if (policy?.strictFailure) return false"));
  assert.ok(pauseGateSource.includes("if (destinationPolicy?.blocked || destinationPolicy?.requiresRedaction) return false"));

  const fileDriverSource = extractFunctionSource(contentSource, "isProtectedFileDropDriver");
  const enforcedIndex = fileDriverSource.indexOf("if (protection.protectionEnforced === true) return true");
  const pausedIndex = fileDriverSource.indexOf("if (protection.paused === true && protection.allowProtectionPause === true) return false");
  const builtinIndex = fileDriverSource.indexOf('id === "gemini"');
  assert.ok(enforcedIndex >= 0, "enforced policy should still protect file flows");
  assert.ok(pausedIndex > enforcedIndex, "policy enforcement should win before pause is honored");
  assert.ok(
    builtinIndex > pausedIndex,
    "paused protection should disable built-in protected-site file interception"
  );
}

function testDisabledSavedSiteOverviewStillReturnsProtectionState() {
  const overviewSource = extractFunctionSource(backgroundSource, "getProtectedSiteOverview");
  const disabledBranchIndex = overviewSource.indexOf("if (storedRule && !storedRule.enabled)");
  assert.ok(disabledBranchIndex >= 0, "expected disabled saved-site overview branch");
  assert.ok(
    /if \(storedRule && !storedRule\.enabled\)[\s\S]*?return \{[\s\S]*?policy,[\s\S]*?protection,/.test(overviewSource),
    "disabled saved-site overview should include protection state so popup pause UI cannot reuse stale defaults"
  );
}

testPauseButtonVisibleOnlyForProtectedOrPausedTab();
testPauseMessagesAndStorageScopeAreTabScoped();
testPauseDoesNotBypassEnforcedPolicyButPausesFileSafety();
testDisabledSavedSiteOverviewStillReturnsProtectionState();

console.log("PASS popup UI pause protection regressions");
