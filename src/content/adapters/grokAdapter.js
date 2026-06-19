(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};
  root.PWM.SiteAdapters = root.PWM.SiteAdapters || {};

  function createGrokAdapter({ pendingAttachEnabled, hooks = {} } = {}) {
    return {
      id: "grok",
      siteLabel: "Grok",
      hosts: ["grok.com"],
      supportsDirectFileInputAssignment: true,
      supportsMultiFileHandoff: true,
      supportsDirectDropReplay: true,
      supportsPendingAttach: true,
      supportsTrustedAttachButton: true,
      pendingAttachEnabled: pendingAttachEnabled?.grok,
      uploadButtonSelectors: [
        'button[aria-label*="upload" i]',
        'button[aria-label*="attach" i]',
        'button[title*="upload" i]',
        'button[title*="attach" i]',
        "button",
        "label",
        "[role='button']"
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
        '[aria-label*="mic" i]',
        '[aria-label*="voice" i]',
        '[aria-label*="settings" i]',
        '[aria-label*="close" i]',
        '[aria-label*="remove" i]'
      ],
      resolveUploadTrigger: () => hooks.findGrokUploadButton(),
      resolveUploadMenuItem: () => null,
      resolveFileInput: (event, input) => hooks.discoverGrokPendingFileInput(event, input).fileInput,
      isUploadClickTarget: (eventOrTarget) => hooks.isLikelyGrokUploadClickTarget(eventOrTarget),
      attachWithTrustedActivation: (pending) =>
        hooks.performPendingGrokUserAttach(pending.event, pending.input, pending.sanitizedFiles || pending.sanitizedFile)
    };
  }

  root.PWM.SiteAdapters.createGrokAdapter = createGrokAdapter;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { createGrokAdapter };
  }
})();
