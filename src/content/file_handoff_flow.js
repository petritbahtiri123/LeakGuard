(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function createFileHandoffFlow(deps = {}) {
    const noop = () => {};
    const {
      applySanitizedTextFallback = async () => false,
      buildSanitizedDownloadFileName = () => "sanitized-file.txt",
      createSanitizedDataTransfer = () => null,
      createSanitizedDataTransferForHandoff = () => null,
      createSanitizedFileHandoffDetails = () => ({}),
      createSanitizedPayload = () => null,
      debugFileHandoffAdapterSelected = noop,
      describeFileForDebug = () => null,
      describeFileHandoffAdapter = () => null,
      documentRef = typeof document !== "undefined" ? document : null,
      dispatchSanitizedFileEvent = () => false,
      downloadGeminiSanitizedFileFallback = async () => false,
      FileTypeRegistry = globalThis.PWM?.FileTypeRegistry || {},
      assignSafeFileAttachErrorMetadata = noop,
      emitDebug = noop,
      findGeminiFileInput = () => ({ fileInput: null }),
      formatSanitizedFileFallbackText = () => "",
      getCurrentHandoffDriverId = () => "",
      getFileHandoffAdapterById = () => null,
      getFileHandoffAdapterForLocation = () => null,
      handOffGeminiSanitizedFileUpload = async () => false,
      handOffGrokSanitizedFileUpload = async () => false,
      handOffSanitizedFileInput = () => false,
      hideBadgeSoon = noop,
      hideDmzOverlay = noop,
      insertGeminiSanitizedText = async () => false,
      isFileHandoffAdapterPendingAttachEnabled = () => false,
      isFirefoxRuntime = () => false,
      isGeminiHost = () => false,
      isGrokHost = () => false,
      isProtectedFileDropDriver = () => false,
      locationRef = typeof location !== "undefined" ? location : null,
      logSanitizedFileHandoffFailure = noop,
      prepareFileInputForHandoff = () => () => {},
      queuePendingSanitizedFileHandoff = () => false,
      readSanitizedFileTextForFallback = async () => "",
      refreshBadgeFromCurrentInput = noop,
      resolveFileInputForHandoff = () => null,
      resolveWhatsAppDocumentDropInputForHandoff = async () => null,
      scheduleDmzOverlayCleanup = noop,
      sendRuntimeMessage = async () => null,
      setBadge = noop,
      setDmzOverlayState = noop,
      shouldUseFirefoxTextFallbackForFileHandoff = () => false,
      tryFirefoxGeminiFileInputBridge = async () => ({ handled: false, ok: false }),
      tryGeminiSanitizedFileAttach = async () => false
    } = deps;
    const WHATSAPP_FILE_ATTACH_UNSUPPORTED_REASON = "whatsapp_file_attachments_unsupported";
    const WHATSAPP_PDF_MIME_TYPE = "application/pdf";
    const WHATSAPP_DOCX_MIME_TYPE =
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const WHATSAPP_XLSX_MIME_TYPE =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    function isFileOnlySanitizedPayload(payload) {
      return Boolean(payload?.allowFileOnlyHandoff && !String(payload?.redactedText || "").trim());
    }

    function isWhatsAppDriver(id) {
      return String(id || "").toLowerCase() === "whatsapp";
    }

    function isRedactedPngFile(file) {
      return Boolean(
        file &&
          String(file.type || "").split(";")[0].trim().toLowerCase() === "image/png" &&
          /\.redacted\.png$/i.test(String(file.name || ""))
      );
    }

    function getFileExtension(file) {
      const name = String(file?.name || "").split(/[\\/]/).pop().toLowerCase();
      if (name === ".env") return ".env";
      const index = name.lastIndexOf(".");
      if (index <= 0 || index === name.length - 1) return "";
      return name.slice(index);
    }

    function getMimeType(file) {
      return String(file?.type || "").split(";")[0].trim().toLowerCase();
    }

    function isRedactedPdfFile(file) {
      return Boolean(
        file &&
          getMimeType(file) === WHATSAPP_PDF_MIME_TYPE &&
          /\.redacted\.pdf$/i.test(String(file.name || ""))
      );
    }

    function isRedactedDocxFile(file) {
      return Boolean(
        file &&
          getMimeType(file) === WHATSAPP_DOCX_MIME_TYPE &&
          /\.redacted\.docx$/i.test(String(file.name || ""))
      );
    }

    function isRedactedXlsxFile(file) {
      return Boolean(
        file &&
          getMimeType(file) === WHATSAPP_XLSX_MIME_TYPE &&
          /\.redacted\.xlsx$/i.test(String(file.name || ""))
      );
    }

    function isSanitizedTextDocumentFile(file) {
      if (!file || typeof FileTypeRegistry.classifyFileType !== "function") return false;
      const classification = FileTypeRegistry.classifyFileType({
        fileName: file.name,
        mimeType: file.type
      });
      return Boolean(
        classification?.status === FileTypeRegistry.FILE_TYPE_STATUS?.SUPPORTED &&
          classification?.family === "text"
      );
    }

    function getWhatsAppAttachAdapter() {
      return getFileHandoffAdapterById("whatsapp") || getFileHandoffAdapterForLocation();
    }

    function isWhatsAppSanitizedDropHandoffEnabled(adapter, context) {
      return Boolean(
        context === "drop" &&
          adapter?.id === "whatsapp" &&
          adapter.supportsSanitizedDropHandoff === true
      );
    }

    function getWhatsAppInvalidAttachKind(file, capabilities) {
      const extension = getFileExtension(file);
      const mimeType = getMimeType(file);
      if (capabilities.imageCapable && (extension === ".png" || mimeType === "image/png")) return "image";
      if (capabilities.pdfCapable && (extension === ".pdf" || mimeType === WHATSAPP_PDF_MIME_TYPE)) return "pdf";
      if (capabilities.docxCapable && (extension === ".docx" || mimeType === WHATSAPP_DOCX_MIME_TYPE)) return "docx";
      if (capabilities.xlsxCapable && (extension === ".xlsx" || mimeType === WHATSAPP_XLSX_MIME_TYPE)) return "xlsx";
      if (capabilities.textDocumentCapable && isSanitizedTextDocumentFile(file)) {
        return "text-document";
      }
      if (capabilities.pdfCapable) return "pdf";
      if (capabilities.docxCapable) return "docx";
      if (capabilities.xlsxCapable) return "xlsx";
      if (capabilities.textDocumentCapable) return "text-document";
      return "image";
    }

    function getWhatsAppAttachVerification(context, sanitizedFile) {
      const adapter = getWhatsAppAttachAdapter();
      const isWhatsAppSanitizedHandoff = Boolean(
        (context === "file-input" || isWhatsAppSanitizedDropHandoffEnabled(adapter, context)) &&
          isWhatsAppDriver(getCurrentHandoffDriverId()) &&
          adapter?.id === "whatsapp"
      );
      if (!isWhatsAppSanitizedHandoff) {
        return { shouldVerify: false, valid: false, kind: "", invalidReason: "" };
      }
      const imageCapable = adapter.supportsSanitizedImageAttachHandoff === true;
      const pdfCapable = adapter.supportsSanitizedPdfAttachHandoff === true;
      const textDocumentCapable = adapter.supportsSanitizedTextDocumentAttachHandoff === true;
      const docxCapable = adapter.supportsSanitizedDocxAttachHandoff === true;
      const xlsxCapable = adapter.supportsSanitizedXlsxAttachHandoff === true;
      if (imageCapable && isRedactedPngFile(sanitizedFile)) {
        return { shouldVerify: true, valid: true, kind: "image", invalidReason: "" };
      }
      if (pdfCapable && isRedactedPdfFile(sanitizedFile)) {
        return { shouldVerify: true, valid: true, kind: "pdf", invalidReason: "" };
      }
      if (docxCapable && isRedactedDocxFile(sanitizedFile)) {
        return { shouldVerify: true, valid: true, kind: "docx", invalidReason: "" };
      }
      if (xlsxCapable && isRedactedXlsxFile(sanitizedFile)) {
        return { shouldVerify: true, valid: true, kind: "xlsx", invalidReason: "" };
      }
      if (textDocumentCapable && isSanitizedTextDocumentFile(sanitizedFile)) {
        return { shouldVerify: true, valid: true, kind: "text-document", invalidReason: "" };
      }
      if (imageCapable || pdfCapable || textDocumentCapable || docxCapable || xlsxCapable) {
        const invalidKind = getWhatsAppInvalidAttachKind(sanitizedFile, {
          imageCapable,
          pdfCapable,
          textDocumentCapable,
          docxCapable,
          xlsxCapable
        });
        return {
          shouldVerify: true,
          valid: false,
          kind: invalidKind,
          invalidReason:
            invalidKind === "pdf"
              ? "sanitized_pdf_file_invalid"
              : invalidKind === "docx"
                ? "sanitized_docx_file_invalid"
              : invalidKind === "xlsx"
                ? "sanitized_xlsx_file_invalid"
              : invalidKind === "text-document"
                ? "sanitized_text_document_file_invalid"
                : "sanitized_image_file_invalid"
        };
      }
      return { shouldVerify: false, valid: false, kind: "", invalidReason: "" };
    }

    function isWhatsAppSanitizedAttachFileKind(file, kind) {
      return kind === "image"
        ? isRedactedPngFile(file)
        : kind === "pdf"
          ? isRedactedPdfFile(file)
        : kind === "docx"
          ? isRedactedDocxFile(file)
        : kind === "xlsx"
          ? isRedactedXlsxFile(file)
        : kind === "text-document"
          ? isSanitizedTextDocumentFile(file)
          : false;
    }

    function verifyWhatsAppSanitizedAttach(fileInput, sanitizedFile, kind) {
      const assignedFiles = Array.from(fileInput?.files || []);
      return (
        assignedFiles.length === 1 &&
        assignedFiles[0] === sanitizedFile &&
        isWhatsAppSanitizedAttachFileKind(assignedFiles[0], kind)
      );
    }

    function shouldUseWhatsAppDocumentDropInput(kind) {
      return Boolean(kind && kind !== "image");
    }

    function getWhatsAppAttachDebugLabel(kind, suffix) {
      if (kind === "text-document") return `file-handoff:whatsapp-text-document-attach-${suffix}`;
      if (kind === "pdf") return `file-handoff:whatsapp-pdf-attach-${suffix}`;
      if (kind === "docx") return `file-handoff:whatsapp-docx-attach-${suffix}`;
      if (kind === "xlsx") return `file-handoff:whatsapp-xlsx-attach-${suffix}`;
      return `file-handoff:whatsapp-image-attach-${suffix}`;
    }

    function isSafeSanitizedPayload(payload) {
      return Boolean(
        payload &&
          payload.sanitizedFile &&
          typeof payload.redactedText === "string" &&
          (payload.redactedText.length > 0 || payload.allowFileOnlyHandoff === true)
      );
    }

    async function handOffSanitizedLocalFile(event, input, sanitizedFile, context) {
      if (shouldUseFirefoxTextFallbackForFileHandoff()) {
        emitDebug("file-handoff:firefox-text-fallback-required", {
          context,
          sanitizedFile: describeFileForDebug(sanitizedFile)
        });
        return false;
      }

      const target = event?.target || input;
      if (context === "drop") {
        if (isGeminiHost()) {
          return handOffGeminiSanitizedFileUpload(event, input, sanitizedFile, {
            allowUploadUiClick: isFirefoxRuntime()
          });
        }

        if (isGrokHost()) {
          return handOffGrokSanitizedFileUpload(event, input, sanitizedFile);
        }
      }

      const transfer = createSanitizedDataTransfer(sanitizedFile);
      if (!transfer) {
        emitDebug("file-handoff:data-transfer-create-failed", {
          context,
          sanitizedFile: describeFileForDebug(sanitizedFile)
        });
        return false;
      }

      if (context === "file-input") {
        const whatsappVerification = getWhatsAppAttachVerification(context, sanitizedFile);
        if (whatsappVerification.shouldVerify && !whatsappVerification.valid) {
          emitDebug(getWhatsAppAttachDebugLabel(whatsappVerification.kind, "verification-failed"), {
            context,
            reason: whatsappVerification.invalidReason,
            sanitizedFile: describeFileForDebug(sanitizedFile)
          });
          return false;
        }
        const assigned = handOffSanitizedFileInput(event?.target, transfer, {
          dispatchInput: true
        });
        if (!assigned || !whatsappVerification.shouldVerify) return assigned;
        if (verifyWhatsAppSanitizedAttach(event?.target, sanitizedFile, whatsappVerification.kind)) {
          emitDebug(getWhatsAppAttachDebugLabel(whatsappVerification.kind, "verified"), {
            context,
            sanitizedFile: describeFileForDebug(sanitizedFile)
          });
          return true;
        }
        emitDebug(getWhatsAppAttachDebugLabel(whatsappVerification.kind, "verification-failed"), {
          context,
          reason: "assigned_file_mismatch",
          sanitizedFile: describeFileForDebug(sanitizedFile)
        });
        try {
          event.target.value = "";
        } catch {
          // The raw file remains blocked; clearing is best-effort after a failed sanitized assignment.
        }
        try {
          event.target.files = [];
        } catch {
          // Some browsers expose FileList as read-only; the event remains consumed and fails closed.
        }
        return false;
      }

      if (context === "drop") {

        try {
          transfer.dropEffect = "copy";
        } catch {
          // Some synthetic DataTransfer objects expose dropEffect as read-only.
        }
        const whatsappVerification = getWhatsAppAttachVerification(context, sanitizedFile);
        if (whatsappVerification.shouldVerify && !whatsappVerification.valid) {
          emitDebug(getWhatsAppAttachDebugLabel(whatsappVerification.kind, "verification-failed"), {
            context,
            reason: whatsappVerification.invalidReason,
            sanitizedFile: describeFileForDebug(sanitizedFile)
          });
          return false;
        }
        if (whatsappVerification.shouldVerify) {
          const fileInput = resolveFileInputForHandoff(event, input, {
            expectedFiles: [sanitizedFile]
          });
          if (fileInput) {
            const assigned = handOffSanitizedFileInput(fileInput, transfer, {
              dispatchInput: true
            });
            if (!assigned) {
              emitDebug(getWhatsAppAttachDebugLabel(whatsappVerification.kind, "verification-failed"), {
                context,
                reason: "drop_file_input_assignment_failed",
                sanitizedFile: describeFileForDebug(sanitizedFile)
              });
              return false;
            }
            if (verifyWhatsAppSanitizedAttach(fileInput, sanitizedFile, whatsappVerification.kind)) {
              emitDebug(getWhatsAppAttachDebugLabel(whatsappVerification.kind, "drop-input-verified"), {
                context,
                sanitizedFile: describeFileForDebug(sanitizedFile)
              });
              return true;
            }
            emitDebug(getWhatsAppAttachDebugLabel(whatsappVerification.kind, "verification-failed"), {
              context,
              reason: "drop_file_input_mismatch",
              sanitizedFile: describeFileForDebug(sanitizedFile)
            });
            try {
              fileInput.value = "";
            } catch {
              // The raw file remains blocked; clearing is best-effort after a failed sanitized assignment.
            }
            try {
              fileInput.files = [];
            } catch {
              // Some browsers expose FileList as read-only; the event remains consumed and fails closed.
            }
            return false;
          }
          if (shouldUseWhatsAppDocumentDropInput(whatsappVerification.kind)) {
            const documentInput = await resolveWhatsAppDocumentDropInputForHandoff(event, input, [sanitizedFile]);
            if (documentInput) {
              const assigned = handOffSanitizedFileInput(documentInput, transfer, {
                dispatchInput: true
              });
              if (assigned && verifyWhatsAppSanitizedAttach(documentInput, sanitizedFile, whatsappVerification.kind)) {
                emitDebug(getWhatsAppAttachDebugLabel(whatsappVerification.kind, "drop-document-input-verified"), {
                  context,
                  sanitizedFile: describeFileForDebug(sanitizedFile)
                });
                return true;
              }
              emitDebug(getWhatsAppAttachDebugLabel(whatsappVerification.kind, "verification-failed"), {
                context,
                reason: "drop_document_file_input_assignment_failed",
                sanitizedFile: describeFileForDebug(sanitizedFile)
              });
              try {
                documentInput.value = "";
              } catch {
                // The raw file remains blocked; clearing is best-effort after a failed sanitized assignment.
              }
              try {
                documentInput.files = [];
              } catch {
                // Some browsers expose FileList as read-only; the event remains consumed and fails closed.
              }
              return false;
            }
            emitDebug(getWhatsAppAttachDebugLabel(whatsappVerification.kind, "verification-failed"), {
              context,
              reason: "drop_document_file_input_not_found",
              sanitizedFile: describeFileForDebug(sanitizedFile)
            });
            return false;
          }
          const resolvedInput = resolveFileInputForHandoff(event, input, {
            expectedFiles: [sanitizedFile],
            allowIncompatible: true
          });
          if (resolvedInput) {
            const assigned = handOffSanitizedFileInput(resolvedInput, transfer, {
              dispatchInput: true,
              prepareInput: prepareFileInputForHandoff
            });
            if (!assigned) {
              emitDebug(getWhatsAppAttachDebugLabel(whatsappVerification.kind, "verification-failed"), {
                context,
                reason: "drop_prepared_file_input_assignment_failed",
                sanitizedFile: describeFileForDebug(sanitizedFile)
              });
              return false;
            }
            if (verifyWhatsAppSanitizedAttach(resolvedInput, sanitizedFile, whatsappVerification.kind)) {
              emitDebug(getWhatsAppAttachDebugLabel(whatsappVerification.kind, "drop-prepared-input-verified"), {
                context,
                sanitizedFile: describeFileForDebug(sanitizedFile)
              });
              return true;
            }
            emitDebug(getWhatsAppAttachDebugLabel(whatsappVerification.kind, "verification-failed"), {
              context,
              reason: "drop_file_input_mismatch",
              sanitizedFile: describeFileForDebug(sanitizedFile)
            });
            try {
              resolvedInput.value = "";
            } catch {
              // The raw file remains blocked; clearing is best-effort after a failed sanitized assignment.
            }
            try {
              resolvedInput.files = [];
            } catch {
              // Some browsers expose FileList as read-only; the event remains consumed and fails closed.
            }
            return false;
          }
          emitDebug(getWhatsAppAttachDebugLabel(whatsappVerification.kind, "verification-failed"), {
            context,
            reason: "drop_file_input_not_found",
            sanitizedFile: describeFileForDebug(sanitizedFile)
          });
          return false;
        }
        return dispatchSanitizedFileEvent(target, "drop", transfer);
      }

      if (context === "paste") {
        return dispatchSanitizedFileEvent(target, "paste", transfer);
      }

      return false;
    }

    function tryRealFileInputSanitizedFileAttach(payload, event, input, driverId) {
      if (!payload?.sanitizedFile) return false;
      if (shouldUseFirefoxTextFallbackForFileHandoff()) return false;
      const details = createSanitizedFileHandoffDetails(event, payload.sanitizedFile, `${driverId}:file-input`);
      const transfer = createSanitizedDataTransferForHandoff(payload.sanitizedFile, details);
      if (!transfer) {
        details.failureReason = "data_transfer_failed";
        logSanitizedFileHandoffFailure(details);
        return false;
      }

      const adapter = getFileHandoffAdapterById(driverId);
      const fileInput =
        adapter?.resolveFileInput?.(event, input, adapter) || resolveFileInputForHandoff(event, input);
      details.fileInputCountBeforeClick = fileInput ? 1 : 0;
      details.fileInputCountAfterTopTriggerClick = fileInput ? 1 : 0;
      details.fileInputCountAfterOverlayItemClick = fileInput ? 1 : 0;
      if (!fileInput) {
        details.failureReason = "no_safe_file_input";
        return false;
      }

      const assigned = handOffSanitizedFileInput(fileInput, transfer, {
        dispatchInput: true,
        details
      });
      if (!assigned) {
        logSanitizedFileHandoffFailure(details);
      }
      return assigned;
    }

    async function insertSanitizedPayloadText(payload, event, input, context = null) {
      if (!String(payload?.redactedText || "").trim()) return false;
      if (!input && context?.composerResolved && !isFirefoxRuntime()) return false;
      if (isGeminiHost()) {
        return insertGeminiSanitizedText(payload, event, input);
      }
      return applySanitizedTextFallback(event, input, formatSanitizedFileFallbackText(payload), {
        rawInsertedText: payload.rawText || ""
      });
    }

    async function downloadSanitizedFileFallback(event, input, payload, driverId, details = null) {
      if (isGeminiHost()) {
        return downloadGeminiSanitizedFileFallback(event, input, payload?.sanitizedFile, details);
      }
      if (!payload?.sanitizedFile) return false;

      let redactedText = "";
      try {
        redactedText = await readSanitizedFileTextForFallback(payload.sanitizedFile);
      } catch (error) {
        if (details) {
          details.failureReason = "sanitized_download_read_failed";
          assignSafeFileAttachErrorMetadata(details, error);
        }
        return false;
      }

      try {
        const response = await sendRuntimeMessage({
          type: "PWM_DOWNLOAD_SANITIZED_FILE",
          fileName: buildSanitizedDownloadFileName(payload.sanitizedFile),
          mimeType: payload.sanitizedFile.type || "text/plain",
          redactedText
        });
        if (!response?.ok) {
          if (details) {
            details.failureReason = "sanitized_download_failed";
            assignSafeFileAttachErrorMetadata(details, response?.error || "Background download request failed.");
          }
          return false;
        }
        emitDebug("file-handoff:sanitized-download", {
          driver: driverId,
          sanitizedFile: describeFileForDebug(payload.sanitizedFile),
          downloadId: response.downloadId ?? null
        });
        setDmzOverlayState("Sanitized download ready", "fallback");
        scheduleDmzOverlayCleanup(3600);
        setBadge("Sanitized download ready");
        hideBadgeSoon(6500);
        refreshBadgeFromCurrentInput();
        return true;
      } catch (error) {
        if (details) {
          details.failureReason = "sanitized_download_failed";
          assignSafeFileAttachErrorMetadata(details, error);
        }
        return false;
      }
    }

    function getCurrentHandoffDriver() {
      const id = getCurrentHandoffDriverId();
      return {
        id,
        usesDmzOverlay: isProtectedFileDropDriver(id),
        canHandle: () => true,
        preparePayload: (sanitizedFile, redactedText, metadata) =>
          createSanitizedPayload(
            sanitizedFile,
            redactedText,
            metadata?.localFile,
            metadata?.analysis,
            metadata?.result
          ),
        tryAttachSanitizedFile: async (payload, context) => {
          if (id === "gemini") return tryGeminiSanitizedFileAttach(payload, context.event, context.input);
          if (id === "grok") return handOffGrokSanitizedFileUpload(context.event, context.input, payload.sanitizedFile);
          if (id === "chatgpt" || id === "claude" || id === "openai" || id === "x" || id === "generic") {
            return tryRealFileInputSanitizedFileAttach(payload, context.event, context.input, id);
          }
          return false;
        },
        insertSanitizedText: (payload, context) => insertSanitizedPayloadText(payload, context.event, context.input, context),
        emergencyDownload: (payload, context) =>
          downloadSanitizedFileFallback(
            context.event,
            context.input,
            payload,
            id,
            createSanitizedFileHandoffDetails(context.event, payload?.sanitizedFile, `${id}:emergency-download`)
          ),
        handoff: async (payload, context) => handoffSanitizedPayload(payload, context)
      };
    }

    async function handoffSanitizedPayload(payload, context) {
      const driver = context?.driver || getCurrentHandoffDriver();
      const adapter = context?.adapter || driver.adapter || getFileHandoffAdapterForLocation();
      debugFileHandoffAdapterSelected(adapter, "handoff");
      if (isWhatsAppDriver(driver?.id)) {
        const canUseSanitizedDrop = isWhatsAppSanitizedDropHandoffEnabled(adapter, context?.context);
        if (canUseSanitizedDrop) {
          if (!isSafeSanitizedPayload(payload)) {
            setDmzOverlayState("Raw file blocked", "failed");
            return { ok: false, stage: "failed", reason: "unsafe_sanitized_payload" };
          }
          emitDebug("file-handoff:whatsapp-sanitized-drop-attempt", {
            site: driver.id,
            adapter: describeFileHandoffAdapter(adapter),
            context: context?.context || "",
            sanitizedFile: describeFileForDebug(payload.sanitizedFile)
          });
          if (await handOffSanitizedLocalFile(context.event, context.input, payload.sanitizedFile, "drop")) {
            setDmzOverlayState("Attached sanitized file", "attached");
            return { ok: true, stage: "file", strategy: "whatsapp-sanitized-drop-handoff" };
          }
          setDmzOverlayState("Raw file blocked", "failed");
          return {
            ok: false,
            stage: "failed",
            reason: "whatsapp_sanitized_drop_handoff_failed",
            message: "LeakGuard blocked the raw WhatsApp file drop because sanitized drop handoff could not be verified."
          };
        }
        setDmzOverlayState("Raw file blocked", "failed");
        return {
          ok: false,
          stage: "failed",
          reason: WHATSAPP_FILE_ATTACH_UNSUPPORTED_REASON,
          message: "LeakGuard blocks unsupported WhatsApp Web file attachments in this phase. No raw file was uploaded."
        };
      }
      if (!driver?.canHandle?.(locationRef, documentRef)) {
        return { ok: false, stage: "driver-unavailable" };
      }
      if (!isSafeSanitizedPayload(payload)) {
        setDmzOverlayState("Raw file blocked", "failed");
        return { ok: false, stage: "failed", reason: "unsafe_sanitized_payload" };
      }

      const firefoxGeminiDropInput =
        driver.id === "gemini" && isFirefoxRuntime() && context?.context === "drop"
          ? findGeminiFileInput(context.event, context.input).fileInput
          : null;
      if (
        driver.id === "gemini" &&
        isFirefoxRuntime() &&
        context?.context === "drop" &&
        !firefoxGeminiDropInput &&
        payload?.sanitizedFile &&
        isFileHandoffAdapterPendingAttachEnabled(adapter)
      ) {
        const pendingDetails = createSanitizedFileHandoffDetails(
          context.event,
          payload.sanitizedFile,
          `${adapter.id}:firefox-drop-pending-attach`
        );
        if (queuePendingSanitizedFileHandoff(adapter, context.event, context.input, payload.sanitizedFile, pendingDetails)) {
          emitDebug("file-handoff:firefox-gemini-drop-pending-queued", {
            adapter: describeFileHandoffAdapter(adapter),
            context: context?.context || "",
            sanitizedFile: describeFileForDebug(payload.sanitizedFile)
          });
          hideDmzOverlay();
          return { ok: true, stage: "pending", strategy: `${adapter.id}-pending-sanitized-file-handoff` };
        }
      }

      emitDebug("file-handoff:direct-attempt-start", {
        site: driver.id,
        adapter: describeFileHandoffAdapter(adapter),
        context: context?.context || "",
        sanitizedFile: describeFileForDebug(payload.sanitizedFile)
      });
      if (await driver.tryAttachSanitizedFile(payload, context)) {
        emitDebug("file-handoff:direct-attempt-success", {
          site: driver.id,
          adapter: describeFileHandoffAdapter(adapter),
          context: context?.context || "",
          sanitizedFile: describeFileForDebug(payload.sanitizedFile)
        });
        setDmzOverlayState("Attached sanitized file", "attached");
        return { ok: true, stage: "file", strategy: `${driver.id}-sanitized-file-handoff` };
      }
      emitDebug("file-handoff:direct-attempt-failed", {
        site: driver.id,
        adapter: describeFileHandoffAdapter(adapter),
        context: context?.context || "",
        sanitizedFile: describeFileForDebug(payload.sanitizedFile)
      });

      const firefoxGeminiBridgeResult =
        driver.id === "gemini"
          ? await tryFirefoxGeminiFileInputBridge(payload, context)
          : { handled: false, ok: false };
      if (firefoxGeminiBridgeResult.ok) {
        if (firefoxGeminiBridgeResult.stage === "text") {
          setDmzOverlayState("Inserted sanitized content", "inserted");
          return { ok: true, stage: "text", strategy: firefoxGeminiBridgeResult.strategy };
        }
        if (firefoxGeminiBridgeResult.stage === "pending") {
          hideDmzOverlay();
          return { ok: true, stage: "pending", strategy: firefoxGeminiBridgeResult.strategy };
        }
        setDmzOverlayState("Attached sanitized file", "attached");
        return { ok: true, stage: "file", strategy: firefoxGeminiBridgeResult.strategy };
      }
      if (firefoxGeminiBridgeResult.handled) {
        if (
          firefoxGeminiBridgeResult.reason === "gemini_firefox_file_input_not_found" &&
          context?.context === "drop" &&
          payload?.sanitizedFile &&
          isFileHandoffAdapterPendingAttachEnabled(adapter)
        ) {
          const pendingDetails = createSanitizedFileHandoffDetails(
            context.event,
            payload.sanitizedFile,
            `${adapter.id}:pending-after-firefox-bridge-miss`
          );
          if (queuePendingSanitizedFileHandoff(adapter, context.event, context.input, payload.sanitizedFile, pendingDetails)) {
            hideDmzOverlay();
            return { ok: true, stage: "pending", strategy: `${adapter.id}-pending-sanitized-file-handoff` };
          }
        }
        setDmzOverlayState("Raw file blocked", "failed");
        return firefoxGeminiBridgeResult;
      }

      if (
        context?.context === "drop" &&
        payload?.sanitizedFile &&
        isFileHandoffAdapterPendingAttachEnabled(adapter)
      ) {
        const pendingDetails = createSanitizedFileHandoffDetails(
          context.event,
          payload.sanitizedFile,
          `${adapter.id}:pending-after-direct-failure`
        );
        if (queuePendingSanitizedFileHandoff(adapter, context.event, context.input, payload.sanitizedFile, pendingDetails)) {
          hideDmzOverlay();
          return { ok: true, stage: "pending", strategy: `${adapter.id}-pending-sanitized-file-handoff` };
        }
      }

      const fileOnlyPayload = isFileOnlySanitizedPayload(payload);
      if (!fileOnlyPayload) {
        const textInserted = await driver.insertSanitizedText(payload, context);
        if (textInserted === true) {
          setDmzOverlayState("Inserted sanitized content", "inserted");
          return { ok: true, stage: "text", strategy: `${driver.id}-sanitized-text-fallback` };
        }
        if (textInserted === "cancelled") {
          return { ok: false, stage: "text", reason: "sanitized_text_cancelled" };
        }

        if (await driver.emergencyDownload(payload, context)) {
          return { ok: true, stage: "download", strategy: `${driver.id}-sanitized-download-fallback` };
        }
      } else {
        emitDebug("file-handoff:file-only-fallback-skipped", {
          site: driver.id,
          adapter: describeFileHandoffAdapter(adapter),
          context: context?.context || "",
          sanitizedFile: describeFileForDebug(payload.sanitizedFile),
          reason: "streamed_sanitized_file_not_read_back"
        });
      }

      setDmzOverlayState("Raw file blocked", "failed");
      return { ok: false, stage: "failed", reason: "sanitized_payload_handoff_failed" };
    }

    return {
      isFileOnlySanitizedPayload,
      isSafeSanitizedPayload,
      handOffSanitizedLocalFile,
      tryRealFileInputSanitizedFileAttach,
      insertSanitizedPayloadText,
      downloadSanitizedFileFallback,
      getCurrentHandoffDriver,
      handoffSanitizedPayload
    };
  }

  root.PWM.createFileHandoffFlow = createFileHandoffFlow;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { createFileHandoffFlow };
  }
})();
