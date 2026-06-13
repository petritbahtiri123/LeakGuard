#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import zlib from "node:zlib";

const DEFAULT_CANDIDATES = [
  "tesseract.js",
  "tesseract.js-core",
  "@tesseract.js-data/eng",
  "ocrad.js"
];

const TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".mjs",
  ".md",
  ".ts",
  ".txt",
  ".wasm.js"
]);

const UNSAFE_PATTERNS = [
  { name: "eval", pattern: /\beval\s*\(/ },
  { name: "Function constructor", pattern: /\bnew\s+Function\b|\bFunction\s*\(/ },
  { name: "unsafe-eval string", pattern: /unsafe-eval/ }
];

const REMOTE_PATTERNS = [
  { name: "http(s) URL", pattern: /https?:\/\// },
  { name: "unpkg CDN", pattern: /unpkg\.com/i },
  { name: "jsDelivr CDN", pattern: /cdn\.jsdelivr\.net/i },
  { name: "fetch call", pattern: /\bfetch\s*\(/ },
  { name: "XMLHttpRequest", pattern: /\bXMLHttpRequest\b/ },
  { name: "importScripts", pattern: /\bimportScripts\s*\(/ }
];

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(2)} KiB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MiB`;
}

function parseOctal(buffer, start, length) {
  const text = buffer.toString("utf8", start, start + length).replace(/\0.*$/, "").trim();
  return text ? Number.parseInt(text, 8) : 0;
}

function parseTarGz(tarballPath) {
  const tar = zlib.gunzipSync(fs.readFileSync(tarballPath));
  const files = [];
  let offset = 0;

  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;

    const rawName = header.toString("utf8", 0, 100).replace(/\0.*$/, "");
    const prefix = header.toString("utf8", 345, 500).replace(/\0.*$/, "");
    const name = prefix ? `${prefix}/${rawName}` : rawName;
    const size = parseOctal(header, 124, 12);
    const type = header.toString("utf8", 156, 157);
    const contentStart = offset + 512;
    const contentEnd = contentStart + size;
    if (type === "0" || type === "\0" || type === "") {
      files.push({
        path: name.replace(/^package\//, ""),
        size,
        content: tar.subarray(contentStart, contentEnd)
      });
    }
    offset = contentStart + Math.ceil(size / 512) * 512;
  }

  return files;
}

function isProbablyText(file) {
  const extension = path.extname(file.path).toLowerCase();
  if (TEXT_EXTENSIONS.has(extension)) return true;
  if (file.path.endsWith(".wasm.js")) return true;
  if (file.size > 5 * 1024 * 1024) return false;
  const sample = file.content.subarray(0, Math.min(file.content.length, 512));
  return !sample.includes(0);
}

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function findMatches(files, patterns) {
  const matches = [];
  for (const file of files) {
    if (!isProbablyText(file)) continue;
    const text = file.content.toString("utf8");
    for (const pattern of patterns) {
      if (pattern.pattern.test(text)) {
        matches.push(`${pattern.name}: ${file.path}`);
      }
    }
  }
  return uniqueSorted(matches);
}

function classifyAssets(files) {
  const wasmFiles = [];
  const workerFiles = [];
  const modelFiles = [];
  const runtimeFiles = [];

  for (const file of files) {
    const lower = file.path.toLowerCase();
    if (lower.endsWith(".wasm")) wasmFiles.push(file.path);
    if (lower.includes("worker") && /\.(js|mjs|cjs)$/.test(lower)) workerFiles.push(file.path);
    if (lower.includes("traineddata") || lower.includes(".traineddata") || lower.includes(".lstm")) {
      modelFiles.push(file.path);
    }
    if (lower.endsWith(".wasm") || lower.includes("worker") || lower.includes("core") || lower.includes("simd")) {
      runtimeFiles.push(file.path);
    }
  }

  return {
    wasmFiles: uniqueSorted(wasmFiles),
    workerFiles: uniqueSorted(workerFiles),
    modelFiles: uniqueSorted(modelFiles),
    runtimeFiles: uniqueSorted(runtimeFiles)
  };
}

function safeJsonParse(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function readPackageMetadata(files) {
  const packageFile = files.find((file) => file.path === "package.json");
  if (!packageFile) return {};
  return safeJsonParse(packageFile.content.toString("utf8"), {}) || {};
}

function npmPack(candidate, destination) {
  if (!/^(?:@?[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i.test(candidate)) {
    return {
      ok: false,
      error: `Unsafe package name rejected: ${candidate}`
    };
  }
  const npmArgs = ["pack", candidate, "--json", "--pack-destination", destination];
  const spawnOptions = {
    cwd: destination,
    encoding: "utf8"
  };
  if (process.platform === "win32") {
    const command = [
      "npm pack",
      candidate,
      "--json",
      "--pack-destination",
      destination
    ].join(" ");
    const result = spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", command], spawnOptions);
    return parseNpmPackResult(candidate, destination, result);
  }
  const result = spawnSync(
    "npm",
    npmArgs,
    spawnOptions
  );
  return parseNpmPackResult(candidate, destination, result);
}

function parseNpmPackResult(candidate, destination, result) {
  if (result.status !== 0) {
    return {
      ok: false,
      error: (result.error?.message || result.stderr || result.stdout || `npm pack failed for ${candidate}`).trim()
    };
  }
  const parsed = safeJsonParse(result.stdout, []);
  const entry = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!entry?.filename) {
    return {
      ok: false,
      error: `npm pack did not return a tarball for ${candidate}`
    };
  }
  return {
    ok: true,
    tarballPath: path.resolve(destination, entry.filename),
    npmPackMetadata: entry
  };
}

function analyzeCandidate(candidate, tempDir) {
  const packed = npmPack(candidate, tempDir);
  if (!packed.ok) {
    return {
      package: candidate,
      ok: false,
      error: packed.error
    };
  }

  const files = parseTarGz(packed.tarballPath);
  const packageMetadata = readPackageMetadata(files);
  const assets = classifyAssets(files);
  const unpackedBytes = files.reduce((sum, file) => sum + file.size, 0);
  const tarballBytes = fs.statSync(packed.tarballPath).size;
  const unsafeMatches = findMatches(files, UNSAFE_PATTERNS);
  const remoteMatches = findMatches(files, REMOTE_PATTERNS);

  return {
    package: candidate,
    ok: true,
    version: packageMetadata.version || packed.npmPackMetadata.version || "",
    license: packageMetadata.license || "",
    dependencyCount: Object.keys(packageMetadata.dependencies || {}).length,
    unpackedBytes,
    unpackedSize: formatBytes(unpackedBytes),
    packageBytes: tarballBytes,
    packageSize: formatBytes(tarballBytes),
    fileCount: files.length,
    wasmFiles: assets.wasmFiles,
    workerFiles: assets.workerFiles,
    modelFiles: assets.modelFiles,
    runtimeFiles: assets.runtimeFiles.slice(0, 20),
    unsafeMatches,
    remoteMatches,
    hasUnsafeEvalRisk: unsafeMatches.length > 0,
    hasRemoteFetchRisk: remoteMatches.length > 0,
    expectedInstalledSizeImpact: formatBytes(unpackedBytes),
    expectedZippedSizeImpact: formatBytes(tarballBytes)
  };
}

function printSummary(results) {
  console.table(
    results.map((result) => ({
      package: result.package,
      ok: result.ok ? "yes" : "no",
      version: result.version || "",
      license: result.license || "",
      unpacked: result.unpackedSize || "",
      packed: result.packageSize || "",
      files: result.fileCount || 0,
      wasm: result.wasmFiles?.length || 0,
      workers: result.workerFiles?.length || 0,
      models: result.modelFiles?.length || 0,
      unsafe: result.unsafeMatches?.length || 0,
      remote: result.remoteMatches?.length || 0
    }))
  );
}

function run() {
  const candidates = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  const selected = candidates.length ? candidates : DEFAULT_CANDIDATES;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "leakguard-ocr-spike-"));
  let results = [];
  try {
    results = selected.map((candidate) => analyzeCandidate(candidate, tempDir));
    printSummary(results);
    console.log(JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}

export {
  analyzeCandidate,
  classifyAssets,
  parseTarGz
};
