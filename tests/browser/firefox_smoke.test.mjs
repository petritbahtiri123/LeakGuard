import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createSign, generateKeyPairSync, randomBytes } from "node:crypto";
import fs from "node:fs";
import https from "node:https";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yazl from "yazl";
import { findExecutable } from "./chrome_smoke.test.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const extensionDir = path.join(repoRoot, "dist", "firefox");
const smokeTimeoutMs = Number(process.env.LEAKGUARD_FIREFOX_SMOKE_TIMEOUT_MS || 60000);
const webdriverCommandTimeoutMs = Number(process.env.LEAKGUARD_FIREFOX_WEBDRIVER_TIMEOUT_MS || 30000);

function assertBuiltExtensionExists() {
  const manifestPath = path.join(extensionDir, "manifest.json");
  assert.ok(
    fs.existsSync(manifestPath),
    `Expected ${manifestPath}. Run npm run build:firefox before the smoke test.`
  );
}

function findFirefoxExecutable() {
  const localAppData = process.env.LOCALAPPDATA || "";
  const windowsCandidates =
    process.platform === "win32"
      ? [
          path.join(process.env.PROGRAMFILES || "", "Mozilla Firefox", "firefox.exe"),
          path.join(process.env["PROGRAMFILES(X86)"] || "", "Mozilla Firefox", "firefox.exe"),
          path.join(localAppData, "Mozilla Firefox", "firefox.exe")
        ]
      : [];
  const macCandidates =
    process.platform === "darwin" ? ["/Applications/Firefox.app/Contents/MacOS/firefox"] : [];

  return findExecutable([
    process.env.FIREFOX_BIN,
    ...windowsCandidates,
    ...macCandidates,
    "firefox",
    "firefox-esr"
  ]);
}

function findGeckodriverCommand() {
  const explicit = process.env.GECKODRIVER_BIN || "";
  if (explicit) return { command: explicit, argsPrefix: [], processTreeKill: false };
  const fromPath = findExecutable(["geckodriver"]);
  if (fromPath) return { command: fromPath, argsPrefix: [], processTreeKill: false };
  return {
    command: "npm",
    argsPrefix: ["exec", "--yes", "--package", "geckodriver", "--", "geckodriver"],
    processTreeKill: true,
    wrapWithWindowsCmd: process.platform === "win32"
  };
}

