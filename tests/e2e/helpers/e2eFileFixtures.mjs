import sharp from "sharp";
import zlib from "node:zlib";

const utf8 = new TextEncoder();

function bufferFromText(text) {
  return Buffer.from(utf8.encode(String(text)));
}

function payload(name, mimeType, buffer, meta = {}) {
  return {
    name,
    mimeType,
    buffer: Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer),
    ...meta
  };
}

function escapePdfText(text) {
  return String(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function makePdf(text, options = {}) {
  if (options.malformed) {
    return bufferFromText(`%PDF-1.4\nLGQA_MALFORMED_PDF ${text}\ntruncated`);
  }

  const encryptMarker = options.encrypted ? " /Encrypt 6 0 R" : "";
  const streamText = options.imageOnly
    ? "q\n10 0 0 10 0 0 cm\n/Im1 Do\nQ\n"
    : `BT\n/F1 12 Tf\n72 720 Td\n(${escapePdfText(text)}) Tj\nET\n`;
  const stream = Buffer.from(streamText, "binary");
  return Buffer.concat([
    Buffer.from("%PDF-1.4\n", "binary"),
    Buffer.from(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R${encryptMarker} >>\nendobj\n`, "binary"),
    Buffer.from("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n", "binary"),
    Buffer.from("3 0 obj\n<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>\nendobj\n", "binary"),
    Buffer.from(`4 0 obj\n<< /Length ${stream.length} >>\nstream\n`, "binary"),
    stream,
    Buffer.from("\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n", "binary")
  ]);
}

function writeUInt32LE(buffer, value, offset) {
  buffer.writeUInt32LE(value >>> 0, offset);
}

function makeZip(entries) {
  const chunks = [];
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const raw = Buffer.from(String(entry.data || ""), "utf8");
    const compressed = zlib.deflateRawSync(raw);
    const header = Buffer.alloc(30);
    writeUInt32LE(header, 0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(entry.encrypted ? 1 : 0, 6);
    header.writeUInt16LE(8, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(0, 12);
    writeUInt32LE(header, 0, 14);
    writeUInt32LE(header, compressed.length, 18);
    writeUInt32LE(header, raw.length, 22);
    header.writeUInt16LE(name.length, 26);
    header.writeUInt16LE(0, 28);
    chunks.push(header, name, compressed);
  }
  return Buffer.concat(chunks);
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function makeDocx(text) {
  return makeZip([
    {
      name: "[Content_Types].xml",
      data: '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>'
    },
    {
      name: "word/document.xml",
      data: `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${escapeXml(text)}</w:t></w:r></w:p></w:body></w:document>`
    }
  ]);
}

function makeXlsx(text) {
  return makeZip([
    {
      name: "xl/workbook.xml",
      data: '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets><sheet name="Secrets" sheetId="1"/></sheets></workbook>'
    },
    {
      name: "xl/worksheets/sheet1.xml",
      data: `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>${escapeXml(text)}</t></is></c></row></sheetData></worksheet>`
    }
  ]);
}

function fakeSecret(id) {
  return `LGQA_${id}_SuperFakePassword123456789!`;
}

function textBody(id) {
  const secret = fakeSecret(id);
  return {
    secret,
    text: [
      `LGQA_${id}`,
      `SERVICE_PASSWORD=${secret}`,
      "DATABASE_URL=postgres://admin:FakePass123@db.example.com:5432/customerdb"
    ].join("\n")
  };
}

export const textFileFixtures = [
  (() => {
    const body = textBody("TXT_FILE");
    return payload("lgqa-text-secret.txt", "text/plain", bufferFromText(body.text), body);
  })(),
  (() => {
    const body = textBody("ENV_FILE");
    return payload("lgqa-env-secret.env", "text/plain", bufferFromText(body.text), body);
  })(),
  (() => {
    const body = textBody("JSON_FILE");
    const json = JSON.stringify({ marker: "LGQA_JSON_FILE", password: body.secret }, null, 2);
    return payload("lgqa-json-secret.json", "application/json", bufferFromText(json), {
      secret: body.secret,
      text: json
    });
  })(),
  (() => {
    const body = textBody("LOG_FILE");
    return payload("lgqa-log-secret.log", "text/plain", bufferFromText(`[info] ${body.text}`), body);
  })(),
  (() => {
    const body = textBody("MD_FILE");
    return payload("lgqa-markdown-secret.md", "text/markdown", bufferFromText(`# QA\n\n${body.text}`), body);
  })(),
  (() => {
    const secret = "sk-proj-LGQACSVFileKey1234567890abcdef1234567890";
    const text = [
      "marker,openai_api_key,database_url",
      `LGQA_CSV_FILE,${secret},postgres://admin:FakePass123@db.example.com:5432/customerdb`
    ].join("\n");
    return payload("lgqa-csv-secret.csv", "text/csv", bufferFromText(text), {
      secret,
      text
    });
  })(),
  (() => {
    const body = textBody("YAML_FILE");
    const text = `marker: LGQA_YAML_FILE\nservice_password: ${body.secret}\n`;
    return payload("lgqa-yaml-secret.yaml", "text/yaml", bufferFromText(text), {
      secret: body.secret,
      text
    });
  })(),
  (() => {
    const body = textBody("PEM_FILE");
    const text = [
      "-----BEGIN PRIVATE KEY-----",
      body.secret,
      "-----END PRIVATE KEY-----"
    ].join("\n");
    return payload("lgqa-pem-secret.pem", "text/plain", bufferFromText(text), {
      secret: body.secret,
      text
    });
  })(),
  (() => {
    const body = textBody("PS1_FILE");
    const text = `$ServicePassword = "${body.secret}"\nWrite-Host "LGQA_PS1_FILE"\n`;
    return payload("lgqa-ps1-secret.ps1", "text/plain", bufferFromText(text), {
      secret: body.secret,
      text
    });
  })(),
  (() => {
    const body = textBody("PY_FILE");
    const text = `SERVICE_PASSWORD = "${body.secret}"\nprint("LGQA_PY_FILE")\n`;
    return payload("lgqa-python-secret.py", "text/x-python", bufferFromText(text), {
      secret: body.secret,
      text
    });
  })(),
  (() => {
    const secret = "sk-proj-LGQASQLFileKey1234567890abcdef1234567890";
    const text = `-- LGQA_SQL_FILE\n-- OPENAI_API_KEY=${secret}\nCREATE USER app WITH PASSWORD 'FakePass123';\n`;
    return payload("lgqa-sql-secret.sql", "text/plain", bufferFromText(text), {
      secret,
      text
    });
  })(),
  (() => {
    const body = textBody("DOCKERFILE");
    const text = `FROM alpine\nENV SERVICE_PASSWORD=${body.secret}\n`;
    return payload("Dockerfile", "text/plain", bufferFromText(text), {
      secret: body.secret,
      text
    });
  })(),
  (() => {
    const body = textBody("MAKEFILE");
    const text = `deploy:\n\tSERVICE_PASSWORD=${body.secret} ./deploy.sh\n`;
    return payload("Makefile", "text/plain", bufferFromText(text), {
      secret: body.secret,
      text
    });
  })()
];

export const documentFileFixtures = [
  (() => {
    const body = textBody("PDF_FILE");
    return payload("lgqa-pdf-secret.pdf", "application/pdf", makePdf(body.text), {
      ...body,
      expectedOutputName: "lgqa-pdf-secret.redacted.pdf"
    });
  })(),
  (() => {
    const body = textBody("DOCX_FILE");
    return payload(
      "lgqa-docx-secret.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      makeDocx(body.text),
      {
        ...body,
        expectedOutputName: "lgqa-docx-secret.redacted.docx"
      }
    );
  })(),
  (() => {
    const body = textBody("XLSX_FILE");
    return payload(
      "lgqa-xlsx-secret.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      makeXlsx(body.text),
      {
        ...body,
        expectedOutputName: "lgqa-xlsx-secret.redacted.xlsx"
      }
    );
  })()
];

export function malformedPdfFixture() {
  const body = textBody("MALFORMED_PDF");
  return payload("lgqa-malformed-secret.pdf", "application/pdf", makePdf(body.text, { malformed: true }), body);
}

export function encryptedPdfFixture() {
  const body = textBody("ENCRYPTED_PDF");
  return payload("lgqa-encrypted-secret.pdf", "application/pdf", makePdf(body.text, { encrypted: true }), body);
}

export function imageOnlyPdfFixture() {
  const body = textBody("IMAGE_ONLY_PDF");
  return payload("lgqa-image-only-secret.pdf", "application/pdf", makePdf(body.text, { imageOnly: true }), body);
}

export function malformedDocxFixture() {
  const body = textBody("MALFORMED_DOCX");
  return payload(
    "lgqa-malformed-secret.docx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    bufferFromText(`not a docx ${body.text}`),
    body
  );
}

export function unsupportedFileFixture(options = {}) {
  const body = textBody("UNSUPPORTED_FILE");
  const name = options.name || "lgqa-unsupported-secret.bin";
  return payload(name, options.mimeType || "application/octet-stream", bufferFromText(body.text), {
    secret: body.secret,
    text: body.text
  });
}

export async function imageFixture(kind) {
  const map = {
    png: ["lgqa-image-secret.png", "image/png", "png"],
    jpg: ["lgqa-image-secret.jpg", "image/jpeg", "jpeg"],
    webp: ["lgqa-image-secret.webp", "image/webp", "webp"]
  };
  const [name, mimeType, format] = map[kind] || map.png;
  const secret = `sk-proj-LGQAFake${kind.toUpperCase()}ImageKey1234567890abcdef`;
  const text = `API_KEY=${secret}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="140">
    <rect width="100%" height="100%" fill="white"/>
    <text x="24" y="82" font-family="Arial" font-size="36" fill="black">${text}</text>
  </svg>`;
  const buffer = await sharp(Buffer.from(svg)).toFormat(format).toBuffer();
  return payload(name, mimeType, buffer, {
    secret,
    text,
    expectedOutputName: name.replace(/\.[^.]+$/, ".redacted.png")
  });
}

export async function multilineImageFixture() {
  const secret = "sk-proj-LGQAMultilineImageKey1234567890abcdef";
  const lines = Array.from({ length: 12 }, (_, index) =>
    index === 7 ? `API_KEY=${secret}` : `SAFE_LINE_${index + 1}=visible test content`
  );
  const svgLines = lines
    .map(
      (line, index) =>
        `<text x="40" y="${80 + index * 68}" font-family="Arial" font-size="44" fill="black">${line}</text>`
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="900"><rect width="100%" height="100%" fill="white"/>${svgLines}</svg>`;
  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return payload("lgqa-multiline-image-secret.png", "image/png", buffer, {
    secret,
    text: lines.join("\n"),
    expectedOutputName: "lgqa-multiline-image-secret.redacted.png"
  });
}

export function malformedImageFixture() {
  const secret = fakeSecret("MALFORMED_IMAGE");
  return payload(
    "lgqa-malformed-image.png",
    "image/png",
    bufferFromText(`not a png ${secret}`),
    { secret }
  );
}

export async function oversizedImageFixture() {
  const secret = fakeSecret("OVERSIZED_IMAGE");
  const buffer = await sharp({
    create: {
      width: 4097,
      height: 128,
      channels: 3,
      background: "white"
    }
  }).png().toBuffer();
  return payload("lgqa-oversized-image.png", "image/png", buffer, { secret });
}

export function multiFileFixtureSet(count) {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const body = textBody(`MULTI_${number}`);
    return payload(`lgqa-multi-${String(number).padStart(2, "0")}.txt`, "text/plain", bufferFromText(body.text), {
      ...body,
      order: number
    });
  });
}

export function sixLargeFileBlockedSet() {
  return Array.from({ length: 6 }, (_, index) => {
    const number = index + 1;
    const body = textBody(`LARGE_${number}`);
    const prefix = bufferFromText(`${body.text}\n`);
    const filler = Buffer.alloc((4 * 1024 * 1024) + 8 - prefix.length, 65);
    return payload(`lgqa-large-${number}.txt`, "text/plain", Buffer.concat([prefix, filler]), {
      ...body,
      order: number
    });
  });
}
