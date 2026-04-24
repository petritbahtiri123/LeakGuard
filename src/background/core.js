const {
  PlaceholderManager,
  canonicalizePlaceholderToken,
  createSessionState,
  migrateSessionState,
  normalizeTransformMode,
  DEFAULT_TRANSFORM_MODE,
  transformOutboundPrompt,
  BUILTIN_PROTECTED_SITES,
  USER_PROTECTED_SITES_STORAGE_KEY,
  normalizeProtectedSiteInput,
  normalizeProtectedSiteList,
  isBuiltinProtectedSiteRule,
  loadPolicy,
  getPolicySummary,
  evaluateDestinationPolicy,
  invalidatePolicyCache,
  ext,
  supportsDynamicContentScripts,
  supportsStorageSession,
  getSessionStorageArea
} = globalThis.PWM;

const STORAGE_PREFIX = "pwm:tab:";
const REVEAL_PREFIX = "pwm:reveal:";
const POPUP_STATE_KEY = "pwm:popupState";
const USER_SITE_SCRIPT_ID_PREFIX = "pwm_user_site_";
const SESSION_STORAGE_AREA = getSessionStorageArea();
let syncDynamicContentScriptsPromise = Promise.resolve();
const CONTENT_SCRIPT_FILES = [
  "compat/browser_api.js",
  "compat/platform.js",
  "shared/entropy.js",
  "shared/patterns.js",
  "shared/detector.js",
  "shared/placeholders.js",
  "shared/ipClassification.js",
  "shared/ipDetection.js",
  "shared/networkHierarchy.js",
  "shared/placeholderAllocator.js",
  "shared/sessionMapStore.js",
  "shared/transformOutboundPrompt.js",
  "shared/redactor.js",
  "shared/protected_sites.js",
  "shared/policy.js",
  "content/composer_helpers.js",
  "content/content.js"
];
const CONTENT_STYLE_FILES = ["content/overlay.css"];
const AUDIT_EVENTS_STORAGE_KEY = "pwm:auditEvents";
const MAX_AUDIT_EVENTS = 250;
const DESTINATION_POLICY_BLOCK_MESSAGE =
  "LeakGuard blocked this action because this destination is not approved by enterprise policy.";
const PROTECTED_SITE_REMOVAL_BLOCK_MESSAGE =
  "Managed policy blocks removing protected sites.";

function createPolicyDecisionError(decision) {
  const error = new Error(decision?.message || DESTINATION_POLICY_BLOCK_MESSAGE);
  error.reason = decision?.reason || "destination_blocked";
  return error;
}

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
  const findingTypes = [...new Set(
    normalizedFindings.map((finding) => normalizeAuditFindingType(finding?.type || finding?.placeholderType))
  )];

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

function trimAuditEvents(events) {
  const normalizedEvents = Array.isArray(events) ? events.filter(Boolean) : [];
  return normalizedEvents.slice(-MAX_AUDIT_EVENTS);
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

async function recordAuditEvent({ action, reason, url, findings, policySummary }) {
  if (!ext?.storage?.local?.get || !ext?.storage?.local?.set) {
    return null;
  }

  const summary = policySummary || (url ? await getPolicySummary(url) : null);
  if (!summary || summary.auditMode === "off") {
    return null;
  }

  const entry = buildAuditEventEntry({
    action,
    reason,
    url,
    findings,
    policySummary: summary
  });
  const stored = await ext.storage.local.get(AUDIT_EVENTS_STORAGE_KEY);
  const existingEvents = Array.isArray(stored[AUDIT_EVENTS_STORAGE_KEY])
    ? stored[AUDIT_EVENTS_STORAGE_KEY]
    : [];
  const events = trimAuditEvents([...existingEvents, entry]);

  await ext.storage.local.set({
    [AUDIT_EVENTS_STORAGE_KEY]: events
  });

  return entry;
}

function storageKey(tabId) {
  return `${STORAGE_PREFIX}${tabId}`;
}

function revealKey(requestId) {
  return `${REVEAL_PREFIX}${requestId}`;
}

function urlKeyFrom(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return String(url || "");
  }
}

function newState(urlKey) {
  return createSessionState(urlKey);
}

function isLegacyState(state) {
  return Boolean(state?.rawToPlaceholder || state?.placeholderToRaw);
}

