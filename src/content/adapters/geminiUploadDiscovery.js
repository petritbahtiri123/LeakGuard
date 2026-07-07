(function initGeminiUploadDiscovery(root) {
  "use strict";

  const PWM = (root.PWM = root.PWM || {});

  function createGeminiUploadDiscovery(dependencies = {}) {
    const documentRef = dependencies.documentRef || root.document || {};
    const MutationObserverRef =
      dependencies.MutationObserverRef === undefined ? root.MutationObserver : dependencies.MutationObserverRef;
    const MouseEventRef = dependencies.MouseEventRef === undefined ? root.MouseEvent : dependencies.MouseEventRef;
    const setTimeoutFn = dependencies.setTimeoutFn || root.setTimeout?.bind(root) || ((callback) => callback());
    const clearTimeoutFn = dependencies.clearTimeoutFn || root.clearTimeout?.bind(root) || (() => {});
    const isGeminiHost = dependencies.isGeminiHost || (() => false);
    const isFileInputElement = dependencies.isFileInputElement || (() => false);
    const normalizeTarget = dependencies.normalizeTarget || ((target) => target || null);
    const describeElementForDebug = dependencies.describeElementForDebug || (() => ({}));
    const createGeminiUploadMenuEvent =
      dependencies.createGeminiUploadMenuEvent || ((type) => new Event(type, { bubbles: true, cancelable: true }));
    const injectedIsSafeGeminiUploadMenuButton =
      typeof dependencies.isSafeGeminiUploadMenuButton === "function"
        ? dependencies.isSafeGeminiUploadMenuButton
        : null;
    const injectedIsGeminiUploadMenuButtonVisible =
      typeof dependencies.isGeminiUploadMenuButtonVisible === "function"
        ? dependencies.isGeminiUploadMenuButtonVisible
        : null;
    const injectedHasGeminiUploadMenuIntent =
      typeof dependencies.hasGeminiUploadMenuIntent === "function"
        ? dependencies.hasGeminiUploadMenuIntent
        : null;
    const injectedIsUnsafeGeminiUploadMenuButton =
      typeof dependencies.isUnsafeGeminiUploadMenuButton === "function"
        ? dependencies.isUnsafeGeminiUploadMenuButton
        : null;
    const injectedIsGeminiSourceUploadIcon =
      typeof dependencies.isGeminiSourceUploadIcon === "function"
        ? dependencies.isGeminiSourceUploadIcon
        : null;

    function collectRootsWithOpenShadow(rootNode, roots, visitedRoots, stats) {
      if (!rootNode || visitedRoots.has(rootNode)) return;
      visitedRoots.add(rootNode);
      roots.push(rootNode);

      let elements = [];
      try {
        elements = Array.from(rootNode.querySelectorAll?.("*") || []);
      } catch {
        elements = [];
      }

      elements.forEach((element) => {
        if (element?.shadowRoot) {
          if (stats) stats.openShadowRootCount += 1;
          collectRootsWithOpenShadow(element.shadowRoot, roots, visitedRoots, stats);
        }
      });
    }

    function openGeminiUploadMenuSafely(button) {
      if (!isSafeGeminiUploadMenuButton(button) || isFileInputElement(button)) return false;
      try {
        for (const type of ["pointerdown", "mousedown", "mouseup", "click"]) {
          button.dispatchEvent(createGeminiUploadMenuEvent(type));
        }
        return true;
      } catch {
        return false;
      }
    }

    function isGeminiUploadMenuButtonVisible(candidate) {
      if (injectedIsGeminiUploadMenuButtonVisible) {
        return Boolean(injectedIsGeminiUploadMenuButtonVisible(candidate));
      }
      if (!candidate || candidate.disabled || candidate.hidden) return false;
      try {
        if (candidate.getAttribute?.("aria-hidden") === "true") return false;
      } catch {
        // Attribute reads are best-effort on host-controlled nodes.
      }
      try {
        const style = candidate.ownerDocument?.defaultView?.getComputedStyle?.(candidate);
        if (style && (style.display === "none" || style.visibility === "hidden")) return false;
      } catch {
        // Synthetic DOMs may not expose computed styles.
      }
      return true;
    }

    function isUnsafeGeminiUploadMenuButton(candidate) {
      if (injectedIsUnsafeGeminiUploadMenuButton) {
        return Boolean(injectedIsUnsafeGeminiUploadMenuButton(candidate));
      }
      const meta = describeElementForDebug(candidate);
      const haystack = `${meta?.ariaLabel || ""} ${meta?.title || ""} ${meta?.textSnippet || ""} ${meta?.className || ""}`.toLowerCase();
      return /\b(?:send|submit|mic|microphone|voice|record|settings|model|close|remove)\b/.test(haystack);
    }

    function hasGeminiUploadMenuIntent(meta) {
      if (injectedHasGeminiUploadMenuIntent) {
        return Boolean(injectedHasGeminiUploadMenuIntent(meta));
      }
      const label = String(meta?.ariaLabel || "").trim();
      if (label === "Open upload file menu") return true;
      if (/^upload\s*(?:&|and)\s*tools$/i.test(label)) return true;
      const haystack = `${label} ${meta?.title || ""} ${meta?.textSnippet || ""}`.toLowerCase();
      return /\b(?:upload|attach)\b/.test(haystack) && /\b(?:file|files|menu)\b/.test(haystack);
    }

    function isGeminiSourceUploadIcon(candidate, meta = null) {
      if (injectedIsGeminiSourceUploadIcon) {
        return Boolean(injectedIsGeminiSourceUploadIcon(candidate, meta));
      }
      if (!candidate || String(candidate.tagName || "").toUpperCase() !== "MAT-ICON") return false;
      const details = meta || describeElementForDebug(candidate);
      const className =
        details?.className ||
        (typeof candidate.className === "string" ? candidate.className : candidate.getAttribute?.("class") || "");
      const text = (
        details?.textSnippet ||
        candidate.innerText ||
        candidate.textContent ||
        ""
      ).trim().toLowerCase();
      return /\bupload-icon\b/.test(className) && (text === "add_2" || text === "add");
    }

    function isSafeGeminiUploadMenuButton(candidate) {
      if (injectedIsSafeGeminiUploadMenuButton) {
        return Boolean(injectedIsSafeGeminiUploadMenuButton(candidate));
      }
      if (!candidate) return false;
      if (isFileInputElement(candidate)) return false;
      if (!isGeminiUploadMenuButtonVisible(candidate) || isUnsafeGeminiUploadMenuButton(candidate)) return false;
      const meta = describeElementForDebug(candidate);
      const label = meta?.ariaLabel || "";
      const className =
        meta?.className ||
        (typeof candidate.className === "string" ? candidate.className : candidate.getAttribute?.("class") || "");
      if (/\bhidden-local-(?:file-)?upload-button\b/.test(className)) return false;
      if (label === "Open upload file menu" || /^upload\s*(?:&|and)\s*tools$/i.test(label)) return true;
      if (/\bupload-card-button\b/.test(className) && hasGeminiUploadMenuIntent(meta)) return true;
      return isGeminiSourceUploadIcon(candidate, meta);
    }

    function collectGeminiUploadMenuButtonsFromRoot(rootNode, candidates, seen, visitedRoots) {
      if (!rootNode || visitedRoots.has(rootNode)) return;
      visitedRoots.add(rootNode);

      const selectors = [
        'button[aria-label="Open upload file menu"]',
        "button.upload-card-button",
        "mat-icon.upload-icon",
        "button"
      ];
      for (const selector of selectors) {
        try {
          rootNode.querySelectorAll?.(selector).forEach((candidate) => {
            if (!candidate || seen.has(candidate)) return;
            seen.add(candidate);
            candidates.push(candidate);
          });
        } catch {
          // Selector support varies across synthetic and host-controlled roots.
        }
      }

      let elements = [];
      try {
        elements = Array.from(rootNode.querySelectorAll?.("*") || []);
      } catch {
        elements = [];
      }
      elements.forEach((element) => {
        if (element?.shadowRoot) {
          collectGeminiUploadMenuButtonsFromRoot(element.shadowRoot, candidates, seen, visitedRoots);
        }
      });
    }

    function findGeminiUploadMenuButton() {
      if (!isGeminiHost()) return null;
      const candidates = [];
      collectGeminiUploadMenuButtonsFromRoot(documentRef, candidates, new WeakSet(), new WeakSet());
      return (
        candidates.find((candidate) => {
          const label = candidate.getAttribute?.("aria-label") || candidate.ariaLabel || "";
          return label === "Open upload file menu" && isSafeGeminiUploadMenuButton(candidate);
        }) ||
        candidates.find((candidate) => {
          const label = candidate.getAttribute?.("aria-label") || candidate.ariaLabel || "";
          return /^upload\s*(?:&|and)\s*tools$/i.test(label) && isSafeGeminiUploadMenuButton(candidate);
        }) ||
        candidates.find((candidate) => {
          const className = String(candidate.className || candidate.getAttribute?.("class") || "");
          return /\bupload-card-button\b/.test(className) && isSafeGeminiUploadMenuButton(candidate);
        }) ||
        candidates.find((candidate) => isGeminiSourceUploadIcon(candidate) && isSafeGeminiUploadMenuButton(candidate)) ||
        null
      );
    }

    function describeGeminiUploadMenuDiscovery() {
      const candidates = [];
      collectGeminiUploadMenuButtonsFromRoot(documentRef, candidates, new WeakSet(), new WeakSet());
      const selected = findGeminiUploadMenuButton();
      return {
        candidateCount: candidates.length,
        selected: describeElementForDebug(selected, "selected-gemini-upload-menu-button"),
        candidates: candidates.slice(0, 20).map((candidate) => ({
          ...describeElementForDebug(candidate, "gemini-upload-menu-candidate"),
          safeUploadMenuButton: isSafeGeminiUploadMenuButton(candidate),
          sourceUploadIcon: isGeminiSourceUploadIcon(candidate)
        }))
      };
    }

    function isSafeGeminiUploadFilesMenuItem(candidate) {
      if (!candidate || String(candidate.tagName || "").toUpperCase() !== "BUTTON") return false;
      if (candidate.disabled || isFileInputElement(candidate)) return false;
      const meta = describeElementForDebug(candidate);
      const role = meta?.role || candidate.getAttribute?.("role") || "";
      const label = meta?.ariaLabel || "";
      const text = meta?.textSnippet || "";
      const testId = candidate.getAttribute?.("data-test-id") || candidate.dataset?.testId || "";
      if (testId === "local-images-files-uploader-button") return true;
      return role === "menuitem" && (/upload files/i.test(label) || /^upload files$/i.test(text));
    }

    function collectGeminiUploadFilesMenuItemsFromRoot(rootNode, items, seen, visitedRoots) {
      if (!rootNode || visitedRoots.has(rootNode)) return;
      visitedRoots.add(rootNode);
      const selectors = [
        'button[data-test-id="local-images-files-uploader-button"]',
        'button[role="menuitem"][aria-label*="Upload files"]',
        '[role="menuitem"]',
        "button"
      ];
      for (const selector of selectors) {
        try {
          rootNode.querySelectorAll?.(selector).forEach((candidate) => {
            if (!candidate || seen.has(candidate)) return;
            seen.add(candidate);
            items.push(candidate);
          });
        } catch {
          // Selector support varies across synthetic and host-controlled roots.
        }
      }
      try {
        rootNode.querySelectorAll?.("*").forEach((element) => {
          if (element?.shadowRoot) {
            collectGeminiUploadFilesMenuItemsFromRoot(element.shadowRoot, items, seen, visitedRoots);
          }
        });
      } catch {
        // Best-effort shadow traversal only.
      }
    }

    function findGeminiUploadFilesMenuItem() {
      if (!isGeminiHost()) return null;
      const items = [];
      const seen = new WeakSet();
      const visitedRoots = new WeakSet();
      collectGeminiUploadFilesMenuItemsFromRoot(documentRef, items, seen, visitedRoots);
      const overlayItem = discoverGeminiUploadOverlayItem();
      return (
        items.find((candidate) => {
          const testId = candidate.getAttribute?.("data-test-id") || candidate.dataset?.testId || "";
          return testId === "local-images-files-uploader-button" && isSafeGeminiUploadFilesMenuItem(candidate);
        }) ||
        items.find((candidate) => isSafeGeminiUploadFilesMenuItem(candidate)) ||
        (isSafeGeminiUploadFilesMenuItem(overlayItem) ? overlayItem : null) ||
        null
      );
    }

    function openGeminiUploadFilesMenuItemSafely(menuItem) {
      if (!isSafeGeminiUploadFilesMenuItem(menuItem) || isFileInputElement(menuItem)) return false;
      try {
        for (const type of ["pointerdown", "mousedown", "mouseup", "click"]) {
          menuItem.dispatchEvent(createGeminiUploadMenuEvent(type));
        }
        return true;
      } catch {
        return false;
      }
    }

    function isGeminiHiddenFileSelectorTrigger(candidate) {
      if (!candidate || String(candidate.tagName || "").toUpperCase() !== "BUTTON") return false;
      if (candidate.disabled || isFileInputElement(candidate)) return false;
      const className = String(candidate.className || candidate.getAttribute?.("class") || "");
      return /\bhidden-local-file-image-selector-button\b/.test(className);
    }

    function collectGeminiHiddenFileSelectorTriggersFromRoot(rootNode, candidates, seen, visitedRoots) {
      if (!rootNode || visitedRoots.has(rootNode)) return;
      visitedRoots.add(rootNode);
      const selectors = [
        "button.hidden-local-file-image-selector-button[xapfileselectortrigger]",
        ".hidden-local-file-image-selector-button[xapfileselectortrigger]",
        "button.hidden-local-file-image-selector-button",
        ".hidden-local-file-image-selector-button"
      ];
      for (const selector of selectors) {
        try {
          rootNode.querySelectorAll?.(selector).forEach((candidate) => {
            if (!candidate || seen.has(candidate)) return;
            seen.add(candidate);
            if (isGeminiHiddenFileSelectorTrigger(candidate)) {
              candidates.push(candidate);
            }
          });
        } catch {
        // Selector support varies across synthetic and host-controlled roots.
        }
      }
      try {
        rootNode.querySelectorAll?.("*").forEach((element) => {
          if (element?.shadowRoot) {
            collectGeminiHiddenFileSelectorTriggersFromRoot(element.shadowRoot, candidates, seen, visitedRoots);
          }
        });
      } catch {
        // Best-effort shadow traversal only.
      }
    }

    function findGeminiHiddenFileSelectorTrigger() {
      if (!isGeminiHost()) return null;
      const candidates = [];
      collectGeminiHiddenFileSelectorTriggersFromRoot(documentRef, candidates, new WeakSet(), new WeakSet());
      return candidates.find(isGeminiHiddenFileSelectorTrigger) || null;
    }

    function findGeminiHiddenFileSelectorTriggerInNode(node) {
      if (!isGeminiHost() || !node || typeof node !== "object") return null;
      const candidate = normalizeTarget(node);
      if (isGeminiHiddenFileSelectorTrigger(candidate)) return candidate;

      const candidates = [];
      const seen = new WeakSet();
      const visitedRoots = new WeakSet();
      collectGeminiHiddenFileSelectorTriggersFromRoot(node, candidates, seen, visitedRoots);
      if (node.shadowRoot) {
        collectGeminiHiddenFileSelectorTriggersFromRoot(node.shadowRoot, candidates, seen, visitedRoots);
      }
      return candidates.find(isGeminiHiddenFileSelectorTrigger) || null;
    }

    function findGeminiHiddenFileSelectorTriggerInMutations(mutations) {
      if (!isGeminiHost() || !mutations) return null;
      for (const mutation of Array.from(mutations || [])) {
        const nodes = [];
        if (mutation?.target) nodes.push(mutation.target);
        try {
          nodes.push(...Array.from(mutation?.addedNodes || []));
        } catch {
          // Synthetic mutation records may not expose iterable node lists.
        }
        for (const node of nodes) {
          const trigger = findGeminiHiddenFileSelectorTriggerInNode(node);
          if (trigger) return trigger;
        }
      }
      return null;
    }

    function activateGeminiHiddenFileSelectorTriggerSafely(trigger) {
      if (!isGeminiHiddenFileSelectorTrigger(trigger)) return false;
      try {
        for (const type of ["pointerdown", "mousedown", "mouseup"]) {
          trigger.dispatchEvent?.(createGeminiUploadMenuEvent(type));
        }
        if (typeof trigger.click === "function") {
          trigger.click();
        } else {
          trigger.dispatchEvent?.(createGeminiUploadMenuEvent("click"));
        }
        return true;
      } catch {
        try {
          trigger.dispatchEvent?.(createGeminiUploadMenuEvent("click"));
          return true;
        } catch {
          return false;
        }
      }
    }

    async function waitForGeminiUploadFilesMenuItem(timeoutMs = 3000) {
      let menuItem = findGeminiUploadFilesMenuItem();
      if (menuItem) return menuItem;

      if (typeof MutationObserverRef !== "function") {
        return null;
      }

      return await new Promise((resolve) => {
        let settled = false;
        let observer = null;
        let timeoutId = 0;
        const finish = (force = false) => {
          if (settled) return;
          menuItem = findGeminiUploadFilesMenuItem();
          if (!menuItem && !force) return;
          settled = true;
          if (observer) {
            try {
              observer.disconnect();
            } catch {
              // Best-effort cleanup only.
            }
          }
          if (timeoutId) clearTimeoutFn(timeoutId);
          resolve(menuItem || null);
        };

        try {
          observer = new MutationObserverRef(() => finish(false));
          observer.observe(documentRef.body || documentRef.documentElement || documentRef, {
            childList: true,
            subtree: true
          });
        } catch {
          observer = null;
        }

        const raf =
          typeof root !== "undefined" && typeof root.requestAnimationFrame === "function"
            ? root.requestAnimationFrame
            : null;
        if (raf) {
          try {
            raf(() => finish(false));
          } catch {
            finish(false);
          }
        }

        timeoutId = setTimeoutFn(() => finish(true), timeoutMs);
      });
    }

    function isLikelyGeminiUploadClickTarget(target) {
      const candidate = normalizeTarget(target);
      const explicitSelectors = [
        'button[aria-label="Open upload file menu"]',
        'button[data-test-id="local-images-files-uploader-button"]',
        'button[role="menuitem"][aria-label="Upload files. Documents, data, code files"]',
        "button.hidden-local-file-image-selector-button[xapfileselectortrigger]"
      ];
      for (const selector of explicitSelectors) {
        try {
          const matched = candidate?.matches?.(selector) ? candidate : candidate?.closest?.(selector);
          if (matched) return true;
        } catch {
          // Host-controlled selectors can fail; use metadata checks below.
        }
      }

      const meta = describeElementForDebug(candidate);
      const testId = candidate?.getAttribute?.("data-test-id") || candidate?.dataset?.testId || "";
      if (testId === "local-images-files-uploader-button") return true;
      if (meta?.ariaLabel === "Open upload file menu") return true;
      if (meta?.role === "menuitem" && meta?.ariaLabel === "Upload files. Documents, data, code files") {
        return true;
      }
      if (
        candidate?.classList?.contains?.("hidden-local-file-image-selector-button") &&
        candidate.getAttribute?.("xapfileselectortrigger") !== null
      ) {
        return true;
      }
      return false;
    }

    function isRejectedGeminiUploadMenuItem(candidate) {
      const meta = describeElementForDebug(candidate);
      const haystack = `${meta?.ariaLabel || ""} ${meta?.title || ""} ${meta?.textSnippet || ""}`.toLowerCase();
      return haystack.includes("drive") || haystack.includes("photos") || haystack.includes("notebooklm");
    }

    function scoreGeminiUploadMenuItem(candidate) {
      if (!candidate || isRejectedGeminiUploadMenuItem(candidate)) return 0;
      const meta = describeElementForDebug(candidate);
      const label = meta?.ariaLabel || "";
      const text = meta?.textSnippet || "";
      const role = meta?.role || "";
      if (role === "menuitem" && label === "Upload files. Documents, data, code files") return 100;
      if (role === "menuitem" && /^files$/i.test(label || text)) return 95;
      if (role === "menuitem" && /upload files/i.test(label)) return 80;
      if (role === "menuitem" && /upload files/i.test(text)) return 70;
      if (/\bfiles\b/i.test(label) || /\bfiles\b/i.test(text)) return 60;
      if (/upload files/i.test(label) || /upload files/i.test(text)) return 50;
      return 0;
    }

    function discoverGeminiUploadOverlayItem(details) {
      const roots = [];
      const stats = { openShadowRootCount: 0 };
      collectRootsWithOpenShadow(documentRef, roots, new WeakSet(), stats);
      const candidates = [];
      const seen = new WeakSet();
      const selectors = [
        ".cdk-overlay-container",
        ".cdk-overlay-pane",
        'mat-action-list[role="menu"]',
        '[role="menuitem"]',
        "button"
      ];

      const addCandidate = (candidate, source) => {
        if (!candidate || seen.has(candidate)) return;
        seen.add(candidate);
        if (candidate.matches?.(".cdk-overlay-container, .cdk-overlay-pane, mat-action-list")) {
          return;
        }
        const score = scoreGeminiUploadMenuItem(candidate);
        candidates.push({ candidate, source, score });
      };

      roots.forEach((rootNode) => {
        selectors.forEach((selector) => {
          try {
            rootNode.querySelectorAll?.(selector).forEach((candidate) => addCandidate(candidate, selector));
          } catch {
            // Keep diagnostics best-effort.
          }
        });
      });

      const selected = candidates
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)[0]?.candidate || null;

      if (details) {
        details.openShadowRootCount = Math.max(Number(details.openShadowRootCount || 0), stats.openShadowRootCount);
        details.overlayItemCount = candidates.length;
        details.overlayCandidates = candidates
          .slice(0, 20)
          .map(({ candidate, source, score }) => ({
            ...describeElementForDebug(candidate, source),
            score
          }));
        details.selectedOverlayItem = describeElementForDebug(selected, "gemini-upload-overlay-item");
      }

      return selected;
    }

    function isForbiddenGeminiUploadButton(candidate) {
      const className = String(candidate?.className || candidate?.getAttribute?.("class") || "");
      return /\bhidden-local-(?:file-image-selector|upload|file-upload)-button\b/.test(className);
    }

    function isAllowedGeminiUploadMenuOpener(candidate) {
      if (!candidate || isForbiddenGeminiUploadButton(candidate)) return false;
      if (!isGeminiUploadMenuButtonVisible(candidate)) return false;
      if (hasGeminiUploadMenuIntent(describeElementForDebug(candidate)) && !isUnsafeGeminiUploadMenuButton(candidate)) {
        return true;
      }
      return isSafeGeminiUploadMenuButton(candidate);
    }

    function clickElementSafely(candidate) {
      if (isForbiddenGeminiUploadButton(candidate)) return false;
      if (!candidate || !isGeminiUploadMenuButtonVisible(candidate)) return false;
      try {
        candidate.click?.();
        return true;
      } catch {
        try {
          const clickEvent =
            typeof MouseEventRef === "function"
              ? new MouseEventRef("click", {
                  bubbles: true,
                  cancelable: true
                })
              : createGeminiUploadMenuEvent("click");
          candidate.dispatchEvent?.(clickEvent);
          return true;
        } catch {
          return false;
        }
      }
    }

    return Object.freeze({
      openGeminiUploadMenuSafely,
      isGeminiUploadMenuButtonVisible,
      isUnsafeGeminiUploadMenuButton,
      hasGeminiUploadMenuIntent,
      isGeminiSourceUploadIcon,
      isSafeGeminiUploadMenuButton,
      collectGeminiUploadMenuButtonsFromRoot,
      findGeminiUploadMenuButton,
      describeGeminiUploadMenuDiscovery,
      isSafeGeminiUploadFilesMenuItem,
      collectGeminiUploadFilesMenuItemsFromRoot,
      findGeminiUploadFilesMenuItem,
      openGeminiUploadFilesMenuItemSafely,
      isGeminiHiddenFileSelectorTrigger,
      collectGeminiHiddenFileSelectorTriggersFromRoot,
      findGeminiHiddenFileSelectorTrigger,
      findGeminiHiddenFileSelectorTriggerInNode,
      findGeminiHiddenFileSelectorTriggerInMutations,
      activateGeminiHiddenFileSelectorTriggerSafely,
      waitForGeminiUploadFilesMenuItem,
      isLikelyGeminiUploadClickTarget,
      isRejectedGeminiUploadMenuItem,
      scoreGeminiUploadMenuItem,
      discoverGeminiUploadOverlayItem,
      isForbiddenGeminiUploadButton,
      isAllowedGeminiUploadMenuOpener,
      clickElementSafely
    });
  }

  PWM.GeminiUploadDiscovery = Object.freeze({
    createGeminiUploadDiscovery
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = PWM.GeminiUploadDiscovery;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
