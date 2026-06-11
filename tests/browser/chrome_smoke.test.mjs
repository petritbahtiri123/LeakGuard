import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash, createSign, generateKeyPairSync, randomBytes } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const extensionDir = path.join(repoRoot, "dist", "chrome");
const smokeTimeoutMs = Number(process.env.LEAKGUARD_CHROME_SMOKE_TIMEOUT_MS || 60000);
const cdpCommandTimeoutMs = Number(process.env.LEAKGUARD_CHROME_SMOKE_CDP_TIMEOUT_MS || 30000);
const smokeTimingWarningMs = Number(process.env.LEAKGUARD_SMOKE_TIMING_WARN_MS || 5000);

function assertBuiltExtensionExists(sourceExtensionDir = extensionDir, buildCommand = "npm run build:chrome") {
  const manifestPath = path.join(sourceExtensionDir, "manifest.json");
  assert.ok(
    fs.existsSync(manifestPath),
    `Expected ${manifestPath}. Run ${buildCommand} before the smoke test.`
  );
}

function quoteForArg(value) {
  return String(value || "");
}

function findExecutable(candidates) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (path.isAbsolute(candidate) && fs.existsSync(candidate)) return candidate;
    try {
      const command = process.platform === "win32" ? "where" : "which";
      const result = execFileSync(command, [candidate], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"]
      })
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)[0];
      if (result) return result;
    } catch {
      // Try the next candidate.
    }
  }
  return "";
}

function normalizeRemoteDebuggingMode(mode) {
  if (!mode || mode === "pipe") return "pipe";
  if (mode === "port") return "port";
  throw new Error(`Unsupported Chromium remote debugging mode: ${mode}`);
}

async function reserveLoopbackPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  return port;
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, { timeout: 1000 }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`HTTP ${response.statusCode} from ${url}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("timeout", () => {
      request.destroy(new Error(`Timed out requesting ${url}`));
    });
    request.on("error", reject);
  });
}

async function findCdpWebSocketUrl(port, browserName) {
  return await waitFor(async () => {
    const version = await requestJson(`http://127.0.0.1:${port}/json/version`);
    return version.webSocketDebuggerUrl || null;
  }, `${browserName} remote debugging port`);
}

function findChromeExecutable() {
  const localAppData = process.env.LOCALAPPDATA || "";
  const windowsCandidates =
    process.platform === "win32"
      ? [
          path.join(process.env.PROGRAMFILES || "", "Google", "Chrome", "Application", "chrome.exe"),
          path.join(
            process.env["PROGRAMFILES(X86)"] || "",
            "Google",
            "Chrome",
            "Application",
            "chrome.exe"
          ),
          path.join(localAppData, "Google", "Chrome", "Application", "chrome.exe")
        ]
      : [];
  return findExecutable([
    process.env.CHROME_BIN,
    process.env.GOOGLE_CHROME_BIN,
    ...windowsCandidates,
    "google-chrome",
    "google-chrome-stable",
    "chromium-browser",
    "chromium",
    "chrome"
  ]);
}

async function waitFor(condition, label, timeoutMs = smokeTimeoutMs) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const result = await condition();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const suffix = lastError ? ` Last error: ${lastError.message}` : "";
  throw new Error(`Timed out waiting for ${label}.${suffix}`);
}

function createHarnessPage(title) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>${title}</title>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <div id="chat-form" role="form">
        <textarea id="prompt-textarea" data-testid="prompt-textarea" placeholder="Message"></textarea>
        <button id="send-button" type="button">Send</button>
      </div>
      <section id="echo-zone"></section>
    </main>
  </body>
</html>`;
}

async function startHttpServer() {
  const server = http.createServer((request, response) => {
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    });
    response.end(createHarnessPage("LeakGuard HTTP Smoke Harness"));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    server,
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

function createSelfSignedCertificate() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048
  });
  const cert = createSelfSignedCertificateDer({
    privateKey,
    publicKey,
    commonName: "chatgpt.com",
    dnsNames: ["chatgpt.com"],
    ipAddresses: ["127.0.0.1"]
  });

  return {
    key: privateKey.export({ type: "pkcs8", format: "pem" }),
    cert: toPem("CERTIFICATE", cert)
  };
}

function derLength(length) {
  if (length < 128) return Buffer.from([length]);
  const bytes = [];
  let value = length;
  while (value > 0) {
    bytes.unshift(value & 0xff);
    value >>= 8;
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function der(tag, content) {
  const body = Buffer.isBuffer(content) ? content : Buffer.concat(content);
  return Buffer.concat([Buffer.from([tag]), derLength(body.length), body]);
}

function derSequence(items) {
  return der(0x30, items);
}

function derSet(items) {
  return der(0x31, items);
}

function derInteger(value) {
  let bytes = Buffer.isBuffer(value) ? Buffer.from(value) : Buffer.from([value]);
  while (bytes.length > 1 && bytes[0] === 0 && (bytes[1] & 0x80) === 0) {
    bytes = bytes.subarray(1);
  }
  if (bytes[0] & 0x80) {
    bytes = Buffer.concat([Buffer.from([0]), bytes]);
  }
  return der(0x02, bytes);
}

function derOid(value) {
  const parts = String(value).split(".").map((part) => Number(part));
  const bytes = [40 * parts[0] + parts[1]];
  for (const part of parts.slice(2)) {
    const encoded = [part & 0x7f];
    let rest = part >> 7;
    while (rest > 0) {
      encoded.unshift(0x80 | (rest & 0x7f));
      rest >>= 7;
    }
    bytes.push(...encoded);
  }
  return der(0x06, Buffer.from(bytes));
}

function derNull() {
  return Buffer.from([0x05, 0x00]);
}

function derUtf8(value) {
  return der(0x0c, Buffer.from(String(value), "utf8"));
}

function derUtcTime(date) {
  const year = String(date.getUTCFullYear()).slice(-2);
  const pad = (value) => String(value).padStart(2, "0");
  const text = `${year}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}${pad(
    date.getUTCHours()
  )}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
  return der(0x17, Buffer.from(text, "ascii"));
}

