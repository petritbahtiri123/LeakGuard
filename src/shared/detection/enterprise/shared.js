(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window; root.PWM = root.PWM || {};
  const containsPlaceholder = (raw) => /\[(?:PWM|NET|PUB_HOST|[A-Z][A-Z0-9_]*)_\d+/.test(String(raw || ""));
  const isCleanPlaceholder = (raw) => /^\[(?:PWM_\d+|NET_\d+(?:_SUB_\d+)*(?:_(?:HOST_\d+|GW|VIP|DNS))?|PUB_HOST_\d+(?:_(?:GW|VIP|DNS))?|[A-Z][A-Z0-9_]*_\d+)\]$/.test(String(raw || ""));
  function push(findings, detector, raw, start, end, placeholderType, score, methods) {
    if (!raw || detector.isAllowlisted(raw) || isCleanPlaceholder(raw) || containsPlaceholder(raw)) return;
    findings.push(detector.buildFinding({ category: placeholderType === "USERNAME" || placeholderType === "EMAIL" ? "identity" : "internal_metadata", placeholderType, raw, start, end, score, methods }));
  }
  root.PWM.EnterpriseDetectors = root.PWM.EnterpriseDetectors || {};
  root.PWM.EnterpriseDetectors.shared = { push };
})();
