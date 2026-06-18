(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};
  const registry = root.PWM.EnterpriseDetectors || {};
  function scanAll(text, detector) {
    return [
      registry.uncPaths,
      registry.directoryMetadata,
      registry.internalNetwork,
      registry.fileShares,
      registry.adGroups,
      registry.azureResourceGroups,
      registry.cloudResourceNames,
      registry.storageAccounts,
      registry.hostnames,
      registry.identity
    ]
      .filter((entry) => entry && typeof entry.scan === "function")
      .flatMap((entry) => entry.scan(text, detector));
  }
  root.PWM.EnterpriseDetectors = { ...registry, scanAll };
})();
