(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function scan(text, detector) {
    const findings = [];
    const input = String(text || "");
    const regex = /\b(tenantId|tenant_id|subscriptionId|subscription_id)\b\s*[:=]\s*["']?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})["']?/gi;
    let match;
    while ((match = regex.exec(input)) !== null) {
      const key = match[1].toLowerCase();
      const raw = match[2];
      if (detector.isAllowlisted(raw)) continue;
      const lineStart = input.lastIndexOf("\n", Math.max(0, match.index - 1)) + 1;
      const lineEndIndex = input.indexOf("\n", match.index);
      const line = input.slice(lineStart, lineEndIndex >= 0 ? lineEndIndex : input.length);
      if (!/(?:\bazure\b|tenantId|tenant_id|subscriptionId|subscription_id|\btenant\b|\bsubscription\b)/i.test(line)) continue;
      if (/\bopenstack\b/i.test(line) && /_id$/i.test(match[1])) continue;
      const start = match.index + match[0].lastIndexOf(raw);
      findings.push(detector.buildFinding({
        category: "internal_metadata",
        placeholderType: key.includes("tenant") ? "AZURE_TENANT_ID" : "AZURE_SUBSCRIPTION_ID",
        raw,
        start,
        end: start + raw.length,
        score: 90,
        methods: ["cloud-provider", "azure", "id", "context-key"]
      }));
    }
    return findings;
  }

  root.PWM.CloudProviderDetectors = root.PWM.CloudProviderDetectors || {};
  root.PWM.CloudProviderDetectors.azureIds = { scan };
})();
