import { test as base, expect, chromium } from "@playwright/test";
import { execFile } from "node:child_process";
import fsp from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const chromeBuildDir = path.join(repoRoot, "dist", "chrome");
const fixturesDir = path.join(repoRoot, "tests", "e2e", "fixtures");
const localhostPermission = "http://127.0.0.1/*";
const whatsAppFixtureHost = "web.whatsapp.com";
const whatsAppFixtureOrigin = `https://${whatsAppFixtureHost}`;

function unique(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

async function pathExists(targetPath) {
  try {
    await fsp.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureChromeExtensionBuild() {
  const manifestPath = path.join(chromeBuildDir, "manifest.json");
  if (await pathExists(manifestPath)) return chromeBuildDir;

  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  await execFileAsync(npmCommand, ["run", "build:chrome"], {
    cwd: repoRoot,
    maxBuffer: 16 * 1024 * 1024
  });

  if (!(await pathExists(manifestPath))) {
    throw new Error(`Expected Chrome extension build at ${manifestPath}`);
  }
  return chromeBuildDir;
}

async function copyChromeExtensionForE2E(sourceDir, targetDir) {
  await fsp.rm(targetDir, { recursive: true, force: true });
  await fsp.mkdir(path.dirname(targetDir), { recursive: true });
  await fsp.cp(sourceDir, targetDir, { recursive: true });

  const manifestPath = path.join(targetDir, "manifest.json");
  const manifest = JSON.parse(await fsp.readFile(manifestPath, "utf8"));
  manifest.host_permissions = unique([...(manifest.host_permissions || []), localhostPermission]);
  manifest.web_accessible_resources = (manifest.web_accessible_resources || []).map((entry) => ({
    ...entry,
    matches: unique([...(entry.matches || []), localhostPermission])
  }));
  await fsp.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function startFixtureServer() {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    const requestedPath = url.pathname === "/" ? "/protected-chat.html" : url.pathname;
    const normalizedPath = path.normalize(requestedPath).replace(/^([/\\])+/, "");
    const filePath = path.resolve(fixturesDir, normalizedPath);
    if (!filePath.startsWith(fixturesDir + path.sep) || path.extname(filePath) !== ".html") {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("not found");
      return;
    }

    fsp.readFile(filePath, "utf8")
      .then((fixtureHtml) => {
        response.writeHead(200, {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store"
        });
        response.end(fixtureHtml);
      })
      .catch(() => {
        response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        response.end("not found");
      });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

async function fulfillFixtureRequest(route) {
  const url = new URL(route.request().url());
  const requestedPath = url.pathname === "/" ? "/protected-chat.html" : url.pathname;
  const normalizedPath = path.normalize(requestedPath).replace(/^([/\\])+/, "");
  const filePath = path.resolve(fixturesDir, normalizedPath);

  if (!filePath.startsWith(fixturesDir + path.sep) || path.extname(filePath) !== ".html") {
    await route.fulfill({
      status: 404,
      contentType: "text/plain; charset=utf-8",
      body: "not found"
    });
    return;
  }

  try {
    await route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      headers: { "cache-control": "no-store" },
      body: await fsp.readFile(filePath, "utf8")
    });
  } catch {
    await route.fulfill({
      status: 404,
      contentType: "text/plain; charset=utf-8",
      body: "not found"
    });
  }
}

async function routeWhatsAppFixture(context) {
  await context.route(`${whatsAppFixtureOrigin}/**`, fulfillFixtureRequest);
}

async function discoverExtensionId(context) {
  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent("serviceworker", { timeout: 15000 });
  }

  const extensionId = new URL(serviceWorker.url()).host;
  if (!extensionId) {
    throw new Error(`Could not discover extension id from service worker ${serviceWorker.url()}`);
  }

  return extensionId;
}

export async function getExtensionId(context) {
  return await discoverExtensionId(context);
}

function pageRuntimeErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => {
    errors.push(error.message || String(error));
  });
  return errors;
}

async function sendExtensionMessage(page, message) {
  return await page.evaluate((payload) => {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(payload, resolve);
    });
  }, message);
}

