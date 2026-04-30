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

  function escapeRegex(text) {
    return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
    if (value === "openai" || value.includes("openai")) return "API_KEY";
    if (value.includes("webhook") && value.includes("secret")) return "SECRET";
    if (value.includes("webhook")) return "WEBHOOK";
    if (value.includes("jwt")) return "TOKEN";
    if (value.includes("cookie") || value.includes("session")) return "TOKEN";
    if (value.includes("token") || value.includes("auth")) return "TOKEN";
    if (value.includes("secret")) return "SECRET";
    if (value.includes("access_key") || value.includes("access-key")) return "AWS_KEY";
    if (value.includes("api") && value.includes("key")) return "API_KEY";
    if (value.includes("connection")) return "CONNECTION_STRING";

    return "SECRET";
  }

  function severityFromScore(score, thresholds) {
    if (score >= thresholds.high) return "high";
    if (score >= thresholds.medium) return "medium";
    return "low";
  }

  function getContextWindow(text, start, end, radius = 64) {
    const input = String(text || "");
    const lineStart = input.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const nextLineBreak = input.indexOf("\n", Math.max(0, end));
    const lineEnd = nextLineBreak >= 0 ? nextLineBreak : input.length;
    const left = Math.max(lineStart, start - radius);
    const right = Math.min(lineEnd, end + radius);
    const before = input.slice(left, start);
    const after = input.slice(end, right);
    return `${before} ${after}`.toLowerCase();
  }

  function contextScore(text, start, end) {
    const windowText = getContextWindow(text, start, end);
    let score = 0;

    for (const keyword of KEYWORDS) {
      if (new RegExp(`\\b${escapeRegex(keyword)}\\b`, "i").test(windowText)) score += 6;
    }

    for (const keyword of NEGATIVE_CONTEXT_WORDS) {
      if (new RegExp(`\\b${escapeRegex(keyword)}\\b`, "i").test(windowText)) score -= 14;
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
    return EXAMPLE_VALUE_MARKERS.some((marker) => {
      const escaped = escapeRegex(marker);
      return (
        normalized.startsWith(marker) ||
        new RegExp(`(?:^|[._\\-/])${escaped}`, "i").test(normalized)
      );
    });
  }

  function containsTemplateMarker(value) {
    const normalized = String(value || "").toLowerCase();
    if (!normalized) return false;

    if (/^(?:example|sample|dummy)/i.test(normalized)) {
      return true;
    }

    return ["placeholder", "replace_me", "replace-me", "changeme"].some((marker) =>
      normalized.includes(marker)
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

  function hasBroadExampleSegment(value) {
    return /(?:^|[;=:/_.-])(?:example|sample|dummy)(?:[A-Za-z0-9_-]*)?(?=$|[;=:/_.-])/i.test(
      String(value || "")
    );
  }

  function shouldFailClosedDespiteExample(raw, { patternName, key, placeholderType, source } = {}) {
    const normalizedKey = String(key || "").toLowerCase();
    const isAwsSecretAccessKeyAssignment =
      source === "assignment" &&
      /(?:^|[_\-.])aws[_-]?secret[_-]?access[_-]?key$/.test(normalizedKey);
    const isCredentialAssignment =
      source === "assignment" &&
      isSensitiveAssignmentKey(key) &&
      looksCredentialLikeAssignmentValue(raw);

    if (containsTemplateMarker(raw)) {
      if (
        isCredentialAssignment &&
        /placeholder/i.test(String(raw || "")) &&
        !/^(?:placeholder|example|sample|dummy)/i.test(String(raw || "")) &&
        !/(?:^|[._\/-])(?:example|sample|dummy)(?:$|[._\/-])/i.test(String(raw || ""))
      ) {
        return true;
      }
      if (
        isAwsSecretAccessKeyAssignment &&
        /^(?:example|sample|dummy)[A-Z0-9]/.test(String(raw || "")) &&
        /[A-Z]/.test(String(raw || "")) &&
        /\d/.test(String(raw || ""))
      ) {
        return true;
      }
      return false;
    }

    if (
      source === "assignment" &&
      isExplicitSensitiveAssignment(key, placeholderType) &&
      (isExactCredentialAssignmentKey(key) || looksCredentialLikeAssignmentValue(raw))
    ) {
      return true;
    }

    return new Set([
      "openai_api_key",
      "github_token",
      "github_pat",
      "natural_language_api_key",
      "natural_language_openai_key",
      "json_api_key_field",
      "json_password_field",
      "json_token_field",
      "json_client_secret_field",
      "labelled_openai_key_value"
    ]).has(String(patternName || ""));
  }

  function isExplicitSensitiveAssignment(key, placeholderType) {
    const normalizedKey = String(key || "").toLowerCase();

    if (
      /(password|passwd|pwd|secret|api[_-]?key|token|auth|session|cookie|access[_-]?key|private[_-]?key|client[_-]?secret|connection(?:string|_string)?|webhook)/.test(
        normalizedKey
      )
    ) {
      return true;
    }

    return new Set([
      "PASSWORD",
      "API_KEY",
      "TOKEN",
      "SECRET",
      "AWS_KEY",
      "AWS_SECRET_KEY",
      "PRIVATE_KEY",
      "CONNECTION_STRING",
      "DB_URI",
      "WEBHOOK"
    ]).has(String(placeholderType || ""));
  }

  function normalizeAssignmentKey(key) {
    return String(key || "").toLowerCase().replace(/[\s.-]+/g, "_");
  }

  function compactAssignmentKey(key) {
    return normalizeAssignmentKey(key).replace(/_/g, "");
  }

  const SAFE_ASSIGNMENT_KEYS = new Set([
    "api_version",
    "build_id",
    "commit_sha",
    "debug",
    "environment",
    "image_tag",
    "jira_key",
    "max_token_limit",
    "password_hint",
    "public_url",
    "region",
    "release_id",
    "secret_santa",
    "ticket_id",
    "token_limit",
    "trace_id",
    "url",
    "version"
  ]);

  const EXACT_CREDENTIAL_KEYS = new Set([
    "api_key",
    "auth_header",
    "authorization",
    "client_secret",
    "database_url",
    "db_password",
    "mysql_url",
    "redis_url",
    "secret_key",
    "shared_secret",
    "token",
    "webhook_url"
  ]);

  function isSafeAssignmentKey(key) {
    return SAFE_ASSIGNMENT_KEYS.has(normalizeAssignmentKey(key));
  }

  function isExactCredentialAssignmentKey(key) {
    return EXACT_CREDENTIAL_KEYS.has(normalizeAssignmentKey(key));
  }

  function isSensitiveAssignmentKey(key) {
    if (isSafeAssignmentKey(key)) return false;
    if (isExactCredentialAssignmentKey(key)) return true;
    const normalized = normalizeAssignmentKey(key);
    const leet = normalized.replace(/0/g, "o").replace(/3/g, "e").replace(/\$/g, "s").replace(/@/g, "a");
    return /(password|passwd|pwd|secret|api[_\s-]?key|token|auth|authorization|client[_\s-]?secret|shared[_\s-]?secret|webhook)/i.test(
      leet
    );
  }

  function looksCredentialLikeAssignmentValue(value) {
    const raw = String(value || "").trim();
    if (raw.length < 8) return false;
    if (isCleanPlaceholder(raw) || likelyTemplateValue(raw)) return false;
    if (/^(?:true|false|null|undefined|none|yes|no|on|off)$/i.test(raw)) return false;
    if (/^\d+$/.test(raw)) return false;
    if (/^(?:v?\d+\.)+\d+(?:[-+][A-Za-z0-9._-]+)?$/.test(raw)) return false;
    if (isRegionLikeSegment(raw)) return false;

    return (
      /[A-Za-z]/.test(raw) &&
      (/\d/.test(raw) || /[^A-Za-z0-9]/.test(raw) || /(?:secret|token|pass|key|bearer)/i.test(raw))
    );
  }

  function assignmentKeyScoreBoost(key, value) {
    const normalizedKey = String(key || "").toLowerCase();
    const normalizedValue = String(value || "");
    let score = 0;

    if (isExactCredentialAssignmentKey(key)) score += 18;
    if (/^[A-Z0-9_]+$/.test(key || "")) score += 4;
    if (/session(?:_id|_secret)?|cookie|token|secret|private[_-]?key|account[_-]?key/.test(normalizedKey)) {
      score += 8;
    }
    if (/webhook/.test(normalizedKey)) score += 10;
    if (/azure|storage/.test(normalizedKey)) score += 8;
    if (/openai/.test(normalizedKey) && /^sk-/.test(normalizedValue)) score += 12;
    if (/\bjwt\b/.test(normalizedKey) && /^eyJ/.test(normalizedValue)) score += 10;
    if (/stripe/.test(normalizedKey) && /^sk_(?:live|test)_/.test(normalizedValue)) score += 12;
    if (/npm/.test(normalizedKey) && /^npm_[A-Za-z0-9]{36}$/.test(normalizedValue)) score += 12;
    if (/account[_-]?key/.test(normalizedKey) && /^[A-Za-z0-9+/]{40,}={0,2}$/.test(normalizedValue)) {
      score += 10;
    }

    return score;
  }

  function isDbUriAssignmentKey(key) {
    const normalized = normalizeAssignmentKey(key);
    const compact = compactAssignmentKey(key);
    return (
      /\b(?:database|db|mysql|postgres(?:ql)?|mariadb|mongodb|mongo|redis|amqp|rabbitmq|mssql|sqlserver)_(?:url|uri)\b/.test(
        normalized
      ) ||
      /(?:database|db|mysql|postgres(?:ql)?|mariadb|mongodb|mongo|redis|amqp|rabbitmq|mssql|sqlserver)(?:url|uri)\b/.test(
        compact
      )
    );
  }

  function isConnectionStringAssignmentKey(key) {
    const normalized = normalizeAssignmentKey(key);
    const compact = String(key || "").toLowerCase().replace(/[._-]/g, "");
    return (
      normalized === "azurewebjobsstorage" ||
      normalized.includes("connection_string") ||
      normalized.includes("connectionstring") ||
      normalized.includes("conn_string") ||
      compact.includes("connectionstring") ||
      compact.includes("connstring")
    );
  }

  function extractDbUriAssignmentValue(value) {
    const match = /^(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis|amqp|mssql):\/\/[^\s'"`<>{}\[\]]+/i.exec(
      String(value || "")
    );

    return match ? match[0] : "";
  }

  function extractDbUriPasswordSegment(value) {
    const raw = extractDbUriAssignmentValue(value);
    if (!raw) {
      return null;
    }

    try {
      const parsed = new URL(raw);
      const username = parsed.username || "";
      const password = parsed.password || "";

      if (!username || !password) {
        return null;
      }

      const credentialPrefix = `${parsed.protocol}//${username}:`;
      const start = raw.indexOf(credentialPrefix);
      if (start < 0) {
        return null;
      }

      const passwordStart = start + credentialPrefix.length;
      const passwordEnd = raw.indexOf("@", passwordStart);
      if (passwordEnd <= passwordStart) {
        return null;
      }

      const rawPassword = raw.slice(passwordStart, passwordEnd);
      return {
        raw,
        password: rawPassword,
        offset: passwordStart
      };
    } catch {
      return null;
    }
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

  function hasGenericDbCredentials(raw) {
    try {
      const parsed = new URL(String(raw || ""));
      const username = decodeURIComponent(parsed.username || "").toLowerCase();
      const password = decodeURIComponent(parsed.password || "").toLowerCase();

      if (!password) {
        return true;
      }

      if (containsTemplateMarker(password)) return true;
      if (/^(?:password|secret|token|test|demo|example|sample|dummy|fake)$/i.test(password)) {
        return true;
      }
      if (
        /^(?:demo|example|sample|dummy|fake|test|user|username)$/i.test(username) &&
        hasExampleHost(raw)
      ) {
        return true;
      }

      return false;
    } catch {
      return containsTemplateMarker(raw);
    }
  }

  function findEmbeddedAssignmentBoundary(value) {
    const input = String(value || "");
    const regex = /[A-Za-z_][A-Za-z0-9_.-]{1,80}\s*[:=]/g;
    let match;

    while ((match = regex.exec(input)) !== null) {
      if (match.index <= 0) continue;

      const previous = input[match.index - 1];
      if (/[?&/:]/.test(previous)) {
        continue;
      }

      return match.index;
    }

    return -1;
  }

  function truncateEmbeddedAssignmentValue(value) {
    const input = String(value || "");
    const boundary = findEmbeddedAssignmentBoundary(input);
    if (boundary <= 0) return input;
    return input.slice(0, boundary);
  }

  function isRegionLikeSegment(value) {
    return /^(?:[a-z]{2}|us-gov|global|cn)(?:-[a-z0-9]+){1,4}$/i.test(String(value || "").trim());
  }

  function isBenignPlaceholderComposite(value) {
    const input = String(value || "");
    if (!containsPlaceholder(input)) return false;

    const segments = input.split(new RegExp(CONTAINS_PLACEHOLDER_REGEX.source, "g"));
    if (!segments.length) return false;

    return segments.every((segment) => {
      const trimmed = String(segment || "").trim();
      if (!trimmed) return true;
      if (/^[A-Za-z_][A-Za-z0-9_.-]{0,80}\s*[:=]$/.test(trimmed)) return true;
      if (/^https?:\/\/[^\s]+$/i.test(trimmed)) return true;
      if (/^:\/\/[^\s]+$/i.test(trimmed)) return true;
      if (/^\.[A-Za-z0-9._-]+$/.test(trimmed)) return true;
      if (/^\\+$/.test(trimmed)) return true;
      if (isRegionLikeSegment(trimmed)) return true;
      return false;
    });
  }

  function getSinglePlaceholderSuffix(value) {
    const input = String(value || "");
    const regex = new RegExp(`^${CONTAINS_PLACEHOLDER_REGEX.source}([^\\s,;\\]\\)\\}]+)$`);
    const match = regex.exec(input);
    return match ? match[1] : "";
  }

  function isLikelyPlaceholderSuffixSecret(value) {
    const input = String(value || "").trim();
    if (input.length < 8 || input.length > 128) return false;
    if (/\s/.test(input)) return false;
    if (/^[.:/\\]+/.test(input)) return false;
    if (isCleanPlaceholder(input) || containsPlaceholder(input)) return false;
    if (looksExampleLike(input) || containsTemplateMarker(input) || likelyTemplateValue(input)) return false;
    if (/^(?:https?|wss?|ftp|sftp|mailto):/i.test(input)) return false;
    if (/^(?:v?\d+\.)+\d+(?:[-+][A-Za-z0-9._-]+)?$/.test(input)) return false;
    if (isBuildLabelLike(input)) return false;
    if (isRegionLikeSegment(input)) return false;

    const entropy = calculateEntropy(input);
    const variety = countClassVariety(input);
    const hasDigit = /\d/.test(input);
    const hasLetter = /[A-Za-z]/.test(input);
    const hasSymbol = /[^A-Za-z0-9]/.test(input);

    if (/^\d+$/.test(input)) {
      return input.length >= 12 && entropy >= 2.0;
    }

    return entropy >= 3.0 && variety >= 2 && (hasDigit || hasSymbol || hasLetter);
  }

  function scorePlaceholderSuffixSecret(value, text, start, end) {
    const input = String(value || "");
    const entropy = calculateEntropy(input);
    const variety = countClassVariety(input);
    let score = 70;

    if (input.length >= 12) score += 6;
    if (input.length >= 20) score += 6;
    if (/^\d+$/.test(input)) score += 4;
    if (variety >= 2) score += 5;
    if (variety >= 3) score += 5;
    if (entropy >= 3.2) score += 4;
    if (entropy >= 3.8) score += 4;
    score += Math.max(0, contextScore(text, start, end));

    return score;
  }

  function shouldSuppressStructuredAssignment(raw, placeholderType) {
    const normalized = String(raw || "").toLowerCase();

    if (!normalized) return true;

    if (placeholderType === "DB_URI") {
      return hasGenericDbCredentials(raw);
    }

    if (hasExampleHost(raw)) return true;
    if (containsTemplateMarker(raw)) return true;

    return hasBroadExampleSegment(raw);
  }

  function getSurroundingPathToken(text, start, end) {
    const input = String(text || "");
    let left = Math.max(0, start);
    let right = Math.max(left, end);

    while (left > 0 && /[A-Za-z0-9._@%+\-~/\\:]/.test(input[left - 1])) {
      left -= 1;
    }

    while (right < input.length && /[A-Za-z0-9._@%+\-~/\\:]/.test(input[right])) {
      right += 1;
    }

    return input.slice(left, right);
  }

  function looksLikeFilesystemPath(text, start, end, raw) {
    const value = String(raw || "");
    if (!value) return false;

    const token = getSurroundingPathToken(text, start, end) || value;
    if (!token || /:\/\//.test(token)) return false;

    return (
      /^(?:\/|~\/|\.{1,2}\/|[A-Za-z]:[\\/])[A-Za-z0-9._@%+\-~\\/]+$/.test(token) ||
      /^(?:\/)?[A-Za-z0-9._@%+\-~]+(?:\/[A-Za-z0-9._@%+\-~]+){2,}(?:\.[A-Za-z0-9_-]{1,8})?$/.test(
        token
      )
    );
  }

  function looksLikeUnsupportedVendorHexAssignment(key, value) {
    const normalizedKey = String(key || "").toLowerCase();
    const normalizedValue = String(value || "");

    if (!/(twilio|mailchimp)/.test(normalizedKey)) return false;

    return /^(?:[a-f0-9]{24,}|[a-f0-9]{24,}-[a-z0-9]{2,6})$/i.test(normalizedValue);
  }

  function hasUnsupportedVendorHexAssignmentContext(text, start, raw) {
    const input = String(text || "");
    const value = String(raw || "");
    const lineStart = input.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const lineEndIndex = input.indexOf("\n", start);
    const lineEnd = lineEndIndex >= 0 ? lineEndIndex : input.length;
    const line = input.slice(lineStart, lineEnd);
    const beforeRaw = line.slice(0, Math.max(0, start - lineStart));
    const keyMatch = /([A-Za-z_][A-Za-z0-9_.-]{0,80})\s*[:=]\s*$/.exec(beforeRaw);

    if (!keyMatch) return false;

    return looksLikeUnsupportedVendorHexAssignment(keyMatch[1], value);
  }

  function isIdentityAssignmentKey(key) {
    const normalized = normalizeAssignmentKey(key);
    return /(?:^|_)(?:username|user(?:_?name)?|login|email|e_mail|mail)(?:$|_)/.test(normalized);
  }

  function isLikelyEmailAddress(value) {
    return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(String(value || ""));
  }

  function isLikelyUsernameLikeValue(value) {
    return /^(?!\d+$)[A-Za-z0-9._@-]{3,64}$/.test(String(value || ""));
  }

  function isBuildLabelLike(value) {
    return /^(?:[A-Za-z]+-){1,4}\d{4}(?:-\d{2}){1,2}$/i.test(String(value || "").trim());
  }

  function containsPasswordKeyword(value) {
    const normalized = String(value || "").trim();
    return /(?:^|[_\-\s])(?:secret|password|passwd|passcode|passphrase|pwd)(?=$|[_\-\s]|\d)/i.test(
      normalized
    );
  }

  function shouldSuppressIdentityValue(raw, text, start, end, key) {
    if (!raw) return true;
    if (isCleanPlaceholder(raw)) return true;
    if (containsPlaceholder(raw)) return true;
    if (looksExampleLike(raw) || containsTemplateMarker(raw)) return true;
    if (isLikelyEmailAddress(raw) && /@example\.(?:com|org|net)$/i.test(raw)) return true;

    const ctx = contextScore(text, start, end);
    if (ctx <= -8 && !/(password|secret|token|credential|auth)/i.test(String(key || ""))) {
      return true;
    }

    return false;
  }

  function isLikelyBarePasswordCandidate(raw, text, start, end) {
    const value = String(raw || "").trim();
    if (!value || value.length < 10 || value.length > 128) return false;
    if (/\s/.test(value)) return false;
    if (isCleanPlaceholder(value) || containsPlaceholder(value)) return false;
    if (looksExampleLike(value) || containsTemplateMarker(value) || likelyTemplateValue(value)) return false;
    if (isLikelyEmailAddress(value)) return false;
    if (/^(?:https?|wss?|ftp|sftp|mailto):/i.test(value)) return false;
    if (/^(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?$/.test(value)) return false;
    if (/^[a-f0-9]{32,}$/i.test(value)) return false;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      return false;
    }
    if (/^(?:v?\d+\.)+\d+(?:[-+][A-Za-z0-9._-]+)?$/.test(value)) return false;
    if (isBuildLabelLike(value)) return false;
    if (looksLikeFilesystemPath(text, start, end, value)) return false;

    const variety = countClassVariety(value);
    const hasLetter = /[A-Za-z]/.test(value);
    const hasDigit = /\d/.test(value);
    const hasSymbol = /[^A-Za-z0-9]/.test(value);
    const hasMixedCase = /[a-z]/.test(value) && /[A-Z]/.test(value);
    const hasPasswordKeyword = containsPasswordKeyword(value);

    if (variety < 3 && !hasPasswordKeyword) return false;

    if (
      !(
        hasLetter &&
        hasDigit &&
        (hasSymbol || (hasMixedCase && value.length >= 14) || (hasPasswordKeyword && value.length >= 10))
      )
    ) {
      return false;
    }

    const entropy = calculateEntropy(value);
    return entropy >= 3.1 || (hasPasswordKeyword && entropy >= 2.6);
  }

  function isSensitiveObfuscatedKey(key) {
    const input = String(key || "");
    const lower = input.toLowerCase();
    const leetCompact = input
      .toLowerCase()
      .replace(/0/g, "o")
      .replace(/3/g, "e")
      .replace(/\$/g, "s")
      .replace(/@/g, "a")
      .replace(/[\u200B-\u200D\uFEFF\s._$@-]+/g, "");

    if (leetCompact === lower) return false;

    return /^(?:password|passwd|passcode|passphrase|pwd|secret|token|apikey|bearertoken|authorization|authorizationbearer|auth|session|cookie)$/.test(
      leetCompact
    );
  }

  function tryDecodeBase64(value) {
    const input = String(value || "").trim();
    if (!/^[A-Za-z0-9+/]{16,}={0,2}$/.test(input) || input.length % 4 === 1) return "";

    try {
      const decodeBase64 =
        typeof root.atob === "function"
          ? root.atob.bind(root)
          : typeof atob === "function"
            ? atob
            : null;
      if (!decodeBase64) return "";

      const decoded = decodeBase64(input);
      if (!decoded || /[\uFFFD]/.test(decoded)) return "";
      if (!/^[\x09\x0A\x0D\x20-\x7E]+$/.test(decoded)) return "";
      return decoded;
    } catch {
      return "";
    }
  }

  function looksSensitiveDecodedBase64(value) {
    const decoded = tryDecodeBase64(value);
    if (!decoded || decoded.length < 8 || decoded.length > 256) return false;

    if (/(password|passwd|secret|token|api[_ -]?key|credential|auth)/i.test(decoded)) return true;
    return isLikelyBarePasswordCandidate(decoded, decoded, 0, decoded.length);
  }

  function isExplicitEncodedAssignmentKey(key) {
    return /(?:^|[_\-.])(?:encoded|base64|b64|secret|token|password|credential)(?:$|[_\-.])/i.test(
      String(key || "")
    );
  }

  function isLikelyIpv6Address(value) {
    const input = String(value || "").trim();
    if (!input || input.length > 64 || !input.includes(":")) return false;
    if (!/^[0-9A-Fa-f:.]+(?:%\w+)?$/.test(input)) return false;

    const zoneStripped = input.replace(/%\w+$/, "");
    const pieces = zoneStripped.split("::");
    if (pieces.length > 2) return false;

    const left = pieces[0] ? pieces[0].split(":") : [];
    const right = pieces.length === 2 && pieces[1] ? pieces[1].split(":") : [];
    const groups = [...left, ...right];
    if (groups.some((group) => !/^[0-9A-Fa-f]{1,4}$/.test(group))) return false;

    return pieces.length === 2 ? groups.length < 8 : groups.length === 8;
  }

  function unwrapQuotedStandaloneValue(value) {
    const normalized = String(value || "").trim();
    if (normalized.length < 2) return normalized;

    const first = normalized[0];
    const last = normalized[normalized.length - 1];
    if (
      (first === '"' && last === '"') ||
      (first === "'" && last === "'") ||
      (first === "`" && last === "`")
    ) {
      return normalized.slice(1, -1);
    }

    return normalized;
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

    shouldSuppress({ raw, text, start, end, patternName, key, placeholderType, source }) {
      if (!raw) return true;
      if (this.isAllowlisted(raw)) return true;
      if (likelyTemplateValue(raw)) return true;
      if (isCleanPlaceholder(raw)) return true;
      if (containsPlaceholder(raw) && isBenignPlaceholderComposite(raw)) return true;
      if (containsPlaceholder(raw)) {
        const placeholderSuffix = getSinglePlaceholderSuffix(raw);
        if (
          placeholderSuffix &&
          (/^\d+$/.test(placeholderSuffix) || isLikelyPlaceholderSuffixSecret(placeholderSuffix))
        ) {
          return true;
        }
      }
      const failClosedForExample = shouldFailClosedDespiteExample(raw, {
        patternName,
        key,
        placeholderType,
        source
      });
      if (patternName === "placeholder_composite_value" && isBenignPlaceholderComposite(raw)) {
        return true;
      }

      if (looksExampleLike(raw) && !["aws_access_key", "google_api_key"].includes(patternName)) {
        if (failClosedForExample) {
          // Keep explicit secret-style assignments fail-closed even if a vendor test key
          // contains an "example" segment in the middle of the value.
        } else {
          return true;
        }
      }
      if (
        hasExampleHost(raw) &&
        !(
          source === "assignment" &&
          isExplicitSensitiveAssignment(key, placeholderType) &&
          !containsTemplateMarker(raw)
        )
      ) {
        return true;
      }

      const ctx = contextScore(text, start, end);
      if (ctx <= -14 && !failClosedForExample) return true;

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
          if (
            this.shouldSuppress({
              raw,
              text,
              start,
              end,
              patternName: pattern.name,
              placeholderType: PLACEHOLDER_TYPE_MAP[pattern.name] || pattern.type || "SECRET",
              source: "pattern"
            })
          ) {
            continue;
          }

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
        /([A-Za-z_][A-Za-z0-9_.-]{0,80})\s*[:=]\s*(?:"([^"\r\n]+)"|'([^'\r\n]+)'|`([^`\r\n]+)`|([^\s\r\n]+))/gim;
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
          const extractedPassword = extractDbUriPasswordSegment(rawCandidate);
          raw = extractedPassword?.password || "";
          placeholderType = "DB_URI";
          score = 99;

          if (!raw || raw.length < 8) continue;

          const candidateIndex = match[0].indexOf(rawCandidate);
          if (candidateIndex < 0) continue;

          const start = match.index + candidateIndex + (extractedPassword?.offset || 0);
          const end = start + raw.length;

          if (this.isAllowlisted(raw)) continue;
          if (isCleanPlaceholder(raw)) continue;
          if (containsPlaceholder(raw) && !isCleanPlaceholder(raw) && !isBenignPlaceholderComposite(raw)) {
            findings.push(
              this.buildFinding({
                category: "credential",
                placeholderType,
                raw,
                start,
                end,
                score: 100,
                methods: ["assignment", "db-uri-password", "placeholder-composite"]
              })
            );
            continue;
          }
          if (
            this.shouldSuppress({
              raw,
              text,
              start,
              end,
              key,
              placeholderType,
              source: "assignment"
            })
          ) {
            continue;
          }

          const entropy = calculateEntropy(raw);
          const ctx = contextScore(text, start, end);

          findings.push(
            this.buildFinding({
              category: "credential",
              placeholderType,
              raw,
              start,
              end,
              score: score + (entropy >= 3.8 ? 2 : 0) + Math.max(0, ctx),
              methods: ["assignment", "db-uri-password", entropy >= 3.8 ? "entropy" : null].filter(
                Boolean
              )
            })
          );
          continue;
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
        if (containsPlaceholder(raw) && !isCleanPlaceholder(raw) && !isBenignPlaceholderComposite(raw)) {
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
        if (
          this.shouldSuppress({
            raw,
            text,
            start,
            end,
            key,
            placeholderType,
            source: "assignment"
          })
        ) {
          continue;
        }
        if (shouldSuppressStructuredAssignment(raw, placeholderType)) continue;

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
        const token = truncateEmbeddedAssignmentValue(match[2]);
        const normalized = normalizeCandidate(token);
        const placeholderType = inferPlaceholderTypeFromKey(key);
        const normalizedKey = String(key || "").toLowerCase();

        if (match.index > 0 && /[?&]/.test(String(text || "")[match.index - 1])) continue;
        if (isSafeAssignmentKey(key)) continue;
        if (!normalized || normalized.length < 8) continue;

        const valueIndex = full.indexOf(token);
        if (valueIndex < 0) continue;

        const start = match.index + valueIndex;
        const end = start + token.length;

        if (isCleanPlaceholder(normalized)) continue;

        if (containsPlaceholder(normalized) && !isCleanPlaceholder(normalized)) {
          if (isBenignPlaceholderComposite(normalized)) {
            continue;
          }

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

        if (looksLikeUnsupportedVendorHexAssignment(normalizedKey, normalized)) {
          continue;
        }

        if (
          this.shouldSuppress({
            raw: normalized,
            text,
            start,
            end,
            key,
            placeholderType,
            source: "assignment"
          })
        ) {
          continue;
        }

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

    scanExplicitCredentialAssignments(text) {
      const findings = [];
      const regex =
        /([A-Za-z_][A-Za-z0-9_.-]{0,80})\s*[:=]\s*(?:"([^"\r\n]+)"|'([^'\r\n]+)'|`([^`\r\n]+)`|([^\s\r\n]+))/gim;
      let match;

      while ((match = regex.exec(text)) !== null) {
        const key = match[1];
        if (match.index > 0 && /[?&]/.test(String(text || "")[match.index - 1])) continue;
        if (isSafeAssignmentKey(key)) continue;
        if (isDbUriAssignmentKey(key) || isConnectionStringAssignmentKey(key)) continue;
        if (!isSensitiveAssignmentKey(key)) continue;

        const rawCandidate = [match[2], match[3], match[4], match[5]].find(
          (candidate) => typeof candidate === "string"
        );
        if (!rawCandidate) continue;

        const raw = normalizeCandidate(rawCandidate);
        if (!looksCredentialLikeAssignmentValue(raw)) continue;
        if (looksLikeUnsupportedVendorHexAssignment(key, raw)) continue;
        if (containsPlaceholder(raw) && isBenignPlaceholderComposite(raw)) continue;
        if (
          /^(?:cookie|session)$/i.test(normalizeAssignmentKey(key)) &&
          raw.length < 16 &&
          !/(?:secret|token|auth|session|jwt|bearer)/i.test(raw)
        ) {
          continue;
        }
        if (/^(?:auth(?:_?header)?|authorization)$/i.test(normalizeAssignmentKey(key)) && /^bearer\s+/i.test(raw)) {
          continue;
        }

        const valueIndex = match[0].indexOf(rawCandidate);
        if (valueIndex < 0) continue;

        const start = match.index + valueIndex;
        const end = start + rawCandidate.length;
        const placeholderType = inferPlaceholderTypeFromKey(key);

        if (
          this.shouldSuppress({
            raw,
            text,
            start,
            end,
            key,
            placeholderType,
            source: "assignment"
          })
        ) {
          continue;
        }

        const entropy = calculateEntropy(raw);
        const score =
          62 +
          (isExactCredentialAssignmentKey(key) ? 12 : 4) +
          (entropy >= 3.6 ? 4 : 0) +
          (countClassVariety(raw) >= 3 ? 2 : 0);

        findings.push(
          this.buildFinding({
            category: "credential",
            placeholderType,
            raw,
            start,
            end,
            score,
            methods: ["assignment", "explicit-key", entropy >= 3.6 ? "entropy" : null].filter(
              Boolean
            )
          })
        );
      }

      return findings;
    }

    scanUrlCredentials(text) {
      const findings = [];
      const regex = /\b([a-z][a-z0-9+.-]*:\/\/)([^\/\s:@'"`<>]+):([^@\s'"`<>]+)@([^\s'"`<>]+)/gi;
      let match;

      while ((match = regex.exec(text)) !== null) {
        const scheme = String(match[1] || "").slice(0, -3).toLowerCase();
        const username = decodeURIComponent(match[2] || "");
        const secret = decodeURIComponent(match[3] || "");
        const usernameStart = match.index + match[1].length;
        const secretStart = usernameStart + match[2].length + 1;

        if (!username || !secret) continue;
        if (isCleanPlaceholder(username) && isCleanPlaceholder(secret)) continue;
        if (hasExampleHost(match[0]) && hasGenericDbCredentials(match[0])) continue;

        if (!isCleanPlaceholder(username) && !this.isAllowlisted(username)) {
          findings.push(
            this.buildFinding({
              category: "identity",
              placeholderType: "USERNAME",
              raw: username,
              start: usernameStart,
              end: usernameStart + match[2].length,
              score: 96,
              methods: ["url-credentials", "username"]
            })
          );
        }

        if (!isCleanPlaceholder(secret) && !this.isAllowlisted(secret)) {
          const isDbScheme = /^(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis|amqp|mssql)$/.test(scheme);
          findings.push(
            this.buildFinding({
              category: "credential",
              placeholderType: isDbScheme ? "DB_URI" : /token|oauth/i.test(username) ? "TOKEN" : "PASSWORD",
              raw: secret,
              start: secretStart,
              end: secretStart + match[3].length,
              score: 99,
              methods: ["url-credentials"]
            })
          );
        }
      }

      return findings;
    }

    scanIdentityAssignments(text) {
      const findings = [];
      const regex =
        /([A-Za-z_][A-Za-z0-9_.-]{0,80})\s*[:=]\s*(?:"([^"\r\n]+)"|'([^'\r\n]+)'|`([^`\r\n]+)`|([^\s\r\n]+))/gim;
      let match;

      while ((match = regex.exec(text)) !== null) {
        const key = match[1];
        if (isSafeAssignmentKey(key)) continue;
        if (!isIdentityAssignmentKey(key)) continue;

        const rawCandidate = [match[2], match[3], match[4], match[5]].find(
          (candidate) => typeof candidate === "string"
        );
        if (!rawCandidate) continue;

        const raw = normalizeCandidate(rawCandidate);
        if (!raw || raw.length < 3 || raw.length > 256) continue;

        const valueIndex = match[0].indexOf(rawCandidate);
        if (valueIndex < 0) continue;

        const start = match.index + valueIndex;
        const end = start + rawCandidate.length;
        if (this.isAllowlisted(raw)) continue;
        if (shouldSuppressIdentityValue(raw, text, start, end, key)) continue;

        const normalizedKey = normalizeAssignmentKey(key);
        const emailLike = isLikelyEmailAddress(raw);
        const usernameLike = isLikelyUsernameLikeValue(raw);
        if (!emailLike && !usernameLike) continue;

        let score = emailLike ? 52 : 48;
        const ctx = contextScore(text, start, end);

        if (/email|mail/.test(normalizedKey)) score += 10;
        if (/username|login|user/.test(normalizedKey)) score += 8;
        if (emailLike) score += 8;
        if (/[._-]/.test(raw)) score += 3;
        if (/\d/.test(raw)) score += 2;
        if (/\b(?:password|secret|token|auth|credential)\b/i.test(getContextWindow(text, start, end, 96))) {
          score += 8;
        }
        score += Math.max(-8, ctx);

        if (score < this.thresholds.medium) continue;

        findings.push(
          this.buildFinding({
            category: "identity",
            placeholderType: emailLike ? "EMAIL" : "USERNAME",
            raw,
            start,
            end,
            score,
            methods: ["assignment", "identity"]
          })
        );
      }

      return findings;
    }

    scanJsonIdentityFields(text) {
      const findings = [];
      const regex = /"((?:user|username|user_name))"\s*:\s*"([^"\r\n]{3,256})"/gi;
      let match;

      while ((match = regex.exec(text)) !== null) {
        const key = match[1];
        const raw = normalizeCandidate(match[2]);
        if (!raw || isCleanPlaceholder(raw) || containsPlaceholder(raw)) continue;
        if (!isLikelyUsernameLikeValue(raw) && !isLikelyEmailAddress(raw)) continue;

        const valueOffset = match[0].lastIndexOf(match[2]);
        if (valueOffset < 0) continue;
        const start = match.index + valueOffset;
        const end = start + match[2].length;
        if (this.isAllowlisted(raw)) continue;
        if (shouldSuppressIdentityValue(raw, text, start, end, key)) continue;

        findings.push(
          this.buildFinding({
            category: "identity",
            placeholderType: isLikelyEmailAddress(raw) ? "EMAIL" : "USERNAME",
            raw,
            start,
            end,
            score: isLikelyEmailAddress(raw) ? 70 : 64,
            methods: ["json", "identity"]
          })
        );
      }

      return findings;
    }

    scanBarePasswordCandidates(text) {
      const findings = [];
      const lines = String(text || "").split(/\n/);
      let offset = 0;

      for (const line of lines) {
        const trimmed = line.trim();
        const lineStart = offset;
        offset += line.length + 1;

        if (!trimmed) continue;
        if (/[=:]/.test(trimmed) || /\s{2,}/.test(trimmed)) continue;

        const raw = unwrapQuotedStandaloneValue(trimmed);
        const rawOffset = line.indexOf(raw);
        if (rawOffset < 0) continue;

        const start = lineStart + rawOffset;
        const end = start + raw.length;

        if (!isLikelyBarePasswordCandidate(raw, text, start, end)) continue;
        if (this.isAllowlisted(raw)) continue;
        if (this.shouldSuppress({ raw, text, start, end, placeholderType: "PASSWORD", source: "bare" })) {
          continue;
        }

        const entropy = calculateEntropy(raw);
        let score = 54;
        const hasPasswordKeyword = containsPasswordKeyword(raw);

        if (/[^A-Za-z0-9]/.test(raw)) score += 12;
        if (/[A-Z]/.test(raw) && /[a-z]/.test(raw)) score += 8;
        if (/\d/.test(raw)) score += 8;
        if (raw.length >= 14) score += 6;
        if (hasPasswordKeyword) score += 20;
        if (entropy >= 3.6) score += 8;
        score += Math.max(-6, contextScore(text, start, end));

        findings.push(
          this.buildFinding({
            category: "credential",
            placeholderType: "PASSWORD",
            raw,
            start,
            end,
            score,
            methods: ["heuristic", "bare-password", entropy >= 3.6 ? "entropy" : null].filter(Boolean)
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

        if (/^pk_(?:live|test)_[0-9A-Za-z]{16,}$/i.test(raw)) continue;
        if (/^[A-Z]{2,10}[a-z]+$/.test(raw)) continue;
        if (/^(https?|wss?):\/\//i.test(raw)) continue;
        if (/^\d+$/.test(raw)) continue;
        if (isBuildLabelLike(raw)) continue;
        if (looksLikeFilesystemPath(text, start, end, raw)) continue;
        if (hasUnsupportedVendorHexAssignmentContext(text, start, raw)) continue;
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

    scanPlaceholderSuffixSecrets(text) {
      const findings = [];
      const regex = new RegExp(`${CONTAINS_PLACEHOLDER_REGEX.source}([^\\s,;:=\\]\\)\\}]+)`, "g");
      let match;

      while ((match = regex.exec(text)) !== null) {
        const raw = normalizeCandidate(match[1]);
        if (!raw) continue;

        const start = match.index + match[0].length - match[1].length;
        const end = start + raw.length;

        if (/^[A-Za-z_][A-Za-z0-9_.-]{0,80}$/.test(raw) && /[:=]/.test(text[end] || "")) {
          continue;
        }
        if (!isLikelyPlaceholderSuffixSecret(raw)) continue;
        if (this.isAllowlisted(raw)) continue;
        if (this.shouldSuppress({ raw, text, start, end, placeholderType: "SECRET", source: "placeholder-suffix" })) {
          continue;
        }

        findings.push(
          this.buildFinding({
            category: "credential",
            placeholderType: "SECRET",
            raw,
            start,
            end,
            score: scorePlaceholderSuffixSecret(raw, text, start, end),
            methods: ["placeholder-suffix", "heuristic"]
          })
        );
      }

      return findings;
    }

    scanAdversarialAssignments(text) {
      const findings = [];
      const regex =
        /([A-Za-z](?:[\u200B-\u200D\uFEFF\s._$@-]*[A-Za-z0-9$@]){1,80})\s*[:=]\s*(?:"([^"\r\n]+)"|'([^'\r\n]+)'|`([^`\r\n]+)`|([^\s\r\n]+))/gim;
      let match;

      while ((match = regex.exec(text)) !== null) {
        const key = match[1];
        const rawCandidate = [match[2], match[3], match[4], match[5]].find(
          (candidate) => typeof candidate === "string"
        );
        if (!rawCandidate) continue;

        const raw = normalizeCandidate(rawCandidate);
        if (!raw || raw.length < 8) continue;
        if (isSafeAssignmentKey(key)) continue;
        if (containsPlaceholder(raw) && isBenignPlaceholderComposite(raw)) continue;
        if (
          /^(?:cookie|session)$/i.test(normalizeAssignmentKey(key)) &&
          raw.length < 16 &&
          !/(?:secret|token|auth|session|jwt|bearer)/i.test(raw)
        ) {
          continue;
        }

        const valueIndex = match[0].indexOf(rawCandidate);
        if (valueIndex < 0) continue;

        const start = match.index + valueIndex;
        const end = start + rawCandidate.length;

        let placeholderType = inferPlaceholderTypeFromKey(key);
        let score = 0;
        const methods = ["assignment", "adversarial"];

        if (isSensitiveObfuscatedKey(key)) {
          score = 94;
          methods.push("obfuscated-key");
        } else if (isExplicitEncodedAssignmentKey(key) && looksSensitiveDecodedBase64(raw)) {
          score = 88;
          placeholderType = "SECRET";
          methods.push("base64");
        } else if (/ipv6/i.test(key) && isLikelyIpv6Address(raw)) {
          score = 86;
          placeholderType = "IP_ADDRESS";
          methods.push("ipv6");
        } else {
          continue;
        }

        if (this.isAllowlisted(raw)) continue;
        if (this.shouldSuppress({ raw, text, start, end, key, placeholderType, source: "assignment" })) {
          continue;
        }

        findings.push(
          this.buildFinding({
            category: placeholderType === "IP_ADDRESS" ? "network" : "credential",
            placeholderType,
            raw,
            start,
            end,
            score,
            methods
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
        ...this.scanUrlCredentials(input),
        ...this.scanPatterns(input),
        ...this.scanAssignments(input),
        ...this.scanExplicitCredentialAssignments(input),
        ...this.scanAdversarialAssignments(input),
        ...this.scanIdentityAssignments(input),
        ...this.scanJsonIdentityFields(input),
        ...this.scanPlaceholderSuffixSecrets(input),
        ...this.scanBarePasswordCandidates(input),
        ...this.scanEntropyFallback(input)
      ];

      return this.resolveOverlaps(this.dedupe(findings));
    }

    getAiAssistCandidates(findings) {
      return (findings || []).filter(
        (finding) =>
          finding &&
          finding.severity === "medium" &&
          finding.raw &&
          !finding.method?.includes("ai-assist")
      );
    }

    async scanWithAiAssist(text, options = {}) {
      const findings = this.scan(text);
      const classifier = options.classifier || root.PWM.LeakGuardAiClassifier;
      const policy = options.policy || {};

      if (!policy.aiAssistEnabled || !classifier?.classify) {
        return findings;
      }

      const upgraded = [];
      for (const finding of findings) {
        if (finding.severity === "high") {
          upgraded.push(finding);
          continue;
        }

        if (!this.getAiAssistCandidates([finding]).length) {
          upgraded.push(finding);
          continue;
        }

        try {
          const result = await classifier.classify(finding.raw, {
            finding,
            text: String(text || "")
          });
          const confidence = Number(result?.confidence || 0);
          if (result?.risk === "SECRET" && confidence >= 0.85) {
            upgraded.push({
              ...finding,
              score: Math.max(finding.score, this.thresholds.high),
              severity: "high",
              aiAssist: {
                risk: "SECRET",
                confidence
              },
              method: [...new Set([...(finding.method || []), "ai-assist"])]
            });
          } else if (result?.risk === "SECRET" && confidence >= 0.6) {
            upgraded.push({
              ...finding,
              aiAssist: {
                risk: "SECRET",
                confidence
              },
              method: [...new Set([...(finding.method || []), "ai-assist-warning"])]
            });
          } else {
            upgraded.push(finding);
          }
        } catch (error) {
          if (root.console?.warn) {
            root.console.warn("LeakGuard AI assist failed; deterministic finding retained.", error);
          }
          upgraded.push(finding);
        }
      }

      return this.resolveOverlaps(this.dedupe(upgraded));
    }
  }

  root.PWM.Detector = Detector;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = Detector;
  }
})();
