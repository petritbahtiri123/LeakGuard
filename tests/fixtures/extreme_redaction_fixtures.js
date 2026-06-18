const zlib = require("zlib");

const TRUSTED_PLACEHOLDER = "[PWM_9]";

const POSITIVE_CASES = [
  {
    name: "AWS AKIA access key",
    text: "AWS_ACCESS_KEY_ID=AKIASYNTHETIC1234567",
    raw: "AKIASYNTHETIC1234567",
    deterministicReason: "aws-access-key-id"
  },
  {
    name: "AWS ASIA session access key",
    text: "AWS_ACCESS_KEY_ID=ASIASYNTHETIC1234567",
    raw: "ASIASYNTHETIC1234567",
    deterministicReason: "aws-access-key-id"
  },
  {
    name: "AWS secret access key assignment",
    text: "AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYSYNTHKEY",
    raw: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYSYNTHKEY",
    deterministicReason: "aws-secret-access-key-context"
  },
  {
    name: "AWS session token",
    text:
      "AWS_SESSION_TOKEN=IQoJb3JpZ2luX2VjEJr//////////wEaCXVzLWVhc3QtMSJHSyntheticSessionTokenValue1234567890",
    raw:
      "IQoJb3JpZ2luX2VjEJr//////////wEaCXVzLWVhc3QtMSJHSyntheticSessionTokenValue1234567890",
    deterministicReason: "aws-session-token-context"
  },
  {
    name: "Azure client secret",
    text: "AZURE_CLIENT_SECRET=AzureSyntheticClientSecret123!",
    raw: "AzureSyntheticClientSecret123!",
    deterministicReason: "azure-client-secret-context"
  },
  {
    name: "Azure storage AccountKey connection string",
    text:
      "DefaultEndpointsProtocol=https;AccountName=lgqastore;AccountKey=U3ludGhldGljQXp1cmVTdG9yYWdlS2V5MTIzNDU2Nzg5MDEyMzQ1Njc4OTA=;EndpointSuffix=core.windows.net",
    raw: "U3ludGhldGljQXp1cmVTdG9yYWdlS2V5MTIzNDU2Nzg5MDEyMzQ1Njc4OTA=",
    deterministicReason: "azure-storage-account-key"
  },
  {
    name: "Azure SAS sig URL",
    text:
      "https://lgqastore.blob.core.windows.net/container/blob.txt?sv=2024-01-01&se=2026-01-01&sp=r&sr=b&sig=SyntheticSasSignature1234567890%2B%2F%3D",
    raw: "SyntheticSasSignature1234567890%2B%2F%3D",
    deterministicReason: "azure-sas-token"
  },
  {
    name: "GCP API key",
    text: "GOOGLE_API_KEY=AIzaSyA0bcdefghijklmnopqrstuvwxYZ123456",
    raw: "AIzaSyA0bcdefghijklmnopqrstuvwxYZ123456",
    deterministicReason: "gcp-api-key"
  },
  {
    name: "GCP service account private key",
    text:
      '{"type":"service_account","private_key":"-----BEGIN PRIVATE KEY-----\\nSyntheticGcpPrivateKeyBody1234567890\\n-----END PRIVATE KEY-----\\n"}',
    raw:
      "-----BEGIN PRIVATE KEY-----\\nSyntheticGcpPrivateKeyBody1234567890\\n-----END PRIVATE KEY-----\\n",
    deterministicReason: "gcp-service-account-private-key"
  },
  {
    name: "GCP service account email",
    text: '{"client_email":"svc-prod@project-prod.iam.gserviceaccount.com"}',
    raw: "svc-prod@project-prod.iam.gserviceaccount.com",
    deterministicReason: "gcp-service-account-identity",
    placeholderFamily: "EMAIL"
  },
  ...["ghp", "gho", "ghu", "ghs", "ghr"].map((prefix) => ({
    name: `GitHub ${prefix} token`,
    text: `GITHUB_TOKEN=${prefix}_SyntheticGitHubTokenValue1234567890`,
    raw: `${prefix}_SyntheticGitHubTokenValue1234567890`,
    deterministicReason: "github-token"
  })),
  {
    name: "GitHub fine-grained PAT",
    text:
      "GITHUB_TOKEN=github_pat_11SYNTHETICGITHUBTOKEN_SyntheticGitHubTokenValue1234567890",
    raw: "github_pat_11SYNTHETICGITHUBTOKEN_SyntheticGitHubTokenValue1234567890",
    deterministicReason: "github-token"
  },
  ...["glpat", "gldt", "glrt"].map((prefix) => ({
    name: `GitLab ${prefix} token`,
    text: `GITLAB_TOKEN=${prefix}-SyntheticGitLabTokenValue1234567890`,
    raw: `${prefix}-SyntheticGitLabTokenValue1234567890`,
    deterministicReason: "gitlab-token"
  })),
  ...["xoxb", "xoxp", "xoxa", "xoxr", "xoxs"].map((prefix) => ({
    name: `Slack ${prefix} token`,
    text: `SLACK_TOKEN=${prefix}-123456789012-123456789012-SyntheticSlackToken`,
    raw: `${prefix}-123456789012-123456789012-SyntheticSlackToken`,
    deterministicReason: "slack-token"
  })),
  {
    name: "Slack webhook URL",
    text:
      "SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T12345678/B12345678/SyntheticSlackWebhookValue",
    raw: "https://hooks.slack.com/services/T12345678/B12345678/SyntheticSlackWebhookValue",
    deterministicReason: "slack-webhook"
  },
  {
    name: "Kubernetes token",
    text:
      "kubeconfig:\nusers:\n- name: svc\n  user:\n    token: eyJhbGciOiJIUzI1NiIsImtpZCI6Imt1YmUifQ.syntheticPayload.signatureValue123",
    raw: "eyJhbGciOiJIUzI1NiIsImtpZCI6Imt1YmUifQ.syntheticPayload.signatureValue123",
    deterministicReason: "kubernetes-secret-token"
  },
  {
    name: "Kubernetes client key data",
    text: "client-key-data: Q2xpZW50S2V5RGF0YVZhbHVlMTIzNDU2Nzg5MA==",
    raw: "Q2xpZW50S2V5RGF0YVZhbHVlMTIzNDU2Nzg5MA==",
    deterministicReason: "kubernetes-key-data"
  },
  {
    name: "Kubernetes Secret stringData password",
    text: "apiVersion: v1\nkind: Secret\nstringData:\n  password: KubeSecretPassword123!",
    raw: "KubeSecretPassword123!"
  },
  {
    name: "Docker config auth",
    text: '{"auths":{"registry.local":{"auth":"dXNlcjpEb2NrZXJQYXNzMTIzIQ=="}}}',
    raw: "dXNlcjpEb2NrZXJQYXNzMTIzIQ==",
    deterministicReason: "docker-registry-auth"
  },
  {
    name: "Docker identitytoken",
    text: '{"auths":{"registry.local":{"identitytoken":"SyntheticDockerIdentityToken123456"}}}',
    raw: "SyntheticDockerIdentityToken123456",
    deterministicReason: "docker-registry-auth"
  },
  {
    name: "Docker registry password",
    text: '{"auths":{"registry.local":{"username":"svc","password":"DockerRegistryPassword123!"}}}',
    raw: "DockerRegistryPassword123!",
    deterministicReason: "docker-registry-auth"
  },
  ...[
    ["Terraform client_secret", 'terraform.tfvars\nclient_secret = "TerraformClientSecret123!"', "TerraformClientSecret123!"],
    ["Terraform password", 'terraform.tfvars\npassword = "TerraformPassword123!"', "TerraformPassword123!"],
    ["Terraform access_key", 'terraform.tfvars\naccess_key = "TerraformAccessKey123!"', "TerraformAccessKey123!"],
    ["Terraform private_key", 'terraform.tfvars\nprivate_key = "TerraformPrivateKey123!"', "TerraformPrivateKey123!"],
    ["Terraform TFE_TOKEN", "TFE_TOKEN=TerraformCloudToken1234567890", "TerraformCloudToken1234567890"],
    [
      "Terraform app token",
      "TF_TOKEN_app_terraform_io=TerraformAppToken1234567890",
      "TerraformAppToken1234567890"
    ]
  ].map(([name, text, raw]) => ({
    name,
    text,
    raw,
    deterministicReason: "terraform-secret-context"
  })),
  ...[
    ["Postgres URL password", "DATABASE_URL=postgres://app:PostgresPassword123!@db.local:5432/app", "PostgresPassword123!"],
    ["MySQL URL password", "MYSQL_URL=mysql://root:MysqlPassword123!@db.local:3306/app", "MysqlPassword123!"],
    ["MongoDB URL password", "MONGO_URL=mongodb://svc:MongoPassword123!@db.local:27017/app", "MongoPassword123!"],
    ["Redis URL password", "REDIS_URL=redis://:RedisPassword123!@redis.local:6379/0", "RedisPassword123!"],
    [
      "JDBC password",
      "JDBC_URL=jdbc:sqlserver://sql.local:1433;databaseName=app;password=JdbcPassword123!",
      "JdbcPassword123!"
    ],
    [
      "SQL Server password attribute",
      "Server=sql.local;User Id=app;Password=SqlServerPassword123!;Database=app;",
      "SqlServerPassword123!"
    ]
  ].map(([name, text, raw]) => ({
    name,
    text,
    raw,
    deterministicReason: name === "SQL Server password attribute" ? "" : "database-url-credentials",
    expectedMethod: name === "SQL Server password attribute" ? "sqlserver-connection-string" : ""
  })),
  ...["", "RSA ", "EC ", "OPENSSH "].map((kind) => {
    const label = kind.trim() || "generic";
    const block = [
      `-----BEGIN ${kind}PRIVATE KEY-----`,
      `Synthetic${label.replace(/\s+/g, "")}PrivateKeyBody1234567890`,
      `-----END ${kind}PRIVATE KEY-----`
    ].join("\n");
    return {
      name: `Private key ${label}`,
      text: block,
      raw: block,
      deterministicReason: "private-key-block"
    };
  }),
  {
    name: "Normal email",
    text: "Contact jane.doe@company.test for access.",
    raw: "jane.doe@company.test",
    placeholderFamily: "EMAIL"
  },
  {
    name: "Plus-address email",
    text: "Contact jane.doe+prod@company.test for access.",
    raw: "jane.doe+prod@company.test",
    placeholderFamily: "EMAIL"
  },
  {
    name: "Subdomain email",
    text: "Contact jane.doe@ops.company.test for access.",
    raw: "jane.doe@ops.company.test",
    placeholderFamily: "EMAIL"
  },
  {
    name: "Weak contextual password",
    text: "password=Welcome123",
    raw: "Welcome123"
  },
  {
    name: "Weak contextual token",
    text: "token=blue-team-prod",
    raw: "blue-team-prod"
  },
  {
    name: "Weak contextual client secret",
    text: "client_secret=manual-rotation-needed",
    raw: "manual-rotation-needed"
  }
];

