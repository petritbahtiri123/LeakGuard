#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, "..");
const aiRoot = path.join(repoRoot, "ai");
const requirementsPath = path.join(aiRoot, "requirements.txt");
const cacheRoot = path.join(repoRoot, ".cache", "codex-release-env");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const pythonDeps = fs
  .readFileSync(requirementsPath, "utf8")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"));
const knownProxyCanaryDependency = "joblib>=1.3";

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

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || repoRoot,
    env: {
      ...process.env,
      PLAYWRIGHT_BROWSERS_PATH: path.join(cacheRoot, "playwright-browsers"),
      PIP_CACHE_DIR: path.join(cacheRoot, "pip"),
      npm_config_cache: path.join(cacheRoot, "npm"),
      ...options.env
    },
    encoding: "utf8",
    timeout: options.timeoutMs || 120000,
    stdio: options.inherit ? "inherit" : ["ignore", "pipe", "pipe"]
  });
  return result;
}

function outputOf(command, args) {
  const result = run(command, args, { timeoutMs: 30000 });
  return {
    ok: result.status === 0,
    output: `${result.stdout || ""}${result.stderr || ""}`.trim() || `exit ${result.status ?? "unknown"}`
  };
}

function printSection(title) {
  console.log(`\n## ${title}`);
}

