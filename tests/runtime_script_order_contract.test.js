const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

require(path.join(repoRoot, "src/shared/runtime_scripts.js"));

const { RuntimeScripts } = globalThis.PWM;

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function extractCoreContentScripts() {
  const source = fs.readFileSync(path.join(repoRoot, "src/background/core.js"), "utf8");
  const match = source.match(/const CONTENT_SCRIPT_FILES = RuntimeScripts\.contentScripts;/);
  assert.ok(match, "background core should use RuntimeScripts.contentScripts");
}

function getServiceWorkerImportScripts() {
  const source = fs.readFileSync(path.join(repoRoot, "src/background/service_worker.js"), "utf8");
  const match = source.match(/importScripts\(([\s\S]*?)\);/);
  assert.ok(match, "Chrome service worker should declare importScripts()");
  return [...match[1].matchAll(/"([^"]+)"/g)].map(([, script]) =>
    path.posix.normalize(path.posix.join("background", script))
  );
}

assert.ok(RuntimeScripts, "RuntimeScripts should be exported on PWM");
assert.ok(Object.isFrozen(RuntimeScripts.contentScripts), "content script order should be frozen");
assert.ok(Object.isFrozen(RuntimeScripts.backgroundScripts), "background script order should be frozen");

const baseManifest = readJson("manifests/base.json");
const firefoxManifest = readJson("manifests/firefox.json");

assert.deepStrictEqual(
  baseManifest.content_scripts?.[0]?.js,
  RuntimeScripts.contentScripts,
  "static manifest content script order should match RuntimeScripts.contentScripts"
);

extractCoreContentScripts();

assert.deepStrictEqual(
  getServiceWorkerImportScripts(),
  RuntimeScripts.backgroundScripts,
  "Chrome service worker import order should match RuntimeScripts.backgroundScripts"
);

assert.deepStrictEqual(
  firefoxManifest.background?.scripts,
  RuntimeScripts.backgroundScripts,
  "Firefox background scripts should match RuntimeScripts.backgroundScripts"
);

console.log("PASS runtime script order contract");
