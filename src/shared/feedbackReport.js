(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  const FEEDBACK_DESCRIPTION_WARNING =
    "Do not paste secrets, prompts, messages, file contents, filenames, OCR text, raw URLs, screenshots, logs, or other sensitive content.";
  const DEFAULT_FEEDBACK_GITHUB_REPOSITORY = "TODO-OWNER/TODO-REPO";
  const UNSPECIFIED = "unspecified";
  const SAFE_LABEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 _.-]{0,79}$/;
  const SAFE_REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
  const URL_OR_PATH_PATTERN = /(?:https?:\/\/|\?|=|[\\/]|\.{2})/i;
  const SECRET_TEXT_PATTERN =
    /(?:bearer\s+[a-z0-9._~+/=-]+|api[_-]?key|authorization|cookie|password|secret|token|sk-[a-z0-9_-]{12,}|AKIA[0-9A-Z]{16})/i;
  const SAFE_TITLE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 _.:()-]{0,119}$/;
  const MAX_REASON_CODES = 20;
  const MAX_DESCRIPTION_LENGTH = 2000;

  function toText(value) {
    return typeof value === "string" ? value : "";
  }

  function sanitizeLabel(value) {
    const text = toText(value).trim();
    if (
      !text ||
      !SAFE_LABEL_PATTERN.test(text) ||
      URL_OR_PATH_PATTERN.test(text) ||
      SECRET_TEXT_PATTERN.test(text)
    ) {
      return UNSPECIFIED;
    }
    return text;
  }

  function sanitizeReasonCodes(value) {
    if (!Array.isArray(value)) return [];

    return value
      .map((entry) => sanitizeLabel(entry))
      .filter((entry) => entry !== UNSPECIFIED)
      .slice(0, MAX_REASON_CODES);
  }

  function sanitizeCount(value) {
    if (!Number.isFinite(value) || value < 0) return 0;
    return Math.floor(value);
  }

  function sanitizeDescription(value) {
    return toText(value)
      .replace(/\u0000/g, "")
      .replace(/\r\n|\r/g, "\n")
      .trim()
      .slice(0, MAX_DESCRIPTION_LENGTH);
  }

  function sanitizeTitle(value) {
    const text = toText(value).trim();
    if (!text || !SAFE_TITLE_PATTERN.test(text) || URL_OR_PATH_PATTERN.test(text) || SECRET_TEXT_PATTERN.test(text)) {
      return "LeakGuard feedback";
    }
    return text;
  }

  function buildFeedbackReport(input = {}) {
    const source = input && typeof input === "object" ? input : {};

    return {
      warning: FEEDBACK_DESCRIPTION_WARNING,
      leakGuardVersion: sanitizeLabel(source.leakGuardVersion),
      browser: {
        name: sanitizeLabel(source.browserName),
        version: sanitizeLabel(source.browserVersion)
      },
      extension: {
        build: sanitizeLabel(source.extensionBuild),
        channel: sanitizeLabel(source.extensionChannel)
      },
      providerCategory: sanitizeLabel(source.providerCategory),
      featureArea: sanitizeLabel(source.featureArea),
      safeReasonCodes: sanitizeReasonCodes(source.safeReasonCodes),
      fileCount: sanitizeCount(source.fileCount),
      blockedCount: sanitizeCount(source.blockedCount),
      adapterName: sanitizeLabel(source.adapterName),
      description: sanitizeDescription(source.description)
    };
  }

  function formatFeedbackReport(input = {}) {
    const report =
      input && input.warning === FEEDBACK_DESCRIPTION_WARNING
        ? input
        : buildFeedbackReport(input);

    return [
      "# LeakGuard Feedback Report",
      "",
      `Warning: ${FEEDBACK_DESCRIPTION_WARNING}`,
      "",
      `LeakGuard version: ${report.leakGuardVersion}`,
      `Browser: ${report.browser.name} ${report.browser.version}`.trim(),
      `Extension build: ${report.extension.build}`,
      `Extension channel: ${report.extension.channel}`,
      `Provider/site category: ${report.providerCategory}`,
      `Feature area: ${report.featureArea}`,
      `Safe reason codes: ${report.safeReasonCodes.join(", ") || "none"}`,
      `File count: ${report.fileCount}`,
      `Blocked count: ${report.blockedCount}`,
      `Adapter name: ${report.adapterName}`,
      "",
      `User description: ${report.description || ""}`
    ].join("\n");
  }

  function hasReportContent(report) {
    return Boolean(
      report.description ||
        report.safeReasonCodes.length > 0 ||
        report.fileCount > 0 ||
        report.blockedCount > 0 ||
        report.leakGuardVersion !== UNSPECIFIED ||
        report.browser.name !== UNSPECIFIED ||
        report.browser.version !== UNSPECIFIED ||
        report.extension.build !== UNSPECIFIED ||
        report.extension.channel !== UNSPECIFIED ||
        report.providerCategory !== UNSPECIFIED ||
        report.featureArea !== UNSPECIFIED ||
        report.adapterName !== UNSPECIFIED
    );
  }

  function normalizeRepository(value) {
    const repository = toText(value || DEFAULT_FEEDBACK_GITHUB_REPOSITORY).trim();
    if (!SAFE_REPOSITORY_PATTERN.test(repository) || URL_OR_PATH_PATTERN.test(repository.replace("/", ""))) {
      return null;
    }
    return repository;
  }

  function buildGitHubFeedbackUrl(reportInput, options = {}) {
    if (options.enabled === false) return null;

    const repository = normalizeRepository(options.repository);
    if (!repository) return null;

    const report = buildFeedbackReport(reportInput);
    if (!hasReportContent(report)) return null;

    const route = options.route === "discussion" ? "discussions/new" : "issues/new";
    const url = new URL(`https://github.com/${repository}/${route}`);
    const params = new URLSearchParams();
    params.set("title", sanitizeTitle(options.title));
    params.set("body", formatFeedbackReport(report));

    if (route === "discussions/new") {
      const category = sanitizeLabel(options.category);
      if (category !== UNSPECIFIED) {
        params.set("category", category);
      }
    }

    url.search = params.toString();
    return url.toString();
  }

  function buildGitHubFeedbackIssueUrl(reportInput, options = {}) {
    return buildGitHubFeedbackUrl(reportInput, {
      ...options,
      route: "issue"
    });
  }

  function buildGitHubFeedbackDiscussionUrl(reportInput, options = {}) {
    return buildGitHubFeedbackUrl(reportInput, {
      ...options,
      route: "discussion"
    });
  }

  root.PWM.FeedbackReport = {
    DEFAULT_FEEDBACK_GITHUB_REPOSITORY,
    FEEDBACK_DESCRIPTION_WARNING,
    buildFeedbackReport,
    buildGitHubFeedbackDiscussionUrl,
    buildGitHubFeedbackIssueUrl,
    buildGitHubFeedbackUrl,
    formatFeedbackReport
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.FeedbackReport;
  }
})();
