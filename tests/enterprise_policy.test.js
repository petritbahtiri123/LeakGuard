const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const repoRoot = path.join(__dirname, "..");
const policyPath = path.join(repoRoot, "src/shared/policy.js");
const policyModule = require(policyPath);
const protectedSitesModule = require(path.join(repoRoot, "src/shared/protected_sites.js"));
require(path.join(repoRoot, "src/shared/runtime_scripts.js"));
require(path.join(repoRoot, "src/background/auditLog.js"));
const protectedSiteRegistrySource = fs.readFileSync(
  path.join(repoRoot, "src/background/protectedSiteRegistry.js"),
  "utf8"
);
const coreSource = fs.readFileSync(path.join(repoRoot, "src/background/core.js"), "utf8");
const contentSource = fs.readFileSync(path.join(repoRoot, "src/content/content.js"), "utf8");
const popupSource = fs.readFileSync(path.join(repoRoot, "src/popup/popup.js"), "utf8");
const optionsSource = fs.readFileSync(path.join(repoRoot, "src/options/options.js"), "utf8");
const managedPolicySchema = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "config/managed_policy_schema.json"), "utf8")
);

function testBlockedDestinationsBlockSensitiveActions() {
  const decision = policyModule.evaluateDestinationPolicy(
    {
      ...policyModule.DEFAULT_ENTERPRISE_POLICY,
      blockedDestinations: ["https://blocked.example/*"],
      approvedDestinations: []
    },
    "https://blocked.example/chat"
  );

  assert.strictEqual(decision.blocked, true, "expected blocked destinations to fail closed");
  assert.strictEqual(decision.reason, "destination_blocked");
}

function testApprovedDestinationsAllowApprovedHosts() {
  const decision = policyModule.evaluateDestinationPolicy(
    {
      ...policyModule.DEFAULT_ENTERPRISE_POLICY,
      approvedDestinations: ["https://allowed.example/*"],
      blockedDestinations: []
    },
    "https://allowed.example/chat"
  );

  assert.strictEqual(decision.blocked, false, "expected approved destinations to remain usable");
  assert.strictEqual(decision.destinationApproved, true);
}

function testApprovedDestinationsBlockUnapprovedHostsInEnterpriseMode() {
  const decision = policyModule.evaluateDestinationPolicy(
    {
      ...policyModule.DEFAULT_ENTERPRISE_POLICY,
      approvedDestinations: ["https://allowed.example/*"],
      blockedDestinations: []
    },
    "https://not-allowed.example/chat"
  );

  assert.strictEqual(decision.blocked, true, "expected enterprise default deny to block unapproved hosts");
  assert.strictEqual(decision.reason, "destination_not_approved");
}

function testDestinationPoliciesSupportAllowRedactAndBlock() {
  const basePolicy = {
    ...policyModule.DEFAULT_ENTERPRISE_POLICY,
    destinationPolicies: [
      { match: "https://allowed.example/*", action: "allow" },
      { match: "https://redact.example/*", action: "redact" },
      { match: "https://blocked.example/*", action: "block" }
    ],
    defaultDestinationAction: "block",
    approvedDestinations: [],
    blockedDestinations: []
  };

  const allowDecision = policyModule.evaluateDestinationPolicy(
    basePolicy,
    "https://allowed.example/chat"
  );
  const redactDecision = policyModule.evaluateDestinationPolicy(
    basePolicy,
    "https://redact.example/chat"
  );
  const blockDecision = policyModule.evaluateDestinationPolicy(
    basePolicy,
    "https://blocked.example/chat"
  );
  const unmatchedDecision = policyModule.evaluateDestinationPolicy(
    basePolicy,
    "https://other.example/chat"
  );

  assert.strictEqual(allowDecision.blocked, false);
  assert.strictEqual(allowDecision.destinationAction, "allow");
  assert.strictEqual(redactDecision.blocked, false);
  assert.strictEqual(redactDecision.requiresRedaction, true);
  assert.strictEqual(redactDecision.reason, "destination_requires_redaction");
  assert.strictEqual(blockDecision.blocked, true);
  assert.strictEqual(blockDecision.reason, "destination_blocked");
  assert.strictEqual(unmatchedDecision.blocked, true);
  assert.strictEqual(unmatchedDecision.reason, "destination_not_approved");
}

