(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  const ext = root.PWM.ext || root.browser || root.chrome || null;
  const POLICY_FILES = Object.freeze({
    consumer: "config/policy.consumer.json",
    enterprise: "config/policy.enterprise.json"
  });
  const DEFAULT_CONSUMER_POLICY = Object.freeze({
    enterpriseMode: false,
    allowReveal: true,
    allowUserAddedSites: true,
    blockHttpSecrets: false,
    redactHttpAggressively: true,
    defaultAction: "redact",
    auditMode: "off",
    strictPolicyLoad: false,
    approvedDestinations: [],
    blockedDestinations: []
  });
  const DEFAULT_ENTERPRISE_POLICY = Object.freeze({
    enterpriseMode: true,
    allowReveal: false,
    allowUserAddedSites: false,
    blockHttpSecrets: true,
    redactHttpAggressively: true,
    defaultAction: "block",
    auditMode: "metadata-only",
    strictPolicyLoad: false,
    approvedDestinations: [
      "https://chatgpt.com/*",
      "https://chat.openai.com/*",
      "https://gemini.google.com/*",
      "https://claude.ai/*",
      "https://grok.com/*"
    ],
    blockedDestinations: ["http://*/*"]
  });
  const VALID_DEFAULT_ACTIONS = new Set(["redact", "block"]);
  const VALID_AUDIT_MODES = new Set(["off", "metadata-only", "full"]);
  let cachedPolicyPromise = null;

  function cloneValue(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function mergeValue(baseValue, overrideValue) {
    if (overrideValue === null) {
      return undefined;
    }

    if (Array.isArray(baseValue) || Array.isArray(overrideValue)) {
      return Array.isArray(overrideValue) ? [...overrideValue] : overrideValue;
    }

    if (
      baseValue &&
      overrideValue &&
      typeof baseValue === "object" &&
      typeof overrideValue === "object"
    ) {
      const output = { ...baseValue };
      for (const [key, value] of Object.entries(overrideValue)) {
        const merged = mergeValue(baseValue[key], value);
        if (merged === undefined) {
          delete output[key];
        } else {
          output[key] = merged;
        }
      }
      return output;
    }

    return overrideValue === undefined ? baseValue : overrideValue;
  }

  function getBuildInfo() {
    const input = root.PWM_BUILD_INFO || {};
    const browser = input.browser === "firefox" ? "firefox" : "chrome";
    const mode = input.mode === "enterprise" ? "enterprise" : "consumer";

    return {
      browser,
      mode,
      enterprise: mode === "enterprise"
    };
  }

  function getBundledDefaultPolicy(buildInfo = getBuildInfo()) {
    return cloneValue(buildInfo.enterprise ? DEFAULT_ENTERPRISE_POLICY : DEFAULT_CONSUMER_POLICY);
  }

  async function readJsonFile(relativePath) {
    if (typeof module !== "undefined" && module.exports) {
      const fs = require("fs");
      const path = require("path");
      const repoRoot = path.join(__dirname, "..", "..");
      return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
    }

    if (!ext?.runtime?.getURL || typeof fetch !== "function") {
      throw new Error(`LeakGuard could not load ${relativePath}.`);
    }

    const response = await fetch(ext.runtime.getURL(relativePath));
    if (!response.ok) {
      throw new Error(`LeakGuard could not load ${relativePath}.`);
    }

    return response.json();
  }

  function asStringArray(value, fallback) {
    if (value === undefined) {
      return [...fallback];
    }

    if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
      throw new Error("Expected an array of strings.");
    }

    return [...new Set(value.map((entry) => entry.trim()).filter(Boolean))];
  }

  function asBoolean(value, fallback) {
    if (value === undefined) {
      return fallback;
    }

    if (typeof value !== "boolean") {
      throw new Error("Expected a boolean.");
    }

    return value;
  }

  function asEnum(value, fallback, allowed) {
    if (value === undefined) {
      return fallback;
    }

    if (typeof value !== "string") {
      throw new Error("Expected a string.");
    }

    const normalized = value.trim().toLowerCase();
    if (!allowed.has(normalized)) {
      throw new Error(`Unexpected value "${value}".`);
    }

    return normalized;
  }

  function normalizePolicyInput(rawPolicy, options = {}) {
    const buildInfo = options.buildInfo || getBuildInfo();
    const basePolicy = options.basePolicy ? cloneValue(options.basePolicy) : getBundledDefaultPolicy(buildInfo);
    const input = rawPolicy && typeof rawPolicy === "object" ? rawPolicy : {};
    const errors = [];
    const normalized = cloneValue(basePolicy);

    const assign = (key, mapper) => {
      try {
        normalized[key] = mapper(input[key], basePolicy[key]);
      } catch (error) {
        errors.push(`${key}: ${error.message}`);
      }
    };

    assign("allowReveal", asBoolean);
    assign("allowUserAddedSites", asBoolean);
    assign("blockHttpSecrets", asBoolean);
    assign("redactHttpAggressively", asBoolean);
    assign("strictPolicyLoad", asBoolean);
    assign("defaultAction", (value, fallback) => asEnum(value, fallback, VALID_DEFAULT_ACTIONS));
    assign("auditMode", (value, fallback) => asEnum(value, fallback, VALID_AUDIT_MODES));
    assign("approvedDestinations", asStringArray);
    assign("blockedDestinations", asStringArray);

    normalized.enterpriseMode = Boolean(buildInfo.enterprise);

    return {
      ok: errors.length === 0,
      value: normalized,
      errors
    };
  }

  function buildFailClosedPolicy(basePolicy, buildInfo = getBuildInfo()) {
    return {
      ...cloneValue(basePolicy),
      enterpriseMode: Boolean(buildInfo.enterprise),
      allowReveal: false,
      allowUserAddedSites: false,
      blockHttpSecrets: true,
      redactHttpAggressively: true,
      defaultAction: "block",
      auditMode: "metadata-only"
    };
  }

  async function loadDefaultPolicy(buildInfo = getBuildInfo()) {
    const relativePath = POLICY_FILES[buildInfo.enterprise ? "enterprise" : "consumer"];

    try {
      const rawDefaults = await readJsonFile(relativePath);
      const normalized = normalizePolicyInput(rawDefaults, { buildInfo });
      if (!normalized.ok) {
        throw new Error(normalized.errors.join("; "));
      }
      return normalized.value;
    } catch {
      return getBundledDefaultPolicy(buildInfo);
    }
  }

  async function loadManagedPolicyRaw() {
    if (!ext?.storage?.managed?.get) {
      return {
        available: false,
        value: null,
        error: "Managed storage is unavailable."
      };
    }

    try {
      return {
        available: true,
        value: await ext.storage.managed.get(null),
        error: null
      };
    } catch (error) {
      return {
        available: false,
        value: null,
        error: error?.message || "Managed policy could not be read."
      };
    }
  }

  function getStrictPreference(defaultPolicy, managedValue) {
    if (typeof managedValue?.strictPolicyLoad === "boolean") {
      return managedValue.strictPolicyLoad;
    }

    return Boolean(defaultPolicy?.strictPolicyLoad);
  }

  async function loadPolicy(options = {}) {
    if (!options.forceReload && cachedPolicyPromise) {
      return cachedPolicyPromise;
    }

    cachedPolicyPromise = (async () => {
      const buildInfo = options.buildInfo || getBuildInfo();
      const defaults = await loadDefaultPolicy(buildInfo);
      const managed = await loadManagedPolicyRaw();
      let policy = defaults;
      let managedApplied = false;
      let strictFailure = false;
      const errors = [];

      if (managed.available && managed.value && Object.keys(managed.value).length > 0) {
        const normalizedManaged = normalizePolicyInput(managed.value, {
          buildInfo,
          basePolicy: defaults
        });

        if (normalizedManaged.ok) {
          policy = mergeValue(defaults, normalizedManaged.value);
          managedApplied = true;
        } else {
          errors.push(...normalizedManaged.errors);
          if (buildInfo.enterprise && getStrictPreference(defaults, managed.value)) {
            policy = buildFailClosedPolicy(defaults, buildInfo);
            strictFailure = true;
          }
        }
      } else if (buildInfo.enterprise && getStrictPreference(defaults, managed.value)) {
        errors.push(managed.error || "Managed policy is unavailable.");
        policy = buildFailClosedPolicy(defaults, buildInfo);
        strictFailure = true;
      }

      return {
        policy: {
          ...policy,
          enterpriseMode: Boolean(buildInfo.enterprise)
        },
        meta: {
          buildInfo,
          managedAvailable: managed.available,
          managedApplied,
          strictFailure,
          errors
        }
      };
    })();

    return cachedPolicyPromise;
  }

  function invalidatePolicyCache() {
    cachedPolicyPromise = null;
  }

  function parseMatchPattern(pattern) {
    const input = String(pattern || "").trim();
    const match = /^(\*|https?|http):\/\/([^/]+)(\/.*)$/.exec(input);
    if (!match) {
      return null;
    }

    return {
      scheme: match[1].toLowerCase(),
      host: match[2].toLowerCase(),
      path: match[3]
    };
  }

  function hostMatchesPattern(hostname, patternHost) {
    const normalizedHost = String(hostname || "").toLowerCase();
    const normalizedPattern = String(patternHost || "").toLowerCase();

    if (normalizedPattern === "*") {
      return true;
    }

    if (normalizedPattern.startsWith("*.")) {
      const suffix = normalizedPattern.slice(1);
      return normalizedHost.endsWith(suffix) && normalizedHost.length > suffix.length - 1;
    }

    return normalizedHost === normalizedPattern;
  }

  function pathMatchesPattern(pathname, patternPath) {
    const normalizedPath = String(pathname || "/");
    const escaped = String(patternPath || "/*").replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    return new RegExp(`^${escaped}$`).test(normalizedPath);
  }

  function matchPattern(pattern, url) {
    const parsedPattern = parseMatchPattern(pattern);
    if (!parsedPattern) return false;

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return false;
    }

    const schemeMatches =
      parsedPattern.scheme === "*" || parsedPattern.scheme === parsedUrl.protocol.replace(/:$/, "");

    if (!schemeMatches) return false;
    if (!hostMatchesPattern(parsedUrl.hostname, parsedPattern.host)) return false;

    const pathWithSearch = `${parsedUrl.pathname}${parsedUrl.search || ""}`;
    return pathMatchesPattern(pathWithSearch, parsedPattern.path) || pathMatchesPattern(parsedUrl.pathname, parsedPattern.path);
  }

  function summarizePolicy(policy, url, meta = {}) {
    const targetUrl = String(url || "");
    const isHttp = /^http:\/\//i.test(targetUrl);
    const approved = policy.approvedDestinations.length
      ? policy.approvedDestinations.some((pattern) => matchPattern(pattern, targetUrl))
      : true;
    const blocked = policy.blockedDestinations.some((pattern) => matchPattern(pattern, targetUrl));

    return {
      enterpriseMode: Boolean(policy.enterpriseMode),
      allowReveal: Boolean(policy.allowReveal),
      allowUserAddedSites: Boolean(policy.allowUserAddedSites),
      blockHttpSecrets: Boolean(policy.blockHttpSecrets),
      redactHttpAggressively: Boolean(policy.redactHttpAggressively),
      defaultAction: policy.defaultAction,
      auditMode: policy.auditMode,
      strictPolicyLoad: Boolean(policy.strictPolicyLoad),
      destinationApproved: approved,
      destinationBlocked: blocked,
      http: isHttp,
      managedApplied: Boolean(meta.managedApplied),
      strictFailure: Boolean(meta.strictFailure)
    };
  }

  async function getPolicySummary(url, options = {}) {
    const loaded = await loadPolicy(options);
    return summarizePolicy(loaded.policy, url, loaded.meta);
  }

  root.PWM.DEFAULT_CONSUMER_POLICY = DEFAULT_CONSUMER_POLICY;
  root.PWM.DEFAULT_ENTERPRISE_POLICY = DEFAULT_ENTERPRISE_POLICY;
  root.PWM.getBuildInfo = getBuildInfo;
  root.PWM.getBundledDefaultPolicy = getBundledDefaultPolicy;
  root.PWM.loadDefaultPolicy = loadDefaultPolicy;
  root.PWM.loadPolicy = loadPolicy;
  root.PWM.getPolicySummary = getPolicySummary;
  root.PWM.invalidatePolicyCache = invalidatePolicyCache;
  root.PWM.matchPolicyPattern = matchPattern;
  root.PWM.summarizePolicy = summarizePolicy;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      DEFAULT_CONSUMER_POLICY,
      DEFAULT_ENTERPRISE_POLICY,
      getBuildInfo,
      getBundledDefaultPolicy,
      loadDefaultPolicy,
      loadPolicy,
      getPolicySummary,
      invalidatePolicyCache,
      matchPattern,
      summarizePolicy,
      normalizePolicyInput,
      buildFailClosedPolicy
    };
  }
})();
