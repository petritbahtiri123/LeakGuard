(function initGeminiFileHandoff(root) {
  "use strict";

  const PWM = (root.PWM = root.PWM || {});

  function createGeminiFileHandoff(dependencies = {}) {
    const documentRef = dependencies.documentRef || root.document || {};
    const windowRef = dependencies.windowRef || root.window || root;
    const locationRef = dependencies.locationRef || root.location || {};
    const DataTransferRef = dependencies.DataTransferRef === undefined ? root.DataTransfer : dependencies.DataTransferRef;
    const MutationObserverRef =
      dependencies.MutationObserverRef === undefined ? root.MutationObserver : dependencies.MutationObserverRef;
    const setTimeoutFn = dependencies.setTimeoutFn || root.setTimeout?.bind(root) || ((callback) => callback());
    const clearTimeoutFn = dependencies.clearTimeoutFn || root.clearTimeout?.bind(root) || (() => {});
    const requestAnimationFrameFn =
      dependencies.requestAnimationFrameFn ||
      windowRef.requestAnimationFrame?.bind(windowRef) ||
      null;
    const geminiUploadInputWaitMs = Number(dependencies.geminiUploadInputWaitMs || 450);
    const geminiGhostIngressTimeoutMs = Number(dependencies.geminiGhostIngressTimeoutMs || 2200);
    const firefoxGeminiFileInputBridgeFailureMessage =
      dependencies.firefoxGeminiFileInputBridgeFailureMessage ||
      "LeakGuard blocked the raw file drop. Could not locate Gemini upload input. Please use the upload button or retry.";

    const isGeminiHost = dependencies.isGeminiHost || (() => false);
    const isFirefoxRuntime = dependencies.isFirefoxRuntime || (() => false);
    const isFileInputElement = dependencies.isFileInputElement || (() => false);
    const normalizeTarget = dependencies.normalizeTarget || ((target) => target || null);
    const canUseSyntheticDataTransferFileList =
      dependencies.canUseSyntheticDataTransferFileList || (() => false);
    const shouldUseFirefoxTextFallbackForFileHandoff =
      dependencies.shouldUseFirefoxTextFallbackForFileHandoff || (() => false);
    const createSanitizedFileHandoffDetails = dependencies.createSanitizedFileHandoffDetails || (() => ({}));
    const createSanitizedDataTransferForHandoff =
      dependencies.createSanitizedDataTransferForHandoff || (() => null);
    const handOffSanitizedFileInput = dependencies.handOffSanitizedFileInput || (() => false);
    const injectedDiscoverGeminiFileHandoffElements =
      typeof dependencies.discoverGeminiFileHandoffElements === "function"
        ? dependencies.discoverGeminiFileHandoffElements
        : null;
    const injectedFindGeminiFileInput = dependencies.findGeminiFileInput || null;
    const findGeminiUploadFilesMenuItem = dependencies.findGeminiUploadFilesMenuItem || (() => null);
    const findGeminiUploadMenuButton = dependencies.findGeminiUploadMenuButton || (() => null);
    const openGeminiUploadMenuSafely = dependencies.openGeminiUploadMenuSafely || (() => false);
    const openGeminiUploadFilesMenuItemSafely =
      dependencies.openGeminiUploadFilesMenuItemSafely || (() => false);
    const waitForGeminiUploadFilesMenuItem = dependencies.waitForGeminiUploadFilesMenuItem || (async () => null);
    const findGeminiHiddenFileSelectorTrigger = dependencies.findGeminiHiddenFileSelectorTrigger || (() => null);
    const activateGeminiHiddenFileSelectorTriggerSafely =
      dependencies.activateGeminiHiddenFileSelectorTriggerSafely || (() => false);
    const findGeminiFileDataInputFromEvent = dependencies.findGeminiFileDataInputFromEvent || (() => null);
    const findGeminiFileDataInputInMutations = dependencies.findGeminiFileDataInputInMutations || (() => null);
    const isGeminiHiddenFileSelectorTrigger =
      dependencies.isGeminiHiddenFileSelectorTrigger || ((candidate) => Boolean(candidate));
    const injectedIsGeminiGhostIngressFileInput =
      typeof dependencies.isGeminiGhostIngressFileInput === "function"
        ? dependencies.isGeminiGhostIngressFileInput
        : null;
    const isAllowedGeminiUploadMenuOpener = dependencies.isAllowedGeminiUploadMenuOpener || (() => false);
    const clickElementSafely = dependencies.clickElementSafely || (() => false);
    const discoverGeminiUploadOverlayItem = dependencies.discoverGeminiUploadOverlayItem || (() => null);
    const collectFileInputsFromAncestry = dependencies.collectFileInputsFromAncestry || (() => {});
    const collectFileHandoffElementsFromRoot = dependencies.collectFileHandoffElementsFromRoot || (() => {});
    const collectRootsWithOpenShadow =
      dependencies.collectRootsWithOpenShadow ||
      ((rootNode, roots, visitedRoots, stats) => {
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
      });
    const isSafeGeminiUploadMenuButton = dependencies.isSafeGeminiUploadMenuButton || (() => false);
    const shouldQueueFirefoxGeminiPendingSanitizedFileHandoff =
      dependencies.shouldQueueFirefoxGeminiPendingSanitizedFileHandoff || (() => false);
    const isExpectedFirefoxGeminiNoPickerMiss =
      dependencies.isExpectedFirefoxGeminiNoPickerMiss || (() => false);
    const queuePendingSanitizedFileHandoff = dependencies.queuePendingSanitizedFileHandoff || (() => false);
    const getFileHandoffAdapterById = dependencies.getFileHandoffAdapterById || (() => null);
    const hasPendingGeminiSanitizedFileHandoff =
      dependencies.hasPendingGeminiSanitizedFileHandoff || (() => false);
    const suppressStaleHandoffErrorAfterSuccess =
      dependencies.suppressStaleHandoffErrorAfterSuccess || (() => false);
    const listLocalTransferFiles = dependencies.listLocalTransferFiles || ((transfer) => Array.from(transfer?.files || []));
    const describeFileForDebug = dependencies.describeFileForDebug || (() => ({}));
    const describeFileInputForDebug = dependencies.describeFileInputForDebug || (() => ({}));
    const describeElementForDebug = dependencies.describeElementForDebug || (() => ({}));
    const describeUploadTriggerForDebug =
      dependencies.describeUploadTriggerForDebug || ((trigger, source) => describeElementForDebug(trigger, source));
    const describeGeminiUploadMenuDiscovery = dependencies.describeGeminiUploadMenuDiscovery || (() => ({}));
    const injectedDescribeGeminiOverlayExposure =
      typeof dependencies.describeGeminiOverlayExposure === "function"
        ? dependencies.describeGeminiOverlayExposure
        : null;
    const describeSanitizedFileOrBatchForDebug =
      dependencies.describeSanitizedFileOrBatchForDebug ||
      ((files) => {
        const list = Array.from(files || []);
        return { fileCount: list.length, files: list.map(describeFileForDebug) };
      });
    const debugReveal = dependencies.debugReveal || (() => {});
    const debugFileAttachMetadata = dependencies.debugFileAttachMetadata || (() => {});
    const consumeInterceptionEvent =
      dependencies.consumeInterceptionEvent ||
      ((event) => {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        event?.stopImmediatePropagation?.();
      });
    const assignSafeFileAttachErrorMetadata = dependencies.assignSafeFileAttachErrorMetadata || (() => {});
    const logSanitizedFileHandoffFailure = dependencies.logSanitizedFileHandoffFailure || (() => {});
    const clearPendingGeminiSanitizedFileHandoff =
      dependencies.clearPendingGeminiSanitizedFileHandoff || (() => {});
    const clearPendingGeminiGhostIngressClickInterceptor =
      dependencies.clearPendingGeminiGhostIngressClickInterceptor || (() => {});
    const showFileProcessingSuccess = dependencies.showFileProcessingSuccess || (() => {});
    const setBadge = dependencies.setBadge || (() => {});
    const hideBadgeSoon = dependencies.hideBadgeSoon || (() => {});
    const refreshBadgeFromCurrentInput = dependencies.refreshBadgeFromCurrentInput || (() => {});
    const injectedCountGeminiAttachmentIndicators =
      typeof dependencies.countGeminiAttachmentIndicators === "function"
        ? dependencies.countGeminiAttachmentIndicators
        : null;
    const injectedWaitForGeminiAttachmentIndicators =
      typeof dependencies.waitForGeminiAttachmentIndicators === "function"
        ? dependencies.waitForGeminiAttachmentIndicators
        : null;
    const getCachedGeminiFileInput = dependencies.getCachedGeminiFileInput || (() => null);
    const rememberGeminiFileInput = dependencies.rememberGeminiFileInput || (() => {});

    let pendingGeminiGhostIngressClickCleanup = null;

    function listFirefoxGeminiBridgeSanitizedFiles(payload) {
      const files = Array.isArray(payload?.sanitizedFiles)
        ? payload.sanitizedFiles
        : payload?.sanitizedFile
          ? [payload.sanitizedFile]
          : [];
      return files.filter(Boolean);
    }

    function createFirefoxGeminiFileInputBridgeDebug(context, payload, fileInput = null) {
      const sanitizedFiles = listFirefoxGeminiBridgeSanitizedFiles(payload);
      return {
        mode: "file-input-bridge",
        browser: "firefox",
        host: locationRef.hostname || "",
        eventType: context?.event?.type || "",
        rawFileCount: listLocalTransferFiles(context?.event?.dataTransfer).length,
        sanitizedFileCount: sanitizedFiles.length,
        inputFound: Boolean(fileInput),
        input: describeFileInputForDebug(fileInput, "gemini-firefox-file-input-bridge"),
        sanitizedFiles: sanitizedFiles.map(describeFileForDebug)
      };
    }

    function createFirefoxGeminiBridgeDataTransfer(sanitizedFiles, details) {
      if (details) {
        details.dataTransferConstructorSucceeded = false;
        details.dataTransferItemsAddSucceeded = false;
      }
      if (!sanitizedFiles.length || typeof DataTransferRef !== "function" || !canUseSyntheticDataTransferFileList()) {
        return null;
      }

      try {
        const transfer = new DataTransferRef();
        if (details) details.dataTransferConstructorSucceeded = true;
        if (typeof transfer.items?.add !== "function") return null;
        for (const sanitizedFile of sanitizedFiles) {
          transfer.items.add(sanitizedFile);
        }
        if (details) details.dataTransferItemsAddSucceeded = true;
        return Number(transfer.files?.length || 0) === sanitizedFiles.length ? transfer : null;
      } catch (error) {
        if (details) {
          assignSafeFileAttachErrorMetadata(details, error);
        }
        return null;
      }
    }

    function isWithinGeminiImagesFilesUploader(candidate) {
      let node = candidate;
      const visited = new WeakSet();

      while (node && !visited.has(node)) {
        visited.add(node);
        if (String(node.tagName || "").toLowerCase() === "images-files-uploader") {
          return true;
        }
        try {
          if (typeof node.closest === "function" && node.closest("images-files-uploader")) {
            return true;
          }
        } catch {
          // Synthetic DOMs and host-controlled roots can reject custom selectors.
        }
        const rootNode = node.getRootNode?.();
        node = node.parentElement || rootNode?.host || null;
      }

      return false;
    }

    function scoreGeminiFileInput(candidate, source = "") {
      if (!isFileInputElement(candidate) || candidate.disabled) return -1;
      let score = 0;
      const name = String(candidate.name || candidate.getAttribute?.("name") || "");
      if (name === "Filedata") score += 80;
      if (isWithinGeminiImagesFilesUploader(candidate)) score += 100;
      if (candidate.multiple) score += 30;
      if (/images-files-uploader/i.test(String(source || ""))) score += 25;
      if (candidate.hidden) score += 5;
      const accept = String(candidate.accept || "").toLowerCase();
      if (accept.includes("text") || accept.includes(".txt") || accept.includes(".md") || accept.includes(".json")) {
        score += 10;
      }
      return score;
    }

    function discoverGeminiFileHandoffElements(event, input) {
      if (injectedDiscoverGeminiFileHandoffElements) {
        return injectedDiscoverGeminiFileHandoffElements(event, input);
      }

      const inputs = [];
      const uploadTriggers = [];
      const seenInputs = new WeakSet();
      const seenTriggers = new WeakSet();
      const stats = { openShadowRootCount: 0 };
      const addInput = (candidate, source = "") => {
        if (!isFileInputElement(candidate) || seenInputs.has(candidate)) return;
        seenInputs.add(candidate);
        inputs.push({ input: candidate, source });
      };
      const addUploadTrigger = (candidate, selector = "", source = "") => {
        if (!candidate || seenTriggers.has(candidate)) return;
        seenTriggers.add(candidate);
        uploadTriggers.push({ trigger: candidate, selector, source });
      };

      collectFileInputsFromAncestry(event?.target, addInput);

      const target = normalizeTarget(event?.target);
      const preferredInputSelectors = [
        "input[type='file'][accept*='text']",
        "input[type='file'][accept*='.txt']",
        "input[type='file'][accept*='.md']",
        "input[type='file'][accept*='.json']",
        "input[type='file'][accept*='.csv']",
        "input[type='file']"
      ];
      for (const selector of preferredInputSelectors) {
        try {
          target?.closest?.("[role='dialog'], form, main, body")?.querySelectorAll?.(selector).forEach((candidate) => {
            addInput(candidate, "target-scope");
          });
        } catch {
          // Host-controlled selectors can fail; broader discovery below remains fail-closed.
        }
      }
      target?.closest?.("form")?.querySelectorAll?.("input[type='file']").forEach((candidate) => {
        addInput(candidate, "target-form");
      });
      input?.closest?.("form")?.querySelectorAll?.("input[type='file']").forEach((candidate) => {
        addInput(candidate, "composer-form");
      });

      collectFileHandoffElementsFromRoot(documentRef, addInput, addUploadTrigger, new WeakSet(), stats);

      const fileInput =
        inputs
          .filter(({ input: candidate }) => !candidate.disabled)
          .sort((a, b) => scoreGeminiFileInput(b.input, b.source) - scoreGeminiFileInput(a.input, a.source))[0]
          ?.input || null;
      const uploadTrigger =
        uploadTriggers.find(({ trigger }) => {
          const meta = describeUploadTriggerForDebug(trigger);
          const haystack = `${meta?.ariaLabel || ""} ${meta?.title || ""} ${meta?.textSnippet || ""}`.toLowerCase();
          return !trigger.disabled && /\badd files?\b/.test(haystack);
        })?.trigger ||
        uploadTriggers.find(({ trigger }) => {
          const label = trigger.getAttribute?.("aria-label") || trigger.ariaLabel || "";
          return label === "Open upload file menu" && !trigger.disabled;
        })?.trigger ||
        uploadTriggers.find(({ trigger }) => isSafeGeminiUploadMenuButton(trigger))?.trigger ||
        uploadTriggers.find(({ trigger }) => !trigger.disabled)?.trigger ||
        null;

      return {
        fileInput,
        uploadTrigger,
        fileInputCount: inputs.length,
        uploadTriggerCount: uploadTriggers.length,
        openShadowRootCount: stats.openShadowRootCount,
        fileInputs: inputs,
        uploadTriggers
      };
    }

    function describeGeminiHandoffDiscovery(discovery) {
      const summary = discovery || {};
      return {
        fileInputCount: Number(summary.fileInputCount || 0),
        uploadTriggerCount: Number(summary.uploadTriggerCount || 0),
        openShadowRootCount: Number(summary.openShadowRootCount || 0),
        selectedFileInput: describeFileInputForDebug(summary.fileInput, "selected-gemini-file-input"),
        selectedUploadTrigger: describeUploadTriggerForDebug(
          summary.uploadTrigger,
          "selected-gemini-upload-trigger"
        ),
        fileInputCandidates: Array.from(summary.fileInputs || [])
          .slice(0, 20)
          .map(({ input, source }) => ({
            ...describeFileInputForDebug(input, source),
            score: scoreGeminiFileInput(input, source)
          })),
        uploadTriggerCandidates: Array.from(summary.uploadTriggers || [])
          .slice(0, 20)
          .map(({ trigger, selector, source }) => ({
            ...describeUploadTriggerForDebug(trigger, source || selector),
            selector
          }))
      };
    }

    function describeGeminiOverlayExposure() {
      if (injectedDescribeGeminiOverlayExposure) {
        return injectedDescribeGeminiOverlayExposure();
      }
      const details = {
        openShadowRootCount: 0,
        overlayItemCount: 0,
        overlayCandidates: [],
        selectedOverlayItem: null
      };
      discoverGeminiUploadOverlayItem(details);
      return {
        openShadowRootCount: details.openShadowRootCount,
        overlayItemCount: details.overlayItemCount,
        selectedOverlayItem: details.selectedOverlayItem,
        overlayCandidates: details.overlayCandidates
      };
    }

    function countGeminiAttachmentIndicators() {
      if (injectedCountGeminiAttachmentIndicators) {
        return Number(injectedCountGeminiAttachmentIndicators() || 0);
      }
      if (!isGeminiHost()) return 0;
      const selectors = [
        "images-files-uploader",
        "file-preview",
        "attachment-chip",
        "mat-chip",
        "[data-test-id*='attachment' i]",
        "[data-test-id*='upload' i]",
        "[aria-label*='attachment' i]",
        "[aria-label*='uploaded' i]",
        "[aria-label*='uploading' i]",
        "[aria-label*='file attached' i]",
        "[role='progressbar']"
      ];
      const roots = [];
      collectRootsWithOpenShadow(documentRef, roots, new WeakSet(), null);
      const seen = new WeakSet();
      let count = 0;
      for (const scanRoot of roots) {
        for (const selector of selectors) {
          try {
            scanRoot.querySelectorAll?.(selector).forEach((candidate) => {
              if (!candidate || seen.has(candidate)) return;
              seen.add(candidate);
              count += 1;
            });
          } catch {
            // Case-insensitive selectors may not parse in every runtime; keep validation best-effort.
          }
        }
      }
      return count;
    }

    async function waitForGeminiAttachmentIndicators(previousCount = 0, timeoutMs = 450) {
      if (injectedWaitForGeminiAttachmentIndicators) {
        return await injectedWaitForGeminiAttachmentIndicators(previousCount, timeoutMs);
      }
      let count = countGeminiAttachmentIndicators();
      if (count > previousCount) return count;
      if (typeof MutationObserverRef !== "function") return count;

      return await new Promise((resolve) => {
        let settled = false;
        let observer = null;
        let timeoutId = 0;
        const finish = (force = false) => {
          if (settled) return;
          count = countGeminiAttachmentIndicators();
          if (count <= previousCount && !force) return;
          settled = true;
          if (observer) {
            try {
              observer.disconnect();
            } catch {
              // Best-effort cleanup only.
            }
          }
          if (timeoutId) clearTimeoutFn(timeoutId);
          resolve(count);
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

    function isGeminiGhostIngressFileInput(candidate) {
      if (injectedIsGeminiGhostIngressFileInput) {
        return Boolean(injectedIsGeminiGhostIngressFileInput(candidate));
      }
      if (!isGeminiHost() || !isFileInputElement(candidate)) return false;
      const name = candidate.getAttribute?.("name") || candidate.name || "";
      if (name === "Filedata") return true;
      try {
        if (candidate.matches?.('input[type="file"][name="Filedata"]')) return true;
      } catch {
        // Selector support varies in synthetic and host-controlled DOMs.
      }
      return isWithinGeminiImagesFilesUploader(candidate);
    }

    function findGeminiFileInput(event = null, input = null) {
      if (typeof injectedFindGeminiFileInput === "function") {
        return injectedFindGeminiFileInput(event, input);
      }
      if (!isGeminiHost()) {
        return { discovery: {}, fileInput: null };
      }
      const discovery = discoverGeminiFileHandoffElements(event || { target: documentRef.body }, input);
      return { discovery, fileInput: discovery.fileInput || null };
    }

    function createGeminiFirefoxFilePickerGuard() {
      let capturedInput = null;
      const registrations = [];
      const waiters = new Set();
      const resolveWaiters = () => {
        for (const resolve of Array.from(waiters)) {
          waiters.delete(resolve);
          resolve(capturedInput);
        }
      };
      const handler = (event) => {
        const target = findGeminiFileDataInputFromEvent(event);
        if (!target) return;
        capturedInput = target;
        try {
          event.preventDefault?.();
        } catch {
          // Host event objects can be partial; continue blocking with remaining hooks.
        }
        try {
          event.stopPropagation?.();
        } catch {
          // Best-effort event suppression.
        }
        try {
          event.stopImmediatePropagation?.();
        } catch {
          // Best-effort event suppression.
        }
        debugReveal("file-handoff:gemini-firefox-file-picker-guard-captured", {
          mode: "file-input-bridge",
          browser: "firefox",
          host: locationRef.hostname || "",
          input: describeFileInputForDebug(capturedInput, "gemini-firefox-file-picker-guard")
        });
        resolveWaiters();
      };

      const add = (target, type) => {
        try {
          target?.addEventListener?.(type, handler, { capture: true, passive: false });
          registrations.push({ target, type });
        } catch {
          // Keep the bridge fail-closed if a host target rejects listener registration.
        }
      };

      for (const type of ["pointerdown", "mousedown", "click"]) {
        add(windowRef, type);
        add(documentRef, type);
      }

      return {
        getInput() {
          return capturedInput;
        },
        waitForInput(timeoutMs = 2500) {
          if (capturedInput) return Promise.resolve(capturedInput);
          return new Promise((resolve) => {
            let timeoutId = 0;
            const finish = (input = null) => {
              if (timeoutId) clearTimeoutFn(timeoutId);
              waiters.delete(finish);
              resolve(input || capturedInput || null);
            };
            waiters.add(finish);
            timeoutId = setTimeoutFn(() => finish(null), timeoutMs);
          });
        },
        cleanup() {
          for (const resolve of Array.from(waiters)) {
            waiters.delete(resolve);
            resolve(capturedInput);
          }
          while (registrations.length) {
            const { target, type } = registrations.pop();
            try {
              target?.removeEventListener?.(type, handler, { capture: true, passive: false });
            } catch {
              // Best-effort cleanup only.
            }
          }
        }
      };
    }

    async function waitForGeminiFileInput(timeoutMs = 3000, event = null, input = null, details = null) {
      let result = findGeminiFileInput(event, input);
      if (result.fileInput) return result;

      if (typeof MutationObserverRef !== "function") {
        return result;
      }

      return await new Promise((resolve) => {
        let settled = false;
        let observer = null;
        let timeoutId = 0;
        const finish = (reason = "", directInput = null) => {
          if (settled) return;
          result = directInput
            ? { discovery: result.discovery || {}, fileInput: directInput }
            : findGeminiFileInput(event, input);
          if (!result.fileInput && !reason) return;
          settled = true;
          if (observer) {
            try {
              observer.disconnect();
            } catch {
              // Best-effort cleanup only.
            }
          }
          if (timeoutId) {
            clearTimeoutFn(timeoutId);
          }
          const discovery = result.discovery || {};
          if (details) {
            details.fileInputCountBeforeClick = Math.max(
              Number(details.fileInputCountBeforeClick || 0),
              Number(discovery.fileInputCount || 0)
            );
            details.fileInputCountAfterTopTriggerClick = Number(discovery.fileInputCount || 0);
            details.fileInputCountAfterOverlayItemClick = Number(discovery.fileInputCount || 0);
            details.openShadowRootCount = Math.max(
              Number(details.openShadowRootCount || 0),
              Number(discovery.openShadowRootCount || 0)
            );
            if (reason && !result.fileInput) {
              details.failureReason = reason;
            }
          }
          if (directInput) {
            debugReveal("file-handoff:gemini-firefox-prime-filedata-input-observed", {
              mode: "file-input-prime",
              browser: "firefox",
              host: locationRef.hostname || "",
              input: describeFileInputForDebug(directInput, "gemini-firefox-filedata-observed")
            });
          }
          resolve(result);
        };

        try {
          observer = new MutationObserverRef((mutations) => finish("", findGeminiFileDataInputInMutations(mutations)));
          observer.observe(documentRef.body || documentRef.documentElement || documentRef, {
            childList: true,
            subtree: true
          });
        } catch {
          observer = null;
        }

        if (requestAnimationFrameFn) {
          try {
            requestAnimationFrameFn(() => finish());
          } catch {
            finish();
          }
        }

        timeoutId = setTimeoutFn(() => finish("file_input_bridge_input_not_found"), timeoutMs);
      });
    }

    function verifyGeminiFirefoxFileInputBridgeAssignment(fileInput, sanitizedFiles, rawFiles) {
      const assignedFiles = Array.from(fileInput?.files || []);
      if (
        assignedFiles.length !== sanitizedFiles.length ||
        sanitizedFiles.some((sanitizedFile, index) => assignedFiles[index] !== sanitizedFile)
      ) {
        return false;
      }
      return !Array.from(rawFiles || []).some((rawFile) => rawFile && assignedFiles.includes(rawFile));
    }

    function primeGeminiFirefoxUploadTarget(event, input) {
      if (!isGeminiHost() || !isFirefoxRuntime() || event?.type !== "drop") return null;

      const pickerGuard = createGeminiFirefoxFilePickerGuard();
      const details = createSanitizedFileHandoffDetails(event, null, "gemini:prime-upload-target");
      let settled = false;
      let inputResolve = null;
      const inputPromise = new Promise((resolve) => {
        inputResolve = resolve;
      });
      const finish = (fileInput = null) => {
        if (settled) return;
        settled = true;
        try {
          pickerGuard.cleanup();
        } catch {
          // Best-effort cleanup after capture or timeout.
        }
        inputResolve(fileInput || pickerGuard.getInput() || null);
      };

      debugReveal("file-handoff:gemini-firefox-prime-start", {
        mode: "file-input-prime",
        browser: "firefox",
        host: locationRef.hostname || "",
        eventType: event?.type || ""
      });

      (async () => {
        try {
          let waitResult = findGeminiFileInput(event, input);
          if (waitResult.fileInput) {
            details.handoffStage = "gemini:prime-existing-filedata-input";
            finish(waitResult.fileInput);
            return;
          }

          let menuItem = findGeminiUploadFilesMenuItem();
          if (!menuItem) {
            const menuButton = findGeminiUploadMenuButton();
            if (menuButton && openGeminiUploadMenuSafely(menuButton)) {
              details.foundTopUploadTrigger = true;
              details.uploadTrigger = describeElementForDebug(menuButton, "gemini-upload-menu-button");
              debugReveal("file-handoff:gemini-firefox-prime-menu-opened", {
                menuButton: details.uploadTrigger
              });
              menuItem = findGeminiUploadFilesMenuItem() || (await waitForGeminiUploadFilesMenuItem(3000));
            }
          }

          if (menuItem && openGeminiUploadFilesMenuItemSafely(menuItem)) {
            details.selectedOverlayItem = describeElementForDebug(menuItem, "gemini-upload-files-menu-item");
            details.handoffStage = "gemini:waiting-for-filedata-input";
            debugReveal("file-handoff:gemini-firefox-prime-menu-item-opened", {
              menuItem: details.selectedOverlayItem
            });
            const waitForPrimedInput = async (waitMs) =>
              pickerGuard.getInput() ||
              (await Promise.race([
                pickerGuard.waitForInput(waitMs),
                waitForGeminiFileInput(waitMs, event, input, details).then((result) => {
                  waitResult = result;
                  return result.fileInput || pickerGuard.getInput();
                })
              ]));

            waitResult = findGeminiFileInput(event, input);
            let guardedInput = pickerGuard.getInput() || waitResult.fileInput || null;
            if (!guardedInput && !waitResult.fileInput) {
              const hiddenTrigger = findGeminiHiddenFileSelectorTrigger();
              if (hiddenTrigger) {
                debugReveal("file-handoff:gemini-firefox-prime-hidden-trigger-found", {
                  trigger: describeElementForDebug(hiddenTrigger, "gemini-hidden-file-selector-trigger")
                });
                if (activateGeminiHiddenFileSelectorTriggerSafely(hiddenTrigger)) {
                  debugReveal("file-handoff:gemini-firefox-prime-hidden-trigger-clicked", {
                    trigger: describeElementForDebug(hiddenTrigger, "gemini-hidden-file-selector-trigger")
                  });
                  guardedInput = pickerGuard.getInput() || null;
                }
              }
            }
            if (!guardedInput && !waitResult.fileInput) {
              guardedInput = await waitForPrimedInput(3000);
            }

            const primedInput = guardedInput || waitResult.fileInput || null;
            if (primedInput && pickerGuard.getInput() === primedInput) {
              debugReveal("file-handoff:gemini-firefox-prime-filedata-input-captured", {
                mode: "file-input-prime",
                browser: "firefox",
                host: locationRef.hostname || "",
                input: describeFileInputForDebug(primedInput, "gemini-firefox-filedata-captured")
              });
            }
            finish(primedInput);
            return;
          }

          details.failureReason = "upload_files_menu_item_not_found";
          finish(null);
        } catch (error) {
          details.failureReason = "prime_upload_target_failed";
          assignSafeFileAttachErrorMetadata(details, error);
          finish(null);
        }
      })();

      return {
        details,
        inputPromise
      };
    }

    async function handOffPrimedGeminiFirefoxUploadTarget(prime, sanitizedFile) {
      if (!prime || !sanitizedFile) return { ok: false, reason: "not_primed" };
      const fileInput = await prime.inputPromise;
      if (!fileInput) {
        prime.details.failureReason = prime.details.failureReason || "primed_filedata_input_not_captured";
        debugReveal("file-handoff:gemini-firefox-prime-input-not-found", {
          reason: prime.details.failureReason,
          sanitizedFile: describeFileForDebug(sanitizedFile)
        });
        return { ok: false, reason: prime.details.failureReason };
      }

      prime.details.handoffStage = "gemini:primed-filedata-assignment";
      prime.details.sanitizedFile = describeFileForDebug(sanitizedFile);
      const transfer = createSanitizedDataTransferForHandoff(sanitizedFile, prime.details);
      if (!transfer) {
        prime.details.failureReason = "data_transfer_failed";
        return { ok: false, reason: "data_transfer_failed" };
      }

      const assigned = handOffSanitizedFileInput(fileInput, transfer, {
        dispatchInput: true,
        details: prime.details
      });
      if (!assigned) {
        prime.details.failureReason = prime.details.failureReason || "input_assignment_failed";
        return { ok: false, reason: prime.details.failureReason };
      }

      debugReveal("file-handoff:gemini-firefox-prime-assigned", {
        mode: "file-input-prime",
        inputFound: true,
        input: describeFileInputForDebug(fileInput, "gemini-firefox-primed-filedata-input"),
        sanitizedFile: describeFileForDebug(sanitizedFile)
      });
      debugReveal("file-handoff:gemini-firefox-prime-sanitized-file-assigned", {
        mode: "file-input-prime",
        inputFound: true,
        input: describeFileInputForDebug(fileInput, "gemini-firefox-primed-filedata-input"),
        sanitizedFile: describeFileForDebug(sanitizedFile)
      });
      return { ok: true, strategy: "gemini-firefox-primed-filedata-input" };
    }

    async function tryFirefoxGeminiFileInputBridge(payload, context) {
      if (
        !isFirefoxRuntime() ||
        !isGeminiHost() ||
        context?.event?.type !== "drop" ||
        !payload?.sanitizedFile
      ) {
        return { handled: false, ok: false };
      }

      const details = createSanitizedFileHandoffDetails(
        context.event,
        payload.sanitizedFile,
        "gemini:firefox-file-input-bridge"
      );
      const rawFiles = listLocalTransferFiles(context.event?.dataTransfer);
      const sanitizedFiles = listFirefoxGeminiBridgeSanitizedFiles(payload);
      debugReveal(
        "file-handoff:gemini-firefox-file-input-bridge-start",
        createFirefoxGeminiFileInputBridgeDebug(context, payload)
      );

      if (shouldUseFirefoxTextFallbackForFileHandoff()) {
        details.failureReason = "input_file_assignment_unavailable";
        debugReveal("file-handoff:gemini-firefox-file-input-bridge-unavailable", {
          ...createFirefoxGeminiFileInputBridgeDebug(context, payload),
          reason: details.failureReason
        });
        return {
          handled: true,
          ok: false,
          stage: "failed",
          reason: "gemini_firefox_file_input_bridge_unavailable",
          message: firefoxGeminiFileInputBridgeFailureMessage
        };
      }

      if (hasPendingGeminiSanitizedFileHandoff(payload.sanitizedFile)) {
        return {
          handled: true,
          ok: true,
          stage: "pending",
          strategy: "gemini-firefox-pending-sanitized-file-handoff"
        };
      }

      const pickerGuard = createGeminiFirefoxFilePickerGuard();
      let waitResult = findGeminiFileInput(context.event, context.input);
      const bridgeUi = {
        overlayItemFoundBeforeMenuOpen: false,
        menuOpenButtonClicked: false,
        uploadFilesMenuItemClicked: false,
        fileInputCapturedByGuard: false
      };
      try {
        if (!waitResult.fileInput) {
          let menuItem = findGeminiUploadFilesMenuItem();
          bridgeUi.overlayItemFoundBeforeMenuOpen = Boolean(menuItem);
          let menuOpened = false;
          if (!menuItem) {
            const menuButton = findGeminiUploadMenuButton();
            if (menuButton && openGeminiUploadMenuSafely(menuButton)) {
              menuOpened = true;
              bridgeUi.menuOpenButtonClicked = true;
              debugReveal("file-handoff:gemini-firefox-file-input-bridge-menu-opened", {
                ...createFirefoxGeminiFileInputBridgeDebug(context, payload),
                menuButton: describeElementForDebug(menuButton, "gemini-upload-menu-button")
              });
              menuItem = await waitForGeminiUploadFilesMenuItem(3000);
            }
          }
          if (menuItem && openGeminiUploadFilesMenuItemSafely(menuItem)) {
            bridgeUi.uploadFilesMenuItemClicked = true;
            debugReveal("file-handoff:gemini-firefox-file-input-bridge-menu-item-opened", {
              ...createFirefoxGeminiFileInputBridgeDebug(context, payload),
              menuOpened,
              menuItem: describeElementForDebug(menuItem, "gemini-upload-files-menu-item")
            });
            details.handoffStage = "gemini:waiting-for-filedata-input";
            const waitMs = 2500;
            const guardedInput =
              pickerGuard.getInput() ||
              (await Promise.race([
                pickerGuard.waitForInput(waitMs),
                waitForGeminiFileInput(waitMs, context.event, context.input, details).then((result) => {
                  waitResult = result;
                  return pickerGuard.getInput();
                })
              ]));
            bridgeUi.fileInputCapturedByGuard = Boolean(guardedInput);
            if (guardedInput) {
              waitResult = { discovery: { fileInputCount: 1, openShadowRootCount: 0 }, fileInput: guardedInput };
            } else if (!waitResult.fileInput) {
              waitResult = findGeminiFileInput(context.event, context.input);
            }
          }
        }
        if (!waitResult.fileInput && pickerGuard.getInput()) {
          bridgeUi.fileInputCapturedByGuard = true;
          waitResult = {
            discovery: waitResult.discovery || { fileInputCount: 1, openShadowRootCount: 0 },
            fileInput: pickerGuard.getInput()
          };
        }
      } finally {
        pickerGuard.cleanup();
      }
      const discovery = waitResult.discovery || {};
      const fileInput = waitResult.fileInput || null;
      details.fileInputCountBeforeClick = Number(discovery.fileInputCount || 0);
      details.fileInputCountAfterTopTriggerClick = Number(discovery.fileInputCount || 0);
      details.fileInputCountAfterOverlayItemClick = Number(discovery.fileInputCount || 0);
      details.openShadowRootCount = Math.max(
        Number(details.openShadowRootCount || 0),
        Number(discovery.openShadowRootCount || 0)
      );

      if (!fileInput) {
        details.failureReason = "file_input_bridge_input_not_found";
        const safeUploadOpenerDiscovered = isAllowedGeminiUploadMenuOpener(discovery.uploadTrigger);
        const uploadFlowWasReached =
          safeUploadOpenerDiscovered ||
          bridgeUi.overlayItemFoundBeforeMenuOpen ||
          bridgeUi.menuOpenButtonClicked ||
          bridgeUi.uploadFilesMenuItemClicked;
        const queuedPending =
          uploadFlowWasReached &&
          shouldQueueFirefoxGeminiPendingSanitizedFileHandoff(context.event, payload.sanitizedFile, details) &&
          queuePendingSanitizedFileHandoff(
            getFileHandoffAdapterById("gemini"),
            context.event,
            context.input,
            payload.sanitizedFile,
            details
          );
        debugReveal(
          "file-handoff:gemini-firefox-file-input-bridge-input-not-found",
          {
            ...createFirefoxGeminiFileInputBridgeDebug(context, payload),
            bridgeUi,
            safeUploadOpenerDiscovered,
            uploadFlowWasReached,
            queuedPending,
            uploadMenu: describeGeminiUploadMenuDiscovery(),
            overlay: describeGeminiOverlayExposure()
          }
        );
        if (queuedPending) {
          return {
            handled: true,
            ok: true,
            stage: "pending",
            strategy: "gemini-firefox-pending-sanitized-file-handoff"
          };
        }
        if (
          suppressStaleHandoffErrorAfterSuccess(
            "file_bridge_failure",
            "gemini",
            payload.sanitizedFile,
            { bridgeReason: details.failureReason }
          )
        ) {
          return {
            handled: true,
            ok: true,
            stage: "file",
            strategy: "gemini-firefox-file-input-bridge-stale-error-suppressed"
          };
        }
        return {
          handled: true,
          ok: false,
          stage: "failed",
          reason: "gemini_firefox_file_input_not_found",
          message: firefoxGeminiFileInputBridgeFailureMessage
        };
      }

      const transfer = createFirefoxGeminiBridgeDataTransfer(sanitizedFiles, details);
      if (!transfer) {
        details.failureReason = "data_transfer_failed";
        debugReveal("file-handoff:gemini-firefox-file-input-bridge-transfer-failed", {
          ...createFirefoxGeminiFileInputBridgeDebug(context, payload, fileInput),
          reason: details.failureReason
        });
        if (
          suppressStaleHandoffErrorAfterSuccess(
            "file_bridge_failure",
            "gemini",
            payload.sanitizedFile,
            { bridgeReason: details.failureReason }
          )
        ) {
          return {
            handled: true,
            ok: true,
            stage: "file",
            strategy: "gemini-firefox-file-input-bridge-stale-error-suppressed"
          };
        }
        return {
          handled: true,
          ok: false,
          stage: "failed",
          reason: "gemini_firefox_file_input_bridge_data_transfer_failed",
          message: firefoxGeminiFileInputBridgeFailureMessage
        };
      }

      const assigned = handOffSanitizedFileInput(fileInput, transfer, {
        dispatchInput: true,
        details
      });
      if (!assigned || !verifyGeminiFirefoxFileInputBridgeAssignment(fileInput, sanitizedFiles, rawFiles)) {
        details.failureReason = assigned
          ? "file_input_bridge_verification_failed"
          : details.failureReason || "file_input_bridge_assignment_failed";
        debugReveal("file-handoff:gemini-firefox-file-input-bridge-assignment-failed", {
          ...createFirefoxGeminiFileInputBridgeDebug(context, payload, fileInput),
          reason: details.failureReason
        });
        return {
          handled: true,
          ok: false,
          stage: "failed",
          reason: "gemini_firefox_file_input_bridge_assignment_failed",
          message: firefoxGeminiFileInputBridgeFailureMessage
        };
      }

      debugReveal(
        "file-handoff:gemini-firefox-file-input-bridge-assigned",
        createFirefoxGeminiFileInputBridgeDebug(context, payload, fileInput)
      );
      return {
        handled: true,
        ok: true,
        stage: "file",
        strategy: "gemini-firefox-file-input-bridge"
      };
    }

    async function handOffGeminiSanitizedFileInput(fileInput, transfer, details, sanitizedFile) {
      const chipCountBefore = countGeminiAttachmentIndicators();
      if (details) details.chipCountBefore = chipCountBefore;
      const assigned = handOffSanitizedFileInput(fileInput, transfer, {
        dispatchInput: true,
        details
      });
      const inputFilesAccepted = Number(fileInput?.files?.length || 0) > 0;
      const chipCountAfter = inputFilesAccepted
        ? countGeminiAttachmentIndicators()
        : await waitForGeminiAttachmentIndicators(chipCountBefore, geminiUploadInputWaitMs);
      const inputFilesCleared = !inputFilesAccepted && details?.inputFilesAssignmentSucceeded === true;
      if (details) {
        details.chipCountAfter = chipCountAfter;
        details.inputFilesAccepted = inputFilesAccepted;
        details.inputFilesCleared = inputFilesCleared;
      }

      debugFileAttachMetadata("gemini:handoff-events-dispatched", {
        hostname: locationRef.hostname || "",
        stage: details?.handoffStage || "gemini:file-input-assignment",
        inputEventDispatched: Boolean(details?.inputEventDispatched),
        changeEventDispatched: Boolean(details?.changeEventDispatched),
        inputFilesAccepted,
        inputFilesCleared,
        sanitizedFile: describeFileForDebug(sanitizedFile)
      });

      if (chipCountAfter > chipCountBefore) {
        debugFileAttachMetadata("gemini:attachment-chip-detected", {
          hostname: locationRef.hostname || "",
          stage: "dom-validation",
          chipCountBefore,
          chipCountAfter,
          sanitizedFile: describeFileForDebug(sanitizedFile)
        });
      }

      if (inputFilesCleared && chipCountAfter > chipCountBefore) {
        debugFileAttachMetadata("gemini:handoff-accepted-input-cleared", {
          hostname: locationRef.hostname || "",
          stage: "dom-validation",
          chipCountBefore,
          chipCountAfter,
          inputFilesCleared: true,
          sanitizedFile: describeFileForDebug(sanitizedFile)
        });
        return true;
      }

      return assigned;
    }

    function clearLocalPendingGeminiGhostIngressClickInterceptor(reason = "") {
      if (typeof pendingGeminiGhostIngressClickCleanup !== "function") return;
      const cleanup = pendingGeminiGhostIngressClickCleanup;
      pendingGeminiGhostIngressClickCleanup = null;
      try {
        cleanup(reason);
      } catch {
        debugReveal("file-handoff:ghost-ingress-cleanup-failed", {
          site: "gemini",
          phase: "click-interceptor-cleanup",
          reason,
          hadCleanup: true
        });
      }
    }

    function createGeminiGhostIngressClickInterceptor(sanitizedFile, details, onFinished) {
      if (!isGeminiHost() || !sanitizedFile) return null;
      const clickRoots = [];
      if (typeof windowRef?.addEventListener === "function") clickRoots.push(windowRef);
      if (typeof documentRef?.addEventListener === "function") clickRoots.push(documentRef);
      if (!clickRoots.length) return null;

      let cleaned = false;
      let timeoutId = 0;
      const guardedEventTypes = ["pointerdown", "mousedown", "click"];
      const handler = (clickEvent) => {
        const candidates = [];
        try {
          if (typeof clickEvent?.composedPath === "function") {
            candidates.push(...clickEvent.composedPath());
          }
        } catch {
          // Host event paths are best-effort.
        }
        candidates.push(clickEvent?.target);
        const target = candidates.find(isGeminiGhostIngressFileInput);
        if (!isGeminiHost() || !sanitizedFile || !isGeminiGhostIngressFileInput(target)) return;

        consumeInterceptionEvent(clickEvent);
        details.handoffStage = "gemini:ghost-ingress-file-input-click";
        const transfer = createSanitizedDataTransferForHandoff(sanitizedFile, details);
        const assigned = transfer
          ? handOffSanitizedFileInput(target, transfer, {
              dispatchInput: true,
              details
            })
          : false;
        if (!assigned) {
          details.failureReason = details.failureReason || "ghost_ingress_click_assignment_failed";
          if (typeof onFinished === "function") {
            onFinished(null, details.failureReason);
          }
          clearLocalPendingGeminiGhostIngressClickInterceptor("assignment-failed");
          return;
        }
        if (typeof onFinished === "function") {
          onFinished(target, "ghost_ingress_click_assigned");
        }
        clearLocalPendingGeminiGhostIngressClickInterceptor("assigned");
      };

      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        if (timeoutId) {
          clearTimeoutFn(timeoutId);
          timeoutId = 0;
        }
        for (const rootNode of clickRoots) {
          for (const type of guardedEventTypes) {
            try {
              rootNode.removeEventListener(type, handler, true);
            } catch {
              // Best-effort cleanup only.
            }
          }
        }
      };

      clearLocalPendingGeminiGhostIngressClickInterceptor("replaced");
      clearPendingGeminiGhostIngressClickInterceptor("replaced");
      for (const rootNode of clickRoots) {
        for (const type of guardedEventTypes) {
          rootNode.addEventListener(type, handler, true);
        }
      }
      timeoutId = setTimeoutFn(() => {
        clearLocalPendingGeminiGhostIngressClickInterceptor("timeout");
        clearPendingGeminiGhostIngressClickInterceptor("timeout");
      }, geminiGhostIngressTimeoutMs);
      pendingGeminiGhostIngressClickCleanup = cleanup;
      return { cleanup };
    }

    async function waitForGeminiGhostIngressFileInput(event, input, details, sanitizedFile) {
      let discovery = discoverGeminiFileHandoffElements(event, input);
      if (discovery.fileInput) {
        return { discovery, fileInput: discovery.fileInput };
      }

      const uploadTrigger = discovery.uploadTrigger;
      details.foundTopUploadTrigger = Boolean(uploadTrigger);
      details.uploadTrigger = describeUploadTriggerForDebug(uploadTrigger, "gemini-upload-trigger");

      if (!isAllowedGeminiUploadMenuOpener(uploadTrigger)) {
        details.failureReason = uploadTrigger ? "unsafe_upload_trigger" : "no_upload_trigger";
        return { discovery, fileInput: null };
      }

      return await new Promise((resolve) => {
        let settled = false;
        let observer = null;
        let timeoutId = 0;
        let clickAssignedInput = null;

        const finish = (reason = "", assignedInput = null) => {
          if (settled) return;
          discovery = discoverGeminiFileHandoffElements(event, input);
          const fileInput = assignedInput || discovery.fileInput;
          if (!fileInput && !reason) return;
          settled = true;
          clearLocalPendingGeminiGhostIngressClickInterceptor(reason || "finished");
          clearPendingGeminiGhostIngressClickInterceptor(reason || "finished");
          if (observer) {
            try {
              observer.disconnect();
            } catch {
              // Best-effort cleanup only.
            }
          }
          if (timeoutId) {
            clearTimeoutFn(timeoutId);
          }
          details.fileInputCountAfterOverlayItemClick = discovery.fileInputCount;
          details.openShadowRootCount = Math.max(details.openShadowRootCount, discovery.openShadowRootCount);
          if (!fileInput && reason) {
            details.failureReason = reason;
            if (suppressStaleHandoffErrorAfterSuccess(reason, "gemini", sanitizedFile)) {
              resolve({ discovery, fileInput: null, staleSuccess: true });
              return;
            }
          }
          resolve({ discovery, fileInput });
        };

        const activateFirefoxHiddenSelector = (trigger = null) => {
          if (settled || !isFirefoxRuntime()) return false;
          const hiddenTrigger = isGeminiHiddenFileSelectorTrigger(trigger)
            ? trigger
            : findGeminiHiddenFileSelectorTrigger();
          if (!hiddenTrigger) return false;
          details.handoffStage = "gemini:ghost-ingress-hidden-selector";
          debugReveal("file-handoff:gemini-firefox-prime-hidden-trigger-found", {
            trigger: describeElementForDebug(hiddenTrigger, "gemini-hidden-file-selector-trigger")
          });
          if (!activateGeminiHiddenFileSelectorTriggerSafely(hiddenTrigger)) {
            return false;
          }
          debugReveal("file-handoff:gemini-firefox-prime-hidden-trigger-clicked", {
            trigger: describeElementForDebug(hiddenTrigger, "gemini-hidden-file-selector-trigger")
          });
          finish();
          return true;
        };

        createGeminiGhostIngressClickInterceptor(sanitizedFile, details, (assignedInput, reason) => {
          clickAssignedInput = assignedInput;
          finish(reason || "ghost_ingress_click_assigned", assignedInput);
        });

        if (typeof MutationObserverRef === "function") {
          try {
            observer = new MutationObserverRef((mutations) => {
              finish();
              if (!settled && isFirefoxRuntime()) {
                activateFirefoxHiddenSelector(findGeminiHiddenFileSelectorTriggerInMutations(mutations));
              }
            });
            observer.observe(documentRef.documentElement || documentRef, {
              childList: true,
              subtree: true
            });
          } catch {
            observer = null;
          }
        }

        timeoutId = setTimeoutFn(() => {
          finish("ghost_ingress_timeout", clickAssignedInput);
        }, geminiGhostIngressTimeoutMs);

        details.handoffStage = "gemini:ghost-ingress-menu-open";
        const opened = clickElementSafely(uploadTrigger);
        if (!opened) {
          finish("top_upload_trigger_click_failed");
          return;
        }

        finish();
        setTimeoutFn(() => {
          if (settled) return;
          details.handoffStage = "gemini:ghost-ingress-overlay-item";
          const overlayItem = discoverGeminiUploadOverlayItem(details);
          const overlayClicked =
            overlayItem &&
            (isFirefoxRuntime()
              ? openGeminiUploadFilesMenuItemSafely(overlayItem)
              : clickElementSafely(overlayItem));
          if (overlayClicked) {
            finish();
          }
          activateFirefoxHiddenSelector();
        }, 0);
      });
    }

    async function performPendingGeminiUserAttach(event, input, sanitizedFile) {
      if (!isGeminiHost() || !sanitizedFile) return false;
      const sanitizedFiles = Array.isArray(sanitizedFile)
        ? sanitizedFile.filter(Boolean)
        : [sanitizedFile].filter(Boolean);
      if (!sanitizedFiles.length) return false;

      debugReveal("gemini-pending-user-attach-start", {
        ...describeSanitizedFileOrBatchForDebug(sanitizedFiles)
      });
      clearLocalPendingGeminiGhostIngressClickInterceptor("pending-user-attach");
      clearPendingGeminiGhostIngressClickInterceptor("pending-user-attach");

      const details = createSanitizedFileHandoffDetails(
        event,
        sanitizedFile,
        "gemini:pending-user-attach"
      );
      const pickerGuard = createGeminiFirefoxFilePickerGuard();
      let waitResult = findGeminiFileInput(event, input);

      try {
        if (!waitResult.fileInput) {
          let menuItem = findGeminiUploadFilesMenuItem();
          if (!menuItem) {
            const menuButton = findGeminiUploadMenuButton();
            if (menuButton && openGeminiUploadMenuSafely(menuButton)) {
              debugReveal("gemini-pending-user-attach-menu-opened", {
                menuButton: describeElementForDebug(menuButton, "gemini-upload-menu-button"),
                ...describeSanitizedFileOrBatchForDebug(sanitizedFiles)
              });
              menuItem = await waitForGeminiUploadFilesMenuItem(3000);
            }
          }

          if (menuItem && openGeminiUploadFilesMenuItemSafely(menuItem)) {
            debugReveal("gemini-pending-user-attach-menu-item-clicked", {
              menuItem: describeElementForDebug(menuItem, "gemini-upload-files-menu-item"),
              ...describeSanitizedFileOrBatchForDebug(sanitizedFiles)
            });
            const waitMs = 2500;
            const guardedInput =
              pickerGuard.getInput() ||
              (await Promise.race([
                pickerGuard.waitForInput(waitMs),
                waitForGeminiFileInput(waitMs, event, input, details).then((result) => {
                  waitResult = result;
                  return pickerGuard.getInput() || result.fileInput || null;
                })
              ]));
            if (guardedInput) {
              waitResult = { discovery: { fileInputCount: 1, openShadowRootCount: 0 }, fileInput: guardedInput };
            }
          }

          if (!waitResult.fileInput && pickerGuard.getInput()) {
            waitResult = {
              discovery: waitResult.discovery || { fileInputCount: 1, openShadowRootCount: 0 },
              fileInput: pickerGuard.getInput()
            };
          }

          if (!waitResult.fileInput) {
            const hiddenTrigger = findGeminiHiddenFileSelectorTrigger();
            if (hiddenTrigger && activateGeminiHiddenFileSelectorTriggerSafely(hiddenTrigger)) {
              const waitMs = 2500;
              const guardedInput =
                pickerGuard.getInput() ||
                (await Promise.race([
                  pickerGuard.waitForInput(waitMs),
                  waitForGeminiFileInput(waitMs, event, input, details).then((result) => {
                    waitResult = result;
                    return pickerGuard.getInput() || result.fileInput || null;
                  })
                ]));
              if (guardedInput) {
                waitResult = { discovery: { fileInputCount: 1, openShadowRootCount: 0 }, fileInput: guardedInput };
              }
            }
          }
        }
      } finally {
        pickerGuard.cleanup();
      }

      const fileInput = waitResult.fileInput || null;
      if (!fileInput) {
        debugReveal("file-handoff:gemini-pending-input-not-found", {
          reason: "pending-user-attach",
          ...describeSanitizedFileOrBatchForDebug(sanitizedFiles)
        });
        if (suppressStaleHandoffErrorAfterSuccess("pending_attach_input_not_found", "gemini", sanitizedFile)) {
          return true;
        }
        setBadge("LeakGuard is waiting for Gemini upload input.");
        hideBadgeSoon(4200);
        refreshBadgeFromCurrentInput();
        return false;
      }

      debugReveal("gemini-pending-user-attach-input-captured", {
        input: describeFileInputForDebug(fileInput, "gemini-pending-user-attach-input"),
        ...describeSanitizedFileOrBatchForDebug(sanitizedFiles)
      });
      debugReveal("file-handoff:pending-input-captured", {
        site: "gemini",
        reason: "pending-user-attach",
        input: describeFileInputForDebug(fileInput, "gemini-pending-user-attach-input"),
        ...describeSanitizedFileOrBatchForDebug(sanitizedFiles)
      });

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
      const assignedFiles = Array.from(fileInput.files || []);
      const assignmentMatches =
        assignedFiles.length === sanitizedFiles.length &&
        sanitizedFiles.every((file, index) => assignedFiles[index] === file);
      if (!assignmentMatches) {
        details.failureReason = "input_files_assignment_count_mismatch";
        logSanitizedFileHandoffFailure(details);
        debugReveal("file-handoff:gemini-pending-assignment-mismatch", {
          reason: "pending-user-attach",
          expectedFileCount: sanitizedFiles.length,
          assignedFileCount: assignedFiles.length,
          input: describeFileInputForDebug(fileInput, "gemini-pending-user-attach-input"),
          ...describeSanitizedFileOrBatchForDebug(sanitizedFiles)
        });
        return false;
      }

      debugReveal("gemini-pending-user-attach-assigned", {
        input: describeFileInputForDebug(fileInput, "gemini-pending-user-attach-input"),
        ...describeSanitizedFileOrBatchForDebug(sanitizedFiles)
      });
      debugReveal("file-handoff:pending-assigned", {
        site: "gemini",
        reason: "pending-user-attach",
        input: describeFileInputForDebug(fileInput, "gemini-pending-user-attach-input"),
        ...describeSanitizedFileOrBatchForDebug(sanitizedFiles)
      });
      clearPendingGeminiSanitizedFileHandoff("assigned");
      showFileProcessingSuccess(sanitizedFiles.length > 1 ? "Sanitized files attached." : "Sanitized file attached.", {
        site: "gemini",
        reason: "pending-attached"
      });
      setBadge(sanitizedFiles.length > 1 ? "LeakGuard attached the sanitized files." : "LeakGuard attached the sanitized file.");
      hideBadgeSoon(3200);
      refreshBadgeFromCurrentInput();
      return true;
    }

    async function handOffGeminiSanitizedFileUpload(event, input, sanitizedFile, options) {
      if (!isGeminiHost()) return false;
      if (shouldUseFirefoxTextFallbackForFileHandoff()) return false;

      const details = createSanitizedFileHandoffDetails(event, sanitizedFile, "gemini:start");
      const transfer = createSanitizedDataTransferForHandoff(sanitizedFile, details);
      if (!transfer) {
        details.handoffStage = "gemini:data-transfer";
        details.failureReason = "data_transfer_failed";
        debugReveal("file-handoff:gemini-data-transfer-create-failed", {
          sanitizedFile: describeFileForDebug(sanitizedFile)
        });
        logSanitizedFileHandoffFailure(details);
        return false;
      }

      const cachedFileInput = getCachedGeminiFileInput();
      if (cachedFileInput) {
        details.handoffStage = "gemini:cached-input";
        details.fileInputCountBeforeClick = 1;
        debugFileAttachMetadata("gemini:file-input-discovered", {
          hostname: locationRef.hostname || "",
          stage: details.handoffStage,
          input: describeFileInputForDebug(cachedFileInput, "gemini-cached-input"),
          sanitizedFile: describeFileForDebug(sanitizedFile)
        });
        const assigned = await handOffGeminiSanitizedFileInput(cachedFileInput, transfer, details, sanitizedFile);
        if (!assigned) {
          logSanitizedFileHandoffFailure(details);
        }
        return assigned;
      }

      let discovery = discoverGeminiFileHandoffElements(event, input);
      let fileInput = discovery.fileInput;
      details.handoffStage = "gemini:initial-discovery";
      details.fileInputCountBeforeClick = discovery.fileInputCount;
      details.fileInputCountAfterTopTriggerClick = discovery.fileInputCount;
      details.fileInputCountAfterOverlayItemClick = discovery.fileInputCount;
      details.openShadowRootCount = discovery.openShadowRootCount;
      const uploadTrigger = discovery.uploadTrigger;
      details.foundTopUploadTrigger = Boolean(uploadTrigger);
      details.uploadTrigger = describeUploadTriggerForDebug(uploadTrigger, "gemini-upload-trigger");
      const handoffOptions = options || {};
      const mayClickGeminiUploadUi =
        (!isFirefoxRuntime() || handoffOptions.allowUploadUiClick === true) &&
        (event?.type !== "drop" || handoffOptions.allowUploadUiClick === true);

      if (!fileInput && mayClickGeminiUploadUi) {
        debugFileAttachMetadata("gemini:upload-menu-open-attempt", {
          hostname: locationRef.hostname || "",
          stage: "gemini:ghost-ingress-menu-open",
          foundTopUploadTrigger: Boolean(uploadTrigger),
          sanitizedFile: describeFileForDebug(sanitizedFile)
        });
        const result = await waitForGeminiGhostIngressFileInput(event, input, details, sanitizedFile);
        discovery = result.discovery;
        fileInput = result.fileInput;
        if (result.staleSuccess) {
          return true;
        }
        details.fileInputCountAfterTopTriggerClick = discovery.fileInputCount;
        details.fileInputCountAfterOverlayItemClick = discovery.fileInputCount;
        details.openShadowRootCount = Math.max(details.openShadowRootCount, discovery.openShadowRootCount);
        if (fileInput && details.handoffStage === "gemini:ghost-ingress-file-input-click") {
          rememberGeminiFileInput(fileInput);
          debugFileAttachMetadata("gemini:file-input-after-menu", {
            hostname: locationRef.hostname || "",
            stage: details.handoffStage,
            input: describeFileInputForDebug(fileInput, "gemini-file-input-after-menu"),
            sanitizedFile: describeFileForDebug(sanitizedFile)
          });
          return true;
        }
      } else if (!fileInput) {
        details.failureReason = "no_file_input_without_opening_picker";
      }

      rememberGeminiFileInput(fileInput);

      if (!fileInput) {
        details.handoffStage =
          details.failureReason === "no_overlay_upload_item"
            ? "gemini:no-overlay-upload-item"
            : details.failureReason === "no_file_input_without_opening_picker"
              ? "gemini:no-file-input-without-picker"
              : "gemini:no-file-input-after-overlay";
        if (!details.failureReason) {
          details.failureReason = uploadTrigger ? "no_file_input_after_overlay_click" : "no_upload_trigger";
        }
        debugReveal("file-handoff:gemini-input-not-found", {
          foundUploadTrigger: Boolean(uploadTrigger),
          trigger: describeUploadTriggerForDebug(uploadTrigger, "gemini-upload-trigger"),
          fileInputCountBeforeClick: details.fileInputCountBeforeClick,
          fileInputCountAfterClick: details.fileInputCountAfterTopTriggerClick,
          fileInputCountAfterOverlayItemClick: details.fileInputCountAfterOverlayItemClick,
          openShadowRootCount: details.openShadowRootCount,
          sanitizedFile: describeFileForDebug(sanitizedFile)
        });
        debugFileAttachMetadata("gemini:handoff-failed-no-input", {
          hostname: locationRef.hostname || "",
          stage: details.handoffStage,
          reason: details.failureReason,
          sanitizedFile: describeFileForDebug(sanitizedFile)
        });
        if (shouldQueueFirefoxGeminiPendingSanitizedFileHandoff(event, sanitizedFile, details)) {
          const originalFailureReason = details.failureReason;
          const originalHandoffStage = details.handoffStage;
          if (queuePendingSanitizedFileHandoff(getFileHandoffAdapterById("gemini"), event, input, sanitizedFile, details)) {
            debugReveal("file-handoff:gemini-firefox-pending-queued-after-native-miss", {
              handoffStage: originalHandoffStage,
              failureReason: originalFailureReason,
              sanitizedFile: describeFileForDebug(sanitizedFile)
            });
            return false;
          }
        }
        if (isExpectedFirefoxGeminiNoPickerMiss(details)) {
          debugReveal("file-handoff:gemini-firefox-native-input-unavailable", {
            handoffStage: details.handoffStage,
            failureReason: details.failureReason,
            foundUploadTrigger: Boolean(uploadTrigger),
            sanitizedFile: describeFileForDebug(sanitizedFile)
          });
          return false;
        }
        logSanitizedFileHandoffFailure(details);
        return false;
      }

      details.handoffStage = "gemini:file-input-assignment";
      debugFileAttachMetadata(fileInput === discovery.fileInput ? "gemini:file-input-discovered" : "gemini:file-input-after-menu", {
        hostname: locationRef.hostname || "",
        stage: details.handoffStage,
        input: describeFileInputForDebug(fileInput, "gemini-file-input"),
        sanitizedFile: describeFileForDebug(sanitizedFile)
      });
      const assigned = await handOffGeminiSanitizedFileInput(fileInput, transfer, details, sanitizedFile);
      if (!assigned) {
        logSanitizedFileHandoffFailure(details);
      }
      return assigned;
    }

    return Object.freeze({
      listFirefoxGeminiBridgeSanitizedFiles,
      createFirefoxGeminiFileInputBridgeDebug,
      createFirefoxGeminiBridgeDataTransfer,
      describeGeminiHandoffDiscovery,
      describeGeminiOverlayExposure,
      isWithinGeminiImagesFilesUploader,
      scoreGeminiFileInput,
      discoverGeminiFileHandoffElements,
      countGeminiAttachmentIndicators,
      waitForGeminiAttachmentIndicators,
      findGeminiFileInput,
      isGeminiGhostIngressFileInput,
      createGeminiFirefoxFilePickerGuard,
      waitForGeminiFileInput,
      verifyGeminiFirefoxFileInputBridgeAssignment,
      primeGeminiFirefoxUploadTarget,
      handOffPrimedGeminiFirefoxUploadTarget,
      tryFirefoxGeminiFileInputBridge,
      handOffGeminiSanitizedFileInput,
      performPendingGeminiUserAttach,
      clearPendingGeminiGhostIngressClickInterceptor: clearLocalPendingGeminiGhostIngressClickInterceptor,
      createGeminiGhostIngressClickInterceptor,
      waitForGeminiGhostIngressFileInput,
      handOffGeminiSanitizedFileUpload
    });
  }

  PWM.GeminiFileHandoff = Object.freeze({
    createGeminiFileHandoff
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = PWM.GeminiFileHandoff;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