function migratePrivateState(state) {
  const manager = new PlaceholderManager();
  manager.setPrivateState(migrateSessionState(state || {}));
  return {
    ...migrateSessionState(state || {}),
    ...manager.exportPrivateState()
  };
}

function needsPlaceholderMigration(state) {
  if (!state) return false;

  const fingerprintValues = Object.values(state.fingerprintToPlaceholder || {});
  const placeholderKeys = Object.keys(state.placeholderToFingerprint || {});
  const knownLegacy =
    fingerprintValues.some((placeholder) => canonicalizePlaceholderToken(placeholder) !== placeholder) ||
    placeholderKeys.some((placeholder) => canonicalizePlaceholderToken(placeholder) !== placeholder);

  if (knownLegacy) return true;

  const manager = new PlaceholderManager();
  manager.setPrivateState(state);
  const migrated = manager.exportPrivateState();

  return JSON.stringify(migrated) !== JSON.stringify({
    sessionId: state.sessionId || null,
    counters: state.counters || {},
    fingerprintToPlaceholder: state.fingerprintToPlaceholder || {},
    placeholderToFingerprint: state.placeholderToFingerprint || {},
    secretByFingerprint: state.secretByFingerprint || {},
    objects: Array.isArray(state.objects) ? state.objects : []
  });
}

function isRuntimeUiSender(sender) {
  const senderUrl = String(sender?.url || sender?.documentUrl || "");
  return sender?.id === ext.runtime.id && senderUrl.startsWith(ext.runtime.getURL(""));
}

function requestMatchesState(request, state) {
  return Boolean(request?.sessionId && state?.sessionId && request.sessionId === state.sessionId);
}

function stableRuleHash(value) {
  const input = String(value || "");
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }

  return hash.toString(16);
}

function userSiteScriptId(rule) {
  return `${USER_SITE_SCRIPT_ID_PREFIX}${stableRuleHash(rule?.id)}`;
}

async function getManagedProtectedSites(policy = null) {
  const loadedPolicy = policy || (await loadPolicy());
  const managedInputs = Array.isArray(loadedPolicy?.policy?.managedProtectedSites)
    ? loadedPolicy.policy.managedProtectedSites
    : [];

  return normalizeProtectedSiteList(
    managedInputs
      .map((input) => normalizeProtectedSiteInput(input))
      .filter((normalized) => normalized.ok)
      .map((normalized) => ({
        ...normalized.rule,
        enabled: true,
        managed: true
      }))
  );
}

function siteRuleMatchesUrl(rule, url) {
  const normalized = normalizeProtectedSiteInput(url);
  return Boolean(normalized.ok && rule?.id && normalized.rule.id === rule.id);
}

async function getStoredProtectedSites() {
  const result = await ext.storage.local.get(USER_PROTECTED_SITES_STORAGE_KEY);
  return normalizeProtectedSiteList(result[USER_PROTECTED_SITES_STORAGE_KEY]);
}

async function setStoredProtectedSites(rules) {
  const normalizedRules = normalizeProtectedSiteList(rules);

  await ext.storage.local.set({
    [USER_PROTECTED_SITES_STORAGE_KEY]: normalizedRules
  });

  return normalizedRules;
}

async function enrichProtectedSites(rules, policySummary) {
  return Promise.all(
    (rules || []).map(async (rule) => {
      const hasPermission = await ext.permissions.contains({
        origins: [rule.matchPattern]
      });
      const managed = Boolean(rule.managed);
      const activeByPolicy = managed ? true : Boolean(policySummary?.allowUserAddedSites);

      return {
        ...rule,
        hasPermission,
        active: Boolean(activeByPolicy && rule.enabled && hasPermission),
        policyLocked: managed ? true : !policySummary?.allowUserAddedSites,
        removalLocked: managed ? true : !policySummary?.allowSiteRemoval
      };
    })
  );
}

