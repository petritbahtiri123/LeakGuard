# Enterprise Deployment

Verified against the Chrome Enterprise and Microsoft Edge policy documentation on April 24, 2026.

LeakGuard can enforce destination `allow`, `redact`, and `block` rules, disable `Allow once`, restrict user-added sites, gate site removal, and write bounded metadata-only audit events from inside the extension. It cannot, by itself, guarantee installation, prevent browser-level removal, force incognito coverage, or stop unmanaged extension changes. Those controls still require browser policy.

## What LeakGuard Enforces In-Extension

- `destinationPolicies` supports explicit per-destination actions: `allow`, `redact`, and `block`.
- `defaultDestinationAction` controls what happens when no explicit destination policy matches.
- Legacy `approvedDestinations` and `blockedDestinations` still work as a compatibility fallback when `destinationPolicies` is not configured.
- `managedProtectedSites` lets enterprise policy define extra protected origins outside the built-in site list.
- `allowUserOverride` controls whether `Allow once` is shown and whether an override is honored.
- `allowUserAddedSites` controls whether users can add or re-enable extra protected sites.
- `allowSiteRemoval` now gates deletion of user-managed protected sites.
- `auditMode` stores bounded metadata-only events without raw secrets or full prompts.
- `strictPolicyLoad` can fail closed for sensitive actions if enterprise policy cannot be loaded safely.

Current enterprise defaults in this repo intentionally keep local testing flexibility:

- `allowUserAddedSites: false`
- `allowUserOverride: false`
- `allowSiteRemoval: true`

That last default is temporary by design so local remove/disable/test workflows keep working until you decide to hard-lock removal in managed policy.

## Chrome

Recommended browser-side controls:

- Force install the extension with `ExtensionSettings` using `installation_mode: "force_installed"` for the LeakGuard extension ID. Chrome's extension policy docs also support `ExtensionInstallForcelist` as a simpler force-install path.
- If you want to block users from installing or switching to other extensions, use `ExtensionSettings` with a restrictive default such as `* -> installation_mode: "blocked"` and then explicitly allow or force-install only approved IDs.
- Disable incognito with `IncognitoModeAvailability = 1` if you need guaranteed coverage. Chrome's admin guidance says extensions cannot be auto-enabled in Incognito by policy alone; users otherwise enable them manually in `chrome://extensions`.
- Restrict developer tooling with `DeveloperToolsAvailability`, and lock the extensions page developer toggle with `ExtensionDeveloperModeSettings`.

Operational note:

- Chrome's enterprise help specifically says admins cannot automatically install extensions in Incognito mode. If your policy goal is "LeakGuard must always be active," disabling incognito is the safer path.

## Edge

Recommended browser-side controls:

- Force install the extension with `ExtensionSettings` and `installation_mode: "force_installed"` or use `ExtensionInstallForcelist`.
- If you want to prevent unapproved extensions, use `ExtensionSettings` with a restrictive default policy and allow only approved IDs or update URLs.
- Disable InPrivate with `InPrivateModeAvailability` if you need guaranteed coverage.
- Restrict dev tools with `DeveloperToolsAvailability`.
- Lock the extensions page developer toggle with `ExtensionDeveloperModeSettings`.
- Consider `BlockExternalExtensions` if you also need to block external or side-loaded extension installation paths.

Operational note:

- Microsoft documents that `ExtensionInstallForcelist` does not apply to InPrivate mode, so InPrivate still needs separate browser policy treatment.

## Managed Policy Expectations For This Repo

For enterprise builds, prefer managed storage values for at least:

- `destinationPolicies`
- `defaultDestinationAction`
- `approvedDestinations`
- `blockedDestinations`
- `managedProtectedSites`
- `allowUserOverride`
- `allowUserAddedSites`
- `allowSiteRemoval`
- `auditMode`
- `strictPolicyLoad`

Suggested starting point:

```json
{
  "destinationPolicies": [
    { "match": "https://chatgpt.com/*", "action": "redact" },
    { "match": "https://chat.openai.com/*", "action": "redact" },
    { "match": "https://claude.ai/*", "action": "redact" },
    { "match": "https://web.whatsapp.com/*", "action": "block" }
  ],
  "managedProtectedSites": [
    "https://web.whatsapp.com"
  ],
  "defaultDestinationAction": "block",
  "allowUserOverride": false,
  "allowUserAddedSites": false,
  "allowSiteRemoval": true,
  "auditMode": "metadata-only",
  "strictPolicyLoad": true
}
```

If you are already using `approvedDestinations` and `blockedDestinations`, they still work. The new `destinationPolicies` model is the recommended path when you want destination-specific redaction rather than only allowlist/blocklist behavior.

`managedProtectedSites` controls which extra origins LeakGuard should actively protect. Browser site access still has to be available on those origins for content-script enforcement to run.

When you are ready to hard-lock protected-site deletion in production, set `allowSiteRemoval` to `false` in managed policy.

## Limitations

LeakGuard still does not provide:

- Request-body or network-level inspection outside the extension's page interception flow
- File upload or drag-and-drop payload inspection
- Screenshot or screen-sharing protection
- Full SIEM export plumbing
- Absolute prevention outside managed browser policy

## References

- Chrome `ExtensionSettings`: https://support.google.com/chrome/a/answer/7532015?hl=en
- Chrome app and extension policy overview: https://support.google.com/chrome/a/answer/6177431?hl=en
- Chrome incognito extension guidance: https://support.google.com/chrome/a/answer/13130396?hl=en
- Chrome policy administration reference: https://support.google.com/chrome/a/answer/2657289?hl=en
- Chrome `ExtensionInstallForcelist`: https://chromeenterprise.google/policies/extension-install-forcelist/
- Chrome `ExtensionDeveloperModeSettings`: https://chromeenterprise.google/policies/extension-developer-mode-settings/
- Microsoft Edge `ExtensionInstallForcelist`: https://learn.microsoft.com/en-us/deployedge/microsoft-edge-browser-policies/extensioninstallforcelist
- Microsoft Edge `ExtensionSettings`: https://learn.microsoft.com/en-us/deployedge/microsoft-edge-browser-policies/extensionsettings
- Microsoft Edge `InPrivateModeAvailability`: https://learn.microsoft.com/en-us/deployedge/microsoft-edge-browser-policies/inprivatemodeavailability
- Microsoft Edge `DeveloperToolsAvailability`: https://learn.microsoft.com/en-us/deployedge/microsoft-edge-browser-policies/developertoolsavailability
- Microsoft Edge `ExtensionDeveloperModeSettings`: https://learn.microsoft.com/en-us/deployedge/microsoft-edge-browser-policies/extensiondevelopermodesettings
- Microsoft Edge `BlockExternalExtensions`: https://learn.microsoft.com/en-us/deployedge/microsoft-edge-browser-policies/blockexternalextensions
