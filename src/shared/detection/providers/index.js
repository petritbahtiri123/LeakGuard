(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};
  const registry = root.PWM.CloudProviderDetectors || {};
  function scanAll(text, detector) {
    return [registry.azure, registry.azureIds, registry.aws, registry.gcp, registry.otcOpenStack, registry.kubernetes, registry.genericEndpoints]
      .filter((entry) => entry && typeof entry.scan === "function")
      .flatMap((entry) => entry.scan(text, detector));
  }
  root.PWM.CloudProviderDetectors = { ...registry, scanAll };
})();
