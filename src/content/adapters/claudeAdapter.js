(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};
  root.PWM.SiteAdapters = root.PWM.SiteAdapters || {};

  function createClaudeAdapter({ pendingAttachEnabled, hooks = {} } = {}) {
    return {
      id: "claude",
      siteLabel: "Claude",
      hosts: ["claude.ai"],
      supportsDirectFileInputAssignment: true,
      supportsMultiFileHandoff: true,
      supportsDirectDropReplay: false,
      supportsPendingAttach: true,
      supportsTrustedAttachButton: true,
      pendingAttachEnabled: pendingAttachEnabled?.claude,
      uploadButtonSelectors: [
        'button[aria-label*="attach" i]',
        'button[aria-label*="upload" i]',
        'button[aria-label*="file" i]',
        'button[title*="attach" i]',
        'button[title*="upload" i]'
      ],
      uploadMenuItemSelectors: [],
      fileInputSelectors: [
        'input[type="file"][multiple]',
        'input[type="file"][accept]',
        'input[type="file"]'
      ],
      unsafeClickSelectors: [
        '[aria-label*="send" i]',
        '[aria-label*="submit" i]',
        '[aria-label*="voice" i]',
        '[aria-label*="mic" i]',
        '[aria-label*="settings" i]',
        '[aria-label*="close" i]',
        '[aria-label*="remove" i]'
      ],
      resolveUploadTrigger: (event, input, adapter) => hooks.findGenericAdapterUploadTrigger(adapter, event, input),
      resolveUploadMenuItem: () => null,
      resolveFileInput: (event, input, adapter) => hooks.resolveGenericAdapterFileInput(adapter, event, input),
      isUploadClickTarget: (eventOrTarget, adapter) => hooks.isLikelyGenericUploadClickTarget(adapter, eventOrTarget),
      attachWithTrustedActivation: (pending, adapter) => hooks.attachGenericPendingWithTrustedActivation(adapter, pending)
    };
  }

  root.PWM.SiteAdapters.createClaudeAdapter = createClaudeAdapter;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { createClaudeAdapter };
  }
})();
