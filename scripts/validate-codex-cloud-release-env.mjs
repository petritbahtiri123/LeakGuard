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
const prepareBuildPython = process.platform === "win32"
  ? path.join(aiRoot, ".venv", "Scripts", "python.exe")
  : path.join(aiRoot, ".venv", "bin", "python");
const cacheRoot = path.join(repoRoot, ".cache", "codex-release-env");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const pythonImportProbe = "import joblib, numpy, scipy, sklearn, skl2onnx";
const checks = [];

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
  let runCommand = command;
  let runArgs = args;
  if (process.platform === "win32" && /\.cmd$/i.test(command)) {
    runCommand = process.env.ComSpec || "cmd.exe";
    runArgs = ["/d", "/c", command, ...args];
  }
  const result = spawnSync(runCommand, runArgs, {
    cwd: options.cwd || repoRoot,
    env: {
      ...process.env,
      PLAYWRIGHT_BROWSERS_PATH: path.join(cacheRoot, "playwright-browsers"),
      ...options.env
    },
    encoding: "utf8",
    timeout: options.timeoutMs || 30000,
    stdio: ["ignore", "pipe", "pipe"]
  });
  return {
    ok: result.status === 0,
    command: [command, ...args].join(" "),
    output: `${result.stdout || ""}${result.stderr || ""}`.trim() || `exit ${result.status ?? "unknown"}`
  };
}

function addCheck(label, ok, command, detail, remediation) {
  checks.push({ label, ok, command, detail, remediation });
}

function printCheck(check) {
  console.log(`${check.ok ? "PASS" : "FAIL"}: ${check.label}`);
  if (check.command) console.log(`  command: ${check.command}`);
  if (check.detail) console.log(`  detail: ${check.detail}`);
  if (!check.ok && check.remediation) console.log(`  remediation: ${check.remediation}`);
}

function findPython() {
  return findExecutable(process.platform === "win32" ? ["py.exe", "python.exe"] : ["python3", "python"]);
}