const SAFE_CONTROL_CASES = [
  {
    name: "normal English paragraph",
    text: "The rollout summary explains deployment status, risks, and next review steps.",
    preserved: ["deployment status", "next review steps"]
  },
  {
    name: "normal cloud architecture docs",
    text: "The architecture uses queues, workers, object storage, and regional failover.",
    preserved: ["queues", "regional failover"]
  },
  {
    name: "AWS ARN without credential context",
    text: "The ARN format is arn:aws:iam::123456789012:role/example.",
    preserved: ["arn:aws:iam::123456789012:role/example"]
  },
  {
    name: "AWS account ID without sensitive context",
    text: "AWS account IDs are 12-digit identifiers such as 123456789012.",
    preserved: ["123456789012"]
  },
  {
    name: "Azure IDs as documentation metadata",
    text:
      "The Azure tenant_id, subscription_id, and client_id fields identify directory and app registration metadata.",
    preserved: ["tenant_id", "subscription_id", "client_id"]
  },
  {
    name: "UUID alone",
    text: "Reference UUID 123e4567-e89b-12d3-a456-426614174000 appears in docs.",
    preserved: ["123e4567-e89b-12d3-a456-426614174000"]
  },
  {
    name: "ISO timestamp",
    text: "2026-06-18T09:30:00Z INFO request completed.",
    preserved: ["2026-06-18T09:30:00Z"]
  },
  {
    name: "git commit hash",
    text: "Commit 9fceb02a6b3e8f7a1c2d3e4f5a6b7c8d9e0f1234 fixed the deployment.",
    preserved: ["9fceb02a6b3e8f7a1c2d3e4f5a6b7c8d9e0f1234"]
  },
  {
    name: "SHA256-like hash without secret context",
    text: "Artifact checksum abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890.",
    preserved: ["abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"]
  },
  {
    name: "public SSH key body with email comment",
    text:
      "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDSyntheticPublicKeyBodyOnly jane.doe@company.test",
    preserved: ["ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDSyntheticPublicKeyBodyOnly"],
    redactedEmails: ["jane.doe@company.test"]
  },
  {
    name: "plain domain",
    text: "The docs are hosted at example.org for this smoke test.",
    preserved: ["example.org"]
  },
  {
    name: "plain URL without credentials",
    text: "Open https://example.org/docs/runbook for the procedure.",
    preserved: ["https://example.org/docs/runbook"]
  },
  {
    name: "GitHub repo URL",
    text: "Repository URL https://github.com/example/project is public metadata.",
    preserved: ["https://github.com/example/project"]
  },
  {
    name: "GitLab repo URL",
    text: "Repository URL https://gitlab.com/example/project is public metadata.",
    preserved: ["https://gitlab.com/example/project"]
  },
  {
    name: "Slack workspace URL",
    text: "Workspace URL https://teamname.slack.com is not a token.",
    preserved: ["https://teamname.slack.com"]
  },
  {
    name: "Kubernetes names",
    text: "Kubernetes pod api-prod-runner-7d9f, deployment api-prod-runner, and service api-prod stay visible.",
    preserved: ["api-prod-runner-7d9f", "deployment api-prod-runner", "service api-prod"]
  },
  {
    name: "Docker image name",
    text: "Image ghcr.io/example/api-prod-runner:2026.06 is deployed.",
    preserved: ["ghcr.io/example/api-prod-runner:2026.06"]
  },
  {
    name: "Terraform resource name",
    text: 'resource "aws_iam_role" "svc_reporting" {}',
    preserved: ['resource "aws_iam_role" "svc_reporting" {}']
  },
  {
    name: "Windows path",
    text: "Normal Windows path C:\\Users\\qa\\Documents\\release-notes.txt stays visible.",
    preserved: ["C:\\Users\\qa\\Documents\\release-notes.txt"]
  },
  {
    name: "Linux path",
    text: "Normal Linux path /var/log/app/service.log stays visible.",
    preserved: ["/var/log/app/service.log"]
  },
  {
    name: "ticket IDs",
    text: "Tickets INC-12345, CHG0042187, and RITM0012345 are references.",
    preserved: ["INC-12345", "CHG0042187", "RITM0012345"]
  },
  {
    name: "normal human names in prose",
    text: "Jane Doe and Sam Patel reviewed the deployment plan.",
    preserved: ["Jane Doe", "Sam Patel"]
  },
  {
    name: "canonical placeholders",
    text: "[PWM_1] [PWM_22] [PWM_999]",
    preserved: ["[PWM_1]", "[PWM_22]", "[PWM_999]"]
  }
];

