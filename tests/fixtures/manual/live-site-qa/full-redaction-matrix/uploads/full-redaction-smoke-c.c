LeakGuard full redaction smoke upload fixture
Supported extension: .c
Use this file for protected-site upload, file drop, and scanner QA.
All values below are fake synthetic detector samples.
LeakGuard full synthetic redaction smoke payload
================================================

Use this file for manual QA:
- Copy/paste the whole file or one section into a protected composer.
- Upload/drop this .txt file into a protected composer or the LeakGuard File Scanner.
- All values below are synthetic examples. Do not replace them with real secrets.

Expected broad result:
- Secrets, auth headers, URL credentials, cloud identifiers, public IPs/CIDRs, and enterprise metadata should become placeholders.
- Safe controls near the bottom should remain visible.


SECTION 1 - Common API keys, tokens, and private keys
----------------------------------------------------
OPENAI_API_KEY=sk-proj-A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0
ANTHROPIC_API_KEY=sk-ant-api03-AlphaBetaGammaDelta1234567890uvwx
GOOGLE_API_KEY=AIzaSyD4nQ7Lp2Vm5Xc8Rt1Bg4Hj7Km0Np3Qs6Tu9W
GOOGLE_CLIENT_SECRET=GOCSPX-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789
GOOGLE_REFRESH_TOKEN=1//0xA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6
GITHUB_TOKEN=ghp_A1b2C3d4E5f6G7h8I9j0K1l2M3
GITHUB_FINE_GRAINED_PAT=github_pat_AbCdEfGhIjKlMnOpQrStUvWxYz1234567890
GITLAB_TOKEN=glpat-1Ab2Cd3Ef4Gh5Ij6Kl7Mn8Op
SLACK_BOT_TOKEN=xoxb-123456789012-123456789012-AbCdEfGhIjKlMnOpQr
SLACK_WEBHOOK=https://hooks.slack.com/services/T8NQ7M2LP/B8NQ7M2LP/AbCdEfGhIjKlMnOpQrStUvWx
DISCORD_WEBHOOK=https://discord.com/api/webhooks/123456789012345678/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789
STRIPE_SECRET_KEY=sk_live_51NqR7ZaBcDeFgHiJkLmNoPqRsTuVwXy123456
STRIPE_WEBHOOK_SECRET=whsec_AbCdEfGhIjKlMnOpQrStUvWxYz123456
SENDGRID_API_KEY=SG.QWxwaGFCZXRhR2FtbWExMjM0NTY3ODkw.QmV0YUdhbW1hRGVsdGFFcHNpbG9uMTIzNDU2Nzg5MEFCQ0RFRg
NPM_TOKEN=npm_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8
PYPI_TOKEN=pypi-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-TOKENBLOCK
JWT_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJsZWFrZ3VhcmQiLCJzdWIiOiJzeW50aGV0aWMtdGVzdCIsInJvbGUiOiJhZG1pbiJ9.c2lnbmF0dXJlLXN5bnRoZXRpYy12YWx1ZS0xMjM0NTY3ODkw

-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDleakguardprivatekeymaterial
LeakGuardSyntheticOnly1234567890abcdefghijklmnopqrstuvwxyz
-----END PRIVATE KEY-----


SECTION 2 - HTTP headers, cookies, and query strings
---------------------------------------------------
Authorization: Bearer LeakGuardBearerToken_1234567890_abcdefghijklmnopqrstuvwxyz
Authorization: Basic bGVha2d1YXJkOnN5bnRoZXRpY1Bhc3MxMjMh
X-API-Key: HeaderApiKey1234567890abcdef
X-Auth-Token: HeaderAuthToken1234567890abcdef
Cookie: sessionid=LeakGuardSessionCookie1234567890abcdef; auth_token=LeakGuardAuthToken0987654321; csrftoken=SafeCsrfTokenExample
Set-Cookie: connect.sid=LeakGuardConnectSid1234567890abcdef; Path=/; HttpOnly
PUBLIC_API_URL=https://api.corp.internal/data?api_key=QueryApiKey1234567890&token=QueryToken0987654321&region=eu-central-1