async function registerLocalProtectedSite(context, extensionId, origin) {
  const page = await context.newPage();
  const errors = pageRuntimeErrors(page);
  await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);
  await page.locator("#manage-btn").waitFor();
  const response = await sendExtensionMessage(page, {
    type: "PWM_ADD_PROTECTED_SITE",
    input: origin,
    url: `${origin}/protected-chat.html`
  });
  await page.close();

  expect(errors, "popup runtime errors while registering localhost").toEqual([]);
  expect(response?.ok, response?.error || "protected site registration failed").toBe(true);
  const originUrl = new URL(origin);
  expect(response?.rule?.matchPattern).toBe(`${originUrl.protocol}//${originUrl.hostname}/*`);
}

async function registerLocalProtectedSites(context, extensionId, origins) {
  for (const origin of unique(origins)) {
    await registerLocalProtectedSite(context, extensionId, origin);
  }
}

async function enableProtectedSiteOcr(context, extensionId) {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);
  const response = await sendExtensionMessage(page, {
    type: "PWM_SET_PROTECTED_SITE_OCR_SETTING",
    enabled: true
  });
  await page.close();

  expect(response?.ok, response?.error || "protected-site OCR setting failed").toBe(true);
}

async function captureFailureArtifacts(context, testInfo) {
  const failed = testInfo.status !== testInfo.expectedStatus;
  if (!failed) return;

  const pages = context.pages();
  await Promise.all(
    pages.map(async (page, index) => {
      if (page.isClosed()) return;
      await page.screenshot({
        path: testInfo.outputPath(`failure-page-${index + 1}.png`),
        fullPage: true
      }).catch(() => {});
    })
  );
}

export async function launchExtensionContext(options = {}) {
  const extensionBuildDir = options.extensionBuildDir || await ensureChromeExtensionBuild();
  const runtimeDir = options.runtimeDir || await fsp.mkdtemp(path.join(os.tmpdir(), "leakguard-playwright-e2e-"));
  const profileDir = options.profileDir || path.join(runtimeDir, "profile");
  const extensionDir = options.extensionDir || path.join(runtimeDir, "extension");
  const outputPath = typeof options.outputPath === "function"
    ? options.outputPath
    : (name) => path.join(runtimeDir, name);
  const videoDir = options.videoDir || outputPath("videos");
  const headless = options.headless ?? options.testInfo?.project?.use?.headless !== false;

  await fsp.mkdir(profileDir, { recursive: true });
  await copyChromeExtensionForE2E(extensionBuildDir, extensionDir);

  const args = [
    `--disable-extensions-except=${extensionDir}`,
    `--load-extension=${extensionDir}`,
    "--disable-component-extensions-with-background-pages",
    "--no-default-browser-check",
    "--no-first-run"
  ];
  if (process.env.CI) args.push("--no-sandbox");

  const context = await chromium.launchPersistentContext(profileDir, {
    channel: process.env.LEAKGUARD_E2E_CHROMIUM_CHANNEL || "chromium",
    headless,
    args,
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 900 },
    recordVideo: { dir: videoDir, size: { width: 1280, height: 900 } }
  });

  const extensionId = await getExtensionId(context);
  if (options.routeWhatsAppFixture !== false) {
    await routeWhatsAppFixture(context);
  }
  const fixtureOrigins = unique([
    options.fixtureOrigin,
    ...(Array.isArray(options.fixtureOrigins) ? options.fixtureOrigins : [])
  ]);
  if (fixtureOrigins.length) {
    await registerLocalProtectedSites(context, extensionId, fixtureOrigins);
    await enableProtectedSiteOcr(context, extensionId);
  }

  return {
    context,
    extensionDir,
    extensionId,
    runtimeDir,
    videoDir,
    async close() {
      await context.close().catch(() => {});
    }
  };
}

