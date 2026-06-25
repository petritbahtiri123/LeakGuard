# Prompt Comprehension Manual QA Cases

All values below are synthetic and are only for local LeakGuard QA. Do not replace them with real secrets, production hostnames, customer paths, or private files.

## Case PC-001: SMB migration with UNC paths

Original synthetic input:

```text
Create a PowerShell script to migrate SMB shares from SERVER01 to SERVER02 while preserving NTFS permissions. Source path is \\filesrv01\Finance and target path is \\filesrv02\FinanceArchive. Do not copy open files.
```

Expected sanitized prompt pattern:

```text
Create a PowerShell script to migrate SMB shares from SERVER01 to SERVER02 while preserving NTFS permissions. Source path is [UNC_PATH_N] and target path is [UNC_PATH_N]. Do not copy open files.
```

Expected preserved meaning: The model should understand this is an SMB migration task, that source and target shares exist, and that NTFS permissions and open-file handling matter.

Expected placeholder count/type: Two UNC/file-share placeholders if file-share metadata detection is active; otherwise no raw UNC server/share names may remain if the detector classifies them as sensitive.

Pass/fail criteria: Pass if the final composer text is understandable, contains no raw synthetic UNC path when classified sensitive, has no LeakGuard/debug/status text, and does not duplicate placeholders after re-render.

## Case PC-002: Azure subscription and tenant command

Original synthetic input:

```text
Fix this Azure CLI command that fails against subscription 7f2b8c9d-1234-4abc-8def-123456789abc and tenant 123e4567-e89b-12d3-a456-426614174000: az account set --subscription 7f2b8c9d-1234-4abc-8def-123456789abc && az login --tenant 123e4567-e89b-12d3-a456-426614174000
```

Expected sanitized prompt pattern:

```text
Fix this Azure CLI command that fails against subscription [AZURE_SUBSCRIPTION_ID_N] and tenant [AZURE_TENANT_ID_N]: az account set --subscription [AZURE_SUBSCRIPTION_ID_N] && az login --tenant [AZURE_TENANT_ID_N]
```

Expected preserved meaning: The model should understand the failure involves Azure CLI subscription/tenant targeting and should be able to reason about `az account set` and `az login --tenant`.

Expected placeholder count/type: Four Azure metadata placeholders with stable reuse for repeated subscription and tenant values.

Pass/fail criteria: Pass if repeated IDs reuse deterministic placeholders, command flags remain visible, and no raw GUID values remain.

## Case PC-003: Private IP log investigation

Original synthetic input:

```text
Explain this log from private IP 10.10.20.15 connecting to 10.10.30.25 over SMB and failing with STATUS_ACCESS_DENIED. The host also tried \\filesrv01\Finance.
```

Expected sanitized prompt pattern:

```text
Explain this log from private IP [NET_N] connecting to [NET_N] over SMB and failing with STATUS_ACCESS_DENIED. The host also tried [UNC_PATH_N].
```

Expected preserved meaning: The model should understand this is an internal network/SMB access-denied investigation involving two private hosts and a UNC path.

Expected placeholder count/type: Two private network/IP placeholders and one UNC/file-share placeholder when those categories are classified sensitive.

Pass/fail criteria: Pass if the log intent, protocol, and error string remain visible and no status/debug copy is added.

## Case PC-004: GPO and registry hardening

Original synthetic input:

```text
Generate a GPO path and registry setting for blocking removable storage under HKLM\Software\Policies\ExampleCorp\DeviceControl. Include rollback steps.
```

Expected sanitized prompt pattern:

```text
Generate a GPO path and registry setting for blocking removable storage under HKLM\Software\Policies\ExampleCorp\DeviceControl. Include rollback steps.
```

Expected preserved meaning: The model should understand this is a Windows hardening request and should preserve the registry path unless policy classifies the organization segment as sensitive.

Expected placeholder count/type: Zero by default; if an enterprise policy classifies the organization path segment, the prompt must still preserve GPO/registry intent.

Pass/fail criteria: Pass if no unnecessary placeholder-heavy output is created and no LeakGuard UI copy enters the composer.

## Case PC-005: `.env` review

Original synthetic input:

```text
Review this .env file and tell me what is risky:
API_KEY=sk-test-abcdefghijklmnopqrstuvwxyz123456
DB_PASSWORD=CorrectHorseBatteryStaple42!
APP_MODE=production
```

Expected sanitized prompt pattern:

```text
Review this .env file and tell me what is risky:
API_KEY=[PWM_N]
DB_PASSWORD=[PWM_N]
APP_MODE=production
```

Expected preserved meaning: The model should understand it is reviewing an environment file, see which variables were secret-bearing, and preserve non-secret configuration.

Expected placeholder count/type: Two generic secret placeholders.

Pass/fail criteria: Pass if labels and `APP_MODE=production` remain visible, raw synthetic secret values are absent, and placeholders are not duplicated by repeated submit attempts.

## Case PC-006: Kubernetes secret reference

Original synthetic input:

```text
Explain whether this Kubernetes command is safe: kubectl create secret generic db-creds --from-literal=username=appuser --from-literal=password=KubeManualPass123456! --namespace payments-prod
```

Expected sanitized prompt pattern:

```text
Explain whether this Kubernetes command is safe: kubectl create secret generic [K8S_SECRET_N] --from-literal=username=[PWM_N] --from-literal=password=[PWM_N] --namespace [K8S_NAMESPACE_N]
```

Expected preserved meaning: The model should understand this is a Kubernetes secret creation command and can assess risks around literals, namespace, and secret management.

Expected placeholder count/type: Kubernetes secret/namespace placeholders when enterprise metadata detection is active, plus generic secret placeholders for literal credentials.

Pass/fail criteria: Pass if command structure remains readable, literals are redacted, and no raw synthetic password remains.

## Case PC-007: AWS/GCP mixed cloud configuration

Original synthetic input:

```text
Review this deployment note: AWS account 210987654321 deploys to GCP project lg-prod-project-123. The GitHub token is ghp_abcdefghijklmnopqrstuvwxyz1234567890 and the operator email is qa.operator@example.invalid.
```

Expected sanitized prompt pattern:

```text
Review this deployment note: AWS account [AWS_ACCOUNT_ID_N] deploys to GCP project [GCP_PROJECT_N]. The GitHub token is [PWM_N] and the operator email is [EMAIL_N].
```

Expected preserved meaning: The model should understand this is a mixed-cloud deployment review with a redacted token and operator identity.

Expected placeholder count/type: AWS account, GCP project, generic token, and email placeholders.

Pass/fail criteria: Pass if cloud/provider roles remain understandable, token and email values are gone, and placeholder count is stable across repeated captures.
