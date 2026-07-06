(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function createFileHandoffVerification(options = {}) {
    const getLocalFileExtension =
      typeof options.getLocalFileExtension === "function" ? options.getLocalFileExtension : () => "";
    const getLocalFileMimeType =
      typeof options.getLocalFileMimeType === "function"
        ? options.getLocalFileMimeType
        : (file) => String(file?.type || "").split(";")[0].trim().toLowerCase();
    const isSupportedWhatsAppTextDocumentAttachFile =
      typeof options.isSupportedWhatsAppTextDocumentAttachFile === "function"
        ? options.isSupportedWhatsAppTextDocumentAttachFile
        : () => false;

    function isExpectedWhatsAppSanitizedMultiFileAttachFile(file) {
      const extension = getLocalFileExtension(file);
      const mimeType = getLocalFileMimeType(file);
      const name = String(file?.name || "");
      if (extension === ".png" || mimeType === "image/png") {
        return mimeType === "image/png" && /\.redacted\.png$/i.test(name);
      }
      if (extension === ".pdf" || mimeType === "application/pdf") {
        return mimeType === "application/pdf" && /\.redacted\.pdf$/i.test(name);
      }
      if (
        extension === ".docx" ||
        mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        return (
          mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" &&
          /\.redacted\.docx$/i.test(name)
        );
      }
      if (
        extension === ".xlsx" ||
        mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      ) {
        return (
          mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" &&
          /\.redacted\.xlsx$/i.test(name)
        );
      }
      return isSupportedWhatsAppTextDocumentAttachFile(file);
    }

    function verifyWhatsAppSanitizedMultiFileAttach(fileInput, sanitizedFiles, originalFiles = []) {
      const expectedFiles = Array.from(sanitizedFiles || []).filter(Boolean);
      const assignedFiles = Array.from(fileInput?.files || []);
      const rawOriginals = new Set(Array.from(originalFiles || []));
      if (assignedFiles.length !== expectedFiles.length) {
        return {
          ok: false,
          reason: "assigned_file_count_mismatch",
          assignedCount: assignedFiles.length,
          expectedCount: expectedFiles.length
        };
      }
      for (let index = 0; index < expectedFiles.length; index += 1) {
        const assignedFile = assignedFiles[index];
        const expectedFile = expectedFiles[index];
        if (assignedFile !== expectedFile) {
          return {
            ok: false,
            reason: "assigned_file_order_or_identity_mismatch",
            assignedCount: assignedFiles.length,
            expectedCount: expectedFiles.length
          };
        }
        if (rawOriginals.has(assignedFile)) {
          return {
            ok: false,
            reason: "raw_original_file_assigned",
            assignedCount: assignedFiles.length,
            expectedCount: expectedFiles.length
          };
        }
        if (!isExpectedWhatsAppSanitizedMultiFileAttachFile(assignedFile)) {
          return {
            ok: false,
            reason: "assigned_file_type_invalid",
            assignedCount: assignedFiles.length,
            expectedCount: expectedFiles.length
          };
        }
      }
      return {
        ok: true,
        reason: "",
        assignedCount: assignedFiles.length,
        expectedCount: expectedFiles.length
      };
    }

    return Object.freeze({
      isExpectedWhatsAppSanitizedMultiFileAttachFile,
      verifyWhatsAppSanitizedMultiFileAttach
    });
  }

  root.PWM.FileHandoffVerification = Object.freeze({
    createFileHandoffVerification
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.FileHandoffVerification;
  }
})();
