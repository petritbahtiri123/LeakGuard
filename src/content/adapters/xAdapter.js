(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};
  root.PWM.SiteAdapters = root.PWM.SiteAdapters || {};

  function createXAdapter({ pendingAttachEnabled, hooks = {} } = {}) {
    return {
      id: "x",
      siteLabel: "X",
      hosts: ["x.com", "twitter.com"],
      supportsDirectFileInputAssignment: true,
      supportsMultiFileHandoff: true,
      supportsDirectDropReplay: false,
      supportsPendingAttach: true,
      supportsTrustedAttachButton: true,
      pendingAttachEnabled: pendingAttachEnabled?.x,
      uploadButtonSelectors: [
        'input[type="file"]',
        '[data-testid*="file" i]',
        '[data-testid*="media" i]',
        '[aria-label*="media" i]',
        '[aria-label*="upload" i]',
        '[aria-label*="attach" i]'
      ],
      uploadMenuItemSelectors: [],
      fileInputSelectors: [
        'input[type="file"][multiple]',
        'input[type="file"][accept]',
        'input[type="file"]'
      ],
      unsafeClickSelectors: [
        '[data-testid="tweetButton"]',
        '[data-testid="tweetButtonInline"]',
        '[aria-label*="post" i]',
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

  root.PWM.SiteAdapters.createXAdapter = createXAdapter;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { createXAdapter };
  }
})();