SECTION 3 - Database URLs and URL credentials
--------------------------------------------
DATABASE_URL=postgres://admin:UltraDbPass7788!@db.prod.internal:5432/app
POSTGRES_URL=postgresql://appuser:LeakGuardPgPass123!@db.corp.internal:5432/leakguard
MYSQL_URL=mysql://reporter:RoutePass8899!@mysql.ops.internal:3306/analytics
MARIADB_URL=mariadb://maria:LeakGuardMariaPass123!@mariadb.ops.internal:3306/app
MONGO_URL=mongodb://mongoUser:LeakGuardMongo789!@mongo.corp.internal:27017/app
REDIS_URL=redis://:LeakGuardRedis123!@redis.corp.internal:6379/0
AMQP_URL=amqp://rabbitUser:LeakGuardRabbit456!@mq.corp.internal:5672/vhost
JDBC_URL=jdbc:sqlserver://sql.corp.internal:1433;databaseName=payroll;user=svc_payroll;password=LeakGuardJdbcPass123!
GIT_REMOTE=https://svcuser:LeakGuardGitPass123!@git.corp.internal/repo.git
PIP_INDEX_URL=https://pipuser:LeakGuardPipPass123!@pypi.corp.internal/simple


SECTION 4 - AWS
---------------
AWS_ACCESS_KEY_ID=AKIAQTESTEXAMPLE1234
AWS_SECRET_ACCESS_KEY=awsSecretExampleValue1234567890AbCdEf
AWS_SESSION_TOKEN=IQoJb3JpZ2luX2VjEJr//////////wEaCXVzLWVhc3QtMSJGMEQCIGLeakGuardSessionValue1234567890abcdefghijklmnop
AWS account id: 123456789012
AWS_ROLE_ARN=arn:aws:iam::123456789012:role/LeakGuardQaRole
AWS_KMS_KEY=arn:aws:kms:eu-central-1:123456789012:key/11111111-2222-3333-4444-555555555555
AWS_S3_URI=s3://company-prod-backup/path/file.txt
AWS_S3_ENDPOINT=company-prod-backup.s3.eu-central-1.amazonaws.com
AWS_PRIVATE_API=vpce-0abc123def4567890.execute-api.eu-central-1.vpce.amazonaws.com


SECTION 5 - Azure
-----------------
AZURE_CLIENT_SECRET=AzureClientSecretSynthetic9988!
AZURE_TENANT_ID=99999999-8888-7777-6666-555555555555
AZURE_SUBSCRIPTION_ID=11111111-2222-3333-4444-555555555555
AZURE_RESOURCE_GROUP=rg-prod-weu-files-001
AZURE_STORAGE_ACCOUNT=stdeberfileprd1234567
AZURE_STORAGE_KEY=DefaultEndpointsProtocol=https;AccountName=vaultstorage001;AccountKey=MDEyMzQ1Njc4OUFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW4=;EndpointSuffix=core.windows.net
AZURE_SERVICE_BUS=Endpoint=sb://prod-ingest.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=QWxwaGFCZXRhR2FtbWExMjM0NTY3ODkwQUJDREVGR0g=;EntityPath=events
AZURE_FILES_ENDPOINT=stdeberfileprd1234567.file.core.windows.net
AZURE_KEYVAULT=prod-weu-kv.vault.azure.net


SECTION 6 - GCP
---------------
GCP project_id: lg-prod-project-123
GCP project_number: 123456789012
GCP_SERVICE_ACCOUNT=svc-leakguard@lg-prod-project-123.iam.gserviceaccount.com
GCP_RESOURCE=//compute.googleapis.com/projects/my-prod-project/zones/europe-west3-a/instances/vm-prod-001
GCS_BUCKET=gs://lg-prod-secrets-backup
GCP_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"demo-visible-project","private_key_id":"abc123def456abc123def456abc123def456abcd","private_key":"-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASC_leakguard_key_material_only_1234567890\n-----END PRIVATE KEY-----\n","client_email":"svc-leakguard@lg-prod-project-123.iam.gserviceaccount.com"}


