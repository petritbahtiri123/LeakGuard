(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  const AUDIT_EVENTS_STORAGE_KEY = "pwm:auditEvents";
  const MAX_AUDIT_EVENTS = 250;
  const DEFAULT_AUDIT_RETENTION_DAYS = 30;
  const MIN_AUDIT_RETENTION_DAYS = 1;
  const MAX_AUDIT_RETENTION_DAYS = 365;

  function normalizeAuditFindingType(type) {
    const normalized = String(type || "secret")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    return normalized || "secret";
  }

  function summarizeAuditFindings(findings) {
    const normalizedFindings = Array.isArray(findings) ? findings : [];
    const findingTypes = [
      ...new Set(
        normalizedFindings.map((finding) =>
          normalizeAuditFindingType(finding?.type || finding?.placeholderType)
        )
      )
    ];

    return {
      findingCount: normalizedFindings.length,
      findingTypes
    };
  }

  function parseAuditUrl(url) {
    try {
      const parsed = new URL(url);
      return {
        urlOrigin: parsed.origin,
        siteHost: parsed.hostname
      };
    } catch {
      return {
        urlOrigin: "",
        siteHost: ""
      };
    }
  }

  function normalizeAuditRetentionDays(policySummary) {
    const rawDays = Number(policySummary?.auditRetentionDays || DEFAULT_AUDIT_RETENTION_DAYS);
    const finiteDays = Number.isFinite(rawDays) ? rawDays : DEFAULT_AUDIT_RETENTION_DAYS;
    return Math.max(MIN_AUDIT_RETENTION_DAYS, Math.min(MAX_AUDIT_RETENTION_DAYS, finiteDays));
  }

  function trimAuditEvents(events, policySummary) {
    const normalizedEvents = Array.isArray(events) ? events.filter(Boolean) : [];
    const retentionMs = normalizeAuditRetentionDays(policySummary) * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - retentionMs;
    return normalizedEvents
      .filter((event) => {
        const timestamp = Date.parse(event?.timestamp || "");
        return Number.isFinite(timestamp) && timestamp >= cutoff;
      })
      .slice(-MAX_AUDIT_EVENTS);
  }

  function buildAuditEventEntry({ action, reason, url, findings, policySummary }) {
    const { urlOrigin, siteHost } = parseAuditUrl(url);
    const findingSummary = summarizeAuditFindings(findings);

    return {
      timestamp: new Date().toISOString(),
      action,
      reason,
      urlOrigin,
      siteHost,
      findingCount: findingSummary.findingCount,
      findingTypes: findingSummary.findingTypes,
      policyMode: policySummary?.enterpriseMode ? "enterprise" : "consumer"
    };
  }

  root.PWM.BackgroundAuditLog = Object.freeze({
    AUDIT_EVENTS_STORAGE_KEY,
    MAX_AUDIT_EVENTS,
    DEFAULT_AUDIT_RETENTION_DAYS,
    MIN_AUDIT_RETENTION_DAYS,
    MAX_AUDIT_RETENTION_DAYS,
    normalizeAuditFindingType,
    summarizeAuditFindings,
    parseAuditUrl,
    normalizeAuditRetentionDays,
    trimAuditEvents,
    buildAuditEventEntry
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.BackgroundAuditLog;
  }
})();