function testProtectionPauseDefaultsAndUiHooksExist() {
  assert.strictEqual(
    policyModule.DEFAULT_CONSUMER_POLICY.allowProtectionPause,
    true,
    "consumer defaults should allow temporary protection pause"
  );
  assert.strictEqual(
    policyModule.DEFAULT_ENTERPRISE_POLICY.allowProtectionPause,
    false,
    "enterprise defaults should disable protection pause"
  );
  assert.strictEqual(policyModule.DEFAULT_CONSUMER_POLICY.protectionPauseMaxMinutes, 15);
  assert.strictEqual(policyModule.DEFAULT_ENTERPRISE_POLICY.protectionPauseMaxMinutes, 0);
  assert.ok(!contentSource.includes("Allow once"), "content UI should not render Allow once");
  assert.ok(!contentSource.includes("allowedOnceFingerprint"), "content state should not keep allow-once fingerprints");
  assert.ok(
    contentSource.includes("isProtectionPauseActiveAfterPolicy(policy, destinationPolicy)"),
    "content flow should check pause only after policy decisions"
  );
  assert.ok(
    contentSource.includes("resolveDecisionAction(decision.action, policy)"),
    "content modal decisions should still be normalized centrally"
  );
}

function testAuditPolicyIsMetadataOnlyAndRetentionBounded() {
  const normalized = policyModule.normalizePolicyInput(
    {
      auditMode: "full",
      auditRetentionDays: 14
    },
    {
      buildInfo: {
        browser: "chrome",
        mode: "enterprise",
        enterprise: true
      },
      basePolicy: policyModule.DEFAULT_ENTERPRISE_POLICY
    }
  );
  const invalidRetention = policyModule.normalizePolicyInput(
    {
      auditRetentionDays: 366
    },
    {
      buildInfo: {
        browser: "chrome",
        mode: "enterprise",
        enterprise: true
      },
      basePolicy: policyModule.DEFAULT_ENTERPRISE_POLICY
    }
  );

  assert.strictEqual(normalized.ok, true);
  assert.strictEqual(normalized.value.auditMode, "metadata-only");
  assert.strictEqual(normalized.value.auditRetentionDays, 14);
  assert.strictEqual(invalidRetention.ok, false, "audit retention should stay bounded");
}

function testFeedbackPolicyGateDefaultsAndNormalization() {
  assert.strictEqual(
    policyModule.DEFAULT_CONSUMER_POLICY.allowFeedback,
    false,
    "consumer feedback gate should default hidden until explicitly enabled"
  );
  assert.strictEqual(
    policyModule.DEFAULT_ENTERPRISE_POLICY.allowFeedback,
    false,
    "enterprise feedback gate should default hidden until explicitly enabled"
  );

  const enabled = policyModule.normalizePolicyInput(
    {
      allowFeedback: true
    },
    {
      buildInfo: {
        browser: "chrome",
        mode: "consumer",
        enterprise: false
      },
      basePolicy: policyModule.DEFAULT_CONSUMER_POLICY
    }
  );
  const disabled = policyModule.normalizePolicyInput(
    {
      allowFeedback: false
    },
    {
      buildInfo: {
        browser: "chrome",
        mode: "enterprise",
        enterprise: true
      },
      basePolicy: policyModule.DEFAULT_ENTERPRISE_POLICY
    }
  );
  const malformed = policyModule.normalizePolicyInput(
    {
      allowFeedback: "true"
    },
    {
      buildInfo: {
        browser: "chrome",
        mode: "consumer",
        enterprise: false
      },
      basePolicy: policyModule.DEFAULT_CONSUMER_POLICY
    }
  );

  assert.strictEqual(enabled.ok, true);
  assert.strictEqual(enabled.value.allowFeedback, true);
  assert.strictEqual(disabled.ok, true);
  assert.strictEqual(disabled.value.allowFeedback, false);
  assert.strictEqual(malformed.ok, false, "malformed feedback policy should be rejected");
  assert.strictEqual(
    malformed.value.allowFeedback,
    false,
    "malformed feedback policy should not accidentally enable feedback"
  );
}

