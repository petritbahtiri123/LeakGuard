import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const OSV_QUERY_BATCH_URL = "https://api.osv.dev/v1/querybatch";

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

function dependencyTypeFor(name, entry, rootPackage) {
  if (Object.prototype.hasOwnProperty.call(rootPackage.dependencies || {}, name)) {
    return "direct-production";
  }
  if (Object.prototype.hasOwnProperty.call(rootPackage.devDependencies || {}, name)) {
    return "direct-development";
  }
  return entry.dev ? "transitive-development" : "transitive-production";
}

async function queryOsv(packages) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(OSV_QUERY_BATCH_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "LeakGuard supply-chain reporting"
      },
      body: JSON.stringify({
        queries: packages.map((pkg) => ({
          version: pkg.version,
          package: {
            name: pkg.name,
            ecosystem: "npm"
          }
        }))
      }),
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`OSV querybatch failed with HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function writeReports(outputDir, report) {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "osv-report.json"), `${JSON.stringify(report, null, 2)}\n`);

  const vulnerableResults = report.results.filter((entry) => entry.vulnerabilities.length);
  const markdown = [
    "# OSV Dependency Report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Reporting mode: non-blocking",
    "",
    `Packages queried: ${report.packageCount}`,
    `Packages with vulnerabilities: ${report.vulnerablePackageCount}`,
    `Vulnerability references: ${report.vulnerabilityReferenceCount}`,
    "",
    ...(report.error
      ? ["## Error", "", report.error.message || String(report.error), ""]
      : [
          "## Vulnerable Packages",
          "",
          vulnerableResults.length
            ? "| Package | Version | Scope | OSV IDs |\n| --- | --- | --- | --- |\n" +
              vulnerableResults
                .map(
                  (entry) =>
                    `| ${entry.name} | ${entry.version} | ${entry.dependencyType} | ${entry.vulnerabilities
                      .map((vuln) => vuln.id)
                      .join(", ")} |`
                )
                .join("\n")
            : "No OSV vulnerabilities were returned for package-lock dependencies.",
          ""
        ])
  ].join("\n");

  fs.writeFileSync(path.join(outputDir, "osv-report.md"), markdown);
}

const outputDir = path.resolve(repoRoot, getArg("--output-dir", "artifacts/supply-chain"));
const lock = readJson(path.join(repoRoot, "package-lock.json"));
const rootPackage = lock.packages?.[""] || {};
const packages = Object.entries(lock.packages || {})
  .filter(([lockPackagePath, entry]) => lockPackagePath.startsWith("node_modules/") && entry?.version)
  .map(([lockPackagePath, entry]) => ({
    name: packageNameFromLockPath(lockPackagePath),
    version: entry.version,
    dependencyType: dependencyTypeFor(packageNameFromLockPath(lockPackagePath), entry, rootPackage),
    lockPath: lockPackagePath
  }))
  .filter((pkg) => pkg.name)
  .sort((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`));

const report = {
  generatedAt: new Date().toISOString(),
  source: "package-lock.json",
  osvEndpoint: OSV_QUERY_BATCH_URL,
  reportingOnly: true,
  submittedData: "npm package names, versions, and ecosystem only",
  packageCount: packages.length,
  vulnerablePackageCount: 0,
  vulnerabilityReferenceCount: 0,
  error: null,
  results: packages.map((pkg) => ({ ...pkg, vulnerabilities: [] }))
};

try {
  const response = await queryOsv(packages);
  const results = Array.isArray(response.results) ? response.results : [];
  report.results = packages.map((pkg, index) => {
    const vulnerabilities = Array.isArray(results[index]?.vulns)
      ? results[index].vulns.map((vuln) => ({
          id: vuln.id || "",
          modified: vuln.modified || ""
        }))
      : [];
    return { ...pkg, vulnerabilities };
  });
  report.vulnerablePackageCount = report.results.filter((entry) => entry.vulnerabilities.length).length;
  report.vulnerabilityReferenceCount = report.results.reduce(
    (total, entry) => total + entry.vulnerabilities.length,
    0
  );
} catch (error) {
  report.error = {
    message: error?.message || String(error)
  };
}

writeReports(outputDir, report);

const summary = report.error
  ? `OSV report written with query error: ${report.error.message}`
  : `OSV report written for ${packages.length} npm packages; ${report.vulnerablePackageCount} package(s) had OSV results.`;
console.log(summary);
