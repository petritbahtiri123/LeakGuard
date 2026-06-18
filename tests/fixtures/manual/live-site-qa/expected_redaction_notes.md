# Expected Redaction Notes

Use these notes with the synthetic live-site QA payloads in this directory.

Expected placeholder families:

- `[AZURE_RG_N]`
- `[STORAGE_ACCOUNT_N]`
- `[AZURE_TENANT_ID_N]`
- `[AZURE_SUBSCRIPTION_ID_N]`
- `[AWS_ARN_N]`
- `[AWS_ACCOUNT_ID_N]`
- `[GCP_PROJECT_N]`
- `[OTC_RESOURCE_N]`
- `[OPENSTACK_PROJECT_ID_N]`
- `[K8S_NAMESPACE_N]`
- `[K8S_SECRET_N]`
- `[PRIVATE_IP_N]`
- `[PRIVATE_CIDR_N]`
- `[UNC_PATH_N]`
- `[SPN_N]`
- `[LDAP_DN_N]`
- `[FILE_SHARE_N]`
- `[AD_GROUP_N]`
- `[HOSTNAME_N]`
- `[USERNAME_N]`
- `[EMAIL_N]`

Harmless controls that should remain visible in detector-only fixture validation:

- `rg-blue`
- `rg-test`
- `product-roadmap-item`
- `invoice 123456789012`
- `8.8.8.8`
- `192.0.2.44`
- `192.0.2.0/24`
- `docs/page`
- `service/name`
- `123e4567-e89b-12d3-a456-426614174000`
- `report.final.docx`
- `package.name`

Manual browser paths may pseudonymize public IP values according to the active prompt transform mode. Treat private IP and private CIDR leakage as a release blocker.
