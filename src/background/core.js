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
  "content/composer_helpers.js",
  "content/content.js"
];
const CONTENT_STYLE_FILES = ["content/overlay.css"];

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

async function enrichProtectedSites(rules) {
  return Promise.all(
    (rules || []).map(async (rule) => {
      const hasPermission = await ext.permissions.contains({
        origins: [rule.matchPattern]
      });

      return {
        ...rule,
        hasPermission,
        active: Boolean(rule.enabled && hasPermission)
      };
    })
  );
}

async function getProtectedSiteOverview(url) {
  const userSites = await enrichProtectedSites(await getStoredProtectedSites());
  const normalized = normalizeProtectedSiteInput(url);

  if (!normalized.ok) {
    return {
      builtInSites: BUILTIN_PROTECTED_SITES,
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
  const storedRule = userSites.find((rule) => rule.id === targetRule.id) || null;

  if (builtInRule) {
    return {
      builtInSites: BUILTIN_PROTECTED_SITES,
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

  if (storedRule?.active) {
    return {
      builtInSites: BUILTIN_PROTECTED_SITES,
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
      builtInSites: BUILTIN_PROTECTED_SITES,
      userSites,
      currentSite: {
        eligible: true,
        protected: false,
        source: null,
        canProtect: true,
        rule: storedRule,
        message: "Site access is missing. Grant access again to re-enable protection."
      }
    };
  }

  if (storedRule && !storedRule.enabled) {
    return {
      builtInSites: BUILTIN_PROTECTED_SITES,
      userSites,
      currentSite: {
        eligible: true,
        protected: false,
        source: null,
        canProtect: true,
        rule: storedRule,
        message: "Protection is saved for this site but currently disabled."
      }
    };
  }

  return {
    builtInSites: BUILTIN_PROTECTED_SITES,
    userSites,
    currentSite: {
      eligible: true,
      protected: false,
      source: null,
      canProtect: true,
      rule: targetRule,
      message: "LeakGuard is not protecting this site yet."
    }
  };
}

async function buildUserSiteRegistrations() {
  const userSites = await getStoredProtectedSites();
  const registrations = [];

  for (const rule of userSites) {
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
  const currentRules = await getStoredProtectedSites();
  const existingRule = currentRules.find((rule) => rule.id === siteId);

  if (!existingRule) {
    throw new Error("Protected site rule not found.");
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

function toPublicState(state) {
  const manager = new PlaceholderManager();
  manager.setPrivateState(state || {});
  const publicState = manager.exportPublicState();

  return {
    transformMode: normalizeTransformMode(state?.transformMode || DEFAULT_TRANSFORM_MODE),
    placeholderCount: publicState.knownPlaceholders.length
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

async function redactForTab(tabId, url, text, findings) {
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

  return {
    result: serializeRedactionResult(result),
    state: toPublicState(state)
  };
}

async function createRevealRequest(tabId, placeholder) {
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
  const request = await getRevealRequest(requestId);
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
});

ext.runtime?.onMessage?.addListener((message, sender, sendResponse) => {
  (async () => {
    const tabId = sender?.tab?.id;

    if (message?.type === "PWM_INIT_TAB") {
      const state = await initState(tabId, message.url);
      sendResponse({ ok: true, state: toPublicState(state) });
      return;
    }

    if (message?.type === "PWM_GET_PUBLIC_STATE") {
      const state = await getState(tabId);
      sendResponse({ ok: true, state: toPublicState(state) });
      return;
    }

    if (message?.type === "PWM_RESET_TAB") {
      const state = await setState(tabId, newState(urlKeyFrom(message.url)));
      await removeRevealRequestsForTab(tabId);
      sendResponse({ ok: true, state: toPublicState(state) });
      return;
    }

    if (message?.type === "PWM_SET_TRANSFORM_MODE") {
      const current = (await getState(tabId)) || newState(urlKeyFrom(message.url));
      const nextState = await setState(tabId, {
        ...migrateSessionState(current, urlKeyFrom(message.url)),
        transformMode: normalizeTransformMode(message.transformMode)
      });
      sendResponse({ ok: true, state: toPublicState(nextState) });
      return;
    }

    if (message?.type === "PWM_REDACT_TEXT") {
      const payload = await redactForTab(tabId, message.url, message.text, message.findings);
      sendResponse({ ok: true, ...payload });
      return;
    }

    if (message?.type === "PWM_OPEN_POPUP_REVEAL") {
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
        await ensureProtectionInjected(message.tabId);
      }

      const overview = await getProtectedSiteOverview(message.url || message.input);
      sendResponse({ ok: true, ...result, overview });
      return;
    }

    if (message?.type === "PWM_SET_PROTECTED_SITE_ENABLED") {
      const rule = await setProtectedSiteEnabled(message.siteId, message.enabled);
      const overview = await getProtectedSiteOverview(message.url || rule.origin);
      sendResponse({ ok: true, rule, overview });
      return;
    }

    if (message?.type === "PWM_DELETE_PROTECTED_SITE") {
      const rule = await deleteProtectedSite(message.siteId);
      const overview = await getProtectedSiteOverview(message.url || rule.origin);
      sendResponse({ ok: true, rule, overview });
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
      error: error?.message || String(error)
    });
  });

  return true;
});

syncDynamicContentScripts().catch(() => {});
