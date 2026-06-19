(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};
  root.PWM.SiteAdapters = root.PWM.SiteAdapters || {};

  function createGeminiAdapter({ pendingAttachEnabled, hooks = {} } = {}) {
    return {
      id: "gemini",
      siteLabel: "Gemini",
      hosts: ["gemini.google.com"],
      supportsDirectFileInputAssignment: true,
      supportsMultiFileHandoff: true,
      supportsDirectDropReplay: false,
      supportsPendingAttach: true,
      supportsTrustedAttachButton: true,
      pendingAttachEnabled: pendingAttachEnabled?.gemini,
      uploadButtonSelectors: [
        'button[aria-label="Open upload file menu"]',
        "button.upload-card-button",
        "mat-icon.upload-icon"
      ],
      uploadMenuItemSelectors: [
        'button[data-test-id="local-images-files-uploader-button"]',
        'button[role="menuitem"][aria-label*="Upload files"]'
      ],
      fileInputSelectors: [
        'input[type="file"][name="Filedata"]',
        'input[type="file"][multiple]',
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
      resolveUploadTrigger: () => hooks.findGeminiUploadMenuButton(),
      resolveUploadMenuItem: () => hooks.findGeminiUploadFilesMenuItem(),
      resolveFileInput: (event, input) => hooks.findGeminiFileInput(event, input).fileInput,
      isUploadClickTarget: (eventOrTarget) => hooks.isLikelyGeminiUploadClickTarget(eventOrTarget),
      attachWithTrustedActivation: (pending) =>
        hooks.performPendingGeminiUserAttach(pending.event, pending.input, pending.sanitizedFiles || pending.sanitizedFile)
    };
  }

  root.PWM.SiteAdapters.createGeminiAdapter = createGeminiAdapter;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { createGeminiAdapter };
  }
})();