function derBitString(bytes) {
  return der(0x03, Buffer.concat([Buffer.from([0]), Buffer.from(bytes)]));
}

function derOctetString(bytes) {
  return der(0x04, Buffer.from(bytes));
}

function derExplicit(index, content) {
  return der(0xa0 + index, Buffer.from(content));
}

function derContextPrimitive(index, content) {
  return der(0x80 + index, Buffer.from(content));
}

function algorithmIdentifier() {
  return derSequence([derOid("1.2.840.113549.1.1.11"), derNull()]);
}

function name(commonName) {
  return derSequence([
    derSet([
      derSequence([
        derOid("2.5.4.3"),
        derUtf8(commonName)
      ])
    ])
  ]);
}

function subjectAltNameExtension({ dnsNames, ipAddresses }) {
  const names = [];
  for (const dnsName of dnsNames) {
    names.push(derContextPrimitive(2, Buffer.from(dnsName, "ascii")));
  }
  for (const ipAddress of ipAddresses) {
    names.push(derContextPrimitive(7, Buffer.from(ipAddress.split(".").map((part) => Number(part)))));
  }
  return derSequence([
    derOid("2.5.29.17"),
    derOctetString(derSequence(names))
  ]);
}

function createSelfSignedCertificateDer({ privateKey, publicKey, commonName, dnsNames, ipAddresses }) {
  const now = Date.now();
  const serial = randomBytes(16);
  serial[0] &= 0x7f;
  const tbs = derSequence([
    derExplicit(0, derInteger(2)),
    derInteger(serial),
    algorithmIdentifier(),
    name(commonName),
    derSequence([
      derUtcTime(new Date(now - 60 * 60 * 1000)),
      derUtcTime(new Date(now + 24 * 60 * 60 * 1000))
    ]),
    name(commonName),
    publicKey.export({ type: "spki", format: "der" }),
    derExplicit(3, derSequence([subjectAltNameExtension({ dnsNames, ipAddresses })]))
  ]);

  const signer = createSign("RSA-SHA256");
  signer.update(tbs);
  signer.end();
  const signature = signer.sign(privateKey);
  return derSequence([tbs, algorithmIdentifier(), derBitString(signature)]);
}

function toPem(label, derBytes) {
  const base64 = Buffer.from(derBytes).toString("base64").match(/.{1,64}/g).join("\n");
  return `-----BEGIN ${label}-----\n${base64}\n-----END ${label}-----\n`;
}

