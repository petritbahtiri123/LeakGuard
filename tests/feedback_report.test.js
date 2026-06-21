const assert = require("assert");
const {
  DEFAULT_FEEDBACK_GITHUB_REPOSITORY,
  FEEDBACK_DESCRIPTION_WARNING,
  buildFeedbackReport,
  buildGitHubFeedbackDiscussionUrl,
  buildGitHubFeedbackIssueUrl,
  formatFeedbackReport
} = require("../src/shared/feedbackReport.js");

const forbiddenPayload = {
  leakGuardVersion: "2.2.0",
  browserName: "Chrome",
  browserVersion: "126.0.0",
  extensionBuild: "consumer",
  extensionChannel: "local-dev",
  providerCategory: "chat-ai",
  featureArea: "file handoff",
  safeReasonCodes: ["policy_disabled", "blocked_file"],
  fileCount: 2,
  blockedCount: 1,
  adapterName: "gemini",
  description: "The report button did not copy anything.",
  prompt: "Prompt text with sk-live-should-not-appear",
  message: "Message body should not appear",
  messages: ["another prompt"],
  fileContent: "API_KEY=raw-secret",
  fileContents: "password=hunter2",
  filename: "customer-secrets.env",
  fileName: "incident-token.txt",
  ocrText: "OCR captured raw screen text",
  secret: "sk-live-secret",
  suspectedSecret: "AKIAIOSFODNN7EXAMPLE",
  pageUrl: "https://example.test/chat?token=raw-secret",
  url: "https://example.test/path?query=raw-secret",
  domText: "raw composer DOM text",
  screenshot: "base64-image-data",
  logs: ["raw diagnostic log"],
  rawDiagnostics: { token: "raw" },
  unknownField: "unknown value"
};

function testAllowedFieldsAppearAndReportIsDeterministic() {
  const first = buildFeedbackReport(forbiddenPayload);
  const second = buildFeedbackReport({ ...forbiddenPayload });
  const rendered = formatFeedbackReport(first);

  assert.deepStrictEqual(first, second, "feedback report should be deterministic for the same input");
  assert.deepStrictEqual(Object.keys(first), [
    "warning",
    "leakGuardVersion",
    "browser",
    "extension",
    "providerCategory",
    "featureArea",
    "safeReasonCodes",
    "fileCount",
    "blockedCount",
    "adapterName",
    "description"
  ]);
  assert.strictEqual(first.warning, FEEDBACK_DESCRIPTION_WARNING);
  assert.deepStrictEqual(first.browser, {
    name: "Chrome",
    version: "126.0.0"
  });
  assert.deepStrictEqual(first.extension, {
    build: "consumer",
    channel: "local-dev"
  });
  assert.deepStrictEqual(first.safeReasonCodes, ["policy_disabled", "blocked_file"]);
  assert.strictEqual(first.fileCount, 2);
  assert.strictEqual(first.blockedCount, 1);
  assert.ok(rendered.includes("LeakGuard version: 2.2.0"));
  assert.ok(rendered.includes("Browser: Chrome 126.0.0"));
  assert.ok(rendered.includes("User description: The report button did not copy anything."));
}

function testForbiddenAndUnknownFieldsDoNotSerialize() {
  const report = buildFeedbackReport(forbiddenPayload);
  const rendered = formatFeedbackReport(report);
  const serialized = JSON.stringify({ report, rendered });

  for (const forbidden of [
    "sk-live-should-not-appear",
    "Message body should not appear",
    "API_KEY=raw-secret",
    "password=hunter2",
    "customer-secrets.env",
    "incident-token.txt",
    "OCR captured raw screen text",
    "sk-live-secret",
    "AKIAIOSFODNN7EXAMPLE",
    "https://example.test/chat?token=raw-secret",
    "https://example.test/path?query=raw-secret",
    "raw composer DOM text",
    "base64-image-data",
    "raw diagnostic log",
    "unknown value"
  ]) {
    assert.strictEqual(
      serialized.includes(forbidden),
      false,
      `feedback report must not serialize forbidden value: ${forbidden}`
    );
  }
}

function testUnsafeLabelsAndCountsFailClosed() {
  const report = buildFeedbackReport({
    leakGuardVersion: "2.2.0?token=raw-secret",
    browserName: "Firefox",
    browserVersion: "127.0",
    extensionBuild: "enterprise",
    extensionChannel: "stable",
    providerCategory: "https://example.test/chat?token=raw-secret",
    featureArea: "../secret-plan",
    safeReasonCodes: ["policy_disabled", "https://example.test/?secret=1"],
    fileCount: -1,
    blockedCount: Number.POSITIVE_INFINITY,
    adapterName: "gemini?token=raw-secret",
    description: "User can type their own plain description."
  });
  const rendered = formatFeedbackReport(report);
  const serialized = JSON.stringify({ report, rendered });

  assert.strictEqual(report.leakGuardVersion, "unspecified");
  assert.strictEqual(report.providerCategory, "unspecified");
  assert.strictEqual(report.featureArea, "unspecified");
  assert.deepStrictEqual(report.safeReasonCodes, ["policy_disabled"]);
  assert.strictEqual(report.fileCount, 0);
  assert.strictEqual(report.blockedCount, 0);
  assert.strictEqual(report.adapterName, "unspecified");
  assert.strictEqual(serialized.includes("token=raw-secret"), false);
}

