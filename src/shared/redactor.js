(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};
  const { normalizeVisiblePlaceholders, PLACEHOLDER_TOKEN_REGEX, isTrustedVisiblePlaceholder } = root.PWM;

  function overlapsAnyRange(candidate, ranges) {
    return ranges.some((range) => candidate.start < range.end && candidate.end > range.start);
  }

  function collectKnownSecretReplacements(text, manager, occupiedRanges = []) {
    const replacements = [];
    const regex = new RegExp(PLACEHOLDER_TOKEN_REGEX.source, "g");
    const knownEntries =
      typeof manager?.getKnownSecretEntries === "function" ? manager.getKnownSecretEntries() : [];
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
          const previous = start > 0 ? text[start - 1] : "";
          const next = end < text.length ? text[end] : "";
          const leftContext = text.slice(Math.max(0, start - 32), start).toLowerCase();
          const shortIdentifier = /^[A-Za-z0-9._-]{3,16}$/.test(knownRaw);
          const hintContext =
            previous === "-" && /(?:password_hint|hint|ask)\s*[:=]?\s*[\w.-]*-$/.test(leftContext);
          const secretLikeShortValue =
            /\d/.test(knownRaw) || /(?:secret|token|pass|key|auth|bearer)/i.test(knownRaw);

          if (shortIdentifier && !hintContext && !secretLikeShortValue) {
            searchIndex = relativeIndex + knownRaw.length;
            continue;
          }
          if (shortIdentifier && /[A-Za-z0-9._-]/.test(next)) {
            searchIndex = relativeIndex + knownRaw.length;
            continue;
          }
          if (shortIdentifier && /[A-Za-z0-9_.]/.test(previous)) {
            searchIndex = relativeIndex + knownRaw.length;
            continue;
          }
          const candidate = {
            id: `reuse_${start}_${end}`,
            raw: knownRaw,
            start,
            end,
            type: "SECRET",
            category: "credential",
            placeholder: entry.placeholder
          };

          if (!overlapsAnyRange(candidate, occupiedRanges) && !overlapsAnyRange(candidate, replacements)) {
            replacements.push(candidate);
            occupiedRanges.push({ start, end });
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

  class Redactor {
    constructor(manager) {
      this.manager = manager;
    }

    redact(text, findings) {
      const input = String(text || "");
      if (this.manager && typeof this.manager.reserveVisiblePlaceholdersFromText === "function") {
        this.manager.reserveVisiblePlaceholdersFromText(input);
      }
      const ordered = [...(findings || [])]
        .filter(
          (finding) =>
            !(
              isTrustedVisiblePlaceholder &&
              this.manager &&
              isTrustedVisiblePlaceholder(finding?.raw, this.manager)
            )
        )
        .sort((a, b) => a.start - b.start);
      const replacements = [];
      let output = input;
      const placeholderById = new Map();

      for (const finding of ordered) {
        const placeholder = this.manager.getPlaceholder(
          finding.raw,
          finding.type || finding.placeholderType || "SECRET"
        );

        placeholderById.set(finding.id, placeholder);
      }

      const reused = collectKnownSecretReplacements(input, this.manager, []).filter(
        (replacement) => {
          const replacementLength = replacement.end - replacement.start;
          return !ordered.some((finding) => {
            if (finding.start >= replacement.end || finding.end <= replacement.start) return false;
            const findingLength = finding.end - finding.start;
            return findingLength >= replacementLength;
          });
        }
      );
      const orderedWithoutReused = ordered.filter((finding) => {
        const findingLength = finding.end - finding.start;
        return !reused.some((replacement) => {
          if (finding.start >= replacement.end || finding.end <= replacement.start) return false;
          const replacementLength = replacement.end - replacement.start;
          return replacementLength > findingLength;
        });
      });
      const combined = [...orderedWithoutReused, ...reused];
      const sorted = [...combined].sort((a, b) => b.start - a.start);

      for (const finding of sorted) {
        const placeholder =
          placeholderById.get(finding.id) ||
          finding.placeholder ||
          this.manager.getPlaceholder(
            finding.raw,
            finding.type || finding.placeholderType || "SECRET"
          );

        output = output.slice(0, finding.start) + placeholder + output.slice(finding.end);

        replacements.unshift({
          ...finding,
          placeholder
        });
      }

      return {
        redactedText: normalizeVisiblePlaceholders ? normalizeVisiblePlaceholders(output) : output,
        replacements,
        findings: replacements
      };
    }
  }

  root.PWM.Redactor = Redactor;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = Redactor;
  }
})();