const MUTATION_SECRET = "MutationClientSecret123!";
const MUTATION_CASES = [
  ["KEY=value", `CLIENT_SECRET=${MUTATION_SECRET}`],
  ["KEY = value", `CLIENT_SECRET = ${MUTATION_SECRET}`],
  ["KEY: value", `CLIENT_SECRET: ${MUTATION_SECRET}`],
  ['"KEY": "value"', `"client_secret": "${MUTATION_SECRET}"`],
  ["'KEY': 'value'", `'client_secret': '${MUTATION_SECRET}'`],
  ['KEY="value",', `CLIENT_SECRET="${MUTATION_SECRET}",`],
  ["KEY='value';", `CLIENT_SECRET='${MUTATION_SECRET}';`],
  [
    "YAML multiline",
    [
      "private_key: |",
      "  -----BEGIN PRIVATE KEY-----",
      "  MutationPrivateKeyBody1234567890",
      "  -----END PRIVATE KEY-----"
    ].join("\n"),
    "MutationPrivateKeyBody1234567890"
  ],
  [
    "JSON escaped newlines",
    '{"private_key":"-----BEGIN PRIVATE KEY-----\\nMutationJsonPrivateKeyBody1234567890\\n-----END PRIVATE KEY-----\\n"}',
    "MutationJsonPrivateKeyBody1234567890"
  ],
  ["Markdown code fence", ["```env", `CLIENT_SECRET=${MUTATION_SECRET}`, "```"].join("\n")],
  ["shell export", `export CLIENT_SECRET=${MUTATION_SECRET}`],
  ["comments before and after", `# rotate before release\nCLIENT_SECRET=${MUTATION_SECRET} # local only`],
  ["trailing punctuation", `client_secret is ${MUTATION_SECRET}.`],
  ["tabs and multiple spaces", `CLIENT_SECRET\t=\t  ${MUTATION_SECRET}`],
  ["CRLF line endings", `safe=value\r\nCLIENT_SECRET=${MUTATION_SECRET}\r\nnext=value`],
  ["secrets near normal text", `Please rotate this client_secret=${MUTATION_SECRET} after the dry run.`],
  ["secrets inside logs", `2026-06-18 WARN client_secret=${MUTATION_SECRET} request_id=req-demo`]
].map(([name, text, raw = MUTATION_SECRET]) => ({ name, text, raw }));

