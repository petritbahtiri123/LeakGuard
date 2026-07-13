import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const preflightPath = path.join(repoRoot, "scripts", "check-browser-environment.mjs");

function runPreflight(targets) {
  return spawnSync(process.execPath, [preflightPath, `--targets=${targets}`], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      CHROME_BIN: process.execPath,
      GOOGLE_CHROME_BIN: "",
      EDGE_BIN: process.execPath,
      MSEDGE_BIN: "",
      FIREFOX_BIN: path.join(repoRoot, "synthetic-missing-firefox"),
      GECKODRIVER_BIN: path.join(repoRoot, "synthetic-missing-geckodriver")
    }
  });
}

const scoped = runPreflight(" ChRoMe , EDGE ");
assert.strictEqual(scoped.status, 0, scoped.stderr || scoped.stdout);
assert.match(scoped.stdout, /Chrome executable/);
assert.match(scoped.stdout, /Edge executable/);
assert.doesNotMatch(`${scoped.stdout}\n${scoped.stderr}`, /Firefox|geckodriver/i);

const unsupported = runPreflight("chrome,safari");
assert.strictEqual(unsupported.status, 1);
assert.match(`${unsupported.stdout}\n${unsupported.stderr}`, /unsupported preflight target\(s\): safari/i);

console.log("PASS browser environment target parsing regressions");
