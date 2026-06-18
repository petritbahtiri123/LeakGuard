(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window; root.PWM = root.PWM || {};
  const { hasProviderContext } = root.PWM.CloudScoring;
  function push(findings, detector, raw, start, end, placeholderType, score, methods) { if (!raw || detector.isAllowlisted(raw)) return; findings.push(detector.buildFinding({ category: "internal_metadata", placeholderType, raw, start, end, score, methods })); }
  function scan(text, detector) { const findings = []; const input = String(text || "");
    for (let match, re = /\b[a-z0-9][a-z0-9.-]{1,100}\.(?:privatelink\.[a-z0-9.-]+|private\.[a-z0-9.-]+|internal|corp|local|lan|cloudapp\.azure\.com|file\.core\.windows\.net|blob\.core\.windows\.net|database\.windows\.net|vault\.azure\.net|openstack\.[a-z0-9.-]+)\b/gi; (match = re.exec(input)) !== null;) { const raw = match[0]; const before = input.slice(Math.max(0, match.index - 4), match.index); if (/(?:@|:\/\/)$/.test(before)) continue; if (!hasProviderContext(input, match.index, match.index + raw.length) && !/\.(?:internal|corp|local|lan)$/.test(raw)) continue; push(findings, detector, raw, match.index, match.index + raw.length, /\.(?:internal|corp|local|lan)$/i.test(raw) ? "INTERNAL_ENDPOINT" : "CLOUD_ENDPOINT", 84, ["cloud-provider", "endpoint"]); }
    return findings; }
  root.PWM.CloudProviderDetectors = root.PWM.CloudProviderDetectors || {}; root.PWM.CloudProviderDetectors.genericEndpoints = { scan };
})();
