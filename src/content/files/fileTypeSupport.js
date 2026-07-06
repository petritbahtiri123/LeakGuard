(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  const SUPPORTED_IMAGE_REDACTION_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
  const SUPPORTED_IMAGE_REDACTION_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
  const SUPPORTED_WHATSAPP_PDF_ATTACH_EXTENSIONS = new Set([".pdf"]);
  const SUPPORTED_WHATSAPP_PDF_ATTACH_MIME_TYPES = new Set(["application/pdf"]);
  const SUPPORTED_WHATSAPP_DOCX_ATTACH_EXTENSIONS = new Set([".docx"]);
  const SUPPORTED_WHATSAPP_DOCX_ATTACH_MIME_TYPES = new Set([
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ]);
  const SUPPORTED_WHATSAPP_XLSX_ATTACH_EXTENSIONS = new Set([".xlsx"]);
  const SUPPORTED_WHATSAPP_XLSX_ATTACH_MIME_TYPES = new Set([
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ]);

  function getFallbackFileExtension(file) {
    const name = String(file?.name || "").split(/[\\/]/).pop().toLowerCase();
    const index = name.lastIndexOf(".");
    if (index <= 0 || index === name.length - 1) return "";
    return name.slice(index);
  }

  function getFallbackMimeType(file) {
    return String(file?.type || "").split(";")[0].trim().toLowerCase();
  }

  function createContentFileTypeSupport(options = {}) {
    const fileScanner = options.fileScanner || {};
    const fileTypeRegistry = options.fileTypeRegistry || {};
    const shouldUseContentFileExtractionPipeline =
      typeof options.shouldUseContentFileExtractionPipeline === "function"
        ? options.shouldUseContentFileExtractionPipeline
        : () => false;
    const getLocalFileExtension =
      typeof options.getLocalFileExtension === "function"
        ? options.getLocalFileExtension
        : (file) => {
            if (typeof fileScanner.getFileExtension === "function") {
              return String(fileScanner.getFileExtension(file?.name || "") || "").toLowerCase();
            }
            return getFallbackFileExtension(file);
          };
    const getLocalFileMimeType =
      typeof options.getLocalFileMimeType === "function"
        ? options.getLocalFileMimeType
        : getFallbackMimeType;
    const dataTransferHasFiles =
      typeof options.dataTransferHasFiles === "function" ? options.dataTransferHasFiles : null;
    const listLocalTransferFiles =
      typeof options.listLocalTransferFiles === "function"
        ? options.listLocalTransferFiles
        : (dataTransfer) => Array.from(dataTransfer?.files || []).filter(Boolean);
    const maxWhatsAppMultiFileAttachments = Math.max(
      0,
      Number(options.maxWhatsAppMultiFileAttachments || 0) || 0
    );

    function hasTransferFiles(dataTransfer) {
      return typeof dataTransferHasFiles === "function" && dataTransferHasFiles(dataTransfer);
    }

    function isSupportedWhatsAppAttachImageFile(file) {
      if (!file || !shouldUseContentFileExtractionPipeline(file)) return false;
      return (
        SUPPORTED_IMAGE_REDACTION_EXTENSIONS.has(getLocalFileExtension(file)) &&
        SUPPORTED_IMAGE_REDACTION_MIME_TYPES.has(getLocalFileMimeType(file))
      );
    }

    function isSupportedWhatsAppTextDocumentAttachFile(file) {
      if (!file) return false;
      if (typeof fileTypeRegistry.classifyFileType === "function") {
        const classification = fileTypeRegistry.classifyFileType({
          fileName: file.name,
          mimeType: file.type
        });
        if (
          classification?.status !== fileTypeRegistry.FILE_TYPE_STATUS?.SUPPORTED ||
          classification?.family !== "text"
        ) {
          return false;
        }
        return (
          typeof fileScanner.isSupportedTextFile !== "function" ||
          fileScanner.isSupportedTextFile(file.name, file.type)
        );
      }
      return (
        typeof fileScanner.isSupportedTextFile === "function" &&
        fileScanner.isSupportedTextFile(file.name, file.type)
      );
    }

    function isSupportedWhatsAppPdfAttachFile(file) {
      if (!file || !shouldUseContentFileExtractionPipeline(file)) return false;
      return (
        SUPPORTED_WHATSAPP_PDF_ATTACH_EXTENSIONS.has(getLocalFileExtension(file)) &&
        SUPPORTED_WHATSAPP_PDF_ATTACH_MIME_TYPES.has(getLocalFileMimeType(file))
      );
    }

    function isSupportedWhatsAppDocxAttachFile(file) {
      if (!file || !shouldUseContentFileExtractionPipeline(file)) return false;
      return (
        SUPPORTED_WHATSAPP_DOCX_ATTACH_EXTENSIONS.has(getLocalFileExtension(file)) &&
        SUPPORTED_WHATSAPP_DOCX_ATTACH_MIME_TYPES.has(getLocalFileMimeType(file))
      );
    }

    function isSupportedWhatsAppXlsxAttachFile(file) {
      if (!file || !shouldUseContentFileExtractionPipeline(file)) return false;
      return (
        SUPPORTED_WHATSAPP_XLSX_ATTACH_EXTENSIONS.has(getLocalFileExtension(file)) &&
        SUPPORTED_WHATSAPP_XLSX_ATTACH_MIME_TYPES.has(getLocalFileMimeType(file))
      );
    }

    function isSupportedWhatsAppMultiFileAttachFile(file) {
      return Boolean(
        isSupportedWhatsAppAttachImageFile(file) ||
          isSupportedWhatsAppTextDocumentAttachFile(file) ||
          isSupportedWhatsAppPdfAttachFile(file) ||
          isSupportedWhatsAppDocxAttachFile(file) ||
          isSupportedWhatsAppXlsxAttachFile(file)
      );
    }

    function isSingleSupportedWhatsAppFileAttach(dataTransfer, predicate) {
      if (!hasTransferFiles(dataTransfer) || typeof predicate !== "function") return false;
      const files = listLocalTransferFiles(dataTransfer);
      return files.length === 1 && predicate(files[0]);
    }

    function isSupportedWhatsAppMultiFileAttach(dataTransfer) {
      if (!hasTransferFiles(dataTransfer)) return false;
      const files = listLocalTransferFiles(dataTransfer);
      return (
        files.length >= 2 &&
        files.length <= maxWhatsAppMultiFileAttachments &&
        files.every(isSupportedWhatsAppMultiFileAttachFile)
      );
    }

    return Object.freeze({
      isSupportedWhatsAppAttachImageFile,
      isSupportedWhatsAppTextDocumentAttachFile,
      isSupportedWhatsAppPdfAttachFile,
      isSupportedWhatsAppDocxAttachFile,
      isSupportedWhatsAppXlsxAttachFile,
      isSupportedWhatsAppMultiFileAttachFile,
      isSingleSupportedWhatsAppFileAttach,
      isSupportedWhatsAppMultiFileAttach
    });
  }

  root.PWM.ContentFileTypeSupport = Object.freeze({
    createContentFileTypeSupport
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.ContentFileTypeSupport;
  }
})();