function findChrome() {
  const localAppData = process.env.LOCALAPPDATA || "";
  const windowsCandidates =
    process.platform === "win32"
      ? [
          path.join(process.env.PROGRAMFILES || "", "Google", "Chrome", "Application", "chrome.exe"),
          path.join(process.env["PROGRAMFILES(X86)"] || "", "Google", "Chrome", "Application", "chrome.exe"),
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

function findEdge() {
  const localAppData = process.env.LOCALAPPDATA || "";
  const windowsCandidates =
    process.platform === "win32"
      ? [
          path.join(process.env.PROGRAMFILES || "", "Microsoft", "Edge", "Application", "msedge.exe"),
          path.join(process.env["PROGRAMFILES(X86)"] || "", "Microsoft", "Edge", "Application", "msedge.exe"),
          path.join(localAppData, "Microsoft", "Edge", "Application", "msedge.exe")
        ]
      : [];
  return findExecutable([
    process.env.EDGE_BIN,
    process.env.MSEDGE_BIN,
    ...windowsCandidates,
    "microsoft-edge",
    "microsoft-edge-stable",
    "microsoft-edge-beta",
    "microsoft-edge-dev",
    "msedge"
  ]);
}

function findFirefox() {
  const localAppData = process.env.LOCALAPPDATA || "";
  const windowsCandidates =
    process.platform === "win32"
      ? [
          path.join(process.env.PROGRAMFILES || "", "Mozilla Firefox", "firefox.exe"),
          path.join(process.env["PROGRAMFILES(X86)"] || "", "Mozilla Firefox", "firefox.exe"),
          path.join(localAppData, "Mozilla Firefox", "firefox.exe")
        ]
      : [];
  return findExecutable([process.env.FIREFOX_BIN, ...windowsCandidates, "firefox", "firefox-esr"]);
}

function findGeckodriver() {
  return findExecutable([process.env.GECKODRIVER_BIN, "geckodriver"]);
}

function assertTempProfileWritable() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "leakguard-codex-release-env-"));
  const profileDir = path.join(tempRoot, "profile");
  try {
    fs.mkdirSync(profileDir, { recursive: true });
    fs.writeFileSync(path.join(profileDir, "write-test.txt"), "ok\n");
    return { ok: true, detail: profileDir };
  } catch (error) {
    return { ok: false, detail: error.message };
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

function browserLaunchProbe(executable) {
  if (!executable) return { ok: false, output: "not found" };
  const probe = run(executable, ["--headless=new", "--disable-gpu", "--no-sandbox", "--version"], { timeoutMs: 30000 });
  if (probe.ok || process.platform !== "win32") return probe;
  return {
    ...probe,
    ok: true,
    output: `${probe.output}\nWindows browser version probes can attach to an existing browser session or exit without a stable status; scripts/check-browser-environment.mjs and browser gates perform the authoritative launch checks.`
  };
}

console.log("# Codex Cloud LeakGuard release environment validation");
console.log(`platform=${process.platform} arch=${process.arch} release=${os.release()}`);
console.log(`HTTP_PROXY=${process.env.HTTP_PROXY || ""}`);
console.log(`HTTPS_PROXY=${process.env.HTTPS_PROXY || ""}`);
console.log(`NO_PROXY=${process.env.NO_PROXY || ""}`);

const nodeVersion = run(process.execPath, ["--version"]);
addCheck("Node available", nodeVersion.ok, nodeVersion.command, nodeVersion.output, "Install Node.js before running release gates.");
const npmVersion = run(npmCommand, ["--version"]);
addCheck("npm available", npmVersion.ok, npmVersion.command, npmVersion.output, "Install npm and run npm install.");
const npmLs = run(npmCommand, ["ls", "--depth=0"], { timeoutMs: 120000 });
addCheck("npm dependencies installed", npmLs.ok, npmLs.command, npmLs.ok ? "dependencies resolved" : npmLs.output, "Run npm install with working npm registry/proxy access.");

const python = findPython();
addCheck("Python executable", Boolean(python), python || "which python3/python", python || "not found", "Install Python 3 and ensure python3 is on PATH.");
if (python) {
  const pythonVersion = run(python, ["--version"]);
  addCheck("Python version", pythonVersion.ok, pythonVersion.command, pythonVersion.output, "Use a Python version compatible with ai/requirements.txt.");
  const pipVersion = run(python, ["-m", "pip", "--version"]);
  addCheck("pip available", pipVersion.ok, pipVersion.command, pipVersion.output, "Install/enable pip for the Python executable.");
  const importPython = fs.existsSync(prepareBuildPython) ? prepareBuildPython : python;
  const importProbe = run(importPython, ["-c", pythonImportProbe], { cwd: aiRoot });
  addCheck(
    "Python build dependencies import",
    importProbe.ok,
    importProbe.command,
    importProbe.ok ? pythonImportProbe : importProbe.output,
    "Run npm run setup:codex-release-env or install ai/requirements.txt into the Python environment used by prepare:build."
  );
  const pipDryRun = run(
    python,
    ["-m", "pip", "install", "--dry-run", "--ignore-installed", "--disable-pip-version-check", "-r", "requirements.txt"],
    { cwd: aiRoot, timeoutMs: 120000 }
  );
  addCheck(
    "pip can resolve prepare:build dependencies",
    pipDryRun.ok,
    pipDryRun.command,
    pipDryRun.ok ? "ai/requirements.txt resolved without installing" : pipDryRun.output,
    "Fix HTTP_PROXY/HTTPS_PROXY/NO_PROXY/PIP_CERT or preinstall ai/requirements.txt dependencies; prepare:build creates ai/.venv and must be able to resolve these packages."
  );
}

const chrome = findChrome();
const edge = findEdge();
const firefox = findFirefox();
const geckodriver = findGeckodriver();
addCheck("Chrome/Chromium executable", Boolean(chrome), chrome || "which google-chrome/chromium", chrome || "not found", "Install Google Chrome or set CHROME_BIN/GOOGLE_CHROME_BIN. Chromium is a basic fallback only, not a Web Store GO substitute.");
if (chrome) {
  const probe = browserLaunchProbe(chrome);
  addCheck("Chrome/Chromium launch sanity", probe.ok, probe.command, probe.output, "Install missing browser system dependencies or provide a working CHROME_BIN.");
}
addCheck("Edge executable", Boolean(edge), edge || "which microsoft-edge", edge || "not found", "Install Microsoft Edge or set EDGE_BIN/MSEDGE_BIN if Edge gates are required.");
if (edge) {
  const probe = browserLaunchProbe(edge);
  addCheck("Edge launch sanity", probe.ok, probe.command, probe.output, "Install missing browser system dependencies or provide a working EDGE_BIN.");
}
addCheck("Firefox executable", Boolean(firefox), firefox || "which firefox", firefox || "not found", "Install Firefox or set FIREFOX_BIN; current test:browser-gates expects Firefox.");
addCheck("geckodriver or npm fallback", Boolean(geckodriver) || npmVersion.ok, geckodriver || npmCommand, geckodriver ? "geckodriver found" : "npm fallback available", "Install geckodriver or keep npm exec fallback available.");

const tempProfile = assertTempProfileWritable();
addCheck("Writable temp profile directory", tempProfile.ok, "mkdtemp/write/rm", tempProfile.detail, "Fix OS temp directory permissions.");

const browserPreflight = run(process.execPath, [path.join("scripts", "check-browser-environment.mjs")], { timeoutMs: 60000 });
addCheck("Existing browser preflight script", browserPreflight.ok, browserPreflight.command, browserPreflight.output, "Fix failed checks from scripts/check-browser-environment.mjs before browser gates.");

const buildPython = fs.existsSync(prepareBuildPython) ? prepareBuildPython : python;
const buildPrereq = buildPython
  ? run(buildPython, ["-c", pythonImportProbe], { cwd: aiRoot })
  : { ok: false, command: "python -c import probe", output: "python missing" };
addCheck("Build prerequisites before prepare:build", buildPrereq.ok, buildPrereq.command, buildPrereq.ok ? "prepare:build Python imports available" : buildPrereq.output, "Install ai/requirements.txt successfully; do not bypass prepare:build.");

for (const check of checks) {
  printCheck(check);
}

const failed = checks.filter((check) => !check.ok);
if (failed.length) {
  console.error(`\nFAIL Codex Cloud release environment validation (${failed.length} failed check(s)).`);
  process.exit(1);
}

console.log("\nPASS Codex Cloud release environment validation");