export const test = base.extend({
  extensionBuildDir: [
    async ({}, use) => {
      await use(await ensureChromeExtensionBuild());
    },
    { scope: "worker" }
  ],
  fixtureServer: [
    async ({}, use) => {
      const server = await startFixtureServer();
      try {
        await use(server);
      } finally {
        await server.close();
      }
    },
    { scope: "worker" }
  ],
  extensionApp: async ({ extensionBuildDir, fixtureServer }, use, testInfo) => {
    const runtimeDir = await fsp.mkdtemp(path.join(os.tmpdir(), "leakguard-playwright-e2e-"));
    const videoDir = testInfo.outputPath("videos");
    const launched = await launchExtensionContext({
      extensionBuildDir,
      runtimeDir,
      videoDir,
      fixtureOrigin: fixtureServer.origin,
      testInfo,
      outputPath: (name) => testInfo.outputPath(name)
    });
    const { context, extensionDir, extensionId } = launched;

    const app = {
      context,
      extensionDir,
      extensionId,
      origin: fixtureServer.origin,
      whatsAppOrigin: whatsAppFixtureOrigin,
      async openProtectedFixture(mode = "textarea") {
        return await openFixturePage(app, { mode });
      },
      async openExtensionPage(relativePath) {
        const page = await context.newPage();
        const errors = pageRuntimeErrors(page);
        await page.goto(`chrome-extension://${extensionId}/${relativePath}`);
        await page.waitForLoadState("domcontentloaded");
        return { page, errors };
      }
    };

    try {
      await use(app);
    } finally {
      const failed = testInfo.status !== testInfo.expectedStatus;
      await captureFailureArtifacts(context, testInfo);
      await launched.close();
      if (process.env.LEAKGUARD_E2E_KEEP_ARTIFACTS !== "1") {
        if (!failed) {
          await fsp.rm(videoDir, { recursive: true, force: true }).catch(() => {});
        }
        await fsp.rm(runtimeDir, { recursive: true, force: true }).catch(() => {});
      }
    }
  }
});

export { expect };

function composerLocator(page) {
  return page.locator("[data-testid='prompt-textarea']:visible").first();
}

function normalizePayloads(fileOrFiles) {
  return (Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles]).map((file) => {
    const buffer = Buffer.isBuffer(file.buffer)
      ? file.buffer
      : Buffer.from(file.buffer || file.text || "", "utf8");
    return {
      name: file.name,
      mimeType: file.mimeType || file.type || "application/octet-stream",
      buffer
    };
  });
}

function serializablePayloads(fileOrFiles) {
  return normalizePayloads(fileOrFiles).map((file) => ({
    name: file.name,
    mimeType: file.mimeType,
    base64: file.buffer.toString("base64")
  }));
}

export async function openFixturePage(extensionApp, options = {}) {
  const mode = options.mode || "textarea";
  const pathName = options.path || "protected-chat.html";
  const page = await extensionApp.context.newPage();
  const origin = options.origin || (mode === "whatsapp" ? extensionApp.whatsAppOrigin : null) || extensionApp.origin;
  const url = new URL(`${origin}/${pathName}`);
  url.searchParams.set("mode", mode);
  await page.goto(url.toString());
  await expect(page.locator(".pwm-panel")).toContainText(/Protection\s*Active/i);
  return page;
}

export async function typeIntoComposer(page, text) {
  const composer = composerLocator(page);
  await composer.fill(text);
  await composer.focus();
}

export async function pasteIntoComposer(page, text) {
  await composerLocator(page).focus();
  await page.evaluate((value) => {
    const composer = window.__leakguardE2E.activeComposer();
    const transfer = new DataTransfer();
    transfer.setData("text/plain", value);
    composer.dispatchEvent(new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: transfer
    }));
  }, text);
}

export async function copyPasteIntoComposer(page, text) {
  await pasteIntoComposer(page, text);
}

export async function clickSend(page) {
  await page.locator("[data-testid='send-button']").click();
}

export async function pressEnterToSend(page) {
  await composerLocator(page).press("Enter");
}

export async function pressShiftEnter(page) {
  await composerLocator(page).press("Shift+Enter");
}

export async function getComposerText(page) {
  return await page.evaluate(() => window.__leakguardE2E.getComposerText());
}

export async function getSentMessages(page) {
  return await page.evaluate(() => window.__leakguardE2E.submissions.map((entry) => entry.text));
}

export async function getFileEvents(page) {
  return await page.evaluate(() => window.__leakguardE2E.fileEvents);
}

export async function getWhatsAppPreviewState(page) {
  return await page.evaluate(() => {
    return window.__leakguardE2E.getWhatsAppPreviewState?.() || null;
  });
}

export async function expectNoRawSecretVisible(page, secret) {
  const visibleText = await page.evaluate(() => {
    const controls = Array.from(document.querySelectorAll("textarea, input, [contenteditable]"))
      .map((element) => {
        if (element.matches("[contenteditable]")) return element.innerText || element.textContent || "";
        return element.value || "";
      })
      .join("\n");
    return `${document.body.innerText || ""}\n${controls}`;
  });
  expect(visibleText).not.toContain(secret);
}

export async function expectSentMessage(page, expectedText) {
  if (expectedText instanceof RegExp) {
    await expect.poll(async () => {
      const messages = await getSentMessages(page);
      return messages.some((message) => {
        expectedText.lastIndex = 0;
        return expectedText.test(message);
      });
    }).toBe(true);
    return;
  }

  await expect.poll(() => getSentMessages(page)).toContainEqual(expectedText);
}

