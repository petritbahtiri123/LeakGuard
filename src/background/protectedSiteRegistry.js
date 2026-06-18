(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  const USER_SITE_SCRIPT_ID_PREFIX = "pwm_user_site_";
  const CONTENT_STYLE_FILES = ["content/overlay.css"];

  function createProtectedSiteRegistry({
    ext,
    loadPolicy,
    normalizeProtectedSiteInput,
    normalizeProtectedSiteList,
    contentScripts,
    storageKey,
    isBuiltinProtectedSiteRule,
    supportsDynamicContentScripts
  }) {
    let syncDynamicContentScriptsPromise = Promise.resolve();

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

    async function getManagedProtectedSites(policy = null) {
      const loadedPolicy = policy || (await loadPolicy());
      const managedInputs = Array.isArray(loadedPolicy?.policy?.managedProtectedSites)
        ? loadedPolicy.policy.managedProtectedSites
        : [];

      return normalizeProtectedSiteList(
        managedInputs
          .map((input) => normalizeProtectedSiteInput(input))
          .filter((normalized) => normalized.ok)
          .map((normalized) => ({
            ...normalized.rule,
            enabled: true,
            managed: true
          }))
      );
    }

    function siteRuleMatchesUrl(rule, url) {
      const normalized = normalizeProtectedSiteInput(url);
      return Boolean(normalized.ok && rule?.id && normalized.rule.id === rule.id);
    }

    async function getStoredProtectedSites() {
      const result = await ext.storage.local.get(storageKey);
      return normalizeProtectedSiteList(result[storageKey]);
    }

    async function setStoredProtectedSites(rules) {
      const normalizedRules = normalizeProtectedSiteList(rules);

      await ext.storage.local.set({
        [storageKey]: normalizedRules
      });

      return normalizedRules;
    }

    async function enrichProtectedSites(rules, policySummary) {
      return Promise.all(
        (rules || []).map(async (rule) => {
          const hasPermission = await ext.permissions.contains({
            origins: [rule.matchPattern]
          });
          const managed = Boolean(rule.managed);
          const activeByPolicy = managed ? true : Boolean(policySummary?.allowUserAddedSites);

          return {
            ...rule,
            hasPermission,
            active: Boolean(activeByPolicy && rule.enabled && hasPermission),
            policyLocked: managed ? true : !policySummary?.allowUserAddedSites,
            removalLocked: managed ? true : !policySummary?.allowSiteRemoval
          };
        })
      );
    }

    async function buildUserSiteRegistrations() {
      const loadedPolicy = await loadPolicy();
      const managedSites = await getManagedProtectedSites(loadedPolicy);
      const userSites = loadedPolicy.policy.allowUserAddedSites ? await getStoredProtectedSites() : [];
      const siteRules = normalizeProtectedSiteList([...managedSites, ...userSites]);
      const registrations = [];

      for (const rule of siteRules) {
        if (!rule.enabled) continue;

        const hasPermission = await ext.permissions.contains({
          origins: [rule.matchPattern]
        });
        if (!hasPermission) continue;

        registrations.push({
          id: userSiteScriptId(rule),
          matches: [rule.matchPattern],
          js: contentScripts,
          css: CONTENT_STYLE_FILES,
          runAt: "document_start",
          allFrames: true,
          matchOriginAsFallback: true,
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

    return {
      stableRuleHash,
      userSiteScriptId,
      getManagedProtectedSites,
      siteRuleMatchesUrl,
      getStoredProtectedSites,
      setStoredProtectedSites,
      enrichProtectedSites,
      buildUserSiteRegistrations,
      performDynamicContentScriptSync,
      syncDynamicContentScripts,
      ensureProtectedSitePermission
    };
  }

  root.PWM.createProtectedSiteRegistry = createProtectedSiteRegistry;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      createProtectedSiteRegistry
    };
  }
})();
