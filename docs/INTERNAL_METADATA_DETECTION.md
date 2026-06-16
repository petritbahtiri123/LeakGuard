# Internal Metadata Detection

LeakGuard redacts internal network, directory, Kerberos, file-share, and Azure boundary metadata locally before text reaches protected AI destinations. These values are not always credentials, but they can reveal network topology, directory structure, Kerberos service paths, tenant/subscription boundaries, storage paths, and file-share migration structure.

Detection is deterministic and local-only. LeakGuard does not send samples, identifiers, files, or detection results to remote APIs, AI services, telemetry, or training systems. Fixtures must remain synthetic; real customer or internal data must never be committed.

## Covered families

- Private IPv4 addresses and private CIDR blocks: `[PRIVATE_IP_N]`, `[PRIVATE_CIDR_N]`.
- Windows UNC paths, including escaped JSON/JavaScript forms: `[UNC_PATH_N]`.
- Kerberos SPNs with known service prefixes such as `cifs`, `host`, `HTTP`, `MSSQLSvc`, `ldap`, `GC`, `DNS`, `RestrictedKrbHost`, `TERMSRV`, and `WSMAN`: `[SPN_N]`.
- LDAP distinguished names with at least two DN components: `[LDAP_DN_N]`.
- Contextual file-share/migration identifiers such as `FSA1234567`, `FSB1234567`, and `FS1234567`: `[FILE_SHARE_N]`.
- Azure tenant and subscription GUID values only with explicit key context: `[AZURE_TENANT_ID_N]`, `[AZURE_SUBSCRIPTION_ID_N]`.

## False-positive controls

- Documentation IP ranges (`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`) and public IPs stay visible.
- GUIDs are not redacted globally; Azure tenant/subscription IDs require explicit key names.
- File-share IDs require share, Azure Files, SMB, migration, ACL/RBAC, storage, GFS/NGFS, or similar context unless covered by a larger structure.
- SPNs require a known Kerberos service prefix, so normal slash paths remain visible.
- LDAP DN detection requires multiple `CN=`, `OU=`, or `DC=` components, avoiding ordinary comma-separated prose.
- Full structures are emitted with higher scores so UNC paths, LDAP DNs, SPNs, and CIDRs win over nested hostnames, usernames, file-share IDs, or IP addresses.
