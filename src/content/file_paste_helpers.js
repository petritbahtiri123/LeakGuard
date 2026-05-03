(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  const LOCAL_FILE_MULTI_MESSAGE =
    "LeakGuard did not insert these files. Paste or drop one supported text file at a time.";
  const LOCAL_FILE_READ_MESSAGE =
    "LeakGuard could not read this local file, so nothing was inserted.";

  function dataTransferHasFiles(dataTransfer) {
    if (!dataTransfer) return false;

    const types = Array.from(dataTransfer.types || []);
    if (types.includes("Files")) return true;
    if (Number(dataTransfer.files?.length || 0) > 0) return true;

    return Array.from(dataTransfer.items || []).some(
      (item) => String(item?.kind || "").toLowerCase() === "file"
    );
  }

  function listDataTransferFiles(dataTransfer) {
    if (!dataTransferHasFiles(dataTransfer)) return [];

    const files = Array.from(dataTransfer.files || []).filter(Boolean);
    if (files.length) return files;

    return Array.from(dataTransfer.items || [])
      .filter(
        (item) =>
          String(item?.kind || "").toLowerCase() === "file" &&
          typeof item.getAsFile === "function"
      )
      .map((item) => item.getAsFile())
      .filter(Boolean);
  }

  function resultFromValidation(validation) {
    return {
      handled: true,
      ok: false,
      code: validation?.code || "invalid_file",
      message: validation?.message || LOCAL_FILE_READ_MESSAGE
    };
  }

  async function readLocalTextFileFromDataTransfer(dataTransfer) {
    const FileScanner = root.PWM.FileScanner || {};

    if (!dataTransferHasFiles(dataTransfer)) {
      return { handled: false, ok: false };
    }

    const files = listDataTransferFiles(dataTransfer);
    if (files.length !== 1) {
      return {
        handled: true,
        ok: false,
        code: files.length > 1 ? "multiple_files" : "file_unavailable",
        message: files.length > 1 ? LOCAL_FILE_MULTI_MESSAGE : LOCAL_FILE_READ_MESSAGE
      };
    }

    const file = files[0];
    const fileName = String(file?.name || "");
    const mimeType = String(file?.type || "");
    const sizeBytes = Number(file?.size || 0);

    const metadataValidation = FileScanner.validateFileForTextScan?.({
      fileName,
      mimeType,
      sizeBytes
    });
    if (!metadataValidation?.ok) return resultFromValidation(metadataValidation);

    let buffer;
    try {
      if (typeof file.arrayBuffer !== "function") {
        return {
          handled: true,
          ok: false,
          code: "file_read_unavailable",
          message: LOCAL_FILE_READ_MESSAGE
        };
      }
      buffer = await file.arrayBuffer();
    } catch {
      return {
        handled: true,
        ok: false,
        code: "file_read_failed",
        message: LOCAL_FILE_READ_MESSAGE
      };
    }

    const contentValidation = FileScanner.validateFileForTextScan?.({
      fileName,
      mimeType,
      sizeBytes,
      buffer
    });
    if (!contentValidation?.ok) return resultFromValidation(contentValidation);

    let text;
    try {
      text = FileScanner.decodeUtf8Text(buffer);
    } catch {
      return {
        handled: true,
        ok: false,
        code: "invalid_utf8",
        message: "This file is not valid UTF-8 text, so LeakGuard did not insert it."
      };
    }

    return {
      handled: true,
      ok: true,
      text,
      file: {
        name: fileName.split(/[\\/]/).pop() || "",
        extension: FileScanner.getFileExtension?.(fileName) || "",
        type: FileScanner.normalizeMimeType?.(mimeType) || mimeType.split(";")[0].trim().toLowerCase(),
        sizeBytes
      }
    };
  }

  root.PWM.FilePasteHelpers = {
    LOCAL_FILE_MULTI_MESSAGE,
    LOCAL_FILE_READ_MESSAGE,
    dataTransferHasFiles,
    listDataTransferFiles,
    readLocalTextFileFromDataTransfer
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.FilePasteHelpers;
  }
})();