async function startHttpsChatGptServer(_tempDir) {
  const tls = createSelfSignedCertificate();
  const server = https.createServer(tls, (request, response) => {
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    });
    response.end(createHarnessPage("LeakGuard ChatGPT Smoke Harness"));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    server,
    origin: `https://chatgpt.com:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}
function prepareSmokeExtension(tempDir, sourceExtensionDir = extensionDir) {
  const smokeExtensionDir = path.join(tempDir, "extension");
  fs.cpSync(sourceExtensionDir, smokeExtensionDir, { recursive: true });

  const manifestPath = path.join(smokeExtensionDir, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  manifest.host_permissions = Array.from(
    new Set([...(manifest.host_permissions || []), "http://127.0.0.1/*"])
  );

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return smokeExtensionDir;
}
class CdpPipeConnection {
  constructor(input, output) {
    this.input = input;
    this.output = output;
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.buffer = "";
  }

  async connect() {
    assert.ok(this.input, "Chrome remote debugging input pipe is missing.");
    assert.ok(this.output, "Chrome remote debugging output pipe is missing.");
    this.output.setEncoding("utf8");
    this.output.on("data", (chunk) => {
      this.buffer += chunk;
      let separator = this.buffer.indexOf("\0");
      while (separator !== -1) {
        const payload = this.buffer.slice(0, separator);
        this.buffer = this.buffer.slice(separator + 1);
        if (payload) this.handleMessage(payload);
        separator = this.buffer.indexOf("\0");
      }
    });
    this.output.on("error", (error) => {
      for (const { reject } of this.pending.values()) {
        reject(error);
      }
      this.pending.clear();
    });
    await this.send("Browser.getVersion");
  }

  handleMessage(data) {
    const message = JSON.parse(String(data));
    if (message.id && this.pending.has(message.id)) {
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) {
        reject(new Error(`${message.error.message}: ${JSON.stringify(message.error.data || {})}`));
      } else {
        resolve(message.result || {});
      }
      return;
    }
    this.events.push(message);
  }

  send(method, params = {}, sessionId = null) {
    const id = this.nextId;
    this.nextId += 1;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.input.write(`${JSON.stringify(payload)}\0`);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, cdpCommandTimeoutMs);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      });
    });
  }

  async close() {
    this.input?.destroy();
    this.output?.destroy();
  }
}

class CdpWebSocketConnection {
  constructor(webSocketUrl) {
    this.webSocketUrl = webSocketUrl;
    this.socket = null;
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.buffer = Buffer.alloc(0);
    this.fragmentedOpcode = 0;
    this.fragmentedChunks = [];
  }

  async connect() {
    assert.ok(this.webSocketUrl, "Chromium remote debugging websocket URL is missing.");
    const { socket, initialBuffer } = await openWebSocket(this.webSocketUrl);
    this.socket = socket;
    this.socket.on("data", (chunk) => {
      try {
        this.handleChunk(chunk);
      } catch (error) {
        this.rejectPending(error);
        this.socket.destroy(error);
      }
    });
    this.socket.on("error", (error) => this.rejectPending(error));
    this.socket.on("close", () => this.rejectPending(new Error("CDP websocket closed.")));
    if (initialBuffer.length) this.handleChunk(initialBuffer);
    await this.send("Browser.getVersion");
  }

  handleChunk(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    let frame = readWebSocketFrame(this.buffer);
    while (frame) {
      this.buffer = this.buffer.subarray(frame.consumed);
      this.handleFrame(frame);
      frame = readWebSocketFrame(this.buffer);
    }
  }

  handleFrame(frame) {
    if (frame.opcode === 0x8) {
      this.rejectPending(new Error("CDP websocket closed."));
      this.socket.end();
      return;
    }
    if (frame.opcode === 0x9) {
      this.socket.write(encodeWebSocketFrame(frame.payload, 0xa));
      return;
    }
    if (frame.opcode === 0xa) return;

    if (frame.opcode === 0x1 || frame.opcode === 0x2) {
      if (frame.fin) {
        this.handleMessage(frame.payload.toString("utf8"));
        return;
      }
      this.fragmentedOpcode = frame.opcode;
      this.fragmentedChunks = [frame.payload];
      return;
    }

    if (frame.opcode === 0x0 && this.fragmentedOpcode) {
      this.fragmentedChunks.push(frame.payload);
      if (frame.fin) {
        const payload = Buffer.concat(this.fragmentedChunks);
        const opcode = this.fragmentedOpcode;
        this.fragmentedOpcode = 0;
        this.fragmentedChunks = [];
        if (opcode === 0x1) this.handleMessage(payload.toString("utf8"));
      }
    }
  }

  handleMessage(data) {
    const message = JSON.parse(String(data));
    if (message.id && this.pending.has(message.id)) {
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) {
        reject(new Error(`${message.error.message}: ${JSON.stringify(message.error.data || {})}`));
      } else {
        resolve(message.result || {});
      }
      return;
    }
    this.events.push(message);
  }

  rejectPending(error) {
    for (const { reject } of this.pending.values()) {
      reject(error);
    }
    this.pending.clear();
  }

  send(method, params = {}, sessionId = null) {
    if (!this.socket || this.socket.destroyed) {
      return Promise.reject(new Error(`CDP websocket is not connected: ${method}`));
    }
    const id = this.nextId;
    this.nextId += 1;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    const request = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, cdpCommandTimeoutMs);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      });
    });
    this.socket.write(encodeWebSocketFrame(Buffer.from(JSON.stringify(payload), "utf8")));
    return request;
  }

  async close() {
    this.rejectPending(new Error("CDP websocket closed."));
    if (this.socket && !this.socket.destroyed) {
      this.socket.write(encodeWebSocketFrame(Buffer.alloc(0), 0x8));
      this.socket.end();
      this.socket.destroy();
    }
  }
}

function parseHttpHeaderMap(headerText) {
  const headers = new Map();
  for (const line of headerText.split(/\r?\n/).slice(1)) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    headers.set(line.slice(0, separator).trim().toLowerCase(), line.slice(separator + 1).trim());
  }
  return headers;
}

function openWebSocket(webSocketUrl) {
  const url = new URL(webSocketUrl);
  assert.equal(url.protocol, "ws:", `Expected ws:// CDP websocket URL, got ${webSocketUrl}`);
  const key = randomBytes(16).toString("base64");
  const expectedAccept = createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");
  const pathAndSearch = `${url.pathname || "/"}${url.search || ""}`;
  const request = [
    `GET ${pathAndSearch} HTTP/1.1`,
    `Host: ${url.host}`,
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Key: ${key}`,
    "Sec-WebSocket-Version: 13",
    "",
    ""
  ].join("\r\n");

  return new Promise((resolve, reject) => {
    const socket = net.createConnection({
      host: url.hostname,
      port: Number(url.port || 80)
    });
    let buffer = Buffer.alloc(0);
    const timeout = setTimeout(() => {
      fail(new Error(`Timed out opening CDP websocket ${webSocketUrl}`));
    }, cdpCommandTimeoutMs);

    function cleanup() {
      clearTimeout(timeout);
      socket.off("error", fail);
      socket.off("data", onData);
    }

    function fail(error) {
      cleanup();
      socket.destroy();
      reject(error);
    }

    function onData(chunk) {
      buffer = Buffer.concat([buffer, chunk]);
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) return;

      const headerText = buffer.subarray(0, headerEnd).toString("utf8");
      const [statusLine] = headerText.split(/\r?\n/);
      if (!/^HTTP\/1\.[01] 101\b/.test(statusLine)) {
        fail(new Error(`CDP websocket upgrade failed: ${statusLine}`));
        return;
      }

      const headers = parseHttpHeaderMap(headerText);
      if (headers.get("sec-websocket-accept") !== expectedAccept) {
        fail(new Error("CDP websocket upgrade returned an invalid accept key."));
        return;
      }

      cleanup();
      socket.setNoDelay(true);
      resolve({
        socket,
        initialBuffer: buffer.subarray(headerEnd + 4)
      });
    }

    socket.on("error", fail);
    socket.on("data", onData);
    socket.once("connect", () => {
      socket.write(request);
    });
  });
}

function readWebSocketFrame(buffer) {
  if (buffer.length < 2) return null;
  const first = buffer[0];
  const second = buffer[1];
  let offset = 2;
  let length = second & 0x7f;
  if (length === 126) {
    if (buffer.length < offset + 2) return null;
    length = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (length === 127) {
    if (buffer.length < offset + 8) return null;
    const wideLength = buffer.readBigUInt64BE(offset);
    if (wideLength > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error("CDP websocket frame is too large.");
    }
    length = Number(wideLength);
    offset += 8;
  }

  const masked = Boolean(second & 0x80);
  const mask = masked ? buffer.subarray(offset, offset + 4) : null;
  if (masked) offset += 4;
  if (buffer.length < offset + length) return null;

  let payload = buffer.subarray(offset, offset + length);
  if (mask) {
    payload = Buffer.from(payload);
    for (let index = 0; index < payload.length; index += 1) {
      payload[index] ^= mask[index % 4];
    }
  }

  return {
    fin: Boolean(first & 0x80),
    opcode: first & 0x0f,
    payload,
    consumed: offset + length
  };
}

function encodeWebSocketFrame(payload, opcode = 0x1) {
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload), "utf8");
  const length = data.length;
  const headerLength = length < 126 ? 2 : length <= 0xffff ? 4 : 10;
  const header = Buffer.alloc(headerLength + 4);
  header[0] = 0x80 | opcode;
  let offset = 2;
  if (length < 126) {
    header[1] = 0x80 | length;
  } else if (length <= 0xffff) {
    header[1] = 0x80 | 126;
    header.writeUInt16BE(length, offset);
    offset += 2;
  } else {
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(length), offset);
    offset += 8;
  }

  const mask = randomBytes(4);
  mask.copy(header, offset);
  const masked = Buffer.from(data);
  for (let index = 0; index < masked.length; index += 1) {
    masked[index] ^= mask[index % 4];
  }
  return Buffer.concat([header, masked]);
}

async function launchChrome({
  extensionPath,
  profileDir,
  browserName = "Chrome",
  browserExecutable = findChromeExecutable(),
  headlessEnvName = "LEAKGUARD_CHROME_HEADLESS",
  missingMessage = "Chrome stable or Chromium was not found. Set CHROME_BIN to run this smoke test.",
  remoteDebuggingMode = "pipe"
}) {
  assert.ok(browserExecutable, missingMessage);
  const debuggingMode = normalizeRemoteDebuggingMode(remoteDebuggingMode);
  const debuggingPort = debuggingMode === "port" ? await reserveLoopbackPort() : 0;

  const args = [
    debuggingMode === "port"
      ? `--remote-debugging-port=${debuggingPort}`
      : "--remote-debugging-pipe",
    `--user-data-dir=${profileDir}`,
    `--load-extension=${extensionPath}`,
    "--enable-unsafe-extension-debugging",
    "--disable-features=DisableLoadExtensionCommandLineSwitch",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-sync",
    "--ignore-certificate-errors",
    "--allow-insecure-localhost",
    "--host-resolver-rules=MAP chatgpt.com 127.0.0.1",
    "--window-size=1280,900",
    "--window-position=-2400,-2400",
    "--dbus-stub"
  ];
  if (debuggingMode === "port") {
    args.push("--remote-debugging-address=127.0.0.1");
  }
  if (process.env[headlessEnvName] === "1") {
    args.push("--headless=new");
  }
  if (process.platform === "linux") {
    args.push("--no-sandbox");
  }
  args.push("about:blank");

  const child = spawn(browserExecutable, args.map(quoteForArg), {
    stdio:
      debuggingMode === "pipe"
        ? ["ignore", "pipe", "pipe", "pipe", "pipe"]
        : ["ignore", "pipe", "pipe"]
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  child.on("exit", (code, signal) => {
    if (code && code !== 0) {
      stderr += `\n${browserName} exited with code ${code} signal ${signal || ""}`;
    }
  });

  return { child, debuggingMode, debuggingPort, stderr: () => stderr };
}

async function waitForChromeExit(child, timeoutMs = 5000) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, timeoutMs))
  ]);
}

async function attachToTarget(connection, targetId) {
  const { sessionId } = await connection.send("Target.attachToTarget", {
    targetId,
    flatten: true
  });
  await connection.send("Runtime.enable", {}, sessionId).catch(() => {});
  await connection.send("Page.enable", {}, sessionId).catch(() => {});
  return sessionId;
}

async function createPage(connection, url = "about:blank") {
  const { targetId } = await connection.send("Target.createTarget", { url });
  const sessionId = await attachToTarget(connection, targetId);
  return { targetId, sessionId };
}

async function setFileInputFiles(connection, sessionId, selector, files) {
  await connection.send("DOM.enable", {}, sessionId).catch(() => {});
  const normalizedFiles = (Array.isArray(files) ? files : [files]).map((file) => path.resolve(file));
  for (const file of normalizedFiles) {
    assert.ok(fs.existsSync(file), `Expected file input path to exist: ${file}`);
  }
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const { root } = await connection.send("DOM.getDocument", { depth: -1, pierce: true }, sessionId);
      const { nodeId } = await connection.send(
        "DOM.querySelector",
        {
          nodeId: root.nodeId,
          selector
        },
        sessionId
      );
      assert.ok(nodeId, `Expected to find file input ${selector}`);
      await connection.send(
        "DOM.setFileInputFiles",
        {
          nodeId,
          files: normalizedFiles
        },
        sessionId
      );
      let inputState = await getFileInputState(connection, sessionId, selector);
      if (inputState.count !== normalizedFiles.length) {
        const result = await connection.send(
          "Runtime.evaluate",
          {
            expression: `document.querySelector(${JSON.stringify(selector)})`,
            awaitPromise: false,
            returnByValue: false
          },
          sessionId
        );
        const objectId = result.result?.objectId;
        assert.ok(objectId, `Expected to find file input object ${selector}`);
        await connection.send(
          "DOM.setFileInputFiles",
          {
            objectId,
            files: normalizedFiles
          },
          sessionId
        );
        inputState = await getFileInputState(connection, sessionId, selector);
      }
      assert.equal(
        inputState.count,
        normalizedFiles.length,
        `Expected ${selector} to contain ${normalizedFiles.length} file(s), got ${JSON.stringify(inputState)}`
      );
      await evaluate(
        connection,
        sessionId,
        `(() => {
          const input = document.querySelector(${JSON.stringify(selector)});
          input?.dispatchEvent(new Event('input', { bubbles: true }));
          input?.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        })()`
      );
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw lastError;
}

async function getFileInputState(connection, sessionId, selector) {
  return await evaluate(
    connection,
    sessionId,
    `(() => {
      const input = document.querySelector(${JSON.stringify(selector)});
      return {
        count: input?.files?.length || 0,
        files: Array.from(input?.files || []).map((file) => ({
          name: file.name,
          type: file.type,
          size: file.size
        }))
      };
    })()`
  );
}

async function evaluate(connection, sessionId, expression, options = {}) {
  const result = await connection.send(
    "Runtime.evaluate",
    {
      expression,
      awaitPromise: options.awaitPromise !== false,
      returnByValue: options.returnByValue !== false,
      userGesture: Boolean(options.userGesture)
    },
    sessionId
  );
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description ||
        result.exceptionDetails.text ||
        `Evaluation failed: ${expression.slice(0, 120)}`
    );
  }
  return result.result?.value;
}

async function navigate(connection, sessionId, url) {
  await connection.send("Page.navigate", { url }, sessionId);
  await waitFor(
    () => evaluate(connection, sessionId, "document.readyState === 'complete'"),
    `page load ${url}`
  );
}

async function waitForEval(connection, sessionId, expression, label) {
  return await waitFor(
    () => evaluate(connection, sessionId, expression),
    label
  );
}

function recordSmokeTiming(browserName, metric, elapsedMs) {
  const roundedMs = Number(elapsedMs.toFixed(1));
  console.log(`${browserName} smoke metric: ${metric}=${roundedMs}ms`);
  if (roundedMs > smokeTimingWarningMs) {
    console.warn(
      `${browserName} smoke timing warning: ${metric}=${roundedMs}ms exceeds warning budget ${smokeTimingWarningMs}ms`
    );
  }

  const outputPath =
    process.env.LEAKGUARD_SMOKE_TIMINGS_FILE ||
    path.join(repoRoot, "artifacts", "runtime-budgets", "smoke-timings.jsonl");
  const payload = {
    generatedAt: new Date().toISOString(),
    browser: browserName.toLowerCase(),
    metric,
    ms: roundedMs,
    warningMs: smokeTimingWarningMs,
    warningExceeded: roundedMs > smokeTimingWarningMs
  };
  try {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.appendFileSync(outputPath, `${JSON.stringify(payload)}\n`);
  } catch (error) {
    console.warn(`${browserName} smoke timing warning: ${error.message}`);
  }
}

function normalizePathForCompare(value) {
  return path.resolve(String(value || "")).toLowerCase();
}

function findExtensionIdInProfile(profileDir, expectedExtensionDir = extensionDir) {
  const preferencesPath = path.join(profileDir, "Default", "Preferences");
  if (!fs.existsSync(preferencesPath)) return "";
  try {
    const preferences = JSON.parse(fs.readFileSync(preferencesPath, "utf8"));
    const settings = preferences?.extensions?.settings || {};
    const expectedPath = normalizePathForCompare(expectedExtensionDir);
    for (const [id, setting] of Object.entries(settings)) {
      const manifestName = setting?.manifest?.name || "";
      const extensionPath = setting?.path || "";
      if (manifestName === "LeakGuard" || normalizePathForCompare(extensionPath) === expectedPath) {
        return id;
      }
    }
  } catch {
    return "";
  }
  return "";
}

async function getExtensionId(connection, profileDir, expectedExtensionDir = extensionDir) {
  let lastTargets = [];
  const target = await waitFor(async () => {
    const { targetInfos } = await connection.send("Target.getTargets");
    lastTargets = targetInfos;
    const serviceWorker = targetInfos.find(
      (info) =>
        info.type === "service_worker" &&
        /^chrome-extension:\/\/[^/]+\/background\/service_worker\.js$/.test(info.url)
    );
    if (serviceWorker) return serviceWorker;
    const idFromProfile = findExtensionIdInProfile(profileDir, expectedExtensionDir);
    return idFromProfile ? { url: `chrome-extension://${idFromProfile}/background/service_worker.js` } : null;
  }, "LeakGuard extension service worker").catch((error) => {
    const targetSummary = lastTargets
      .map((info) => `${info.type}:${info.url || info.title || "<blank>"}`)
      .join("\n");
    throw new Error(`${error.message}\nObserved targets:\n${targetSummary}`);
  });

  return new URL(target.url).hostname;
}

