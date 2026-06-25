(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  const SKIP_HYDRATION_SELECTOR =
    ".pwm-modal-backdrop, .pwm-secret, form, textarea, [role='textbox'], [contenteditable]:not([contenteditable='false'])";

  function getDocument(options = {}) {
    return options.document || root.document;
  }

  function getNodeCtor(options = {}) {
    return options.Node || root.Node;
  }

  function getNodeFilter(options = {}) {
    return options.NodeFilter || root.NodeFilter;
  }

  function getMutationObserver(options = {}) {
    return options.MutationObserver || root.MutationObserver;
  }

  function getPlaceholderTokenRegex(options = {}) {
    const regex =
      options.placeholderTokenRegex ||
      root.PWM?.ANY_PLACEHOLDER_TOKEN_REGEX ||
      root.PWM?.PLACEHOLDER_TOKEN_REGEX ||
      /\[(?:PWM_\d+|NET_\d+(?:_SUB_\d+)*(?:_(?:HOST_\d+|GW|VIP|DNS))?|PUB_HOST_\d+(?:_(?:GW|VIP|DNS))?|[A-Z][A-Z0-9_]*_\d+)\]/g;
    return new RegExp(regex.source, "g");
  }

  function getNormalizeVisiblePlaceholders(options = {}) {
    return options.normalizeVisiblePlaceholders || root.PWM?.normalizeVisiblePlaceholders || ((value) => String(value || ""));
  }

  function getTokenizePlaceholderText(options = {}) {
    return options.tokenizePlaceholderText || root.PWM?.PlaceholderRehydrator?.tokenizePlaceholderText;
  }

  function debug(options, label, payload) {
    if (typeof options.debug === "function") {
      options.debug(label, payload || {});
    }
  }

  function shouldSkipHydration(node) {
    const parent = node?.parentElement;
    if (!parent) return true;

    return !!parent.closest(SKIP_HYDRATION_SELECTOR);
  }

  function hydrateTextNode(node, options = {}) {
    const doc = getDocument(options);
    const placeholderTokenRegex = getPlaceholderTokenRegex(options);
    const normalizeVisiblePlaceholders = getNormalizeVisiblePlaceholders(options);
    const tokenizePlaceholderText = getTokenizePlaceholderText(options);
    const createSecretSpan = options.createSecretSpan;
    const text = node?.nodeValue;
    const normalizedText = normalizeVisiblePlaceholders(text);

    if (!normalizedText || !placeholderTokenRegex.test(normalizedText)) return;
    placeholderTokenRegex.lastIndex = 0;
    if (shouldSkipHydration(node)) return;

    const parent = node.parentElement;
    if (!parent || !doc || typeof tokenizePlaceholderText !== "function" || typeof createSecretSpan !== "function") return;

    const segments = tokenizePlaceholderText(normalizedText, options);
    if (segments.length === 1 && segments[0].type === "text") return;

    debug(options, "rehydrate:text-node", {
      parentTag: parent.tagName,
      placeholderCount: segments.filter((segment) => segment.type === "secret").length
    });

    const fragment = doc.createDocumentFragment();

    for (const segment of segments) {
      if (segment.type === "text") {
        fragment.appendChild(doc.createTextNode(segment.value));
      } else {
        fragment.appendChild(createSecretSpan(segment.placeholder));
      }
    }

    parent.replaceChild(fragment, node);
  }

  function rehydrateTree(rootNode, options = {}) {
    if (!rootNode) return;

    const NodeCtor = getNodeCtor(options);
    const nodeFilter = getNodeFilter(options);
    const doc = getDocument(options);
    const placeholderTokenRegex = getPlaceholderTokenRegex(options);
    const normalizeVisiblePlaceholders = getNormalizeVisiblePlaceholders(options);

    if (rootNode.nodeType === NodeCtor.TEXT_NODE) {
      hydrateTextNode(rootNode, options);
      return;
    }

    const walker = doc.createTreeWalker(rootNode, nodeFilter.SHOW_TEXT);
    const nodes = [];

    while (walker.nextNode()) {
      const node = walker.currentNode;
      const normalizedText = normalizeVisiblePlaceholders(node.nodeValue || "");
      if (normalizedText && placeholderTokenRegex.test(normalizedText)) {
        nodes.push(node);
      }
      placeholderTokenRegex.lastIndex = 0;
    }

    nodes.forEach((node) => hydrateTextNode(node, options));
  }

  function startRehydrationObserver(options = {}) {
    const doc = getDocument(options);
    const MutationObserverCtor = getMutationObserver(options);
    const NodeCtor = getNodeCtor(options);
    const placeholderTokenRegex = getPlaceholderTokenRegex(options);
    const normalizeVisiblePlaceholders = getNormalizeVisiblePlaceholders(options);
    const getObserver = typeof options.getObserver === "function" ? options.getObserver : () => null;
    const setObserver = typeof options.setObserver === "function" ? options.setObserver : () => {};

    if (getObserver() || !doc?.body || typeof MutationObserverCtor !== "function") return getObserver();

    const observer = new MutationObserverCtor((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData" && mutation.target?.nodeType === NodeCtor.TEXT_NODE) {
          const normalizedText = normalizeVisiblePlaceholders(mutation.target.nodeValue || "");
          debug(options, "rehydrate:character-data", {
            parentTag: mutation.target.parentElement?.tagName || null,
            containsPlaceholder: placeholderTokenRegex.test(normalizedText)
          });
          placeholderTokenRegex.lastIndex = 0;
          hydrateTextNode(mutation.target, options);
        }

        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === NodeCtor.TEXT_NODE) {
            hydrateTextNode(node, options);
          } else if (node.nodeType === NodeCtor.ELEMENT_NODE) {
            const normalizedText = normalizeVisiblePlaceholders(node.textContent || "");
            const containsPlaceholder = placeholderTokenRegex.test(normalizedText);
            debug(options, "rehydrate:element-added", {
              tagName: node.tagName,
              containsPlaceholder
            });
            placeholderTokenRegex.lastIndex = 0;
            if (!containsPlaceholder) return;
            rehydrateTree(node, options);
          }
        });
      }
    });

    setObserver(observer);
    observer.observe(doc.body, {
      childList: true,
      characterData: true,
      subtree: true
    });

    rehydrateTree(doc.body, options);
    return observer;
  }

  root.PWM.ResponseObserver = {
    shouldSkipHydration,
    hydrateTextNode,
    rehydrateTree,
    startRehydrationObserver
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.ResponseObserver;
  }
})();
