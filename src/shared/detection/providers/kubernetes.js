(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window; root.PWM = root.PWM || {};
  const { getContextWindow } = root.PWM.DetectionContext; const { enterpriseTokenScore, hasProviderContext, hasEnterpriseContext } = root.PWM.CloudScoring;
  function push(findings, detector, raw, start, end, placeholderType, score, methods) { if (!raw || detector.isAllowlisted(raw)) return; findings.push(detector.buildFinding({ category: "internal_metadata", placeholderType, raw, start, end, score, methods })); }
  function cloudScore(input, raw, start, end, base = 48) { let score = base + enterpriseTokenScore(raw); if (hasProviderContext(input, start, end)) score += 14; if (hasEnterpriseContext(input, start, end)) score += 8; return score; }
  function hasKubernetesResourceContext(input, start, end) { return hasProviderContext(input, start, end) || /\b(?:kubernetes|k8s|kubeconfig|namespace|context|cluster)\b/i.test(input.slice(Math.max(0, start - 180), Math.min(input.length, end + 80))); }
  function scan(text, detector) { const findings = []; const input = String(text || "");
    for (let match, re = /\b(?:pod|deployment|service|secret|configmap|ingress)\/[a-z0-9][a-z0-9.-]{1,62}\b/gi; (match = re.exec(input)) !== null;) {
      if (!hasKubernetesResourceContext(input, match.index, match.index + match[0].length)) continue;
      push(findings, detector, match[0], match.index, match.index + match[0].length, /^secret\//i.test(match[0]) ? "K8S_SECRET" : "K8S_RESOURCE", 84, ["cloud-provider", "kubernetes", "resource"]);
    }
    for (let match, re = /\b(namespace|context|cluster)\s*[:=]\s*["']?([a-z0-9][a-z0-9.-]{2,62})["']?/gi; (match = re.exec(input)) !== null;) { const raw = match[2]; const start = match.index + match[0].lastIndexOf(raw); const type = match[1].toLowerCase() === "namespace" ? "K8S_NAMESPACE" : "K8S_CLUSTER"; const score = cloudScore(input, raw, start, start + raw.length, 54); if (score >= 68) push(findings, detector, raw, start, start + raw.length, type, score, ["cloud-provider", "kubernetes", "context-key"]); }
    for (let match, re = /\b(certificate-authority-data|client-certificate-data|client-key-data|token)\s*:\s*([A-Za-z0-9+/._=-]{20,})/g; (match = re.exec(input)) !== null;) { const raw = match[2]; const start = match.index + match[0].lastIndexOf(raw); if (match[1] === "token" && !/^eyJ/.test(raw) && !/\b(?:kubeconfig|kubernetes|k8s)\b/i.test(getContextWindow(input, start, start + raw.length, 120))) continue; push(findings, detector, raw, start, start + raw.length, "KUBECONFIG_SECRET", 96, ["cloud-provider", "kubernetes", "kubeconfig-secret"]); }
    return findings; }
  root.PWM.CloudProviderDetectors = root.PWM.CloudProviderDetectors || {}; root.PWM.CloudProviderDetectors.kubernetes = { scan };
})();
