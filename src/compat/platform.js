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

  function getSessionStorageArea() {
    return supportsStorageSession ? ext.storage.session : ext.storage.local;
  }

  root.PWM.ext = ext;
  root.PWM.isFirefox = isFirefox;
  root.PWM.supportsDynamicContentScripts = supportsDynamicContentScripts;
  root.PWM.supportsStorageSession = supportsStorageSession;
  root.PWM.getSessionStorageArea = getSessionStorageArea;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      ext,
      isFirefox,
      supportsDynamicContentScripts,
      supportsStorageSession,
      getSessionStorageArea
    };
  }
})();
