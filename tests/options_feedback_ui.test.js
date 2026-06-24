const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");
const optionsHtml = fs.readFileSync(path.join(repoRoot, "src/options/options.html"), "utf8");
const optionsSource = fs.readFileSync(path.join(repoRoot, "src/options/options.js"), "utf8");
const optionsCss = fs.readFileSync(path.join(repoRoot, "src/options/options.css"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, "manifests/base.json"), "utf8"));

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

function testFeedbackUiLoadsSafeBuilderAndRendersReviewSurface() {
  assert.ok(
    optionsHtml.includes('<script src="../shared/feedbackReport.js"></script>') &&
      optionsHtml.indexOf("../shared/feedbackReport.js") < optionsHtml.indexOf("options.js"),
    "options page should load feedback report builder before options.js"
  );
  assert.ok(optionsHtml.includes('id="feedback-section" hidden'));
  assert.ok(optionsHtml.includes('id="feedback-description"'));
  assert.ok(optionsHtml.includes('id="feedback-report-preview"'));
  assert.ok(optionsHtml.includes('id="copy-feedback-report"'));
  assert.ok(optionsHtml.includes('id="open-feedback-link"'));
  assert.ok(optionsHtml.includes("<h2>Report an issue</h2>"));
  assert.ok(optionsHtml.includes("LeakGuard prepares a safe metadata-only GitHub issue report for you to review first."));
  assert.ok(optionsHtml.includes('id="feedback-entry" type="button">Prepare GitHub Issue</button>'));
  assert.ok(optionsHtml.includes('aria-describedby="feedback-safety-note"'));
  assert.ok(optionsHtml.includes("Generated safe report"));
  assert.ok(
    optionsHtml.includes(
      "Do not paste secrets, prompts, file contents, filenames, screenshots, OCR text, logs, or sensitive data."
    ),
    "feedback UI should show the required warning"
  );
  assert.ok(optionsCss.includes(".feedback-report-preview"));
}

function testFeedbackUiIsPolicyGated() {
  const availabilitySource = extractFunctionSource(optionsSource, "isFeedbackAvailable");
  const updatePolicySource = extractFunctionSource(optionsSource, "updatePolicy");
  const isFeedbackAvailable = Function(`"use strict"; return (${availabilitySource});`)();

  assert.ok(optionsSource.includes("allowFeedback: false"));
  assert.ok(availabilitySource.includes("policy?.allowFeedback === true"));
  assert.ok(availabilitySource.includes("policy?.strictFailure !== true"));
  assert.strictEqual(isFeedbackAvailable(null), false, "missing policy should hide feedback");
  assert.strictEqual(isFeedbackAvailable({ allowFeedback: false }), false, "disabled policy should hide feedback");
  assert.strictEqual(isFeedbackAvailable({ allowFeedback: "true" }), false, "malformed policy should hide feedback");
  assert.strictEqual(isFeedbackAvailable({ allowFeedback: true }), true, "enabled policy should show feedback");
  assert.strictEqual(
    isFeedbackAvailable({ allowFeedback: true, strictFailure: true }),
    false,
    "strict policy failure should hide feedback even when allowFeedback is true"
  );
  assert.ok(updatePolicySource.includes("allowFeedback: isFeedbackAvailable(policy)"));
  assert.ok(updatePolicySource.includes("feedbackSectionEl.hidden = !currentPolicy.allowFeedback"));
  assert.ok(updatePolicySource.includes("feedbackEntryButtonEl.disabled = !currentPolicy.allowFeedback"));
  assert.ok(updatePolicySource.includes("resetFeedbackReport"));
}

function testFeedbackReportUsesOnlyAllowedMetadata() {
  const buildSource = extractFunctionSource(optionsSource, "buildOptionsFeedbackReportInput");

  for (const allowed of [
    "leakGuardVersion",
    "browserName",
    "browserVersion",
    "extensionBuild",
    "extensionChannel",
    "providerCategory",
    "featureArea",
    "safeReasonCodes",
    "fileCount",
    "blockedCount",
    "adapterName",
    "description"
  ]) {
    assert.ok(buildSource.includes(allowed), `expected feedback metadata to include ${allowed}`);
  }

  for (const forbidden of [
    "location.href",
    "activeTab",
    "tabs.query",
    "filename",
    "fileName",
    "fileContent",
    "ocrText",
    "innerText",
    "textContent",
    "prompt",
    "message",
    "logs",
    "diagnostics",
    "screenshot"
  ]) {
    assert.strictEqual(
      buildSource.includes(forbidden),
      false,
      `feedback metadata builder must not capture ${forbidden}`
    );
  }
}

function testFeedbackActionsAreExplicitAndNonNetworked() {
  assert.ok(optionsSource.includes("handleCopyFeedbackReport"));
  assert.ok(optionsSource.includes("handleOpenFeedbackLink"));
  assert.ok(optionsSource.includes("navigator.clipboard.writeText"));
  assert.ok(optionsSource.includes('window.open(url, "_blank", "noopener,noreferrer")'));
  assert.ok(
    optionsSource.includes("DEFAULT_FEEDBACK_GITHUB_REPOSITORY") &&
      optionsSource.includes("isFeedbackGithubTargetConfigured"),
    "GitHub opening should require a configured target check"
  );

  for (const forbidden of [
    "fetch(",
    "XMLHttpRequest",
    "WebSocket",
    "FormData",
    "chrome.tabs.create",
    "browser.tabs.create",
    "runtime.sendMessage({ type: \"PWM_SEND",
    "chrome.permissions.request",
    "browser.permissions.request"
  ]) {
    assert.strictEqual(optionsSource.includes(forbidden), false, `feedback UI must not use ${forbidden}`);
  }
}

function testManifestPermissionsAndCspStayRestrictive() {
  assert.deepStrictEqual(manifest.permissions, ["storage", "scripting", "activeTab", "downloads"]);
  assert.deepStrictEqual(manifest.host_permissions, [
    "https://chatgpt.com/*",
    "https://chat.openai.com/*",
    "https://gemini.google.com/*",
    "https://claude.ai/*",
    "https://grok.com/*",
    "https://x.com/*"
  ]);
  assert.deepStrictEqual(
    manifest.content_security_policy.extension_pages,
    "script-src 'self' 'wasm-unsafe-eval'; object-src 'none'; base-uri 'none'; frame-ancestors 'none';"
  );
}

testFeedbackUiLoadsSafeBuilderAndRendersReviewSurface();
testFeedbackUiIsPolicyGated();
testFeedbackReportUsesOnlyAllowedMetadata();
testFeedbackActionsAreExplicitAndNonNetworked();
testManifestPermissionsAndCspStayRestrictive();

console.log("PASS options feedback UI regressions");
