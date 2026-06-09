/*
 * Local-only browser QA for LeakGuard's unpacked Chromium extension build.
 *
 * This test uses synthetic secrets only, never opens live AI sites, and only
 * talks to a temporary 127.0.0.1 harness page. It copies dist/chrome into a
 * temporary extension directory, adds localhost permission only to that copy,
 * uses temporary browser profiles, and commits no generated artifacts.
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import zlib from "node:zlib";
import { findExecutable } from "./chrome_smoke.test.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const sourceExtensionDir = path.join(repoRoot, "dist", "chrome");
const qaTimeoutMs = Number(process.env.LEAKGUARD_BROWSER_QA_TIMEOUT_MS || 60000);
const cdpTimeoutMs = Number(process.env.LEAKGUARD_BROWSER_QA_CDP_TIMEOUT_MS || 30000);
const cleanupDelayMs = Number(process.env.LEAKGUARD_BROWSER_QA_CLEANUP_DELAY_MS || 500);
const cleanupMaxRetries = Number(process.env.LEAKGUARD_BROWSER_QA_CLEANUP_RETRIES || 10);
const cleanupRetryDelayMs = Number(process.env.LEAKGUARD_BROWSER_QA_CLEANUP_RETRY_DELAY_MS || 300);

const syntheticSecrets = {
  openAi: ["sk-proj", "A".repeat(48)].join("-"),
  anthropic: ["sk-ant-api03", "B".repeat(44)].join("-"),
  github: `ghp_${"C".repeat(36)}`,
  stripe: `sk_live_${"D".repeat(32)}`,
  databasePassword: "SuperFakePassword123",
  publicIp: "8.8.8.8"
};

const promptLines = [
  `OPENAI_API_KEY=${syntheticSecrets.openAi}`,
  `OPENAI_API_KEY_REPEAT=${syntheticSecrets.openAi}`,
  `ANTHROPIC_API_KEY=${syntheticSecrets.anthropic}`,
  `GITHUB_TOKEN=${syntheticSecrets.github}`,
  `STRIPE_SECRET_KEY=${syntheticSecrets.stripe}`,
  `DATABASE_URL=postgres://admin:${syntheticSecrets.databasePassword}@db.example.com:5432/customerdb`,
  `PUBLIC_IP=${syntheticSecrets.publicIp}`,
  "PRIVATE_IP=192.168.1.10",
  "PLACEHOLDER_ALREADY=[PWM_1]"
];
const promptPayload = promptLines.join("\n");
const rawValues = [
  syntheticSecrets.openAi,
  syntheticSecrets.anthropic,
  syntheticSecrets.github,
  syntheticSecrets.stripe,
  syntheticSecrets.databasePassword,
  syntheticSecrets.publicIp
];
const localProtectedSiteInput = "http://127.0.0.1";
const localProtectedSiteId = "http://127.0.0.1";
const localProtectedSitePermission = "http://127.0.0.1/*";

function escapePdfText(text) {
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
}

function makeQaPdf(text, options = {}) {
  const stream = options.imageOnly
    ? "q\n10 0 0 10 0 0 cm\n/Im1 Do\nQ\n"
    : `BT\n/F1 12 Tf\n72 720 Td\n(${escapePdfText(text)}) Tj\nET\n`;
  return Buffer.from([
    "%PDF-1.4",
    "1 0 obj",
    "<< /Type /Catalog /Pages 2 0 R >>",
    "endobj",
    "2 0 obj",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "endobj",
    "3 0 obj",
    "<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>",
    "endobj",
    "4 0 obj",
    `<< /Length ${stream.length} >>`,
    "stream",
    stream,
    "endstream",
    "endobj",
    "trailer",
    "<< /Root 1 0 R >>",
    "%%EOF"
  ].join("\n"));
}

function makeQaZip(entries) {
  const chunks = [];
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const raw = Buffer.from(String(entry.data || ""), "utf8");
    const compressed = zlib.deflateRawSync(raw);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0, 6);
    header.writeUInt16LE(8, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(0, 12);
    header.writeUInt32LE(0, 14);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(raw.length, 22);
    header.writeUInt16LE(name.length, 26);
    header.writeUInt16LE(0, 28);
    chunks.push(header, name, compressed);
  }
  return Buffer.concat(chunks);
}

function makeQaDocx(text, options = {}) {
  const body = options.imageOnly
    ? "<w:p><w:r><w:drawing /></w:r></w:p>"
    : String(text)
      .split("\n")
      .map((line) => `<w:p><w:r><w:t>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</w:t></w:r></w:p>`)
      .join("");
  return makeQaZip([
    {
      name: "[Content_Types].xml",
      data: '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>'
    },
    {
      name: "word/document.xml",
      data: `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`
    }
  ]);
}

function makeQaXlsx(text) {
  const escaped = String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return makeQaZip([
    {
      name: "[Content_Types].xml",
      data: '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>'
    },
    {
      name: "xl/workbook.xml",
      data: '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets><sheet name="Secrets" sheetId="1"/></sheets></workbook>'
    },
    {
      name: "xl/worksheets/sheet1.xml",
      data: `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>${escaped}</t></is></c></row></sheetData></worksheet>`
    }
  ]);
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

function findEdgeExecutable() {
  const localAppData = process.env.LOCALAPPDATA || "";
  const windowsCandidates =
    process.platform === "win32"
      ? [
          path.join(process.env.PROGRAMFILES || "", "Microsoft", "Edge", "Application", "msedge.exe"),
          path.join(
            process.env["PROGRAMFILES(X86)"] || "",
            "Microsoft",
            "Edge",
            "Application",
            "msedge.exe"
          ),
          path.join(localAppData, "Microsoft", "Edge", "Application", "msedge.exe")
        ]
      : [];
  const macCandidates =
    process.platform === "darwin"
      ? ["/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"]
      : [];
  return findExecutable([
    process.env.EDGE_BIN,
    process.env.MSEDGE_BIN,
    ...windowsCandidates,
    ...macCandidates,
    "microsoft-edge",
    "microsoft-edge-stable",
    "microsoft-edge-beta",
    "microsoft-edge-dev",
    "msedge"
  ]);
}

function assertBuiltExtensionExists() {
  const manifestPath = path.join(sourceExtensionDir, "manifest.json");
  assert.ok(
    fs.existsSync(manifestPath),
    `Expected ${manifestPath}. Run npm run build:chrome before qa:browser.`
  );
}

async function delay(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(condition, label, timeoutMs = qaTimeoutMs) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const result = await condition();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  const suffix = lastError ? ` Last error: ${lastError.message}` : "";
  throw new Error(`Timed out waiting for ${label}.${suffix}`);
}

class CdpPipeConnection {
  constructor(input, output) {
    this.input = input;
    this.output = output;
    this.buffer = "";
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    assert.ok(this.input, "Browser remote debugging input pipe is missing.");
    assert.ok(this.output, "Browser remote debugging output pipe is missing.");
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
    this.input.on("error", (error) => this.rejectPending(error));
    this.output.on("error", (error) => this.rejectPending(error));
    this.output.on("close", () => this.rejectPending(new Error("CDP pipe closed.")));
    await this.send("Browser.getVersion");
  }

  handleMessage(payload) {
    const message = JSON.parse(payload);
    if (message.id === undefined || !this.pending.has(message.id)) return;
    const pending = this.pending.get(message.id);
    this.pending.delete(message.id);
    if (message.error) {
      pending.reject(
        new Error(`${pending.method} ${message.error.message}: ${JSON.stringify(message.error.data || {})}`)
      );
    } else {
      pending.resolve(message.result || {});
    }
  }

  rejectPending(error) {
    for (const { reject } of this.pending.values()) reject(error);
    this.pending.clear();
  }

  send(method, params = {}, sessionId = null) {
    const id = this.nextId;
    this.nextId += 1;
    const payload = { id, method, params, ...(sessionId ? { sessionId } : {}) };
    const request = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, cdpTimeoutMs);
      this.pending.set(id, {
        method,
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
    this.input.write(`${JSON.stringify(payload)}\0`);
    return request;
  }

  async close() {
    this.rejectPending(new Error("CDP pipe closed."));
    this.input?.destroy();
    this.output?.destroy();
  }
}

function createHarnessPage() {
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>LeakGuard Browser QA Harness</title></head>
  <body>
    <main>
      <h1>LeakGuard Browser QA Harness</h1>
      <textarea id="prompt-textarea" data-testid="prompt-textarea" placeholder="Message"></textarea>
      <button id="send-button" type="button">Send</button>
      <section id="echo-zone"></section>
    </main>
  </body>
</html>`;
}

async function startHarnessServer() {
  const server = http.createServer((_request, response) => {
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    });
    response.end(createHarnessPage());
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

function prepareQaExtension(tempDir) {
  const extensionDir = path.join(tempDir, "extension");
  fs.cpSync(sourceExtensionDir, extensionDir, { recursive: true });

  const manifestPath = path.join(extensionDir, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.host_permissions = Array.from(
    new Set([...(manifest.host_permissions || []), "http://127.0.0.1/*"])
  );
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return extensionDir;
}

function launchBrowser({ executable, extensionDir, profileDir, browserName }) {
  assert.ok(executable, `${browserName} was not found. Set CHROME_BIN, EDGE_BIN, or MSEDGE_BIN.`);
  const args = [
    "--remote-debugging-pipe",
    `--user-data-dir=${profileDir}`,
    `--load-extension=${extensionDir}`,
    "--enable-unsafe-extension-debugging",
    "--disable-features=DisableLoadExtensionCommandLineSwitch",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-sync",
    "--window-size=1280,900",
    "--window-position=-2400,-2400",
    "about:blank"
  ];
  if (process.platform === "linux") args.push("--no-sandbox");

  const child = spawn(executable, args, { stdio: ["ignore", "pipe", "pipe", "pipe", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  child.on("exit", (code, signal) => {
    if (code && code !== 0) stderr += `\n${browserName} exited with code ${code} signal ${signal || ""}`;
  });
  return { child, stderr: () => stderr };
}

async function waitForBrowserExit(child, timeoutMs = 5000) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, timeoutMs))
  ]);
}

function assertHarnessTempDir(tempDir) {
  const resolvedTempDir = path.resolve(tempDir);
  const resolvedOsTempDir = path.resolve(os.tmpdir());
  const relativeToTemp = path.relative(resolvedOsTempDir, resolvedTempDir);
  const isInsideOsTemp =
    relativeToTemp && !relativeToTemp.startsWith("..") && !path.isAbsolute(relativeToTemp);
  const basename = path.basename(resolvedTempDir);

  if (!isInsideOsTemp || !/^leakguard-(?:chrome|edge)-qa-/.test(basename)) {
    throw new Error(`Refusing to remove non-harness temp dir: ${tempDir}`);
  }
}

async function closeBrowserTargets(connection, diagnostics = console) {
  if (!connection) return;
  let targets = [];
  try {
    const response = await connection.send("Target.getTargets");
    targets = response.targetInfos || [];
  } catch (error) {
    diagnostics.warn(`Browser QA cleanup warning: failed to list targets before close: ${error.message}`);
    return;
  }

  const pageTargets = targets.filter((target) => target.type === "page" && target.targetId);
  for (const target of pageTargets) {
    await connection.send("Target.closeTarget", { targetId: target.targetId }).catch((error) => {
      diagnostics.warn(`Browser QA cleanup warning: failed to close target ${target.targetId}: ${error.message}`);
    });
  }
}

async function cleanupBrowserQaRun({
  browserName,
  tempDir,
  connection = null,
  child = null,
  harnessServer = null,
  behaviorChecksPassed = false,
  diagnostics = console,
  rmFn = fs.promises.rm,
  cleanupDelayMs: waitBeforeRemoveMs = cleanupDelayMs,
  maxRetries = cleanupMaxRetries,
  retryDelay = cleanupRetryDelayMs
}) {
  assertHarnessTempDir(tempDir);
  const label = `${browserName} browser QA cleanup`;
  diagnostics.log(
    `${label}: tempDir=${tempDir} maxRetries=${maxRetries} retryDelay=${retryDelay}ms behaviorChecksPassed=${behaviorChecksPassed}`
  );

  await closeBrowserTargets(connection, diagnostics);
  await connection?.send("Browser.close").catch(() => {});
  await connection?.close().catch(() => {});
  await waitForBrowserExit(child, 3000);
  if (child && child.exitCode === null && child.signalCode === null) {
    diagnostics.warn(`${label}: spawned browser process still running; terminating pid=${child.pid || "unknown"}`);
    child.kill();
    await waitForBrowserExit(child, 3000);
  }
  await harnessServer?.close().catch((error) => {
    diagnostics.warn(`${label}: harness server close warning: ${error.message}`);
  });
  await delay(waitBeforeRemoveMs);

  try {
    await rmFn(tempDir, { recursive: true, force: true, maxRetries, retryDelay });
    diagnostics.log(`${label}: final cleanup status=removed`);
    return { removed: true, warningOnly: false };
  } catch (error) {
    const message = `${label}: final cleanup status=not-removed tempDir=${tempDir} behaviorChecksPassed=${behaviorChecksPassed} error=${error.message}`;
    if (behaviorChecksPassed && ["EPERM", "EBUSY", "ENOTEMPTY"].includes(error.code)) {
      diagnostics.warn(message);
      return { removed: false, warningOnly: true, error };
    }
    diagnostics.warn(message);
    throw error;
  }
}

async function attachToTarget(connection, targetId) {
  const { sessionId } = await connection.send("Target.attachToTarget", { targetId, flatten: true });
  await connection.send("Runtime.enable", {}, sessionId).catch(() => {});
  await connection.send("Page.enable", {}, sessionId).catch(() => {});
  return sessionId;
}

async function createPage(connection, url = "about:blank") {
  const { targetId } = await connection.send("Target.createTarget", { url });
  return { targetId, sessionId: await attachToTarget(connection, targetId) };
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

async function extensionMessage(connection, sessionId, message) {
  return await evaluate(
    connection,
    sessionId,
    `chrome.runtime.sendMessage(${JSON.stringify(message)})`,
    { awaitPromise: true }
  );
}

async function loadExtension(connection, profileDir, extensionDir, browserName) {
  try {
    const response = await connection.send("Extensions.loadUnpacked", {
      path: extensionDir,
      enableInIncognito: false
    });
    if (response.id) return response.id;
  } catch (error) {
    console.warn(`${browserName} browser QA: CDP extension load warning: ${error.message}`);
  }

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

    const preferencesPath = path.join(profileDir, "Default", "Preferences");
    if (!fs.existsSync(preferencesPath)) return null;
    const preferences = JSON.parse(fs.readFileSync(preferencesPath, "utf8"));
    for (const [id, setting] of Object.entries(preferences.extensions?.settings || {})) {
      if (setting?.manifest?.name === "LeakGuard") {
        return { url: `chrome-extension://${id}/background/service_worker.js` };
      }
    }
    return null;
  }, `${browserName} LeakGuard extension service worker`).catch((error) => {
    const targetSummary = lastTargets
      .map((info) => `${info.type}:${info.url || info.title || "<blank>"}`)
      .join("\n");
    throw new Error(`${error.message}\nObserved targets:\n${targetSummary}`);
  });
  return new URL(target.url).hostname;
}

async function setFileInputFiles(connection, sessionId, selector, files) {
  await connection.send("DOM.enable", {}, sessionId).catch(() => {});
  const expectedNames = files.map((file) => path.basename(file));
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const { root } = await connection.send("DOM.getDocument", { depth: -1, pierce: true }, sessionId);
      const { nodeId } = await connection.send(
        "DOM.querySelector",
        { nodeId: root.nodeId, selector },
        sessionId
      );
      assert.ok(nodeId, `Expected to find file input ${selector}`);
      await connection.send("DOM.setFileInputFiles", { nodeId, files }, sessionId);
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
      await waitFor(
        () =>
          evaluate(
            connection,
            sessionId,
            `(() => {
              const expected = ${JSON.stringify(expectedNames)};
              const actual = Array.from(document.querySelector(${JSON.stringify(selector)})?.files || [])
                .map((file) => file.name);
              return expected.length === actual.length &&
                expected.every((name, index) => actual[index] === name);
            })()`
          ),
        `file input assignment ${selector}`,
        1000
      );
      return;
    } catch (error) {
      lastError = error;
      await delay(100);
    }
  }
  throw lastError;
}

function assertNoRawSyntheticValues(text, label) {
  for (const raw of rawValues) {
    assert.equal(String(text || "").includes(raw), false, `${label} leaked raw synthetic value ${raw}`);
  }
}

function getUserProtectedSite(overview) {
  return (overview.userSites || []).find((rule) => rule.id === localProtectedSiteId) || null;
}

async function getLocalProtectedSiteOverview(connection, extensionSessionId, harnessOrigin) {
  const overview = await extensionMessage(connection, extensionSessionId, {
    type: "PWM_GET_PROTECTED_SITE_OVERVIEW",
    url: `${harnessOrigin}/`
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

async function ensureLocalProtectedSitePermission(connection, extensionSessionId) {
  const permissionGranted = await evaluate(
    connection,
    extensionSessionId,
    `((origin) => new Promise((resolve) => {
      chrome.permissions.contains({ origins: [origin] }, resolve);
    }))(${JSON.stringify(localProtectedSitePermission)})`,
    { awaitPromise: true }
  );
  assert.equal(permissionGranted, true, "temporary extension copy should pregrant localhost permission");
}

async function addLocalProtectedSite(connection, extensionSessionId, harnessOrigin) {
  await ensureLocalProtectedSitePermission(connection, extensionSessionId);
  const response = await extensionMessage(connection, extensionSessionId, {
    type: "PWM_ADD_PROTECTED_SITE",
    input: localProtectedSiteInput,
    url: `${harnessOrigin}/`
  });
  assert.equal(response.ok, true);
  assert.equal(response.rule.id, localProtectedSiteId);
  assert.equal(response.rule.enabled, true);
  return response;
}

async function runProtectedSiteManagementQa(connection, extensionSessionId, harnessOrigin) {
  await addLocalProtectedSite(connection, extensionSessionId, harnessOrigin);
  assertLocalProtectedSiteOverview(
    await getLocalProtectedSiteOverview(connection, extensionSessionId, harnessOrigin),
    { present: true, enabled: true, protected: true, source: "user" }
  );

  const disableResponse = await extensionMessage(connection, extensionSessionId, {
    type: "PWM_SET_PROTECTED_SITE_ENABLED",
    siteId: localProtectedSiteId,
    enabled: false,
    url: `${harnessOrigin}/`
  });
  assert.equal(disableResponse.ok, true);
  assert.equal(disableResponse.rule.enabled, false);
  assertLocalProtectedSiteOverview(
    await getLocalProtectedSiteOverview(connection, extensionSessionId, harnessOrigin),
    { present: true, enabled: false, protected: false, source: null }
  );

  const reenableResponse = await extensionMessage(connection, extensionSessionId, {
    type: "PWM_SET_PROTECTED_SITE_ENABLED",
    siteId: localProtectedSiteId,
    enabled: true,
    url: `${harnessOrigin}/`
  });
  assert.equal(reenableResponse.ok, true);
  assert.equal(reenableResponse.rule.enabled, true);
  assertLocalProtectedSiteOverview(
    await getLocalProtectedSiteOverview(connection, extensionSessionId, harnessOrigin),
    { present: true, enabled: true, protected: true, source: "user" }
  );

  const deleteResponse = await extensionMessage(connection, extensionSessionId, {
    type: "PWM_DELETE_PROTECTED_SITE",
    siteId: localProtectedSiteId,
    url: `${harnessOrigin}/`
  });
  assert.equal(deleteResponse.ok, true);
  assert.equal(deleteResponse.rule.id, localProtectedSiteId);
  assertLocalProtectedSiteOverview(
    await getLocalProtectedSiteOverview(connection, extensionSessionId, harnessOrigin),
    { present: false, enabled: false, protected: false, source: null }
  );

  await addLocalProtectedSite(connection, extensionSessionId, harnessOrigin);
  assertLocalProtectedSiteOverview(
    await getLocalProtectedSiteOverview(connection, extensionSessionId, harnessOrigin),
    { present: true, enabled: true, protected: true, source: "user" }
  );
}

async function openProtectedHarness(connection, harnessOrigin) {
  const page = await createPage(connection);
  await navigate(connection, page.sessionId, `${harnessOrigin}/`);
  const panel = await waitFor(async () => {
    const state = await evaluate(
      connection,
      page.sessionId,
      `(() => ({
        panelText: document.querySelector('.pwm-panel')?.innerText || '',
        hasPanel: Boolean(document.querySelector('.pwm-panel'))
      }))()`
    );
    return state.hasPanel && /PROTECTION\s+Active/i.test(state.panelText) ? state : null;
  }, "LeakGuard active panel before payload");
  assert.match(panel.panelText, /LeakGuard/);
  return page;
}

function assertPromptRedaction(result) {
  assert.equal(result.hasAnyRaw, false, "prompt still contains raw synthetic values");
  assert.equal(result.hasRawSecretPrefix, false, "prompt still contains raw secret prefixes");
  assert.equal(result.lineCount, promptLines.length, "multiline formatting was not preserved");
  assert.equal(result.openAiRedacted, true);
  assert.equal(result.anthropicRedacted, true);
  assert.equal(result.githubRedacted, true);
  assert.equal(result.stripeRedacted, true);
  assert.equal(result.databasePasswordRedacted, true);
  assert.equal(result.repeatedPlaceholderReused, true);
  assert.equal(result.existingPlaceholderPreserved, true);
  assert.equal(result.publicIpRedacted, true);
  assert.equal(result.privateIpVisible, true);
}

async function runPromptRedactionQa(connection, page) {
  const result = await evaluate(
    connection,
    page.sessionId,
    `new Promise((resolve, reject) => {
      const textarea = document.querySelector('#prompt-textarea');
      const payload = ${JSON.stringify(promptPayload)};
      const rawValues = ${JSON.stringify(rawValues)};
      textarea.focus();
      const transfer = new DataTransfer();
      transfer.setData('text/plain', payload);
      textarea.dispatchEvent(new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: transfer
      }));

      const started = Date.now();
      const timer = setInterval(() => {
        const redactButton = Array.from(
          document.querySelectorAll('.pwm-modal-backdrop button, .pwm-modal button')
        ).find((button) => /Redact/i.test(button.textContent || ''));
        if (redactButton) redactButton.click();

        const value = textarea.value || '';
        const first = /^OPENAI_API_KEY=(\\[PWM_\\d+\\])$/m.exec(value)?.[1] || '';
        const repeat = /^OPENAI_API_KEY_REPEAT=(\\[PWM_\\d+\\])$/m.exec(value)?.[1] || '';
        const ready = /\\[PWM_\\d+\\]/.test(value) && /PUBLIC_IP=\\[(PUB_HOST|NET)_\\d+\\]/.test(value);
        if (ready) {
          clearInterval(timer);
          resolve({
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
            privateIpVisible: value.includes('PRIVATE_IP=192.168.1.10')
          });
        } else if (Date.now() - started > 15000) {
          clearInterval(timer);
          reject(new Error('Timed out waiting for prompt redaction: ' + value));
        }
      }, 50);
    })`
  );
  assertPromptRedaction(result);
  return result;
}

async function runSecureRevealQa(connection, page, extensionId, placeholder) {
  const revealState = await evaluate(
    connection,
    page.sessionId,
    `new Promise((resolve, reject) => {
      const echo = document.querySelector('#echo-zone');
      echo.textContent = 'Assistant echoed ${placeholder} after redaction.';
      const rawValues = ${JSON.stringify(rawValues)};
      const started = Date.now();
      const timer = setInterval(() => {
        const chip = document.querySelector('#echo-zone .pwm-secret');
        if (chip) {
          clearInterval(timer);
          chip.click();
          setTimeout(() => resolve({
            chipText: chip.textContent,
            pageHasRaw: rawValues.some((raw) => document.body.innerText.includes(raw))
          }), 250);
        } else if (Date.now() - started > 5000) {
          clearInterval(timer);
          reject(new Error('Timed out waiting for hydrated placeholder chip'));
        }
      }, 50);
    })`
  );
  assert.equal(revealState.chipText, placeholder);
  assert.equal(revealState.pageHasRaw, false);

  const popup = await createPage(connection, `chrome-extension://${extensionId}/popup/popup.html`);
  await waitFor(
    () =>
      evaluate(
        connection,
        popup.sessionId,
        "document.querySelector('#reveal-view') && !document.querySelector('#reveal-view').hidden"
      ),
    "secure reveal popup view"
  );
  const beforeShow = await evaluate(
    connection,
    popup.sessionId,
    `({
      placeholder: document.querySelector('#reveal-placeholder')?.textContent || '',
      hidden: document.querySelector('#secret-value')?.hidden,
      rawVisible: ${JSON.stringify(rawValues)}
        .some((raw) => (document.querySelector('#secret-value')?.textContent || '').includes(raw))
    })`
  );
  assert.equal(beforeShow.placeholder, placeholder);
  assert.equal(beforeShow.hidden, true);
  assert.equal(beforeShow.rawVisible, false);

  const afterShow = await evaluate(
    connection,
    popup.sessionId,
    `new Promise((resolve) => {
      document.querySelector('#show-btn').click();
      setTimeout(() => resolve({
        hidden: document.querySelector('#secret-value')?.hidden,
        rawVisible: ${JSON.stringify(rawValues)}
          .some((raw) => (document.querySelector('#secret-value')?.textContent || '').includes(raw)),
        status: document.querySelector('#reveal-status')?.textContent || ''
      }), 250);
    })`
  );
  assert.equal(afterShow.hidden, false);
  assert.equal(afterShow.rawVisible, true);
  assert.match(afterShow.status, /Visible only inside this LeakGuard popup/);
}

async function runRefreshSafetyQa(connection, page) {
  await connection.send("Page.reload", {}, page.sessionId);
  await waitFor(
    () => evaluate(connection, page.sessionId, "document.readyState === 'complete'"),
    "harness refresh"
  );
  const refreshed = await evaluate(
    connection,
    page.sessionId,
    `({
      pageHasRaw: ${JSON.stringify(rawValues)}.some((raw) => document.body.innerText.includes(raw)),
      textareaValue: document.querySelector('#prompt-textarea')?.value || ''
    })`
  );
  assert.equal(refreshed.pageHasRaw, false);
  assert.equal(refreshed.textareaValue.includes("sk-"), false);
}

function assertScannerResult(result) {
  assert.equal(result.hasAnyRaw, false, "scanner preview still contains raw synthetic values");
  assert.equal(result.openAiRedacted, true);
  assert.equal(result.anthropicRedacted, true);
  assert.equal(result.githubRedacted, true);
  assert.equal(result.stripeRedacted, true);
  assert.equal(result.databasePasswordRedacted, true);
  assert.equal(result.publicIpRedacted, true);
  assert.equal(result.privateIpVisible, true);
}

async function configureDownloadDirectory(connection, sessionId, downloadPath) {
  fs.mkdirSync(downloadPath, { recursive: true });
  try {
    await connection.send("Browser.setDownloadBehavior", {
      behavior: "allow",
      downloadPath
    });
    return;
  } catch (browserError) {
    try {
      await connection.send(
        "Page.setDownloadBehavior",
        {
          behavior: "allow",
          downloadPath
        },
        sessionId
      );
      return;
    } catch (pageError) {
      throw new Error(
        `Could not configure local download directory. Browser: ${browserError.message}; Page: ${pageError.message}`
      );
    }
  }
}

async function waitForDownloadedText(downloadPath, fileName) {
  const filePath = path.join(downloadPath, fileName);
  return await waitFor(() => {
    const entries = fs.existsSync(downloadPath) ? fs.readdirSync(downloadPath) : [];
    const partialDownload = entries.some((entry) => entry.endsWith(".crdownload") || entry.endsWith(".tmp"));
    if (!fs.existsSync(filePath) || partialDownload) return null;
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size <= 0) return null;
    return fs.readFileSync(filePath, "utf8");
  }, `scanner export download ${fileName}`);
}

async function clickDownloadAndReadText(connection, sessionId, downloadPath, selector, fileName) {
  fs.rmSync(path.join(downloadPath, fileName), { force: true });
  await evaluate(
    connection,
    sessionId,
    `document.querySelector(${JSON.stringify(selector)})?.click()`,
    { userGesture: true }
  );
  return await waitForDownloadedText(downloadPath, fileName);
}

async function runScannerExportQa(connection, scannerSessionId, tempDir) {
  const downloadPath = path.join(tempDir, "scanner-downloads");
  await configureDownloadDirectory(connection, scannerSessionId, downloadPath);

  const redactedText = await clickDownloadAndReadText(
    connection,
    scannerSessionId,
    downloadPath,
    "#download-redacted-btn",
    "leakguard-browser-qa.redacted.env"
  );
  assertNoRawSyntheticValues(redactedText, "scanner redacted download");
  assert.match(redactedText, /^OPENAI_API_KEY=\[PWM_\d+\]$/m);
  assert.match(redactedText, /^PUBLIC_IP=\[(PUB_HOST|NET)_\d+\]$/m);
  assert.ok(redactedText.includes("PRIVATE_IP=192.168.1.10"));

  const reportText = await clickDownloadAndReadText(
    connection,
    scannerSessionId,
    downloadPath,
    "#download-report-btn",
    "leakguard-browser-qa.leakguard-report.json"
  );
  assertNoRawSyntheticValues(reportText, "scanner JSON report download");
  const report = JSON.parse(reportText);
  assert.equal(report.product, "LeakGuard");
  assert.equal(report.localOnly, true);
  assert.ok(Array.isArray(report.findings));
  assert.match(report.redactedPreview || "", /\[(PWM|PUB_HOST|NET)_\d+\]/);
  assert.equal(JSON.stringify(report).includes("redactedText"), false);
}

async function runScannerQa(connection, extensionId, tempDir) {
  const scanner = await createPage(connection, `chrome-extension://${extensionId}/scanner/scanner.html`);
  await waitFor(
    () => evaluate(connection, scanner.sessionId, "Boolean(document.querySelector('#file-input'))"),
    "scanner UI"
  );

  const envPath = path.join(tempDir, "leakguard-browser-qa.env");
  fs.writeFileSync(envPath, promptPayload);
  await setFileInputFiles(connection, scanner.sessionId, "#file-input", [envPath]);
  const supported = await evaluate(
    connection,
    scanner.sessionId,
    `new Promise((resolve, reject) => {
      const rawValues = ${JSON.stringify(rawValues)};
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
        if (/Scan complete/i.test(status) && /\\[PWM_\\d+\\]/.test(preview)) {
          clearInterval(timer);
          resolve({
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
            privateIpVisible: preview.includes('PRIVATE_IP=192.168.1.10')
          });
        } else if (Date.now() - started > 15000) {
          clearInterval(timer);
          reject(new Error('Timed out waiting for scanner result: ' + JSON.stringify({
            status,
            scanDisabled: scanButton?.disabled,
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
    })`
  );
  assertScannerResult(supported);
  await runScannerExportQa(connection, scanner.sessionId, tempDir);

  await evaluate(connection, scanner.sessionId, "document.querySelector('#clear-btn').click()");
  await waitFor(
    () => evaluate(connection, scanner.sessionId, "document.querySelector('#scan-btn')?.disabled"),
    "scanner reset"
  );

  const textPdfPath = path.join(tempDir, "leakguard-browser-qa-text.pdf");
  fs.writeFileSync(textPdfPath, makeQaPdf(`PDF_API_KEY=${syntheticSecrets.openAi}`));
  await setFileInputFiles(connection, scanner.sessionId, "#file-input", [textPdfPath]);
  const textPdf = await evaluate(
    connection,
    scanner.sessionId,
    `new Promise((resolve, reject) => {
      const rawSecret = ${JSON.stringify(syntheticSecrets.openAi)};
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
        if (/Scan complete/i.test(status) && /PDF_API_KEY=\\[PWM_\\d+\\]/.test(preview)) {
          clearInterval(timer);
          resolve({
            status,
            hasRaw: preview.includes(rawSecret),
            redacted: /PDF_API_KEY=\\[PWM_\\d+\\]/.test(preview)
          });
        } else if (Date.now() - started > 15000) {
          clearInterval(timer);
          reject(new Error('Timed out waiting for PDF scanner result: ' + JSON.stringify({
            status,
            scanDisabled: scanButton?.disabled,
            preview
          })));
        }
      }, 50);
    })`
  );
  assert.equal(textPdf.hasRaw, false, "scanner PDF preview must not expose raw PDF secrets");
  assert.equal(textPdf.redacted, true, "scanner should redact text PDF findings");

  await evaluate(connection, scanner.sessionId, "document.querySelector('#clear-btn').click()");
  await waitFor(
    () => evaluate(connection, scanner.sessionId, "document.querySelector('#scan-btn')?.disabled"),
    "scanner reset after text PDF"
  );

  const textDocxPath = path.join(tempDir, "leakguard-browser-qa-text.docx");
  fs.writeFileSync(textDocxPath, makeQaDocx(`DOCX_API_KEY=${syntheticSecrets.openAi}`));
  await setFileInputFiles(connection, scanner.sessionId, "#file-input", [textDocxPath]);
  const textDocx = await evaluate(
    connection,
    scanner.sessionId,
    `new Promise((resolve, reject) => {
      const rawSecret = ${JSON.stringify(syntheticSecrets.openAi)};
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
        if (/Scan complete/i.test(status) && /DOCX_API_KEY=\\[PWM_\\d+\\]/.test(preview)) {
          clearInterval(timer);
          resolve({
            status,
            hasRaw: preview.includes(rawSecret),
            redacted: /DOCX_API_KEY=\\[PWM_\\d+\\]/.test(preview)
          });
        } else if (Date.now() - started > 15000) {
          clearInterval(timer);
          reject(new Error('Timed out waiting for DOCX scanner result: ' + JSON.stringify({
            status,
            scanDisabled: scanButton?.disabled,
            preview
          })));
        }
      }, 50);
    })`
  );
  assert.equal(textDocx.hasRaw, false, "scanner DOCX preview must not expose raw DOCX secrets");
  assert.equal(textDocx.redacted, true, "scanner should redact text DOCX findings");

  await evaluate(connection, scanner.sessionId, "document.querySelector('#clear-btn').click()");
  await waitFor(
    () => evaluate(connection, scanner.sessionId, "document.querySelector('#scan-btn')?.disabled"),
    "scanner reset after text DOCX"
  );

  const textXlsxPath = path.join(tempDir, "leakguard-browser-qa-text.xlsx");
  fs.writeFileSync(textXlsxPath, makeQaXlsx(`XLSX_API_KEY=${syntheticSecrets.openAi}`));
  await setFileInputFiles(connection, scanner.sessionId, "#file-input", [textXlsxPath]);
  const textXlsx = await evaluate(
    connection,
    scanner.sessionId,
    `new Promise((resolve, reject) => {
      const rawSecret = ${JSON.stringify(syntheticSecrets.openAi)};
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
        if (/Scan complete/i.test(status) && /XLSX_API_KEY=\\[PWM_\\d+\\]/.test(preview)) {
          clearInterval(timer);
          resolve({
            status,
            hasRaw: preview.includes(rawSecret),
            redacted: /XLSX_API_KEY=\\[PWM_\\d+\\]/.test(preview)
          });
        } else if (Date.now() - started > 15000) {
          clearInterval(timer);
          reject(new Error('Timed out waiting for XLSX scanner result: ' + JSON.stringify({
            status,
            scanDisabled: scanButton?.disabled,
            preview
          })));
        }
      }, 50);
    })`
  );
  assert.equal(textXlsx.hasRaw, false, "scanner XLSX preview must not expose raw XLSX secrets");
  assert.equal(textXlsx.redacted, true, "scanner should redact text XLSX findings");

  await evaluate(connection, scanner.sessionId, "document.querySelector('#clear-btn').click()");
  await waitFor(
    () => evaluate(connection, scanner.sessionId, "document.querySelector('#scan-btn')?.disabled"),
    "scanner reset after text XLSX"
  );

  const unsupportedDocxPath = path.join(tempDir, "leakguard-browser-qa-image-only.docx");
  fs.writeFileSync(unsupportedDocxPath, makeQaDocx("", { imageOnly: true }));
  await setFileInputFiles(connection, scanner.sessionId, "#file-input", [unsupportedDocxPath]);
  const unsupportedDocx = await evaluate(
    connection,
    scanner.sessionId,
    `new Promise((resolve, reject) => {
      const started = Date.now();
      let clicked = false;
      const timer = setInterval(() => {
        const status = document.querySelector('#status')?.textContent || '';
        const preview = document.querySelector('#redacted-preview')?.textContent || '';
        const scanButton = document.querySelector('#scan-btn');
        if (!clicked && scanButton && !scanButton.disabled) {
          clicked = true;
          scanButton.click();
        }
        if (/could not find extractable text/i.test(status) && /Embedded images, macros, and OCR are not supported/i.test(status)) {
          clearInterval(timer);
          resolve({ status, preview });
        } else if (Date.now() - started > 10000) {
          clearInterval(timer);
          reject(new Error('Timed out waiting for unsupported DOCX warning: ' + JSON.stringify({
            status,
            scanDisabled: scanButton?.disabled,
            preview
          })));
        }
      }, 50);
    })`
  );
  assert.match(unsupportedDocx.status, /could not find extractable text/i);
  assert.match(unsupportedDocx.status, /Embedded images, macros, and OCR are not supported/i);
  assert.equal(unsupportedDocx.preview, "");

  await evaluate(connection, scanner.sessionId, "document.querySelector('#clear-btn').click()");
  await waitFor(
    () => evaluate(connection, scanner.sessionId, "document.querySelector('#scan-btn')?.disabled"),
    "scanner reset after unsupported DOCX"
  );

  const unsupportedPath = path.join(tempDir, "leakguard-browser-qa-image-only.pdf");
  fs.writeFileSync(unsupportedPath, makeQaPdf("", { imageOnly: true }));
  await setFileInputFiles(connection, scanner.sessionId, "#file-input", [unsupportedPath]);
  const unsupported = await evaluate(
    connection,
    scanner.sessionId,
    `new Promise((resolve, reject) => {
      const started = Date.now();
      let clicked = false;
      const timer = setInterval(() => {
        const status = document.querySelector('#status')?.textContent || '';
        const preview = document.querySelector('#redacted-preview')?.textContent || '';
        const scanDisabled = document.querySelector('#scan-btn')?.disabled;
        const scanButton = document.querySelector('#scan-btn');
        if (!clicked && scanButton && !scanButton.disabled) {
          clicked = true;
          scanButton.click();
        }
        if (/could not find extractable text/i.test(status) && /OCR are not supported/i.test(status)) {
          clearInterval(timer);
          resolve({ status, scanDisabled, preview });
        } else if (Date.now() - started > 10000) {
          clearInterval(timer);
          reject(new Error('Timed out waiting for unsupported PDF warning: ' + JSON.stringify({
            status,
            scanDisabled,
            preview
          })));
        }
      }, 50);
    })`
  );
  assert.match(unsupported.status, /could not find extractable text/i);
  assert.match(unsupported.status, /OCR are not supported/i);
  assert.equal(unsupported.preview, "");
  return { supported, textPdf, textDocx, textXlsx, unsupportedDocx, unsupported };
}

async function runBrowserQa({ browserName, executable }) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `leakguard-${browserName.toLowerCase()}-qa-`));
  const profileDir = path.join(tempDir, "profile");
  fs.mkdirSync(profileDir, { recursive: true });
  const extensionDir = prepareQaExtension(tempDir);

  let harnessServer = null;
  let browserProcess = null;
  let connection = null;
  let behaviorChecksPassed = false;
  try {
    harnessServer = await startHarnessServer();
    browserProcess = launchBrowser({ executable, extensionDir, profileDir, browserName });
    connection = new CdpPipeConnection(browserProcess.child.stdio[3], browserProcess.child.stdio[4]);
    await connection.connect();
    const version = await connection.send("Browser.getVersion");
    const extensionId = await loadExtension(connection, profileDir, extensionDir, browserName);

    const popup = await createPage(connection, `chrome-extension://${extensionId}/popup/popup.html`);
    await waitFor(
      () => evaluate(connection, popup.sessionId, "Boolean(document.querySelector('#manage-btn'))"),
      `${browserName} popup ready`
    );
    await runProtectedSiteManagementQa(connection, popup.sessionId, harnessServer.origin);

    const page = await openProtectedHarness(connection, harnessServer.origin);
    const prompt = await runPromptRedactionQa(connection, page);
    await runSecureRevealQa(connection, page, extensionId, prompt.firstPlaceholder);
    await runRefreshSafetyQa(connection, page);
    const scanner = await runScannerQa(connection, extensionId, tempDir);

    console.log(`${browserName} browser QA: ${version.product}`);
    console.log(`${browserName} browser QA: extension loaded (${extensionId})`);
    console.log(`${browserName} browser QA: local harness ${harnessServer.origin}`);
    console.log(
      `${browserName} browser QA: protected-site lifecycle, prompt redaction, reveal, refresh, scanner exports, unsupported file`
    );

    behaviorChecksPassed = true;
    return { browserName, extensionId, product: version.product, prompt, scanner };
  } catch (error) {
    if (browserProcess?.stderr?.()) console.error(browserProcess.stderr());
    throw error;
  } finally {
    await cleanupBrowserQaRun({
      browserName,
      tempDir,
      connection,
      child: browserProcess?.child,
      harnessServer,
      behaviorChecksPassed
    });
  }
}

function getBrowserQaTargets({
  chromeExecutable = findChromeExecutable(),
  edgeExecutable = findEdgeExecutable(),
  targetList = process.env.LEAKGUARD_BROWSER_QA_TARGETS || ""
} = {}) {
  const requested = String(targetList || "chrome")
    .split(",")
    .map((target) => target.trim().toLowerCase())
    .filter(Boolean);
  const uniqueTargets = Array.from(new Set(requested));
  const browsers = [];

  if (uniqueTargets.includes("chrome")) {
    browsers.push({ browserName: "Chrome", executable: chromeExecutable });
  }
  if (uniqueTargets.includes("edge")) {
    browsers.push({ browserName: "Edge", executable: edgeExecutable });
  }

  return browsers;
}

async function main() {
  assertBuiltExtensionExists();
  const browsers = getBrowserQaTargets();

  for (const browser of browsers) {
    await runBrowserQa(browser);
  }
  console.log("PASS extension browser QA harness");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export {
  assertHarnessTempDir,
  cleanupBrowserQaRun,
  closeBrowserTargets,
  getBrowserQaTargets,
  runBrowserQa
};
