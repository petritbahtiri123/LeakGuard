# Enterprise, Cloud, and Identity Detection

LeakGuard treats internal enterprise/cloud identifiers as sensitive internal metadata. These values are not always credentials, but they can reveal architecture, access-control structure, naming conventions, regions, environments, and ownership details when pasted into protected AI chat sites.

The enterprise/cloud detector family runs entirely locally in the extension. It does not send samples, identifiers, files, or detection results to any backend service.

## Covered identifier families

LeakGuard deterministically detects high-confidence examples of:

- Azure resource groups, using scored `rg-`, `rg_`, `rgrp-`, and `resource-group-` naming patterns.
- Azure/cloud resource names such as VNets, subnets, private endpoints, key vaults, AKS clusters, VMs, app gateways, Log Analytics workspaces, SQL/database resources, route tables, peers, NICs, and NSGs.
- Azure storage account names that follow internal `st` + location/purpose/environment/counter naming conventions.
- Siemens/GFS-style Active Directory file/access-control groups matching the strict `AD###-SH###-FILE-[LG]-...` convention.
- Hostnames and internal FQDNs such as `.local`, `.corp`, and `.internal` names.
- Windows domain users, service/admin accounts, and context-gated human dotted usernames.
- Email addresses, including admin/service-style mailboxes.

## False-positive controls

These identifiers are detected with deterministic scoring rather than broader entropy rules. The score uses naming prefixes plus environment, location, service/resource, domain-suffix, and nearby context signals. Low-signal values such as `rg-blue`, `rg-test` without richer context, ordinary hyphenated prose, filenames, package names, normal dotted words, harmless GUIDs, and hashes without secret context remain visible.

Entropy thresholds are not lowered for this feature. Unknown token-like secrets still use the existing entropy fallback, while normal Azure/internal resource names are handled by deterministic enterprise/cloud detectors.

## Protected-site behavior

When LeakGuard rewrites text for protected AI destinations, these internal metadata findings receive typed placeholders such as `[AZURE_RG_1]`, `[CLOUD_RESOURCE_1]`, `[STORAGE_ACCOUNT_1]`, `[AD_GROUP_1]`, `[HOSTNAME_1]`, `[USERNAME_1]`, and `[EMAIL_1]`. Existing credential/API-key/password placeholders continue to use the neutral `[PWM_N]` family.

## Internal network and directory metadata

Enterprise metadata detection also covers private IPv4/CIDR values, UNC paths, Kerberos SPNs, LDAP distinguished names, contextual file-share IDs, and Azure tenant/subscription IDs. These detections remain local-only and use strict structure or context gates so documentation IP ranges, public IPs, random GUIDs, normal slash paths, and ordinary comma-separated prose stay visible.
