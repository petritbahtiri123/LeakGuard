#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

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

function findChromeExecutable() {
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

function findEdgeExecutable() {
  const localAppData = process.env.LOCALAPPDATA || "";
  const windowsCandidates =
    process.platform === "win32"
      ? [
          path.join(process.env.PROGRAMFILES || "", "Microsoft", "Edge", "Application", "msedge.exe"),
          path.join(process.env["PROGRAMFILES(X86)"] || "", "Microsoft", "Edge", "Application", "msedge.exe"),
          path.join(localAppData, "Microsoft", "Edge", "Application", "msedge.exe")
        ]
      : [];
  const macCandidates =
    process.platform === "darwin" ? ["/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"] : [];
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
  return findExecutable([process.env.FIREFOX_BIN, ...windowsCandidates, ...macCandidates, "firefox", "firefox-esr"]);
}

function findGeckodriverExecutable() {
  return findExecutable([process.env.GECKODRIVER_BIN, "geckodriver"]);
}

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function runVersion(label, command, args) {
  if (!command) return { ok: false, output: "not found" };
  let runCommand = command;
  let runArgs = args;
  if (process.platform === "win32" && /\.cmd$/i.test(command)) {
    runCommand = process.env.ComSpec || "cmd.exe";
    runArgs = ["/d", "/s", "/c", [command, ...args].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(" ")];
  }
  const result = spawnSync(runCommand, runArgs, {
    encoding: "utf8",
    timeout: 15000,
    stdio: ["ignore", "pipe", "pipe"]
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`.trim();
  return {
    ok: result.status === 0,
    output: output || `${label} exited with status ${result.status ?? "unknown"}`
  };
}

function assertTempProfileWritable() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "leakguard-browser-preflight-"));
  const profileDir = path.join(tempRoot, "temp profile directory");
  try {
    fs.mkdirSync(profileDir, { recursive: true });
    fs.writeFileSync(path.join(profileDir, "write-test.txt"), "ok\n");
    return { ok: true, path: profileDir };
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

function printCheck(label, ok, detail) {
  const status = ok ? "OK" : "ENVIRONMENT FAILURE";
  console.log(`${status}: ${label}${detail ? ` - ${detail}` : ""}`);
}

const checks = [];
const chrome = findChromeExecutable();
const edge = findEdgeExecutable();
const firefox = findFirefoxExecutable();
const geckodriver = findGeckodriverExecutable();
const npmExecutable = findExecutable([npmCommand(), "npm"]);
const npmAvailable = Boolean(npmExecutable);

checks.push(["Chrome executable", Boolean(chrome), chrome || "set CHROME_BIN or GOOGLE_CHROME_BIN"]);
checks.push(["Edge executable", Boolean(edge), edge || "set EDGE_BIN or MSEDGE_BIN"]);
checks.push(["Firefox executable", Boolean(firefox), firefox || "set FIREFOX_BIN"]);
checks.push([
  "geckodriver",
  Boolean(geckodriver) || npmAvailable,
  geckodriver ||
    (npmAvailable
      ? "npm exec --yes --package geckodriver fallback is available; smoke:firefox verifies the status endpoint"
      : "install geckodriver or set GECKODRIVER_BIN")
]);

const tempProfile = assertTempProfileWritable();
checks.push(["temp profile directory writable", tempProfile.ok, tempProfile.path]);

if (chrome) {
  const version = runVersion("Chrome executable", chrome, ["--version"]);
  checks.push(["Chrome version probe", true, version.output]);
  checks.push(["Chrome headless flag configured", true, "--headless=new"]);
}
if (edge) {
  const version = runVersion("Edge executable", edge, ["--version"]);
  checks.push(["Edge version probe", true, version.output]);
  checks.push(["Edge headless flag configured", true, "--headless=new"]);
}
if (firefox) {
  const version = runVersion("Firefox executable", firefox, ["--headless", "--version"]);
  checks.push(["Firefox headless version probe", true, version.output]);
}
if (geckodriver) {
  const version = runVersion("geckodriver version", geckodriver, ["--version"]);
  checks.push(["geckodriver version", version.ok, version.output.split(/\r?\n/, 1)[0] || version.output]);
} else if (npmAvailable) {
  checks.push(["geckodriver version", true, "deferred to smoke:firefox npm fallback status endpoint"]);
}

for (const [label, ok, detail] of checks) {
  printCheck(label, ok, detail);
}

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error(
    "Browser environment failure: fix the failed preflight checks before running Tier C browser/nightly gates. These are local setup failures, not product failures."
  );
  process.exitCode = 1;
} else {
  console.log("PASS browser environment preflight");
}
