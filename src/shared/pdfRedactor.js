(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  const PDF_MIME_TYPE = "application/pdf";
  const MAX_PDF_TEXT_CHARS = 180000;
  const PAGE_WIDTH = 612;
  const PAGE_HEIGHT = 792;
  const MARGIN_X = 54;
  const START_Y = 738;
  const LINE_HEIGHT = 14;
  const MAX_LINE_CHARS = 88;
  const MAX_LINES_PER_PAGE = 48;

  function normalizeFileName(fileName) {
    return String(fileName || "file").split(/[\\/]/).pop() || "file";
  }

  function redactedPdfFileName(fileName) {
    const normalized = normalizeFileName(fileName);
    const withoutExtension = normalized.replace(/\.pdf$/i, "").replace(/^\.+/, "") || "file";
    return `${withoutExtension}.redacted.pdf`;
  }

  function escapePdfText(text) {
    return String(text || "")
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
      .replace(/\r/g, "")
      .replace(/\t/g, "    ");
  }

  function normalizeText(text) {
    return String(text || "")
      .replace(/\r\n?/g, "\n")
      .replace(/\u0000/g, "")
      .slice(0, MAX_PDF_TEXT_CHARS);
  }

  function isTruncatedText(text) {
    return String(text || "").replace(/\r\n?/g, "\n").replace(/\u0000/g, "").length > MAX_PDF_TEXT_CHARS;
  }

  function wrapLine(line) {
    const value = String(line || "");
    if (!value) return [""];
    const output = [];
    for (let index = 0; index < value.length; index += MAX_LINE_CHARS) {
      output.push(value.slice(index, index + MAX_LINE_CHARS));
    }
    return output;
  }

  function paginateText(text) {
    const lines = normalizeText(text)
      .split("\n")
      .flatMap(wrapLine);
    const pages = [];
    for (let index = 0; index < lines.length; index += MAX_LINES_PER_PAGE) {
      pages.push(lines.slice(index, index + MAX_LINES_PER_PAGE));
    }
    return pages.length ? pages : [[""]];
  }

  function byteLength(value) {
    return new TextEncoder().encode(String(value)).length;
  }

  function buildContentStream(lines) {
    const commands = [
      "BT",
      "/F1 10 Tf",
      `${MARGIN_X} ${START_Y} Td`,
      `${LINE_HEIGHT} TL`
    ];
    for (const line of lines) {
      commands.push(`(${escapePdfText(line)}) Tj`);
      commands.push("T*");
    }
    commands.push("ET");
    return `${commands.join("\n")}\n`;
  }

  function objectSource(id, body) {
    return `${id} 0 obj\n${body}\nendobj\n`;
  }

  function buildPdfBytesFromPages(pages) {
    const objects = [];
    const pageObjectIds = pages.map((_, index) => 3 + index * 2);
    const contentObjectIds = pages.map((_, index) => 4 + index * 2);
    const fontObjectId = 3 + pages.length * 2;
    const catalogObjectId = 1;
    const pagesObjectId = 2;

    objects.push(objectSource(catalogObjectId, "<< /Type /Catalog /Pages 2 0 R >>"));
    objects.push(objectSource(
      pagesObjectId,
      `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`
    ));

    pages.forEach((lines, index) => {
      const pageId = pageObjectIds[index];
      const contentId = contentObjectIds[index];
      const stream = buildContentStream(lines);
      objects.push(objectSource(
        pageId,
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentId} 0 R >>`
      ));
      objects.push(objectSource(
        contentId,
        `<< /Length ${byteLength(stream)} >>\nstream\n${stream}endstream`
      ));
    });

    objects.push(objectSource(fontObjectId, "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>"));

    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    for (const object of objects) {
      offsets.push(byteLength(pdf));
      pdf += object;
    }
    const xrefOffset = byteLength(pdf);
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += "0000000000 65535 f \n";
    for (const offset of offsets.slice(1)) {
      pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

    return new TextEncoder().encode(pdf);
  }

  function createRedactedPdfFromText(options = {}) {
    const text = normalizeText(options.text);
    if (!text.trim()) {
      return {
        ok: false,
        status: "pdf_redacted_text_empty"
      };
    }
    return {
      ok: true,
      status: "pdf_redacted_ready",
      fileName: redactedPdfFileName(options.originalName),
      mimeType: PDF_MIME_TYPE,
      bytes: buildPdfBytesFromPages(paginateText(text)),
      source: "sanitized_text",
      truncated: isTruncatedText(options.text)
    };
  }

  function createRedactedPdfFromExtraction(options = {}) {
    const extraction = options.extraction || {};
    if (extraction.status !== "ok" || extraction.kind !== "pdf" || extraction.safeForScan !== true) {
      return {
        ok: false,
        status: extraction.reason || extraction.status || "pdf_extraction_not_safe"
      };
    }
    return createRedactedPdfFromText({
      originalName: options.originalName || extraction.metadata?.fileName,
      text: options.sanitizedText
    });
  }

  root.PWM.PdfRedactor = {
    PDF_MIME_TYPE,
    MAX_PDF_TEXT_CHARS,
    redactedPdfFileName,
    createRedactedPdfFromText,
    createRedactedPdfFromExtraction
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.PdfRedactor;
  }
})();