function testDescriptionWarningIsAlwaysPresent() {
  const report = buildFeedbackReport({
    description: "The manual report template was confusing."
  });
  const rendered = formatFeedbackReport(report);

  assert.strictEqual(report.warning, FEEDBACK_DESCRIPTION_WARNING);
  assert.ok(rendered.includes(FEEDBACK_DESCRIPTION_WARNING));
  assert.ok(rendered.includes("Do not paste secrets"));
}

function testGitHubIssueUrlUsesEncodedSafeReportTextOnly() {
  const url = buildGitHubFeedbackIssueUrl(forbiddenPayload, {
    repository: "safe-owner/safe-repo",
    title: "LeakGuard feedback: file handoff"
  });
  const parsed = new URL(url);
  const body = parsed.searchParams.get("body");

  assert.strictEqual(parsed.origin, "https://github.com");
  assert.strictEqual(parsed.pathname, "/safe-owner/safe-repo/issues/new");
  assert.strictEqual(parsed.searchParams.get("title"), "LeakGuard feedback: file handoff");
  assert.ok(parsed.search.includes("%23+LeakGuard+Feedback+Report"));
  assert.ok(body.includes("LeakGuard version: 2.2.0"));
  assert.ok(body.includes("Provider/site category: chat-ai"));
  assert.ok(body.includes(FEEDBACK_DESCRIPTION_WARNING));

  for (const forbidden of [
    "sk-live-should-not-appear",
    "API_KEY=raw-secret",
    "customer-secrets.env",
    "incident-token.txt",
    "OCR captured raw screen text",
    "https://example.test/chat?token=raw-secret",
    "token=raw-secret",
    "raw composer DOM text",
    "base64-image-data",
    "raw diagnostic log"
  ]) {
    assert.strictEqual(url.includes(forbidden), false, `URL must not include forbidden raw value: ${forbidden}`);
    assert.strictEqual(body.includes(forbidden), false, `body must not include forbidden raw value: ${forbidden}`);
  }
}

function testGitHubDiscussionUrlUsesExpectedRouteAndEncoding() {
  const url = buildGitHubFeedbackDiscussionUrl(
    {
      leakGuardVersion: "2.2.0",
      browserName: "Firefox",
      browserVersion: "127.0",
      extensionBuild: "enterprise",
      extensionChannel: "stable",
      providerCategory: "chat-ai",
      featureArea: "policy",
      safeReasonCodes: ["policy_disabled"],
      fileCount: 0,
      blockedCount: 1,
      adapterName: "none",
      description: "Managed policy hid feedback controls."
    },
    {
      repository: "safe-owner/safe-repo",
      category: "feedback",
      title: "LeakGuard feedback: managed policy"
    }
  );
  const parsed = new URL(url);

  assert.strictEqual(parsed.origin, "https://github.com");
  assert.strictEqual(parsed.pathname, "/safe-owner/safe-repo/discussions/new");
  assert.strictEqual(parsed.searchParams.get("category"), "feedback");
  assert.strictEqual(parsed.searchParams.get("title"), "LeakGuard feedback: managed policy");
  assert.ok(parsed.searchParams.get("body").includes("Managed policy hid feedback controls."));
}

function testGitHubFeedbackUrlRejectsUnsafeTargetsAndEmptyReports() {
  assert.strictEqual(DEFAULT_FEEDBACK_GITHUB_REPOSITORY, "petritbahtiri123/LeakGuard");
  assert.strictEqual(
    new URL(buildGitHubFeedbackIssueUrl({ description: "Safe user text." })).pathname,
    "/petritbahtiri123/LeakGuard/issues/new",
    "default feedback issue URL should target the approved LeakGuard repository"
  );
  assert.strictEqual(
    buildGitHubFeedbackIssueUrl({}, { repository: "safe-owner/safe-repo" }),
    null,
    "empty report input should not produce a URL"
  );
  assert.strictEqual(
    buildGitHubFeedbackIssueUrl({ description: "Safe user text." }, { enabled: false, repository: "safe-owner/safe-repo" }),
    null,
    "disabled URL generation should not produce a URL"
  );
  assert.strictEqual(
    buildGitHubFeedbackIssueUrl({ description: "Safe user text." }, { repository: "https://github.com/owner/repo" }),
    null,
    "unsafe repository target should not produce a URL"
  );
  assert.strictEqual(
    buildGitHubFeedbackDiscussionUrl({ description: "Safe user text." }, { repository: "../owner/repo" }),
    null,
    "path-like repository target should not produce a discussion URL"
  );
  const unsafeTitleUrl = buildGitHubFeedbackIssueUrl(
    { description: "Safe user text." },
    {
      repository: "safe-owner/safe-repo",
      title: "https://example.test/path?token=raw-secret"
    }
  );
  assert.strictEqual(new URL(unsafeTitleUrl).searchParams.get("title"), "LeakGuard feedback");
  assert.strictEqual(unsafeTitleUrl.includes("token=raw-secret"), false);
}

testAllowedFieldsAppearAndReportIsDeterministic();
testForbiddenAndUnknownFieldsDoNotSerialize();
testUnsafeLabelsAndCountsFailClosed();
testDescriptionWarningIsAlwaysPresent();
testGitHubIssueUrlUsesEncodedSafeReportTextOnly();
testGitHubDiscussionUrlUsesExpectedRouteAndEncoding();
testGitHubFeedbackUrlRejectsUnsafeTargetsAndEmptyReports();

console.log("PASS feedback report builder regressions");
