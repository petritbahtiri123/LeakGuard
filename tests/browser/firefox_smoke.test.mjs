import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createSign, generateKeyPairSync, randomBytes } from "node:crypto";
import fs from "node:fs";
import https from "node:https";
import { createRequire } from "node:module";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yazl from "yazl";
import { findExecutable } from "./chrome_smoke.test.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const require = createRequire(import.meta.url);
const { sanitizeBrowserQaText } = require(path.join(repoRoot, "tests/helpers/browserQaAssertions.js"));
const extensionDir = path.join(repoRoot, "dist", "firefox");
const smokeTimeoutMs = Number(process.env.LEAKGUARD_FIREFOX_SMOKE_TIMEOUT_MS || 60000);
const webdriverCommandTimeoutMs = Number(process.env.LEAKGUARD_FIREFOX_WEBDRIVER_TIMEOUT_MS || 30000);
const smokeTimingWarningMs = Number(process.env.LEAKGUARD_SMOKE_TIMING_WARN_MS || 5000);
const firefoxExtensionId = "leakguard@test.local";
const localProtectedSiteInput = "https://127.0.0.1";
const localProtectedSiteId = "https://127.0.0.1";
const localProtectedSitePermission = "https://127.0.0.1/*";

const syntheticSecrets = {
  openAi: ["sk-proj", "A".repeat(48)].join("-"),
  anthropic: ["sk-ant-api03", "B".repeat(44)].join("-"),
  github: `ghp_${"C".repeat(36)}`,
  stripe: `sk_live_${"D".repeat(32)}`,
  databasePassword: "SuperFakePassword123",
  publicIp: "8.8.8.8",
  privateIp: "192.168.1.10"
};

const promptLines = [
  `OPENAI_API_KEY=${syntheticSecrets.openAi}`,
  `OPENAI_API_KEY_REPEAT=${syntheticSecrets.openAi}`,
  `ANTHROPIC_API_KEY=${syntheticSecrets.anthropic}`,
  `GITHUB_TOKEN=${syntheticSecrets.github}`,
  `STRIPE_SECRET_KEY=${syntheticSecrets.stripe}`,
  `DATABASE_URL=postgres://admin:${syntheticSecrets.databasePassword}@db.example.com:5432/customerdb`,
  `PUBLIC_IP=${syntheticSecrets.publicIp}`,
  `PRIVATE_IP=${syntheticSecrets.privateIp}`,
  "PLACEHOLDER_ALREADY=[PWM_1]"
];
const promptPayload = promptLines.join("\n");
const rawValues = [
  syntheticSecrets.openAi,
  syntheticSecrets.anthropic,
  syntheticSecrets.github,
  syntheticSecrets.stripe,
  syntheticSecrets.databasePassword,
  syntheticSecrets.publicIp,
  syntheticSecrets.privateIp
];
const firefoxSmokeSecretCanaries = Object.freeze([
  { id: "LGQA_FIREFOX_OPENAI_001", value: syntheticSecrets.openAi, expectedPlaceholder: "[PWM_N]" },
  { id: "LGQA_FIREFOX_ANTHROPIC_001", value: syntheticSecrets.anthropic, expectedPlaceholder: "[PWM_N]" },
  { id: "LGQA_FIREFOX_GITHUB_001", value: syntheticSecrets.github, expectedPlaceholder: "[PWM_N]" },
  { id: "LGQA_FIREFOX_STRIPE_001", value: syntheticSecrets.stripe, expectedPlaceholder: "[PWM_N]" },
  { id: "LGQA_FIREFOX_DB_PASSWORD_001", value: syntheticSecrets.databasePassword, expectedPlaceholder: "[PWM_N]" },
  { id: "LGQA_FIREFOX_PUBLIC_IP_001", value: syntheticSecrets.publicIp, expectedPlaceholder: "[PUB_HOST_N]" },
  { id: "LGQA_FIREFOX_PRIVATE_IP_001", value: syntheticSecrets.privateIp, expectedPlaceholder: "[PRIVATE_IP_N]" }
]);
const firefoxFeedbackForbiddenCanaries = Object.freeze([
  "FIREFOX_PROMPT_SHOULD_NOT_APPEAR",
  "FIREFOX_MESSAGE_SHOULD_NOT_APPEAR",
  "FIREFOX_FILE_CONTENT_SHOULD_NOT_APPEAR",
  "firefox-secret-file.env",
  "FIREFOX_OCR_TEXT_SHOULD_NOT_APPEAR",
  "https://example.test/path?token=FIREFOX_QUERY_SHOULD_NOT_APPEAR",
  "FIREFOX_DOM_TEXT_SHOULD_NOT_APPEAR",
  "FIREFOX_SCREENSHOT_SHOULD_NOT_APPEAR",
  "FIREFOX_LOG_SHOULD_NOT_APPEAR",
  "FIREFOX_DIAGNOSTIC_SHOULD_NOT_APPEAR"
]);

function firefoxSmokeCanaryLabel(raw) {
  return firefoxSmokeSecretCanaries.find((canary) => canary.value === raw)?.id || "raw synthetic canary";
}

