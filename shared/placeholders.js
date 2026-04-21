(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  const PWM_PLACEHOLDER_REGEX = /\[PWM_\d+\]/g;
  const NETWORK_PLACEHOLDER_REGEX =
    /\[(?:NET_\d+(?:_SUB_\d+)*(?:_(?:HOST_\d+|GW|VIP|DNS))?|PUB_HOST_\d+(?:_(?:GW|VIP|DNS))?)\]/g;
  const PLACEHOLDER_TOKEN_REGEX =
    /\[(?:PWM_\d+|NET_\d+(?:_SUB_\d+)*(?:_(?:HOST_\d+|GW|VIP|DNS))?|PUB_HOST_\d+(?:_(?:GW|VIP|DNS))?)\]/g;
  const PWM_PLACEHOLDER_EXACT_REGEX = /^\[PWM_(\d+)\]$/;
  const NETWORK_PLACEHOLDER_EXACT_REGEX =
    /^\[(NET_\d+(?:_SUB_\d+)*(?:_(?:HOST_\d+|GW|VIP|DNS))?|PUB_HOST_\d+(?:_(?:GW|VIP|DNS))?)\]$/;
  const LEGACY_TYPED_PLACEHOLDER_REGEX = /\[(?!PWM_)[A-Z][A-Z0-9_]*_\d+\]/g;
  const LEGACY_TYPED_PLACEHOLDER_EXACT_REGEX = /^\[(?!PWM_)[A-Z][A-Z0-9_]*_\d+\]$/;
  const ANY_PLACEHOLDER_TOKEN_REGEX =
    /\[(?:PWM_\d+|NET_\d+(?:_SUB_\d+)*(?:_(?:HOST_\d+|GW|VIP|DNS))?|PUB_HOST_\d+(?:_(?:GW|VIP|DNS))?|[A-Z][A-Z0-9_]*_\d+)\]/g;
  const LEGACY_ALIAS_OFFSET = 1000000;

  function stableHash(value) {
    const input = String(value || "");
    let hash = 2166136261;

    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619) >>> 0;
    }

    return hash;
  }

  function parsePwmIndex(placeholder) {
    const match = PWM_PLACEHOLDER_EXACT_REGEX.exec(String(placeholder || ""));
    return match ? Number(match[1]) : null;
  }

  function parseSemanticSortKey(placeholder) {
    const token = String(placeholder || "");
    const match = NETWORK_PLACEHOLDER_EXACT_REGEX.exec(token);

    if (!match) return null;

    const body = match[1];
    const rootMatch = /^(NET_(\d+)|PUB_HOST_(\d+))/.exec(body);
    if (!rootMatch) return null;

    const familyIndex = Number(rootMatch[2] || rootMatch[3] || 0);
    const subMatches = [...body.matchAll(/_SUB_(\d+)/g)].map((entry) => Number(entry[1]));
    const hostMatch = /_HOST_(\d+)$/.exec(body);
    const roleMatch = /_(GW|VIP|DNS)$/.exec(body);

    return {
      familyType: body.startsWith("NET_") ? 0 : 1,
      familyIndex,
      subMatches,
      hostIndex: hostMatch ? Number(hostMatch[1]) : -1,
      role: roleMatch ? roleMatch[1] : "",
      raw: body
    };
  }

  function compareSemanticKeys(left, right) {
    if (left.familyType !== right.familyType) return left.familyType - right.familyType;
    if (left.familyIndex !== right.familyIndex) return left.familyIndex - right.familyIndex;

    const maxDepth = Math.max(left.subMatches.length, right.subMatches.length);
    for (let index = 0; index < maxDepth; index += 1) {
      const leftValue = left.subMatches[index];
      const rightValue = right.subMatches[index];

      if (leftValue == null && rightValue != null) return -1;
      if (leftValue != null && rightValue == null) return 1;
      if (leftValue !== rightValue) return leftValue - rightValue;
    }

    if (left.hostIndex !== right.hostIndex) return left.hostIndex - right.hostIndex;
    if (left.role !== right.role) return left.role.localeCompare(right.role);

    return left.raw.localeCompare(right.raw);
  }

  function legacyAliasNumber(token) {
    return LEGACY_ALIAS_OFFSET + stableHash(token);
  }

  function isPwmPlaceholder(token) {
    return PWM_PLACEHOLDER_EXACT_REGEX.test(String(token || ""));
  }

  function isSemanticPlaceholder(token) {
    return NETWORK_PLACEHOLDER_EXACT_REGEX.test(String(token || ""));
  }

  function isLegacyTypedPlaceholder(token) {
    return LEGACY_TYPED_PLACEHOLDER_EXACT_REGEX.test(String(token || ""));
  }

  function canonicalizePlaceholderToken(token) {
    const normalized = String(token || "");

    if (isPwmPlaceholder(normalized) || isSemanticPlaceholder(normalized)) {
      return normalized;
    }

    if (isLegacyTypedPlaceholder(normalized)) {
      return `[PWM_${legacyAliasNumber(normalized)}]`;
    }

    return normalized;
  }

  function containsLegacyTypedPlaceholder(text) {
    const input = String(text || "");
    let match;
    const regex = new RegExp(ANY_PLACEHOLDER_TOKEN_REGEX.source, "g");

    while ((match = regex.exec(input)) !== null) {
      if (isLegacyTypedPlaceholder(match[0])) {
        return true;
      }
    }

    return false;
  }

  function normalizeVisiblePlaceholders(text) {
    const input = String(text || "");
    return input.replace(ANY_PLACEHOLDER_TOKEN_REGEX, (token) => canonicalizePlaceholderToken(token));
  }

  function sortPlaceholders(placeholders) {
    return [...new Set((placeholders || []).filter(Boolean).map(canonicalizePlaceholderToken))].sort(
      (left, right) => {
        const leftIndex = parsePwmIndex(left);
        const rightIndex = parsePwmIndex(right);

        if (leftIndex !== null && rightIndex !== null && leftIndex !== rightIndex) {
          return leftIndex - rightIndex;
        }

        if (leftIndex !== null && rightIndex === null) return -1;
        if (leftIndex === null && rightIndex !== null) return 1;

        const leftSemantic = parseSemanticSortKey(left);
        const rightSemantic = parseSemanticSortKey(right);

        if (leftSemantic && rightSemantic) {
          return compareSemanticKeys(leftSemantic, rightSemantic);
        }

        if (leftSemantic && !rightSemantic) return -1;
        if (!leftSemantic && rightSemantic) return 1;

        return String(left).localeCompare(String(right));
      }
    );
  }

  function sessionFingerprint(sessionId, rawValue) {
    const input = `${String(sessionId || "local-session")}\u0000${String(rawValue || "")}`;
    let hashA = 2166136261;
    let hashB = 3335557771;

    for (let index = 0; index < input.length; index += 1) {
      const code = input.charCodeAt(index);

      hashA ^= code;
      hashA = Math.imul(hashA, 16777619) >>> 0;

      hashB ^= code;
      hashB = Math.imul(hashB, 2246822519) >>> 0;
    }

    return `${hashA.toString(16).padStart(8, "0")}${hashB.toString(16).padStart(8, "0")}`;
  }

  class PlaceholderManager {
    constructor() {
      this.reset();
    }

    reset() {
      this.sessionId = null;
      this.counters = { PWM: 0, NET: 0, PUB_HOST: 0 };
      this.placeholderByFingerprint = new Map();
      this.fingerprintByPlaceholder = new Map();
      this.secretByFingerprint = new Map();
      this.knownPlaceholders = new Set();
      this.objectByOriginal = new Map();
      this.objectByPlaceholder = new Map();
    }

    ensureSessionId() {
      if (!this.sessionId) {
        this.sessionId = "local-session";
      }

      return this.sessionId;
    }

    incrementCounter(name) {
      const next = Number(this.counters?.[name] || 0) + 1;
      this.counters[name] = next;
      return next;
    }

    trackKnownPlaceholder(placeholder) {
      const canonical = canonicalizePlaceholderToken(placeholder);
      if (!isPwmPlaceholder(canonical) && !isSemanticPlaceholder(canonical)) {
        return canonical;
      }

      this.knownPlaceholders.add(canonical);

      const index = parsePwmIndex(canonical);
      if (index !== null && index < LEGACY_ALIAS_OFFSET) {
        this.counters.PWM = Math.max(Number(this.counters.PWM || 0), index);
      }

      const semantic = parseSemanticSortKey(canonical);
      if (semantic) {
        if (semantic.familyType === 0) {
          this.counters.NET = Math.max(Number(this.counters.NET || 0), semantic.familyIndex);
        } else {
          this.counters.PUB_HOST = Math.max(
            Number(this.counters.PUB_HOST || 0),
            semantic.familyIndex
          );
        }
      }

      return canonical;
    }

    setPublicState(state = {}) {
      this.reset();
      this.sessionId = state.sessionId || null;
      this.counters = {
        PWM: Number(state?.counters?.PWM || 0),
        NET: Number(state?.counters?.NET || 0),
        PUB_HOST: Number(state?.counters?.PUB_HOST || 0)
      };

      for (const placeholder of state.knownPlaceholders || []) {
        this.trackKnownPlaceholder(placeholder);
      }
    }

    registerStructuredObject(object = {}) {
      const original = String(object.original || "");
      const placeholder = canonicalizePlaceholderToken(object.placeholder || "");

      if (!original || !placeholder) return null;

      const fingerprint = sessionFingerprint(this.ensureSessionId(), original);
      const existingRaw = this.secretByFingerprint.get(fingerprint);
      const existingFingerprint = this.fingerprintByPlaceholder.get(placeholder);

      if (existingFingerprint && existingFingerprint !== fingerprint) {
        return this.objectByPlaceholder.get(placeholder) || null;
      }

      if (existingRaw && existingRaw !== original) {
        return this.objectByOriginal.get(original) || null;
      }

      this.placeholderByFingerprint.set(fingerprint, placeholder);
      this.fingerprintByPlaceholder.set(placeholder, fingerprint);
      this.secretByFingerprint.set(fingerprint, original);
      this.trackKnownPlaceholder(placeholder);

      const normalized = {
        original,
        placeholder,
        kind: object.kind || "secret",
        category: object.category || "network",
        version: Number(object.version || 4),
        prefix: Number.isFinite(object.prefix) ? Number(object.prefix) : null,
        parent: object.parent || null,
        isHost: Boolean(object.isHost),
        public: Boolean(object.public),
        role: object.role || null,
        startInt: Number.isFinite(object.startInt) ? Number(object.startInt) : null,
        endInt: Number.isFinite(object.endInt) ? Number(object.endInt) : null
      };

      this.objectByOriginal.set(original, normalized);
      this.objectByPlaceholder.set(placeholder, normalized);

      return normalized;
    }

    setPrivateState(state = {}) {
      this.reset();
      this.sessionId = state.sessionId || null;
      this.counters = {
        PWM: Number(state?.counters?.PWM || 0),
        NET: Number(state?.counters?.NET || 0),
        PUB_HOST: Number(state?.counters?.PUB_HOST || 0)
      };

      const fingerprintToPlaceholder = Object.entries(state.fingerprintToPlaceholder || {});
      const placeholderToFingerprint = Object.entries(state.placeholderToFingerprint || {});
      const secretByFingerprint = Object.entries(state.secretByFingerprint || {});

      for (const [fingerprint, placeholder] of fingerprintToPlaceholder) {
        const canonical = this.trackKnownPlaceholder(placeholder);
        this.placeholderByFingerprint.set(String(fingerprint), canonical);
      }

      for (const [placeholder, fingerprint] of placeholderToFingerprint) {
        const canonical = this.trackKnownPlaceholder(placeholder);
        this.fingerprintByPlaceholder.set(canonical, String(fingerprint));
      }

      if (!placeholderToFingerprint.length && fingerprintToPlaceholder.length) {
        for (const [fingerprint, placeholder] of this.placeholderByFingerprint.entries()) {
          this.fingerprintByPlaceholder.set(placeholder, fingerprint);
        }
      }

      for (const [fingerprint, raw] of secretByFingerprint) {
        this.secretByFingerprint.set(String(fingerprint), String(raw));
      }

      for (const object of state.objects || []) {
        this.registerStructuredObject(object);
      }
    }

    setState(state = {}) {
      if (
        state.fingerprintToPlaceholder ||
        state.placeholderToFingerprint ||
        state.secretByFingerprint ||
        state.objects
      ) {
        this.setPrivateState(state);
        return;
      }

      this.setPublicState(state);
    }

    exportPublicState() {
      return {
        sessionId: this.sessionId,
        counters: { ...this.counters },
        knownPlaceholders: sortPlaceholders([...this.knownPlaceholders])
      };
    }

    exportPrivateState() {
      return {
        sessionId: this.sessionId,
        counters: { ...this.counters },
        fingerprintToPlaceholder: Object.fromEntries(this.placeholderByFingerprint.entries()),
        placeholderToFingerprint: Object.fromEntries(this.fingerprintByPlaceholder.entries()),
        secretByFingerprint: Object.fromEntries(this.secretByFingerprint.entries()),
        objects: this.getStructuredObjects()
      };
    }

    getPlaceholder(rawValue) {
      const raw = String(rawValue);
      const fingerprint = sessionFingerprint(this.ensureSessionId(), raw);

      if (this.placeholderByFingerprint.has(fingerprint)) {
        return this.placeholderByFingerprint.get(fingerprint);
      }

      const placeholder = `[PWM_${this.incrementCounter("PWM")}]`;

      this.placeholderByFingerprint.set(fingerprint, placeholder);
      this.fingerprintByPlaceholder.set(placeholder, fingerprint);
      this.secretByFingerprint.set(fingerprint, raw);
      this.trackKnownPlaceholder(placeholder);

      return placeholder;
    }

    knowsPlaceholder(placeholder) {
      const canonical = canonicalizePlaceholderToken(placeholder);
      return this.knownPlaceholders.has(canonical) || this.fingerprintByPlaceholder.has(canonical);
    }

    getRaw(placeholder) {
      const canonical = canonicalizePlaceholderToken(placeholder);
      const fingerprint = this.fingerprintByPlaceholder.get(canonical);
      if (!fingerprint) return null;
      return this.secretByFingerprint.get(fingerprint) || null;
    }

    getObjectByOriginal(original) {
      return this.objectByOriginal.get(String(original || "")) || null;
    }

    getObjectByPlaceholder(placeholder) {
      const canonical = canonicalizePlaceholderToken(placeholder);
      return this.objectByPlaceholder.get(canonical) || null;
    }

    getStructuredObjects() {
      return [...this.objectByPlaceholder.values()].sort((left, right) => {
        if (left.version !== right.version) return left.version - right.version;
        if (left.startInt !== right.startInt) return (left.startInt || 0) - (right.startInt || 0);
        if (left.prefix !== right.prefix) return (left.prefix || 0) - (right.prefix || 0);
        return String(left.placeholder).localeCompare(String(right.placeholder));
      });
    }

    rehydrateForTest(text) {
      let output = normalizeVisiblePlaceholders(text);

      for (const [placeholder, fingerprint] of this.fingerprintByPlaceholder.entries()) {
        const raw = this.secretByFingerprint.get(fingerprint);
        if (!raw) continue;
        output = output.split(placeholder).join(raw);
      }

      return output;
    }

    segmentText(text) {
      const input = normalizeVisiblePlaceholders(text);
      const segments = [];
      let lastIndex = 0;
      let match;
      const regex = new RegExp(PLACEHOLDER_TOKEN_REGEX.source, "g");

      while ((match = regex.exec(input)) !== null) {
        const placeholder = match[0];

        if (match.index > lastIndex) {
          segments.push({
            type: "text",
            value: input.slice(lastIndex, match.index)
          });
        }

        const segment = {
          type: "secret",
          placeholder
        };

        const raw = this.getRaw(placeholder);
        if (raw) {
          segment.raw = raw;
        }

        segments.push(segment);
        lastIndex = match.index + placeholder.length;
      }

      if (lastIndex < input.length) {
        segments.push({
          type: "text",
          value: input.slice(lastIndex)
        });
      }

      return segments.length ? segments : [{ type: "text", value: input }];
    }
  }

  root.PWM.PlaceholderManager = PlaceholderManager;
  root.PWM.PWM_PLACEHOLDER_REGEX = PWM_PLACEHOLDER_REGEX;
  root.PWM.NETWORK_PLACEHOLDER_REGEX = NETWORK_PLACEHOLDER_REGEX;
  root.PWM.PLACEHOLDER_TOKEN_REGEX = PLACEHOLDER_TOKEN_REGEX;
  root.PWM.LEGACY_TYPED_PLACEHOLDER_REGEX = LEGACY_TYPED_PLACEHOLDER_REGEX;
  root.PWM.ANY_PLACEHOLDER_TOKEN_REGEX = ANY_PLACEHOLDER_TOKEN_REGEX;
  root.PWM.isPwmPlaceholder = isPwmPlaceholder;
  root.PWM.isSemanticPlaceholder = isSemanticPlaceholder;
  root.PWM.isLegacyTypedPlaceholder = isLegacyTypedPlaceholder;
  root.PWM.canonicalizePlaceholderToken = canonicalizePlaceholderToken;
  root.PWM.normalizeVisiblePlaceholders = normalizeVisiblePlaceholders;
  root.PWM.containsLegacyTypedPlaceholder = containsLegacyTypedPlaceholder;
  root.PWM.sessionFingerprint = sessionFingerprint;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = PlaceholderManager;
    module.exports.PWM_PLACEHOLDER_REGEX = PWM_PLACEHOLDER_REGEX;
    module.exports.NETWORK_PLACEHOLDER_REGEX = NETWORK_PLACEHOLDER_REGEX;
    module.exports.PLACEHOLDER_TOKEN_REGEX = PLACEHOLDER_TOKEN_REGEX;
    module.exports.LEGACY_TYPED_PLACEHOLDER_REGEX = LEGACY_TYPED_PLACEHOLDER_REGEX;
    module.exports.ANY_PLACEHOLDER_TOKEN_REGEX = ANY_PLACEHOLDER_TOKEN_REGEX;
    module.exports.isPwmPlaceholder = isPwmPlaceholder;
    module.exports.isSemanticPlaceholder = isSemanticPlaceholder;
    module.exports.isLegacyTypedPlaceholder = isLegacyTypedPlaceholder;
    module.exports.canonicalizePlaceholderToken = canonicalizePlaceholderToken;
    module.exports.normalizeVisiblePlaceholders = normalizeVisiblePlaceholders;
    module.exports.containsLegacyTypedPlaceholder = containsLegacyTypedPlaceholder;
    module.exports.sessionFingerprint = sessionFingerprint;
  }
})();
