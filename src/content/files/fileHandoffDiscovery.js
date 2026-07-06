(function initFileHandoffDiscovery(root) {
  "use strict";

  const PWM = (root.PWM = root.PWM || {});

  function createFileHandoffDiscovery(dependencies = {}) {
    const documentRef = dependencies.documentRef || root.document || {};
    const MutationObserverRef =
      dependencies.MutationObserverRef === undefined ? root.MutationObserver : dependencies.MutationObserverRef;
    const setTimeoutFn = dependencies.setTimeoutFn || root.setTimeout?.bind(root) || ((callback) => callback());
    const clearTimeoutFn = dependencies.clearTimeoutFn || root.clearTimeout?.bind(root) || (() => {});
    const isFileInputElement = dependencies.isFileInputElement || (() => false);
    const normalizeTarget = dependencies.normalizeTarget || ((target) => target || null);
    const fileInputAcceptsHandoffFiles = dependencies.fileInputAcceptsHandoffFiles || (() => false);
    const isWhatsAppHandoffContext = dependencies.isWhatsAppHandoffContext || (() => false);
    const describeElementForDebug = dependencies.describeElementForDebug || (() => ({}));
    const describeFileForDebug = dependencies.describeFileForDebug || (() => ({}));
    const describeFileHandoffAdapter = dependencies.describeFileHandoffAdapter || (() => ({}));
    const describeFileInputForDebug = dependencies.describeFileInputForDebug || (() => ({}));
    const debugReveal = dependencies.debugReveal || (() => {});
    const createGeminiUploadMenuEvent =
      dependencies.createGeminiUploadMenuEvent || ((type) => new Event(type, { bubbles: true, cancelable: true }));
    const createSanitizedFileHandoffDetails = dependencies.createSanitizedFileHandoffDetails || (() => ({}));
    const createSanitizedDataTransferForHandoff = dependencies.createSanitizedDataTransferForHandoff || (() => null);
    const handOffSanitizedFileInput = dependencies.handOffSanitizedFileInput || (() => false);
    const isFileHandoffAdapterPendingAttachEnabled =
      dependencies.isFileHandoffAdapterPendingAttachEnabled || (() => false);
    const logSanitizedFileHandoffFailure = dependencies.logSanitizedFileHandoffFailure || (() => {});
    const clearPendingSanitizedFileHandoff = dependencies.clearPendingSanitizedFileHandoff || (() => {});

    function collectFileInputsFromAncestry(target, addCandidate) {
      let node = normalizeTarget(target);
      const visited = new WeakSet();

      while (node && !visited.has(node)) {
        visited.add(node);
        addCandidate(node, "target-ancestry");

        try {
          node.querySelectorAll?.("input[type='file']").forEach((candidate) => {
            addCandidate(candidate, "target-ancestry");
          });
        } catch {
          // Host-controlled elements can reject selectors; keep the fail-closed path intact.
        }

        const rootNode = node.getRootNode?.();
        node = node.parentElement || rootNode?.host || null;
      }
    }

    function collectFileInputsFromRoot(rootNode, addCandidate, visitedRoots) {
      if (!rootNode || visitedRoots.has(rootNode)) return;
      visitedRoots.add(rootNode);

      try {
        rootNode.querySelectorAll?.("input[type='file']").forEach((candidate) => {
          addCandidate(candidate, rootNode === documentRef ? "document" : "shadow-root");
        });
      } catch {
        // Some host-controlled roots can reject selectors; skip them and keep scanning others.
      }

      let elements = [];
      try {
        elements = Array.from(rootNode.querySelectorAll?.("*") || []);
      } catch {
        elements = [];
      }

      elements.forEach((element) => {
        if (element?.shadowRoot) {
          collectFileInputsFromRoot(element.shadowRoot, addCandidate, visitedRoots);
        }
      });
    }

    function describeUploadTriggerForDebug(trigger, source = "") {
      return describeElementForDebug(trigger, source);
    }

    function collectFileHandoffElementsFromRoot(rootNode, addInput, addUploadTrigger, visitedRoots, stats) {
      if (!rootNode || visitedRoots.has(rootNode)) return;
      visitedRoots.add(rootNode);

      try {
        rootNode.querySelectorAll?.("input[type='file']").forEach((candidate) => {
          addInput(candidate, rootNode === documentRef ? "document" : "shadow-root");
        });
      } catch {
        // Host-controlled roots can reject selectors; keep scanning other roots.
      }

      const uploadSelectors = [
        'button[aria-label="Add files"]',
        'button[aria-label="Open upload file menu"]',
        '[role="button"][aria-label*="add files" i]',
        '[role="button"][aria-label*="upload" i]',
        'button[aria-label*="upload" i]',
        'button[aria-label*="file" i]',
        'button[aria-label*="attach" i]',
        "button"
      ];
      for (const selector of uploadSelectors) {
        try {
          rootNode.querySelectorAll?.(selector).forEach((candidate) => {
            addUploadTrigger(candidate, selector, rootNode === documentRef ? "document" : "shadow-root");
          });
        } catch {
          // Case-insensitive attribute selectors are not universally available in synthetic DOMs.
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
          if (stats) {
            stats.openShadowRootCount += 1;
          }
          collectFileHandoffElementsFromRoot(element.shadowRoot, addInput, addUploadTrigger, visitedRoots, stats);
        }
      });
    }

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

    function candidateMatchesAnySelector(candidate, selectors) {
      if (!candidate || !Array.isArray(selectors)) return false;
      return selectors.some((selector) => {
        try {
          return Boolean(candidate.matches?.(selector));
        } catch {
          return false;
        }
      });
    }

    function getAdapterUploadClickCandidates(eventOrTarget) {
      const rawCandidates = [];
      try {
        if (typeof eventOrTarget?.composedPath === "function") {
          rawCandidates.push(...eventOrTarget.composedPath());
        }
      } catch {
        // Host event paths are best-effort.
      }
      rawCandidates.push(eventOrTarget?.target || eventOrTarget);

      const candidates = [];
      const seen = new WeakSet();
      for (const rawCandidate of rawCandidates) {
        const candidate = normalizeTarget(rawCandidate);
        if (!candidate || seen.has(candidate)) continue;
        seen.add(candidate);
        candidates.push(candidate);

        try {
          const closest = candidate.closest?.("button, label, input[type='file'], [role='button'], [role='menuitem']");
          if (closest && !seen.has(closest)) {
            seen.add(closest);
            candidates.push(closest);
          }
        } catch {
          // Synthetic and host-controlled nodes can reject selectors.
        }
      }
      return candidates;
    }

    function isUnsafeFileHandoffClickTarget(adapter, candidate) {
      if (!candidate) return true;
      if (candidate.disabled) return true;
      if (candidateMatchesAnySelector(candidate, adapter?.unsafeClickSelectors || [])) return true;
      const meta = describeElementForDebug(candidate);
      const haystack = `${meta?.ariaLabel || ""} ${meta?.title || ""} ${meta?.textSnippet || ""} ${meta?.className || ""}`.toLowerCase();
      return /\b(?:send|submit|mic|microphone|voice|record|settings|close|remove|delete|drive|photos?|cloud|import)\b/.test(
        haystack
      );
    }

    function isLikelyGenericUploadClickTarget(adapter, eventOrTarget) {
      return getAdapterUploadClickCandidates(eventOrTarget).some((candidate) => {
        if (!candidate || isUnsafeFileHandoffClickTarget(adapter, candidate)) return false;
        if (isFileInputElement(candidate)) return true;

        const tag = String(candidate.tagName || "").toUpperCase();
        const meta = describeElementForDebug(candidate);
        const role = String(meta?.role || "").toLowerCase();
        if (tag !== "BUTTON" && tag !== "LABEL" && tag !== "INPUT" && role !== "button" && role !== "menuitem") {
          return false;
        }
        if (candidateMatchesAnySelector(candidate, adapter?.uploadButtonSelectors || [])) return true;
        if (candidateMatchesAnySelector(candidate, adapter?.uploadMenuItemSelectors || [])) return true;

        const haystack = `${meta?.ariaLabel || ""} ${meta?.title || ""} ${meta?.textSnippet || ""} ${meta?.className || ""}`.toLowerCase();
        return /\b(?:upload|attach|files?|add)\b/.test(haystack);
      });
    }

    function collectAdapterSelectorCandidates(adapter, selectors, event, input) {
      const candidates = [];
      const seen = new WeakSet();
      const addCandidate = (candidate, source = "") => {
        const normalized = normalizeTarget(candidate);
        if (!normalized || seen.has(normalized)) return;
        seen.add(normalized);
        candidates.push({ candidate: normalized, source });
      };

      const target = normalizeTarget(event?.target);
      for (const selector of selectors || []) {
        try {
          target?.closest?.("[role='dialog'], form, main, body")?.querySelectorAll?.(selector).forEach((candidate) => {
            addCandidate(candidate, "target-scope");
          });
        } catch {
          // Keep broad discovery available below.
        }
        try {
          input?.closest?.("form")?.querySelectorAll?.(selector).forEach((candidate) => {
            addCandidate(candidate, "composer-form");
          });
        } catch {
          // Continue best-effort discovery.
        }
      }

      const roots = [];
      collectRootsWithOpenShadow(documentRef, roots, new WeakSet(), null);
      for (const scanRoot of roots) {
        for (const selector of selectors || []) {
          try {
            scanRoot.querySelectorAll?.(selector).forEach((candidate) => {
              addCandidate(candidate, scanRoot === documentRef ? "document" : "shadow-root");
            });
          } catch {
            // Some adapter selectors are intentionally modern and may not parse everywhere.
          }
        }
      }

      return candidates;
    }

    function scoreFileInputForHandoff(fileInput, source, files, options = {}) {
      if (!isFileInputElement(fileInput) || fileInput.disabled) return -1;
      const expectedFiles = Array.from(files || []).filter(Boolean);
      const acceptsFiles = fileInputAcceptsHandoffFiles(fileInput, expectedFiles);
      if (!acceptsFiles && options?.allowIncompatible !== true) return -1;
      let score = acceptsFiles ? 1 : 0;
      if (String(source || "").includes("target")) score += 2;
      if (String(source || "").includes("form")) score += 1;
      if (expectedFiles.length > 1 && fileInput.multiple === true) score += 4;
      const accept = String(fileInput.accept || fileInput.getAttribute?.("accept") || "").trim();
      if (accept && acceptsFiles) score += 3;
      return score;
    }

    function getFileInputDiscoveryScope(target) {
      const explicitWhatsAppScope = target?.closest?.("[data-shell='whatsapp']");
      if (explicitWhatsAppScope) return explicitWhatsAppScope;
      if (isWhatsAppHandoffContext()) {
        return target?.closest?.("[data-shell='whatsapp'], footer, [role='dialog'], form, main") || null;
      }
      return target?.closest?.("[role='dialog'], form, main, body") || null;
    }

    function discoverFileInputForHandoff(event, input, options = {}) {
      const candidates = [];
      const seen = new WeakSet();
      const addCandidate = (candidate, source = "") => {
        if (!isFileInputElement(candidate) || seen.has(candidate)) return;
        seen.add(candidate);
        candidates.push({ input: candidate, source });
      };

      collectFileInputsFromAncestry(event?.target, addCandidate);

      const target = normalizeTarget(event?.target);
      const discoveryScope = getFileInputDiscoveryScope(target);
      const preferredSelectors = [
        "input[type='file'][accept*='text']",
        "input[type='file'][accept*='.txt']",
        "input[type='file'][accept*='.md']",
        "input[type='file'][accept*='.json']",
        "input[type='file'][accept*='.csv']",
        "input[type='file']"
      ];
      for (const selector of preferredSelectors) {
        try {
          discoveryScope?.querySelectorAll?.(selector).forEach((candidate) => {
            addCandidate(candidate, "target-scope");
          });
        } catch {
          // Host-controlled selectors can fail; broader discovery below remains fail-closed.
        }
      }
      target?.closest?.("form")?.querySelectorAll?.("input[type='file']").forEach((candidate) => {
        addCandidate(candidate, "target-form");
      });
      input?.closest?.("form")?.querySelectorAll?.("input[type='file']").forEach((candidate) => {
        addCandidate(candidate, "composer-form");
      });
      if (!(isWhatsAppHandoffContext() && discoveryScope)) {
        collectFileInputsFromRoot(documentRef, addCandidate, new WeakSet());
      }

      const expectedFiles = Array.from(options?.expectedFiles || []).filter(Boolean);
      const rankedCandidates = candidates
        .map(({ input: candidate, source }, index) => ({
          input: candidate,
          source,
          index,
          score: scoreFileInputForHandoff(candidate, source, expectedFiles, options)
        }))
        .filter((candidate) => candidate.score >= 0)
        .sort((left, right) => right.score - left.score || left.index - right.index);
      const fileInput = rankedCandidates[0]?.input || null;
      debugReveal(`file-drag:input-${fileInput ? "found" : "not-found"}`, {
        targetTag: target?.tagName || "",
        candidateCount: candidates.length,
        expectedFileCount: expectedFiles.length,
        candidates: candidates.map(({ input: candidate, source }) => ({
          ...describeFileInputForDebug(candidate, source),
          compatible: fileInputAcceptsHandoffFiles(candidate, expectedFiles)
        }))
      });

      return fileInput;
    }

    function resolveFileInputForHandoff(event, input, options = {}) {
      if (isFileInputElement(input) && fileInputAcceptsHandoffFiles(input, options?.expectedFiles || [])) {
        return input;
      }
      const target = normalizeTarget(event?.target);
      if (isFileInputElement(target) && fileInputAcceptsHandoffFiles(target, options?.expectedFiles || [])) {
        return target;
      }
      return discoverFileInputForHandoff(event, input, options);
    }

    function resolveGenericAdapterFileInput(adapter, event, input) {
      const candidates = collectAdapterSelectorCandidates(
        adapter,
        adapter?.fileInputSelectors || ["input[type='file']"],
        event,
        input
      )
        .map(({ candidate }) => candidate)
        .filter((candidate) => isFileInputElement(candidate) && !candidate.disabled);
      if (candidates.length) return candidates[0];
      return resolveFileInputForHandoff(event, input);
    }

    function findGenericAdapterUploadTrigger(adapter, event, input) {
      const candidates = collectAdapterSelectorCandidates(adapter, adapter?.uploadButtonSelectors || [], event, input)
        .map(({ candidate }) => candidate)
        .filter((candidate) => !isFileInputElement(candidate) && isLikelyGenericUploadClickTarget(adapter, candidate));
      return candidates[0] || null;
    }

    function activateAdapterUploadElementSafely(adapter, candidate) {
      if (!candidate || isFileInputElement(candidate) || isUnsafeFileHandoffClickTarget(adapter, candidate)) {
        return false;
      }
      if (!isLikelyGenericUploadClickTarget(adapter, candidate)) return false;
      try {
        for (const type of ["pointerdown", "mousedown", "mouseup", "click"]) {
          candidate.dispatchEvent(createGeminiUploadMenuEvent(type));
        }
        return true;
      } catch {
        return false;
      }
    }

    async function waitForGenericAdapterFileInput(adapter, timeoutMs = 2500, event = null, input = null) {
      let fileInput =
        adapter?.resolveFileInput?.(event, input, adapter) || resolveGenericAdapterFileInput(adapter, event, input);
      if (fileInput) return fileInput;
      if (typeof MutationObserverRef !== "function") return null;

      return await new Promise((resolve) => {
        let settled = false;
        let observer = null;
        let timeoutId = 0;
        const finish = (force = false) => {
          if (settled) return;
          fileInput =
            adapter?.resolveFileInput?.(event, input, adapter) || resolveGenericAdapterFileInput(adapter, event, input);
          if (!fileInput && !force) return;
          settled = true;
          if (observer) {
            try {
              observer.disconnect();
            } catch {
              // Best-effort cleanup only.
            }
          }
          if (timeoutId) clearTimeoutFn(timeoutId);
          resolve(fileInput || null);
        };

        try {
          observer = new MutationObserverRef(() => finish(false));
          observer.observe(documentRef.documentElement || documentRef, {
            childList: true,
            subtree: true
          });
        } catch {
          observer = null;
        }
        setTimeoutFn(() => finish(false), 0);
        timeoutId = setTimeoutFn(() => finish(true), timeoutMs);
      });
    }

    async function attachGenericPendingWithTrustedActivation(adapter, pending) {
      if (!adapter || !isFileHandoffAdapterPendingAttachEnabled(adapter) || !pending?.sanitizedFile) {
        return false;
      }
      const event = pending.event || { type: `pending-${adapter.id}-sanitized-file`, target: pending.target || null };
      let fileInput =
        adapter.resolveFileInput?.(event, pending.input, adapter) ||
        resolveGenericAdapterFileInput(adapter, event, pending.input);

      if (!fileInput) {
        const uploadTrigger =
          adapter.resolveUploadTrigger?.(event, pending.input, adapter) ||
          findGenericAdapterUploadTrigger(adapter, event, pending.input);
        if (uploadTrigger) {
          activateAdapterUploadElementSafely(adapter, uploadTrigger);
        }
        const menuItem = adapter.resolveUploadMenuItem?.(event, pending.input, adapter);
        if (menuItem) {
          activateAdapterUploadElementSafely(adapter, menuItem);
        }
        fileInput = await waitForGenericAdapterFileInput(adapter, 2500, event, pending.input);
      }

      if (!fileInput) {
        debugReveal("file-handoff:pending-input-not-found", {
          site: adapter.id,
          adapter: describeFileHandoffAdapter(adapter),
          sanitizedFile: describeFileForDebug(pending.sanitizedFile)
        });
        return false;
      }

      debugReveal("file-handoff:pending-input-captured", {
        site: adapter.id,
        input: describeFileInputForDebug(fileInput, `pending-${adapter.id}-file-input`),
        sanitizedFile: describeFileForDebug(pending.sanitizedFile)
      });
      const details = createSanitizedFileHandoffDetails(
        event,
        pending.sanitizedFile,
        `${adapter.id}:pending-user-attach`
      );
      const transfer = createSanitizedDataTransferForHandoff(pending.sanitizedFile, details);
      const assigned = transfer
        ? handOffSanitizedFileInput(fileInput, transfer, {
            dispatchInput: true,
            details
          })
        : false;
      if (!assigned) {
        details.failureReason = details.failureReason || "pending_user_attach_assignment_failed";
        logSanitizedFileHandoffFailure(details);
        return false;
      }
      debugReveal("file-handoff:pending-assigned", {
        site: adapter.id,
        input: describeFileInputForDebug(fileInput, `pending-${adapter.id}-file-input`),
        sanitizedFile: describeFileForDebug(pending.sanitizedFile)
      });
      clearPendingSanitizedFileHandoff(adapter, "assigned");
      return true;
    }

    return Object.freeze({
      collectFileInputsFromAncestry,
      collectFileInputsFromRoot,
      describeUploadTriggerForDebug,
      collectFileHandoffElementsFromRoot,
      collectRootsWithOpenShadow,
      candidateMatchesAnySelector,
      getAdapterUploadClickCandidates,
      isUnsafeFileHandoffClickTarget,
      isLikelyGenericUploadClickTarget,
      collectAdapterSelectorCandidates,
      scoreFileInputForHandoff,
      getFileInputDiscoveryScope,
      discoverFileInputForHandoff,
      resolveFileInputForHandoff,
      resolveGenericAdapterFileInput,
      findGenericAdapterUploadTrigger,
      activateAdapterUploadElementSafely,
      waitForGenericAdapterFileInput,
      attachGenericPendingWithTrustedActivation
    });
  }

  PWM.FileHandoffDiscovery = Object.freeze({
    createFileHandoffDiscovery
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = PWM.FileHandoffDiscovery;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
