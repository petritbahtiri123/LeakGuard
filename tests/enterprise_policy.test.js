const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const repoRoot = path.join(__dirname, "..");
const policyPath = path.join(repoRoot, "src/shared/policy.js");
const policyModule = require(policyPath);
const protectedSitesModule = require(path.join(repoRoot, "src/shared/protected_sites.js"));
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

function testOverrideDefaultsAndUiHooksExist() {
  assert.strictEqual(
    policyModule.DEFAULT_CONSUMER_POLICY.allowUserOverride,
    true,
    "consumer defaults should keep Allow once enabled"
  );
  assert.strictEqual(
    policyModule.DEFAULT_ENTERPRISE_POLICY.allowUserOverride,
    false,
    "enterprise defaults should disable Allow once"
  );
  assert.ok(
    contentSource.includes("allowUserOverride: policy.allowUserOverride"),
    "content modal flow should pass allowUserOverride into the decision UI"
  );
  assert.ok(
    contentSource.includes("resolveDecisionAction(decision.action, policy)"),
    "content flow should refuse stale allow-once decisions when policy disables overrides"
  );
  assert.ok(
    contentSource.includes("if (allowUserOverride) {") &&
      contentSource.includes("actions.appendChild(allowBtn);"),
    "Allow once button should only render when policy explicitly allows it"
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
  auditMode = "metadata-only"
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
      enterpriseMode: true
    }),
    evaluateDestinationPolicy: policyModule.evaluateDestinationPolicy,
    invalidatePolicyCache: () => {},
    ext,
    supportsDynamicContentScripts: true,
    supportsStorageSession: false,
    getSessionStorageArea: () => localStorageArea
  };

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

async function testManagedProtectedSitesRegisterWithoutUserSiteToggle() {
  const { sandbox } = createBackgroundSandbox({
    allowUserAddedSites: false,
    managedProtectedSites: ["https://web.whatsapp.com"]
  });

  const registrations = await sandbox.buildUserSiteRegistrations();

  assert.strictEqual(registrations.length, 1, "managed sites should still register content scripts");
  assert.strictEqual(registrations[0].matches.join(","), "https://web.whatsapp.com/*");
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
      assert.strictEqual(decision.blocked, true, "strict failure should block sensitive actions");
      assert.strictEqual(decision.reason, "policy_fail_closed");
    }
  );
}

function testPolicySchemaAndUiSurfaceNewFields() {
  assert.strictEqual(managedPolicySchema.properties.allowUserOverride.type, "boolean");
  assert.strictEqual(managedPolicySchema.properties.allowSiteRemoval.type, "boolean");
  assert.strictEqual(managedPolicySchema.properties.managedProtectedSites.type, "array");
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
  testOverrideDefaultsAndUiHooksExist();
  await testAllowSiteRemovalTrueAllowsDeletion();
  await testAllowSiteRemovalFalseBlocksDeletion();
  await testManagedProtectedSitesRegisterWithoutUserSiteToggle();
  await testManagedProtectedSitesCannotBeToggledOrDeleted();
  await testAuditEventsStayMetadataOnlyAndBounded();
  await testMalformedStrictEnterprisePolicyFailsClosed();
  testPolicySchemaAndUiSurfaceNewFields();
  console.log("PASS enterprise policy enforcement regressions");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
