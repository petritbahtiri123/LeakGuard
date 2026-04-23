(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  const DEFAULT_TRANSFORM_MODE = "hide_public";
  const SUPPORTED_TRANSFORM_MODES = new Set(["hide_public", "hide_all", "raw"]);

  function normalizeTransformMode(mode) {
    const normalized = String(mode || DEFAULT_TRANSFORM_MODE).toLowerCase();
    return SUPPORTED_TRANSFORM_MODES.has(normalized) ? normalized : DEFAULT_TRANSFORM_MODE;
  }

  function createSessionState(urlKey, overrides = {}) {
    return {
      version: 2,
      sessionId: crypto.randomUUID(),
      urlKey: String(urlKey || ""),
      transformMode: normalizeTransformMode(overrides.transformMode),
      counters: { PWM: 0, NET: 0, PUB_HOST: 0 },
      fingerprintToPlaceholder: {},
      placeholderToFingerprint: {},
      secretByFingerprint: {},
      objects: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  function migrateSessionState(state, fallbackUrlKey) {
    if (!state) {
      return createSessionState(fallbackUrlKey);
    }

    return {
      ...state,
      version: 2,
      urlKey: String(state.urlKey || fallbackUrlKey || ""),
      transformMode: normalizeTransformMode(state.transformMode),
      counters: {
        PWM: Number(state?.counters?.PWM || 0),
        NET: Number(state?.counters?.NET || 0),
        PUB_HOST: Number(state?.counters?.PUB_HOST || 0)
      },
      objects: Array.isArray(state.objects) ? state.objects : []
    };
  }

  root.PWM.DEFAULT_TRANSFORM_MODE = DEFAULT_TRANSFORM_MODE;
  root.PWM.SUPPORTED_TRANSFORM_MODES = SUPPORTED_TRANSFORM_MODES;
  root.PWM.normalizeTransformMode = normalizeTransformMode;
  root.PWM.createSessionState = createSessionState;
  root.PWM.migrateSessionState = migrateSessionState;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      DEFAULT_TRANSFORM_MODE,
      SUPPORTED_TRANSFORM_MODES,
      normalizeTransformMode,
      createSessionState,
      migrateSessionState
    };
  }
})();