async function getProtectedSiteOverview(url) {
  const loadedPolicy = await loadPolicy();
  const policy = await getPolicySummary(url);
  const managedSites = await enrichProtectedSites(await getManagedProtectedSites(loadedPolicy), policy);
  const userSites = await enrichProtectedSites(await getStoredProtectedSites(), policy);
  const normalized = normalizeProtectedSiteInput(url);

  if (!normalized.ok) {
    return {
      policy,
      builtInSites: BUILTIN_PROTECTED_SITES,
      managedSites,
      userSites,
      currentSite: {
        eligible: false,
        protected: false,
        source: null,
        canProtect: false,
        rule: null,
        message: normalized.error
      }
    };
  }

  const targetRule = normalized.rule;
  const builtInRule = BUILTIN_PROTECTED_SITES.find((rule) => rule.id === targetRule.id);
  const managedRule = managedSites.find((rule) => rule.id === targetRule.id) || null;
  const storedRule = userSites.find((rule) => rule.id === targetRule.id) || null;

  if (builtInRule) {
    return {
      policy,
      builtInSites: BUILTIN_PROTECTED_SITES,
      managedSites,
      userSites,
      currentSite: {
        eligible: true,
        protected: true,
        source: "builtin",
        canProtect: false,
        rule: builtInRule,
        message: "Built-in LeakGuard protection is active on this site."
      }
    };
  }

  if (managedRule?.active) {
    return {
      policy,
      builtInSites: BUILTIN_PROTECTED_SITES,
      managedSites,
      userSites,
      currentSite: {
        eligible: true,
        protected: true,
        source: "managed",
        canProtect: false,
        rule: managedRule,
        message: "Managed LeakGuard protection is active on this site."
      }
    };
  }

  if (managedRule && !managedRule.hasPermission) {
    return {
      policy,
      builtInSites: BUILTIN_PROTECTED_SITES,
      managedSites,
      userSites,
      currentSite: {
        eligible: true,
        protected: false,
        source: "managed",
        canProtect: false,
        rule: managedRule,
        message: "Managed policy includes this site, but browser site access is missing."
      }
    };
  }

  if (storedRule?.active) {
    return {
      policy,
      builtInSites: BUILTIN_PROTECTED_SITES,
      managedSites,
      userSites,
      currentSite: {
        eligible: true,
        protected: true,
        source: "user",
        canProtect: false,
        rule: storedRule,
        message: "LeakGuard protection is active on this site."
      }
    };
  }

  if (storedRule && !storedRule.hasPermission) {
    return {
      policy,
      builtInSites: BUILTIN_PROTECTED_SITES,
      managedSites,
      userSites,
      currentSite: {
        eligible: true,
        protected: false,
        source: null,
        canProtect: Boolean(policy.allowUserAddedSites),
        rule: storedRule,
        message: policy.allowUserAddedSites
          ? "Site access is missing. Grant access again to re-enable protection."
          : "Managed policy disables user-added site protection."
      }
    };
  }

  if (storedRule && !policy.allowUserAddedSites) {
    return {
      policy,
      builtInSites: BUILTIN_PROTECTED_SITES,
      managedSites,
      userSites,
      currentSite: {
        eligible: true,
        protected: false,
        source: null,
        canProtect: false,
        rule: storedRule,
        message: "Managed policy disables user-added site protection."
      }
    };
  }

  if (storedRule && !storedRule.enabled) {
    return {
      policy,
      builtInSites: BUILTIN_PROTECTED_SITES,
      managedSites,
      userSites,
      currentSite: {
        eligible: true,
        protected: false,
        source: null,
        canProtect: Boolean(policy.allowUserAddedSites),
        rule: storedRule,
        message: policy.allowUserAddedSites
          ? "Protection is saved for this site but currently disabled."
          : "Managed policy disables user-added site protection."
      }
    };
  }

  return {
    policy,
    builtInSites: BUILTIN_PROTECTED_SITES,
    managedSites,
    userSites,
    currentSite: {
      eligible: true,
      protected: false,
      source: null,
      canProtect: Boolean(policy.allowUserAddedSites),
      rule: targetRule,
      message: policy.allowUserAddedSites
        ? "LeakGuard is not protecting this site yet."
        : "Managed policy disables user-added site protection."
    }
  };
}

