const assert = require("assert");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/background/auditLog.js"));

const { BackgroundAuditLog } = globalThis.PWM;

assert.strictEqual(BackgroundAuditLog.normalizeAuditFindingType(" API Key / Token "), "api_key_token");
assert.deepStrictEqual(
  BackgroundAuditLog.summarizeAuditFindings([
    { type: "PASSWORD" },
    { placeholderType: "API_KEY" },
    { type: "password" },
    {}
  ]),
  {
    findingCount: 4,
    findingTypes: ["password", "api_key", "secret"]
  }
);
assert.deepStrictEqual(BackgroundAuditLog.parseAuditUrl("https://chatgpt.com/c/123?q=x"), {
  urlOrigin: "https://chatgpt.com",
  siteHost: "chatgpt.com"
});
assert.deepStrictEqual(BackgroundAuditLog.parseAuditUrl("not a url"), {
  urlOrigin: "",
  siteHost: ""
});
assert.strictEqual(BackgroundAuditLog.normalizeAuditRetentionDays({ auditRetentionDays: 0 }), 30);
assert.strictEqual(BackgroundAuditLog.normalizeAuditRetentionDays({ auditRetentionDays: -1 }), 1);
assert.strictEqual(BackgroundAuditLog.normalizeAuditRetentionDays({ auditRetentionDays: 9999 }), 365);

const now = Date.now();
const retained = BackgroundAuditLog.trimAuditEvents(
  [
    null,
    { timestamp: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(), id: "old" },
    { timestamp: new Date(now - 60 * 1000).toISOString(), id: "recent" }
  ],
  { auditRetentionDays: 1 }
);
assert.deepStrictEqual(retained.map((entry) => entry.id), ["recent"]);

const manyEvents = Array.from({ length: 260 }, (_, index) => ({
  timestamp: new Date(now - index).toISOString(),
  id: index
})).reverse();
assert.strictEqual(BackgroundAuditLog.trimAuditEvents(manyEvents, { auditRetentionDays: 1 }).length, 250);

const entry = BackgroundAuditLog.buildAuditEventEntry({
  action: "redact",
  reason: "policy",
  url: "https://gemini.google.com/app",
  findings: [{ placeholderType: "PASSWORD" }],
  policySummary: { enterpriseMode: true }
});
assert.strictEqual(entry.action, "redact");
assert.strictEqual(entry.reason, "policy");
assert.strictEqual(entry.urlOrigin, "https://gemini.google.com");
assert.strictEqual(entry.siteHost, "gemini.google.com");
assert.strictEqual(entry.findingCount, 1);
assert.deepStrictEqual(entry.findingTypes, ["password"]);
assert.strictEqual(entry.policyMode, "enterprise");
assert.ok(Number.isFinite(Date.parse(entry.timestamp)), "entry timestamp should be ISO-like");

console.log("PASS background audit log");
