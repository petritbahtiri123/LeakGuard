(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  class Redactor {
    constructor(manager) {
      this.manager = manager;
    }

    redact(text, findings) {
      const input = String(text || "");
      const sorted = [...(findings || [])].sort((a, b) => b.start - a.start);
      const replacements = [];
      let output = input;

      for (const finding of sorted) {
        const placeholder = this.manager.getPlaceholder(
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
        redactedText: output,
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
