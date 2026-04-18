const STORAGE_PREFIX = "pwm:tab:";

function storageKey(tabId) {
  return `${STORAGE_PREFIX}${tabId}`;
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
    counters: {},
    rawToPlaceholder: {},
    placeholderToRaw: {},
    createdAt: Date.now(),
    updatedAt: Date.now()
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

async function initState(tabId, url) {
  if (typeof tabId !== "number") return null;

  const nextUrlKey = urlKeyFrom(url);
  let state = await getState(tabId);

  if (!state || state.urlKey !== nextUrlKey) {
    state = newState(nextUrlKey);
    await setState(tabId, state);
  }

  return state;
}

function mergeState(current, incoming) {
  return {
    ...current,
    ...incoming,
    sessionId: current.sessionId,
    urlKey: current.urlKey,
    counters: { ...(incoming?.counters || current.counters || {}) },
    rawToPlaceholder: {
      ...(incoming?.rawToPlaceholder || current.rawToPlaceholder || {})
    },
    placeholderToRaw: {
      ...(incoming?.placeholderToRaw || current.placeholderToRaw || {})
    }
  };
}

chrome.tabs.onRemoved.addListener((tabId) => {
  removeState(tabId).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    const tabId = sender?.tab?.id ?? message?.tabId;

    if (message?.type === "PWM_INIT_TAB") {
      const state = await initState(tabId, message.url);
      sendResponse({ ok: true, state });
      return;
    }

    if (message?.type === "PWM_GET_STATE") {
      const state = await getState(tabId);
      sendResponse({ ok: true, state });
      return;
    }

    if (message?.type === "PWM_SET_STATE") {
      const current = await initState(tabId, message.url);
      const merged = mergeState(current, message.state);
      const state = await setState(tabId, merged);
      sendResponse({ ok: true, state });
      return;
    }

    if (message?.type === "PWM_RESET_TAB") {
      const state = await setState(tabId, newState(urlKeyFrom(message.url)));
      sendResponse({ ok: true, state });
      return;
    }

    if (message?.type === "PWM_GET_RAW_BY_PLACEHOLDER") {
      const state = await getState(tabId);
      const raw = state?.placeholderToRaw?.[message.placeholder] || null;
      sendResponse({ ok: true, raw });
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