async function loadExtension(connection, profileDir, extensionPath = extensionDir, browserName = "Chrome") {
  try {
    const response = await connection.send("Extensions.loadUnpacked", {
      path: extensionPath,
      enableInIncognito: false
    });
    if (response.id) return response.id;
  } catch (error) {
    console.warn(`${browserName} smoke: CDP extension load warning: ${error.message}`);
  }
  return await getExtensionId(connection, profileDir, extensionPath);
}

async function extensionMessage(connection, sessionId, message) {
  const serialized = JSON.stringify(message);
  return await evaluate(
    connection,
    sessionId,
    `chrome.runtime.sendMessage(${serialized})`,
    { awaitPromise: true }
  );
}

async function runPopupSmoke(connection, extensionId) {
  const popup = await createPage(connection, `chrome-extension://${extensionId}/popup/popup.html`);
  await waitForEval(
    connection,
    popup.sessionId,
    "document.querySelector('#manage-btn') && document.querySelector('#file-scanner-btn')",
    "popup controls"
  );
  const popupText = await evaluate(connection, popup.sessionId, "document.body.innerText");
  assert.match(popupText, /Manage Protected Sites/);
  assert.match(popupText, /Open File Scanner/);
  return popup;
}

async function runBuiltInContentSmoke(connection, chatGptOrigin, browserName = "Chrome") {
  const page = await createPage(connection);
  const startedAt = Date.now();
  await navigate(connection, page.sessionId, `${chatGptOrigin}/`);
  await waitForEval(
    connection,
    page.sessionId,
    "Boolean(document.querySelector('.pwm-panel'))",
    "built-in protected site status panel"
  );
  recordSmokeTiming(browserName, "protected_site_panel_ready_ms", Date.now() - startedAt);

  const panel = await evaluate(connection, page.sessionId, `(() => {
    const rows = Array.from(document.querySelectorAll('.pwm-panel-row')).map((row) => row.innerText);
    return {
      text: document.querySelector('.pwm-panel')?.innerText || '',
      rows
    };
  })()`);
  assert.match(panel.text, /LeakGuard/);
  assert.match(panel.rows.join("\n"), /PROTECTION\s+Active/i);
  assert.match(panel.rows.join("\n"), /chatgpt\.com/);

  return page;
}