function sanitizeFirefoxSmokeDiagnostic(value) {
  return sanitizeBrowserQaText(value, firefoxSmokeSecretCanaries);
}

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

function runVersionProbe(label, command, args) {
  try {
    const output = execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 15000
    }).trim();
    return output.split(/\r?\n/, 1)[0] || `${label} version probe returned no output`;
  } catch (error) {
    return `${label} version probe failed: ${error.message}`;
  }
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
  if (roundedMs > smokeTimingWarningMs) {
    console.warn(
      `Firefox smoke timing warning: ${metric}=${roundedMs}ms exceeds warning budget ${smokeTimingWarningMs}ms`
    );
  }

  const outputPath =
    process.env.LEAKGUARD_SMOKE_TIMINGS_FILE ||
    path.join(repoRoot, "artifacts", "runtime-budgets", "smoke-timings.jsonl");
  const payload = {
    generatedAt: new Date().toISOString(),
    browser: "firefox",
    metric,
    ms: roundedMs,
    warningMs: smokeTimingWarningMs,
    warningExceeded: roundedMs > smokeTimingWarningMs
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
  const port = server.address().port;
  return {
    server,
    origin: `https://chatgpt.com:${port}`,
    localOrigin: `https://127.0.0.1:${port}`,
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

function prepareFirefoxSmokeExtension(tempDir) {
  const smokeExtensionDir = path.join(tempDir, "extension");
  fs.cpSync(extensionDir, smokeExtensionDir, { recursive: true });

  const manifestPath = path.join(smokeExtensionDir, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.host_permissions = Array.from(
    new Set([...(manifest.host_permissions || []), localProtectedSitePermission])
  );
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return smokeExtensionDir;
}

async function packageFirefoxExtension(tempDir, sourceDir = extensionDir) {
  const xpiPath = path.join(tempDir, "leakguard-firefox-smoke.xpi");
  const zip = new yazl.ZipFile();
  for (const file of walkFiles(sourceDir)) {
    zip.addFile(file, path.relative(sourceDir, file).split(path.sep).join("/"));
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

function parseFirefoxPrefString(source, prefName) {
  const escapedPrefName = prefName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`user_pref\\("${escapedPrefName}",\\s*"((?:\\\\.|[^"])*)"\\);`).exec(
    source
  );
  if (!match) return null;
  return JSON.parse(`"${match[1]}"`);
}

function readFirefoxExtensionUuid(profileDir, extensionId) {
  const prefsPath = path.join(profileDir, "prefs.js");
  if (!fs.existsSync(prefsPath)) return null;

  const prefsSource = fs.readFileSync(prefsPath, "utf8");
  const uuidPref = parseFirefoxPrefString(prefsSource, "extensions.webextensions.uuids");
  if (!uuidPref) return null;

  const uuids = JSON.parse(uuidPref);
  return uuids?.[extensionId] || null;
}

async function getFirefoxExtensionOrigin(profileDir, extensionId) {
  const uuid = await waitFor(
    () => readFirefoxExtensionUuid(profileDir, extensionId),
    `Firefox extension UUID for ${extensionId}`
  );
  return `moz-extension://${uuid}`;
}

function assertNoRawSyntheticValues(text, label) {
  for (const raw of rawValues) {
    assert.equal(String(text || "").includes(raw), false, `${label} leaked ${firefoxSmokeCanaryLabel(raw)}`);
  }
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

  async createSession({ firefoxPath, proxyAddress, profileDir, downloadDir }) {
    const firefoxArgs = [];
    if (process.env.LEAKGUARD_FIREFOX_HEADLESS === "1") firefoxArgs.push("-headless");
    if (profileDir) firefoxArgs.push("-profile", profileDir);
    const value = await this.request("POST", "/session", {
      capabilities: {
        alwaysMatch: {
          browserName: "firefox",
          acceptInsecureCerts: true,
          proxy: {
            proxyType: "manual",
            httpProxy: proxyAddress,
            sslProxy: proxyAddress,
            noProxy: ["127.0.0.1", "localhost"]
          },
          "moz:firefoxOptions": {
            binary: firefoxPath,
            args: firefoxArgs,
            prefs: {
              "browser.shell.checkDefaultBrowser": false,
              "browser.startup.homepage_override.mstone": "ignore",
              "browser.download.alwaysOpenPanel": false,
              "browser.download.dir": downloadDir,
              "browser.download.folderList": 2,
              "browser.download.manager.showWhenStarting": false,
              "browser.download.panel.shown": true,
              "browser.download.useDownloadDir": true,
              "browser.helperApps.neverAsk.saveToDisk": "text/plain,application/json,application/octet-stream",
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

  async refresh() {
    await this.request("POST", `/session/${this.sessionId}/refresh`, {});
  }

  async execute(script, args = []) {
    return await this.request("POST", `/session/${this.sessionId}/execute/sync`, { script, args });
  }

  async executeAsync(script, args = []) {
    return await this.request("POST", `/session/${this.sessionId}/execute/async`, { script, args });
  }

  async findElement(selector) {
    const element = await this.request("POST", `/session/${this.sessionId}/element`, {
      using: "css selector",
      value: selector
    });
    const elementId = element?.["element-6066-11e4-a52e-4f735466cecf"] || element?.ELEMENT;
    assert.ok(elementId, `Expected to find element ${selector}`);
    return elementId;
  }

  async clickElement(selector) {
    const elementId = await this.findElement(selector);
    await this.request("POST", `/session/${this.sessionId}/element/${elementId}/click`, {});
  }

  async sendKeys(selector, text) {
    const elementId = await this.findElement(selector);
    const value = Array.from(String(text || ""));
    await this.request("POST", `/session/${this.sessionId}/element/${elementId}/value`, {
      text: String(text || ""),
      value
    });
  }

  async setFileInputFiles(selector, files) {
    const elementId = await this.findElement(selector);
    const normalizedFiles = Array.isArray(files) ? files : [files];
    await this.request("POST", `/session/${this.sessionId}/element/${elementId}/value`, {
      text: normalizedFiles.join("\n"),
      value: normalizedFiles
    });
    await this.execute(
      `const input = document.querySelector(arguments[0]);
      input?.dispatchEvent(new Event('input', { bubbles: true }));
      input?.dispatchEvent(new Event('change', { bubbles: true }));
      return true;`,
      [selector]
    );
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
  let versionCommand = command;
  let versionArgs = [...geckodriver.argsPrefix, "--version"];
  if (geckodriver.wrapWithWindowsCmd) {
    const commandLine = [command, ...args].map(quoteForWindowsCmd).join(" ");
    const versionCommandLine = [command, ...versionArgs].map(quoteForWindowsCmd).join(" ");
    command = process.env.ComSpec || "cmd.exe";
    args = ["/d", "/s", "/c", commandLine];
    versionCommand = command;
    versionArgs = ["/d", "/s", "/c", versionCommandLine];
  }
  const geckodriverVersion = runVersionProbe("geckodriver version", versionCommand, versionArgs);
  console.log(`Firefox smoke: geckodriver version: ${geckodriverVersion}`);
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
  try {
    await waitFor(async () => {
      try {
        const status = await fetchJson(`http://127.0.0.1:${port}/status`);
        return status.value?.ready || status.ready;
      } catch {
        return false;
      }
    }, `geckodriver status endpoint on 127.0.0.1:${port}`);
  } catch (error) {
    const diagnostics = [
      "Firefox environment failure: geckodriver status endpoint did not become ready.",
      "This is not classified as a LeakGuard product failure because Firefox did not start far enough to load the extension.",
      `geckodriver version: ${geckodriverVersion}`,
      `geckodriver command: ${command} ${args.join(" ")}`,
      `status endpoint: http://127.0.0.1:${port}/status`,
      `geckodriver output: ${stderr || "(no geckodriver output captured)"}`,
      `Original error: ${error.message}`,
      "Remediation: update geckodriver, ensure FIREFOX_BIN points to a current Firefox executable, free the blocked port if one is stuck, and run smoke:firefox alone."
    ].join("\n");
    child.kill();
    throw new Error(diagnostics);
  }
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

async function extensionMessage(webdriver, message) {
  return await webdriver.executeAsync(`const message = arguments[0];
    const done = arguments[arguments.length - 1];
    const ext = globalThis.browser || globalThis.chrome;
    Promise.resolve(ext.runtime.sendMessage(message)).then(done, (error) => {
      done({ ok: false, error: error?.message || String(error) });
    });`, [message]);
}

function getUserProtectedSite(overview) {
  return (overview.userSites || []).find((rule) => rule.id === localProtectedSiteId) || null;
}

async function getLocalProtectedSiteOverview(webdriver, localOrigin) {
  const overview = await extensionMessage(webdriver, {
    type: "PWM_GET_PROTECTED_SITE_OVERVIEW",
    url: `${localOrigin}/`
  });
  assert.equal(overview.ok, true);
  return overview;
}

function assertLocalProtectedSiteOverview(overview, expected) {
  const userRule = getUserProtectedSite(overview);

  assert.equal(overview.currentSite.eligible, true, "local harness should be eligible for protection");
  assert.equal(
    overview.currentSite.protected,
    expected.protected,
    "current-site protection state did not match"
  );
  assert.equal(overview.currentSite.source || null, expected.source || null);
  assert.equal(Boolean(userRule), expected.present, "user-managed site presence did not match");

  if (expected.present) {
    assert.equal(userRule.enabled, expected.enabled, "user-managed site enabled state did not match");
    assert.equal(userRule.matchPattern, localProtectedSitePermission);
    assert.equal(userRule.hasPermission, true);
  }
}

async function runFirefoxPopupAndProtectedSiteQa(webdriver, extensionOrigin, localOrigin) {
  await webdriver.navigate(`${extensionOrigin}/popup/popup.html`);
  await waitFor(
    () => webdriver.execute("return Boolean(document.querySelector('#manage-btn'));"),
    "Firefox popup ready"
  );

  const hasPermission = await webdriver.executeAsync(`const done = arguments[arguments.length - 1];
    const ext = globalThis.browser || globalThis.chrome;
    ext.permissions.contains({ origins: [arguments[0]] }).then(done);`, [localProtectedSitePermission]);
  assert.equal(hasPermission, true, "temporary Firefox XPI should pregrant localhost permission");

  const addResponse = await extensionMessage(webdriver, {
    type: "PWM_ADD_PROTECTED_SITE",
    input: localProtectedSiteInput,
    url: `${localOrigin}/`
  });
  assert.equal(addResponse.ok, true);
  assert.equal(addResponse.rule.id, localProtectedSiteId);
  assert.equal(addResponse.rule.enabled, true);
  assertLocalProtectedSiteOverview(await getLocalProtectedSiteOverview(webdriver, localOrigin), {
    present: true,
    enabled: true,
    protected: true,
    source: "user"
  });

  const disableResponse = await extensionMessage(webdriver, {
    type: "PWM_SET_PROTECTED_SITE_ENABLED",
    siteId: localProtectedSiteId,
    enabled: false,
    url: `${localOrigin}/`
  });
  assert.equal(disableResponse.ok, true);
  assert.equal(disableResponse.rule.enabled, false);
  assertLocalProtectedSiteOverview(await getLocalProtectedSiteOverview(webdriver, localOrigin), {
    present: true,
    enabled: false,
    protected: false,
    source: null
  });

  const reenableResponse = await extensionMessage(webdriver, {
    type: "PWM_SET_PROTECTED_SITE_ENABLED",
    siteId: localProtectedSiteId,
    enabled: true,
    url: `${localOrigin}/`
  });
  assert.equal(reenableResponse.ok, true);
  assert.equal(reenableResponse.rule.enabled, true);
  assertLocalProtectedSiteOverview(await getLocalProtectedSiteOverview(webdriver, localOrigin), {
    present: true,
    enabled: true,
    protected: true,
    source: "user"
  });
}

async function runFirefoxProtectedSiteRemovalQa(webdriver, localOrigin) {
  const deleteResponse = await extensionMessage(webdriver, {
    type: "PWM_DELETE_PROTECTED_SITE",
    siteId: localProtectedSiteId,
    url: `${localOrigin}/`
  });
  assert.equal(deleteResponse.ok, true);
  assert.equal(deleteResponse.rule.id, localProtectedSiteId);
  assertLocalProtectedSiteOverview(await getLocalProtectedSiteOverview(webdriver, localOrigin), {
    present: false,
    enabled: false,
    protected: false,
    source: null
  });
}

async function openFirefoxLocalProtectedHarness(webdriver, localOrigin) {
  await webdriver.navigate(`${localOrigin}/`);
  await waitFor(
    () => webdriver.execute("return Boolean(document.querySelector('.pwm-panel'));"),
    "Firefox user-managed protected site panel"
  );
  const panel = await webdriver.execute(`return {
    text: document.querySelector('.pwm-panel')?.innerText || '',
    rows: Array.from(document.querySelectorAll('.pwm-panel-row')).map((row) => row.innerText)
  };`);
  assert.match(panel.text, /LeakGuard/);
  assert.match(panel.rows.join("\n"), /PROTECTION\s+Active/i);
  assert.match(panel.rows.join("\n"), /127\.0\.0\.1/);
}

async function runFirefoxPromptRedactionQa(webdriver) {
  await webdriver.execute(`const payload = arguments[0];
    const textarea = document.querySelector('#prompt-textarea');
    textarea.focus();

    textarea.dispatchEvent(new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: payload
    }));
    return true;`, [promptPayload]);

  const result = await waitFor(async () => {
    const state = await webdriver.execute(`const rawValues = arguments[0];
      const textarea = document.querySelector('#prompt-textarea');
      const value = textarea.value || '';
      const first = /^OPENAI_API_KEY=(\\[PWM_\\d+\\])$/m.exec(value)?.[1] || '';
      const repeat = /^OPENAI_API_KEY_REPEAT=(\\[PWM_\\d+\\])$/m.exec(value)?.[1] || '';
      const ready = /\\[PWM_\\d+\\]/.test(value) &&
        /PUBLIC_IP=\\[(PUB_HOST|NET)_\\d+\\]/.test(value) &&
        /PRIVATE_IP=\\[PRIVATE_IP_\\d+\\]/.test(value);
      if (ready) {
        return {
          value,
          firstPlaceholder: first,
          lineCount: value.split('\\n').length,
          hasAnyRaw: rawValues.some((raw) => value.includes(raw)),
          hasRawSecretPrefix: ['sk-proj-', 'sk-ant-api03-', 'ghp_', 'sk_live_', 'SuperFakePassword123']
            .some((raw) => value.includes(raw)),
          openAiRedacted: /^OPENAI_API_KEY=\\[PWM_\\d+\\]$/m.test(value),
          anthropicRedacted: /^ANTHROPIC_API_KEY=\\[PWM_\\d+\\]$/m.test(value),
          githubRedacted: /^GITHUB_TOKEN=\\[PWM_\\d+\\]$/m.test(value),
          stripeRedacted: /^STRIPE_SECRET_KEY=\\[PWM_\\d+\\]$/m.test(value),
          databasePasswordRedacted:
            /^DATABASE_URL=postgres:\\/\\/admin:\\[PWM_\\d+\\]@db\\.example\\.com:5432\\/customerdb$/m
              .test(value),
          repeatedPlaceholderReused: Boolean(first && repeat && first === repeat),
          existingPlaceholderPreserved: /^PLACEHOLDER_ALREADY=\\[PWM_1\\]$/m.test(value),
          publicIpRedacted: /PUBLIC_IP=\\[(PUB_HOST|NET)_\\d+\\]/.test(value),
          privateIpRedacted: /^PRIVATE_IP=\\[PRIVATE_IP_\\d+\\]$/m.test(value)
        };
      }
      return {
        value,
        hasRedactButton: Boolean(Array.from(
          document.querySelectorAll('.pwm-modal-backdrop button, .pwm-modal button')
        ).find((button) => /Redact/i.test(button.textContent || '')))
      };`, [rawValues]);

    if (state?.firstPlaceholder) return state;
    if (state?.hasRedactButton) {
      await webdriver.sendKeys(".pwm-modal-backdrop button.pwm-btn-primary", "\uE007");
    }
    return null;
  }, "Firefox prompt redaction", 15000);

  assert.equal(result.error, undefined, result.error || "Firefox prompt redaction failed");
  assert.equal(result.hasAnyRaw, false, "Firefox prompt still contains raw synthetic values");
  assert.equal(result.hasRawSecretPrefix, false, "Firefox prompt still contains raw secret prefixes");
  assert.equal(result.lineCount, promptLines.length, "Firefox multiline formatting was not preserved");
  assert.equal(result.openAiRedacted, true);
  assert.equal(result.anthropicRedacted, true);
  assert.equal(result.githubRedacted, true);
  assert.equal(result.stripeRedacted, true);
  assert.equal(result.databasePasswordRedacted, true);
  assert.equal(result.repeatedPlaceholderReused, true);
  assert.equal(result.existingPlaceholderPreserved, true);
  assert.equal(result.publicIpRedacted, true);
  assert.equal(
    result.privateIpRedacted,
    true,
    sanitizeFirefoxSmokeDiagnostic(result.value || "Firefox prompt did not redact private IP")
  );
  return result;
}

async function runFirefoxSecureRevealQa(webdriver, extensionOrigin, placeholder) {
  await webdriver.execute(`const placeholder = arguments[0];
    const echo = document.querySelector('#echo-zone');
    echo.textContent = 'Assistant echoed ' + placeholder + ' after redaction.';
    return true;`, [placeholder]);
  const revealState = await waitFor(async () => {
    const state = await webdriver.execute(`return {
      hasChip: Boolean(document.querySelector('#echo-zone .pwm-secret')),
      chipText: document.querySelector('#echo-zone .pwm-secret')?.textContent || '',
      pageHasRaw: arguments[0].some((raw) => document.body.innerText.includes(raw))
    };`, [rawValues]);
    if (!state.hasChip) return null;
    await webdriver.clickElement("#echo-zone .pwm-secret");
    return state;
  }, "Firefox hydrated placeholder chip", 5000);
  assert.equal(revealState.chipText, placeholder);
  assert.equal(revealState.pageHasRaw, false);

  await webdriver.navigate(`${extensionOrigin}/popup/popup.html`);
  await waitFor(
    () => webdriver.execute("return document.querySelector('#reveal-view') && !document.querySelector('#reveal-view').hidden;"),
    "Firefox secure reveal popup view"
  );
  const beforeShow = await webdriver.execute(`return {
    placeholder: document.querySelector('#reveal-placeholder')?.textContent || '',
    hidden: document.querySelector('#secret-value')?.hidden,
    rawVisible: arguments[0].some((raw) => (document.querySelector('#secret-value')?.textContent || '').includes(raw))
  };`, [rawValues]);
  assert.equal(beforeShow.placeholder, placeholder);
  assert.equal(beforeShow.hidden, true);
  assert.equal(beforeShow.rawVisible, false);

  await webdriver.clickElement("#show-btn");
  const afterShow = await waitFor(async () => {
    const state = await webdriver.execute(`return {
      hidden: document.querySelector('#secret-value')?.hidden,
      rawVisible: arguments[0].some((raw) => (document.querySelector('#secret-value')?.textContent || '').includes(raw)),
      status: document.querySelector('#reveal-status')?.textContent || ''
    };`, [rawValues]);
    return state.hidden === false && state.rawVisible ? state : null;
  }, "Firefox secure reveal raw value in popup");
  assert.match(afterShow.status, /Visible only inside this LeakGuard popup/);
}

async function waitForDownloadedText(downloadPath, fileName) {
  const filePath = path.join(downloadPath, fileName);
  return await waitFor(() => {
    const entries = fs.existsSync(downloadPath) ? fs.readdirSync(downloadPath) : [];
    const partialDownload = entries.some((entry) => entry.endsWith(".part") || entry.endsWith(".tmp"));
    if (!fs.existsSync(filePath) || partialDownload) return null;
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size <= 0) return null;
    return fs.readFileSync(filePath, "utf8");
  }, `Firefox scanner export download ${fileName}`);
}

async function clickDownloadAndReadText(webdriver, downloadPath, selector, fileName) {
  fs.rmSync(path.join(downloadPath, fileName), { force: true });
  await webdriver.clickElement(selector);
  return await waitForDownloadedText(downloadPath, fileName);
}

async function runFirefoxScannerQa(webdriver, extensionOrigin, tempDir, downloadDir) {
  await webdriver.navigate(`${extensionOrigin}/scanner/scanner.html`);
  await waitFor(
    () => webdriver.execute("return Boolean(document.querySelector('#file-input'));"),
    "Firefox scanner UI"
  );

  const envPath = path.join(tempDir, "leakguard-firefox-qa.env");
  fs.writeFileSync(envPath, promptPayload);
  await webdriver.setFileInputFiles("#file-input", [envPath]);
  const supported = await webdriver.executeAsync(`const rawValues = arguments[0];
    const done = arguments[arguments.length - 1];
    const started = Date.now();
    let clicked = false;
    const timer = setInterval(() => {
      const preview = document.querySelector('#redacted-preview')?.textContent || '';
      const status = document.querySelector('#status')?.textContent || '';
      const scanButton = document.querySelector('#scan-btn');
      if (!clicked && scanButton && !scanButton.disabled) {
        clicked = true;
        scanButton.click();
      }
      if (
        /Scan complete/i.test(status) &&
        /\\[PWM_\\d+\\]/.test(preview) &&
        /PUBLIC_IP=\\[(PUB_HOST|NET)_\\d+\\]/.test(preview) &&
        /PRIVATE_IP=\\[PRIVATE_IP_\\d+\\]/.test(preview)
      ) {
        clearInterval(timer);
        done({
          status,
          hasAnyRaw: rawValues.some((raw) => preview.includes(raw)),
          openAiRedacted: /^OPENAI_API_KEY=\\[PWM_\\d+\\]$/m.test(preview),
          anthropicRedacted: /^ANTHROPIC_API_KEY=\\[PWM_\\d+\\]$/m.test(preview),
          githubRedacted: /^GITHUB_TOKEN=\\[PWM_\\d+\\]$/m.test(preview),
          stripeRedacted: /^STRIPE_SECRET_KEY=\\[PWM_\\d+\\]$/m.test(preview),
          databasePasswordRedacted:
            /^DATABASE_URL=postgres:\\/\\/admin:\\[PWM_\\d+\\]@db\\.example\\.com:5432\\/customerdb$/m
              .test(preview),
          publicIpRedacted: /PUBLIC_IP=\\[(PUB_HOST|NET)_\\d+\\]/.test(preview),
          privateIpRedacted: /^PRIVATE_IP=\\[PRIVATE_IP_\\d+\\]$/m.test(preview)
        });
      } else if (Date.now() - started > 15000) {
        clearInterval(timer);
        done({ error: 'Timed out waiting for scanner result', status, preview });
      }
    }, 50);`, [rawValues]);
  assert.equal(supported.error, undefined, supported.error || "Firefox scanner failed");
  assert.equal(supported.hasAnyRaw, false, "Firefox scanner preview still contains raw synthetic values");
  assert.equal(supported.openAiRedacted, true);
  assert.equal(supported.anthropicRedacted, true);
  assert.equal(supported.githubRedacted, true);
  assert.equal(supported.stripeRedacted, true);
  assert.equal(supported.databasePasswordRedacted, true);
  assert.equal(supported.publicIpRedacted, true);
  assert.equal(supported.privateIpRedacted, true);

  const redactedText = await clickDownloadAndReadText(
    webdriver,
    downloadDir,
    "#download-redacted-btn",
    "leakguard-firefox-qa.redacted.env"
  );
  assertNoRawSyntheticValues(redactedText, "Firefox scanner redacted download");
  assert.equal(
    /^OPENAI_API_KEY=\[PWM_\d+\]$/m.test(redactedText),
    true,
    "Firefox scanner redacted download should rewrite OPENAI_API_KEY to [PWM_N]"
  );
  assert.equal(
    /^PUBLIC_IP=\[(PUB_HOST|NET)_\d+\]$/m.test(redactedText),
    true,
    "Firefox scanner redacted download should rewrite public IP to [PUB_HOST_N]"
  );
  assert.equal(
    /^PRIVATE_IP=\[PRIVATE_IP_\d+\]$/m.test(redactedText),
    true,
    "Firefox scanner redacted download should rewrite private IP to [PRIVATE_IP_N]"
  );

  const reportText = await clickDownloadAndReadText(
    webdriver,
    downloadDir,
    "#download-report-btn",
    "leakguard-firefox-qa.leakguard-report.json"
  );
  assertNoRawSyntheticValues(reportText, "Firefox scanner JSON report download");
  const report = JSON.parse(reportText);
  assert.equal(report.product, "LeakGuard");
  assert.equal(report.localOnly, true);
  assert.ok(Array.isArray(report.findings));
  assert.equal(
    /\[(PWM|PUB_HOST|NET)_\d+\]/.test(report.redactedPreview || ""),
    true,
    "Firefox scanner report should contain redacted placeholders"
  );
  assert.equal(JSON.stringify(report).includes("redactedText"), false);

  await webdriver.clickElement("#clear-btn");
  await waitFor(
    () => webdriver.execute("return document.querySelector('#scan-btn')?.disabled;"),
    "Firefox scanner reset"
  );

  const unsupportedPath = path.join(tempDir, "leakguard-firefox-qa.pdf");
  fs.writeFileSync(unsupportedPath, "%PDF-1.7\nsynthetic unsupported file\n");
  await webdriver.setFileInputFiles("#file-input", [unsupportedPath]);
  const unsupported = await webdriver.executeAsync(`const done = arguments[arguments.length - 1];
    const started = Date.now();
    let clicked = false;
    const timer = setInterval(() => {
      const status = document.querySelector('#status')?.textContent || '';
      const scanButton = document.querySelector('#scan-btn');
      const scanDisabled = scanButton?.disabled;
      if (!clicked && scanButton && !scanButton.disabled) {
        clicked = true;
        scanButton.click();
      }
      if (/could not find extractable text/i.test(status) && /OCR are not supported/i.test(status)) {
        clearInterval(timer);
        done({ status, scanDisabled });
      } else if (Date.now() - started > 10000) {
        clearInterval(timer);
        done({ error: 'Timed out waiting for unsupported warning', status, scanDisabled });
      }
    }, 50);`);
  assert.equal(unsupported.error, undefined, unsupported.error || "Firefox unsupported scanner case failed");
  assert.match(unsupported.status, /could not find extractable text/i);
  assert.match(unsupported.status, /OCR are not supported/i);
}

async function runFirefoxOcrWasmProbeQa(webdriver, extensionOrigin) {
  await webdriver.navigate(`${extensionOrigin}/scanner/scanner.html`);
  await waitFor(
    () => webdriver.execute("return Boolean(document.querySelector('#file-input'));"),
    "Firefox scanner UI"
  );

  const result = await webdriver.executeAsync(`const done = arguments[arguments.length - 1];
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
        done({ worker, wasm, engine, core, language, recognition });
      } catch (error) {
        done({ error: error?.message || 'OCR WASM probe failed' });
      }
    };
    script.onerror = () => done({ error: 'OCR runtime script failed to load' });
    document.documentElement.appendChild(script);`);

  assert.equal(result.error, undefined, result.error || "Firefox OCR WASM worker proof failed");
  assert.deepEqual(result.worker, {
    ok: true,
    status: "worker_ready",
    ocrImplemented: false
  });
  console.log(
    `Firefox smoke: OCR WASM worker proof result ${result.wasm.status}${
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
    `Firefox smoke: tesseract.js-core proof result ${result.core.status}${
      result.core.reason ? ` (${result.core.reason})` : ""
    }`
  );
  assert.deepEqual(result.core, {
    ok: true,
    status: "tesseract_core_ready",
    ocrImplemented: false
  });
  console.log(
    `Firefox smoke: English traineddata proof result ${result.language.status}${
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
    `Firefox smoke: synthetic OCR recognition proof result ${result.recognition.status}${
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

async function runFirefoxFeedbackDefaultVisibleSmoke(webdriver, extensionOrigin) {
  await webdriver.navigate(`${extensionOrigin}/options/options.html`);
  await waitFor(
    () => webdriver.execute(
      "return Boolean(document.querySelector('#feedback-section') && document.querySelector('#feedback-entry') && !document.querySelector('#feedback-section').hidden);"
    ),
    "Firefox feedback controls"
  );
  const state = await webdriver.execute(`return {
    hidden: Boolean(document.querySelector('#feedback-section')?.hidden),
    unavailable: Boolean(
      document.querySelector('#feedback-entry')?.disabled ||
      document.querySelector('#feedback-section')?.hidden
    )
  };`);

  assert.equal(state.hidden, false, "Firefox feedback section should be visible by default");
  assert.equal(state.unavailable, false, "Firefox feedback action should be available by default");

  await webdriver.execute("document.querySelector('#feedback-entry').click();");
  await waitFor(
    () => webdriver.execute(
      "return Boolean(!document.querySelector('#feedback-review').hidden && document.querySelector('#feedback-report-preview').value.includes('LeakGuard Feedback Report'));"
    ),
    "Firefox feedback review preview"
  );

  const safeDescription = "Firefox smoke safe feedback description.";
  const report = await webdriver.execute(`
    const description = document.querySelector('#feedback-description');
    description.value = ${JSON.stringify(safeDescription)};
    description.dispatchEvent(new Event('input', { bubbles: true }));
    return {
      text: document.querySelector('#feedback-report-preview').value,
      githubDisabled: document.querySelector('#open-feedback-link').disabled,
      copyDisabled: document.querySelector('#copy-feedback-report').disabled
    };
  `);

  assert.match(report.text, /Warning: Do not paste secrets/);
  assert.match(report.text, /LeakGuard version:/);
  assert.match(report.text, /Browser:/);
  assert.match(report.text, /Extension build:/);
  assert.match(report.text, /Extension channel:/);
  assert.match(report.text, /Provider\/site category: options-page/);
  assert.match(report.text, /Feature area: feedback/);
  assert.match(report.text, /Safe reason codes: manual_feedback/);
  assert.match(report.text, /File count: 0/);
  assert.match(report.text, /Blocked count: 0/);
  assert.match(report.text, /Adapter name: none/);
  assert.match(report.text, new RegExp(safeDescription.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const forbidden of firefoxFeedbackForbiddenCanaries) {
    assert.equal(
      report.text.includes(forbidden),
      false,
      `Firefox feedback report should not include forbidden canary ${forbidden}`
    );
  }
  assert.equal(report.copyDisabled, false, "Firefox copy safe report should be reachable");
  assert.equal(report.githubDisabled, false, "Firefox GitHub issue button should be enabled for configured target");
}

async function runFirefoxSmoke() {
  assertBuiltExtensionExists();
  const firefoxPath = findFirefoxExecutable();
  assert.ok(firefoxPath, "Firefox stable was not found. Set FIREFOX_BIN to run this smoke test.");
  console.log(`Firefox smoke: Firefox version: ${runVersionProbe("Firefox version", firefoxPath, ["--version"])}`);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "leakguard-firefox-smoke-"));
  const profileDir = path.join(tempDir, "profile");
  const downloadDir = path.join(tempDir, "downloads");
  fs.mkdirSync(profileDir, { recursive: true });
  fs.mkdirSync(downloadDir, { recursive: true });

  let geckodriver = null;
  let webdriver = null;
  let httpsServer = null;
  let proxy = null;

  try {
    httpsServer = await startHttpsChatGptServer();
    proxy = await startConnectProxy();
    const smokeExtensionDir = prepareFirefoxSmokeExtension(tempDir);
    const xpiPath = await packageFirefoxExtension(tempDir, smokeExtensionDir);

    const geckodriverPort = await getFreePort();
    console.log("Firefox smoke: geckodriver");
    geckodriver = await launchGeckodriver(geckodriverPort);
    webdriver = new WebDriverClient(geckodriverPort);
    console.log("Firefox smoke: session");
    await webdriver.createSession({
      firefoxPath,
      proxyAddress: proxy.address,
      profileDir,
      downloadDir
    });

    const extensionId = await webdriver.installAddon(xpiPath);
    const installedExtensionId = extensionId || firefoxExtensionId;
    const extensionOrigin = await getFirefoxExtensionOrigin(profileDir, installedExtensionId);
    console.log(`Firefox smoke: temporary extension loaded (${installedExtensionId})`);
    console.log("Firefox smoke: feedback policy gate");
    await runFirefoxFeedbackDefaultVisibleSmoke(webdriver, extensionOrigin);
    console.log("Firefox smoke: popup and protected-site management");
    await runFirefoxPopupAndProtectedSiteQa(webdriver, extensionOrigin, httpsServer.localOrigin);

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

    console.log("Firefox smoke: user-managed local protected site");
    await openFirefoxLocalProtectedHarness(webdriver, httpsServer.localOrigin);
    console.log("Firefox smoke: composer redaction");
    const redacted = await runFirefoxPromptRedactionQa(webdriver);
    console.log("Firefox smoke: secure reveal");
    await runFirefoxSecureRevealQa(webdriver, extensionOrigin, redacted.firstPlaceholder);

    console.log("Firefox smoke: refresh safety");
    await webdriver.refresh();
    await waitFor(
      () => webdriver.execute("return document.readyState === 'complete';"),
      "Firefox harness refresh"
    );
    const refreshed = await webdriver.execute(`return {
      body: document.body?.innerText || '',
      value: document.querySelector('#prompt-textarea')?.value || ''
    };`);
    assertNoRawSyntheticValues(refreshed.body, "Firefox refreshed body");
    assertNoRawSyntheticValues(refreshed.value, "Firefox refreshed textarea");

    console.log("Firefox smoke: OCR WASM worker proof");
    await runFirefoxOcrWasmProbeQa(webdriver, extensionOrigin);
    console.log("Firefox smoke: file scanner");
    await runFirefoxScannerQa(webdriver, extensionOrigin, tempDir, downloadDir);
    console.log("Firefox smoke: protected-site removal");
    await runFirefoxProtectedSiteRemovalQa(webdriver, httpsServer.localOrigin);

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