function testFeedbackAvailabilityHelperFailsClosed() {
  const enabledSummary = policyModule.summarizePolicy(
    {
      ...policyModule.DEFAULT_CONSUMER_POLICY,
      allowFeedback: true
    },
    "https://chatgpt.com/"
  );
  const disabledSummary = policyModule.summarizePolicy(
    {
      ...policyModule.DEFAULT_CONSUMER_POLICY,
      allowFeedback: false
    },
    "https://chatgpt.com/"
  );
  const strictFailureSummary = {
    ...enabledSummary,
    strictFailure: true
  };

  assert.strictEqual(enabledSummary.allowFeedback, true, "policy summaries should expose feedback gate state");
  assert.strictEqual(
    policyModule.isFeedbackAvailable(enabledSummary),
    true,
    "explicitly enabled feedback policy should make future feedback UI available"
  );
  assert.strictEqual(
    policyModule.isFeedbackAvailable(disabledSummary),
    false,
    "disabled feedback policy should hide and block future feedback UI"
  );
  assert.strictEqual(
    policyModule.isFeedbackAvailable(strictFailureSummary),
    false,
    "strict policy failures should fail closed for feedback availability"
  );
  assert.strictEqual(
    policyModule.isFeedbackAvailable(null),
    false,
    "missing policy should fail closed for feedback availability"
  );
}

function createStorageArea(store) {
  return {
    async get(key) {
      if (key === null || key === undefined) {
        return { ...store };
      }

      if (Array.isArray(key)) {
        return Object.fromEntries(key.map((entry) => [entry, store[entry]]));
      }

      if (typeof key === "string") {
        return {
          [key]: store[key]
        };
      }

      if (typeof key === "object") {
        const response = {};
        Object.entries(key).forEach(([entryKey, fallback]) => {
          response[entryKey] = entryKey in store ? store[entryKey] : fallback;
        });
        return response;
      }

      return { ...store };
    },
    async set(value) {
      Object.entries(value || {}).forEach(([key, entry]) => {
        store[key] = JSON.parse(JSON.stringify(entry));
      });
    },
    async remove(keys) {
      const values = Array.isArray(keys) ? keys : [keys];
      values.forEach((key) => {
        delete store[key];
      });
    }
  };
}

