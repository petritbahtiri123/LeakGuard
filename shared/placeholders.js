(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  class PlaceholderManager {
    constructor() {
      this.reset();
    }

    reset() {
      this.sessionId = null;
      this.counters = {};
      this.map = new Map();
      this.reverseMap = new Map();
    }

    setState(state = {}) {
      this.reset();
      this.sessionId = state.sessionId || null;
      this.counters = { ...(state.counters || {}) };

      for (const [raw, placeholder] of Object.entries(state.rawToPlaceholder || {})) {
        this.map.set(raw, placeholder);
      }

      for (const [placeholder, raw] of Object.entries(state.placeholderToRaw || {})) {
        this.reverseMap.set(placeholder, raw);
      }
    }

    exportState() {
      return {
        sessionId: this.sessionId,
        counters: { ...this.counters },
        rawToPlaceholder: Object.fromEntries(this.map.entries()),
        placeholderToRaw: Object.fromEntries(this.reverseMap.entries())
      };
    }

    getPlaceholder(rawValue, placeholderType = "SECRET") {
      const raw = String(rawValue);

      if (this.map.has(raw)) {
        return this.map.get(raw);
      }

      const normalizedType = String(placeholderType || "SECRET")
        .toUpperCase()
        .replace(/[^A-Z0-9_]/g, "_");

      const next = (this.counters[normalizedType] || 0) + 1;
      this.counters[normalizedType] = next;

      const placeholder = `[${normalizedType}_${next}]`;

      this.map.set(raw, placeholder);
      this.reverseMap.set(placeholder, raw);

      return placeholder;
    }

    getRaw(placeholder) {
      return this.reverseMap.get(placeholder) || null;
    }

    rehydrateForTest(text) {
      let output = String(text || "");

      for (const [placeholder, raw] of this.reverseMap.entries()) {
        output = output.split(placeholder).join(raw);
      }

      return output;
    }

    segmentText(text) {
      const input = String(text || "");
      const tokenRegex = /\[[A-Z0-9_]+_\d+\]/g;
      const segments = [];
      let lastIndex = 0;
      let match;

      while ((match = tokenRegex.exec(input)) !== null) {
        const placeholder = match[0];
        const raw = this.getRaw(placeholder);

        if (!raw) continue;

        if (match.index > lastIndex) {
          segments.push({
            type: "text",
            value: input.slice(lastIndex, match.index)
          });
        }

        segments.push({
          type: "secret",
          placeholder,
          raw
        });

        lastIndex = match.index + placeholder.length;
      }

      if (lastIndex < input.length) {
        segments.push({
          type: "text",
          value: input.slice(lastIndex)
        });
      }

      return segments.length ? segments : [{ type: "text", value: input }];
    }
  }

  root.PWM.PlaceholderManager = PlaceholderManager;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = PlaceholderManager;
  }
})();
