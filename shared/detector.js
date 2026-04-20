(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  const {
    PATTERNS,
    KEYWORDS,
    NEGATIVE_CONTEXT_WORDS,
    ASSIGNMENT_REGEX,
    CLEAN_PLACEHOLDER_REGEX,
    CONTAINS_PLACEHOLDER_REGEX,
    SUPPRESSED_VALUE_REGEX,
    EXAMPLE_VALUE_MARKERS,
    EXAMPLE_HOSTS,
    PLACEHOLDER_TYPE_MAP,
    calculateEntropy,
    looksStructuredLikeSecret,
    countClassVariety
  } = root.PWM;

  function cloneRegex(re) {
    return new RegExp(re.source, re.flags);
  }

  function stripWrappingQuotes(value) {
    if (!value || value.length < 2) return value;

    const first = value[0];
    const last = value[value.length - 1];

    if (
      (first === '"' && last === '"') ||
      (first === "'" && last === "'") ||
      (first === "`" && last === "`")
    ) {
      return value.slice(1, -1);
    }

    return value;
  }

  function normalizeCandidate(value) {
    return stripWrappingQuotes(String(value || "")).trim();
  }

  function inferPlaceholderTypeFromKey(key) {
    const value = String(key || "").toLowerCase();

    if (
      /\b(?:database|db|mysql|postgres(?:ql)?|mariadb|mongodb|mongo|redis|amqp|rabbitmq|mssql|sqlserver)[_-]?(?:url|uri)\b/.test(
        value
      )
    ) {
      return "DB_URI";
    }
    if (
      value === "azurewebjobsstorage" ||
      value.includes("connection_string") ||
      value.includes("connectionstring") ||
      value.includes("conn_string")
    ) {
      return "CONNECTION_STRING";
    }
    if (value.includes("aws_secret_access_key")) return "AWS_SECRET_KEY";
    if (value.includes("private_key") || value.includes("private-key")) return "PRIVATE_KEY";
    if (value.includes("password") || value.endsWith("pwd") || value.includes("passwd")) {
      return "PASSWORD";
    }
    if (value.includes("webhook")) return "WEBHOOK";
    if (value.includes("cookie") || value.includes("session")) return "TOKEN";
    if (value.includes("token") || value.includes("auth")) return "TOKEN";
    if (value.includes("access_key") || value.includes("access-key")) return "AWS_KEY";
    if (value.includes("api") && value.includes("key")) return "API_KEY";
    if (value.includes("connection")) return "CONNECTION_STRING";
    if (value.includes("secret")) return "SECRET";

    return "SECRET";
  }

  function severityFromScore(score, thresholds) {
    if (score >= thresholds.high) return "high";
    if (score >= thresholds.medium) return "medium";
    return "low";
  }

  function getContextWindow(text, start, end, radius = 64) {
    const left = Math.max(0, start - radius);
    const right = Math.min(text.length, end + radius);
    return text.slice(left, right).toLowerCase();
  }

  function contextScore(text, start, end) {
    const windowText = getContextWindow(text, start, end);
    let score = 0;

    for (const keyword of KEYWORDS) {
      if (windowText.includes(keyword)) score += 6;
    }

    for (const keyword of NEGATIVE_CONTEXT_WORDS) {
      if (windowText.includes(keyword)) score -= 14;
    }

    if (/\bauthorization\b/.test(windowText) && /\bbearer\b/.test(windowText)) {
      score += 8;
    }

    if (/\b(?:env|environment|credential|secret|token|password)\b/.test(windowText)) {
      score += 5;
    }

    return Math.max(-36, Math.min(24, score));
  }

  function likelyTemplateValue(value) {
    return SUPPRESSED_VALUE_REGEX.some((regex) => regex.test(value));
  }

  function isCleanPlaceholder(value) {
    return CLEAN_PLACEHOLDER_REGEX.test(String(value || "").trim());
  }

  function containsPlaceholder(value) {
    return CONTAINS_PLACEHOLDER_REGEX.test(String(value || ""));
  }

  function looksExampleLike(value) {
    const normalized = String(value || "").toLowerCase();
    return EXAMPLE_VALUE_MARKERS.some(
      (marker) =>
        normalized.startsWith(marker) ||
        normalized.includes(`/${marker}`) ||
        normalized.includes(`${marker}.`) ||
        normalized.includes(`-${marker}`) ||
        normalized.includes(`${marker}-`) ||
        normalized.includes(`_${marker}`) ||
        normalized.includes(`${marker}_`)
    );
  }

  function hasExampleHost(value) {
    try {
      const parsed = new URL(value);
      return EXAMPLE_HOSTS.has(parsed.hostname.toLowerCase());
    } catch {
      return false;
    }
  }

  function isDbUriWithCredentials(value) {
    return /:\/\/[^\/\s:@]+:[^@\s]+@/.test(value);
  }

  function assignmentKeyScoreBoost(key, value) {
    const normalizedKey = String(key || "").toLowerCase();
    const normalizedValue = String(value || "");
    let score = 0;

    if (/^[A-Z0-9_]+$/.test(key || "")) score += 4;
    if (/session(?:_id|_secret)?|cookie|token|secret|private[_-]?key|account[_-]?key/.test(normalizedKey)) {
      score += 8;
    }
    if (/webhook/.test(normalizedKey)) score += 10;
    if (/azure|storage/.test(normalizedKey)) score += 8;
    if (/stripe/.test(normalizedKey) && /^sk_(?:live|test)_/.test(normalizedValue)) score += 12;
    if (/npm/.test(normalizedKey) && /^npm_[A-Za-z0-9]{36}$/.test(normalizedValue)) score += 12;
    if (/account[_-]?key/.test(normalizedKey) && /^[A-Za-z0-9+/]{40,}={0,2}$/.test(normalizedValue)) {
      score += 10;
    }

    return score;
  }

  function normalizeAssignmentKey(key) {
    return String(key || "").toLowerCase().replace(/[.-]/g, "_");
  }

  function isDbUriAssignmentKey(key) {
    const normalized = normalizeAssignmentKey(key);
    return /\b(?:database|db|mysql|postgres(?:ql)?|mariadb|mongodb|mongo|redis|amqp|rabbitmq|mssql|sqlserver)_(?:url|uri)\b/.test(
      normalized
    );
  }

  function isConnectionStringAssignmentKey(key) {
    const normalized = normalizeAssignmentKey(key);
    return (
      normalized === "azurewebjobsstorage" ||
      normalized.includes("connection_string") ||
      normalized.includes("connectionstring") ||
      normalized.includes("conn_string")
    );
  }

  function extractDbUriAssignmentValue(value) {
    const match = /^(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis|amqp|mssql):\/\/[^\s'"`<>]+/i.exec(
      String(value || "")
    );

    return match ? match[0] : "";
  }

  function extractConnectionStringAssignmentValue(value) {
    const input = String(value || "");
    const patterns = [
      /^DefaultEndpointsProtocol=https;AccountName=[^;\r\n]+;AccountKey=[^;\r\n]+;EndpointSuffix=[^\s;]+/i,
      /^Endpoint=sb:\/\/[^\s;]+;SharedAccessKeyName=[^;\s]+;SharedAccessKey=[^;\s]+(?:;EntityPath=[^;\s]+)?/i,
      /^[^=\s;]+=[^;\r\n]+(?:;[^=\s;]+=[^;\r\n]+){2,}/
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(input);
      if (match) {
        return match[0];
      }
    }

    return "";
  }

  function shouldSuppressStructuredAssignment(raw) {
    const normalized = String(raw || "").toLowerCase();

    if (!normalized) return true;
    if (hasExampleHost(raw)) return true;

    return ["example", "replace_me", "replace-me", "changeme", "placeholder"].some((marker) =>
      normalized.includes(marker)
    );
  }

  function extractPatternValue(match, pattern) {
    if (!pattern.captureGroups || !pattern.captureGroups.length) {
      return {
        raw: match[0],
        offset: 0
      };
    }

    for (const groupIndex of pattern.captureGroups) {
      const candidate = match[groupIndex];
      if (!candidate) continue;

      const offset = match[0].indexOf(candidate);
      return {
        raw: candidate,
        offset: offset >= 0 ? offset : 0
      };
    }

    return {
      raw: match[0],
      offset: 0
    };
  }

  class Detector {
    constructor(options = {}) {
      this.thresholds = {
        high: 80,
        medium: 55,
        ...options.thresholds
      };

      this.allowlistExact = new Set();
      this.allowlistRegex = [];
      this._seq = 0;

      const combinedAllowlist = []
        .concat(options.allowlist || [])
        .concat(options.allowlistExact || [])
        .filter(Boolean);

      for (const entry of combinedAllowlist) {
        if (entry instanceof RegExp) {
          this.allowlistRegex.push(entry);
        } else {
          this.allowlistExact.add(String(entry));
          this.allowlistExact.add(normalizeCandidate(entry));
        }
      }

      for (const entry of options.allowlistRegex || []) {
        if (entry instanceof RegExp) {
          this.allowlistRegex.push(entry);
        }
      }
    }

    nextId() {
      this._seq += 1;
      return `f_${String(this._seq).padStart(4, "0")}`;
    }

    isAllowlisted(raw) {
      const normalized = normalizeCandidate(raw);
      if (this.allowlistExact.has(raw) || this.allowlistExact.has(normalized)) {
        return true;
      }

      return this.allowlistRegex.some((regex) => regex.test(raw) || regex.test(normalized));
    }

    shouldSuppress({ raw, text, start, end, patternName }) {
      if (!raw) return true;
      if (this.isAllowlisted(raw)) return true;
      if (likelyTemplateValue(raw)) return true;
      if (isCleanPlaceholder(raw)) return true;

      if (looksExampleLike(raw) && patternName !== "aws_access_key") return true;
      if (hasExampleHost(raw)) return true;

      const ctx = contextScore(text, start, end);
      if (ctx <= -14) return true;

      return false;
    }

    buildFinding({
      category,
      placeholderType,
      raw,
      start,
      end,
      score,
      methods
    }) {
      const boundedScore = Math.max(0, Math.min(100, Math.round(score)));

      return {
        id: this.nextId(),
        type: placeholderType,
        category,
        raw,
        start,
        end,
        score: boundedScore,
        severity: severityFromScore(boundedScore, this.thresholds),
        method: methods
      };
    }

    scanPatterns(text) {
      const findings = [];

      for (const pattern of PATTERNS) {
        const regex = cloneRegex(pattern.regex);
        let match;

        while ((match = regex.exec(text)) !== null) {
          const extracted = extractPatternValue(match, pattern);
          const raw = normalizeCandidate(extracted.raw);
          const start = match.index + extracted.offset;
          const end = start + raw.length;

          if (!raw) continue;
          if (this.shouldSuppress({ raw, text, start, end, patternName: pattern.name })) continue;

          let score = pattern.baseScore;
          const entropy = calculateEntropy(raw);
          const ctx = contextScore(text, start, end);

          if (entropy >= 4.0) score += 6;
          if (
            (pattern.name === "db_uri" || pattern.name === "generic_uri_credentials") &&
            isDbUriWithCredentials(raw)
          ) {
            score += 14;
          }

          score += ctx;

          findings.push(
            this.buildFinding({
              category: pattern.category,
              placeholderType: PLACEHOLDER_TYPE_MAP[pattern.name] || pattern.type || "SECRET",
              raw,
              start,
              end,
              score,
              methods: ["pattern", entropy >= 4.0 ? "entropy" : null].filter(Boolean)
            })
          );
        }
      }

      return findings;
    }

    scanStructuredAssignments(text) {
      const findings = [];
      const regex =
        /([A-Za-z_][A-Za-z0-9_.-]{0,80})\s*[:=]\s*(?:"([^"\r\n]+)"|'([^'\r\n]+)'|`([^`\r\n]+)`|([^\r\n]+))/gim;
      let match;

      while ((match = regex.exec(text)) !== null) {
        const key = match[1];
        const rawCandidate = [match[2], match[3], match[4], match[5]].find(
          (candidate) => typeof candidate === "string"
        );

        if (!rawCandidate) continue;

        let raw = "";
        let placeholderType = "";
        let score = 0;

        if (isDbUriAssignmentKey(key)) {
          raw = extractDbUriAssignmentValue(rawCandidate);
          placeholderType = "DB_URI";
          score = 98;
        } else if (isConnectionStringAssignmentKey(key)) {
          raw = extractConnectionStringAssignmentValue(rawCandidate);
          placeholderType = "CONNECTION_STRING";
          score = 99;
        } else {
          continue;
        }

        if (!raw || raw.length < 8) continue;

        const candidateIndex = match[0].indexOf(rawCandidate);
        if (candidateIndex < 0) continue;

        const rawOffset = rawCandidate.indexOf(raw);
        if (rawOffset < 0) continue;

        const start = match.index + candidateIndex + rawOffset;
        const end = start + raw.length;

        if (this.isAllowlisted(raw)) continue;
        if (isCleanPlaceholder(raw)) continue;
        if (containsPlaceholder(raw) && !isCleanPlaceholder(raw)) {
          findings.push(
            this.buildFinding({
              category: "connection_string",
              placeholderType,
              raw,
              start,
              end,
              score: 100,
              methods: ["assignment", "full-value", "placeholder-composite"]
            })
          );
          continue;
        }
        if (shouldSuppressStructuredAssignment(raw)) continue;

        const entropy = calculateEntropy(raw);
        const ctx = contextScore(text, start, end);

        findings.push(
          this.buildFinding({
            category: "connection_string",
            placeholderType,
            raw,
            start,
            end,
            score: score + (entropy >= 3.8 ? 2 : 0) + Math.max(0, ctx),
            methods: ["assignment", "full-value", entropy >= 3.8 ? "entropy" : null].filter(
              Boolean
            )
          })
        );
      }

      return findings;
    }

    scanAssignments(text) {
      const findings = [];
      const regex = cloneRegex(ASSIGNMENT_REGEX);
      let match;

      while ((match = regex.exec(text)) !== null) {
        const full = match[0];
        const key = match[1];
        const token = match[2];
        const normalized = normalizeCandidate(token);
        const placeholderType = inferPlaceholderTypeFromKey(key);
        const normalizedKey = String(key || "").toLowerCase();

        if (!normalized || normalized.length < 8) continue;

        const valueIndex = full.indexOf(token);
        if (valueIndex < 0) continue;

        const start = match.index + valueIndex;
        const end = start + token.length;

        if (isCleanPlaceholder(normalized)) continue;

        if (containsPlaceholder(normalized) && !isCleanPlaceholder(normalized)) {
          findings.push(
            this.buildFinding({
              category: "credential",
              placeholderType,
              raw: normalized,
              start,
              end,
              score: 98,
              methods: ["assignment", "placeholder-composite"]
            })
          );
          continue;
        }

        if (this.shouldSuppress({ raw: normalized, text, start, end })) continue;

        let score = 60;
        const entropy = calculateEntropy(normalized);
        const variety = countClassVariety(normalized);
        const ctx = contextScore(text, start, end);

        if (
          placeholderType === "TOKEN" &&
          /cookie|session|auth|token/.test(normalizedKey) &&
          normalized.length < 16 &&
          !looksStructuredLikeSecret(normalized) &&
          !/^[A-Za-z0-9%._~-]{16,}$/.test(normalized)
        ) {
          continue;
        }

        if (entropy >= 3.8) score += 10;
        if (variety >= 3) score += 8;
        if (normalized.length >= 20) score += 8;
        if (/^[A-Za-z0-9+/_=-]{20,}$/.test(normalized)) score += 6;
        if (placeholderType === "PASSWORD") score += 6;
        if (placeholderType === "AWS_SECRET_KEY") score += 20;
        if (placeholderType === "API_KEY" && /\bsk-/.test(normalized)) score += 10;
        score += assignmentKeyScoreBoost(key, normalized);

        score += ctx;

        findings.push(
          this.buildFinding({
            category: "credential",
            placeholderType,
            raw: normalized,
            start,
            end,
            score,
            methods: ["assignment", entropy >= 3.8 ? "entropy" : null].filter(Boolean)
          })
        );
      }

      return findings;
    }

    scanEntropyFallback(text) {
      const findings = [];
      const regex = /\b[A-Za-z0-9+/_-]{16,}={0,2}\b/g;
      let match;

      while ((match = regex.exec(text)) !== null) {
        const raw = match[0];
        const start = match.index;
        const end = start + raw.length;

        if (/^[A-Z]{2,10}[a-z]+$/.test(raw)) continue;
        if (/^(https?|wss?):\/\//i.test(raw)) continue;
        if (/^\d+$/.test(raw)) continue;
        if (this.shouldSuppress({ raw, text, start, end })) continue;

        const entropy = calculateEntropy(raw);
        const variety = countClassVariety(raw);
        const ctx = contextScore(text, start, end);
        let score = 0;

        if (raw.length >= 20) score += 12;
        if (entropy >= 4.1) score += 24;
        if (entropy >= 4.5) score += 10;
        if (variety >= 3) score += 10;
        if (looksStructuredLikeSecret(raw)) score += 12;
        score += ctx;

        if (score < this.thresholds.medium) continue;

        findings.push(
          this.buildFinding({
            category: "credential",
            placeholderType: "SECRET",
            raw,
            start,
            end,
            score,
            methods: ["entropy", "heuristic"]
          })
        );
      }

      return findings;
    }

    dedupe(findings) {
      const seen = new Map();

      for (const finding of findings) {
        const key = `${finding.start}:${finding.end}:${finding.raw}`;
        const existing = seen.get(key);

        if (
          !existing ||
          finding.score > existing.score ||
          (finding.score === existing.score &&
            (finding.method?.length || 0) > (existing.method?.length || 0))
        ) {
          seen.set(key, finding);
        }
      }

      return [...seen.values()];
    }

    resolveOverlaps(findings) {
      const sorted = [...findings].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;

        const aHasFullValue = a.method?.includes("full-value") ? 1 : 0;
        const bHasFullValue = b.method?.includes("full-value") ? 1 : 0;
        if (bHasFullValue !== aHasFullValue) return bHasFullValue - aHasFullValue;

        const lenA = a.end - a.start;
        const lenB = b.end - b.start;

        if (lenB !== lenA) return lenB - lenA;
        return a.start - b.start;
      });

      const chosen = [];

      for (const candidate of sorted) {
        const overlaps = chosen.some(
          (picked) => candidate.start < picked.end && candidate.end > picked.start
        );

        if (!overlaps) {
          chosen.push(candidate);
        }
      }

      return chosen.sort((a, b) => a.start - b.start);
    }

    scan(text) {
      this._seq = 0;

      const input = String(text || "");
      if (!input.trim()) return [];

      const findings = [
        ...this.scanStructuredAssignments(input),
        ...this.scanPatterns(input),
        ...this.scanAssignments(input),
        ...this.scanEntropyFallback(input)
      ];

      return this.resolveOverlaps(this.dedupe(findings));
    }
  }

  root.PWM.Detector = Detector;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = Detector;
  }
})();
