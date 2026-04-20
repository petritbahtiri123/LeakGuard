importScripts("../shared/placeholders.js", "../shared/redactor.js");

const { PlaceholderManager, Redactor, canonicalizePlaceholderToken } = globalThis.PWM;

const STORAGE_PREFIX = "pwm:tab:";
const REVEAL_PREFIX = "pwm:reveal:";

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
  return {
    sessionId: crypto.randomUUID(),
    urlKey,
    counters: { PWM: 0 },
    fingerprintToPlaceholder: {},
    placeholderToFingerprint: {},
    secretByFingerprint: {},
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

function isLegacyState(state) {
  return Boolean(state?.rawToPlaceholder || state?.placeholderToRaw);
}

function migratePrivateState(state) {
  const manager = new PlaceholderManager();
  manager.setPrivateState(state || {});
  return {
    ...state,
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
    counters: state.counters || {},
    fingerprintToPlaceholder: state.fingerprintToPlaceholder || {},
    placeholderToFingerprint: state.placeholderToFingerprint || {},
    secretByFingerprint: state.secretByFingerprint || {}
  });
}

function isExtensionUiSender(sender) {
  const senderUrl = String(sender?.url || sender?.documentUrl || "");
  return sender?.id === chrome.runtime.id && senderUrl.startsWith(chrome.runtime.getURL("ui/"));
}

function toPublicState(state) {
  const manager = new PlaceholderManager();
  manager.setPrivateState(state || {});

  return {
    sessionId: state?.sessionId || null,
    urlKey: state?.urlKey || "",
    placeholderCount: manager.exportPublicState().knownPlaceholders.length,
    knownPlaceholders: manager.exportPublicState().knownPlaceholders
  };
}

async function getState(tabId) {
  if (typeof tabId !== "number") return null;
  const key = storageKey(tabId);
  const result = await chrome.storage.session.get(key);
  return result[key] || null;
}

async function setState(tabId, state) {
  if (typeof tabId !== "number") return null;

  const next = {
    ...state,
    updatedAt: Date.now()
  };

  await chrome.storage.session.set({
    [storageKey(tabId)]: next
  });

  return next;
}

async function removeState(tabId) {
  if (typeof tabId !== "number") return;
  await chrome.storage.session.remove(storageKey(tabId));
}

async function removeRevealRequestsForTab(tabId) {
  const all = await chrome.storage.session.get(null);
  const keysToRemove = Object.entries(all)
    .filter(
      ([key, value]) => key.startsWith(REVEAL_PREFIX) && Number(value?.tabId) === Number(tabId)
    )
    .map(([key]) => key);

  if (keysToRemove.length) {
    await chrome.storage.session.remove(keysToRemove);
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

  if (state.urlKey !== nextUrlKey) {
    state = newState(nextUrlKey);
    await setState(tabId, state);
    await removeRevealRequestsForTab(tabId);
  }

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

  const redactor = new Redactor(manager);
  const normalizedFindings = (findings || []).map(normalizeFinding).filter((finding) => finding.raw);
  const result = redactor.redact(text, normalizedFindings);
  const state = await setState(tabId, {
    ...current,
    ...manager.exportPrivateState()
  });

  return {
    result: serializeRedactionResult(result),
    state: toPublicState(state)
  };
}

async function createRevealRequest(tabId, placeholder) {
  const state = await getState(tabId);
  const requestId = crypto.randomUUID();
  const canonicalPlaceholder = canonicalizePlaceholderToken(placeholder);

  await chrome.storage.session.set({
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
  const result = await chrome.storage.session.get(key);
  return result[key] || null;
}

async function removeRevealRequest(requestId) {
  await chrome.storage.session.remove(revealKey(requestId));
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
    available: manager.knowsPlaceholder(request.placeholder)
  };
}

async function revealSecret(requestId) {
  const request = await getRevealRequest(requestId);
  if (!request) {
    return null;
  }

  const state = await getState(request.tabId);
  const manager = new PlaceholderManager();
  manager.setPrivateState(state || {});

  return manager.getRaw(request.placeholder);
}

chrome.tabs.onRemoved.addListener((tabId) => {
  removeState(tabId).catch(() => {});
  removeRevealRequestsForTab(tabId).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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

    if (message?.type === "PWM_REDACT_TEXT") {
      const payload = await redactForTab(tabId, message.url, message.text, message.findings);
      sendResponse({ ok: true, ...payload });
      return;
    }

    if (message?.type === "PWM_CREATE_REVEAL_REQUEST") {
      const requestId = await createRevealRequest(tabId, message.placeholder);
      sendResponse({ ok: true, requestId });
      return;
    }

    if (message?.type === "PWM_EXTENSION_GET_REVEAL_CONTEXT") {
      if (!isExtensionUiSender(sender)) {
        sendResponse({ ok: false, error: "Reveal context is restricted to extension UI." });
        return;
      }

      const context = await getRevealContext(message.requestId);
      sendResponse({ ok: true, context });
      return;
    }

    if (message?.type === "PWM_EXTENSION_REVEAL_SECRET") {
      if (!isExtensionUiSender(sender)) {
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
      if (!isExtensionUiSender(sender)) {
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
