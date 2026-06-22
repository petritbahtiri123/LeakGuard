# Managed Policy Schema Guide

This guide maps `config/managed_policy_schema.json` and the packaged policy defaults to admin-facing behavior.

LeakGuard enterprise policy is an in-extension control layer. Browser policy is still required for force install, extension removal prevention, incognito or InPrivate controls, and developer-mode restrictions.

## Policy Loading

Enterprise builds start from `config/policy.enterprise.json`, then merge valid values from browser managed storage when available.

Chrome enterprise builds declare:

```json
{
  "storage": {
    "managed_schema": "config/managed_policy_schema.json"
  }
}
```

Firefox enterprise builds include Gecko metadata but do not declare Chrome's managed schema field.

If `strictPolicyLoad` is enabled in enterprise mode and managed policy cannot be loaded or validated, LeakGuard fails closed for sensitive actions.

## Recommended Starting Policy

```json
{
  "destinationPolicies": [
    { "match": "https://chatgpt.com/*", "action": "redact" },
    { "match": "https://chat.openai.com/*", "action": "redact" },
    { "match": "https://claude.ai/*", "action": "redact" },
    { "match": "https://gemini.google.com/*", "action": "redact" },
    { "match": "https://grok.com/*", "action": "redact" },
    { "match": "http://*/*", "action": "block" }
  ],
  "defaultDestinationAction": "block",
  "managedProtectedSites": [],
  "allowReveal": false,
  "allowUserOverride": false,
  "allowProtectionPause": false,
  "allowUserAddedSites": false,
  "allowSiteRemoval": false,
  "allowFeedback": false,
  "auditMode": "metadata-only",
  "auditRetentionDays": 30,
  "strictPolicyLoad": true
}
```

Adjust the destination list to match the browsers and sites you have tested.

## Fields

| Field | Type | Values | Behavior |
| --- | --- | --- | --- |
| `enterpriseMode` | boolean | `true`, `false` | Determined by build target at runtime; managed input should not be used to convert a consumer build into enterprise mode. |
| `allowReveal` | boolean | `true`, `false` | Enables or disables secure reveal in extension-owned UI. |
| `allowUserOverride` | boolean | `true`, `false` | Controls whether `Allow once` is shown and honored. |
| `allowProtectionPause` | boolean | `true`, `false` | Controls whether protection pause is allowed. |
| `protectionPauseMaxMinutes` | number | `0` to `60` | Maximum pause duration. |
| `protectionPauseRequiresUserAction` | boolean | `true`, `false` | Requires explicit user action for pauses. |
| `allowUserAddedSites` | boolean | `true`, `false` | Controls whether users can add or re-enable extra protected sites. |
| `allowSiteRemoval` | boolean | `true`, `false` | Controls whether users can delete user-managed protected-site rules. |
| `allowFeedback` | boolean | `true`, `false` | Controls whether feedback entry points may be visible or available. Consumer builds default to `true`; enterprise builds default to `false`. Managed `false`, malformed managed feedback policy, or fail-closed policy state keeps feedback unavailable. |
| `blockHttpSecrets` | boolean | `true`, `false` | Enables stricter handling for HTTP destinations. |
| `redactHttpAggressively` | boolean | `true`, `false` | Applies more aggressive redaction for HTTP contexts. |
| `aiAssistEnabled` | boolean | `true`, `false` | Enables optional local ONNX AI assist. Disabling keeps deterministic detection active. |
| `defaultAction` | string | `redact`, `block` | Default action for sensitive content decisions. |
| `defaultDestinationAction` | string | `allow`, `redact`, `block` | Action used when `destinationPolicies` are configured and no specific destination rule matches. |
| `auditMode` | string | `off`, `metadata-only` | Controls metadata-only audit event storage. `full` is normalized to `metadata-only` in code for safety. |
| `auditRetentionDays` | number | `1` to `365` | Retention window for bounded metadata-only audit events. |
| `strictPolicyLoad` | boolean | `true`, `false` | In enterprise mode, fail closed if managed policy cannot be read or validated. |
| `managedProtectedSites` | string array | exact origins | Adds protected origins outside the built-in list. |
| `destinationPolicies` | object array | match/action objects | Preferred destination policy model. |
| `approvedDestinations` | string array | match patterns | Legacy allowlist compatibility path. |
| `blockedDestinations` | string array | match patterns | Legacy blocklist compatibility path. |

## Destination Policy Matching

`destinationPolicies` entries use browser-style match patterns:

```json
{ "match": "https://chatgpt.com/*", "action": "redact" }
```

Supported actions:

- `allow`
- `redact`
- `block`

When `destinationPolicies` is configured, the first matching entry determines the action. If no entry matches, `defaultDestinationAction` applies.

Legacy `approvedDestinations` and `blockedDestinations` still work when `destinationPolicies` is not configured. Prefer `destinationPolicies` for new deployments because it can express destination-specific redaction.

## Managed Protected Sites

`managedProtectedSites` should contain exact origins such as:

```json
{
  "managedProtectedSites": [
    "https://internal.example.com",
    "https://chat.example.org"
  ]
}
```

These origins tell LeakGuard what to protect. Browser host access still has to be granted through managed browser configuration for content-script enforcement to run.

## Audit Events

`auditMode: "metadata-only"` stores bounded events for blocked or redacted actions without raw prompts, raw secrets, or selected file contents. `auditRetentionDays` controls purge behavior.

Do not describe this as SIEM integration or compliance certification unless a separate deployment has built and validated that pipeline.

## Validation

After changing managed policy:

```bash
node tests/enterprise_policy.test.js
```

For release confidence after manifest or policy-schema changes:

```bash
node tests/build_targets.test.js
node tests/security.test.js
```

See [ENTERPRISE_DEPLOYMENT.md](ENTERPRISE_DEPLOYMENT.md) for browser-side deployment controls.
