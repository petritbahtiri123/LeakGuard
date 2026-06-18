(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};
  const { push } = root.PWM.EnterpriseDetectors.shared;

  function normalizeRaw(raw) {
    return String(raw || "");
  }

  function scan(text, detector) {
    const findings = [];
    const input = String(text || "");
    const regexes = [
      /\\\\[A-Za-z0-9][A-Za-z0-9.-]{1,100}\\[^\s"'`<>]+(?:\\[^\s"'`<>]+)*/g,
      /\\\\\\\\[A-Za-z0-9][A-Za-z0-9.-]{1,100}\\\\[^\s"'`<>]+(?:\\\\[^\s"'`<>]+)*/g
    ];

    for (const regex of regexes) {
      let match;
      while ((match = regex.exec(input)) !== null) {
        const raw = normalizeRaw(match[0]);
        push(findings, detector, raw, match.index, match.index + raw.length, "UNC_PATH", 99, ["enterprise", "unc-path", "full-structure"]);
      }
    }

    return findings;
  }

  root.PWM.EnterpriseDetectors = root.PWM.EnterpriseDetectors || {};
  root.PWM.EnterpriseDetectors.uncPaths = { scan };
})();
