#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, "..");
const aiRoot = path.join(repoRoot, "ai");
const venvRoot = path.join(aiRoot, ".venv");
const pythonBin = process.platform === "win32"
  ? path.join(venvRoot, "Scripts", "python.exe")
  : path.join(venvRoot, "bin", "python");
const onnxRuntimeDist = path.join(repoRoot, "node_modules", "onnxruntime-web", "dist");
const generatedDataset = path.join(aiRoot, "dataset", "generated", "initial_dataset.jsonl");
const modelFiles = [
  path.join(aiRoot, "models", "leakguard_secret_classifier.joblib"),
  path.join(aiRoot, "models", "leakguard_secret_classifier.features.json"),
  path.join(aiRoot, "models", "leakguard_secret_classifier.onnx")
];
const modelSourcePaths = [
  path.join(aiRoot, "requirements.txt"),
  path.join(aiRoot, "scripts"),
  path.join(aiRoot, "dataset", "labeled"),
  path.join(aiRoot, "dataset", "test"),
  generatedDataset
];

function pathExists(targetPath) {
  try {
    fs.accessSync(targetPath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function executable(command) {
  if (process.platform !== "win32") {
    return command;
  }

  return command.endsWith(".cmd") || command.endsWith(".exe") ? command : `${command}.cmd`;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || repoRoot,
    env: { ...process.env, ...options.env },
    stdio: "inherit"
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

function ensureNodeDependencies() {
  if (pathExists(onnxRuntimeDist)) {
    return;
  }

  process.stdout.write("Missing npm dependencies; running npm install...\n");
  run(executable("npm"), ["install"]);
}

function findSystemPython() {
  const candidates = process.platform === "win32"
    ? [
        { command: "py.exe", args: ["-3"] },
        { command: "python.exe", args: [] }
      ]
    : [
        { command: "python3", args: [] },
        { command: "python", args: [] }
      ];

  for (const { command, args } of candidates) {
    const result = spawnSync(command, [...args, "--version"], { stdio: "ignore" });
    if (result.status === 0) {
      return { command, args };
    }
  }
  throw new Error("Python 3 is required to train the local AI model.");
}

function ensurePythonEnvironment() {
  if (!pathExists(pythonBin)) {
    process.stdout.write("Creating AI training virtual environment at ai/.venv...\n");
    const python = findSystemPython();
    run(python.command, [...python.args, "-m", "venv", venvRoot]);
  }

  const check = spawnSync(
    pythonBin,
    [
      "-c",
      "import joblib, numpy, scipy, sklearn, skl2onnx"
    ],
    { cwd: aiRoot, stdio: "ignore" }
  );

  if (check.status === 0) {
    return;
  }

  process.stdout.write("Installing AI training dependencies...\n");
  run(pythonBin, ["-m", "pip", "install", "-r", "requirements.txt"], { cwd: aiRoot });
}

function countJsonlRecords(filePath) {
  if (!pathExists(filePath)) {
    return 0;
  }
  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim()).length;
}

function newestMtime(paths) {
  let newest = 0;
  for (const itemPath of paths) {
    if (!pathExists(itemPath)) {
      continue;
    }
    const stats = fs.statSync(itemPath);
    if (stats.isDirectory()) {
      for (const entry of fs.readdirSync(itemPath)) {
        newest = Math.max(newest, newestMtime([path.join(itemPath, entry)]));
      }
      continue;
    }
    newest = Math.max(newest, stats.mtimeMs);
  }
  return newest;
}

function oldestMtime(paths) {
  let oldest = Number.POSITIVE_INFINITY;
  for (const itemPath of paths) {
    if (!pathExists(itemPath)) {
      return 0;
    }
    oldest = Math.min(oldest, fs.statSync(itemPath).mtimeMs);
  }
  return oldest === Number.POSITIVE_INFINITY ? 0 : oldest;
}

function modelIsCurrent(targetCount) {
  if (countJsonlRecords(generatedDataset) !== targetCount) {
    return false;
  }
  return oldestMtime(modelFiles) > newestMtime(modelSourcePaths);
}

function prepareModel() {
  ensurePythonEnvironment();

  const targetCount = Number(process.env.LEAKGUARD_TRAINING_EXAMPLES || "2000");
  if (!Number.isInteger(targetCount) || targetCount <= 0) {
    throw new Error("LEAKGUARD_TRAINING_EXAMPLES must be a positive integer.");
  }

  if (countJsonlRecords(generatedDataset) !== targetCount) {
    process.stdout.write(`Generating ${targetCount} synthetic AI training examples...\n`);
    run(pythonBin, ["scripts/generate_dataset.py", "--count", String(targetCount)], { cwd: aiRoot });
  }

  if (modelIsCurrent(targetCount)) {
    process.stdout.write("Local AI classifier is current; skipping training.\n");
    return;
  }

  process.stdout.write("Training local AI classifier...\n");
  run(pythonBin, ["scripts/train_classifier.py"], { cwd: aiRoot });
  run(pythonBin, ["scripts/export_onnx.py"], { cwd: aiRoot });

  for (const file of modelFiles) {
    if (!pathExists(file)) {
      throw new Error(`Expected model artifact was not created: ${file}`);
    }
  }
}

function main() {
  ensureNodeDependencies();
  prepareModel();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

export {
  ensureNodeDependencies,
  executable,
  findSystemPython,
  main,
  prepareModel,
  run
};
