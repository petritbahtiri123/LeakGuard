(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function normalizeHostname(hostname) {
    return String(hostname || "").toLowerCase();
  }

  function isChatGptHost(hostname) {
    const host = normalizeHostname(hostname);
    return host === "chatgpt.com" || host === "chat.openai.com";
  }

  function isOpenAiChatHost(hostname) {
    return normalizeHostname(hostname) === "chat.openai.com";
  }

  function isGeminiHost(hostname) {
    return normalizeHostname(hostname) === "gemini.google.com";
  }

  function isClaudeHost(hostname) {
    const host = normalizeHostname(hostname);
    return host === "claude.ai" || host.endsWith(".claude.ai");
  }

  function isGrokHost(hostname) {
    const host = normalizeHostname(hostname);
    return host === "grok.com" || host.endsWith(".grok.com");
  }

  function isXHost(hostname) {
    const host = normalizeHostname(hostname);
    return (
      host === "x.com" ||
      host.endsWith(".x.com") ||
      host === "twitter.com" ||
      host.endsWith(".twitter.com")
    );
  }

  function getFileHandoffAdapterById(adapters, id) {
    return (adapters || {})[String(id || "").toLowerCase()] || null;
  }

  function hostMatchesFileHandoffAdapter(hostname, adapter) {
    const host = normalizeHostname(hostname);
    return (adapter?.hosts || []).some((candidate) => {
      const normalized = normalizeHostname(candidate);
      return host === normalized || host.endsWith(`.${normalized}`);
    });
  }

  function getFileHandoffAdapterForLocation(adapters, targetLocation) {
    const host = normalizeHostname(targetLocation?.hostname);
    return Object.values(adapters || {}).find((adapter) => hostMatchesFileHandoffAdapter(host, adapter)) || null;
  }

  function isFileHandoffAdapterPendingAttachEnabled(adapter) {
    return Boolean(adapter?.supportsPendingAttach && adapter.pendingAttachEnabled !== false);
  }

  function describeFileHandoffAdapter(adapter) {
    if (!adapter) return null;
    return {
      id: adapter.id || "",
      siteLabel: adapter.siteLabel || adapter.id || "",
      hosts: Array.from(adapter.hosts || []),
      supportsDirectDropReplay: Boolean(adapter.supportsDirectDropReplay),
      supportsPendingAttach: Boolean(adapter.supportsPendingAttach),
      supportsTrustedAttachButton: Boolean(adapter.supportsTrustedAttachButton),
      pendingAttachEnabled: isFileHandoffAdapterPendingAttachEnabled(adapter)
    };
  }

  function getCurrentHandoffDriverId(hostname) {
    if (isGeminiHost(hostname)) return "gemini";
    if (isOpenAiChatHost(hostname)) return "openai";
    if (isChatGptHost(hostname)) return "chatgpt";
    if (isClaudeHost(hostname)) return "claude";
    if (isGrokHost(hostname)) return "grok";
    if (isXHost(hostname)) return "x";
    return "generic";
  }

  root.PWM.HostMatching = {
    normalizeHostname,
    isChatGptHost,
    isOpenAiChatHost,
    isGeminiHost,
    isClaudeHost,
    isGrokHost,
    isXHost,
    getFileHandoffAdapterById,
    hostMatchesFileHandoffAdapter,
    getFileHandoffAdapterForLocation,
    isFileHandoffAdapterPendingAttachEnabled,
    describeFileHandoffAdapter,
    getCurrentHandoffDriverId
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.HostMatching;
  }
})();
