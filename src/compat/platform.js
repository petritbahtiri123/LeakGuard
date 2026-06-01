(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  const ext = root.PWM.ext || root.browser || root.chrome;
  const userAgent = String(root.navigator?.userAgent || "");
  const isFirefox = /firefox/i.test(userAgent);
  const supportsDynamicContentScripts = Boolean(
    ext?.scripting?.registerContentScripts && ext?.scripting?.unregisterContentScripts
  );
  const supportsStorageSession = Boolean(ext?.storage?.session);
  const ephemeralSessionStore = new Map();

  function cloneStorageValue(value) {
    if (value === undefined) return undefined;
    if (typeof structuredClone === "function") {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  }

  const ephemeralSessionStorageArea = {
    async get(keys = null) {
      if (keys == null) {
        const output = {};
        for (const [key, value] of ephemeralSessionStore.entries()) {
          output[key] = cloneStorageValue(value);
        }
        return output;
      }

      if (typeof keys === "string") {
        return ephemeralSessionStore.has(keys)
          ? { [keys]: cloneStorageValue(ephemeralSessionStore.get(keys)) }
          : {};
      }

      if (Array.isArray(keys)) {
        const output = {};
        for (const key of keys) {
          if (ephemeralSessionStore.has(key)) {
            output[key] = cloneStorageValue(ephemeralSessionStore.get(key));
          }
        }
        return output;
      }

      if (typeof keys === "object") {
        const output = {};
        for (const [key, fallback] of Object.entries(keys)) {
          output[key] = ephemeralSessionStore.has(key)
            ? cloneStorageValue(ephemeralSessionStore.get(key))
            : cloneStorageValue(fallback);
        }
        return output;
      }

      return {};
    },
    async set(items) {
      for (const [key, value] of Object.entries(items || {})) {
        ephemeralSessionStore.set(key, cloneStorageValue(value));
      }
    },
    async remove(keys) {
      const normalizedKeys = Array.isArray(keys) ? keys : [keys];
      for (const key of normalizedKeys) {
        ephemeralSessionStore.delete(key);
      }
    },
    async clear() {
      ephemeralSessionStore.clear();
    }
  };

  function getSessionStorageArea() {
    return supportsStorageSession ? ext.storage.session : ephemeralSessionStorageArea;
  }

  root.PWM.ext = ext;
  root.PWM.isFirefox = isFirefox;
  root.PWM.supportsDynamicContentScripts = supportsDynamicContentScripts;
  root.PWM.supportsStorageSession = supportsStorageSession;
  root.PWM.usingEphemeralSessionStorage = !supportsStorageSession;
  root.PWM.getSessionStorageArea = getSessionStorageArea;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      ext,
      isFirefox,
      supportsDynamicContentScripts,
      supportsStorageSession,
      usingEphemeralSessionStorage: !supportsStorageSession,
      getSessionStorageArea
    };
  }
})();