async function runComposerRedactionSmoke(connection, page) {
  const rawSecret = "sk_live_7Qm2Lp9Xv4Nc8Tr6Yh1Zw5Kd3Bj0Pf";
  const redacted = await evaluate(connection, page.sessionId, `new Promise((resolve, reject) => {
    const textarea = document.querySelector('#prompt-textarea');
    textarea.focus();
    let prevented = false;
    const transfer = new DataTransfer();
    transfer.setData('text/plain', 'API_KEY=${rawSecret}');
    const event = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: transfer
    });
    textarea.dispatchEvent(event);
    prevented = event.defaultPrevented;
    const started = Date.now();
    const timer = setInterval(() => {
      if (/\\[PWM_\\d+\\]/.test(textarea.value)) {
        clearInterval(timer);
        resolve({
          value: textarea.value,
          badge: document.querySelector('.pwm-badge')?.textContent || '',
          prevented
        });
        return;
      }
      const redactButton = Array.from(document.querySelectorAll('.pwm-modal-backdrop button, .pwm-modal button'))
        .find((button) => /Redact/i.test(button.textContent || ''));
      if (redactButton) {
        redactButton.click();
      } else if (Date.now() - started > 10000) {
        clearInterval(timer);
        reject(new Error('Timed out waiting for composer redaction: ' + textarea.value));
      }
    }, 50);
  })`);

  assert.match(redacted.value, /API_KEY=\[PWM_\d+\]/);
  assert.equal(redacted.value.includes(rawSecret), false);

  return { rawSecret, placeholder: redacted.value.match(/\[PWM_\d+\]/)?.[0] || "[PWM_1]" };
}