function quoteForWindowsCmd(value) {
  const text = String(value);
  if (!/[ \t"&^<>|()]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
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

function recordSmokeTiming(metric, elapsedMs) {
  const roundedMs = Number(elapsedMs.toFixed(1));
  console.log(`Firefox smoke metric: ${metric}=${roundedMs}ms`);

  const outputPath =
    process.env.LEAKGUARD_SMOKE_TIMINGS_FILE ||
    path.join(repoRoot, "artifacts", "runtime-budgets", "smoke-timings.jsonl");
  const payload = {
    generatedAt: new Date().toISOString(),
    browser: "firefox",
    metric,
    ms: roundedMs
  };
  try {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.appendFileSync(outputPath, `${JSON.stringify(payload)}\n`);
  } catch (error) {
    console.warn(`Firefox smoke timing warning: ${error.message}`);
  }
}

function createHarnessPage() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>LeakGuard Firefox Smoke Harness</title>
  </head>
  <body>
    <main>
      <h1>LeakGuard Firefox Smoke Harness</h1>
      <div id="chat-form" role="form">
        <textarea id="prompt-textarea" data-testid="prompt-textarea" placeholder="Message"></textarea>
        <button id="send-button" type="button">Send</button>
      </div>
      <section id="echo-zone"></section>
    </main>
  </body>
</html>`;
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
  if (bytes[0] & 0x80) bytes = Buffer.concat([Buffer.from([0]), bytes]);
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

function subjectAltNameExtension() {
  return derSequence([
    derOid("2.5.29.17"),
    derOctetString(
      derSequence([
        derContextPrimitive(2, Buffer.from("chatgpt.com", "ascii")),
        derContextPrimitive(7, Buffer.from([127, 0, 0, 1]))
      ])
    )
  ]);
}

function createSelfSignedCertificateDer({ privateKey, publicKey }) {
  const now = Date.now();
  const serial = randomBytes(16);
  serial[0] &= 0x7f;
  const tbs = derSequence([
    derExplicit(0, derInteger(2)),
    derInteger(serial),
    algorithmIdentifier(),
    name("chatgpt.com"),
    derSequence([
      derUtcTime(new Date(now - 60 * 60 * 1000)),
      derUtcTime(new Date(now + 24 * 60 * 60 * 1000))
    ]),
    name("chatgpt.com"),
    publicKey.export({ type: "spki", format: "der" }),
    derExplicit(3, derSequence([subjectAltNameExtension()]))
  ]);

  const signer = createSign("RSA-SHA256");
  signer.update(tbs);
  signer.end();
  return derSequence([tbs, algorithmIdentifier(), derBitString(signer.sign(privateKey))]);
}

function toPem(label, derBytes) {
  const base64 = Buffer.from(derBytes).toString("base64").match(/.{1,64}/g).join("\n");
  return `-----BEGIN ${label}-----\n${base64}\n-----END ${label}-----\n`;
}

function createSelfSignedCertificate() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return {
    key: privateKey.export({ type: "pkcs8", format: "pem" }),
    cert: toPem("CERTIFICATE", createSelfSignedCertificateDer({ privateKey, publicKey }))
  };
}

async function startHttpsChatGptServer() {
  const server = https.createServer(createSelfSignedCertificate(), (request, response) => {
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    });
    response.end(createHarnessPage());
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    server,
    origin: `https://chatgpt.com:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

async function startConnectProxy() {
  const server = net.createServer((client) => {
    client.once("data", (chunk) => {
      const header = chunk.toString("latin1");
      const firstLine = header.split(/\r?\n/, 1)[0] || "";
      const match = /^CONNECT\s+([^:]+):(\d+)\s+HTTP\/1\.[01]$/i.exec(firstLine);
      if (!match || match[1].toLowerCase() !== "chatgpt.com") {
        client.end("HTTP/1.1 501 Not Implemented\r\nConnection: close\r\n\r\n");
        return;
      }

      const upstream = net.connect(Number(match[2]), "127.0.0.1", () => {
        client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        client.pipe(upstream);
        upstream.pipe(client);
      });
      upstream.on("error", () => client.destroy());
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    server,
    address: `127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

function walkFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(fullPath));
    if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

async function packageFirefoxExtension(tempDir) {
  const xpiPath = path.join(tempDir, "leakguard-firefox-smoke.xpi");
  const zip = new yazl.ZipFile();
  for (const file of walkFiles(extensionDir)) {
    zip.addFile(file, path.relative(extensionDir, file).split(path.sep).join("/"));
  }
  zip.end();
  await new Promise((resolve, reject) => {
    zip.outputStream.pipe(fs.createWriteStream(xpiPath)).on("close", resolve).on("error", reject);
  });
  return xpiPath;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${url} failed with ${response.status}: ${text}`);
  }
  return payload;
}

class WebDriverClient {
  constructor(port) {
    this.baseUrl = `http://127.0.0.1:${port}`;
    this.sessionId = "";
  }

  async request(method, endpoint, body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), webdriverCommandTimeoutMs);
    try {
      const payload = await fetchJson(`${this.baseUrl}${endpoint}`, {
        method,
        headers: body === undefined ? undefined : { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal
      });
      return payload.value ?? payload;
    } finally {
      clearTimeout(timeout);
    }
  }

  async createSession({ firefoxPath, proxyAddress }) {
    const firefoxArgs = [];
    if (process.env.LEAKGUARD_FIREFOX_HEADLESS === "1") firefoxArgs.push("-headless");
    const value = await this.request("POST", "/session", {
      capabilities: {
        alwaysMatch: {
          browserName: "firefox",
          acceptInsecureCerts: true,
          proxy: {
            proxyType: "manual",
            httpProxy: proxyAddress,
            sslProxy: proxyAddress,
            noProxy: []
          },
          "moz:firefoxOptions": {
            binary: firefoxPath,
            args: firefoxArgs,
            prefs: {
              "browser.shell.checkDefaultBrowser": false,
              "browser.startup.homepage_override.mstone": "ignore",
              "network.trr.mode": 5
            }
          }
        }
      }
    });
    this.sessionId = value.sessionId;
    assert.ok(this.sessionId, "Expected geckodriver to create a Firefox session.");
    await this.request("POST", `/session/${this.sessionId}/timeouts`, {
      implicit: 0,
      pageLoad: smokeTimeoutMs,
      script: webdriverCommandTimeoutMs
    });
  }

  async installAddon(xpiPath) {
    return await this.request("POST", `/session/${this.sessionId}/moz/addon/install`, {
      path: xpiPath,
      temporary: true
    });
  }

  async navigate(url) {
    await this.request("POST", `/session/${this.sessionId}/url`, { url });
  }

  async execute(script, args = []) {
    return await this.request("POST", `/session/${this.sessionId}/execute/sync`, { script, args });
  }

  async executeAsync(script, args = []) {
    return await this.request("POST", `/session/${this.sessionId}/execute/async`, { script, args });
  }

  async quit() {
    if (!this.sessionId) return;
    await this.request("DELETE", `/session/${this.sessionId}`).catch(() => {});
    this.sessionId = "";
  }
}

async function launchGeckodriver(port) {
  const geckodriver = findGeckodriverCommand();
  let command = geckodriver.command;
  let args = [...geckodriver.argsPrefix, "--host", "127.0.0.1", "--port", String(port)];
  if (geckodriver.wrapWithWindowsCmd) {
    const commandLine = [command, ...args].map(quoteForWindowsCmd).join(" ");
    command = process.env.ComSpec || "cmd.exe";
    args = ["/d", "/s", "/c", commandLine];
  }
  const child = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  child.stdout.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  await waitFor(async () => {
    try {
      const status = await fetchJson(`http://127.0.0.1:${port}/status`);
      return status.value?.ready || status.ready;
    } catch {
      return false;
    }
  }, "geckodriver status endpoint");
  return { child, processTreeKill: geckodriver.processTreeKill, stderr: () => stderr };
}

async function waitForExit(child, timeoutMs = 5000) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, timeoutMs))
  ]);
}

