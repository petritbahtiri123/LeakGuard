(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};
  const adapters = (root.PWM.SiteAdapters = root.PWM.SiteAdapters || {});

  function createGenericAdapter({ pendingAttachEnabled, hooks = {} } = {}) {
    return {
      id: "generic",
      siteLabel: "Protected site",
      hosts: [],
      supportsDirectFileInputAssignment: true,
      supportsMultiFileHandoff: true,
      supportsDirectDropReplay: false,
      supportsPendingAttach: true,
      supportsTrustedAttachButton: true,
      pendingAttachEnabled: pendingAttachEnabled?.generic,
      uploadButtonSelectors: [
        'button[aria-label*="upload" i]',
        'button[aria-label*="attach" i]',
        'button[aria-label*="file" i]',
        'button[title*="upload" i]',
        'button[title*="attach" i]'
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
      resolveUploadTrigger: (event, input, adapter) =>
        hooks.findGenericAdapterUploadTrigger?.(adapter, event, input) || null,
      resolveUploadMenuItem: () => null,
      resolveFileInput: (event, input, adapter) =>
        hooks.resolveGenericAdapterFileInput?.(adapter, event, input) || null,
      isUploadClickTarget: (eventOrTarget, adapter) =>
        Boolean(hooks.isLikelyGenericUploadClickTarget?.(adapter, eventOrTarget)),
      attachWithTrustedActivation: (pending, adapter) =>
        hooks.attachGenericPendingWithTrustedActivation?.(adapter, pending) || false
    };
  }

  function createFileHandoffAdapters({ pendingAttachEnabled, hooks = {} } = {}) {
    return {
      gemini: adapters.createGeminiAdapter({ pendingAttachEnabled, hooks }),
      grok: adapters.createGrokAdapter({ pendingAttachEnabled, hooks }),
      chatgpt: adapters.createChatGptAdapter({ pendingAttachEnabled, hooks }),
      claude: adapters.createClaudeAdapter({ pendingAttachEnabled, hooks }),
      openai: adapters.createOpenAiAdapter({ pendingAttachEnabled, hooks }),
      x: adapters.createXAdapter({ pendingAttachEnabled, hooks }),
      whatsapp: adapters.createWhatsAppAdapter({ pendingAttachEnabled, hooks }),
      generic: createGenericAdapter({ pendingAttachEnabled, hooks })
    };
  }

  adapters.createGenericAdapter = createGenericAdapter;
  adapters.createFileHandoffAdapters = createFileHandoffAdapters;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { createGenericAdapter, createFileHandoffAdapters };
  }
})();