async function runSecureRevealSmoke(connection, page, extensionId, rawSecret, placeholder) {
  const revealState = await evaluate(connection, page.sessionId, `new Promise((resolve, reject) => {
    const echo = document.querySelector('#echo-zone');
    echo.textContent = 'Assistant echoed ${placeholder} after redaction.';
    const started = Date.now();
    const timer = setInterval(() => {
      const chip = document.querySelector('#echo-zone .pwm-secret');
      if (chip) {
        clearInterval(timer);
        chip.click();
        setTimeout(() => resolve({
          chipText: chip.textContent,
          badge: document.querySelector('.pwm-badge')?.textContent || ''
        }), 250);
      } else if (Date.now() - started > 5000) {
        clearInterval(timer);
        reject(new Error('Timed out waiting for hydrated placeholder chip'));
      }
    }, 50);
  })`);
  assert.equal(revealState.chipText, placeholder);

  const popup = await createPage(connection, `chrome-extension://${extensionId}/popup/popup.html`);
  await waitForEval(
    connection,
    popup.sessionId,
    "document.querySelector('#reveal-view') && !document.querySelector('#reveal-view').hidden",
    "secure reveal popup view"
  );
  const beforeShow = await evaluate(connection, popup.sessionId, `({
    placeholder: document.querySelector('#reveal-placeholder')?.textContent || '',
    secretHidden: document.querySelector('#secret-value')?.hidden,
    secretText: document.querySelector('#secret-value')?.textContent || ''
  })`);
  assert.equal(beforeShow.placeholder, placeholder);
  assert.equal(beforeShow.secretHidden, true);
  assert.equal(beforeShow.secretText.includes(rawSecret), false);

  const afterShow = await evaluate(connection, popup.sessionId, `new Promise((resolve) => {
    document.querySelector('#show-btn').click();
    setTimeout(() => resolve({
      hidden: document.querySelector('#secret-value')?.hidden,
      raw: document.querySelector('#secret-value')?.textContent || '',
      status: document.querySelector('#reveal-status')?.textContent || ''
    }), 250);
  })`);
  assert.equal(afterShow.hidden, false);
  assert.equal(afterShow.raw, rawSecret);
  assert.match(afterShow.status, /Visible only inside this LeakGuard popup/);
}

const JS_CODE_ESCAPE_MAP = {
  "<": "\\u003C",
  ">": "\\u003E",
  "/": "\\u002F",
  "\\": "\\\\",
  "\b": "\\b",
  "\f": "\\f",
  "\n": "\\n",
  "\r": "\\r",
  "\t": "\\t",
  "\0": "\\0",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029"
};

function escapeForJsCode(str) {
  return str.replace(/[<>/\\\b\f\n\r\t\0\u2028\u2029]/g, (ch) => JS_CODE_ESCAPE_MAP[ch]);
}

async function ensureSmokeHostPermission(connection, extensionSessionId, originPattern) {
  if (process.env.LEAKGUARD_CHROME_SMOKE_INTERACTIVE_PERMISSIONS === "1") {
    const granted = await evaluate(
      connection,
      extensionSessionId,
      `new Promise((resolve) => chrome.permissions.request({ origins: [${escapeForJsCode(JSON.stringify(originPattern))}] }, resolve))`,
      { awaitPromise: true, userGesture: true }
    );
    assert.equal(granted, true, `Expected Chrome to grant optional host permission ${originPattern}`);
    return;
  }

  const hasPermission = await evaluate(
    connection,
    extensionSessionId,
    `new Promise((resolve) => chrome.permissions.contains({ origins: [${escapeForJsCode(JSON.stringify(originPattern))}] }, resolve))`,
    { awaitPromise: true }
  );

  assert.equal(
    hasPermission,
    true,
    `Expected smoke-test manifest copy to pregrant ${originPattern}`
  );
}

