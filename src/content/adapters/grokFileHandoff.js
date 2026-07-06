(function initGrokFileHandoff(root) {
  "use strict";

  const PWM = (root.PWM = root.PWM || {});

  function createGrokFileHandoff(dependencies = {}) {
    const documentRef = dependencies.documentRef || root.document || {};
    const MutationObserverRef =
      dependencies.MutationObserverRef === undefined ? root.MutationObserver : dependencies.MutationObserverRef;
    const setTimeoutFn = dependencies.setTimeoutFn || root.setTimeout?.bind(root) || ((callback) => callback());
    const clearTimeoutFn = dependencies.clearTimeoutFn || root.clearTimeout?.bind(root) || (() => {});
    const isGrokHost = dependencies.isGrokHost || (() => false);
    const isFileInputElement = dependencies.isFileInputElement || (() => false);
    const normalizeTarget = dependencies.normalizeTarget || ((target) => target || null);
    const describeElementForDebug = dependencies.describeElementForDebug || (() => ({}));
    const describeFileForDebug = dependencies.describeFileForDebug || (() => ({}));
    const describeFileInputForDebug = dependencies.describeFileInputForDebug || (() => ({}));
    const createGeminiUploadMenuEvent =
      dependencies.createGeminiUploadMenuEvent || ((type) => new Event(type, { bubbles: true, cancelable: true }));
    const debugReveal = dependencies.debugReveal || (() => {});
    const createSanitizedFileHandoffDetails = dependencies.createSanitizedFileHandoffDetails || (() => ({}));
    const createSanitizedDataTransferForHandoff = dependencies.createSanitizedDataTransferForHandoff || (() => null);
    const handOffSanitizedFileInput = dependencies.handOffSanitizedFileInput || (() => false);
    const logSanitizedFileHandoffFailure = dependencies.logSanitizedFileHandoffFailure || (() => {});
    const clearPendingGrokSanitizedFileHandoff = dependencies.clearPendingGrokSanitizedFileHandoff || (() => {});
    const showFileProcessingSuccess = dependencies.showFileProcessingSuccess || (() => {});
    const setBadge = dependencies.setBadge || (() => {});
    const hideBadgeSoon = dependencies.hideBadgeSoon || (() => {});
    const refreshBadgeFromCurrentInput = dependencies.refreshBadgeFromCurrentInput || (() => {});
    const suppressStaleHandoffErrorAfterSuccess =
      dependencies.suppressStaleHandoffErrorAfterSuccess || (() => false);
    const shouldUseFirefoxTextFallbackForFileHandoff =
      dependencies.shouldUseFirefoxTextFallbackForFileHandoff || (() => false);
    const resolveFileInputForHandoff = dependencies.resolveFileInputForHandoff || (() => null);
    const dispatchSanitizedFileEvent = dependencies.dispatchSanitizedFileEvent || (() => false);

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

    function collectFileInputsFromAncestry(node, addInput) {
      const visited = new WeakSet();
      let current = normalizeTarget(node);
      while (current && typeof current === "object" && !visited.has(current)) {
        visited.add(current);
        if (isFileInputElement(current)) {
          addInput(current, "target-ancestry");
        }
        try {
          current.querySelectorAll?.("input[type='file']").forEach((candidate) => {
            addInput(candidate, "target-ancestry");
          });
        } catch {
          // Synthetic DOMs and host-controlled roots can reject selectors.
        }
        current = current.parentElement || current.getRootNode?.()?.host || null;
      }
    }

    function getGrokUploadClickCandidates(clickEventOrTarget) {
      const rawCandidates = [];
      try {
        if (typeof clickEventOrTarget?.composedPath === "function") {
          rawCandidates.push(...clickEventOrTarget.composedPath());
        }
      } catch {
        // Host event paths are best-effort.
      }
      rawCandidates.push(clickEventOrTarget?.target || clickEventOrTarget);

      const candidates = [];
      const seen = new WeakSet();
      for (const rawCandidate of rawCandidates) {
        const candidate = normalizeTarget(rawCandidate);
        if (!candidate || seen.has(candidate)) continue;
        seen.add(candidate);
        candidates.push(candidate);

        try {
          const closest = candidate.closest?.("button, label, input[type='file'], [role='button']");
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

    function isLikelyGrokUploadClickTarget(clickEventOrTarget) {
      return getGrokUploadClickCandidates(clickEventOrTarget).some((candidate) => {
        if (!candidate || candidate.disabled) return false;
        if (isFileInputElement(candidate)) return true;

        const tag = String(candidate.tagName || "").toUpperCase();
        const meta = describeElementForDebug(candidate);
        const role = String(meta?.role || "").toLowerCase();
        if (tag !== "BUTTON" && tag !== "LABEL" && tag !== "INPUT" && role !== "button") {
          return false;
        }

        const haystack = `${meta?.ariaLabel || ""} ${meta?.title || ""} ${meta?.textSnippet || ""} ${meta?.className || ""}`.toLowerCase();
        return /\b(?:upload|attach|files?|add)\b/.test(haystack);
      });
    }

    function scoreGrokFileInput(candidate, source = "") {
      if (!isFileInputElement(candidate) || candidate.disabled) return -1;
      let score = 0;
      if (candidate.multiple) score += 100;
      const accept = String(candidate.accept || "").toLowerCase();
      if (accept) score += 60;
      if (accept.includes("text") || accept.includes(".txt") || accept.includes(".md") || accept.includes(".json")) {
        score += 20;
      }
      if (/shadow-root/i.test(String(source || ""))) score += 10;
      if (candidate.hidden) score -= 5;
      return score;
    }

    function discoverGrokPendingFileInput(event, input) {
      const inputs = [];
      const seen = new WeakSet();
      const addCandidate = (candidate, source = "") => {
        if (!isFileInputElement(candidate) || seen.has(candidate)) return;
        seen.add(candidate);
        inputs.push({ input: candidate, source });
      };

      collectFileInputsFromAncestry(event?.target, addCandidate);
      try {
        input?.closest?.("form")?.querySelectorAll?.("input[type='file']")?.forEach((candidate) => {
          addCandidate(candidate, "composer-form");
        });
      } catch {
        // Keep global discovery available if a host-controlled form rejects selectors.
      }

      const roots = [];
      const stats = { openShadowRootCount: 0 };
      collectRootsWithOpenShadow(documentRef, roots, new WeakSet(), stats);
      roots.forEach((rootNode) => {
        try {
          rootNode.querySelectorAll?.("input[type='file']").forEach((candidate) => {
            addCandidate(candidate, rootNode === documentRef ? "document" : "shadow-root");
          });
        } catch {
          // Keep scanning other roots.
        }
      });

      const fileInput =
        inputs
          .filter(({ input: candidate }) => !candidate.disabled)
          .sort((a, b) => scoreGrokFileInput(b.input, b.source) - scoreGrokFileInput(a.input, a.source))[0]
          ?.input || null;

      return {
        fileInput,
        fileInputCount: inputs.length,
        openShadowRootCount: stats.openShadowRootCount,
        fileInputs: inputs
      };
    }

    function describeGrokPendingInputDiscovery(discovery) {
      const summary = discovery || {};
      return {
        fileInputCount: Number(summary.fileInputCount || 0),
        openShadowRootCount: Number(summary.openShadowRootCount || 0),
        selectedFileInput: describeFileInputForDebug(summary.fileInput, "selected-grok-file-input"),
        fileInputCandidates: Array.from(summary.fileInputs || [])
          .slice(0, 20)
          .map(({ input, source }) => ({
            ...describeFileInputForDebug(input, source),
            score: scoreGrokFileInput(input, source)
          }))
      };
    }

    function findGrokUploadButton() {
      if (!isGrokHost()) return null;
      const roots = [];
      collectRootsWithOpenShadow(documentRef, roots, new WeakSet(), null);
      const candidates = [];
      const seen = new WeakSet();
      const selectors = ["button", "label", "[role='button']", "input[type='file']"];
      roots.forEach((rootNode) => {
        selectors.forEach((selector) => {
          try {
            rootNode.querySelectorAll?.(selector).forEach((candidate) => {
              if (!candidate || seen.has(candidate)) return;
              seen.add(candidate);
              candidates.push(candidate);
            });
          } catch {
            // Keep scanning other selectors and roots.
          }
        });
      });
      return candidates.find((candidate) => isLikelyGrokUploadClickTarget(candidate)) || null;
    }

    function openGrokUploadButtonSafely(button) {
      if (!button || button.disabled || isFileInputElement(button)) return false;
      if (!isLikelyGrokUploadClickTarget(button)) return false;
      try {
        for (const type of ["pointerdown", "mousedown", "mouseup", "click"]) {
          button.dispatchEvent(createGeminiUploadMenuEvent(type));
        }
        return true;
      } catch {
        return false;
      }
    }

    async function waitForGrokPendingFileInput(timeoutMs = 2500, event = null, input = null) {
      let discovery = discoverGrokPendingFileInput(event, input);
      if (discovery.fileInput) return discovery;

      if (typeof MutationObserverRef !== "function") {
        return discovery;
      }

      return await new Promise((resolve) => {
        let settled = false;
        let observer = null;
        let timeoutId = 0;
        const finish = (force = false) => {
          if (settled) return;
          discovery = discoverGrokPendingFileInput(event, input);
          if (!discovery.fileInput && !force) return;
          settled = true;
          if (observer) {
            try {
              observer.disconnect();
            } catch {
              // Best-effort cleanup only.
            }
          }
          if (timeoutId) clearTimeoutFn(timeoutId);
          resolve(discovery);
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

    async function performPendingGrokUserAttach(event, input, sanitizedFile) {
      if (!isGrokHost() || !sanitizedFile) return false;

      debugReveal("grok-pending-user-attach-start", {
        sanitizedFile: describeFileForDebug(sanitizedFile)
      });

      let discovery = discoverGrokPendingFileInput(event, input);
      if (!discovery.fileInput) {
        const uploadButton = findGrokUploadButton();
        if (uploadButton && !isFileInputElement(uploadButton)) {
          openGrokUploadButtonSafely(uploadButton);
        }
        discovery = await waitForGrokPendingFileInput(2500, event, input);
      }

      const fileInput = discovery.fileInput || null;
      if (!fileInput) {
        debugReveal("file-handoff:grok-pending-input-not-found", {
          reason: "pending-user-attach",
          ...describeGrokPendingInputDiscovery(discovery),
          sanitizedFile: describeFileForDebug(sanitizedFile)
        });
        if (suppressStaleHandoffErrorAfterSuccess("pending_attach_input_not_found", "grok", sanitizedFile)) {
          return true;
        }
        setBadge("LeakGuard is waiting for Grok upload input.");
        hideBadgeSoon(4200);
        refreshBadgeFromCurrentInput();
        return false;
      }

      debugReveal("grok-pending-user-attach-input-captured", {
        input: describeFileInputForDebug(fileInput, "grok-pending-user-attach-input"),
        sanitizedFile: describeFileForDebug(sanitizedFile)
      });
      debugReveal("file-handoff:pending-input-captured", {
        site: "grok",
        reason: "pending-user-attach",
        input: describeFileInputForDebug(fileInput, "grok-pending-user-attach-input"),
        sanitizedFile: describeFileForDebug(sanitizedFile)
      });

      const details = createSanitizedFileHandoffDetails(event, sanitizedFile, "grok:pending-user-attach");
      const transfer = createSanitizedDataTransferForHandoff(sanitizedFile, details);
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

      debugReveal("grok-pending-user-attach-assigned", {
        input: describeFileInputForDebug(fileInput, "grok-pending-user-attach-input"),
        sanitizedFile: describeFileForDebug(sanitizedFile)
      });
      debugReveal("file-handoff:pending-assigned", {
        site: "grok",
        reason: "pending-user-attach",
        input: describeFileInputForDebug(fileInput, "grok-pending-user-attach-input"),
        sanitizedFile: describeFileForDebug(sanitizedFile)
      });
      clearPendingGrokSanitizedFileHandoff("assigned");
      showFileProcessingSuccess("Sanitized file attached.", {
        site: "grok",
        reason: "pending-attached"
      });
      setBadge("LeakGuard attached the sanitized file.");
      hideBadgeSoon(3200);
      refreshBadgeFromCurrentInput();
      return true;
    }

    function handOffGrokSanitizedFileUpload(event, input, sanitizedFile) {
      if (!isGrokHost()) return false;
      if (shouldUseFirefoxTextFallbackForFileHandoff()) return false;

      const details = createSanitizedFileHandoffDetails(event, sanitizedFile, "grok:start");
      const transfer = createSanitizedDataTransferForHandoff(sanitizedFile, details);
      if (!transfer) {
        details.handoffStage = "grok:data-transfer";
        details.failureReason = "data_transfer_failed";
        debugReveal("file-handoff:grok-data-transfer-create-failed", {
          sanitizedFile: describeFileForDebug(sanitizedFile)
        });
        logSanitizedFileHandoffFailure(details);
        return false;
      }

      details.handoffStage = "grok:file-input-discovery";
      const fileInput = resolveFileInputForHandoff(event, input);
      details.fileInputCountBeforeClick = fileInput ? 1 : 0;
      details.fileInputCountAfterTopTriggerClick = fileInput ? 1 : 0;
      details.fileInputCountAfterOverlayItemClick = fileInput ? 1 : 0;
      if (fileInput) {
        const assigned = handOffSanitizedFileInput(fileInput, transfer, { dispatchInput: true, details });
        if (assigned) {
          return true;
        }
        logSanitizedFileHandoffFailure(details);
        return false;
      }

      const target = event?.target || input;
      try {
        transfer.dropEffect = "copy";
      } catch {
        // Some synthetic DataTransfer objects expose dropEffect as read-only.
      }

      if (dispatchSanitizedFileEvent(target, "drop", transfer)) {
        debugReveal("file-handoff:grok-drop-success", {
          sanitizedFile: describeFileForDebug(sanitizedFile)
        });
        return true;
      }

      details.handoffStage = "grok:drop-dispatch";
      details.failureReason = "no_file_input_or_drop_target";
      debugReveal("file-handoff:grok-upload-failed", {
        sanitizedFile: describeFileForDebug(sanitizedFile)
      });
      logSanitizedFileHandoffFailure(details);
      return false;
    }

    return Object.freeze({
      getGrokUploadClickCandidates,
      isLikelyGrokUploadClickTarget,
      scoreGrokFileInput,
      discoverGrokPendingFileInput,
      describeGrokPendingInputDiscovery,
      findGrokUploadButton,
      openGrokUploadButtonSafely,
      waitForGrokPendingFileInput,
      performPendingGrokUserAttach,
      handOffGrokSanitizedFileUpload
    });
  }

  PWM.GrokFileHandoff = Object.freeze({
    createGrokFileHandoff
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = PWM.GrokFileHandoff;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