function createBackgroundSandbox({
  allowSiteRemoval = true,
  allowUserAddedSites = true,
  managedProtectedSites = [],
  auditMode = "metadata-only",
  auditRetentionDays = 30
} = {}) {
  const storageState = {};
  const localStorageArea = createStorageArea(storageState);
  const noopEvent = {
    addListener() {}
  };
  const ext = {
    action: {},
    permissions: {
      contains: async () => true,
      remove: async () => true,
      onAdded: noopEvent,
      onRemoved: noopEvent
    },
    runtime: {
      id: "test-extension",
      getURL: (relativePath = "") => `chrome-extension://test/${relativePath}`,
      onInstalled: noopEvent,
      onMessage: noopEvent,
      onStartup: noopEvent,
      openOptionsPage: async () => {}
    },
    storage: {
      local: localStorageArea,
      onChanged: noopEvent
    },
    scripting: {
      getRegisteredContentScripts: async () => [],
      unregisterContentScripts: async () => {},
      registerContentScripts: async () => {}
    },
    tabs: {
      onRemoved: noopEvent
    }
  };
  const sandbox = {
    URL,
    console,
    Promise,
    setTimeout,
    clearTimeout,
    queueMicrotask,
    crypto: {
      randomUUID: () => "test-uuid"
    }
  };
  sandbox.globalThis = sandbox;
  sandbox.PWM = {
    PlaceholderManager: class PlaceholderManager {},
    canonicalizePlaceholderToken: (value) => value,
    createSessionState: (urlKey) => ({ urlKey }),
    migrateSessionState: (state) => state || {},
    normalizeTransformMode: (value) => value || "hide_public",
    DEFAULT_TRANSFORM_MODE: "hide_public",
    transformOutboundPrompt: () => ({
      redactedText: "",
      replacements: []
    }),
    BUILTIN_PROTECTED_SITES: protectedSitesModule.BUILTIN_PROTECTED_SITES,
    USER_PROTECTED_SITES_STORAGE_KEY: protectedSitesModule.USER_PROTECTED_SITES_STORAGE_KEY,
    normalizeProtectedSiteInput: protectedSitesModule.normalizeProtectedSiteInput,
    normalizeProtectedSiteList: protectedSitesModule.normalizeProtectedSiteList,
    isBuiltinProtectedSiteRule: protectedSitesModule.isBuiltinProtectedSiteRule,
    loadPolicy: async () => ({
      policy: {
        allowSiteRemoval,
        allowUserAddedSites,
        managedProtectedSites
      }
    }),
    getPolicySummary: async () => ({
      auditMode,
      auditRetentionDays,
      enterpriseMode: true
    }),
    evaluateDestinationPolicy: policyModule.evaluateDestinationPolicy,
    invalidatePolicyCache: () => {},
    RuntimeScripts: globalThis.PWM.RuntimeScripts,
    BackgroundAuditLog: globalThis.PWM.BackgroundAuditLog,
    ext,
    supportsDynamicContentScripts: true,
    supportsStorageSession: false,
    getSessionStorageArea: () => localStorageArea
  };

  vm.runInNewContext(protectedSiteRegistrySource, sandbox, {
    filename: "protectedSiteRegistry.js"
  });
  vm.runInNewContext(coreSource, sandbox, {
    filename: "core.js"
  });

  return {
    sandbox,
    storageState
  };
}

async function testAllowSiteRemovalTrueAllowsDeletion() {
  const { sandbox, storageState } = createBackgroundSandbox({
    allowSiteRemoval: true
  });
  const rule = protectedSitesModule.normalizeProtectedSiteInput("https://allowed.example").rule;
  storageState[protectedSitesModule.USER_PROTECTED_SITES_STORAGE_KEY] = [rule];

  const deletedRule = await sandbox.deleteProtectedSite(rule.id);

  assert.strictEqual(deletedRule.id, rule.id, "expected deletion to return the deleted rule");
  assert.deepStrictEqual(
    storageState[protectedSitesModule.USER_PROTECTED_SITES_STORAGE_KEY],
    [],
    "expected the stored site list to be updated after deletion"
  );
}

async function testAllowSiteRemovalFalseBlocksDeletion() {
  const { sandbox, storageState } = createBackgroundSandbox({
    allowSiteRemoval: false
  });
  const rule = protectedSitesModule.normalizeProtectedSiteInput("https://blocked.example").rule;
  storageState[protectedSitesModule.USER_PROTECTED_SITES_STORAGE_KEY] = [rule];

  await assert.rejects(
    () => sandbox.deleteProtectedSite(rule.id),
    /Managed policy blocks removing protected sites\./
  );
}

async function testProtectedSiteRegistryKeepsStableDynamicScriptIds() {
  const { sandbox } = createBackgroundSandbox();
  const rule = protectedSitesModule.normalizeProtectedSiteInput("https://web.whatsapp.com").rule;

  assert.strictEqual(sandbox.stableRuleHash(rule.id), "4cb45733");
  assert.strictEqual(sandbox.userSiteScriptId(rule), "pwm_user_site_4cb45733");
}