async function buildUserSiteRegistrations() {
  const loadedPolicy = await loadPolicy();
  const managedSites = await getManagedProtectedSites(loadedPolicy);
  const userSites = loadedPolicy.policy.allowUserAddedSites ? await getStoredProtectedSites() : [];
  const siteRules = normalizeProtectedSiteList([...managedSites, ...userSites]);
  const registrations = [];

  for (const rule of siteRules) {
    if (!rule.enabled) continue;

    const hasPermission = await ext.permissions.contains({
      origins: [rule.matchPattern]
    });
    if (!hasPermission) continue;

    registrations.push({
      id: userSiteScriptId(rule),
      matches: [rule.matchPattern],
      js: CONTENT_SCRIPT_FILES,
      css: CONTENT_STYLE_FILES,
      runAt: "document_idle",
      persistAcrossSessions: true
    });
  }

  return registrations;
}

async function performDynamicContentScriptSync() {
  if (!supportsDynamicContentScripts) {
    throw new Error("LeakGuard requires dynamic MV3 content script support on this browser.");
  }

  const existing = await ext.scripting.getRegisteredContentScripts();
  const managedIds = existing
    .filter((script) => script.id.startsWith(USER_SITE_SCRIPT_ID_PREFIX))
    .map((script) => script.id);

  if (managedIds.length) {
    await ext.scripting.unregisterContentScripts({ ids: managedIds });
  }

  const registrations = await buildUserSiteRegistrations();
  if (!registrations.length) return;

  await ext.scripting.registerContentScripts(registrations);
}

function syncDynamicContentScripts() {
  syncDynamicContentScriptsPromise = syncDynamicContentScriptsPromise
    .catch(() => {})
    .then(() => performDynamicContentScriptSync());

  return syncDynamicContentScriptsPromise;
}

async function ensureProtectedSitePermission(rule) {
  if (isBuiltinProtectedSiteRule(rule)) {
    return true;
  }

  const hasPermission = await ext.permissions.contains({
    origins: [rule.matchPattern]
  });
  if (!hasPermission) {
    throw new Error("LeakGuard needs site access before it can protect this site.");
  }

  return true;
}

async function upsertProtectedSite(input) {
  const loadedPolicy = await loadPolicy();
  if (!loadedPolicy.policy.allowUserAddedSites) {
    throw new Error("Managed policy disables user-added sites.");
  }

  const normalized = normalizeProtectedSiteInput(input);
  if (!normalized.ok) {
    throw new Error(normalized.error);
  }

  if (isBuiltinProtectedSiteRule(normalized.rule)) {
    return {
      created: false,
      updated: false,
      rule: normalized.rule
    };
  }

  await ensureProtectedSitePermission(normalized.rule);

  const currentRules = await getStoredProtectedSites();
  const existingRule = currentRules.find((rule) => rule.id === normalized.rule.id);
  const createdAt = existingRule?.createdAt || Date.now();
  const nextRule = {
    ...normalized.rule,
    createdAt,
    enabled: true
  };
  const nextRules = existingRule
    ? currentRules.map((rule) => (rule.id === nextRule.id ? nextRule : rule))
    : [...currentRules, nextRule];

  await setStoredProtectedSites(nextRules);
  await syncDynamicContentScripts();

  return {
    created: !existingRule,
    updated: Boolean(existingRule),
    rule: nextRule
  };
}

async function setProtectedSiteEnabled(siteId, enabled) {
  const loadedPolicy = await loadPolicy();
  if (!loadedPolicy.policy.allowUserAddedSites) {
    throw new Error("Managed policy disables user-added sites.");
  }

  const managedRule = (await getManagedProtectedSites(loadedPolicy)).find((rule) => rule.id === siteId);
  if (managedRule) {
    throw new Error("Managed policy controls this protected site.");
  }

  const currentRules = await getStoredProtectedSites();
  const existingRule = currentRules.find((rule) => rule.id === siteId);

  if (!existingRule) {
    throw new Error("Protected site rule not found.");
  }

  if (enabled) {
    await ensureProtectedSitePermission(existingRule);
  }

  const nextRule = {
    ...existingRule,
    enabled: Boolean(enabled)
  };
  const nextRules = currentRules.map((rule) => (rule.id === siteId ? nextRule : rule));

  await setStoredProtectedSites(nextRules);
  await syncDynamicContentScripts();

  return nextRule;
}

