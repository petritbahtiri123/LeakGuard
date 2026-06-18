(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  const SENSITIVE_HTTP_HEADERS = new Set([
    "authorization",
    "x-api-key",
    "api-key",
    "x-auth-token",
    "x-access-token",
    "x-session-token",
    "ocp-apim-subscription-key",
    "cookie",
    "set-cookie"
  ]);

  function stripWrappingQuotes(value) {
    if (!value || value.length < 2) return value;

    const first = value[0];
    const last = value[value.length - 1];

    if (
      (first === '"' && last === '"') ||
      (first === "'" && last === "'") ||
      (first === "`" && last === "`")
    ) {
      return value.slice(1, -1);
    }

    return value;
  }

  function fallbackNormalizeCandidate(value) {
    return stripWrappingQuotes(String(value || "")).trim();
  }

  function getDependencies() {
    return root.PWM.DetectionHttpHeadersDependencies || {};
  }

  function normalizeHttpHeaderName(name) {
    return String(name || "").trim().toLowerCase();
  }

  function isSensitiveHttpHeaderName(name) {
    return SENSITIVE_HTTP_HEADERS.has(normalizeHttpHeaderName(name));
  }

  function hasSensitiveHttpHeaderShape(text) {
    const input = String(text || "");
    if (!input.includes(":")) return false;

    const regex = /(?:^|\n)\s*([A-Za-z][A-Za-z0-9-]{0,80})\s*:/g;
    let match;
    while ((match = regex.exec(input)) !== null) {
      if (isSensitiveHttpHeaderName(match[1])) return true;
    }

    return false;
  }

  function inferHttpHeaderPlaceholderType(name) {
    const normalized = normalizeHttpHeaderName(name);
    if (normalized === "authorization" || normalized.endsWith("-token") || normalized.includes("auth")) {
      return "TOKEN";
    }
    if (normalized === "cookie" || normalized === "set-cookie") {
      return "TOKEN";
    }
    return "API_KEY";
  }

  function isSensitiveCookieName(name) {
    const compact = String(name || "").toLowerCase().replace(/[._-]+/g, "");
    return (
      compact === "sid" ||
      compact.includes("session") ||
      compact.includes("auth") ||
      compact.includes("token") ||
      compact.includes("jwt")
    );
  }

  function isRedactableHttpHeaderValue(value) {
    const deps = getDependencies();
    const normalizeCandidate = deps.normalizeCandidate || fallbackNormalizeCandidate;
    const raw = normalizeCandidate(value);
    if (!raw || raw.length < 8) return false;
    if (typeof deps.isCleanPlaceholder === "function" && deps.isCleanPlaceholder(raw)) return false;
    if (typeof deps.likelyTemplateValue === "function" && deps.likelyTemplateValue(raw)) return false;
    if (
      typeof deps.containsPlaceholder === "function" &&
      typeof deps.isBenignPlaceholderComposite === "function" &&
      deps.containsPlaceholder(raw) &&
      deps.isBenignPlaceholderComposite(raw)
    ) {
      return false;
    }

    return (
      (typeof deps.looksCredentialLikeAssignmentValue === "function" && deps.looksCredentialLikeAssignmentValue(raw)) ||
      (typeof deps.looksStructuredLikeSecret === "function" && deps.looksStructuredLikeSecret(raw)) ||
      (/[A-Za-z]/.test(raw) &&
        /\d/.test(raw) &&
        typeof deps.calculateEntropy === "function" &&
        deps.calculateEntropy(raw) >= 2.6)
    );
  }

  function isRedactableCookieValue(value) {
    const deps = getDependencies();
    const normalizeCandidate = deps.normalizeCandidate || fallbackNormalizeCandidate;
    const raw = normalizeCandidate(value);
    if (!raw || raw.length < 8) return false;
    if (typeof deps.isCleanPlaceholder === "function" && deps.isCleanPlaceholder(raw)) return false;
    if (typeof deps.likelyTemplateValue === "function" && deps.likelyTemplateValue(raw)) return false;
    if (
      typeof deps.containsPlaceholder === "function" &&
      typeof deps.isBenignPlaceholderComposite === "function" &&
      deps.containsPlaceholder(raw) &&
      deps.isBenignPlaceholderComposite(raw)
    ) {
      return false;
    }

    return (
      (typeof deps.looksCredentialLikeAssignmentValue === "function" && deps.looksCredentialLikeAssignmentValue(raw)) ||
      (typeof deps.looksStructuredLikeSecret === "function" && deps.looksStructuredLikeSecret(raw)) ||
      /^[A-Za-z0-9%._~-]{16,}$/.test(raw)
    );
  }

  const api = Object.freeze({
    SENSITIVE_HTTP_HEADERS,
    normalizeHttpHeaderName,
    isSensitiveHttpHeaderName,
    hasSensitiveHttpHeaderShape,
    inferHttpHeaderPlaceholderType,
    isSensitiveCookieName,
    isRedactableHttpHeaderValue,
    isRedactableCookieValue
  });

  root.PWM.DetectionHttpHeaders = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