async function testManagedProtectedSitesRegisterWithoutUserSiteToggle() {
  const { sandbox } = createBackgroundSandbox({
    allowUserAddedSites: false,
    managedProtectedSites: ["https://web.whatsapp.com"]
  });

  const registrations = await sandbox.buildUserSiteRegistrations();

  assert.strictEqual(registrations.length, 1, "managed sites should still register content scripts");
  assert.strictEqual(registrations[0].matches.join(","), "https://web.whatsapp.com/*");
  assert.strictEqual(
    registrations[0].matchOriginAsFallback,
    true,
    "dynamic site registration should cover about:, data:, and blob: child frames"
  );
  assert.ok(
    !Object.hasOwn(registrations[0], "matchAboutBlank"),
    "dynamic site registration should not use unsupported matchAboutBlank"
  );
}

async function testUserProtectedSitesRegisterOnlyWithPermission() {
  const grantedOrigins = new Set(["https://allowed.example/*"]);
  const { sandbox, storageState } = createBackgroundSandbox();
  sandbox.PWM.ext.permissions.contains = async ({ origins }) => origins.every((origin) => grantedOrigins.has(origin));
  storageState[protectedSitesModule.USER_PROTECTED_SITES_STORAGE_KEY] = [
    {
      ...protectedSitesModule.normalizeProtectedSiteInput("https://allowed.example").rule,
      enabled: true
    },
    {
      ...protectedSitesModule.normalizeProtectedSiteInput("https://missing.example").rule,
      enabled: true
    }
  ];

  const registrations = await sandbox.buildUserSiteRegistrations();

  assert.strictEqual(
    registrations.map((registration) => registration.matches[0]).join(","),
    "https://allowed.example/*"
  );
  await assert.rejects(
    () => sandbox.ensureProtectedSitePermission(
      protectedSitesModule.normalizeProtectedSiteInput("https://missing.example").rule
    ),
    /LeakGuard needs site access before it can protect this site\./
  );
}

async function testManagedProtectedSitesCannotBeToggledOrDeleted() {
  const { sandbox } = createBackgroundSandbox({
    allowSiteRemoval: true,
    allowUserAddedSites: true,
    managedProtectedSites: ["https://web.whatsapp.com"]
  });
  const siteId = "https://web.whatsapp.com";

  await assert.rejects(
    () => sandbox.setProtectedSiteEnabled(siteId, false),
    /Managed policy controls this protected site\./
  );
  await assert.rejects(
    () => sandbox.deleteProtectedSite(siteId),
    /Managed policy controls this protected site\./
  );
}

async function testAuditEventsStayMetadataOnlyAndBounded() {
  const { sandbox, storageState } = createBackgroundSandbox({
    allowSiteRemoval: true,
    auditMode: "metadata-only"
  });

  for (let index = 0; index < 260; index += 1) {
    await sandbox.recordAuditEvent({
      action: "blocked",
      reason: "destination_not_approved",
      url: "https://example.com/path?q=secret123",
      findings: [
        {
          type: "PASSWORD",
          raw: `secret123-${index}`
        },
        {
          type: "API_KEY",
          raw: `api-key-${index}`
        }
      ],
      policySummary: {
        auditMode: "metadata-only",
        auditRetentionDays: 30,
        enterpriseMode: true
      }
    });
  }

  const events = storageState["pwm:auditEvents"];
  const serialized = JSON.stringify(events);

  assert.strictEqual(events.length, 250, "audit storage should remain bounded");
  assert.strictEqual(
    serialized.includes("secret123"),
    false,
    "audit log must not persist raw secret text"
  );
  assert.strictEqual(
    serialized.includes("/path?q=secret123"),
    false,
    "audit log must not persist full URLs"
  );
  assert.strictEqual(events[0].urlOrigin, "https://example.com");
  assert.strictEqual(events[0].siteHost, "example.com");
}