async function deleteProtectedSite(siteId) {
  const loadedPolicy = await loadPolicy();
  const managedRule = (await getManagedProtectedSites(loadedPolicy)).find((rule) => rule.id === siteId);
  if (managedRule) {
    throw new Error("Managed policy controls this protected site.");
  }

  const currentRules = await getStoredProtectedSites();
  const existingRule = currentRules.find((rule) => rule.id === siteId);

  if (!existingRule) {
    throw new Error("Protected site rule not found.");
  }

  if (!loadedPolicy.policy.allowSiteRemoval) {
    throw new Error(PROTECTED_SITE_REMOVAL_BLOCK_MESSAGE);
  }

  const nextRules = currentRules.filter((rule) => rule.id !== siteId);
  await setStoredProtectedSites(nextRules);

  await ext.permissions.remove({
    origins: [existingRule.matchPattern]
  }).catch(() => {});

  await syncDynamicContentScripts();
  return existingRule;
}

async function ensureProtectionInjected(tabId) {
  if (typeof tabId !== "number") return;

  try {
    const response = await ext.tabs.sendMessage(tabId, {
      type: "PWM_CONTENT_PING"
    });

    if (response?.ok) {
      return;
    }
  } catch {
    // The content stack is not active in this tab yet.
  }

  await ext.scripting.insertCSS({
    target: { tabId },
    files: CONTENT_STYLE_FILES
  });

  await ext.scripting.executeScript({
    target: { tabId },
    files: CONTENT_SCRIPT_FILES
  });
}

async function reloadTabForRuleChange(tabId, url, rule) {
  if (typeof tabId !== "number" || !siteRuleMatchesUrl(rule, url)) {
    return false;
  }

  await ext.tabs.reload(tabId);
  return true;
}

function toPublicState(state, policySummary = null) {
  const manager = new PlaceholderManager();
  manager.setPrivateState(state || {});
  const publicState = manager.exportPublicState();

  return {
    transformMode: normalizeTransformMode(state?.transformMode || DEFAULT_TRANSFORM_MODE),
    placeholderCount: publicState.knownPlaceholders.length,
    policy: policySummary || null
  };
}

async function getState(tabId) {
  if (typeof tabId !== "number") return null;
  const key = storageKey(tabId);
  const result = await SESSION_STORAGE_AREA.get(key);
  return result[key] || null;
}

async function getPopupState() {
  const result = await SESSION_STORAGE_AREA.get(POPUP_STATE_KEY);
  return result[POPUP_STATE_KEY] || null;
}

async function setPopupState(state) {
  const nextState = {
    view: state?.view || "home",
    requestId: state?.requestId || null,
    updatedAt: Date.now()
  };

  await SESSION_STORAGE_AREA.set({
    [POPUP_STATE_KEY]: nextState
  });

  return nextState;
}

async function clearPopupState(requestId) {
  const current = await getPopupState();
  if (!current) return;

  if (requestId && current.requestId && current.requestId !== requestId) {
    return;
  }

  await SESSION_STORAGE_AREA.remove(POPUP_STATE_KEY);
}

async function setState(tabId, state) {
  if (typeof tabId !== "number") return null;

  const next = {
    ...state,
    updatedAt: Date.now()
  };

  await SESSION_STORAGE_AREA.set({
    [storageKey(tabId)]: next
  });

  return next;
}

async function removeState(tabId) {
  if (typeof tabId !== "number") return;
  await SESSION_STORAGE_AREA.remove(storageKey(tabId));
}

async function removeRevealRequestsForTab(tabId) {
  const all = await SESSION_STORAGE_AREA.get(null);
  const requestsToRemove = Object.entries(all).filter(
    ([key, value]) => key.startsWith(REVEAL_PREFIX) && Number(value?.tabId) === Number(tabId)
  );
  const keysToRemove = requestsToRemove.map(([key]) => key);
  const requestIds = requestsToRemove
    .map(([, value]) => value?.requestId)
    .filter((requestId) => typeof requestId === "string" && requestId);

  if (keysToRemove.length) {
    await SESSION_STORAGE_AREA.remove(keysToRemove);
  }

  if (requestIds.length) {
    const popupState = await getPopupState();
    if (popupState?.requestId && requestIds.includes(popupState.requestId)) {
      await clearPopupState(popupState.requestId);
    }
  }
}