async function runUserManagedSiteSmoke(connection, extensionSessionId, userOrigin) {
  const matchPattern = "http://127.0.0.1/*";
  await ensureSmokeHostPermission(connection, extensionSessionId, matchPattern);

  const addResponse = await extensionMessage(connection, extensionSessionId, {
    type: "PWM_ADD_PROTECTED_SITE",
    input: "http://127.0.0.1",
    url: `${userOrigin}/`
  });
  assert.equal(addResponse.ok, true);
  assert.equal(addResponse.rule.id, "http://127.0.0.1");

  const activeOverview = await extensionMessage(connection, extensionSessionId, {
    type: "PWM_GET_PROTECTED_SITE_OVERVIEW",
    url: `${userOrigin}/`
  });
  assert.equal(activeOverview.ok, true);
  assert.equal(activeOverview.currentSite.protected, true);
  assert.equal(activeOverview.currentSite.source, "user");

  const userPage = await createPage(connection, `${userOrigin}/`);
  await waitForEval(
    connection,
    userPage.sessionId,
    "Boolean(document.querySelector('.pwm-panel'))",
    "user-managed protected site content script"
  );

  const disableResponse = await extensionMessage(connection, extensionSessionId, {
    type: "PWM_SET_PROTECTED_SITE_ENABLED",
    siteId: "http://127.0.0.1",
    enabled: false,
    url: `${userOrigin}/`
  });
  assert.equal(disableResponse.ok, true);
  assert.equal(disableResponse.rule.enabled, false);

  const disabledOverview = await extensionMessage(connection, extensionSessionId, {
    type: "PWM_GET_PROTECTED_SITE_OVERVIEW",
    url: `${userOrigin}/`
  });
  assert.equal(disabledOverview.ok, true);
  assert.equal(disabledOverview.currentSite.protected, false);
}

async function runScannerSmoke(connection, extensionId, tempDir) {
  const scanner = await createPage(connection, `chrome-extension://${extensionId}/scanner/scanner.html`);
  await waitForEval(connection, scanner.sessionId, "Boolean(document.querySelector('#file-input'))", "scanner UI");

  const supportedPath = path.join(tempDir, "smoke.env");
  fs.writeFileSync(supportedPath, "API_KEY=sk_live_7Qm2Lp9Xv4Nc8Tr6Yh1Zw5Kd3Bj0Pf\n");
  await setFileInputFiles(connection, scanner.sessionId, "#file-input", [supportedPath]);

  const supported = await evaluate(connection, scanner.sessionId, `new Promise((resolve, reject) => {
    const started = Date.now();
    let scanClicked = false;
    const timer = setInterval(() => {
      const preview = document.querySelector('#redacted-preview')?.textContent || '';
      const status = document.querySelector('#status')?.textContent || '';
      const scanBtn = document.querySelector('#scan-btn');
      if (!scanClicked && scanBtn && !scanBtn.disabled) {
        scanClicked = true;
        scanBtn.click();
      }
      if (/\\[PWM_\\d+\\]/.test(preview)) {
        clearInterval(timer);
        resolve({ preview, status });
      } else if (Date.now() - started > 15000) {
        clearInterval(timer);
        reject(new Error('Timed out waiting for scanner result: ' + JSON.stringify({
          status,
          scanDisabled: scanBtn?.disabled,
          fileName: document.querySelector('#file-name')?.textContent || '',
          fileType: document.querySelector('#file-type')?.textContent || '',
          inputFiles: Array.from(document.querySelector('#file-input')?.files || []).map((file) => ({
            name: file.name,
            type: file.type,
            size: file.size
          })),
          preview
        })));
      }
    }, 50);
  })`);
  assert.match(supported.preview, /API_KEY=\[PWM_\d+\]/);
  assert.equal(supported.preview.includes("sk_live_"), false);
  assert.match(supported.status, /Scan complete/);

  await evaluate(connection, scanner.sessionId, "document.querySelector('#clear-btn').click()");
  await waitForEval(
    connection,
    scanner.sessionId,
    "document.querySelector('#scan-btn')?.disabled && !(document.querySelector('#status')?.textContent || '')",
    "scanner reset"
  );

  const unsupportedPath = path.join(tempDir, "unsupported.pdf");
  fs.writeFileSync(unsupportedPath, "%PDF-1.7\n");
  await setFileInputFiles(connection, scanner.sessionId, "#file-input", [unsupportedPath]);
  const unsupported = await evaluate(connection, scanner.sessionId, `new Promise((resolve, reject) => {
    const started = Date.now();
    let scanClicked = false;
    const timer = setInterval(() => {
      const status = document.querySelector('#status')?.textContent || '';
      const scanBtn = document.querySelector('#scan-btn');
      const scanDisabled = scanBtn?.disabled;
      if (!scanClicked && scanBtn && !scanBtn.disabled) {
        scanClicked = true;
        scanBtn.click();
      }
      if (/could not find extractable text/i.test(status) && /OCR are not supported/i.test(status)) {
        clearInterval(timer);
        resolve({ status, scanDisabled });
      } else if (Date.now() - started > 10000) {
        clearInterval(timer);
        reject(new Error('Timed out waiting for unsupported warning: ' + JSON.stringify({
          status,
          scanDisabled,
          fileName: document.querySelector('#file-name')?.textContent || '',
          fileType: document.querySelector('#file-type')?.textContent || '',
          inputFiles: Array.from(document.querySelector('#file-input')?.files || []).map((file) => ({
            name: file.name,
            type: file.type,
            size: file.size
          }))
        })));
      }
    }, 50);
  })`);
  assert.match(unsupported.status, /could not find extractable text/i);
  assert.match(unsupported.status, /OCR are not supported/i);
}

