(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function safeFileExtensionFromName(value) {
    const name = String(value || "").split(/[\\/]/).pop() || "";
    const match = /\.([a-z0-9]{1,12})$/i.exec(name);
    return match ? match[1].toLowerCase() : "";
  }

  function safeMimeType(value) {
    const type = String(value || "").split(";")[0].trim().toLowerCase();
    return /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(type) ? type : "";
  }

  function safeDebugFileName(file) {
    const extension = safeFileExtensionFromName(file?.name);
    return extension ? `file.${extension}` : "file";
  }

  function describeFileForDebug(file) {
    if (!file) return null;
    return {
      name: safeDebugFileName(file),
      type: safeMimeType(file.type),
      size: Number(file.size || 0)
    };
  }

  function originalFileMetadataFromLocalFile(localFile) {
    const file = localFile?.file || localFile || null;
    return {
      name: safeDebugFileName(file),
      type: safeMimeType(file?.type),
      size: Number(file?.size ?? file?.sizeBytes ?? 0),
      lastModified: Number(file?.lastModified || 0)
    };
  }

  function sanitizeDownloadFileNameSegment(value, fallback = "sanitized-file.txt") {
    const unsafePathChars = new RegExp('[\\\\/:*?"<>|\\u0000-\\u001f]+', "g");
    const normalized = String(value || fallback)
      .replace(unsafePathChars, "-")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^\.+|\.+$/g, "");
    return normalized || fallback;
  }

  root.PWM.SafeSnapshots = {
    describeFileForDebug,
    originalFileMetadataFromLocalFile,
    sanitizeDownloadFileNameSegment
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.SafeSnapshots;
  }
})();
