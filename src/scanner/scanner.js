(function () {
  const scanner = globalThis.PWM?.FileScanner;

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
  const downloadReportBtn = document.getElementById("download-report-btn");

  let selectedFile = null;
  let currentScanResult = null;

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
        message: "This release scans text files up to 50 MB. Choose a smaller file or split it before scanning."
      };
    }

    if (!scanner.isSupportedTextFile(file.name, file.type)) {
      return {
        ok: false,
        message: scanner.UNSUPPORTED_TEXT_RELEASE_MESSAGE
      };
    }

    return { ok: true };
  }

  async function scanSelectedFile() {
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

    const text = scanner.decodeUtf8Text(buffer);
    const result = scanner.scanTextContent({
      fileName: selectedFile.name,
      mimeType: selectedFile.type,
      sizeBytes: selectedFile.size,
      text,
      mode: "hide_public"
    });

    renderResult(result);
    setStatus("Scan complete. Exports are generated only when you click a download button.", "success");
    scanBtn.disabled = false;
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

  fileInput.addEventListener("change", () => {
    selectedFile = fileInput.files?.[0] || null;
    currentScanResult = null;
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
  downloadReportBtn.addEventListener("click", downloadReport);

  clearScan();
})();
