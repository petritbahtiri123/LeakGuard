(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  const FILE_TYPE_STATUS = Object.freeze({
    SUPPORTED: "supported",
    PLANNED_UNSUPPORTED: "planned_unsupported",
    UNSUPPORTED: "unsupported"
  });

  const SUPPORTED_TEXT_EXTENSIONS = new Set([
    ".txt",
    ".md",
    ".markdown",
    ".env",
    ".log",
    ".json",
    ".yaml",
    ".yml",
    ".pem",
    ".key",
    ".toml",
    ".xml",
    ".csv",
    ".ini",
    ".conf",
    ".cfg",
    ".ps1",
    ".sh",
    ".bash",
    ".zsh",
    ".bat",
    ".cmd",
    ".py",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".html",
    ".css",
    ".scss",
    ".java",
    ".c",
    ".cpp",
    ".h",
    ".hpp",
    ".cs",
    ".go",
    ".rs",
    ".rb",
    ".php",
    ".sql"
  ]);
  const SUPPORTED_TEXT_BASENAMES = new Set(["dockerfile", "makefile"]);
  const PLANNED_DOCUMENT_EXTENSIONS = new Set([".pdf", ".docx", ".xlsx"]);
  const PLANNED_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
  const KNOWN_UNSUPPORTED_EXTENSIONS = new Set([
    ".doc",
    ".xls",
    ".ppt",
    ".pptx",
    ".gif",
    ".bmp",
    ".ico",
    ".svg",
    ".zip",
    ".7z",
    ".rar",
    ".tar",
    ".gz",
    ".tgz",
    ".bz2",
    ".xz",
    ".exe",
    ".dll",
    ".dmg",
    ".pkg",
    ".app",
    ".msi",
    ".bin"
  ]);

  function normalizeFileName(fileName) {
    return String(fileName || "").split(/[\\/]/).pop() || "";
  }

  function getFileExtension(fileName) {
    const name = normalizeFileName(fileName).toLowerCase();
    if (!name) return "";
    if (name === ".env") return ".env";

    const index = name.lastIndexOf(".");
    if (index <= 0 || index === name.length - 1) return "";
    return name.slice(index);
  }

  function getFileBasename(fileName) {
    return normalizeFileName(fileName).toLowerCase();
  }

  function normalizeMimeType(mimeType) {
    return String(mimeType || "").split(";")[0].trim().toLowerCase();
  }

  function supportedResult({ extension, mimeType, fallbackNamePattern = "" }) {
    return {
      status: FILE_TYPE_STATUS.SUPPORTED,
      kind: "text",
      family: "text",
      action: "scan",
      supported: true,
      extension,
      mimeType,
      fallbackNamePattern
    };
  }

  function plannedUnsupportedResult({ extension, mimeType, family }) {
    return {
      status: FILE_TYPE_STATUS.PLANNED_UNSUPPORTED,
      kind: "planned_unsupported",
      family,
      action: "allow",
      supported: false,
      extension,
      mimeType,
      planned: true
    };
  }

  function unsupportedResult({ extension, mimeType }) {
    return {
      status: FILE_TYPE_STATUS.UNSUPPORTED,
      kind: "unsupported",
      family: "unknown",
      action: "allow",
      supported: false,
      extension,
      mimeType
    };
  }

  function classifyFileType({ fileName, mimeType } = {}) {
    const extension = getFileExtension(fileName);
    const normalizedMimeType = normalizeMimeType(mimeType);
    const basename = getFileBasename(fileName);

    if (SUPPORTED_TEXT_BASENAMES.has(basename)) {
      return supportedResult({
        extension,
        mimeType: normalizedMimeType,
        fallbackNamePattern: basename
      });
    }

    if (SUPPORTED_TEXT_EXTENSIONS.has(extension)) {
      return supportedResult({ extension, mimeType: normalizedMimeType });
    }

    if (PLANNED_DOCUMENT_EXTENSIONS.has(extension)) {
      return plannedUnsupportedResult({ extension, mimeType: normalizedMimeType, family: "document" });
    }

    if (PLANNED_IMAGE_EXTENSIONS.has(extension)) {
      return plannedUnsupportedResult({ extension, mimeType: normalizedMimeType, family: "image" });
    }

    return unsupportedResult({ extension, mimeType: normalizedMimeType });
  }

  function isSupportedTextFileType(fileInfo) {
    return classifyFileType(fileInfo).status === FILE_TYPE_STATUS.SUPPORTED;
  }

  function isPlannedUnsupportedFileType(fileInfo) {
    return classifyFileType(fileInfo).status === FILE_TYPE_STATUS.PLANNED_UNSUPPORTED;
  }

  root.PWM.FileTypeRegistry = {
    FILE_TYPE_STATUS,
    SUPPORTED_TEXT_EXTENSIONS,
    SUPPORTED_TEXT_BASENAMES,
    PLANNED_DOCUMENT_EXTENSIONS,
    PLANNED_IMAGE_EXTENSIONS,
    KNOWN_UNSUPPORTED_EXTENSIONS,
    normalizeFileName,
    getFileExtension,
    getFileBasename,
    normalizeMimeType,
    classifyFileType,
    isSupportedTextFileType,
    isPlannedUnsupportedFileType
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.FileTypeRegistry;
  }
})();