function printCheck(ok, label, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}: ${label}${detail ? ` - ${detail}` : ""}`);
}

function fail(message, remediation) {
  console.error(`\nSETUP FAILURE: ${message}`);
  if (remediation) console.error(`Remediation: ${remediation}`);
  process.exitCode = 1;
}

function findPython() {
  return findExecutable(process.platform === "win32" ? ["py.exe", "python.exe"] : ["python3", "python"]);
}

function findChrome() {
  return findExecutable([
    process.env.CHROME_BIN,
    process.env.GOOGLE_CHROME_BIN,
    "google-chrome",
    "google-chrome-stable",
    "chromium-browser",
    "chromium",
    "chrome"
  ]);
}

function findEdge() {
  return findExecutable([
    process.env.EDGE_BIN,
    process.env.MSEDGE_BIN,
    "microsoft-edge",
    "microsoft-edge-stable",
    "microsoft-edge-beta",
    "microsoft-edge-dev",
    "msedge"
  ]);
}

function findFirefox() {
  return findExecutable([process.env.FIREFOX_BIN, "firefox", "firefox-esr"]);
}

function checkPipInstall(python) {
  const target = path.join(cacheRoot, "pip-probe-target");
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });
  const result = run(
    python,
    ["-m", "pip", "install", "--disable-pip-version-check", "--target", target, ...pythonDeps],
    { cwd: aiRoot, timeoutMs: 180000 }
  );
  fs.rmSync(target, { recursive: true, force: true });
  return result;
}

function installPlaywrightBrowsers() {
  const npx = findExecutable([npxCommand, "npx"]);
  if (!npx) {
    printCheck(false, "npx available for Playwright browser install", "install npm/npx before browser setup");
    return false;
  }

  console.log("Attempting Playwright Chromium fallback install: npx playwright install --with-deps chromium");
  let result = run(npx, ["playwright", "install", "--with-deps", "chromium"], { inherit: true, timeoutMs: 600000 });
  if (result.status === 0) return true;

  console.log("Playwright --with-deps failed; retrying browser-only install without system packages...");
  result = run(npx, ["playwright", "install", "chromium"], { inherit: true, timeoutMs: 600000 });
  return result.status === 0;
}

fs.mkdirSync(cacheRoot, { recursive: true });

printSection("Platform");
console.log(`platform=${process.platform} arch=${process.arch} release=${os.release()}`);
console.log(`project cache=${path.relative(repoRoot, cacheRoot)}`);

printSection("Node and npm");
console.log(`node=${process.version}`);
const npmVersion = outputOf(npmCommand, ["--version"]);
printCheck(npmVersion.ok, "npm version", npmVersion.output);

printSection("Python and pip");
const python = findPython();
printCheck(Boolean(python), "Python executable", python || "python3/python not found");
if (!python) {
  fail("Python is required for prepare:build.", "Install Python 3 and ensure python3 is on PATH.");
} else {
  printCheck(true, "Python version", outputOf(python, ["--version"]).output);
  const pipVersion = outputOf(python, ["-m", "pip", "--version"]);
  printCheck(pipVersion.ok, "pip version", pipVersion.output);
  if (!pipVersion.ok) {
    fail("pip is unavailable.", "Install/enable pip for the Python executable used by prepare:build.");
  }
}

printSection("Proxy environment");
for (const key of ["HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY", "http_proxy", "https_proxy", "no_proxy"]) {
  console.log(`${key}=${process.env[key] || ""}`);
}

printSection("npm dependencies");
const npmLs = run(npmCommand, ["ls", "--depth=0"], { timeoutMs: 120000 });
if (npmLs.status === 0) {
  printCheck(true, "npm dependencies installed", "npm ls --depth=0 passed");
} else {
  printCheck(false, "npm dependencies installed", "npm ls --depth=0 failed; running npm install");
  const npmInstall = run(npmCommand, ["install"], { inherit: true, timeoutMs: 600000 });
  if (npmInstall.status !== 0) {
    fail("npm install failed.", "Fix npm registry/proxy access, then rerun npm run setup:codex-release-env.");
  }
}

printSection("Python build dependencies");
console.log(`requirements=${pythonDeps.join(", ")}`);
console.log(`proxy canary dependency=${knownProxyCanaryDependency}`);
if (python) {
  const pipProbe = checkPipInstall(python);
  if (pipProbe.status === 0) {
    printCheck(true, "pip can install prepare:build dependencies", "probe install succeeded in project-local cache target");
  } else {
    const combined = `${pipProbe.stdout || ""}${pipProbe.stderr || ""}`;
    const failedDependency = pythonDeps.find((dep) => combined.toLowerCase().includes(dep.split(/[<>=!~]/, 1)[0].toLowerCase())) || pythonDeps[0] || "unknown";
    printCheck(false, "pip can install prepare:build dependencies", `failed near ${failedDependency}`);
    console.error(combined.trim());
    fail(
      "pip dependency installation is blocked.",
      "Set working HTTP_PROXY/HTTPS_PROXY/NO_PROXY/PIP_CERT values or preinstall ai/requirements.txt dependencies in ai/.venv; do not bypass prepare:build."
    );
  }
}

printSection("Browser binaries");
const chrome = findChrome();
const edge = findEdge();
const firefox = findFirefox();
printCheck(Boolean(chrome), "Chrome/Chromium executable", chrome || "missing; set CHROME_BIN/GOOGLE_CHROME_BIN or install Chrome/Chromium");
printCheck(Boolean(edge), "Edge executable", edge || "missing; set EDGE_BIN/MSEDGE_BIN if Edge gates are expected");
printCheck(Boolean(firefox), "Firefox executable", firefox || "missing; set FIREFOX_BIN if Firefox gates are expected");

printSection("Playwright Chromium fallback");
const playwrightOk = installPlaywrightBrowsers();
printCheck(playwrightOk, "Playwright Chromium fallback install", playwrightOk ? "installed/verified" : "failed");
if (!playwrightOk) {
  fail("Playwright Chromium fallback installation failed.", "Install system browser dependencies manually or provide CHROME_BIN for existing browser gates.");
}

if (!chrome || !edge || !firefox) {
  fail(
    "Required branded browser binaries are still missing for existing browser gates.",
    "Install Google Chrome, Microsoft Edge, and Firefox or set CHROME_BIN/EDGE_BIN/FIREFOX_BIN. Chromium fallback can validate basics only; it is not a Chrome/Edge release GO substitute."
  );
}

if (process.exitCode) {
  console.error("\nCodex Cloud release environment setup did not complete. See failures above.");
} else {
  console.log("\nPASS Codex Cloud release environment setup");
}
