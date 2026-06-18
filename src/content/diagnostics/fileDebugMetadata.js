(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function normalizeFileDebugString(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9_.:-]+/g, "-")
      .slice(0, 96);
  }

  function normalizeSafeFileDebugEvent(value) {
    const text = String(value || "");
    if (/(?:authorization|bearer|cookie|credential|key|password|raw|secret|token|value|sk-[a-z0-9_-]{12,})/i.test(text)) {
      return "sensitive-event";
    }
    if (/[A-Za-z0-9+/=_-]{24,}/.test(text)) {
      return "sensitive-event";
    }
    if (/[\\/]/.test(text) || /\b[^\s\\/]+\.[A-Za-z0-9]{1,12}\b/.test(text)) {
      return "file-event";
    }
    return normalizeFileDebugString(text);
  }

  function isSafeFileDebugToken(value) {
    const text = String(value || "");
    return Boolean(text) && text.length <= 96 && !/[\\/]/.test(text) && !/[?#@]/.test(text);
  }

  function isSafeFileDebugErrorCode(value) {
    const text = String(value || "");
    return Boolean(text) && text.length <= 48 && /^[A-Z0-9_:-]+$/i.test(text);
  }

  function getFileDebugExtension(fileMeta) {
    const rawName = String(fileMeta?.name || "");
    if (!isSafeFileDebugToken(rawName) || rawName.includes("..")) return "";
    const match = /\.([a-z0-9]{1,12})$/i.exec(rawName);
    return match ? match[1].toLowerCase() : "";
  }

  function getFileDebugMimeCategory(fileMeta) {
    const type = String(fileMeta?.type || "").toLowerCase();
    if (!type || /[\\/?#@]/.test(type)) return "";
    return type.split("/")[0].replace(/[^a-z0-9.+-]/g, "").slice(0, 32);
  }

  function describeSafeFileDebugMetadata(fileMeta) {
    if (!fileMeta || typeof fileMeta !== "object") return null;
    const extension = getFileDebugExtension(fileMeta);
    const mimeCategory = getFileDebugMimeCategory(fileMeta);
    const sizeBytes = Number(fileMeta.size ?? fileMeta.sizeBytes ?? 0) || 0;
    return {
      sizeBytes,
      extension,
      category: extension || mimeCategory || "unknown",
      mimeCategory,
      supportedText: Boolean(fileMeta.supportedText),
      sanitized: Boolean(fileMeta.sanitized)
    };
  }

  function describeSafeFileInputDebugMetadata(inputMeta) {
    if (!inputMeta || typeof inputMeta !== "object") return null;
    return {
      tag: normalizeFileDebugString(inputMeta.tag || "input"),
      source: normalizeFileDebugString(inputMeta.source),
      disabled: Boolean(inputMeta.disabled),
      hidden: Boolean(inputMeta.hidden),
      multiple: Boolean(inputMeta.multiple),
      filesLength: Number(inputMeta.filesLength || 0) || 0
    };
  }

  function describeSafeFileHandoffAdapterDebugMetadata(adapter) {
    if (!adapter || typeof adapter !== "object") return null;
    return {
      id: normalizeFileDebugString(adapter.id),
      siteLabel: normalizeFileDebugString(adapter.siteLabel || adapter.id),
      hostCount: Array.isArray(adapter.hosts) ? adapter.hosts.length : 0,
      supportsDirectDropReplay: Boolean(adapter.supportsDirectDropReplay),
      supportsPendingAttach: Boolean(adapter.supportsPendingAttach),
      supportsTrustedAttachButton: Boolean(adapter.supportsTrustedAttachButton),
      pendingAttachEnabled: Boolean(adapter.pendingAttachEnabled)
    };
  }

  function describeSafeFileAttachErrorMetadata(errorLike) {
    if (!errorLike) return null;
    const errorName = isSafeFileDebugToken(errorLike?.name) ? String(errorLike.name).slice(0, 48) : "Error";
    const rawMessage =
      typeof errorLike?.message === "string"
        ? errorLike.message
        : typeof errorLike === "string"
          ? errorLike
          : "";
    const code = errorLike?.code;
    const metadata = {
      errorName,
      messageLength: rawMessage.length
    };
    if (isSafeFileDebugErrorCode(code)) {
      metadata.codeIfSafe = String(code).slice(0, 48);
    }
    return metadata;
  }

  function assignSafeFileAttachErrorMetadata(target, errorLike) {
    if (!target || typeof target !== "object") return;
    const metadata = describeSafeFileAttachErrorMetadata(errorLike);
    if (!metadata) return;
    target.errorName = metadata.errorName;
    target.messageLength = metadata.messageLength;
    if (metadata.codeIfSafe) {
      target.codeIfSafe = metadata.codeIfSafe;
    }
  }

  function copySafeFileDebugScalar(output, key, value) {
    if (value === null || typeof value === "boolean") {
      output[key] = value;
      return;
    }
    if (typeof value === "number") {
      output[key] = Number.isFinite(value) ? value : 0;
      return;
    }
    if (typeof value !== "string") return;
    const normalized = normalizeFileDebugString(value);
    if (normalized) output[key] = normalized;
  }

  function createSafeFileAttachDebugPayload(payload = {}) {
    const source = payload && typeof payload === "object" ? payload : {};
    const output = {};
    const scalarKeys = new Set([
      "action",
      "blocking",
      "bytes",
      "bytesProcessed",
      "changeEventDispatched",
      "chipCountAfter",
      "chipCountBefore",
      "chunks",
      "context",
      "codeIfSafe",
      "driver",
      "errorName",
      "fastMaxBytes",
      "failureReason",
      "findingsCount",
      "hardBlockBytes",
      "handoffStage",
      "host",
      "hostname",
      "inputEventDispatched",
      "inputFilesAccepted",
      "inputFilesCleared",
      "maxBytes",
      "messageLength",
      "outcome",
      "provider",
      "reason",
      "rendered",
      "site",
      "stage",
      "strategy",
      "totalBytes"
    ]);

    for (const key of scalarKeys) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        copySafeFileDebugScalar(output, key, source[key]);
      }
    }

    if (source.progress && typeof source.progress === "object") {
      output.progress = {
        bytesProcessed: Number(source.progress.bytesProcessed || 0) || 0,
        totalBytes: Number(source.progress.totalBytes || 0) || 0,
        chunks: Number(source.progress.chunks || 0) || 0
      };
    }
    if (source.file) output.file = describeSafeFileDebugMetadata(source.file);
    if (source.sanitizedFile) output.sanitizedFile = describeSafeFileDebugMetadata(source.sanitizedFile);
    if (source.originalFile) output.originalFile = describeSafeFileDebugMetadata(source.originalFile);
    if (source.input) output.input = describeSafeFileInputDebugMetadata(source.input);
    if (source.adapter) output.adapter = describeSafeFileHandoffAdapterDebugMetadata(source.adapter);
    if (source.error) {
      const errorMetadata = describeSafeFileAttachErrorMetadata(source.error);
      if (errorMetadata) Object.assign(output, errorMetadata);
    }
    if (Array.isArray(source.files)) {
      output.fileCount = source.files.length;
      output.files = source.files.map(describeSafeFileDebugMetadata).filter(Boolean);
    }
    if (Array.isArray(source.events)) {
      output.events = source.events.map(normalizeSafeFileDebugEvent).filter(Boolean).slice(0, 8);
      output.eventCount = output.events.length;
    }

    return output;
  }

  root.PWM.FileDebugMetadata = Object.freeze({
    normalizeFileDebugString,
    isSafeFileDebugToken,
    isSafeFileDebugErrorCode,
    getFileDebugExtension,
    getFileDebugMimeCategory,
    describeSafeFileDebugMetadata,
    describeSafeFileInputDebugMetadata,
    describeSafeFileHandoffAdapterDebugMetadata,
    describeSafeFileAttachErrorMetadata,
    assignSafeFileAttachErrorMetadata,
    copySafeFileDebugScalar,
    normalizeSafeFileDebugEvent,
    createSafeFileAttachDebugPayload
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.FileDebugMetadata;
  }
})();
