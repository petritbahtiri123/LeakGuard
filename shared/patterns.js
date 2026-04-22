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
      name: "openssh_private_key_block",
      type: "PRIVATE_KEY",
      category: "private_key",
      baseScore: 100,
      suppressionNotes:
        "Suppress example fixtures and placeholders; overlap resolution should prefer this over generic PEM blocks.",
      regex:
        /-----BEGIN OPENSSH PRIVATE KEY-----[\s\S]+?-----END OPENSSH PRIVATE KEY-----/g
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
      name: "placeholder_composite_value",
      type: "SECRET",
      category: "credential",
      baseScore: 86,
      suppressionNotes:
        "Treat placeholder tokens with attached prefix/suffix junk as suspicious whole values while leaving clean placeholders alone.",
      regex:
        /(?:^|[^A-Za-z0-9_:=<>"'`])(\[(?:PWM|[A-Z][A-Z0-9_]*)_\d+\](?:(?:\.[A-Za-z0-9._-]+)+|[A-Za-z0-9._-]+)|[A-Za-z0-9._-]+\[(?:PWM|[A-Z][A-Z0-9_]*)_\d+\](?:[A-Za-z0-9._-]+|(?:\.[A-Za-z0-9._-]+))*)/g,
      captureGroups: [1]
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
      name: "aws_session_token_assignment",
      type: "TOKEN",
      category: "credential",
      baseScore: 90,
      suppressionNotes:
        "Only match explicit AWS_SESSION_TOKEN assignments and still suppress placeholder/example values through shared suppression.",
      regex:
        /\bAWS_SESSION_TOKEN\b\s*[:=]\s*(?:"([^"\r\n]{24,})"|'([^'\r\n]{24,})'|([A-Za-z0-9\/+=]{24,}))\b/g,
      captureGroups: [1, 2, 3]
    },
    {
      name: "aws_access_key_id_assignment",
      type: "AWS_KEY",
      category: "credential",
      baseScore: 94,
      suppressionNotes:
        "Match explicit AWS_ACCESS_KEY_ID assignments so key-shaped values still redact even when they do not satisfy the standalone AKIA length heuristic.",
      regex:
        /\bAWS_ACCESS_KEY_ID\b\s*[:=]\s*(?:"([A-Z0-9]{12,32})"|'([A-Z0-9]{12,32})'|([A-Z0-9]{12,32}))\b/g,
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
      name: "azure_storage_account_key_assignment",
      type: "SECRET",
      category: "credential",
      baseScore: 88,
      suppressionNotes:
        "Require Azure storage account key names plus base64-shaped values to avoid ordinary account labels or sample text.",
      regex:
        /\b(?:AZURE_STORAGE_ACCOUNT_KEY|AzureWebJobsStorage__accountKey|account[_-]?key)\b\s*[:=]\s*(?:"([A-Za-z0-9+/]{40,}={0,2})"|'([A-Za-z0-9+/]{40,}={0,2})'|([A-Za-z0-9+/]{40,}={0,2}))/g,
      captureGroups: [1, 2, 3]
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
      name: "anthropic_api_key",
      type: "API_KEY",
      category: "credential",
      baseScore: 92,
      suppressionNotes:
        "Anthropic keys have a stable sk-ant prefix family, which keeps this browser-side detector high-signal without catching generic sk-* strings.",
      regex: /\bsk-ant-(?:api03-)?[A-Za-z0-9_-]{24,}\b/g
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
      name: "slack_webhook",
      type: "WEBHOOK",
      category: "webhook",
      baseScore: 96,
      suppressionNotes:
        "Only detect canonical Slack webhook hosts and paths; shared example-host suppression removes docs placeholders.",
      regex:
        /\bhttps:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]{8,12}\/B[A-Z0-9]{8,12}\/[A-Za-z0-9]{20,64}\b/g
    },
    {
      name: "discord_webhook",
      type: "WEBHOOK",
      category: "webhook",
      baseScore: 95,
      suppressionNotes:
        "Require Discord webhook host plus numeric id and token path so generic Discord links do not match.",
      regex:
        /\bhttps:\/\/discord(?:app)?\.com\/api\/webhooks\/\d{16,20}\/[A-Za-z0-9._-]{32,}\b/g
    },
    {
      name: "github_token",
      type: "TOKEN",
      category: "credential",
      baseScore: 88,
      suppressionNotes:
        "GitHub classic and scoped token prefixes are distinctive enough to match with a shorter minimum body while shared suppression still drops obvious docs placeholders.",
      regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,255}\b/g
    },
    {
      name: "gitlab_pat",
      type: "TOKEN",
      category: "credential",
      baseScore: 89,
      suppressionNotes:
        "GitLab personal access tokens have a stable glpat- prefix; shared suppression handles example placeholders.",
      regex: /\bglpat-[A-Za-z0-9_-]{20,255}\b/g
    },
    {
      name: "jwt_token",
      type: "TOKEN",
      category: "credential",
      baseScore: 84,
      regex: /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9._-]{8,}\.[A-Za-z0-9._-]{8,}\b/g
    },
    {
      name: "stripe_secret_key",
      type: "API_KEY",
      category: "credential",
      baseScore: 93,
      suppressionNotes:
        "Stripe secret keys need sk_live_ or sk_test_ prefixes; publishable pk_ keys stay out of this rule.",
      regex: /\bsk_(?:live|test)_[0-9A-Za-z]{16,}\b/g
    },
    {
      name: "stripe_webhook_secret",
      type: "SECRET",
      category: "credential",
      baseScore: 90,
      suppressionNotes:
        "Stripe webhook signing secrets use a dedicated whsec_ prefix, which is much safer than trying to infer webhook secrets from generic assignment names.",
      regex: /\bwhsec_[0-9A-Za-z]{16,}\b/g
    },
    {
      name: "google_api_key",
      type: "API_KEY",
      category: "credential",
      baseScore: 82,
      suppressionNotes:
        "Google API keys have a stable AIza prefix; allow a slightly wider suffix length band so realistic variants and service-key fixtures still match cleanly.",
      regex: /\bAIza[0-9A-Za-z\-_]{35,40}\b/g
    },
    {
      name: "google_oauth_client_secret",
      type: "SECRET",
      category: "credential",
      baseScore: 92,
      suppressionNotes:
        "Google OAuth client secrets have a recognizable GOCSPX- prefix, so this stays precise while still relying on shared example suppression.",
      regex: /\bGOCSPX-[A-Za-z0-9_-]{20,}\b/g
    },
    {
      name: "google_refresh_token_assignment",
      type: "TOKEN",
      category: "credential",
      baseScore: 88,
      suppressionNotes:
        "Restrict Google-style refresh tokens to explicit refresh_token assignments so 1//-prefixed prose fragments do not create noise.",
      regex:
        /\brefresh[_-]?token\b\s*[:=]\s*(?:"(1\/\/[A-Za-z0-9._-]{16,})"|'(1\/\/[A-Za-z0-9._-]{16,})'|(1\/\/[A-Za-z0-9._-]{16,}))/gi,
      captureGroups: [1, 2, 3]
    },
    {
      name: "sendgrid_api_key",
      type: "API_KEY",
      category: "credential",
      baseScore: 93,
      suppressionNotes:
        "SendGrid API keys use an SG.<segment>.<segment> structure, which is distinctive enough to be worth detecting directly.",
      regex: /\bSG\.[A-Za-z0-9_-]{16,64}\.[A-Za-z0-9_-]{16,128}\b/g
    },
    {
      name: "json_api_key_field",
      type: "API_KEY",
      category: "credential",
      baseScore: 76,
      suppressionNotes:
        "Catch JSON-style apiKey fields, including malformed quoted blobs, while clean placeholders are still suppressed centrally.",
      regex: /"(?:apiKey|api_key)"\s*:\s*"([^"\r\n]{8,})"/gi,
      captureGroups: [1]
    },
    {
      name: "json_password_field",
      type: "PASSWORD",
      category: "credential",
      baseScore: 78,
      suppressionNotes:
        "Catch JSON-style password fields so raw passwords inside config blobs are redacted even when assignment heuristics do not apply.",
      regex: /"(?:password|dbPassword|db_password)"\s*:\s*"([^"\r\n]{8,})"/gi,
      captureGroups: [1]
    },
    {
      name: "json_token_field",
      type: "TOKEN",
      category: "credential",
      baseScore: 76,
      suppressionNotes:
        "Catch JSON-style token fields, including broken placeholder prefixes before the next quote boundary.",
      regex: /"(?:token|accessToken|access_token|sessionToken|session_token)"\s*:\s*"([^"\r\n]{8,})"/gi,
      captureGroups: [1]
    },
    {
      name: "json_client_secret_field",
      type: "SECRET",
      category: "credential",
      baseScore: 78,
      suppressionNotes:
        "Catch JSON-style client secret fields while letting clean placeholders fall through suppression unchanged.",
      regex: /"(?:clientSecret|client_secret|secret)"\s*:\s*"([^"\r\n]{8,})"/gi,
      captureGroups: [1]
    },
    {
      name: "natural_language_api_key",
      type: "API_KEY",
      category: "credential",
      baseScore: 74,
      regex: /\b(?:my|the|our)?\s*api\s*key\s*(?:is|=|:)\s*([^\s,;]{8,})/gi,
      captureGroups: [1]
    },
    {
      name: "natural_language_openai_key",
      type: "API_KEY",
      category: "credential",
      baseScore: 76,
      suppressionNotes:
        "Catch phrases like 'my openai key is ...' while still letting explicit example placeholders fall through shared suppression.",
      regex:
        /\b(?:my|the|our)?\s*openai\s*(?:api\s*)?key\s*(?:is|=|:)\s*(?:"([^"\r\n]{8,})"|“([^”\r\n]{8,})”|'([^'\r\n]{8,})'|`([^`\r\n]{8,})`|([^\s,;]{8,}))/gi,
      captureGroups: [1, 2, 3, 4, 5]
    },
    {
      name: "natural_language_password",
      type: "PASSWORD",
      category: "credential",
      baseScore: 76,
      suppressionNotes:
        "Catch bare or quoted natural-language password disclosures such as 'my password is ...' without consuming trailing punctuation or line breaks.",
      regex:
        /\b(?:my|the|our)?\s*password\s*(?:is|=|:)\s*(?:"([^"\r\n]{8,})"|'([^'\r\n]{8,})'|`([^`\r\n]{8,})`|([^\s,;]{8,}))/gi,
      captureGroups: [1, 2, 3, 4]
    },
    {
      name: "labelled_password_value",
      type: "PASSWORD",
      category: "credential",
      baseScore: 78,
      suppressionNotes:
        "Catch arrow-labelled password disclosures such as 'Password -> ...' or 'Password → ...', including smart quotes.",
      regex:
        /\bpassword\s*(?:is|=|:|->|→)\s*(?:"([^"\r\n]{8,})"|“([^”\r\n]{8,})”|'([^'\r\n]{8,})'|`([^`\r\n]{8,})`|([^\s,;]{8,}))/gi,
      captureGroups: [1, 2, 3, 4, 5]
    },
    {
      name: "labelled_openai_key_value",
      type: "API_KEY",
      category: "credential",
      baseScore: 78,
      suppressionNotes:
        "Catch labelled vendor keys such as 'Key -> sk-...' while keeping the value requirement strict to OpenAI-style key shapes.",
      regex:
        /\bkey\s*(?:is|=|:|->|→)\s*(?:"(sk-(?:proj|live|test|org|svcacct)-[A-Za-z0-9_-]{16,}|sk-[A-Za-z0-9]{32,})"|“(sk-(?:proj|live|test|org|svcacct)-[A-Za-z0-9_-]{16,}|sk-[A-Za-z0-9]{32,})”|'(sk-(?:proj|live|test|org|svcacct)-[A-Za-z0-9_-]{16,}|sk-[A-Za-z0-9]{32,})'|`(sk-(?:proj|live|test|org|svcacct)-[A-Za-z0-9_-]{16,}|sk-[A-Za-z0-9]{32,})`|(sk-(?:proj|live|test|org|svcacct)-[A-Za-z0-9_-]{16,}|sk-[A-Za-z0-9]{32,}))/gi,
      captureGroups: [1, 2, 3, 4, 5]
    },
    {
      name: "real_value_label",
      type: "SECRET",
      category: "credential",
      baseScore: 72,
      suppressionNotes:
        "Catch phrases such as 'real value: ...' when they are immediately followed by a secret-like token.",
      regex:
        /\breal\s+value\s*(?:is|=|:)\s*(?:"([^"\r\n]{8,})"|“([^”\r\n]{8,})”|'([^'\r\n]{8,})'|`([^`\r\n]{8,})`|([^\s,;]{8,}))/gi,
      captureGroups: [1, 2, 3, 4, 5]
    },
    {
      name: "quoted_secret_label",
      type: "SECRET",
      category: "credential",
      baseScore: 74,
      suppressionNotes:
        "Catch explicit secret labels immediately followed by quoted values without swallowing surrounding prose.",
      regex: /\bsecret\s*(?:"([^"\r\n]{8,})"|“([^”\r\n]{8,})”|'([^'\r\n]{8,})'|`([^`\r\n]{8,})`)/gi,
      captureGroups: [1, 2, 3, 4]
    },
    {
      name: "natural_language_token",
      type: "TOKEN",
      category: "credential",
      baseScore: 72,
      regex: /\b(?:my|the|our)?\s*token\s*(?:is|=|:)\s*([^\s,;]{8,})/gi,
      captureGroups: [1]
    },
    {
      name: "google_service_account_private_key",
      type: "PRIVATE_KEY",
      category: "private_key",
      baseScore: 99,
      suppressionNotes:
        "Anchor on the service-account private_key field with escaped PEM content so ordinary JSON keys do not trigger.",
      regex:
        /"private_key"\s*:\s*"(-{5}BEGIN PRIVATE KEY-{5}\\n[\s\S]+?\\n-{5}END PRIVATE KEY-{5}\\n?)"/g,
      captureGroups: [1]
    },
    {
      name: "authorization_bearer_value",
      type: "TOKEN",
      category: "credential",
      baseScore: 90,
      suppressionNotes:
        "Catch Authorization key/value forms case-insensitively across both ':' and '=' separators while redacting only the Bearer token value.",
      regex:
        /\bauthorization\b\s*[:=]\s*(?:"\s*bearer\s+([^"\r\n]{8,})\s*"|'\s*bearer\s+([^'\r\n]{8,})\s*'|bearer\s+([^\s,;]{8,}))/gi,
      captureGroups: [1, 2, 3]
    },
    {
      name: "bearer_token",
      type: "TOKEN",
      category: "credential",
      baseScore: 78,
      suppressionNotes:
        "Catch standalone Bearer tokens, including shorter OAuth-style values that are not JWT-shaped.",
      regex: /\bbearer\s+([A-Za-z0-9._~+\/=-]{8,})\b/gi,
      captureGroups: [1]
    },
    {
      name: "basic_auth_header",
      type: "TOKEN",
      category: "credential",
      baseScore: 83,
      suppressionNotes:
        "Only match Authorization: Basic headers with realistic base64 payload length to avoid ordinary prose about basic auth.",
      regex: /\bAuthorization\s*:\s*Basic\s+([A-Za-z0-9+/]{16,}={0,2})\b/gi,
      captureGroups: [1]
    },
    {
      name: "db_uri",
      type: "DB_URI",
      category: "connection_string",
      baseScore: 75,
      regex:
        /\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis|amqp|mssql):\/\/[^\s'"`<>{}\[\]]+/gi
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
      name: "azure_servicebus_connection_string",
      type: "CONNECTION_STRING",
      category: "connection_string",
      baseScore: 93,
      suppressionNotes:
        "Require Azure Service Bus key fields in semicolon-delimited form; sample/example strings are suppressed centrally.",
      regex:
        /\bEndpoint=sb:\/\/[^\s;]+;SharedAccessKeyName=[^;\s]+;SharedAccessKey=[^;\s]+(?:;EntityPath=[^;\s]+)?/gi
    },
    {
      name: "azure_storage_connection_string",
      type: "CONNECTION_STRING",
      category: "connection_string",
      baseScore: 92,
      suppressionNotes:
        "Require the full Azure storage connection-string shape including AccountKey and EndpointSuffix.",
      regex:
        /\bDefaultEndpointsProtocol=https;AccountName=[^;]+;AccountKey=[^;]+;EndpointSuffix=[^\s;]+/g
    },
    {
      name: "npm_token",
      type: "TOKEN",
      category: "credential",
      baseScore: 91,
      suppressionNotes:
        "npm tokens use a stable npm_ prefix; shared suppression drops replace-me and example placeholders.",
      regex: /\bnpm_[A-Za-z0-9]{36}\b/g
    },
    {
      name: "pypi_token",
      type: "TOKEN",
      category: "credential",
      baseScore: 91,
      suppressionNotes:
        "PyPI API tokens use a dedicated pypi- prefix and long encoded payload, which keeps this detector practical and low-noise.",
      regex: /\bpypi-[A-Za-z0-9_-]{40,}\b/g
    },
    {
      name: "docker_auth_config",
      type: "TOKEN",
      category: "credential",
      baseScore: 82,
      suppressionNotes:
        "Only match Docker config auth fields and redact the base64 credential value, not the surrounding JSON structure.",
      regex: /"auth"\s*:\s*"([A-Za-z0-9+/]{20,}={0,2})"/g,
      captureGroups: [1]
    },
    {
      name: "cookie_session_token",
      type: "TOKEN",
      category: "session",
      baseScore: 81,
      suppressionNotes:
        "Restrict to cookie/session/auth names with long token-like values to avoid ordinary cookie preferences or short ids.",
      regex:
        /\b(?:Set-Cookie|Cookie)\s*:\s*[^;\n\r]*(?:session(?:id|_id)?|connect\.sid|sid|auth(?:entication)?(?:[_-]?token)?|access(?:[_-]?token)?|refresh(?:[_-]?token)?)=([A-Za-z0-9%._~-]{16,})/gi,
      captureGroups: [1]
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
    "session",
    "session token",
    "sessionid",
    "cookie",
    "webhook",
    "stripe",
    "gitlab",
    "azure",
    "storage account key",
    "pem",
    "openai",
    "anthropic",
    "slack",
    "sendgrid",
    "stripe webhook",
    "whsec",
    "refresh token",
    "gocspx",
    "pypi",
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
    /((?:[A-Za-z_][A-Za-z0-9_.-]{0,80})?(?:aws[_-]?secret[_-]?access[_-]?key|aws[_-]?session[_-]?token|pass(?:word)?|pwd|secret|token|api[_-]?key|openai(?:[_-]?api)?(?:[_-]?key)?|jwt|access[_-]?key|client[_-]?secret|private[_-]?key|account[_-]?key|cookie|session(?:[_-]?id|[_-]?secret)?|auth(?:orization)?|connection(?:string|_string)?|webhook))/i;

  const ASSIGNMENT_REGEX =
    /((?:[A-Za-z_][A-Za-z0-9_.-]{0,80})?(?:aws[_-]?secret[_-]?access[_-]?key|aws[_-]?session[_-]?token|pass(?:word)?|pwd|secret|token|api[_-]?key|openai(?:[_-]?api)?(?:[_-]?key)?|jwt|access[_-]?key|client[_-]?secret|private[_-]?key|account[_-]?key|cookie|session(?:[_-]?id|[_-]?secret)?|auth(?:orization)?|connection(?:string|_string)?|webhook))\s*[:=]\s*((?:"[^"\n\r]*")|(?:'[^'\n\r]*')|(?:`[^`\n\r]*`)|(?:[^\s,;]+))/gim;

  const CLEAN_PLACEHOLDER_REGEX =
    /^\[(?:PWM_\d+|NET_\d+(?:_SUB_\d+)*(?:_(?:HOST_\d+|GW|VIP|DNS))?|PUB_HOST_\d+(?:_(?:GW|VIP|DNS))?)\]$/;

  const CONTAINS_PLACEHOLDER_REGEX =
    /\[(?:PWM_\d+|NET_\d+(?:_SUB_\d+)*(?:_(?:HOST_\d+|GW|VIP|DNS))?|PUB_HOST_\d+(?:_(?:GW|VIP|DNS))?|[A-Z][A-Z0-9_]*_\d+)\]/;

  const SUPPRESSED_VALUE_REGEX = [
    /^\$\{[^}]+\}$/,
    /^<[^>]+>$/,
    /^\[(?!PWM_\d+\]$)(?![A-Z][A-Z0-9_]*_\d+\]$)[A-Z0-9_ -]+\]$/,
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
    openssh_private_key_block: "PRIVATE_KEY",
    pem_block: "PEM_BLOCK",
    placeholder_composite_value: "SECRET",
    aws_secret_access_key_assignment: "AWS_SECRET_KEY",
    aws_session_token_assignment: "TOKEN",
    aws_access_key: "AWS_KEY",
    azure_storage_account_key_assignment: "SECRET",
    openai_api_key: "API_KEY",
    anthropic_api_key: "API_KEY",
    json_api_key_field: "API_KEY",
    json_password_field: "PASSWORD",
    json_token_field: "TOKEN",
    json_client_secret_field: "SECRET",
    github_token: "TOKEN",
    github_pat: "TOKEN",
    slack_token: "TOKEN",
    slack_webhook: "WEBHOOK",
    discord_webhook: "WEBHOOK",
    gitlab_pat: "TOKEN",
    jwt_token: "TOKEN",
    stripe_secret_key: "API_KEY",
    stripe_webhook_secret: "SECRET",
    natural_language_api_key: "API_KEY",
    natural_language_openai_key: "API_KEY",
    natural_language_password: "PASSWORD",
    labelled_password_value: "PASSWORD",
    labelled_openai_key_value: "API_KEY",
    real_value_label: "SECRET",
    quoted_secret_label: "SECRET",
    natural_language_token: "TOKEN",
    bearer_token: "TOKEN",
    google_api_key: "API_KEY",
    google_oauth_client_secret: "SECRET",
    google_refresh_token_assignment: "TOKEN",
    google_service_account_private_key: "PRIVATE_KEY",
    sendgrid_api_key: "API_KEY",
    authorization_bearer_value: "TOKEN",
    basic_auth_header: "TOKEN",
    db_uri: "DB_URI",
    generic_uri_credentials: "CONNECTION_STRING",
    azure_servicebus_connection_string: "CONNECTION_STRING",
    azure_storage_connection_string: "CONNECTION_STRING",
    npm_token: "TOKEN",
    pypi_token: "TOKEN",
    docker_auth_config: "TOKEN",
    cookie_session_token: "TOKEN",
    generic_assignment_secret: "SECRET",
    entropy_secret: "SECRET"
  };

  root.PWM.PATTERNS = PATTERNS;
  root.PWM.KEYWORDS = KEYWORDS;
  root.PWM.NEGATIVE_CONTEXT_WORDS = NEGATIVE_CONTEXT_WORDS;
  root.PWM.ASSIGNMENT_KEY_REGEX = ASSIGNMENT_KEY_REGEX;
  root.PWM.ASSIGNMENT_REGEX = ASSIGNMENT_REGEX;
  root.PWM.CLEAN_PLACEHOLDER_REGEX = CLEAN_PLACEHOLDER_REGEX;
  root.PWM.CONTAINS_PLACEHOLDER_REGEX = CONTAINS_PLACEHOLDER_REGEX;
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
      CLEAN_PLACEHOLDER_REGEX,
      CONTAINS_PLACEHOLDER_REGEX,
      SUPPRESSED_VALUE_REGEX,
      EXAMPLE_VALUE_MARKERS,
      EXAMPLE_HOSTS,
      PLACEHOLDER_TYPE_MAP
    };
  }
})();