async function testAuditRetentionPurgesOldMetadata() {
  const { sandbox, storageState } = createBackgroundSandbox({
    allowSiteRemoval: true,
    auditMode: "metadata-only",
    auditRetentionDays: 7
  });
  const oldTimestamp = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const recentTimestamp = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  storageState["pwm:auditEvents"] = [
    {
      timestamp: oldTimestamp,
      action: "blocked",
      reason: "destination_not_approved",
      urlOrigin: "https://old.example",
      siteHost: "old.example",
      findingCount: 1,
      findingTypes: ["password"],
      policyMode: "enterprise"
    },
    {
      timestamp: recentTimestamp,
      action: "redacted",
      reason: "redacted",
      urlOrigin: "https://recent.example",
      siteHost: "recent.example",
      findingCount: 1,
      findingTypes: ["api_key"],
      policyMode: "enterprise"
    }
  ];

  await sandbox.recordAuditEvent({
    action: "blocked",
    reason: "destination_not_approved",
    url: "https://current.example/path?token=RawSecretShouldNotPersist123",
    findings: [{ type: "PASSWORD", raw: "RawSecretShouldNotPersist123" }],
    policySummary: {
      auditMode: "metadata-only",
      auditRetentionDays: 7,
      enterpriseMode: true
    }
  });

  const events = storageState["pwm:auditEvents"];
  const serialized = JSON.stringify(events);
  assert.deepStrictEqual(
    events.map((event) => event.siteHost),
    ["recent.example", "current.example"],
    "audit retention should purge metadata older than the configured window"
  );
  assert.strictEqual(serialized.includes("RawSecretShouldNotPersist123"), false);
  assert.strictEqual(serialized.includes("/path?token="), false);
}

async function withFreshPolicyModule(chromeStub, callback) {
  const previousChrome = global.chrome;
  const previousBrowser = global.browser;
  const previousPWM = global.PWM;

  delete require.cache[require.resolve(policyPath)];
  if (chromeStub === undefined) {
    delete global.chrome;
  } else {
    global.chrome = chromeStub;
  }
  delete global.browser;
  delete global.PWM;

  try {
    const freshPolicyModule = require(policyPath);
    return await callback(freshPolicyModule);
  } finally {
    delete require.cache[require.resolve(policyPath)];

    if (previousChrome === undefined) {
      delete global.chrome;
    } else {
      global.chrome = previousChrome;
    }

    if (previousBrowser === undefined) {
      delete global.browser;
    } else {
      global.browser = previousBrowser;
    }

    if (previousPWM === undefined) {
      delete global.PWM;
    } else {
      global.PWM = previousPWM;
    }
  }
}

async function testMalformedStrictEnterprisePolicyFailsClosed() {
  await withFreshPolicyModule(
    {
      storage: {
        managed: {
          get: async () => ({
            strictPolicyLoad: true,
            approvedDestinations: [42]
          })
        }
      }
    },
    async (freshPolicyModule) => {
      const buildInfo = {
        browser: "chrome",
        mode: "enterprise",
        enterprise: true
      };
      const loaded = await freshPolicyModule.loadPolicy({
        forceReload: true,
        buildInfo
      });
      const summary = freshPolicyModule.summarizePolicy(
        loaded.policy,
        "https://example.com/chat",
        loaded.meta
      );
      const decision = freshPolicyModule.evaluateDestinationPolicy(
        summary,
        "https://example.com/chat"
      );

      assert.strictEqual(loaded.meta.strictFailure, true, "strict policy load should fail closed");
      assert.strictEqual(loaded.policy.allowProtectionPause, false, "fail-closed policy should disable pause");
      assert.strictEqual(loaded.policy.protectionPauseMaxMinutes, 0, "fail-closed policy should clear pause duration");
      assert.strictEqual(decision.blocked, true, "strict failure should block sensitive actions");
      assert.strictEqual(decision.reason, "policy_fail_closed");
    }
  );
}

