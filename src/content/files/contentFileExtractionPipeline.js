(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  const SUPPORTED_EXTRACTION_KINDS = new Set(["text", "pdf", "docx", "xlsx", "image_metadata"]);
  const EXTRACTED_TEXT_OUTPUT_KINDS = new Set(["pdf", "docx", "xlsx", "image_metadata", "image_ocr"]);

  function getRegistry() {
    return root.PWM.FileTypeRegistry || {};
  }

  function getExtractors() {
    return root.PWM.FileExtractors || {};
  }

  function getScanner() {
    return root.PWM.FileScanner || {};
  }

  function getSessionCache() {
    return root.PWM.FileExtractionSessionCache || {};
  }

  function getScannerOcr() {
    return root.PWM.ScannerOcr || {};
  }

  function getImageRedactor() {
    return root.PWM.ImageRedactor || {};
  }

  function getPdfRedactor() {
    return root.PWM.PdfRedactor || {};
  }

  function getDocxRedactor() {
    return root.PWM.DocxRedactor || {};
  }

  function getXlsxRedactor() {
    return root.PWM.XlsxRedactor || {};
  }

  function getOcrRuntime() {
    return root.PWM.ProtectedSiteOcrBroker || root.PWM.OcrRuntime || {};
  }

  async function getProtectedSiteOcrGate() {
    if (typeof root.PWM.isProtectedSiteOcrEnabled !== "function") return false;
    return root.PWM.isProtectedSiteOcrEnabled();
  }

  function normalizeFileName(fileName) {
    const registry = getRegistry();
    if (typeof registry.normalizeFileName === "function") return registry.normalizeFileName(fileName);
    return String(fileName || "").split(/[\\/]/).pop() || "";
  }

  function normalizeMimeType(mimeType) {
    const registry = getRegistry();
    if (typeof registry.normalizeMimeType === "function") return registry.normalizeMimeType(mimeType);
    return String(mimeType || "").split(";")[0].trim().toLowerCase();
  }

  function getFileExtension(fileName) {
    const registry = getRegistry();
    if (typeof registry.getFileExtension === "function") return registry.getFileExtension(fileName);
    const name = normalizeFileName(fileName).toLowerCase();
    const index = name.lastIndexOf(".");
    if (index <= 0 || index === name.length - 1) return "";
    return name.slice(index);
  }

  function splitFileName(fileName) {
    const normalizedName = normalizeFileName(fileName) || "file";
    const extension = getFileExtension(normalizedName);
    if (!extension) return { base: normalizedName || "file", extension: ".txt" };
    return {
      base: normalizedName.slice(0, -extension.length).replace(/^\.+/, "") || "file",
      extension
    };
  }

  function buildRedactedTxtName(fileName) {
    const { base } = splitFileName(fileName);
    return `${base}.redacted.txt`;
  }

  function buildRedactedPngName(fileName) {
    const { base } = splitFileName(fileName);
    return `${base}.redacted.png`;
  }

  function listWarnings(...sources) {
    return Array.from(
      new Set(
        sources
          .flatMap((source) => Array.isArray(source) ? source : [])
          .map((warning) => String(warning || "").trim())
          .filter(Boolean)
      )
    );
  }

  function removeImageMetadataOcrClaims(text) {
    return String(text || "")
      .split(/\r?\n/)
      .filter((line) => !/^(?:visual_text_scanned|image_ocr_supported)=/i.test(String(line || "").trim()))
      .join("\n");
  }

  function sanitizeExtractionMetadata(metadata = {}) {
    return {
      fileName: normalizeFileName(metadata.fileName),
      extension: String(metadata.extension || ""),
      mimeType: normalizeMimeType(metadata.mimeType),
      sizeBytes: Math.max(0, Number(metadata.sizeBytes || 0)),
      textLength: Math.max(0, Number(metadata.textLength || 0)),
      extractedParts: Math.max(0, Number(metadata.extractedParts || 0)),
      visualContentScanned: metadata.visualContentScanned === true,
      ocrSupported: metadata.ocrSupported === true
    };
  }

  function createEmptyResult(status, options = {}) {
    const metadataOriginalName = Object.prototype.hasOwnProperty.call(options, "metadataOriginalName")
      ? normalizeFileName(options.metadataOriginalName)
      : normalizeFileName(options.originalName);
    return {
      status,
      originalName: normalizeFileName(options.originalName),
      outputName: options.outputName || "",
      outputKind: options.outputKind || "",
      extractedKind: options.extractedKind || "",
      sanitizedText: "",
      sanitizedFile: null,
      metadata: {
        original: {
          name: metadataOriginalName,
          type: normalizeMimeType(options.mimeType),
          size: Math.max(0, Number(options.sizeBytes || 0))
        },
        extraction: sanitizeExtractionMetadata(options.extractionMetadata),
        scan: {
          findingsCount: 0,
          changed: false,
          redactedLength: 0
        }
      },
      warnings: listWarnings(options.warnings),
      safeForUpload: false,
      fallbackReason: options.fallbackReason || ""
    };
  }

  function isImageExtractionKind(kind) {
    return kind === "image_metadata" || kind === "image_ocr";
  }

  function createImageBlockedResult(reason, options = {}) {
    const code = reason || "image_redaction_file_unavailable";
    return createEmptyResult("blocked", {
      originalName: options.originalName,
      mimeType: options.mimeType,
      sizeBytes: options.sizeBytes,
      metadataOriginalName: "",
      extractedKind: options.extractedKind || "image_ocr",
      extractionMetadata: options.extractionMetadata,
      warnings: listWarnings(options.warnings, [`image-redaction:${code}`]),
      fallbackReason: code
    });
  }

  function createTextFile(text, outputName, mimeType) {
    const FilePasteHelpers = root.PWM.FilePasteHelpers || {};
    if (typeof FilePasteHelpers.createSanitizedTextFile === "function") {
      return FilePasteHelpers.createSanitizedTextFile(
        {
          name: outputName,
          type: mimeType || "text/plain"
        },
        text
      );
    }

    const options = {
      type: mimeType || "text/plain",
      lastModified: Date.now()
    };
    if (typeof root.File === "function") {
      return new root.File([text], outputName, options);
    }
    if (typeof root.Blob === "function") {
      const blob = new root.Blob([text], { type: options.type });
      try {
        Object.defineProperty(blob, "name", { value: outputName, configurable: true });
        Object.defineProperty(blob, "lastModified", { value: options.lastModified, configurable: true });
      } catch {
        // Blob metadata is best-effort; the bytes are still sanitized.
      }
      return blob;
    }
    return null;
  }

  function createImageFileFromBlob(blob, outputName) {
    if (!blob) return null;
    if (typeof root.File === "function") {
      return new root.File([blob], outputName, {
        type: "image/png",
        lastModified: Date.now()
      });
    }
    try {
      Object.defineProperty(blob, "name", { value: outputName, configurable: true });
      Object.defineProperty(blob, "lastModified", { value: Date.now(), configurable: true });
    } catch {
      // Blob metadata is best-effort; the bytes are still sanitized.
    }
    return blob;
  }

  function createBinaryFile(bytes, outputName, mimeType) {
    if (!bytes || !outputName) return null;
    const options = {
      type: mimeType || "application/octet-stream",
      lastModified: Date.now()
    };
    if (typeof root.File === "function") {
      return new root.File([bytes], outputName, options);
    }
    if (typeof root.Blob === "function") {
      const blob = new root.Blob([bytes], { type: options.type });
      try {
        Object.defineProperty(blob, "name", { value: outputName, configurable: true });
        Object.defineProperty(blob, "lastModified", { value: options.lastModified, configurable: true });
      } catch {
        // Blob metadata is best-effort; the bytes are still sanitized.
      }
      return blob;
    }
    return null;
  }

  async function readFileBuffer(file) {
    if (typeof file?.arrayBuffer !== "function") {
      throw new Error("file_array_buffer_unavailable");
    }
    return file.arrayBuffer();
  }

  async function readFileText(file, buffer) {
    if (typeof file?.text === "function") {
      return String(await file.text());
    }
    const scanner = getScanner();
    if (typeof scanner.decodeUtf8Text === "function") return scanner.decodeUtf8Text(buffer);
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  }

  async function runProtectedSiteImageOcr(file, extraction, options = {}) {
    const scannerOcr = getScannerOcr();
    if (
      typeof scannerOcr.recognizeScannerImageFile !== "function" ||
      typeof scannerOcr.buildScannerOcrScanText !== "function"
    ) {
      return {
        ok: false,
        status: "ocr_runtime_unavailable",
        warnings: ["ocr_runtime_unavailable"]
      };
    }

    const runtime = getOcrRuntime();
    if (typeof runtime.prepare === "function") {
      const prepared = await runtime.prepare({ timeoutMs: options.ocrTimeoutMs });
      if (!prepared?.ok) {
        const status = prepared?.reason || prepared?.status || "ocr_runtime_unavailable";
        return {
          ok: false,
          status,
          warnings: listWarnings(prepared?.warnings, [status])
        };
      }
    }

    const ocrOptions = {
      runtime,
      timeoutMs: options.ocrTimeoutMs
    };
    if (options.ocrDimensions) {
      ocrOptions.dimensions = options.ocrDimensions;
    } else {
      ocrOptions.readDimensions = true;
    }

    const ocr = await scannerOcr.recognizeScannerImageFile(file, ocrOptions);
    if (!ocr?.ok) {
      return {
        ok: false,
        status: ocr?.status || "ocr_failed",
        warnings: listWarnings(ocr?.warnings, [ocr?.status || "ocr_failed"])
      };
    }

    const text = scannerOcr.buildScannerOcrScanText({
      metadataText: removeImageMetadataOcrClaims(extraction.text),
      ocrText: ocr.text,
      ocrMetadata: ocr
    });

    return {
      ok: true,
      kind: "image_ocr",
      text,
      metadata: {
        ...(extraction.metadata || {}),
        textLength: text.length,
        visualContentScanned: true,
        ocrSupported: true
      },
      warnings: listWarnings(ocr.warnings),
      ocr
    };
  }

  async function createProtectedSiteRedactedImage({ imageBytes, ocrExtraction, scan, originalName, mimeType } = {}) {
    const scannerOcr = getScannerOcr();
    const imageRedactor = getImageRedactor();
    if (typeof imageRedactor.createRedactedPng !== "function") {
      return {
        ok: false,
        status: "image_redactor_unavailable",
        warnings: ["image_redactor_unavailable"]
      };
    }

    let boxMapping = {
      ok: true,
      boxKind: "none",
      fallbackUsed: false,
      protectedSiteEligible: true,
      warnings: [],
      boxes: []
    };
    const hasFindings = Number(scan?.summary?.findingsCount || 0) > 0;
    if (hasFindings) {
      if (typeof scannerOcr.redactionBoxesForOcrFindings !== "function") {
        return {
          ok: false,
          status: "image_redactor_unavailable",
          warnings: ["image_redactor_unavailable"]
        };
      }
      boxMapping = scannerOcr.redactionBoxesForOcrFindings({
        ocr: ocrExtraction.ocr,
        scanResult: scan,
        scanText: ocrExtraction.text,
        ocrText: ocrExtraction.ocr?.text
      });
    }
    const warnings = listWarnings((boxMapping?.warnings || []).map((warning) => `image-redaction:${warning}`));

    if (!boxMapping?.ok) {
      return {
        ok: false,
        status: boxMapping?.status || "ocr_boxes_missing",
        warnings
      };
    }

    if (boxMapping.fallbackUsed === true || boxMapping.protectedSiteEligible !== true) {
      return {
        ok: false,
        status: "protected_site_visual_redaction_not_eligible",
        warnings
      };
    }

    const redactedImage = await imageRedactor.createRedactedPng({
      imageBytes,
      mimeType,
      fileName: originalName,
      boxes: boxMapping.boxes,
      allowNoBoxes: !hasFindings
    });
    if (!redactedImage?.ok || !redactedImage.blob) {
      return {
        ok: false,
        status: redactedImage?.status || "image_redaction_failed",
        warnings: listWarnings(warnings, [`image-redaction:${redactedImage?.status || "image_redaction_failed"}`])
      };
    }

    const outputName = redactedImage.fileName || buildRedactedPngName(originalName);
    const sanitizedFile = redactedImage.file || createImageFileFromBlob(redactedImage.blob, outputName);
    if (!sanitizedFile) {
      return {
        ok: false,
        status: "redacted_image_file_create_failed",
        warnings: listWarnings(warnings, ["image-redaction:redacted_image_file_create_failed"])
      };
    }

    return {
      ok: true,
      status: "protected_site_redacted_image_ready",
      outputName,
      outputKind: "redacted_image_file",
      sanitizedFile,
      sanitizedImageFile: sanitizedFile,
      warnings,
      boxKind: boxMapping.boxKind
    };
  }

  function canExtractForAdapterHandoff(file) {
    const extractors = getExtractors();
    if (typeof extractors.routeFileExtractor !== "function") return false;
    const routed = extractors.routeFileExtractor({
      fileName: file?.name || "",
      mimeType: file?.type || "",
      sizeBytes: Number(file?.size || 0)
    });
    return SUPPORTED_EXTRACTION_KINDS.has(routed?.kind) && routed?.safeForScan === true;
  }

  async function processFileForAdapterHandoff(options = {}) {
    const file = options.file;
    const originalName = normalizeFileName(file?.name);
    const mimeType = normalizeMimeType(file?.type);
    const sizeBytes = Math.max(0, Number(file?.size || 0));
    const extractors = getExtractors();
    const scanner = getScanner();
    const sessionCache = getSessionCache();
    const routed = extractors.routeFileExtractor?.({
      fileName: originalName,
      mimeType,
      sizeBytes
    });
    const skipSessionCache = routed?.kind === "image_metadata";
    const protectedSiteImageCandidate = routed?.kind === "image_metadata";
    const protectedSiteOcrEnabled = protectedSiteImageCandidate ? await getProtectedSiteOcrGate() : false;

    if (
      !file ||
      typeof extractors.prepareFileExtractionAsync !== "function" ||
      typeof scanner.scanTextContent !== "function"
    ) {
      return createEmptyResult("failed", {
        originalName,
        mimeType,
        sizeBytes,
        fallbackReason: "content_file_pipeline_unavailable"
      });
    }

    if (protectedSiteImageCandidate && !protectedSiteOcrEnabled) {
      return createImageBlockedResult("protected_site_image_ocr_disabled", {
        originalName,
        mimeType,
        sizeBytes,
        extractedKind: "image_metadata",
        warnings: ["image-redaction:protected_site_image_ocr_disabled"]
      });
    }

    if (!skipSessionCache && typeof sessionCache.get === "function") {
      const cached = sessionCache.get(file);
      if (cached?.status === "ready" && cached.safeForUpload === true) {
        let sanitizedFile = null;
        if (cached.outputKind === "redacted_pdf_file" && cached.extractedKind === "pdf") {
          const pdfRedactor = getPdfRedactor();
          const redactedPdf = pdfRedactor.createRedactedPdfFromText?.({
            originalName,
            text: cached.sanitizedText
          });
          if (redactedPdf?.ok && redactedPdf.bytes && redactedPdf.truncated !== true) {
            sanitizedFile = createBinaryFile(
              redactedPdf.bytes,
              cached.outputName,
              redactedPdf.mimeType || "application/pdf"
            );
          }
        } else {
          sanitizedFile = createTextFile(
            String(cached.sanitizedText || ""),
            cached.outputName,
            cached.outputKind === "redacted_text_file" ? "text/plain" : mimeType || "text/plain"
          );
        }
        if (sanitizedFile) {
          return {
            ...cached,
            originalName,
            sanitizedFile,
            metadata: {
              ...(cached.metadata || {}),
              original: {
                ...((cached.metadata || {}).original || {}),
                type: mimeType,
                size: sizeBytes
              },
              cache: {
                status: "hit"
              }
            }
          };
        }
      }
    }

    let buffer;
    try {
      buffer = await readFileBuffer(file);
    } catch {
      return createEmptyResult("failed", {
        originalName,
        mimeType,
        sizeBytes,
        fallbackReason: "file_read_failed"
      });
    }

    let text = "";
    if (routed?.kind === "text") {
      try {
        text = await readFileText(file, buffer);
      } catch {
        return createEmptyResult("blocked", {
          originalName,
          mimeType,
          sizeBytes,
          fallbackReason: "invalid_utf8"
        });
      }
    }

    const extraction = await extractors.prepareFileExtractionAsync({
      fileName: originalName,
      mimeType,
      sizeBytes,
      buffer,
      text
    });
    let extractedKind = extraction?.kind || routed?.kind || "";
    let extractedText = String(extraction?.text || "");
    let extractionMetadata = extraction?.metadata || {
      fileName: originalName,
      mimeType,
      sizeBytes
    };
    let extractionWarnings = extraction?.warnings;
    let protectedSiteImageOcrExtraction = null;

    if (!extraction?.safeForScan) {
      const status = extraction?.status === "unsupported" ? "unsupported" : "blocked";
      return createEmptyResult(status, {
        originalName,
        mimeType,
        sizeBytes,
        extractedKind,
        extractionMetadata,
        warnings: extraction?.warnings,
        fallbackReason: extraction?.reason || extraction?.status || "file_extraction_failed"
      });
    }

    if (protectedSiteOcrEnabled && extractedKind === "image_metadata") {
      const ocrExtraction = await runProtectedSiteImageOcr(file, extraction, options);
      if (!ocrExtraction.ok) {
        return createEmptyResult("blocked", {
          originalName,
          mimeType,
          sizeBytes,
          extractedKind: "image_ocr",
          extractionMetadata,
          warnings: ocrExtraction.warnings,
          fallbackReason: ocrExtraction.status || "ocr_failed"
        });
      }
      extractedKind = ocrExtraction.kind;
      extractedText = ocrExtraction.text;
      extractionMetadata = ocrExtraction.metadata;
      extractionWarnings = ocrExtraction.warnings;
      protectedSiteImageOcrExtraction = ocrExtraction;
    }

    const scan = scanner.scanTextContent({
      fileName: originalName,
      mimeType,
      sizeBytes: Number(extractionMetadata?.textLength || sizeBytes),
      text: extractedText,
      extractedText: extractedKind !== "text",
      mode: options.mode || "hide_public"
    });
    const sanitizedText = String(scan.redactedText || "");

    if (extractedKind === "pdf") {
      const pdfRedactor = getPdfRedactor();
      if (typeof pdfRedactor.createRedactedPdfFromExtraction === "function") {
        const redactedPdf = pdfRedactor.createRedactedPdfFromExtraction({
          originalName,
          extraction,
          sanitizedText
        });
        if (redactedPdf?.ok && redactedPdf.bytes && redactedPdf.truncated !== true) {
          const outputName = redactedPdf.fileName || `${splitFileName(originalName).base}.redacted.pdf`;
          const sanitizedFile = createBinaryFile(
            redactedPdf.bytes,
            outputName,
            redactedPdf.mimeType || "application/pdf"
          );
          if (sanitizedFile) {
            const result = {
              status: "ready",
              originalName,
              outputName,
              outputKind: "redacted_pdf_file",
              extractedKind,
              sanitizedText,
              sanitizedFile,
              metadata: {
                original: {
                  name: normalizeFileName(scan.file?.name || originalName),
                  type: mimeType,
                  size: sizeBytes
                },
                extraction: sanitizeExtractionMetadata(extractionMetadata),
                scan: {
                  findingsCount: Number(scan.summary?.findingsCount || 0),
                  changed: scan.summary?.changed === true,
                  redactedLength: sanitizedText.length
                },
                pdfRedaction: {
                  output: "pdf",
                  source: "sanitized_text",
                  truncated: false
                },
                cache: {
                  status: "miss"
                }
              },
              warnings: listWarnings(extractionWarnings, scan.reportWarnings),
              safeForUpload: true,
              fallbackReason: ""
            };
            if (!skipSessionCache && typeof sessionCache.set === "function") {
              sessionCache.set(file, result);
            }
            return result;
          }
          extractionWarnings = listWarnings(extractionWarnings, ["pdf-redaction:pdf_redacted_file_create_failed"]);
        } else if (redactedPdf?.truncated === true) {
          extractionWarnings = listWarnings(extractionWarnings, ["pdf-redaction:pdf_redacted_text_truncated"]);
        } else if (redactedPdf?.status) {
          extractionWarnings = listWarnings(extractionWarnings, [`pdf-redaction:${redactedPdf.status}`]);
        }
      } else {
        extractionWarnings = listWarnings(extractionWarnings, ["pdf-redaction:pdf_redactor_unavailable"]);
      }
    }

    if (extractedKind === "docx") {
      const docxRedactor = getDocxRedactor();
      if (typeof docxRedactor.createRedactedDocxFromText === "function") {
        const redactedDocx = await docxRedactor.createRedactedDocxFromText({
          originalName,
          originalBytes: buffer,
          text: sanitizedText
        });
        if (redactedDocx?.ok && redactedDocx.bytes && redactedDocx.truncated !== true) {
          const outputName = redactedDocx.fileName || `${splitFileName(originalName).base}.redacted.docx`;
          const sanitizedFile = createBinaryFile(
            redactedDocx.bytes,
            outputName,
            redactedDocx.mimeType || "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          );
          if (sanitizedFile) {
            const result = {
              status: "ready",
              originalName,
              outputName,
              outputKind: "redacted_docx_file",
              extractedKind,
              sanitizedText,
              sanitizedFile,
              metadata: {
                original: {
                  name: normalizeFileName(scan.file?.name || originalName),
                  type: mimeType,
                  size: sizeBytes
                },
                extraction: sanitizeExtractionMetadata(extractionMetadata),
                scan: {
                  findingsCount: Number(scan.summary?.findingsCount || 0),
                  changed: scan.summary?.changed === true,
                  redactedLength: sanitizedText.length
                },
                docxRedaction: {
                  output: "docx",
                  source: "sanitized_text",
                  truncated: false
                },
                cache: {
                  status: "miss"
                }
              },
              warnings: listWarnings(extractionWarnings, scan.reportWarnings),
              safeForUpload: true,
              fallbackReason: ""
            };
            return result;
          }
          extractionWarnings = listWarnings(extractionWarnings, ["docx-redaction:docx_redacted_file_create_failed"]);
        } else if (redactedDocx?.truncated === true) {
          extractionWarnings = listWarnings(extractionWarnings, ["docx-redaction:docx_redacted_text_truncated"]);
        } else if (redactedDocx?.status) {
          extractionWarnings = listWarnings(extractionWarnings, [`docx-redaction:${redactedDocx.status}`]);
        }
      } else {
        extractionWarnings = listWarnings(extractionWarnings, ["docx-redaction:docx_redactor_unavailable"]);
      }
    }

    if (extractedKind === "xlsx") {
      const xlsxRedactor = getXlsxRedactor();
      if (typeof xlsxRedactor.createRedactedXlsxFromExtraction === "function") {
        const redactedXlsx = xlsxRedactor.createRedactedXlsxFromExtraction({
          originalName,
          extraction,
          sanitizedText
        });
        if (redactedXlsx?.ok && redactedXlsx.bytes && redactedXlsx.truncated !== true) {
          const outputName = redactedXlsx.fileName || `${splitFileName(originalName).base}.redacted.xlsx`;
          const sanitizedFile = createBinaryFile(
            redactedXlsx.bytes,
            outputName,
            redactedXlsx.mimeType || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          );
          if (sanitizedFile) {
            return {
              status: "ready",
              originalName,
              outputName,
              outputKind: "redacted_xlsx_file",
              extractedKind,
              sanitizedText,
              sanitizedFile,
              metadata: {
                original: {
                  name: normalizeFileName(scan.file?.name || originalName),
                  type: mimeType,
                  size: sizeBytes
                },
                extraction: sanitizeExtractionMetadata(extractionMetadata),
                scan: {
                  findingsCount: Number(scan.summary?.findingsCount || 0),
                  changed: scan.summary?.changed === true,
                  redactedLength: sanitizedText.length
                },
                xlsxRedaction: {
                  output: "xlsx",
                  source: "sanitized_text",
                  truncated: false
                },
                cache: {
                  status: "miss"
                }
              },
              warnings: listWarnings(extractionWarnings, scan.reportWarnings),
              safeForUpload: true,
              fallbackReason: ""
            };
          }
          extractionWarnings = listWarnings(extractionWarnings, ["xlsx-redaction:xlsx_redacted_file_create_failed"]);
        } else if (redactedXlsx?.truncated === true) {
          extractionWarnings = listWarnings(extractionWarnings, ["xlsx-redaction:xlsx_redacted_text_truncated"]);
        } else if (redactedXlsx?.status) {
          extractionWarnings = listWarnings(extractionWarnings, [`xlsx-redaction:${redactedXlsx.status}`]);
        }
      } else {
        extractionWarnings = listWarnings(extractionWarnings, ["xlsx-redaction:xlsx_redactor_unavailable"]);
      }
    }

    if (
      protectedSiteOcrEnabled &&
      protectedSiteImageOcrExtraction &&
      extractedKind === "image_ocr"
    ) {
      const redactedImage = await createProtectedSiteRedactedImage({
        imageBytes: buffer,
        ocrExtraction: protectedSiteImageOcrExtraction,
        scan,
        originalName,
        mimeType
      });

      if (!redactedImage.ok) {
        return createImageBlockedResult(redactedImage.status || "image_redaction_failed", {
          originalName,
          mimeType,
          sizeBytes,
          extractedKind,
          extractionMetadata,
          warnings: redactedImage.warnings
        });
      }

      return {
        status: "ready",
        originalName,
        outputName: redactedImage.outputName,
        outputKind: redactedImage.outputKind,
        extractedKind,
        sanitizedText,
        sanitizedFile: redactedImage.sanitizedFile,
        sanitizedImageFile: redactedImage.sanitizedImageFile || redactedImage.sanitizedFile,
        fileOnlyUpload: true,
        skipTextFallback: true,
        metadata: {
          original: {
            name: normalizeFileName(scan.file?.name || originalName),
            type: mimeType,
            size: sizeBytes
          },
          extraction: sanitizeExtractionMetadata(extractionMetadata),
          scan: {
            findingsCount: Number(scan.summary?.findingsCount || 0),
            changed: scan.summary?.changed === true,
            redactedLength: sanitizedText.length
          },
          visualRedaction: {
            output: "png",
            boxKind: redactedImage.boxKind || "",
            protectedSiteEligible: true
          },
          cache: {
            status: "miss"
          }
        },
        warnings: listWarnings(extractionWarnings, scan.reportWarnings, redactedImage.warnings),
        safeForUpload: true,
        fallbackReason: ""
      };
    }

    if (isImageExtractionKind(extractedKind)) {
      return createImageBlockedResult("image_redaction_file_unavailable", {
        originalName,
        mimeType,
        sizeBytes,
        extractedKind,
        extractionMetadata,
        warnings: extractionWarnings
      });
    }

    const outputName = EXTRACTED_TEXT_OUTPUT_KINDS.has(extractedKind)
      ? buildRedactedTxtName(scan.file?.name || originalName)
      : normalizeFileName(scan.file?.name || originalName);
    const outputKind = EXTRACTED_TEXT_OUTPUT_KINDS.has(extractedKind)
      ? "redacted_text_file"
      : "sanitized_text_file";
    const outputMimeType = outputKind === "redacted_text_file"
      ? "text/plain"
      : mimeType || "text/plain";
    const sanitizedFile = createTextFile(sanitizedText, outputName, outputMimeType);

    if (!sanitizedFile) {
      return createEmptyResult("failed", {
        originalName,
        mimeType,
        sizeBytes,
        extractedKind,
        outputName,
        outputKind,
        extractionMetadata,
        warnings: extractionWarnings,
        fallbackReason: "sanitized_file_create_failed"
      });
    }

    const result = {
      status: "ready",
      originalName,
      outputName,
      outputKind,
      extractedKind,
      sanitizedText,
      sanitizedFile,
      metadata: {
        original: {
          name: normalizeFileName(scan.file?.name || originalName),
          type: mimeType,
          size: sizeBytes
        },
        extraction: sanitizeExtractionMetadata(extractionMetadata),
        scan: {
          findingsCount: Number(scan.summary?.findingsCount || 0),
          changed: scan.summary?.changed === true,
          redactedLength: sanitizedText.length
        }
      },
      warnings: listWarnings(extractionWarnings, scan.reportWarnings),
      safeForUpload: true,
      fallbackReason: ""
    };

    result.metadata.cache = {
      status: "miss"
    };
    if (!skipSessionCache && typeof sessionCache.set === "function") {
      sessionCache.set(file, result);
    }
    return result;
  }

  root.PWM.ContentFileExtractionPipeline = {
    canExtractForAdapterHandoff,
    getProtectedSiteOcrGate,
    runProtectedSiteImageOcr,
    processFileForAdapterHandoff
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.ContentFileExtractionPipeline;
  }
})();
