(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

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

  function collectKnownSecretReplacements(text, manager, occupiedRanges = [], options = {}) {
    const replacements = [];
    const placeholderTokenRegex = options.placeholderTokenRegex || root.PWM.PLACEHOLDER_TOKEN_REGEX;
    const regex = new RegExp(placeholderTokenRegex.source, "g");
    const knownEntries =
      typeof manager?.getKnownSecretEntries === "function" ? manager.getKnownSecretEntries() : [];
    const occupiedRangeIndex = makeSortedRanges(occupiedRanges);
    const replacementRangeIndex = [];
    const replacementCategory = options.category || "secret";
    const includeIds = Boolean(options.includeIds);
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
            raw: knownRaw,
            start,
            end,
            type: "SECRET",
            category: replacementCategory,
            placeholder: entry.placeholder
          };

          if (includeIds) {
            candidate.id = `reuse_${start}_${end}`;
          }

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

  root.PWM.KnownSecretReuse = {
    collectKnownSecretReplacements,
    hasOverlappingRangeAtLeastAsLong,
    hasOverlappingRangeLongerThan,
    makeSortedRanges
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.KnownSecretReuse;
  }
})();
