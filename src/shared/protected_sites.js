(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  const USER_PROTECTED_SITES_STORAGE_KEY = "pwm:userProtectedSites";
  const BUILTIN_PROTECTED_SITE_DEFS = [
    { label: "ChatGPT", input: "https://chatgpt.com" },
    { label: "OpenAI Chat", input: "https://chat.openai.com" },
    { label: "Gemini", input: "https://gemini.google.com" },
    { label: "Claude", input: "https://claude.ai" },
    { label: "Grok", input: "https://grok.com" },
    { label: "X", input: "https://x.com" }
  ];

  function trimHostname(hostname) {
    return String(hostname || "")
      .trim()
      .toLowerCase()
      .replace(/\.+$/g, "");
  }

  function isIpv4Host(hostname) {
    if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) {
      return false;
    }

    return hostname.split(".").every((part) => Number(part) >= 0 && Number(part) <= 255);
  }

  function isValidHostnameLabel(label) {
    return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label);
  }

  function isSafeHostname(hostname) {
    const normalized = trimHostname(hostname);
    if (!normalized) return false;
    if (normalized === "localhost") return true;
    if (isIpv4Host(normalized)) return true;

    const labels = normalized.split(".");
    if (!labels.length || labels.some((label) => !isValidHostnameLabel(label))) {
      return false;
    }

    return normalized.length <= 253;
  }

  function hasExplicitScheme(value) {
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(String(value || ""));
  }

  function coerceUrlInput(input) {
    const trimmed = String(input || "").trim();
    if (!trimmed) return trimmed;
    if (trimmed.startsWith("//")) return `https:${trimmed}`;
    if (hasExplicitScheme(trimmed)) return trimmed;
    return `https://${trimmed}`;
  }

  function buildRule(protocol, hostname) {
    const normalizedProtocol = protocol === "http:" ? "http:" : "https:";
    const normalizedHostname = trimHostname(hostname);
    const origin = `${normalizedProtocol}//${normalizedHostname}`;

    return {
      id: origin,
      protocol: normalizedProtocol,
      hostname: normalizedHostname,
      origin,
      matchPattern: `${origin}/*`,
      label: origin,
      enabled: true
    };
  }

  function normalizeProtectedSiteInput(input) {
    const raw = String(input || "").trim();

    if (!raw) {
      return {
        ok: false,
        error: "Enter a site URL or origin."
      };
    }

    if (raw.includes("*")) {
      return {
        ok: false,
        error: "Wildcards are not supported. Add one exact site at a time."
      };
    }

    if (/\s/.test(raw)) {
      return {
        ok: false,
        error: "Spaces are not allowed in protected site rules."
      };
    }

    let parsed;
    try {
      parsed = new URL(coerceUrlInput(raw));
    } catch {
      return {
        ok: false,
        error: "Enter a valid site URL or origin."
      };
    }

    if (parsed.username || parsed.password) {
      return {
        ok: false,
        error: "URLs with embedded credentials are not supported."
      };
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return {
        ok: false,
        error: "Only http:// and https:// sites are supported."
      };
    }

    const hostname = trimHostname(parsed.hostname);
    if (!isSafeHostname(hostname)) {
      return {
        ok: false,
        error: "Enter a valid hostname."
      };
    }

    return {
      ok: true,
      rule: buildRule(parsed.protocol, hostname)
    };
  }

  function normalizeStoredProtectedSite(rule) {
    if (!rule || typeof rule !== "object") return null;

    const candidate =
      rule.origin ||
      rule.matchPattern ||
      (rule.protocol && rule.hostname ? `${rule.protocol}//${rule.hostname}` : rule.id || "");
    const normalized = normalizeProtectedSiteInput(candidate);

    if (!normalized.ok) return null;

    return {
      ...normalized.rule,
      enabled: rule.enabled !== false,
      createdAt: Number.isFinite(rule.createdAt) ? rule.createdAt : null
    };
  }

  function sortProtectedSites(rules) {
    return [...(rules || [])].sort((left, right) => {
      if (left.hostname !== right.hostname) {
        return String(left.hostname).localeCompare(String(right.hostname));
      }

      return String(left.protocol).localeCompare(String(right.protocol));
    });
  }

  function normalizeProtectedSiteList(rules) {
    const deduped = new Map();

    for (const rule of rules || []) {
      const normalized = normalizeStoredProtectedSite(rule);
      if (!normalized) continue;
      deduped.set(normalized.id, normalized);
    }

    return sortProtectedSites([...deduped.values()]);
  }

  function createBuiltinProtectedSites() {
    return Object.freeze(
      BUILTIN_PROTECTED_SITE_DEFS.map((entry) => {
        const normalized = normalizeProtectedSiteInput(entry.input);
        const rule = normalized.ok ? normalized.rule : buildRule("https:", "invalid.local");

        return Object.freeze({
          ...rule,
          label: entry.label,
          builtin: true,
          enabled: true
        });
      })
    );
  }

  const BUILTIN_PROTECTED_SITES = createBuiltinProtectedSites();

  function isBuiltinProtectedSiteRule(rule) {
    return BUILTIN_PROTECTED_SITES.some((entry) => entry.id === rule?.id);
  }

  function getProtectedSiteStatus(url, userRules = []) {
    const normalized = normalizeProtectedSiteInput(url);
    if (!normalized.ok) {
      return {
        eligible: false,
        protected: false,
        source: null,
        rule: null,
        error: normalized.error
      };
    }

    const targetRule = normalized.rule;
    const builtinRule = BUILTIN_PROTECTED_SITES.find((entry) => entry.id === targetRule.id);
    if (builtinRule) {
      return {
        eligible: true,
        protected: true,
        source: "builtin",
        rule: builtinRule
      };
    }

    const userRule = normalizeProtectedSiteList(userRules).find(
      (entry) => entry.id === targetRule.id && entry.enabled
    );
    if (userRule) {
      return {
        eligible: true,
        protected: true,
        source: "user",
        rule: userRule
      };
    }

    return {
      eligible: true,
      protected: false,
      source: null,
      rule: targetRule
    };
  }

  root.PWM.USER_PROTECTED_SITES_STORAGE_KEY = USER_PROTECTED_SITES_STORAGE_KEY;
  root.PWM.BUILTIN_PROTECTED_SITES = BUILTIN_PROTECTED_SITES;
  root.PWM.isSafeHostname = isSafeHostname;
  root.PWM.normalizeProtectedSiteInput = normalizeProtectedSiteInput;
  root.PWM.normalizeStoredProtectedSite = normalizeStoredProtectedSite;
  root.PWM.normalizeProtectedSiteList = normalizeProtectedSiteList;
  root.PWM.sortProtectedSites = sortProtectedSites;
  root.PWM.isBuiltinProtectedSiteRule = isBuiltinProtectedSiteRule;
  root.PWM.getProtectedSiteStatus = getProtectedSiteStatus;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      USER_PROTECTED_SITES_STORAGE_KEY,
      BUILTIN_PROTECTED_SITES,
      isSafeHostname,
      normalizeProtectedSiteInput,
      normalizeStoredProtectedSite,
      normalizeProtectedSiteList,
      sortProtectedSites,
      isBuiltinProtectedSiteRule,
      getProtectedSiteStatus
    };
  }
})();