async function initState(tabId, url) {
  if (typeof tabId !== "number") return null;

  const nextUrlKey = urlKeyFrom(url);
  let state = await getState(tabId);

  if (!state || isLegacyState(state)) {
    state = newState(nextUrlKey);
    await setState(tabId, state);
    await removeRevealRequestsForTab(tabId);
    return state;
  }

  if (needsPlaceholderMigration(state)) {
    state = await setState(tabId, migratePrivateState(state));
  }

  state = migrateSessionState(state, nextUrlKey);

  if (state.urlKey !== nextUrlKey) {
    state = newState(nextUrlKey);
    await setState(tabId, state);
    await removeRevealRequestsForTab(tabId);
    return state;
  }

  await setState(tabId, state);
  return state;
}

function serializeRedactionResult(result) {
  return {
    redactedText: result?.redactedText || "",
    replacements: (result?.replacements || []).map((replacement) => ({
      id: replacement.id,
      start: replacement.start,
      end: replacement.end,
      placeholder: replacement.placeholder
    }))
  };
}

function normalizeFinding(finding) {
  return {
    id: finding?.id || crypto.randomUUID(),
    type: finding?.type || finding?.placeholderType || "SECRET",
    placeholderType: finding?.placeholderType || finding?.type || "SECRET",
    category: finding?.category || "credential",
    raw: String(finding?.raw || ""),
    start: Number(finding?.start || 0),
    end: Number(finding?.end || 0),
    score: Number.isFinite(finding?.score) ? finding.score : 0,
    severity: finding?.severity || "high",
    method: Array.isArray(finding?.method) ? finding.method : []
  };
}

async function redactForTab(tabId, url, text, findings, options = {}) {
  const policySummary = await getPolicySummary(url);
  const destinationPolicy = evaluateDestinationPolicy(policySummary, url);

  if (destinationPolicy.blocked) {
    await recordAuditEvent({
      action: "blocked",
      reason: destinationPolicy.reason,
      url,
      findings,
      policySummary
    }).catch(() => null);
    throw createPolicyDecisionError(destinationPolicy);
  }

  const current = await initState(tabId, url);
  const manager = new PlaceholderManager();
  manager.setPrivateState(current || {});

  const normalizedFindings = (findings || []).map(normalizeFinding).filter((finding) => finding.raw);
  const result = transformOutboundPrompt(text, {
    manager,
    findings: normalizedFindings,
    mode: current?.transformMode || DEFAULT_TRANSFORM_MODE
  });
  const state = await setState(tabId, {
    ...current,
    transformMode: normalizeTransformMode(current?.transformMode || DEFAULT_TRANSFORM_MODE),
    ...manager.exportPrivateState()
  });

  await recordAuditEvent({
    action: "redacted",
    reason: options.auditReason || "redacted",
    url,
    findings: normalizedFindings,
    policySummary
  }).catch(() => null);

  return {
    result: serializeRedactionResult(result),
    state: toPublicState(state, policySummary)
  };
}

async function createRevealRequest(tabId, placeholder) {
  const loadedPolicy = await loadPolicy();
  if (!loadedPolicy.policy.allowReveal) {
    throw new Error("Secure reveal is disabled by policy.");
  }

  const state = await getState(tabId);
  if (!state?.sessionId) {
    throw new Error("Secret reveal is unavailable for this tab session.");
  }

  const requestId = crypto.randomUUID();
  const canonicalPlaceholder = canonicalizePlaceholderToken(placeholder);

  await SESSION_STORAGE_AREA.set({
    [revealKey(requestId)]: {
      requestId,
      tabId,
      sessionId: state?.sessionId || null,
      placeholder: canonicalPlaceholder,
      createdAt: Date.now()
    }
  });

  return requestId;
}

async function getRevealRequest(requestId) {
  const key = revealKey(requestId);
  const result = await SESSION_STORAGE_AREA.get(key);
  return result[key] || null;
}

async function removeRevealRequest(requestId) {
  await SESSION_STORAGE_AREA.remove(revealKey(requestId));
  await clearPopupState(requestId);
}

