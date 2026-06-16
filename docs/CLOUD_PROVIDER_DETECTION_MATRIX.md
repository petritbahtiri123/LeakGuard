# Cloud Provider Detection Matrix

LeakGuard treats cloud and enterprise infrastructure identifiers as internal metadata. They are not always credentials, but they can disclose architecture, tenants, projects, accounts, networks, access paths, regions, and naming standards when pasted into protected AI chat sites.

All detection is deterministic and local-only. LeakGuard does not send samples, identifiers, files, or detection results to remote APIs, AI services, telemetry, or training systems. Fixtures must remain synthetic; real customer or internal data must never be committed.

## Provider coverage

| Family | Examples | Placeholder families | False-positive controls |
| --- | --- | --- | --- |
| Azure | Resource groups, VNets/subnets, private endpoints, storage accounts, Azure service endpoints | `[AZURE_RG_N]`, `[CLOUD_RESOURCE_N]`, `[STORAGE_ACCOUNT_N]`, `[CLOUD_ENDPOINT_N]` | Resource prefixes plus environment, service, location, and Azure context scoring. |
| AWS | ARNs, account IDs with AWS/account context, EC2/VPC/subnet/security-group IDs, S3 buckets/endpoints | `[AWS_ARN_N]`, `[AWS_ACCOUNT_ID_N]`, `[AWS_RESOURCE_ID_N]`, `[S3_BUCKET_N]`, `[AWS_ENDPOINT_N]` | AWS IDs use known formats; account IDs require nearby AWS/account/ARN/IAM context. |
| GCP | Project IDs/numbers, service accounts, Compute resource paths, GKE/GCS resources and buckets | `[GCP_PROJECT_N]`, `[GCP_PROJECT_NUMBER_N]`, `[GCP_SERVICE_ACCOUNT_N]`, `[GCP_RESOURCE_N]`, `[GCS_BUCKET_N]` | Project numbers require explicit keys; buckets/resources require GCP URI/path/service-account shape. |
| OTC / T Cloud Public / Open Telekom Cloud | OTC/ECS/EVS/VPC/OBS/CCE/RDS/ELB resource names and OTC OBS endpoints | `[OTC_RESOURCE_N]`, `[OBS_BUCKET_N]`, `[OTC_ENDPOINT_N]` | OTC/OpenStack provider context, service prefixes, environment/location scoring, and endpoint suffixes. |
| OpenStack | Project, tenant, domain, user, server, instance, volume, image, flavor, network, subnet, port IDs | `[OPENSTACK_PROJECT_ID_N]`, `[OPENSTACK_TENANT_ID_N]`, `[OPENSTACK_DOMAIN_ID_N]`, `[OPENSTACK_USER_ID_N]`, `[OPENSTACK_RESOURCE_ID_N]` | UUID/32-hex values redact only in strict key/value ID contexts; GUIDs are not globally redacted. |
| Kubernetes | Clusters, contexts, namespaces, resources, secrets, kubeconfig certificate/key/token data | `[K8S_CLUSTER_N]`, `[K8S_NAMESPACE_N]`, `[K8S_RESOURCE_N]`, `[K8S_SECRET_N]`, `[KUBECONFIG_SECRET_N]` | Kubernetes resource syntax or context keys are required; kubeconfig secrets redact aggressively. |
| Generic enterprise/network/identity | Internal endpoints, hostnames/FQDNs, AD groups, usernames, emails | `[INTERNAL_ENDPOINT_N]`, `[CLOUD_ENDPOINT_N]`, `[HOSTNAME_N]`, `[AD_GROUP_N]`, `[USERNAME_N]`, `[EMAIL_N]` | Internal suffixes, provider endpoint suffixes, identity context, filename/package suppression, and scoring gates. |

## Design notes

- Detection is provider-aware rather than entropy-driven; global entropy thresholds are not lowered.
- Cloud IDs that look like common GUIDs, 32-character hex strings, or 12-digit numbers are redacted only with provider-specific key/value or context evidence.
- Harmless prose, product names, filenames, package names, ordinary public URLs, and cloud-looking examples without enough provider context should remain visible.
