(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};
  root.PWM.SiteAdapters = root.PWM.SiteAdapters || {};

  function createWhatsAppAdapter() {
    return {
      id: "whatsapp",
      siteLabel: "WhatsApp",
      hosts: ["web.whatsapp.com"],
      supportsDirectFileInputAssignment: false,
      supportsClipboardImagePasteHandoff: true,
      supportsSanitizedImageAttachHandoff: true,
      supportsSanitizedTextDocumentAttachHandoff: true,
      supportsMultiFileHandoff: false,
      supportsDirectDropReplay: false,
      supportsPendingAttach: false,
      supportsTrustedAttachButton: false,
      pendingAttachEnabled: false,
      uploadButtonSelectors: [],
      uploadMenuItemSelectors: [],
      fileInputSelectors: [],
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
      resolveUploadTrigger: () => null,
      resolveUploadMenuItem: () => null,
      resolveFileInput: () => null,
      isUploadClickTarget: () => false,
      attachWithTrustedActivation: async () => false
    };
  }

  root.PWM.SiteAdapters.createWhatsAppAdapter = createWhatsAppAdapter;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { createWhatsAppAdapter };
  }
})();
