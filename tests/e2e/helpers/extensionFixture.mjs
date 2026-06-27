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
const fixturePath = path.join(repoRoot, "tests", "e2e", "fixtures", "protected-chat.html");
const localhostPermission = "http://127.0.0.1/*";

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
  const fixtureHtml = await fsp.readFile(fixturePath, "utf8");
  const server = http.createServer((request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    if (url.pathname === "/" || url.pathname === "/protected-chat.html") {
      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store"
      });
      response.end(fixtureHtml);
      return;
    }

    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("not found");
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
  expect(response?.rule?.matchPattern).toBe(localhostPermission);
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
    const profileDir = path.join(runtimeDir, "profile");
    const extensionDir = path.join(runtimeDir, "extension");
    const videoDir = testInfo.outputPath("videos");

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
      headless: testInfo.project.use.headless !== false,
      args,
      ignoreHTTPSErrors: true,
      viewport: { width: 1280, height: 900 },
      recordVideo: { dir: videoDir, size: { width: 1280, height: 900 } }
    });

    const extensionId = await discoverExtensionId(context);
    await registerLocalProtectedSite(context, extensionId, fixtureServer.origin);

    const app = {
      context,
      extensionDir,
      extensionId,
      origin: fixtureServer.origin,
      async openProtectedFixture(mode = "textarea") {
        const page = await context.newPage();
        await page.goto(`${fixtureServer.origin}/protected-chat.html?mode=${mode}`);
        await expect(page.locator(".pwm-panel")).toContainText(/Protection\s*Active/i);
        return page;
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
      await context.close().catch(() => {});
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

export async function setComposerText(page, text) {
  await page.evaluate((value) => window.__leakguardE2E.setComposerText(value), text);
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

export async function expectNoDoubleSend(page, marker) {
  await expect.poll(async () => {
    const messages = await getSentMessages(page);
    return messages.filter((message) => message.includes(marker)).length;
  }).toBe(1);
}

export async function expectNoFileEvents(page) {
  await expect.poll(() => getFileEvents(page)).toEqual([]);
}

export async function dispatchFileDrop(page, { name, mimeType, text }) {
  const dataTransfer = await page.evaluateHandle((payload) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([payload.text], payload.name, { type: payload.mimeType }));
    return transfer;
  }, { name, mimeType, text });

  const dropZone = page.locator("#drop-zone");
  await dropZone.dispatchEvent("dragover", { dataTransfer });
  await dropZone.dispatchEvent("drop", { dataTransfer });
  await dataTransfer.dispose();
}
