(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};
  root.PWM.SiteAdapters = root.PWM.SiteAdapters || {};

  function createWhatsAppAdapter({ pendingAttachEnabled, hooks = {} } = {}) {
    return {
      id: "whatsapp",
      siteLabel: "WhatsApp",
      hosts: ["web.whatsapp.com"],
      supportsDirectFileInputAssignment: true,
      supportsMultiFileHandoff: true,
      supportsDirectDropReplay: false,
      supportsPendingAttach: true,
      supportsTrustedAttachButton: true,
      pendingAttachEnabled: pendingAttachEnabled?.whatsapp,
      uploadButtonSelectors: [
        'input[type="file"]',
        '[data-testid*="attach" i]',
        '[data-testid*="clip" i]',
        '[aria-label*="attach" i]',
        '[aria-label*="upload" i]',
        '[title*="attach" i]'
      ],
      uploadMenuItemSelectors: [],
      fileInputSelectors: [
        'input[type="file"][multiple]',
        'input[type="file"][accept]',
        'input[type="file"]'
      ],
      unsafeClickSelectors: [
        '[aria-label*="send" i]',
        '[data-testid*="send" i]',
        '[aria-label*="voice" i]',
        '[aria-label*="mic" i]',
        '[aria-label*="settings" i]',
        '[aria-label*="close" i]',
        '[aria-label*="remove" i]',
        '[aria-label*="delete" i]'
      ],
      resolveUploadTrigger: (event, input, adapter) => hooks.findGenericAdapterUploadTrigger(adapter, event, input),
      resolveUploadMenuItem: () => null,
      resolveFileInput: (event, input, adapter) => hooks.resolveGenericAdapterFileInput(adapter, event, input),
      isUploadClickTarget: (eventOrTarget, adapter) => hooks.isLikelyGenericUploadClickTarget(adapter, eventOrTarget),
      attachWithTrustedActivation: (pending, adapter) => hooks.attachGenericPendingWithTrustedActivation(adapter, pending)
    };
  }

  root.PWM.SiteAdapters.createWhatsAppAdapter = createWhatsAppAdapter;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { createWhatsAppAdapter };
  }
})();