async function getRevealContext(requestId) {
  const loadedPolicy = await loadPolicy();
  const request = await getRevealRequest(requestId);
  if (!loadedPolicy.policy.allowReveal) {
    return {
      requestId,
      placeholder: request?.placeholder || null,
      available: false,
      disabled: true,
      message: "Secure reveal is disabled by policy."
    };
  }

  if (!request) {
    return {
      requestId,
      placeholder: null,
      available: false
    };
  }

  const state = await getState(request.tabId);
  const manager = new PlaceholderManager();
  manager.setPrivateState(state || {});

  return {
    requestId,
    placeholder: request.placeholder,
    available: requestMatchesState(request, state) && manager.knowsPlaceholder(request.placeholder)
  };
}

async function revealSecret(requestId) {
  const request = await getRevealRequest(requestId);
  if (!request) {
    return null;
  }

  const state = await getState(request.tabId);
  if (!requestMatchesState(request, state)) {
    return null;
  }

  const manager = new PlaceholderManager();
  manager.setPrivateState(state || {});

  return manager.getRaw(request.placeholder);
}

async function openPopupView(state) {
  const popupState = await setPopupState(state);
  let opened = false;

  if (ext.action && typeof ext.action.openPopup === "function") {
    try {
      await ext.action.openPopup();
      opened = true;
    } catch {
      opened = false;
    }
  }

  return {
    opened,
    popupState
  };
}

ext.tabs?.onRemoved?.addListener((tabId) => {
  removeState(tabId).catch(() => {});
  removeRevealRequestsForTab(tabId).catch(() => {});
});

ext.runtime?.onInstalled?.addListener(() => {
  syncDynamicContentScripts().catch(() => {});
});

ext.runtime?.onStartup?.addListener(() => {
  syncDynamicContentScripts().catch(() => {});
});

ext.permissions?.onAdded?.addListener(() => {
  syncDynamicContentScripts().catch(() => {});
});

ext.permissions?.onRemoved?.addListener(() => {
  syncDynamicContentScripts().catch(() => {});
});

ext.storage?.onChanged?.addListener((changes, areaName) => {
  if (areaName === "local" && changes[USER_PROTECTED_SITES_STORAGE_KEY]) {
    syncDynamicContentScripts().catch(() => {});
  }

  if (areaName === "managed") {
    invalidatePolicyCache();
    syncDynamicContentScripts().catch(() => {});
  }
});