async function runOcrWasmProbeSmoke(connection, extensionId, browserName = "Chrome") {
  const page = await createPage(connection, `chrome-extension://${extensionId}/scanner/scanner.html`);
  await waitForEval(connection, page.sessionId, "Boolean(document.querySelector('#file-input'))", "scanner UI");

  const result = await evaluate(
    connection,
    page.sessionId,
    `new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/shared/ocr/ocrRuntime.js';
      script.onload = async () => {
        try {
          const runtime = globalThis.PWM?.OcrRuntime;
          const worker = await runtime.createWorkerProbe();
          const wasm = await runtime.createWasmProbe();
          const engine = await runtime.createEngineProbe();
          const core = await runtime.createTesseractCoreProbe();
          const language = await runtime.createLanguageProbe('eng');
          const recognition = await runtime.createRecognitionProbe();
          runtime.terminate();
          resolve({ worker, wasm, engine, core, language, recognition });
        } catch (error) {
          reject(new Error(error?.message || 'OCR WASM probe failed'));
        }
      };
      script.onerror = () => reject(new Error('OCR runtime script failed to load'));
      document.documentElement.appendChild(script);
    })`,
    { awaitPromise: true }
  );

  assert.deepEqual(result.worker, {
    ok: true,
    status: "worker_ready",
    ocrImplemented: false
  });
  console.log(
    `${browserName} smoke: OCR WASM worker proof result ${result.wasm.status}${
      result.wasm.reason ? ` (${result.wasm.reason})` : ""
    }`
  );
  assert.deepEqual(result.wasm, {
    ok: true,
    status: "wasm_ready",
    wasmLoaded: true
  });
  assert.deepEqual(result.engine, {
    ok: false,
    status: "engine_blocked",
    ocrImplemented: false,
    engine: null,
    reason: "no_candidate_passed_security_size_csp_gates"
  });
  console.log(
    `${browserName} smoke: tesseract.js-core proof result ${result.core.status}${
      result.core.reason ? ` (${result.core.reason})` : ""
    }`
  );
  assert.deepEqual(result.core, {
    ok: true,
    status: "tesseract_core_ready",
    ocrImplemented: false
  });
  console.log(
    `${browserName} smoke: English traineddata proof result ${result.language.status}${
      result.language.reason ? ` (${result.language.reason})` : ""
    }`
  );
  assert.deepEqual(result.language, {
    ok: true,
    status: "language_ready",
    language: "eng",
    ocrImplemented: false
  });
  console.log(
    `${browserName} smoke: synthetic OCR recognition proof result ${result.recognition.status}${
      result.recognition.reason ? ` (${result.recognition.reason})` : ""
    }`
  );
  assert.deepEqual(result.recognition, {
    ok: true,
    status: "ocr_recognition_ready",
    ocrImplemented: true,
    language: "eng",
    textLength: 8,
    containsExpectedText: true,
    confidenceBucket: "high"
  });
}

async function runChromiumSmoke(options = {}) {
  const {
    browserName = "Chrome",
    sourceExtensionDir = extensionDir,
    buildCommand = "npm run build:chrome",
    findBrowserExecutable = findChromeExecutable,
    headlessEnvName = "LEAKGUARD_CHROME_HEADLESS",
    missingMessage = "Chrome stable or Chromium was not found. Set CHROME_BIN to run this smoke test.",
    remoteDebuggingMode = "port"
  } = options;
  const debuggingMode = normalizeRemoteDebuggingMode(remoteDebuggingMode);
  assertBuiltExtensionExists(sourceExtensionDir, buildCommand);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `leakguard-${browserName.toLowerCase()}-smoke-`));
  const profileDir = path.join(tempDir, "profile");
  fs.mkdirSync(profileDir, { recursive: true });
  const smokeExtensionDir = prepareSmokeExtension(tempDir, sourceExtensionDir);

  let httpServer = null;
  let httpsServer = null;
  let chrome = null;
  let connection = null;

  try {
    httpServer = await startHttpServer();
    httpsServer = await startHttpsChatGptServer(tempDir);

    chrome = await launchChrome({
      extensionPath: smokeExtensionDir,
      profileDir,
      browserName,
      browserExecutable: findBrowserExecutable(),
      headlessEnvName,
      missingMessage,
      remoteDebuggingMode: debuggingMode
    });

    if (chrome.debuggingMode === "port") {
      const webSocketUrl = await findCdpWebSocketUrl(chrome.debuggingPort, browserName);
      connection = new CdpWebSocketConnection(webSocketUrl);
    } else {
      connection = new CdpPipeConnection(chrome.child.stdio[3], chrome.child.stdio[4]);
    }
    await connection.connect();
    await connection.send("Target.setDiscoverTargets", { discover: true });

    const extensionId = await loadExtension(connection, profileDir, smokeExtensionDir, browserName);
    console.log(`${browserName} smoke: extension loaded (${extensionId})`);
    console.log(`${browserName} smoke: popup`);
    const popup = await runPopupSmoke(connection, extensionId);
    console.log(`${browserName} smoke: built-in protected site`);
    const builtInPage = await runBuiltInContentSmoke(connection, httpsServer.origin, browserName);
    console.log(`${browserName} smoke: composer redaction`);
    const { rawSecret, placeholder } = await runComposerRedactionSmoke(connection, builtInPage);
    console.log(`${browserName} smoke: secure reveal`);
    await runSecureRevealSmoke(connection, builtInPage, extensionId, rawSecret, placeholder);
    console.log(`${browserName} smoke: user-managed protected site`);
    await runUserManagedSiteSmoke(connection, popup.sessionId, httpServer.origin);
    console.log(`${browserName} smoke: OCR WASM worker proof`);
    await runOcrWasmProbeSmoke(connection, extensionId, browserName);
    console.log(`${browserName} smoke: file scanner`);
    await runScannerSmoke(connection, extensionId, tempDir);

    console.log(`PASS ${browserName.toLowerCase()} extension smoke`);
  } catch (error) {
    if (chrome?.stderr?.()) {
      console.error(chrome.stderr());
    }
    throw error;
  } finally {
    await connection?.send("Browser.close").catch(() => {});
    await connection?.close().catch(() => {});
    await waitForChromeExit(chrome?.child, 3000);
    if (chrome?.child && chrome.child.exitCode === null && chrome.child.signalCode === null) {
      chrome.child.kill();
      await waitForChromeExit(chrome.child, 3000);
    }
    await httpServer?.close().catch(() => {});
    await httpsServer?.close().catch(() => {});
    try {
      fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    } catch (error) {
      console.warn(`${browserName} smoke cleanup warning: ${error.message}`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runChromiumSmoke().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export {
  CdpPipeConnection,
  CdpWebSocketConnection,
  findExecutable,
  findCdpWebSocketUrl,
  launchChrome,
  runChromiumSmoke
};
