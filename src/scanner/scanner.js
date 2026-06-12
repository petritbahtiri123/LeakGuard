(function () {
  const scanner = globalThis.PWM?.FileScanner;
  const extractors = globalThis.PWM?.FileExtractors;
  const scannerOcr = globalThis.PWM?.ScannerOcr;
  const imageRedactor = globalThis.PWM?.ImageRedactor;

  if (!scanner) {
    throw new Error("LeakGuard File Scanner failed to initialize.");
  }

  const fileInput = document.getElementById("file-input");
  const fileMetaEl = document.getElementById("file-meta");
  const fileNameEl = document.getElementById("file-name");
  const fileTypeEl = document.getElementById("file-type");
  const fileSizeEl = document.getElementById("file-size");
  const statusEl = document.getElementById("status");
  const scanBtn = document.getElementById("scan-btn");
  const clearBtn = document.getElementById("clear-btn");
  const resultPanel = document.getElementById("result-panel");
  const resultTitleEl = document.getElementById("result-title");
  const summaryPillsEl = document.getElementById("summary-pills");
  const findingCountEl = document.getElementById("finding-count");
  const highCountEl = document.getElementById("high-count");
  const mediumCountEl = document.getElementById("medium-count");
  const lowCountEl = document.getElementById("low-count");
  const findingsListEl = document.getElementById("findings-list");
  const redactedPreviewEl = document.getElementById("redacted-preview");
  const downloadRedactedBtn = document.getElementById("download-redacted-btn");
  const downloadRedactedImageBtn = document.getElementById("download-redacted-image-btn");
  const downloadReportBtn = document.getElementById("download-report-btn");

  let selectedFile = null;
  let currentScanResult = null;
  let currentRedactedImage = null;
  let scanInFlight = null;

  function formatBytes(bytes) {
    const value = Number(bytes || 0);
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
    return `${(value / (1024 * 1024)).toFixed(2)} MiB`;
  }

  function setStatus(message, kind = "") {
    statusEl.textContent = message || "";
    statusEl.dataset.kind = kind;
  }

  function setExportEnabled(enabled) {
    downloadRedactedBtn.disabled = !enabled;
    downloadReportBtn.disabled = !enabled;
    downloadRedactedImageBtn.disabled = !enabled || !currentRedactedImage?.blob;
    downloadRedactedImageBtn.hidden = !currentRedactedImage?.blob;
  }

  function clearNode(node) {
    node.textContent = "";
  }

  function renderFileMeta(file) {
    if (!file) {
      fileMetaEl.hidden = true;
      fileNameEl.textContent = "";
      fileTypeEl.textContent = "";
      fileSizeEl.textContent = "";
      return;
    }

    fileMetaEl.hidden = false;
    fileNameEl.textContent = file.name || "Unnamed file";
    fileTypeEl.textContent = file.type || "Unknown";
    fileSizeEl.textContent = formatBytes(file.size);
  }

  function makePill(text) {
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = text;
    return pill;
  }

  function renderSummaryPills(result) {
    clearNode(summaryPillsEl);
    const categories = Object.entries(result.summary.categories || {});

    if (!categories.length) {
      summaryPillsEl.appendChild(makePill("No findings"));
      return;
    }

    categories.forEach(([category, count]) => {
      summaryPillsEl.appendChild(makePill(`${category}: ${count}`));
    });
  }

  function renderFinding(finding) {
    const item = document.createElement("article");
    item.className = "finding";

    const head = document.createElement("div");
    head.className = "finding-head";

    const title = document.createElement("span");
    title.className = "finding-title";
    title.textContent = finding.type || "SECRET";

    head.append(
      title,
      makePill(finding.severity || "high"),
      makePill(finding.category || "credential"),
      makePill(finding.placeholder || "[REDACTED]")
    );

    const meta = document.createElement("p");
    meta.className = "finding-meta";
    meta.textContent = `Line ${finding.line}, column ${finding.column}`;

    const preview = document.createElement("pre");
    preview.className = "finding-preview";
    preview.textContent = finding.preview || "";

    item.append(head, meta, preview);
    return item;
  }

  function renderFindings(result) {
    clearNode(findingsListEl);

    if (!result.findings.length) {
      const empty = document.createElement("p");
      empty.className = "finding-meta";
      empty.textContent = "No secrets or public network values were detected.";
      findingsListEl.appendChild(empty);
      return;
    }

    result.findings.forEach((finding) => {
      findingsListEl.appendChild(renderFinding(finding));
    });
  }

  function renderResult(result) {
    currentScanResult = result;
    resultPanel.hidden = false;
    resultTitleEl.textContent = result.file.name || "Scanned file";
    findingCountEl.textContent = String(result.summary.findingsCount);
    highCountEl.textContent = String(result.summary.highCount);
    mediumCountEl.textContent = String(result.summary.mediumCount);
    lowCountEl.textContent = String(result.summary.lowCount);
    redactedPreviewEl.textContent = result.redactedPreview || "";
    renderSummaryPills(result);
    renderFindings(result);
    setExportEnabled(true);
  }

  function clearScan() {
    selectedFile = null;
    currentScanResult = null;
    currentRedactedImage = null;
    fileInput.value = "";
    scanBtn.disabled = true;
    resultPanel.hidden = true;
    renderFileMeta(null);
    clearNode(summaryPillsEl);
    clearNode(findingsListEl);
    redactedPreviewEl.textContent = "";
    setExportEnabled(false);
    setStatus("");
  }

  function validateSelectedFile(file) {
    if (!file) {
      return { ok: false, message: "Choose a local text file to scan." };
    }

    if (file.size > scanner.MAX_TEXT_FILE_SIZE_BYTES) {
      return {
        ok: false,
        message:
          scanner.LARGE_TEXT_STREAMING_BLOCK_MESSAGE ||
          "File too large for local redaction. Choose a smaller file or split it before scanning."
      };
    }

    const routedExtraction = extractors?.routeFileExtractor?.({
      fileName: file.name,
      mimeType: file.type
    });

    if (routedExtraction?.kind === "image_metadata" && scannerOcr?.validateScannerOcrImage) {
      const imageValidation = scannerOcr.validateScannerOcrImage({
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size
      });
      if (!imageValidation.ok) {
        return {
          ok: false,
          message: imageValidation.message
        };
      }
    }

    if (!scanner.isSupportedTextFile(file.name, file.type) && !isExtractedFile(routedExtraction)) {
      return {
        ok: false,
        message: scanner.UNSUPPORTED_TEXT_RELEASE_MESSAGE
      };
    }

    return { ok: true };
  }

  function isExtractedFile(extraction) {
    return (
      extraction?.kind === "pdf" ||
      extraction?.kind === "docx" ||
      extraction?.kind === "xlsx" ||
      extraction?.kind === "image_metadata"
    );
  }

  function formatExtractionFailureMessage(extraction) {
    if (!isExtractedFile(extraction)) {
      return extraction?.reason || "LeakGuard could not extract text from this file, so it was not scanned.";
    }

    const reason = extraction.reason || "";
    if (extraction.kind === "docx") {
      if (reason === "docx_encrypted") {
        return "LeakGuard could not scan this encrypted DOCX. Save an unencrypted text DOCX and try again.";
      }
      if (reason === "docx_malformed_zip" || reason === "docx_unsupported_compression") {
        return "LeakGuard could not read this DOCX, so it was not scanned.";
      }
      if (reason === "docx_text_too_large") {
        return "LeakGuard extracted too much DOCX text to scan safely in this release. Split the document and try again.";
      }
      return "LeakGuard could not find extractable text in this DOCX. Embedded images, macros, and OCR are not supported in this release.";
    }

    if (extraction.kind === "xlsx") {
      if (reason === "xlsx_encrypted") {
        return "LeakGuard could not scan this encrypted XLSX. Save an unencrypted spreadsheet and try again.";
      }
      if (
        reason === "xlsx_malformed_zip" ||
        reason === "xlsx_unsupported_compression" ||
        reason === "xlsx_xml_too_large" ||
        reason === "xlsx_too_many_zip_entries"
      ) {
        return "LeakGuard could not read this XLSX, so it was not scanned.";
      }
      if (reason === "xlsx_text_too_large") {
        return "LeakGuard extracted too much XLSX text to scan safely in this release. Split the spreadsheet and try again.";
      }
      return "LeakGuard could not find extractable spreadsheet text in this XLSX. Macros, legacy XLS, XLSM, images, embedded media, and OCR are not supported in this release.";
    }

    if (reason === "pdf_encrypted") {
      return "LeakGuard could not scan this encrypted PDF. Save an unencrypted text PDF and try again.";
    }
    if (reason === "pdf_malformed" || reason === "pdf_read_failed") {
      return "LeakGuard could not read this PDF, so it was not scanned.";
    }
    if (reason === "pdf_text_too_large") {
      return "LeakGuard extracted too much PDF text to scan safely in this release. Split the document and try again.";
    }
    return "LeakGuard could not find extractable text in this PDF. Scanned-image PDFs and OCR are not supported in this release.";
  }

  function scanExtractedText(extraction, text, sizeBytes) {
    return scanner.scanTextContent({
      fileName: selectedFile.name,
      mimeType: selectedFile.type,
      sizeBytes,
      text,
      extractedText: isExtractedFile(extraction),
      mode: "hide_public"
    });
  }

  async function scanImageWithOcr(extraction, imageBuffer) {
    currentRedactedImage = null;
    if (!scannerOcr?.recognizeScannerImageFile || !scannerOcr?.buildScannerOcrScanText) {
      const metadataOnly = scanExtractedText(extraction, extraction.text, extraction.metadata.textLength);
      renderResult(metadataOnly);
      setStatus("Image metadata scanned, but local English OCR is unavailable. Visible text inside the image was not scanned.", "error");
      return;
    }

    setStatus("Scanning image metadata and running local English OCR...", "");
    const ocr = await scannerOcr.recognizeScannerImageFile(selectedFile, {
      runtime: globalThis.PWM?.OcrRuntime,
      readDimensions: true
    });

    if (!ocr.ok) {
      const metadataOnly = scanExtractedText(extraction, extraction.text, extraction.metadata.textLength);
      renderResult(metadataOnly);
      setStatus("Image metadata scanned, but English OCR did not complete. Visible text inside the image was not scanned.", "error");
      return;
    }

    const combinedText = scannerOcr.buildScannerOcrScanText({
      metadataText: extraction.text,
      ocrText: ocr.text,
      ocrMetadata: ocr
    });
    const result = scanExtractedText(extraction, combinedText, combinedText.length);
    if (Array.isArray(ocr.warnings) && ocr.warnings.length) {
      result.reportWarnings.push(...ocr.warnings.map((warning) => `ocr:${warning}`));
    }

    let statusMessage =
      "Scan complete. English OCR ran locally for this image. Redacted text is available.";
    let statusKind = "success";
    if (result.summary.findingsCount > 0) {
      const boxMapping = scannerOcr.redactionBoxesForOcrFindings?.({
        ocr,
        scanResult: result,
        scanText: combinedText,
        ocrText: ocr.text
      });
      if (boxMapping?.ok && imageRedactor?.createRedactedPng) {
        const redactedImage = await imageRedactor.createRedactedPng({
          imageBytes: imageBuffer,
          mimeType: selectedFile.type,
          fileName: selectedFile.name,
          boxes: boxMapping.boxes
        });
        if (redactedImage?.ok && redactedImage.blob) {
          currentRedactedImage = redactedImage;
          statusMessage =
            "Scan complete. English OCR ran locally for this image. Redacted text and a flattened redacted PNG are available.";
        } else {
          result.reportWarnings.push(`image-redaction:${redactedImage?.status || "image_redaction_failed"}`);
          statusMessage =
            "Scan complete. Redacted text is available, but LeakGuard could not generate a visual redacted PNG for this image.";
          statusKind = "error";
        }
      } else {
        result.reportWarnings.push(`image-redaction:${boxMapping?.status || "ocr_boxes_missing"}`);
        statusMessage =
          "Scan complete. Redacted text is available, but OCR did not provide usable boxes for visual image redaction.";
        statusKind = "error";
      }
    }

    renderResult(result);
    setStatus(statusMessage, statusKind);
  }

  function restoreScanControls() {
    if (!selectedFile) {
      scanBtn.disabled = true;
      return;
    }

    scanBtn.disabled = !validateSelectedFile(selectedFile).ok;
  }

  async function runSelectedFileScan() {
    const metadataValidation = validateSelectedFile(selectedFile);
    if (!metadataValidation.ok) {
      setStatus(metadataValidation.message, "error");
      scanBtn.disabled = true;
      return;
    }

    scanBtn.disabled = true;
    setExportEnabled(false);
    setStatus("Scanning locally...", "");

    const buffer = await selectedFile.arrayBuffer();
    const extraction = await extractors.prepareFileExtractionAsync({
      fileName: selectedFile.name,
      mimeType: selectedFile.type,
      sizeBytes: selectedFile.size,
      buffer
    });

    if (!isExtractedFile(extraction)) {
      const validation = scanner.validateFileForTextScan({
        fileName: selectedFile.name,
        mimeType: selectedFile.type,
        sizeBytes: selectedFile.size,
        buffer
      });

      if (!validation.ok) {
        currentScanResult = null;
        resultPanel.hidden = true;
        setStatus(validation.message, "error");
        scanBtn.disabled = false;
        return;
      }
    }

    if (!extraction.safeForScan) {
      currentScanResult = null;
      resultPanel.hidden = true;
      setStatus(formatExtractionFailureMessage(extraction), "error");
      scanBtn.disabled = false;
      return;
    }

    if (extraction.kind === "image_metadata") {
      await scanImageWithOcr(extraction, buffer);
      scanBtn.disabled = false;
      return;
    }

    const extractedFile = isExtractedFile(extraction);
    const text = extractedFile ? extraction.text : scanner.decodeUtf8Text(buffer);
    const result = scanExtractedText(
      extraction,
      text,
      extractedFile ? extraction.metadata.textLength : selectedFile.size
    );
    renderResult(result);
    setStatus("Scan complete. Exports are generated only when you click a download button.", "success");
    scanBtn.disabled = false;
  }

  function scanSelectedFile() {
    if (scanInFlight) {
      return scanInFlight;
    }

    scanInFlight = runSelectedFileScan().finally(() => {
      scanInFlight = null;
      restoreScanControls();
      if (typeof globalThis.PWM?.OcrRuntime?.terminate === "function") {
        globalThis.PWM?.OcrRuntime?.terminate();
      }
    });
    return scanInFlight;
  }

  function splitFileName(fileName) {
    const name = String(fileName || "file");
    const extension = scanner.getFileExtension(name);

    if (!extension) {
      return { base: name || "file", extension: ".txt" };
    }

    const base = name.slice(0, -extension.length).replace(/^\.+/, "") || extension.slice(1) || "file";
    return { base, extension };
  }

  function redactedFileName(fileName) {
    const { base, extension } = splitFileName(fileName);
    if (
      extension === ".pdf" ||
      extension === ".docx" ||
      extension === ".xlsx" ||
      extension === ".png" ||
      extension === ".jpg" ||
      extension === ".jpeg" ||
      extension === ".webp"
    ) {
      return `${base}.redacted.txt`;
    }
    return `${base}.redacted${extension}`;
  }

  function reportFileName(fileName) {
    const { base } = splitFileName(fileName);
    return `${base}.leakguard-report.json`;
  }

  function downloadBlob(content, type, filename) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function downloadExistingBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function downloadRedactedCopy() {
    if (!currentScanResult) return;
    downloadBlob(
      currentScanResult.redactedText || "",
      "text/plain;charset=utf-8",
      redactedFileName(currentScanResult.file.name)
    );
  }

  function downloadReport() {
    if (!currentScanResult) return;
    const report = scanner.buildSanitizedReport(currentScanResult);
    downloadBlob(
      `${JSON.stringify(report, null, 2)}\n`,
      "application/json;charset=utf-8",
      reportFileName(currentScanResult.file.name)
    );
  }

  function downloadRedactedImage() {
    if (!currentRedactedImage?.blob) return;
    downloadExistingBlob(currentRedactedImage.blob, currentRedactedImage.fileName || "image.redacted.png");
  }

  fileInput.addEventListener("change", () => {
    selectedFile = fileInput.files?.[0] || null;
    currentScanResult = null;
    currentRedactedImage = null;
    resultPanel.hidden = true;
    setExportEnabled(false);
    renderFileMeta(selectedFile);

    const validation = validateSelectedFile(selectedFile);
    scanBtn.disabled = !validation.ok;
    setStatus(validation.ok ? "Ready to scan locally." : validation.message, validation.ok ? "" : "error");
  });

  scanBtn.addEventListener("click", () => {
    scanSelectedFile().catch((error) => {
      scanBtn.disabled = false;
      setExportEnabled(Boolean(currentScanResult));
      setStatus(error?.message || "LeakGuard could not scan this file.", "error");
    });
  });

  clearBtn.addEventListener("click", () => {
    clearScan();
  });

  downloadRedactedBtn.addEventListener("click", downloadRedactedCopy);
  downloadRedactedImageBtn.addEventListener("click", downloadRedactedImage);
  downloadReportBtn.addEventListener("click", downloadReport);

  clearScan();
})();
