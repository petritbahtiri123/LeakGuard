(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};
  const constants = root.PWM.DetectionConstants || {};
  const regexes = root.PWM.DetectionContextRegexes || {};
  const { getContextWindow } = root.PWM.DetectionContext || {};
  function enterpriseTokens(raw) {
    return String(raw || "").toLowerCase().split(/[-_.]+/).filter(Boolean);
  }
  function enterpriseTokenScore(raw, { requirePrefix } = {}) {
    const tokens = enterpriseTokens(raw);
    if (!tokens.length) return 0;
    let score = 0;
    if (constants.ENTERPRISE_ENV_TOKENS?.has(tokens[0]) && requirePrefix) score -= 6;
    for (const token of tokens) {
      if (constants.ENTERPRISE_ENV_TOKENS?.has(token)) score += 14;
      if (constants.ENTERPRISE_LOCATION_TOKENS?.has(token)) score += 12;
      if (constants.ENTERPRISE_SERVICE_TOKENS?.has(token)) score += 10;
      if (/^\d{2,7}$/.test(token)) score += 4;
    }
    return score;
  }
  function hasEnterpriseContext(text, start, end) {
    return regexes.INFRA_CONTEXT_REGEX.test(getContextWindow(text, start, end, 96));
  }
  function hasProviderContext(text, start, end) {
    return regexes.PROVIDER_CONTEXT_REGEX.test(getContextWindow(text, start, end, 128));
  }
  function hasIdentityContext(text, start, end) {
    return regexes.IDENTITY_CONTEXT_REGEX.test(getContextWindow(text, start, end, 96));
  }
  root.PWM.CloudScoring = { enterpriseTokens, enterpriseTokenScore, hasEnterpriseContext, hasProviderContext, hasIdentityContext };
})();
