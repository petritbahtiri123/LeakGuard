(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  const ext = root.browser ?? root.chrome;

  if (!ext) {
    throw new Error("LeakGuard requires a WebExtension browser API namespace.");
  }

  root.PWM.ext = ext;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { ext };
  }
})();
