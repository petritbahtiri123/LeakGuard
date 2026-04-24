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
    allowUserOverride: true,
    allowUserAddedSites: true,
    allowSiteRemoval: true,
    blockHttpSecrets: false,
    redactHttpAggressively: true,
    aiAssistEnabled: true,
    defaultAction: "redact",
    defaultDestinationAction: "allow",
    auditMode: "off",
    strictPolicyLoad: false,
    managedProtectedSites: [],
    destinationPolicies: [],
    approvedDestinations: [],
    blockedDestinations: []
  });
  const DEFAULT_ENTERPRISE_POLICY = Object.freeze({
    enterpriseMode: true,
    allowReveal: false,
    allowUserOverride: false,
    allowUserAddedSites: false,
    allowSiteRemoval: true,
    blockHttpSecrets: true,
    redactHttpAggressively: true,
    aiAssistEnabled: true,
    defaultAction: "block",
    defaultDestinationAction: "block",
    auditMode: "metadata-only",
    strictPolicyLoad: false,
    managedProtectedSites: [],
    destinationPolicies: [],
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
  const VALID_DESTINATION_ACTIONS = new Set(["allow", "redact", "block"]);
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

  function asDestinationPolicies(value, fallback) {
    if (value === undefined) {
      return Array.isArray(fallback) ? cloneValue(fallback) : [];
    }

    if (!Array.isArray(value)) {
      throw new Error("Expected an array of destination policy objects.");
    }

    return value.map((entry, index) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        throw new Error(`Entry ${index + 1} must be an object.`);
      }

      const match = String(entry.match || "").trim();
      if (!match) {
        throw new Error(`Entry ${index + 1} must include a match pattern.`);
      }

      if (!parseMatchPattern(match)) {
        throw new Error(`Entry ${index + 1} has an invalid match pattern.`);
      }

      const action = asEnum(entry.action, undefined, VALID_DESTINATION_ACTIONS);

      return {
        match,
        action
      };
    });
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
    assign("allowUserOverride", asBoolean);
    assign("allowUserAddedSites", asBoolean);
    assign("allowSiteRemoval", asBoolean);
    assign("blockHttpSecrets", asBoolean);
    assign("redactHttpAggressively", asBoolean);
    assign("aiAssistEnabled", asBoolean);
    assign("strictPolicyLoad", asBoolean);
    assign("managedProtectedSites", asStringArray);
    assign("defaultAction", (value, fallback) => asEnum(value, fallback, VALID_DEFAULT_ACTIONS));
    assign("defaultDestinationAction", (value, fallback) =>
      asEnum(value, fallback, VALID_DESTINATION_ACTIONS)
    );
    assign("auditMode", (value, fallback) => asEnum(value, fallback, VALID_AUDIT_MODES));
    assign("destinationPolicies", asDestinationPolicies);
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
      allowUserOverride: false,
      allowUserAddedSites: false,
      allowSiteRemoval: true,
      blockHttpSecrets: true,
      redactHttpAggressively: true,
      aiAssistEnabled: false,
      defaultAction: "block",
      defaultDestinationAction: "block",
      auditMode: "metadata-only",
      managedProtectedSites: []
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

  function getDestinationPolicyInputs(policyOrSummary, url) {
    const targetUrl = String(url || "");
    const hasTargetUrl = Boolean(targetUrl);
    const destinationPolicies = Array.isArray(policyOrSummary?.destinationPolicies)
      ? cloneValue(policyOrSummary.destinationPolicies)
      : [];
    const destinationPoliciesConfigured =
      typeof policyOrSummary?.destinationPoliciesConfigured === "boolean"
        ? policyOrSummary.destinationPoliciesConfigured
        : destinationPolicies.length > 0;
    const defaultDestinationAction =
      typeof policyOrSummary?.defaultDestinationAction === "string"
        ? policyOrSummary.defaultDestinationAction
        : Boolean(policyOrSummary?.enterpriseMode)
          ? "block"
          : "allow";
    const matchedDestinationPolicy =
      typeof policyOrSummary?.matchedDestinationPolicy === "object" &&
      policyOrSummary?.matchedDestinationPolicy
        ? cloneValue(policyOrSummary.matchedDestinationPolicy)
        : destinationPoliciesConfigured && hasTargetUrl
          ? destinationPolicies.find((entry) => matchPattern(entry.match, targetUrl)) || null
          : null;
    const approvedDestinations = Array.isArray(policyOrSummary?.approvedDestinations)
      ? policyOrSummary.approvedDestinations
      : [];
    const blockedDestinations = Array.isArray(policyOrSummary?.blockedDestinations)
      ? policyOrSummary.blockedDestinations
      : [];
    const destinationApprovalConfigured =
      typeof policyOrSummary?.destinationApprovalConfigured === "boolean"
        ? policyOrSummary.destinationApprovalConfigured
        : approvedDestinations.length > 0;
    const destinationApproved =
      typeof policyOrSummary?.destinationApproved === "boolean"
        ? policyOrSummary.destinationApproved
        : hasTargetUrl && destinationApprovalConfigured
          ? approvedDestinations.some((pattern) => matchPattern(pattern, targetUrl))
          : true;
    const destinationBlocked =
      typeof policyOrSummary?.destinationBlocked === "boolean"
        ? policyOrSummary.destinationBlocked
        : hasTargetUrl
          ? blockedDestinations.some((pattern) => matchPattern(pattern, targetUrl))
          : false;
    const destinationAction =
      typeof policyOrSummary?.destinationAction === "string"
        ? policyOrSummary.destinationAction
        : destinationPoliciesConfigured
          ? matchedDestinationPolicy?.action || defaultDestinationAction
          : destinationBlocked
            ? "block"
            : "allow";
    const destinationRequiresRedaction =
      typeof policyOrSummary?.destinationRequiresRedaction === "boolean"
        ? policyOrSummary.destinationRequiresRedaction
        : destinationAction === "redact";

    return {
      enterpriseMode: Boolean(policyOrSummary?.enterpriseMode),
      strictFailure: Boolean(policyOrSummary?.strictFailure),
      targetUrl,
      destinationPoliciesConfigured,
      defaultDestinationAction,
      matchedDestinationPolicy,
      destinationPolicies,
      destinationApprovalConfigured,
      destinationApproved,
      destinationBlocked,
      destinationAction,
      destinationRequiresRedaction
    };
  }

  function evaluateDestinationPolicy(policyOrSummary, url) {
    const state = getDestinationPolicyInputs(policyOrSummary, url);
    let reason = null;
    let message = "";
    let blocked = false;
    let requiresRedaction = false;

    if (state.enterpriseMode && state.strictFailure) {
      reason = "policy_fail_closed";
      blocked = true;
      message = "LeakGuard blocked this action because enterprise policy could not be loaded safely.";
    } else if (state.destinationPoliciesConfigured) {
      if (state.destinationAction === "block") {
        blocked = true;
        reason = state.matchedDestinationPolicy ? "destination_blocked" : "destination_not_approved";
        message = "LeakGuard blocked this action because this destination is not approved by enterprise policy.";
      } else if (state.destinationAction === "redact") {
        requiresRedaction = true;
        reason = "destination_requires_redaction";
        message = "LeakGuard redacted this action because this destination requires redaction by enterprise policy.";
      }
    } else if (state.destinationBlocked) {
      blocked = true;
      reason = "destination_blocked";
      message = "LeakGuard blocked this action because this destination is not approved by enterprise policy.";
    } else if (
      state.enterpriseMode &&
      state.destinationApprovalConfigured &&
      !state.destinationApproved
    ) {
      blocked = true;
      reason = "destination_not_approved";
      message = "LeakGuard blocked this action because this destination is not approved by enterprise policy.";
    }

    return {
      ...state,
      allowed: !blocked,
      blocked,
      requiresRedaction,
      reason,
      message
    };
  }

  function shouldBlockDestination(policyOrSummary, url) {
    return evaluateDestinationPolicy(policyOrSummary, url).blocked;
  }

  function summarizePolicy(policy, url, meta = {}) {
    const targetUrl = String(url || "");
    const isHttp = /^http:\/\//i.test(targetUrl);
    const destinationPolicy = evaluateDestinationPolicy(policy, targetUrl);

    return {
      enterpriseMode: Boolean(policy.enterpriseMode),
      allowReveal: Boolean(policy.allowReveal),
      allowUserOverride: Boolean(policy.allowUserOverride),
      allowUserAddedSites: Boolean(policy.allowUserAddedSites),
      allowSiteRemoval: Boolean(policy.allowSiteRemoval),
      blockHttpSecrets: Boolean(policy.blockHttpSecrets),
      redactHttpAggressively: Boolean(policy.redactHttpAggressively),
      aiAssistEnabled: Boolean(policy.aiAssistEnabled),
      defaultAction: policy.defaultAction,
      defaultDestinationAction: policy.defaultDestinationAction,
      managedProtectedSites: Array.isArray(policy.managedProtectedSites)
        ? [...policy.managedProtectedSites]
        : [],
      auditMode: policy.auditMode,
      strictPolicyLoad: Boolean(policy.strictPolicyLoad),
      destinationPoliciesConfigured: destinationPolicy.destinationPoliciesConfigured,
      destinationAction: destinationPolicy.destinationAction,
      destinationRequiresRedaction: destinationPolicy.destinationRequiresRedaction,
      destinationPolicies: destinationPolicy.destinationPolicies,
      matchedDestinationPolicy: destinationPolicy.matchedDestinationPolicy,
      destinationApprovalConfigured: destinationPolicy.destinationApprovalConfigured,
      destinationApproved: destinationPolicy.destinationApproved,
      destinationBlocked: destinationPolicy.destinationBlocked,
      http: isHttp,
      managedAvailable: Boolean(meta.managedAvailable),
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
  root.PWM.evaluateDestinationPolicy = evaluateDestinationPolicy;
  root.PWM.shouldBlockDestination = shouldBlockDestination;
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
      evaluateDestinationPolicy,
      shouldBlockDestination,
      summarizePolicy,
      normalizePolicyInput,
      buildFailClosedPolicy
    };
  }
})();