function testPolicySchemaAndUiSurfaceNewFields() {
  assert.strictEqual(managedPolicySchema.properties.allowUserOverride.type, "boolean");
  assert.strictEqual(managedPolicySchema.properties.allowProtectionPause.type, "boolean");
  assert.strictEqual(managedPolicySchema.properties.protectionPauseMaxMinutes.type, "number");
  assert.strictEqual(managedPolicySchema.properties.protectionPauseRequiresUserAction.type, "boolean");
  assert.strictEqual(managedPolicySchema.properties.allowFeedback.type, "boolean");
  assert.strictEqual(managedPolicySchema.properties.allowSiteRemoval.type, "boolean");
  assert.strictEqual(managedPolicySchema.properties.managedProtectedSites.type, "array");
  assert.strictEqual(managedPolicySchema.properties.auditRetentionDays.type, "number");
  assert.deepStrictEqual(managedPolicySchema.properties.auditMode.enum, ["off", "metadata-only"]);
  assert.deepStrictEqual(
    managedPolicySchema.properties.defaultDestinationAction.enum,
    ["allow", "redact", "block"]
  );
  assert.deepStrictEqual(
    managedPolicySchema.properties.destinationPolicies.items.properties.action.enum,
    ["allow", "redact", "block"]
  );
  assert.ok(
    contentSource.includes("handleDestinationPolicy(relevantFindings, policy)") &&
      contentSource.includes("handleDestinationPolicy(analysis.findings, policy)"),
    "content enforcement should run in the typed, paste, and submit decision paths"
  );
  assert.ok(
    contentSource.includes("shouldForceDestinationRedaction") &&
      contentSource.includes("Destination policy required redaction"),
    "content flow should support destination-scoped forced redaction"
  );
  assert.ok(
    popupSource.includes("removeButton.disabled = !currentPolicy.allowSiteRemoval;"),
    "popup UI should disable site removal when policy blocks it"
  );
  assert.ok(
    popupSource.includes("PWM_SET_PROTECTION_PAUSED") &&
      popupSource.includes("Protection is enforced by policy"),
    "popup UI should expose pause controls and enforced-policy messaging"
  );
  assert.ok(
    popupSource.includes("renderManagedSites(response.managedSites || []);") &&
      optionsSource.includes("renderManagedSites(response.managedSites || []);"),
    "popup and options should render managed protected sites"
  );
  assert.ok(
    optionsSource.includes("removeButton.disabled = !currentPolicy.allowSiteRemoval;"),
    "options UI should disable site removal when policy blocks it"
  );
}

async function run() {
  testBlockedDestinationsBlockSensitiveActions();
  testApprovedDestinationsAllowApprovedHosts();
  testApprovedDestinationsBlockUnapprovedHostsInEnterpriseMode();
  testDestinationPoliciesSupportAllowRedactAndBlock();
  testProtectionPauseDefaultsAndUiHooksExist();
  testAuditPolicyIsMetadataOnlyAndRetentionBounded();
  testFeedbackPolicyGateDefaultsAndNormalization();
  testFeedbackAvailabilityHelperFailsClosed();
  await testAllowSiteRemovalTrueAllowsDeletion();
  await testAllowSiteRemovalFalseBlocksDeletion();
  await testProtectedSiteRegistryKeepsStableDynamicScriptIds();
  await testManagedProtectedSitesRegisterWithoutUserSiteToggle();
  await testUserProtectedSitesRegisterOnlyWithPermission();
  await testManagedProtectedSitesCannotBeToggledOrDeleted();
  await testAuditEventsStayMetadataOnlyAndBounded();
  await testAuditRetentionPurgesOldMetadata();
  await testMalformedStrictEnterprisePolicyFailsClosed();
  testPolicySchemaAndUiSurfaceNewFields();
  console.log("PASS enterprise policy enforcement regressions");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
