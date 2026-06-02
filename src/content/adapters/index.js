(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};
  const adapters = (root.PWM.SiteAdapters = root.PWM.SiteAdapters || {});

  function createFileHandoffAdapters({ pendingAttachEnabled, hooks = {} } = {}) {
    return {
      gemini: adapters.createGeminiAdapter({ pendingAttachEnabled, hooks }),
      grok: adapters.createGrokAdapter({ pendingAttachEnabled, hooks }),
      chatgpt: adapters.createChatGptAdapter({ pendingAttachEnabled, hooks }),
      claude: adapters.createClaudeAdapter({ pendingAttachEnabled, hooks }),
      openai: adapters.createOpenAiAdapter({ pendingAttachEnabled, hooks }),
      x: adapters.createXAdapter({ pendingAttachEnabled, hooks })
    };
  }

  adapters.createFileHandoffAdapters = createFileHandoffAdapters;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { createFileHandoffAdapters };
  }
})();
