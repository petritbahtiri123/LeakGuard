(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function placeholderBody(placeholder) {
    return String(placeholder || "").replace(/^\[/, "").replace(/\]$/, "");
  }

  function escapeRegExp(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function collectStructuredObjects(manager) {
    return typeof manager?.getStructuredObjects === "function" ? manager.getStructuredObjects() : [];
  }

  function nextIndexedPlaceholder(manager, base, suffixPrefix, matcher) {
    const existing = collectStructuredObjects(manager)
      .map((object) => object.placeholder)
      .filter((placeholder) => matcher.test(placeholder))
      .map((placeholder) => {
        const match = matcher.exec(placeholder);
        matcher.lastIndex = 0;
        return match ? Number(match[1]) : 0;
      });
    const next = existing.length ? Math.max(...existing) + 1 : 1;
    return `[${base}_${suffixPrefix}_${next}]`;
  }

  class NetworkPlaceholderAllocator {
    constructor(manager) {
      this.manager = manager;
    }

    allocate(candidate) {
      const existing = this.manager.getObjectByOriginal(candidate.original);
      if (existing?.placeholder) {
        return existing.placeholder;
      }

      if (candidate.isSubnet) {
        return this.allocateSubnet(candidate);
      }

      return this.allocateHost(candidate);
    }

    allocateSubnet(candidate) {
      if (!candidate.parentOriginal) {
        return `[NET_${this.manager.incrementCounter("NET")}]`;
      }

      const parent = this.manager.getObjectByOriginal(candidate.parentOriginal);
      const parentPlaceholder = parent?.placeholder;

      if (!parentPlaceholder) {
        return `[NET_${this.manager.incrementCounter("NET")}]`;
      }

      const base = placeholderBody(parentPlaceholder);
      const matcher = new RegExp(`^\\[${escapeRegExp(base)}_SUB_(\\d+)\\]$`);
      return nextIndexedPlaceholder(this.manager, base, "SUB", matcher);
    }

    allocateHost(candidate) {
      const role = candidate.role || null;

      if (!candidate.parentOriginal) {
        const familyIndex = this.manager.incrementCounter("PUB_HOST");
        const base = `PUB_HOST_${familyIndex}`;
        return role ? `[${base}_${role}]` : `[${base}]`;
      }

      const parent = this.manager.getObjectByOriginal(candidate.parentOriginal);
      const parentPlaceholder = parent?.placeholder;

      if (!parentPlaceholder) {
        const familyIndex = this.manager.incrementCounter("PUB_HOST");
        const base = `PUB_HOST_${familyIndex}`;
        return role ? `[${base}_${role}]` : `[${base}]`;
      }

      const base = placeholderBody(parentPlaceholder);

      if (role) {
        const rolePlaceholder = `[${base}_${role}]`;
        const existingRole = this.manager.getObjectByPlaceholder(rolePlaceholder);
        if (!existingRole || existingRole.original === candidate.original) {
          return rolePlaceholder;
        }
      }

      const matcher = new RegExp(`^\\[${escapeRegExp(base)}_HOST_(\\d+)\\]$`);
      return nextIndexedPlaceholder(this.manager, base, "HOST", matcher);
    }
  }

  root.PWM.NetworkPlaceholderAllocator = NetworkPlaceholderAllocator;
  root.PWM.placeholderBody = placeholderBody;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      NetworkPlaceholderAllocator,
      placeholderBody
    };
  }
})();