SECTION 7 - Docker, Kubernetes, and container configs
----------------------------------------------------
DOCKER_AUTH_CONFIG={"auths":{"https://index.docker.io/v1/":{"auth":"bGVha2d1YXJkLXVuaXQ6U3VwZXJTZWNyZXQxMjMh"}}}
Kubernetes namespace: prod-payments
Kubernetes context: prod-payments-eu-central-1
KUBE_CLUSTER=aks-prod-payments-001
KUBE_SECRET_RESOURCE=secret/db-password
kubeconfig token: eyJhbGciOiJSUzI1NiIsImtpZCI6Imt1YmUifQ.syntheticKubeTokenPayload1234567890.syntheticKubeSignatureValue1234567890
client-key-data: LS0tLS1CRUdJTiBSU0EgUFJJVkFURSBLRVktLS0tLUxlYWtHdWFyZEt1YmVTeW50aGV0aWNLZXlEYXRhMTIzNDU2Nzg5MA==


SECTION 8 - OpenStack and Open Telekom Cloud
--------------------------------------------
Open Telekom Cloud OTC resource otc-prod-de-ecs-001
OTC_BUCKET=obs-prod-backup-001
OTC_ENDPOINT=obs.eu-de.otc.t-systems.com
OpenStack project_id=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
OPENSTACK_TENANT_ID=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
OPENSTACK_DOMAIN_ID=cccccccccccccccccccccccccccccccc
OPENSTACK_SERVER_ID=dddddddd-dddd-dddd-dddd-dddddddddddd


SECTION 9 - Enterprise and internal metadata
--------------------------------------------
UNC_PATH=\\fs-prod-weu-01\FSA1234567\finance\payroll
FILE_SHARE=FSA1234567
AD_GROUP=AD123-SH070-FILE-L-STFSA1234567R
SPN=cifs/stdeberfileprd1234567.file.core.windows.net
LDAP_DN=CN=svc-backup-prod,OU=Service Accounts,OU=SH070,DC=corp,DC=local
INTERNAL_HOST=fs-prod-weu-01.corp.local
SERVICE_USERNAME=CORP\adm-test.user
SERVICE_EMAIL=svc-leakguard@corp.internal
INTERNAL_URL=https://api.prod.internal/v1/payments

| Group | Name | Value |
| ----- | ---- | ----- |
| Azure | Tenant ID | 99999999-8888-7777-6666-555555555555 |
| AWS | AWS Account | 123456789012 |
| GCP | Project ID | my-prod-project |
| Kubernetes | Namespace | prod-payments |
| Identity | Username | CORP\adm-test.user |
| LDAP | DN | CN=svc-backup-prod,OU=Service Accounts,OU=SH070,DC=corp,DC=local |


SECTION 10 - Natural language disclosures
-----------------------------------------
my password is HarborLock4455!
my token is ghr_AbCdEfGhIjKlMnOpQrStUvWx
Password -> "QuotedLock5566!"
Key -> "sk-proj-Q1w2E3r4T5y6U7i8O9p0A1s2D3f4G5h6J7k8L9m0"
secret "VaultAlias9988!"
Now mask this real value: PortBridge6677!


SECTION 11 - Public network data
--------------------------------
PUBLIC_HOST=45.67.89.10
PUBLIC_GATEWAY=45.67.89.1
PUBLIC_DNS=9.9.9.9
PUBLIC_CIDR=45.67.89.0/24
PUBLIC_CHILD_CIDR=45.67.89.128/25
CLOUDFLARE_PUBLIC=1.1.1.1


SECTION 12 - Internal network and safe controls
-----------------------------------------------
PRIVATE_HOST_EXPECT_PLACEHOLDER=192.168.1.10
PRIVATE_CIDR_EXPECT_PLACEHOLDER=10.0.0.0/8
LOOPBACK=127.0.0.1
LINK_LOCAL=169.254.10.20
DEFAULT_ROUTE=0.0.0.0/0
WILDCARD_MASK=0.0.0.255
DOCS_PLACEHOLDER=[PWM_42]
DOCS_TOKEN=replace_me
REGION=eu-central-1
VERSION=v1.2.3-beta
PUBLIC_DOC_URL=https://openai.com
LOCAL_PATH=/home/example/project/config.json
HARmless_TEXT=product-roadmap-item
DOCUMENTATION_EXAMPLE=docs/page
