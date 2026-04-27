(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  const {
    calculateEntropy,
    countClassVariety,
    looksStructuredLikeSecret,
    CLEAN_PLACEHOLDER_REGEX
  } = root.PWM;

  const SECRET_CONTEXT_WORDS = [
    "access_key",
    "apikey",
    "api_key",
    "auth",
    "bearer",
    "client_secret",
    "connection_string",
    "credential",
    "passwd",
    "password",
    "private_key",
    "pwd",
    "secret",
    "token"
  ];

  const SAFE_KEYS = new Set([
    "api_version",
    "build_id",
    "commit_sha",
    "debug",
    "environment",
    "image_tag",
    "jira_key",
    "password_hint",
    "region",
    "secret_santa",
    "ticket_id",
    "token_limit",
    "version"
  ]);

  function normalizeKey(key) {
    return String(key || "").trim().toLowerCase().replace(/[\s.-]+/g, "_");
  }

  function normalizeRange(range) {
    const source = range?.range || range || {};
    const start = Number(source.start);
    const end = Number(source.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    return { start, end };
  }

  function overlapsAnyRange(candidate, ranges) {
    const start = Number(candidate?.start);
    const end = Number(candidate?.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return false;

    return (ranges || []).some((range) => {
      const normalized = normalizeRange(range);
      return normalized ? start < normalized.end && end > normalized.start : false;
    });
  }

  function isCleanPlaceholder(value) {
    const input = String(value || "").trim();
    if (CLEAN_PLACEHOLDER_REGEX?.test) return CLEAN_PLACEHOLDER_REGEX.test(input);
    return /^\[PWM_\d+\]$/.test(input);
  }

  function isRegionLike(value) {
    return /^(?:[a-z]{2}|us-gov|global|cn)(?:-[a-z0-9]+){1,4}$/i.test(String(value || "").trim());
  }

  function isSafeValue(value) {
    const input = String(value || "").trim();
    if (!input) return true;
    if (isCleanPlaceholder(input)) return true;
    if (/^(?:true|false)$/i.test(input)) return true;
    if (/^\d+$/.test(input)) return true;
    if (/^v?\d+\.\d+\.\d+(?:[-+][A-Za-z0-9._-]+)?$/i.test(input)) return true;
    if (isRegionLike(input)) return true;
    return false;
  }

  function contextWindow(text, start, end, ranges = [], radius = 48) {
    const input = String(text || "");
    const lineStart = input.lastIndexOf("\n", Math.max(0, Number(start) - 1)) + 1;
    const nextLine = input.indexOf("\n", Math.max(0, Number(end)));
    const lineEnd = nextLine >= 0 ? nextLine : input.length;
    const left = Math.max(lineStart, Number(start) - radius);
    const right = Math.min(lineEnd, Number(end) + radius);
    let output = input.slice(left, right);
    const sorted = (ranges || [])
      .map(normalizeRange)
      .filter(Boolean)
      .map((range) => ({
        start: Math.max(left, range.start) - left,
        end: Math.min(right, range.end) - left
      }))
      .filter((range) => range.start < range.end)
      .sort((a, b) => b.start - a.start);

    for (const range of sorted) {
      output = output.slice(0, range.start) + output.slice(range.end);
    }

    return output;
  }

  function candidateThreshold(policyMode) {
    return policyMode === "enterprise" || policyMode === "strict" ? 40 : 60;
  }

  function hasKeyword(text, words) {
    const normalized = String(text || "").toLowerCase();
    return words.some((word) => {
      const pattern = word.replace(/_/g, "[_\\s-]?");
      return new RegExp(`(?:^|[^a-z0-9])${pattern}(?:$|[^a-z0-9])`, "i").test(normalized);
    });
  }

  function scoreAiCandidate(candidate, context = {}) {
    const value = String(candidate?.value || "");
    const key = normalizeKey(candidate?.key);
    const contextText = String(candidate?.contextText || context.contextText || "");
    const entropy = calculateEntropy ? calculateEntropy(value) : 0;
    const variety = countClassVariety ? countClassVariety(value) : 0;
    let score = 0;

    if (!value || isSafeValue(value)) return 0;
    if (SAFE_KEYS.has(key)) score -= 35;
    if (value.length >= 12) score += 12;
    if (value.length >= 20) score += 10;
    if (entropy >= 3.4) score += 10;
    if (entropy >= 4.0) score += 10;
    if (variety >= 2) score += 8;
    if (variety >= 3) score += 10;
    if (/^[A-Za-z0-9._~+/-]{12,}={0,2}$/.test(value)) score += 8;
    if (/[A-Za-z]/.test(value) && /\d/.test(value)) score += 8;
    if (/[^A-Za-z0-9]/.test(value)) score += 6;
    if (looksStructuredLikeSecret?.(value)) score += 16;
    if (hasKeyword(`${key} ${contextText}`, SECRET_CONTEXT_WORDS)) score += 18;
    if (hasKeyword(`${key} ${contextText}`, [...SAFE_KEYS])) score -= 24;
    if (candidate?.kind === "urlCredential") score += 16;
    if (candidate?.kind === "bare" && !looksStructuredLikeSecret?.(value)) score -= 14;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  function trimValue(raw) {
    return String(raw || "").replace(/^[\s"'`]+|[\s"'`,;]+$/g, "");
  }

  function pushCandidate(output, text, ranges, candidate, options) {
    const value = trimValue(candidate.value);
    const leadingOffset = String(candidate.value || "").indexOf(value);
    const start = candidate.start + Math.max(0, leadingOffset);
    const end = start + value.length;
    const key = normalizeKey(candidate.key);
    const next = {
      ...candidate,
      value,
      start,
      end,
      key: candidate.key,
      contextText: contextWindow(text, start, end, ranges)
    };

    if (!value || value.length < 3) return;
    if (isSafeValue(value)) return;
    if (SAFE_KEYS.has(key)) return;
    if (overlapsAnyRange(next, ranges)) return;

    next.score = scoreAiCandidate(next, { policyMode: options.policyMode });
    if (next.score < candidateThreshold(options.policyMode)) return;
    output.push(next);
  }

  function extractAiCandidates(text, options = {}) {
    const input = String(text || "");
    const ranges = options.ranges || options.deterministicRanges || options.findings || [];
    const output = [];
    let match;

    const quotedJson = /"([^"\r\n]{1,80})"\s*:\s*"([^"\r\n]{3,256})"/g;
    while ((match = quotedJson.exec(input)) !== null) {
      const valueStart = match.index + match[0].lastIndexOf(match[2]);
      pushCandidate(output, input, ranges, {
        value: match[2],
        start: valueStart,
        end: valueStart + match[2].length,
        key: match[1],
        kind: "json"
      }, options);
    }

    const assignment = /\b([A-Za-z_][A-Za-z0-9_.-]{1,80})\s*=\s*("[^"\r\n]*"|'[^'\r\n]*'|`[^`\r\n]*`|[^\s,;]+)/g;
    while ((match = assignment.exec(input)) !== null) {
      const rawValue = match[2];
      const valueStart = match.index + match[0].lastIndexOf(rawValue);
      pushCandidate(output, input, ranges, {
        value: rawValue,
        start: valueStart,
        end: valueStart + rawValue.length,
        key: match[1],
        kind: "assignment"
      }, options);
    }

    const colon = /\b([A-Za-z_][A-Za-z0-9_.-]{1,80})\s*:\s*("[^"\r\n]*"|'[^'\r\n]*'|`[^`\r\n]*`|[^\s,;]+)/g;
    while ((match = colon.exec(input)) !== null) {
      const rawValue = match[2];
      const valueStart = match.index + match[0].lastIndexOf(rawValue);
      pushCandidate(output, input, ranges, {
        value: rawValue,
        start: valueStart,
        end: valueStart + rawValue.length,
        key: match[1],
        kind: "colon"
      }, options);
    }

    const urlCredential = /\b[a-z][a-z0-9+.-]*:\/\/[^\/\s:@'"`<>]+:([^@\s'"`<>]+)@[^\s'"`<>]+/gi;
    while ((match = urlCredential.exec(input)) !== null) {
      const valueStart = match.index + match[0].indexOf(match[1]);
      pushCandidate(output, input, ranges, {
        value: match[1],
        start: valueStart,
        end: valueStart + match[1].length,
        kind: "urlCredential"
      }, options);
    }

    const bare = /\b[A-Za-z0-9._~+/-]{12,}={0,2}\b/g;
    while ((match = bare.exec(input)) !== null) {
      pushCandidate(output, input, ranges, {
        value: match[0],
        start: match.index,
        end: match.index + match[0].length,
        kind: "bare"
      }, options);
    }

    const seen = new Set();
    return output.filter((candidate) => {
      const key = `${candidate.start}:${candidate.end}:${candidate.value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  root.PWM.scoreAiCandidate = scoreAiCandidate;
  root.PWM.extractAiCandidates = extractAiCandidates;
  root.PWM.overlapsAnyAiCandidateRange = overlapsAnyRange;
  root.PWM.AiCandidateGate = { scoreAiCandidate, extractAiCandidates, overlapsAnyRange };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { scoreAiCandidate, extractAiCandidates, overlapsAnyRange };
  }
})();