function commonFileLines(secret, email) {
  return [
    "SAFE_URL=https://example.org/runbook",
    "SAFE_TICKET=INC-12345",
    "SAFE_PLACEHOLDER=[PWM_22]",
    `API_TOKEN=${secret}`,
    `OWNER_EMAIL=${email}`,
    "REGION=eu-central-1"
  ];
}

const TEXT_FILE_FIXTURES = [
  [".txt", "plain.txt", "text/plain", commonFileLines("FileTxtToken1234567890", "txt.owner@company.test").join("\n")],
  [".env", ".env", "text/plain", commonFileLines("FileEnvToken1234567890", "env.owner@company.test").join("\n")],
  [
    ".json",
    "config.json",
    "application/json",
    JSON.stringify({
      safe_url: "https://example.org/runbook",
      safe_placeholder: "[PWM_22]",
      token: "FileJsonToken1234567890",
      owner_email: "json.owner@company.test",
      region: "eu-central-1"
    })
  ],
  [
    ".yaml",
    "deployment.yaml",
    "text/yaml",
    [
      "safe_url: https://example.org/runbook",
      "safe_placeholder: [PWM_22]",
      "token: FileYamlToken1234567890",
      "owner_email: yaml.owner@company.test",
      "region: eu-central-1"
    ].join("\n")
  ],
  [
    ".yml",
    "deployment.yml",
    "text/yaml",
    [
      "safe_url: https://example.org/runbook",
      "safe_placeholder: [PWM_22]",
      "token: FileYmlToken1234567890",
      "owner_email: yml.owner@company.test",
      "region: eu-central-1"
    ].join("\n")
  ],
  [
    ".log",
    "application.log",
    "text/plain",
    [
      "INFO safe_url=https://example.org/runbook request_id=req-demo",
      "WARN Authorization: Bearer FileLogBearerToken1234567890",
      "INFO owner_email=log.owner@company.test"
    ].join("\n")
  ],
  [
    ".md",
    "README.md",
    "text/markdown",
    [
      "# Runbook",
      "Safe URL https://example.org/runbook",
      "Existing placeholder [PWM_22]",
      "```env",
      "API_TOKEN=FileMarkdownToken1234567890",
      "OWNER_EMAIL=md.owner@company.test",
      "```"
    ].join("\n")
  ],
  [
    ".html",
    "page.html",
    "text/html",
    '<a href="https://example.org/runbook">safe</a><script type="application/json">{"token":"FileHtmlToken1234567890","email":"html.owner@company.test","placeholder":"[PWM_22]"}</script>'
  ],
  [
    ".js",
    "app.js",
    "text/javascript",
    'const safeUrl = "https://example.org/runbook";\nconst token = "FileJsToken1234567890";\nconst owner = "js.owner@company.test";\nconst placeholder = "[PWM_22]";'
  ],
  [
    ".ps1",
    "deploy.ps1",
    "text/plain",
    '$SafeUrl = "https://example.org/runbook"\n$Env:API_TOKEN = "FilePs1Token1234567890"\n$OwnerEmail = "ps1.owner@company.test"\n$Placeholder = "[PWM_22]"'
  ],
  [
    ".csv",
    "secrets.csv",
    "text/csv",
    "kind,value\nsafe_url,https://example.org/runbook\napi_token,FileCsvToken1234567890\nowner_email,csv.owner@company.test\nplaceholder,[PWM_22]"
  ],
  [
    ".xml",
    "settings.xml",
    "application/xml",
    "<settings><safe>https://example.org/runbook</safe><token>FileXmlToken1234567890</token><email>xml.owner@company.test</email><placeholder>[PWM_22]</placeholder></settings>"
  ],
  [
    ".ini",
    "settings.ini",
    "text/plain",
    "[safe]\nurl=https://example.org/runbook\nplaceholder=[PWM_22]\n[secrets]\ntoken=FileIniToken1234567890\nemail=ini.owner@company.test"
  ],
  [
    "kubeconfig YAML",
    "kubeconfig.yaml",
    "text/yaml",
    [
      "apiVersion: v1",
      "clusters: []",
      "users:",
      "- name: svc",
      "  user:",
      "    token: FileKubeToken1234567890",
      "metadata:",
      "  safe_url: https://example.org/runbook",
      "  placeholder: [PWM_22]",
      "  owner_email: kube.owner@company.test"
    ].join("\n")
  ]
].map(([label, fileName, mimeType, text]) => {
  const secrets = [];
  const emailMatches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  const tokenMatches = text.match(/File[A-Za-z0-9]+(?:Token|BearerToken)[A-Za-z0-9]*/g) || [];
  secrets.push(...emailMatches, ...tokenMatches);
  return {
    label,
    fileName,
    mimeType,
    text,
    secrets,
    safeValues: ["https://example.org/runbook", "[PWM_22]"].filter((value) => text.includes(value))
  };
});