export async function expectComposerText(page, expectedText) {
  await expect.poll(() => getComposerText(page)).toBe(expectedText);
}

export async function expectComposerTextExactly(page, expectedText) {
  await expectComposerText(page, expectedText);
}

export async function expectNoDoubleSend(page, marker) {
  await expect.poll(async () => {
    const messages = await getSentMessages(page);
    return messages.filter((message) => message.includes(marker)).length;
  }).toBe(1);
}

export async function expectNoFileEvents(page) {
  await expect.poll(() => getFileEvents(page)).toEqual([]);
}

export async function expectBlocked(page, pattern = /Raw (?:file|image) upload blocked|blocked/i) {
  await expect.poll(async () => {
    return await page.evaluate(() => {
      const modalText = Array.from(document.querySelectorAll(".pwm-modal-backdrop, .pwm-modal"))
        .map((element) => element.innerText || element.textContent || "")
        .join("\n");
      return `${document.body.innerText || ""}\n${modalText}`;
    });
  }, { timeout: 45000 }).toMatch(pattern);
}

export async function expectNoUnsafeOriginalFilename(page, unsafeName) {
  await expect.poll(async () => {
    return await page.evaluate(() => {
      const controls = Array.from(document.querySelectorAll("textarea, input, [contenteditable]"))
        .map((element) => {
          if (element.matches("[contenteditable]")) return element.innerText || element.textContent || "";
          return element.value || "";
        })
        .join("\n");
      const events = JSON.stringify(window.__leakguardE2E?.fileEvents || []);
      return `${document.body.innerText || ""}\n${controls}\n${events}`;
    });
  }).not.toContain(unsafeName);
}

export async function uploadFile(page, fileOrFiles) {
  const files = normalizePayloads(fileOrFiles);
  await page.setInputFiles("#file-input", files);
}

export async function uploadWhatsAppAttachFile(page, fileOrFiles) {
  const files = normalizePayloads(fileOrFiles);
  await page.locator("#whatsapp-attach-button").click();
  await page.setInputFiles("#whatsapp-file-input", files);
}

export async function dragDropFile(page, fileOrFiles) {
  const payloads = serializablePayloads(fileOrFiles);
  const dataTransfer = await page.evaluateHandle((files) => {
    const transfer = new DataTransfer();
    for (const file of files) {
      const binary = atob(file.base64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      transfer.items.add(new File([bytes], file.name, { type: file.mimeType }));
    }
    return transfer;
  }, payloads);

  const dropZone = page.locator("#drop-zone");
  await dropZone.dispatchEvent("dragenter", { dataTransfer });
  await dropZone.dispatchEvent("dragover", { dataTransfer });
  await dropZone.dispatchEvent("drop", { dataTransfer });
  await dataTransfer.dispose();
}

export async function pasteImageFromClipboard(page, file) {
  const [payload] = serializablePayloads(file);
  await composerLocator(page).focus();
  await page.evaluate((image) => {
    const binary = atob(image.base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    const transfer = new DataTransfer();
    transfer.items.add(new File([bytes], image.name, { type: image.mimeType }));
    window.__leakguardE2E.activeComposer().dispatchEvent(new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: transfer
    }));
  }, payload);
}

export async function pasteImageFromSystemClipboard(page, file) {
  const [payload] = serializablePayloads(file);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: new URL(page.url()).origin
  });
  const clipboardReady = await page.evaluate(async (image) => {
    if (!navigator.clipboard?.write || typeof ClipboardItem !== "function") return false;
    const binary = atob(image.base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    const blob = new Blob([bytes], { type: image.mimeType });
    await navigator.clipboard.write([
      new ClipboardItem({
        [image.mimeType]: blob
      })
    ]);
    return true;
  }, payload);
  expect(clipboardReady, "browser clipboard image write should be available").toBe(true);
  await composerLocator(page).focus();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+V" : "Control+V");
}

export async function dispatchFileDrop(page, fileOrPayload) {
  if ("text" in fileOrPayload && !("buffer" in fileOrPayload)) {
    await dragDropFile(page, {
      name: fileOrPayload.name,
      mimeType: fileOrPayload.mimeType,
      buffer: Buffer.from(fileOrPayload.text, "utf8")
    });
    return;
  }
  await dragDropFile(page, fileOrPayload);
}
