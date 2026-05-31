(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};
  const {
    normalizeVisiblePlaceholders,
    PLACEHOLDER_TOKEN_REGEX,
    isTrustedVisiblePlaceholder,
    KnownSecretReuse
  } = root.PWM;

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

      const orderedRanges = KnownSecretReuse.makeSortedRanges(ordered);
      const reused = KnownSecretReuse.collectKnownSecretReplacements(input, this.manager, [], {
        category: "credential",
        includeIds: true,
        placeholderTokenRegex: PLACEHOLDER_TOKEN_REGEX
      }).filter(
        (replacement) =>
          !KnownSecretReuse.hasOverlappingRangeAtLeastAsLong(replacement, orderedRanges)
      );
      const reusedRanges = KnownSecretReuse.makeSortedRanges(reused);
      const orderedWithoutReused = ordered.filter(
        (finding) => !KnownSecretReuse.hasOverlappingRangeLongerThan(finding, reusedRanges)
      );
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
