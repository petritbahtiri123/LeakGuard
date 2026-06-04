(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  const FALLBACK_PLACEHOLDER_TOKEN_REGEX = /\[(?:PWM|NET|PUB_HOST)_\d+(?:_SUB_\d+)*(?:_(?:HOST_\d+|GW|VIP|DNS))?\]/g;

  function getNormalizeVisiblePlaceholders(options = {}) {
    return options.normalizeVisiblePlaceholders || root.PWM?.normalizeVisiblePlaceholders || ((value) => String(value || ""));
  }

  function getPlaceholderTokenRegex(options = {}) {
    const regex = options.placeholderTokenRegex || root.PWM?.PLACEHOLDER_TOKEN_REGEX || FALLBACK_PLACEHOLDER_TOKEN_REGEX;
    return new RegExp(regex.source, "g");
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
      return null;
    }

    return Number(semanticMatch[1] || semanticMatch[2] || 0);
  }

  function isPlaceholderTrustedForSession(placeholder, placeholderCount) {
    const count = Number(placeholderCount || 0);
    const index = placeholderSessionIndex(placeholder);

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

      if (isPlaceholderTrustedForSession(placeholder, placeholderCount)) {
        segments.push({
          type: "secret",
          placeholder
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
