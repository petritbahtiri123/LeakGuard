(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};
  root.PWM.CloudProviderDetectors = root.PWM.CloudProviderDetectors || {};
  root.PWM.CloudProviderDetectors.azure = { scan() { return []; } };
})();
