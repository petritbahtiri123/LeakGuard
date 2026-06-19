(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  const TONES = ["aqua", "amber", "violet", "rose", "emerald"];

  function getDocument(options = {}) {
    return options.document || root.document;
  }

  function getPlaceholderSessionIndex(options = {}) {
    return options.placeholderSessionIndex || root.PWM?.PlaceholderRehydrator?.placeholderSessionIndex || (() => null);
  }

  function resolveToneIndex(placeholder, placeholderSessionIndex) {
    const index = Number(placeholderSessionIndex(placeholder));
    if (Number.isFinite(index) && index >= 1) {
      return index;
    }

    const typedMatch = /^\[[A-Z][A-Z0-9_]*_(\d+)\]$/.exec(String(placeholder || ""));
    return typedMatch ? Number(typedMatch[1]) : null;
  }

  function createSecretSpan(placeholder, options = {}) {
    const doc = getDocument(options);
    const placeholderSessionIndex = getPlaceholderSessionIndex(options);
    const openReveal = typeof options.openReveal === "function" ? options.openReveal : () => Promise.resolve();
    const onRevealError = typeof options.onRevealError === "function" ? options.onRevealError : () => {};
    const span = doc.createElement("span");
    const index = resolveToneIndex(placeholder, placeholderSessionIndex);

    span.className = "pwm-secret";
    span.dataset.pwmTone = TONES[index ? (index - 1) % TONES.length : 0];
    span.textContent = placeholder;
    span.tabIndex = 0;
    span.setAttribute("role", "button");
    span.setAttribute("aria-label", "LeakGuard redacted sensitive content. Open secure reveal in LeakGuard.");

    const activate = (event) => {
      event.preventDefault();
      event.stopPropagation();

      Promise.resolve(openReveal(placeholder)).catch((error) => {
        onRevealError(placeholder, error);
      });
    };

    span.addEventListener("click", activate);
    span.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        activate(event);
      }
    });

    return span;
  }

  root.PWM.RevealController = {
    createSecretSpan
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.RevealController;
  }
})();
