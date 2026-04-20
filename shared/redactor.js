(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};
  const { normalizeVisiblePlaceholders } = root.PWM;

  class Redactor {
    constructor(manager) {
      this.manager = manager;
    }

    redact(text, findings) {
      const input = String(text || "");
      const ordered = [...(findings || [])].sort((a, b) => a.start - b.start);
      const sorted = [...ordered].sort((a, b) => b.start - a.start);
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

      for (const finding of sorted) {
        const placeholder =
          placeholderById.get(finding.id) ||
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