const UNSUPPORTED_FILE_FIXTURES = [
  { fileName: "main.tf", mimeType: "text/plain", text: 'token = "UnsupportedTfToken1234567890"' },
  { fileName: "terraform.tfvars", mimeType: "text/plain", text: 'token = "UnsupportedTfvarsToken1234567890"' },
  { fileName: "config.properties", mimeType: "text/plain", text: "token=UnsupportedPropertiesToken1234567890" },
  {
    fileName: "config.dockerconfigjson",
    mimeType: "application/json",
    text: '{"auths":{"registry.local":{"auth":"UnsupportedDockerConfigToken1234567890"}}}'
  },
  { fileName: "archive.zip", mimeType: "application/zip", text: "ZipTokenShouldNeverFallback1234567890" },
  { fileName: "legacy.doc", mimeType: "application/msword", text: "LegacyDocTokenShouldNeverFallback1234567890" }
];

function bufferFromText(text) {
  return new TextEncoder().encode(String(text)).buffer;
}

function escapePdfText(text) {
  return String(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function makePdf(text) {
  const stream = `BT\n/F1 12 Tf\n72 720 Td\n(${escapePdfText(text)}) Tj\nET\n`;
  return bufferFromText(
    [
      "%PDF-1.4",
      "1 0 obj",
      "<< /Type /Catalog /Pages 2 0 R >>",
      "endobj",
      "2 0 obj",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "endobj",
      "3 0 obj",
      "<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>",
      "endobj",
      "4 0 obj",
      `<< /Length ${stream.length} >>`,
      "stream",
      stream,
      "endstream",
      "endobj",
      "trailer",
      "<< /Root 1 0 R >>",
      "%%EOF"
    ].join("\n")
  );
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function writeUInt32LE(buffer, value, offset) {
  buffer.writeUInt32LE(value >>> 0, offset);
}

function makeZip(entries) {
  const chunks = [];
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const raw = Buffer.from(String(entry.data || ""), "utf8");
    const method = entry.method ?? 0;
    const compressed = method === 8 ? zlib.deflateRawSync(raw) : raw;
    const header = Buffer.alloc(30);
    writeUInt32LE(header, 0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0, 6);
    header.writeUInt16LE(method, 8);
    writeUInt32LE(header, 0, 14);
    writeUInt32LE(header, compressed.length, 18);
    writeUInt32LE(header, raw.length, 22);
    header.writeUInt16LE(name.length, 26);
    chunks.push(header, name, compressed);
  }
  const buffer = Buffer.concat(chunks);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function docxDocumentXml(text) {
  const paragraphs = String(text)
    .split("\n")
    .map((line) => `<w:p><w:r><w:t>${escapeXml(line)}</w:t></w:r></w:p>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}</w:body></w:document>`;
}

function makeDocx(text) {
  return makeZip([
    {
      name: "[Content_Types].xml",
      data: '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>'
    },
    {
      name: "word/document.xml",
      data: docxDocumentXml(text)
    }
  ]);
}

function makeXlsx(text) {
  return makeZip([
    {
      name: "xl/workbook.xml",
      data:
        '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets><sheet name="Secrets" sheetId="1"/></sheets></workbook>'
    },
    {
      name: "xl/sharedStrings.xml",
      data: `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>${escapeXml(text)}</t></si></sst>`
    },
    {
      name: "xl/worksheets/sheet1.xml",
      data:
        '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row></sheetData></worksheet>'
    }
  ]);
}

function createDocumentFixtures() {
  return [
    {
      label: ".pdf",
      fileName: "extreme.pdf",
      mimeType: "application/pdf",
      buffer: makePdf("API_TOKEN=FilePdfToken1234567890\nOWNER_EMAIL=pdf.owner@company.test\nSAFE_PLACEHOLDER=[PWM_22]"),
      secrets: ["FilePdfToken1234567890", "pdf.owner@company.test"],
      safeValues: ["[PWM_22]"]
    },
    {
      label: ".docx",
      fileName: "extreme.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: makeDocx("API_TOKEN=FileDocxToken1234567890\nOWNER_EMAIL=docx.owner@company.test\nSAFE_PLACEHOLDER=[PWM_22]"),
      secrets: ["FileDocxToken1234567890", "docx.owner@company.test"],
      safeValues: ["[PWM_22]"]
    },
    {
      label: ".xlsx",
      fileName: "extreme.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: makeXlsx("API_TOKEN=FileXlsxToken1234567890\nOWNER_EMAIL=xlsx.owner@company.test\nSAFE_PLACEHOLDER=[PWM_22]"),
      secrets: ["FileXlsxToken1234567890", "xlsx.owner@company.test"],
      safeValues: ["[PWM_22]"]
    }
  ];
}

const IMAGE_FIXTURES = [
  {
    label: ".png metadata-only image",
    fileName: "pixel-secret.png",
    mimeType: "image/png",
    buffer: bufferFromText("PNG bytes include PixelImageTokenShouldNotBeRead1234567890"),
    forbiddenPixelText: "PixelImageTokenShouldNotBeRead1234567890"
  },
  {
    label: ".jpg metadata-only image",
    fileName: "pixel-secret.jpg",
    mimeType: "image/jpeg",
    buffer: bufferFromText("JPEG bytes include PixelJpgTokenShouldNotBeRead1234567890"),
    forbiddenPixelText: "PixelJpgTokenShouldNotBeRead1234567890"
  }
];

const AI_GRAY_ZONE_REDACT_CASES = [
  ["token=blue-team-prod", "blue-team-prod"],
  ["secret=backup-prod", "backup-prod"],
  ["client_secret=manual-rotation-needed", "manual-rotation-needed"],
  ['provider "examplecloud" {\n  token = "synthetic-token-blue-prod"\n}', "synthetic-token-blue-prod"],
  ["temporary password is Welcome2026", "Welcome2026"],
  ["break-glass account: svc-prod-backup", "svc-prod-backup"],
  ["service_account=svc-prod-backup", "svc-prod-backup"]
].map(([text, raw]) => ({ text, raw }));

const AI_GRAY_ZONE_KEEP_CASES = [
  "The service is named svc-prod-backup.",
  "The Kubernetes deployment is called api-prod-runner.",
  "The Terraform module creates svc-reporting.",
  "This document explains password policy.",
  "This runbook mentions tokens conceptually but gives no token.",
  "The Azure tenant_id field identifies a directory.",
  "TOKEN=[PWM_12]"
];

const DEBUG_FORBIDDEN_STRINGS = [
  "DebugPassword123!",
  "DebugToken1234567890",
  "sk-proj-DebugApiKey1234567890",
  "customer-secret.env",
  "C:\\Users\\qa\\Documents\\customer-secret.env",
  "/home/qa/customer-secret.env",
  "composer full user content with DebugToken1234567890",
  "-----BEGIN PRIVATE KEY-----"
];

module.exports = {
  AI_GRAY_ZONE_KEEP_CASES,
  AI_GRAY_ZONE_REDACT_CASES,
  DEBUG_FORBIDDEN_STRINGS,
  IMAGE_FIXTURES,
  MUTATION_CASES,
  POSITIVE_CASES,
  SAFE_CONTROL_CASES,
  TEXT_FILE_FIXTURES,
  TRUSTED_PLACEHOLDER,
  UNSUPPORTED_FILE_FIXTURES,
  bufferFromText,
  createDocumentFixtures
};
