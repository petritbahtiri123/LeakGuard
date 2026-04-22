(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  const {
    detectIpCandidates,
    shouldPseudonymizeNetwork,
    buildNetworkHierarchy,
    NetworkPlaceholderAllocator,
    normalizeVisiblePlaceholders,
    normalizeTransformMode
  } = root.PWM;

  function buildNetworkUiFindings(text, options = {}) {
    const normalizedText = normalizeVisiblePlaceholders(String(text || ""));
    const normalizedMode = normalizeTransformMode(options.mode);

    return detectIpCandidates(normalizedText)
      .filter((candidate) => shouldPseudonymizeNetwork(candidate, normalizedMode))
      .map((candidate) => ({
        id: candidate.id,
        type: candidate.isSubnet ? "NETWORK" : "IP_ADDRESS",
        placeholderType: candidate.isSubnet ? "NETWORK" : "IP_ADDRESS",
        category: "network",
        raw: candidate.raw,
        start: candidate.start,
        end: candidate.end,
        score: 90,
        severity: "high",
        method: ["network", "classification"],
        kind: candidate.kind,
        prefix: candidate.prefix,
        role: candidate.role || null,
        isHost: candidate.isHost,
        public: candidate.isPublic
      }));
  }

  function cloneReplacement(replacement) {
    return {
      id: replacement.id,
      start: replacement.start,
      end: replacement.end,
      raw: replacement.raw,
      placeholder: replacement.placeholder,
      type: replacement.type,
      category: replacement.category,
      kind: replacement.kind,
      prefix: replacement.prefix,
      parent: replacement.parent || null,
      role: replacement.role || null,
      isHost: Boolean(replacement.isHost),
      public: Boolean(replacement.public)
    };
  }

  function applyReplacements(text, replacements) {
    let output = String(text || "");

    for (const replacement of [...replacements].sort((left, right) => right.start - left.start)) {
      output =
        output.slice(0, replacement.start) + replacement.placeholder + output.slice(replacement.end);
    }

    return output;
  }

  function overlapsAnyRange(candidate, ranges) {
    return ranges.some((range) => candidate.start < range.end && candidate.end > range.start);
  }

  function collectKnownSecretReplacements(text, manager, occupiedRanges = []) {
    const replacements = [];
    const regex = new RegExp(root.PWM.PLACEHOLDER_TOKEN_REGEX.source, "g");
    const knownEntries =
      typeof manager?.getKnownSecretEntries === "function" ? manager.getKnownSecretEntries() : [];
    let lastIndex = 0;
    let match;

    function scanPlainTextSegment(segmentText, offset) {
      for (const entry of knownEntries) {
        if (!entry.raw) continue;

        let searchIndex = 0;
        while (searchIndex < segmentText.length) {
          const relativeIndex = segmentText.indexOf(entry.raw, searchIndex);
          if (relativeIndex === -1) break;

          const start = offset + relativeIndex;
          const end = start + entry.raw.length;
          const candidate = {
            start,
            end,
            raw: entry.raw,
            placeholder: entry.placeholder,
            type: "SECRET",
            category: "secret"
          };

          if (!overlapsAnyRange(candidate, occupiedRanges) && !overlapsAnyRange(candidate, replacements)) {
            replacements.push(candidate);
            occupiedRanges.push({ start, end });
          }

          searchIndex = relativeIndex + Math.max(1, entry.raw.length);
        }
      }
    }

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        scanPlainTextSegment(text.slice(lastIndex, match.index), lastIndex);
      }
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      scanPlainTextSegment(text.slice(lastIndex), lastIndex);
    }

    return replacements;
  }

  function buildNetworkReplacements(text, manager, mode) {
    const normalizedMode = normalizeTransformMode(mode);
    const detected = detectIpCandidates(text).filter((candidate) =>
      shouldPseudonymizeNetwork(candidate, normalizedMode)
    );

    if (!detected.length) {
      return [];
    }

    const hierarchy = buildNetworkHierarchy(detected, {
      existingObjects: manager.getStructuredObjects()
    });
    const allocator = new NetworkPlaceholderAllocator(manager);

    return hierarchy.map((candidate) => {
      const placeholder = allocator.allocate(candidate);
      const parentObject = candidate.parentOriginal
        ? manager.getObjectByOriginal(candidate.parentOriginal)
        : null;

      manager.registerStructuredObject({
        original: candidate.original,
        placeholder,
        kind: candidate.kind,
        category: "network",
        version: 4,
        prefix: candidate.prefix,
        parent: parentObject?.placeholder || null,
        isHost: candidate.isHost,
        public: candidate.isPublic,
        role: candidate.role || null,
        startInt: candidate.startInt,
        endInt: candidate.endInt
      });

      return {
        id: candidate.id,
        start: candidate.start,
        end: candidate.end,
        raw: candidate.raw,
        placeholder,
        type: candidate.isSubnet ? "NETWORK" : "IP_ADDRESS",
        category: "network",
        kind: candidate.kind,
        prefix: candidate.prefix,
        parent: parentObject?.placeholder || null,
        role: candidate.role || null,
        isHost: candidate.isHost,
        public: candidate.isPublic
      };
    });
  }

  function transformOutboundPrompt(text, options = {}) {
    const manager = options.manager;
    const normalizedText = normalizeVisiblePlaceholders(String(text || ""));
    const secretFindings = [...(options.findings || [])];
    const mode = normalizeTransformMode(options.mode);
    const secretReplacements = [];
    const occupiedRanges = [];

    for (const finding of secretFindings.sort((left, right) => left.start - right.start)) {
      const replacement = {
        ...finding,
        placeholder: manager.getPlaceholder(
          finding.raw,
          finding.type || finding.placeholderType || "SECRET"
        )
      };
      secretReplacements.push(replacement);
      occupiedRanges.push({ start: replacement.start, end: replacement.end });
    }

    const reusedSecretReplacements = collectKnownSecretReplacements(
      normalizedText,
      manager,
      occupiedRanges
    );
    const networkReplacements = buildNetworkReplacements(normalizedText, manager, mode);
    const replacements = [...secretReplacements, ...reusedSecretReplacements, ...networkReplacements].sort(
      (left, right) => left.start - right.start
    );

    return {
      redactedText: applyReplacements(normalizedText, replacements),
      replacements: replacements.map(cloneReplacement),
      findings: replacements.map(cloneReplacement),
      networkReplacements: networkReplacements.map(cloneReplacement),
      changed: replacements.length > 0 || normalizedText !== String(text || "")
    };
  }

  function hasTransformableNetworkData(text, options = {}) {
    const normalizedMode = normalizeTransformMode(options.mode);
    if (normalizedMode === "raw") return false;

    return detectIpCandidates(normalizeVisiblePlaceholders(text)).some((candidate) =>
      shouldPseudonymizeNetwork(candidate, normalizedMode)
    );
  }

  root.PWM.transformOutboundPrompt = transformOutboundPrompt;
  root.PWM.hasTransformableNetworkData = hasTransformableNetworkData;
  root.PWM.buildNetworkUiFindings = buildNetworkUiFindings;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      transformOutboundPrompt,
      hasTransformableNetworkData,
      buildNetworkUiFindings
    };
  }
})();
