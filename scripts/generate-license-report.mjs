import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getArg(name, fallback) {
  const exactIndex = process.argv.indexOf(name);
  if (exactIndex !== -1 && process.argv[exactIndex + 1]) {
    return process.argv[exactIndex + 1];
  }
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function packageNameFromLockPath(lockPath) {
  const parts = String(lockPath || "").split("/");
  const nodeModulesIndex = parts.lastIndexOf("node_modules");
  if (nodeModulesIndex === -1) return "";
  const first = parts[nodeModulesIndex + 1];
  if (!first) return "";
  if (first.startsWith("@")) {
    const second = parts[nodeModulesIndex + 2];
    return second ? `${first}/${second}` : "";
  }
  return first;
}

function readInstalledLicense(lockPath) {
  const packageJsonPath = path.join(repoRoot, lockPath, "package.json");
  if (!fs.existsSync(packageJsonPath)) return "";
  try {
    const pkg = readJson(packageJsonPath);
    if (typeof pkg.license === "string") return pkg.license;
    if (Array.isArray(pkg.licenses)) {
      return pkg.licenses.map((entry) => entry?.type || entry).filter(Boolean).join(" OR ");
    }
  } catch {
    return "";
  }
  return "";
}

function dependencyTypeFor(name, entry, rootPackage) {
  if (Object.prototype.hasOwnProperty.call(rootPackage.dependencies || {}, name)) {
    return "direct-production";
  }
  if (Object.prototype.hasOwnProperty.call(rootPackage.devDependencies || {}, name)) {
    return "direct-development";
  }
  if (Object.prototype.hasOwnProperty.call(rootPackage.optionalDependencies || {}, name)) {
    return "direct-optional";
  }
  return entry.dev ? "transitive-development" : "transitive-production";
}

function increment(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

const outputDir = path.resolve(repoRoot, getArg("--output-dir", "artifacts/supply-chain"));
const lockPath = path.join(repoRoot, "package-lock.json");
const lock = readJson(lockPath);
const rootPackage = lock.packages?.[""] || {};
const packages = [];
const licenseCounts = new Map();
const dependencyTypeCounts = new Map();

for (const [lockPackagePath, entry] of Object.entries(lock.packages || {})) {
  if (!lockPackagePath || !lockPackagePath.startsWith("node_modules/")) continue;
  const name = packageNameFromLockPath(lockPackagePath);
  if (!name) continue;

  const license = entry.license || readInstalledLicense(lockPackagePath) || "UNKNOWN";
  const dependencyType = dependencyTypeFor(name, entry, rootPackage);
  increment(licenseCounts, license);
  increment(dependencyTypeCounts, dependencyType);
  packages.push({
    name,
    version: entry.version || "",
    license,
    dependencyType,
    optional: Boolean(entry.optional),
    bundled: Boolean(entry.inBundle),
    lockPath: lockPackagePath
  });
}

packages.sort((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`));

const report = {
  generatedAt: new Date().toISOString(),
  project: {
    name: rootPackage.name || lock.name || "leakguard",
    version: rootPackage.version || lock.version || ""
  },
  source: "package-lock.json",
  packageCount: packages.length,
  licenseCounts: Object.fromEntries([...licenseCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
  dependencyTypeCounts: Object.fromEntries(
    [...dependencyTypeCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  ),
  packages
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, "license-report.json"), `${JSON.stringify(report, null, 2)}\n`);

const markdown = [
  "# npm License Report",
  "",
  `Generated: ${report.generatedAt}`,
  "",
  `Packages: ${report.packageCount}`,
  "",
  "## License Counts",
  "",
  "| License | Count |",
  "| --- | ---: |",
  ...Object.entries(report.licenseCounts).map(([license, count]) => `| ${license} | ${count} |`),
  "",
  "## Packages",
  "",
  "| Package | Version | Scope | License | Optional |",
  "| --- | --- | --- | --- | --- |",
  ...packages.map(
    (pkg) =>
      `| ${pkg.name} | ${pkg.version || "-"} | ${pkg.dependencyType} | ${pkg.license} | ${
        pkg.optional ? "yes" : "no"
      } |`
  ),
  ""
].join("\n");

fs.writeFileSync(path.join(outputDir, "license-report.md"), markdown);

console.log(`Wrote npm license report for ${packages.length} packages to ${path.relative(repoRoot, outputDir)}`);
