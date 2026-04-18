(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  const PATTERNS = [
    {
      name: "pem_private_key_block",
      type: "PRIVATE_KEY",
      category: "private_key",
      baseScore: 100,
      regex:
        /-----BEGIN(?: RSA| EC| OPENSSH| DSA| PGP)? PRIVATE KEY-----[\s\S]+?-----END(?: RSA| EC| OPENSSH| DSA| PGP)? PRIVATE KEY-----/g
    },
    {
      name: "pem_block",
      type: "PEM_BLOCK",
      category: "private_key",
      baseScore: 95,
      regex:
        /-----BEGIN [A-Z0-9][A-Z0-9 ]+-----[\s\S]+?-----END [A-Z0-9][A-Z0-9 ]+-----/g
    },
    {
      name: "aws_secret_access_key_assignment",
      type: "AWS_SECRET_KEY",
      category: "credential",
      baseScore: 96,
      regex:
        /\bAWS_SECRET_ACCESS_KEY\b\s*[:=]\s*(?:"([^"\r\n]{40})"|'([^'\r\n]{40})'|([A-Za-z0-9\/+=]{40}))/g,
      captureGroups: [1, 2, 3]
    },
    {
      name: "aws_access_key",
      type: "AWS_KEY",
      category: "credential",
      baseScore: 92,
      regex: /\bAKIA[0-9A-Z]{16}\b/g
    },
    {
      name: "openai_api_key",
      type: "API_KEY",
      category: "credential",
      baseScore: 91,
      regex:
        /\b(?:sk-(?:proj|live|test|org|svcacct)-[A-Za-z0-9_-]{16,}|sk-[A-Za-z0-9]{32,})\b/g
    },
    {
      name: "github_pat",
      type: "TOKEN",
      category: "credential",
      baseScore: 90,
      regex: /\bgithub_pat_[A-Za-z0-9_]{20,255}\b/g
    },
    {
      name: "slack_token",
      type: "TOKEN",
      category: "credential",
      baseScore: 90,
      regex:
        /\b(?:xox(?:a|b|p|r|s)-[A-Za-z0-9-]{10,200}|xapp-[A-Za-z0-9-]{20,200})\b/g
    },
    {
      name: "github_token",
      type: "TOKEN",
      category: "credential",
      baseScore: 88,
      regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,255}\b/g
    },
    {
      name: "jwt_token",
      type: "TOKEN",
      category: "credential",
      baseScore: 84,
      regex: /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9._-]{8,}\.[A-Za-z0-9._-]{8,}\b/g
    },
    {
      name: "google_api_key",
      type: "API_KEY",
      category: "credential",
      baseScore: 82,
      regex: /\bAIza[0-9A-Za-z\-_]{35}\b/g
    },
    {
      name: "bearer_token",
      type: "TOKEN",
      category: "credential",
      baseScore: 78,
      regex: /\bBearer\s+[A-Za-z0-9._~+\/=-]{20,}\b/g
    },
    {
      name: "db_uri",
      type: "DB_URI",
      category: "connection_string",
      baseScore: 75,
      regex:
        /\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis|amqp|mssql):\/\/[^\s'"`<>]+/gi
    },
    {
      name: "generic_uri_credentials",
      type: "CONNECTION_STRING",
      category: "connection_string",
      baseScore: 72,
      regex:
        /\b[a-z][a-z0-9+.-]*:\/\/[^\/\s:@'"`<>]+:[^@\s'"`<>]+@[^\s'"`<>]+/gi
    },
    {
      name: "azure_storage_connection_string",
      type: "CONNECTION_STRING",
      category: "connection_string",
      baseScore: 92,
      regex:
        /\bDefaultEndpointsProtocol=https;AccountName=[^;]+;AccountKey=[^;]+;EndpointSuffix=[^\s;]+/g
    }
  ];

  const KEYWORDS = [
    "password",
    "passwd",
    "pwd",
    "secret",
    "token",
    "api key",
    "apikey",
    "access key",
    "client secret",
    "authorization",
    "auth",
    "bearer",
    "private key",
    "pem",
    "openai",
    "slack",
    "connection string",
    "conn string",
    "database url",
    "db url",
    "aws_secret_access_key",
    "aws access key"
  ];

  const NEGATIVE_CONTEXT_WORDS = [
    "example",
    "sample",
    "dummy",
    "placeholder",
    "fake",
    "demo",
    "mock",
    "redacted",
    "masked",
    "sanitized",
    "template",
    "test fixture",
    "replace me",
    "replace_me",
    "changeme"
  ];

  const ASSIGNMENT_KEY_REGEX =
    /([A-Za-z_][A-Za-z0-9_.-]{0,80}(?:aws[_-]?secret[_-]?access[_-]?key|pass(?:word)?|pwd|secret|token|api[_-]?key|access[_-]?key|client[_-]?secret|auth(?:orization)?|connection(?:string|_string)?))/i;

  const ASSIGNMENT_REGEX =
    /([A-Za-z_][A-Za-z0-9_.-]{0,80}(?:aws[_-]?secret[_-]?access[_-]?key|pass(?:word)?|pwd|secret|token|api[_-]?key|access[_-]?key|client[_-]?secret|auth(?:orization)?|connection(?:string|_string)?))\s*[:=]\s*((?:"[^"\n\r]*")|(?:'[^'\n\r]*')|(?:`[^`\n\r]*`)|(?:[^\s,;]+))/gim;

  const SUPPRESSED_VALUE_REGEX = [
    /^\$\{[^}]+\}$/,
    /^<[^>]+>$/,
    /^\[[A-Z0-9_ -]+\]$/,
    /^REDACTED$/i,
    /^MASKED$/i,
    /^changeme$/i,
    /^replace(?:_|-)?me$/i,
    /^your[_-]/i,
    /^example(?:[_-]|\b)/i,
    /^sample(?:[_-]|\b)/i,
    /^dummy(?:[_-]|\b)/i,
    /^fake(?:[_-]|\b)/i,
    /^placeholder(?:[_-]|\b)/i,
    /^xxxxx+$/i,
    /^todo$/i
  ];

  const EXAMPLE_VALUE_MARKERS = [
    "example",
    "sample",
    "dummy",
    "placeholder",
    "changeme",
    "replace_me",
    "replace-me",
    "your_"
  ];

  const EXAMPLE_HOSTS = new Set([
    "example.com",
    "example.org",
    "example.net",
    "test.invalid",
    "invalid"
  ]);

  const PLACEHOLDER_TYPE_MAP = {
    pem_private_key_block: "PRIVATE_KEY",
    pem_block: "PEM_BLOCK",
    aws_secret_access_key_assignment: "AWS_SECRET_KEY",
    aws_access_key: "AWS_KEY",
    openai_api_key: "API_KEY",
    github_token: "TOKEN",
    github_pat: "TOKEN",
    slack_token: "TOKEN",
    jwt_token: "TOKEN",
    bearer_token: "TOKEN",
    google_api_key: "API_KEY",
    db_uri: "DB_URI",
    generic_uri_credentials: "CONNECTION_STRING",
    azure_storage_connection_string: "CONNECTION_STRING",
    generic_assignment_secret: "SECRET",
    entropy_secret: "SECRET"
  };

  root.PWM.PATTERNS = PATTERNS;
  root.PWM.KEYWORDS = KEYWORDS;
  root.PWM.NEGATIVE_CONTEXT_WORDS = NEGATIVE_CONTEXT_WORDS;
  root.PWM.ASSIGNMENT_KEY_REGEX = ASSIGNMENT_KEY_REGEX;
  root.PWM.ASSIGNMENT_REGEX = ASSIGNMENT_REGEX;
  root.PWM.SUPPRESSED_VALUE_REGEX = SUPPRESSED_VALUE_REGEX;
  root.PWM.EXAMPLE_VALUE_MARKERS = EXAMPLE_VALUE_MARKERS;
  root.PWM.EXAMPLE_HOSTS = EXAMPLE_HOSTS;
  root.PWM.PLACEHOLDER_TYPE_MAP = PLACEHOLDER_TYPE_MAP;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      PATTERNS,
      KEYWORDS,
      NEGATIVE_CONTEXT_WORDS,
      ASSIGNMENT_KEY_REGEX,
      ASSIGNMENT_REGEX,
      SUPPRESSED_VALUE_REGEX,
      EXAMPLE_VALUE_MARKERS,
      EXAMPLE_HOSTS,
      PLACEHOLDER_TYPE_MAP
    };
  }
})();