async function stopGeckodriver(geckodriver) {
  const child = geckodriver?.child;
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === "win32" && geckodriver.processTreeKill) {
    try {
      execFileSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    } catch {
      child.kill();
    }
  } else {
    child.kill();
  }
  child.stdout?.destroy();
  child.stderr?.destroy();
  await waitForExit(child, 3000);
}

async function runFirefoxSmoke() {
  assertBuiltExtensionExists();
  const firefoxPath = findFirefoxExecutable();
  assert.ok(firefoxPath, "Firefox stable was not found. Set FIREFOX_BIN to run this smoke test.");

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "leakguard-firefox-smoke-"));

  let geckodriver = null;
  let webdriver = null;
  let httpsServer = null;
  let proxy = null;

  try {
    httpsServer = await startHttpsChatGptServer();
    proxy = await startConnectProxy();
    const xpiPath = await packageFirefoxExtension(tempDir);

    const geckodriverPort = await getFreePort();
    console.log("Firefox smoke: geckodriver");
    geckodriver = await launchGeckodriver(geckodriverPort);
    webdriver = new WebDriverClient(geckodriverPort);
    console.log("Firefox smoke: session");
    await webdriver.createSession({
      firefoxPath,
      proxyAddress: proxy.address
    });

    const extensionId = await webdriver.installAddon(xpiPath);
    console.log(`Firefox smoke: temporary extension loaded (${extensionId || "installed"})`);
    console.log("Firefox smoke: built-in protected site");
    const panelStartedAt = Date.now();
    await webdriver.navigate(`${httpsServer.origin}/`);
    await waitFor(
      () => webdriver.execute("return Boolean(document.querySelector('.pwm-panel'));"),
      "built-in protected site status panel"
    );
    recordSmokeTiming("protected_site_panel_ready_ms", Date.now() - panelStartedAt);

    const panel = await webdriver.execute(`return {
      text: document.querySelector('.pwm-panel')?.innerText || '',
      rows: Array.from(document.querySelectorAll('.pwm-panel-row')).map((row) => row.innerText)
    };`);
    assert.match(panel.text, /LeakGuard/);
    assert.match(panel.rows.join("\n"), /PROTECTION\s+Active/i);
    assert.match(panel.rows.join("\n"), /chatgpt\.com/);

    console.log("Firefox smoke: composer redaction");
    const rawSecret = "sk_live_7Qm2Lp9Xv4Nc8Tr6Yh1Zw5Kd3Bj0Pf";
    const redacted = await webdriver.executeAsync(`const done = arguments[arguments.length - 1];
      const rawSecret = ${JSON.stringify(rawSecret)};
      const textarea = document.querySelector('#prompt-textarea');
      textarea.focus();
      const event = new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: 'API_KEY=' + rawSecret
      });
      textarea.dispatchEvent(event);
      const started = Date.now();
      const timer = setInterval(() => {
        if (/\\[PWM_\\d+\\]/.test(textarea.value)) {
          clearInterval(timer);
          done({ value: textarea.value, body: document.body.innerText || '' });
          return;
        }
        const redactButton = Array.from(document.querySelectorAll('.pwm-modal-backdrop button, .pwm-modal button'))
          .find((button) => /Redact/i.test(button.textContent || ''));
        if (redactButton) {
          redactButton.click();
        } else if (Date.now() - started > 15000) {
          clearInterval(timer);
          done({ value: textarea.value, body: document.body.innerText || '', error: 'Timed out waiting for redaction' });
        }
      }, 50);`);

    assert.equal(redacted.error, undefined, redacted.error || "Firefox redaction failed");
    assert.match(redacted.value, /API_KEY=\[PWM_\d+\]/);
    assert.equal(redacted.value.includes(rawSecret), false);

    console.log("PASS firefox extension smoke");
  } catch (error) {
    if (geckodriver?.stderr?.()) console.error(geckodriver.stderr());
    throw error;
  } finally {
    await webdriver?.quit();
    await stopGeckodriver(geckodriver);
    await httpsServer?.close().catch(() => {});
    await proxy?.close().catch(() => {});
    fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

runFirefoxSmoke().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
