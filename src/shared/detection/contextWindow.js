(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};
  function getContextWindow(text, start, end, radius = 64) {
    const input = String(text || "");
    const lineStart = input.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const nextLineBreak = input.indexOf("\n", Math.max(0, end));
    const lineEnd = nextLineBreak >= 0 ? nextLineBreak : input.length;
    const left = Math.max(lineStart, start - radius);
    const right = Math.min(lineEnd, end + radius);
    return `${input.slice(left, start)} ${input.slice(end, right)}`.toLowerCase();
  }
  root.PWM.DetectionContext = { ...(root.PWM.DetectionContext || {}), getContextWindow };
})();
