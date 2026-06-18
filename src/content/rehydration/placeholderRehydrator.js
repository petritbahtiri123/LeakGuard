(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  const FALLBACK_PLACEHOLDER_TOKEN_REGEX =
    /\[(?:PWM_\d+|NET_\d+(?:_SUB_\d+)*(?:_(?:HOST_\d+|GW|VIP|DNS))?|PUB_HOST_\d+(?:_(?:GW|VIP|DNS))?|[A-Z][A-Z0-9_]*_\d+)\]/g;
  const COUNT_TRUSTED_PLACEHOLDER_REGEX =
    /^\[(?:PWM_\d+|NET_\d+(?:_SUB_\d+)*(?:_(?:HOST_\d+|GW|VIP|DNS))?|PUB_HOST_\d+(?:_(?:GW|VIP|DNS))?)\]$/;

  function getNormalizeVisiblePlaceholders(options = {}) {
    return options.normalizeVisiblePlaceholders || root.PWM?.normalizeVisiblePlaceholders || ((value) => String(value || ""));
  }

  function getPlaceholderTokenRegex(options = {}) {
    const regex = options.placeholderTokenRegex || root.PWM?.PLACEHOLDER_TOKEN_REGEX || FALLBACK_PLACEHOLDER_TOKEN_REGEX;
    return new RegExp(regex.source, "g");
  }

  function getCanonicalizePlaceholderToken(options = {}) {
    return options.canonicalizePlaceholderToken || root.PWM?.canonicalizePlaceholderToken || ((value) => String(value || ""));
  }

  function getExplicitTrustedPlaceholders(options = {}) {
    const canonicalizePlaceholderToken = getCanonicalizePlaceholderToken(options);
    const source = Array.isArray(options.trustedPlaceholders)
      ? options.trustedPlaceholders
      : Array.isArray(options.knownPlaceholders)
        ? options.knownPlaceholders
        : [];

    return new Set(source.filter(Boolean).map((placeholder) => canonicalizePlaceholderToken(placeholder)));
  }

  function isExplicitlyTrustedPlaceholder(placeholder, options = {}) {
    const canonicalizePlaceholderToken = getCanonicalizePlaceholderToken(options);
    const canonical = canonicalizePlaceholderToken(placeholder);
    const trustedPlaceholders = getExplicitTrustedPlaceholders(options);
    const manager = options.manager || null;

    return (
      trustedPlaceholders.has(canonical) ||
      (manager && typeof manager.knowsPlaceholder === "function" && manager.knowsPlaceholder(canonical))
    );
  }

  function placeholderSessionIndex(placeholder) {
    const pwmMatch = /^\[PWM_(\d+)\]$/.exec(String(placeholder || ""));
    if (pwmMatch) {
      return Number(pwmMatch[1]);
    }

    const semanticMatch = /^\[(?:NET_(\d+)|PUB_HOST_(\d+))(?:_SUB_\d+)*(?:_(?:HOST_\d+|GW|VIP|DNS))?\]$/.exec(
      String(placeholder || "")
    );

    if (!semanticMatch) {
      const typedMatch = /^\[[A-Z][A-Z0-9_]*_(\d+)\]$/.exec(String(placeholder || ""));
      return typedMatch ? Number(typedMatch[1]) : null;
    }

    return Number(semanticMatch[1] || semanticMatch[2] || 0);
  }

  function isPlaceholderTrustedForSession(placeholder, placeholderCount, options = {}) {
    const canonicalizePlaceholderToken = getCanonicalizePlaceholderToken(options);
    const canonical = canonicalizePlaceholderToken(placeholder);

    if (isExplicitlyTrustedPlaceholder(canonical, options)) {
      return true;
    }

    if (!COUNT_TRUSTED_PLACEHOLDER_REGEX.test(canonical)) {
      return false;
    }

    const count = Number(placeholderCount || 0);
    const index = placeholderSessionIndex(canonical);

    if (!count || !Number.isFinite(index)) {
      return false;
    }

    return index >= 1 && index <= count;
  }

  function tokenizePlaceholderText(text, options = {}) {
    const normalizeVisiblePlaceholders = getNormalizeVisiblePlaceholders(options);
    const placeholderTokenRegex = getPlaceholderTokenRegex(options);
    const input = normalizeVisiblePlaceholders(text);
    const placeholderCount = Number(options.placeholderCount || 0);
    const segments = [];
    let lastIndex = 0;
    let match;

    while ((match = placeholderTokenRegex.exec(input)) !== null) {
      const placeholder = match[0];

      if (match.index > lastIndex) {
        segments.push({
          type: "text",
          value: input.slice(lastIndex, match.index)
        });
      }

      const canonicalPlaceholder = getCanonicalizePlaceholderToken(options)(placeholder);

      if (isPlaceholderTrustedForSession(canonicalPlaceholder, placeholderCount, options)) {
        segments.push({
          type: "secret",
          placeholder: canonicalPlaceholder
        });
      } else {
        segments.push({
          type: "text",
          value: placeholder
        });
      }

      lastIndex = match.index + placeholder.length;
    }

    if (lastIndex < input.length) {
      segments.push({
        type: "text",
        value: input.slice(lastIndex)
      });
    }

    return segments.length ? segments : [{ type: "text", value: input }];
  }

  root.PWM.PlaceholderRehydrator = {
    placeholderSessionIndex,
    isPlaceholderTrustedForSession,
    tokenizePlaceholderText
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.PlaceholderRehydrator;
  }
})();