ext.runtime?.onMessage?.addListener((message, sender, sendResponse) => {
  (async () => {
    const tabId = sender?.tab?.id;

    if (message?.type === "PWM_INIT_TAB") {
      const state = await initState(tabId, message.url);
      sendResponse({ ok: true, state: toPublicState(state, await getPolicySummary(message.url)) });
      return;
    }

    if (message?.type === "PWM_GET_PUBLIC_STATE") {
      const state = await getState(tabId);
      sendResponse({
        ok: true,
        state: toPublicState(state, await getPolicySummary(message.url || sender?.tab?.url || ""))
      });
      return;
    }

    if (message?.type === "PWM_RESET_TAB") {
      const state = await setState(tabId, newState(urlKeyFrom(message.url)));
      await removeRevealRequestsForTab(tabId);
      sendResponse({ ok: true, state: toPublicState(state, await getPolicySummary(message.url)) });
      return;
    }

    if (message?.type === "PWM_SET_TRANSFORM_MODE") {
      const current = (await getState(tabId)) || newState(urlKeyFrom(message.url));
      const nextState = await setState(tabId, {
        ...migrateSessionState(current, urlKeyFrom(message.url)),
        transformMode: normalizeTransformMode(message.transformMode)
      });
      sendResponse({ ok: true, state: toPublicState(nextState, await getPolicySummary(message.url)) });
      return;
    }

    if (message?.type === "PWM_REDACT_TEXT") {
      const payload = await redactForTab(tabId, message.url, message.text, message.findings, {
        auditReason: message.auditReason
      });
      sendResponse({ ok: true, ...payload });
      return;
    }

    if (message?.type === "PWM_OPEN_POPUP_REVEAL") {
      const loadedPolicy = await loadPolicy();
      if (!loadedPolicy.policy.allowReveal) {
        sendResponse({ ok: false, error: "Secure reveal is disabled by policy." });
        return;
      }

      const requestId = await createRevealRequest(tabId, message.placeholder);
      const popup = await openPopupView({
        view: "reveal",
        requestId
      });
      sendResponse({ ok: true, requestId, opened: popup.opened });
      return;
    }

    if (message?.type === "PWM_GET_PROTECTED_SITE_OVERVIEW") {
      const overview = await getProtectedSiteOverview(message.url);
      sendResponse({ ok: true, ...overview });
      return;
    }

    if (message?.type === "PWM_ADD_PROTECTED_SITE") {
      const result = await upsertProtectedSite(message.input);

      if (typeof message.tabId === "number") {
        const reloaded = await reloadTabForRuleChange(message.tabId, message.url, result.rule).catch(
          () => false
        );

        if (!reloaded) {
          await ensureProtectionInjected(message.tabId);
        }
      }

      const overview = await getProtectedSiteOverview(message.url || message.input);
      sendResponse({ ok: true, ...result, overview });
      return;
    }

    if (message?.type === "PWM_SET_PROTECTED_SITE_ENABLED") {
      const rule = await setProtectedSiteEnabled(message.siteId, message.enabled);
      await reloadTabForRuleChange(message.tabId, message.tabUrl || message.url, rule).catch(() => false);
      const overview = await getProtectedSiteOverview(message.url || rule.origin);
      sendResponse({ ok: true, rule, overview });
      return;
    }

    if (message?.type === "PWM_DELETE_PROTECTED_SITE") {
      const rule = await deleteProtectedSite(message.siteId);
      await reloadTabForRuleChange(message.tabId, message.tabUrl || message.url, rule).catch(() => false);
      const overview = await getProtectedSiteOverview(message.url || rule.origin);
      sendResponse({ ok: true, rule, overview });
      return;
    }

    if (message?.type === "PWM_RECORD_AUDIT_EVENT") {
      const policySummary = message.url ? await getPolicySummary(message.url) : null;
      const entry = await recordAuditEvent({
        action: message.action,
        reason: message.reason,
        url: message.url,
        findings: message.findings,
        policySummary
      });
      sendResponse({ ok: true, entry });
      return;
    }

    if (message?.type === "PWM_OPEN_OPTIONS_PAGE") {
      await ext.runtime.openOptionsPage();
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "PWM_OPEN_POPUP_SITE_MANAGER") {
      const popup = await openPopupView({
        view: "sites"
      });
      sendResponse({ ok: true, opened: popup.opened });
      return;
    }

    if (message?.type === "PWM_GET_POPUP_STATE") {
      const popupState = await getPopupState();
      const revealContext =
        popupState?.view === "reveal" && popupState?.requestId
          ? await getRevealContext(popupState.requestId)
          : null;

      sendResponse({ ok: true, popupState, revealContext });
      return;
    }

    if (message?.type === "PWM_CLEAR_POPUP_STATE") {
      await clearPopupState(message.requestId);
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "PWM_EXTENSION_GET_REVEAL_CONTEXT") {
      if (!isRuntimeUiSender(sender)) {
        sendResponse({ ok: false, error: "Reveal context is restricted to extension UI." });
        return;
      }

      const context = await getRevealContext(message.requestId);
      sendResponse({ ok: true, context });
      return;
    }

    if (message?.type === "PWM_EXTENSION_REVEAL_SECRET") {
      if (!isRuntimeUiSender(sender)) {
        sendResponse({ ok: false, error: "Secret reveal is restricted to extension UI." });
        return;
      }

      const loadedPolicy = await loadPolicy();
      if (!loadedPolicy.policy.allowReveal) {
        sendResponse({ ok: false, error: "Secure reveal is disabled by policy." });
        return;
      }

      const raw = await revealSecret(message.requestId);

      if (!raw) {
        sendResponse({ ok: false, error: "Secret is unavailable for this tab session." });
        return;
      }

      sendResponse({ ok: true, raw });
      return;
    }

    if (message?.type === "PWM_EXTENSION_RELEASE_REVEAL_REQUEST") {
      if (!isRuntimeUiSender(sender)) {
        sendResponse({ ok: false, error: "Reveal release is restricted to extension UI." });
        return;
      }

      await removeRevealRequest(message.requestId);
      sendResponse({ ok: true });
      return;
    }

    sendResponse({ ok: false, error: "Unknown message type." });
  })().catch((error) => {
    sendResponse({
      ok: false,
      error: error?.message || String(error),
      reason: error?.reason || null
    });
  });

  return true;
});

syncDynamicContentScripts().catch(() => {});
