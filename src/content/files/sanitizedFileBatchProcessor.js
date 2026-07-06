(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function createFallbackSummary(index, status, file, code = "") {
    const mimeCategory = String(file?.type || "")
      .split("/")[0]
      .replace(/[^a-z0-9.+-]/gi, "")
      .slice(0, 32);
    return {
      index: Math.max(0, Number(index || 0) || 0),
      label: `file-${Math.max(0, Number(index || 0) || 0) + 1}`,
      status: String(status || "failed"),
      extension: "",
      mimeCategory,
      sizeBytes: Math.max(0, Number(file?.size || 0) || 0),
      code: String(code || "").replace(/[^a-z0-9_:-]/gi, "").slice(0, 64)
    };
  }

  function createSanitizedFileBatchProcessor(options = {}) {
    const fileAttachPipeline = options.fileAttachPipeline || root.PWM.FileAttachPipeline || {};
    const shouldUseContentFileExtractionPipeline =
      typeof options.shouldUseContentFileExtractionPipeline === "function"
        ? options.shouldUseContentFileExtractionPipeline
        : () => false;
    const processFileForAdapterHandoff =
      typeof options.processFileForAdapterHandoff === "function"
        ? options.processFileForAdapterHandoff
        : async () => null;
    const localFileFromContentExtractionResult =
      typeof options.localFileFromContentExtractionResult === "function"
        ? options.localFileFromContentExtractionResult
        : () => ({
            handled: true,
            ok: false,
            code: "content_file_extraction_failed"
          });
    const readLocalTextFileFromDataTransfer =
      typeof options.readLocalTextFileFromDataTransfer === "function"
        ? options.readLocalTextFileFromDataTransfer
        : async () => ({
            handled: true,
            ok: false,
            code: "file_scan_failed"
          });
    const createSingleFileDataTransfer =
      typeof options.createSingleFileDataTransfer === "function"
        ? options.createSingleFileDataTransfer
        : (file) => ({
            files: file ? [file] : [],
            types: file ? ["Files"] : [],
            items: []
          });
    const streamRedactLocalTextFile =
      typeof options.streamRedactLocalTextFile === "function"
        ? options.streamRedactLocalTextFile
        : async () => null;
    const classifyLocalTextPayloadSize =
      typeof options.classifyLocalTextPayloadSize === "function"
        ? options.classifyLocalTextPayloadSize
        : () => ({
            zone: "blocked",
            bytes: 0
          });
    const analyzeText =
      typeof options.analyzeText === "function"
        ? options.analyzeText
        : () => ({
            normalizedText: "",
            secretFindings: [],
            findings: []
          });
    const requestRedaction =
      typeof options.requestRedaction === "function"
        ? options.requestRedaction
        : async (text) => ({
            redactedText: String(text || ""),
            replacements: []
          });
    const createSanitizedTextFile =
      typeof options.createSanitizedTextFile === "function" ? options.createSanitizedTextFile : () => null;
    const getLocalFileSafeMetadata =
      typeof options.getLocalFileSafeMetadata === "function"
        ? options.getLocalFileSafeMetadata
        : (file) => ({
            extension: "",
            mimeCategory: String(file?.type || "").split("/")[0].replace(/[^a-z0-9.+-]/gi, "").slice(0, 32),
            sizeBytes: Math.max(0, Number(file?.size || 0) || 0)
          });
    const debugFileAttachMetadata =
      typeof options.debugFileAttachMetadata === "function" ? options.debugFileAttachMetadata : () => {};

    function summarizeMultiFileItem(index, status, file, code = "") {
      if (typeof fileAttachPipeline.createMultiFileItemSummary === "function") {
        return fileAttachPipeline.createMultiFileItemSummary({
          index,
          status,
          code,
          metadata: getLocalFileSafeMetadata(file)
        });
      }
      return createFallbackSummary(index, status, file, code);
    }

    function createBlockedBeforeProcessingItems(files, code = "blocked_by_policy") {
      return Array.from(files || []).map((file, index) => ({
        ok: false,
        status: "blocked",
        code,
        summary: summarizeMultiFileItem(index, "blocked", file, code)
      }));
    }

    function createMultiFileStatusSummary(sanitizedItems, blockedItems) {
      if (typeof fileAttachPipeline.createMultiFileStatusSummary === "function") {
        return fileAttachPipeline.createMultiFileStatusSummary({
          sanitizedItems,
          blockedItems
        });
      }
      const attached = Array.from(sanitizedItems || []).map((item) => item.summary || item);
      const blocked = Array.from(blockedItems || []).map((item) => item.summary || item);
      return {
        sanitizedCount: attached.length,
        attachedCount: attached.length,
        blockedCount: blocked.length,
        attached,
        blocked,
        files: [...attached, ...blocked].sort((a, b) => Number(a.index || 0) - Number(b.index || 0))
      };
    }

    function formatMultiFileStatusMessage(summary, formatOptions = {}) {
      if (typeof fileAttachPipeline.formatMultiFileStatusMessage === "function") {
        return fileAttachPipeline.formatMultiFileStatusMessage(summary, formatOptions);
      }
      return "LeakGuard blocked or sanitized this protected upload batch. No raw files were uploaded.";
    }

    async function processLocalFileForSanitizedBatch(file, index, context) {
      try {
        const contentExtractionResult = shouldUseContentFileExtractionPipeline(file)
          ? await processFileForAdapterHandoff({ file, context })
          : null;
        const localFile = contentExtractionResult
          ? localFileFromContentExtractionResult(contentExtractionResult)
          : await readLocalTextFileFromDataTransfer(createSingleFileDataTransfer(file));

        if (!localFile.handled || !localFile.ok) {
          if (localFile.code === "streaming_required" && localFile.sourceFile) {
            const streamResult = await streamRedactLocalTextFile(localFile.sourceFile, localFile.file);
            if (streamResult?.action === "redacted" && streamResult.sanitizedFile) {
              return {
                ok: true,
                status: "sanitized",
                sanitizedFile: streamResult.sanitizedFile,
                localFile,
                analysis: {
                  normalizedText: "",
                  secretFindings: Array.from({ length: Number(streamResult.findingsCount || 0) }, () => ({})),
                  findings: []
                },
                result: { redactedText: "", replacements: [] },
                streamed: true,
                summary: summarizeMultiFileItem(index, "sanitized", file, "")
              };
            }
            return {
              ok: false,
              status: "failed",
              code: streamResult?.action === "blocked" ? "file_exceeds_supported_size" : "redaction_failed",
              message: "LeakGuard blocked one raw file because streaming sanitization failed.",
              summary: summarizeMultiFileItem(
                index,
                streamResult?.action === "blocked" ? "blocked" : "failed",
                file,
                streamResult?.action === "blocked" ? "file_exceeds_supported_size" : "redaction_failed"
              )
            };
          }
          const blockCode = localFile.code || contentExtractionResult?.fallbackReason || "file_scan_failed";
          const blockedByPolicy = blockCode === "unsupported_file_type" || blockCode === "blocked_by_policy";
          const status = localFile.handled || blockedByPolicy ? "blocked" : "failed";
          return {
            ok: false,
            status,
            code: blockCode,
            message: localFile.message || "LeakGuard blocked one raw file because local scanning failed.",
            summary: summarizeMultiFileItem(index, status, file, blockCode)
          };
        }

        const imageRedactionMode = localFile.imageRedactionMode === true || localFile.fileOnlyUpload === true;
        const sizeInfo = imageRedactionMode
          ? { zone: "fast", bytes: Math.max(0, Number(localFile.file?.sizeBytes || 0)) }
          : classifyLocalTextPayloadSize({ text: localFile.text, sizeBytes: localFile.file?.sizeBytes });
        if (sizeInfo.zone === "blocked") {
          return {
            ok: false,
            status: "blocked",
            code: "file_exceeds_supported_size",
            message: "LeakGuard blocked one raw file because it exceeds safe multi-file local processing limits.",
            summary: summarizeMultiFileItem(index, "blocked", file, "file_exceeds_supported_size")
          };
        }

        let analysis;
        let result;
        let sanitizedFile;
        if (contentExtractionResult?.status === "ready") {
          const contentExtractionFileOnly =
            localFile.fileOnlyUpload === true || contentExtractionResult.fileOnlyUpload === true;
          result = {
            redactedText: contentExtractionFileOnly ? "" : contentExtractionResult.sanitizedText,
            replacements: []
          };
          sanitizedFile = contentExtractionResult.sanitizedFile;
          analysis = {
            normalizedText: contentExtractionResult.sanitizedText,
            secretFindings: Array.from(
              { length: Number(contentExtractionResult.metadata?.scan?.findingsCount || 0) },
              () => ({})
            ),
            findings: []
          };
        } else {
          analysis = analyzeText(localFile.text);
          result = await requestRedaction(analysis.normalizedText, analysis.secretFindings);
          sanitizedFile = createSanitizedTextFile(localFile.file, result.redactedText);
        }

        if (!sanitizedFile) {
          return {
            ok: false,
            status: "failed",
            code: "sanitized_file_create_failed",
            message: "LeakGuard blocked one raw file because sanitized output could not be created.",
            summary: summarizeMultiFileItem(index, "failed", file, "sanitized_file_create_failed")
          };
        }

        return {
          ok: true,
          status: "sanitized",
          sanitizedFile,
          localFile,
          analysis,
          result,
          imageRedactionMode,
          summary: summarizeMultiFileItem(index, "sanitized", file, "")
        };
      } catch (error) {
        debugFileAttachMetadata("file-handoff:multi-file-item-processing-failed", {
          context,
          error,
          file: getLocalFileSafeMetadata(file)
        });
        return {
          ok: false,
          status: "failed",
          code: "file_processing_exception",
          message: "LeakGuard blocked one raw file because local sanitization failed.",
          summary: summarizeMultiFileItem(index, "failed", file, "file_processing_exception")
        };
      }
    }

    async function processLocalFilesForSanitizedBatch(files, context) {
      return Promise.all(
        Array.from(files || []).map((file, index) =>
          processLocalFileForSanitizedBatch(file, index, context)
        )
      );
    }

    return Object.freeze({
      summarizeMultiFileItem,
      createBlockedBeforeProcessingItems,
      createMultiFileStatusSummary,
      formatMultiFileStatusMessage,
      processLocalFileForSanitizedBatch,
      processLocalFilesForSanitizedBatch
    });
  }

  root.PWM.SanitizedFileBatchProcessor = Object.freeze({
    createSanitizedFileBatchProcessor
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.SanitizedFileBatchProcessor;
  }
})();
