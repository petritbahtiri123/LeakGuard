(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  const {
    detectIpCandidates,
    shouldPseudonymizeNetwork,
    buildNetworkHierarchy,
    NetworkPlaceholderAllocator,
    normalizeVisiblePlaceholders,
    normalizeTransformMode,
    isTrustedVisiblePlaceholder
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
    const input = String(text || "");
    const sorted = [...replacements].sort((left, right) => left.start - right.start);
    const hasOverlaps = sorted.some((replacement, index) => {
      if (index === 0) return false;
      return replacement.start < sorted[index - 1].end;
    });

    if (!hasOverlaps) {
      const chunks = [];
      let cursor = 0;

      for (const replacement of sorted) {
        chunks.push(input.slice(cursor, replacement.start), replacement.placeholder);
        cursor = replacement.end;
      }

      chunks.push(input.slice(cursor));
      return chunks.join("");
    }

    let output = input;
    for (const replacement of sorted.sort((left, right) => right.start - left.start)) {
      output =
        output.slice(0, replacement.start) + replacement.placeholder + output.slice(replacement.end);
    }

    return output;
  }

  function overlapsAnyRange(candidate, ranges) {
    return ranges.some((range) => candidate.start < range.end && candidate.end > range.start);
  }

  function overlapsRange(left, right) {
    return left.start < right.end && left.end > right.start;
  }

  function findSortedOverlapIndex(candidate, ranges) {
    let low = 0;
    let high = ranges.length - 1;

    while (low <= high) {
      const mid = (low + high) >> 1;
      const range = ranges[mid];

      if (range.end <= candidate.start) {
        low = mid + 1;
      } else if (range.start >= candidate.end) {
        high = mid - 1;
      } else {
        return mid;
      }
    }

    return -1;
  }

  function insertSortedRange(ranges, range) {
    let low = 0;
    let high = ranges.length;

    while (low < high) {
      const mid = (low + high) >> 1;
      if (ranges[mid].start < range.start) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    ranges.splice(low, 0, range);
  }

  function makeSortedRanges(ranges) {
    return [...(ranges || [])].sort((left, right) => left.start - right.start || left.end - right.end);
  }

  function overlapsAnySortedRange(candidate, sortedRanges) {
    return findSortedOverlapIndex(candidate, sortedRanges) !== -1;
  }

  function hasOverlappingRangeAtLeastAsLong(candidate, sortedRanges) {
    const startIndex = findSortedOverlapIndex(candidate, sortedRanges);
    if (startIndex < 0) return false;

    const candidateLength = candidate.end - candidate.start;

    for (let index = startIndex; index >= 0 && sortedRanges[index].end > candidate.start; index -= 1) {
      const range = sortedRanges[index];
      if (overlapsRange(candidate, range) && range.end - range.start >= candidateLength) {
        return true;
      }
    }

    for (let index = startIndex + 1; index < sortedRanges.length && sortedRanges[index].start < candidate.end; index += 1) {
      const range = sortedRanges[index];
      if (overlapsRange(candidate, range) && range.end - range.start >= candidateLength) {
        return true;
      }
    }

    return false;
  }

  function hasOverlappingRangeLongerThan(candidate, sortedRanges) {
    const startIndex = findSortedOverlapIndex(candidate, sortedRanges);
    if (startIndex < 0) return false;

    const candidateLength = candidate.end - candidate.start;

    for (let index = startIndex; index >= 0 && sortedRanges[index].end > candidate.start; index -= 1) {
      const range = sortedRanges[index];
      if (overlapsRange(candidate, range) && range.end - range.start > candidateLength) {
        return true;
      }
    }

    for (let index = startIndex + 1; index < sortedRanges.length && sortedRanges[index].start < candidate.end; index += 1) {
      const range = sortedRanges[index];
      if (overlapsRange(candidate, range) && range.end - range.start > candidateLength) {
        return true;
      }
    }

    return false;
  }

  function shouldReuseKnownSecretInPlainText(text, start, end, raw) {
    const knownRaw = String(raw || "");
    const previous = start > 0 ? text[start - 1] : "";
    const next = end < text.length ? text[end] : "";
    const leftContext = text.slice(Math.max(0, start - 32), start).toLowerCase();
    const shortIdentifier = /^[A-Za-z0-9._-]{3,16}$/.test(knownRaw);
    const hintContext =
      previous === "-" && /(?:password_hint|hint|ask)\s*[:=]?\s*[\w.-]*-$/.test(leftContext);
    const secretLikeShortValue =
      /\d/.test(knownRaw) || /(?:secret|token|pass|key|auth|bearer)/i.test(knownRaw);

    if (shortIdentifier && !hintContext && !secretLikeShortValue) {
      return false;
    }

    if (shortIdentifier && /[A-Za-z0-9._-]/.test(next)) {
      return false;
    }

    if (shortIdentifier && /[A-Za-z0-9_.]/.test(previous)) {
      return false;
    }

    return true;
  }

  function collectKnownSecretReplacements(text, manager, occupiedRanges = []) {
    const replacements = [];
    const regex = new RegExp(root.PWM.PLACEHOLDER_TOKEN_REGEX.source, "g");
    const knownEntries =
      typeof manager?.getKnownSecretEntries === "function" ? manager.getKnownSecretEntries() : [];
    const occupiedRangeIndex = makeSortedRanges(occupiedRanges);
    const replacementRangeIndex = [];
    let lastIndex = 0;
    let match;

    function scanPlainTextSegment(segmentText, offset) {
      for (const entry of knownEntries) {
        const knownRaw = String(entry.raw || "");
        if (knownRaw.length < 3) continue;

        let searchIndex = 0;
        while (searchIndex < segmentText.length) {
          const relativeIndex = segmentText.indexOf(knownRaw, searchIndex);
          if (relativeIndex === -1) break;

          const start = offset + relativeIndex;
          const end = start + knownRaw.length;
          if (!shouldReuseKnownSecretInPlainText(text, start, end, knownRaw)) {
            searchIndex = relativeIndex + knownRaw.length;
            continue;
          }

          const candidate = {
            start,
            end,
            raw: knownRaw,
            placeholder: entry.placeholder,
            type: "SECRET",
            category: "secret"
          };

          if (
            !overlapsAnySortedRange(candidate, occupiedRangeIndex) &&
            !overlapsAnySortedRange(candidate, replacementRangeIndex)
          ) {
            replacements.push(candidate);
            const range = { start, end };
            occupiedRanges.push(range);
            insertSortedRange(occupiedRangeIndex, range);
            insertSortedRange(replacementRangeIndex, range);
          }

          searchIndex = relativeIndex + knownRaw.length;
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
    const profile = options.profile && typeof performance !== "undefined" ? options.profile : null;
    const mark = () => (profile ? performance.now() : 0);
    const addProfile = (key, start) => {
      if (profile) profile[key] = Number(profile[key] || 0) + performance.now() - start;
    };
    const normalizedText = normalizeVisiblePlaceholders(String(text || ""));
    if (manager && typeof manager.reserveVisiblePlaceholdersFromText === "function") {
      manager.reserveVisiblePlaceholdersFromText(text);
    }
    const secretFindings = [...(options.findings || [])].filter(
      (finding) =>
        !(
          isTrustedVisiblePlaceholder &&
          manager &&
          isTrustedVisiblePlaceholder(finding?.raw, manager)
        )
    );
    const mode = normalizeTransformMode(options.mode);
    const secretReplacements = [];
    let stageStart = mark();

    for (const finding of secretFindings.sort((left, right) => left.start - right.start)) {
      const replacement = {
        ...finding,
        placeholder: manager.getPlaceholder(
          finding.raw,
          finding.type || finding.placeholderType || "SECRET"
        )
      };
      secretReplacements.push(replacement);
    }
    addProfile("secret_placeholder_ms", stageStart);

    stageStart = mark();
    const reusedSecretReplacements = collectKnownSecretReplacements(
      normalizedText,
      manager,
      []
    );
    addProfile("known_secret_collect_ms", stageStart);

    stageStart = mark();
    const secretReplacementRanges = makeSortedRanges(secretReplacements);
    const filteredReusedSecretReplacements = reusedSecretReplacements.filter(
      (replacement) => !hasOverlappingRangeAtLeastAsLong(replacement, secretReplacementRanges)
    );
    const reusedSecretRanges = makeSortedRanges(filteredReusedSecretReplacements);
    const filteredSecretReplacements = secretReplacements.filter((replacement) => {
      return !hasOverlappingRangeLongerThan(replacement, reusedSecretRanges);
    });
    addProfile("secret_overlap_filter_ms", stageStart);

    stageStart = mark();
    const networkReplacements = buildNetworkReplacements(normalizedText, manager, mode);
    addProfile("network_ms", stageStart);

    stageStart = mark();
    const replacements = [
      ...filteredSecretReplacements,
      ...filteredReusedSecretReplacements,
      ...networkReplacements
    ].sort((left, right) => left.start - right.start);
    addProfile("replacement_sort_ms", stageStart);

    stageStart = mark();
    const redactedText = applyReplacements(normalizedText, replacements);
    addProfile("apply_replacements_ms", stageStart);

    stageStart = mark();
    const clonedReplacements = replacements.map(cloneReplacement);
    const clonedNetworkReplacements = networkReplacements.map(cloneReplacement);
    addProfile("clone_replacements_ms", stageStart);

    return {
      redactedText,
      replacements: clonedReplacements,
      findings: clonedReplacements,
      networkReplacements: clonedNetworkReplacements,
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
