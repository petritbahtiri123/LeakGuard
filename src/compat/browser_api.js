(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function extensionUrlIsUsable(ext) {
    if (!ext?.runtime?.getURL) return false;
    try {
      return !String(ext.runtime.getURL("")).startsWith("chrome-extension://invalid");
    } catch {
      return false;
    }
  }

  const ext = [root.browser, root.chrome].find(extensionUrlIsUsable) ?? root.browser ?? root.chrome;

  if (!ext) {
    throw new Error("LeakGuard requires a WebExtension browser API namespace.");
  }

  root.PWM.ext = ext;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { ext };
  }
})();
