import path from "node:path";
import { fileURLToPath } from "node:url";
import { findExecutable, runChromiumSmoke } from "./chrome_smoke.test.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

function findEdgeExecutable() {
  const localAppData = process.env.LOCALAPPDATA || "";
  const windowsCandidates =
    process.platform === "win32"
      ? [
          path.join(process.env.PROGRAMFILES || "", "Microsoft", "Edge", "Application", "msedge.exe"),
          path.join(
            process.env["PROGRAMFILES(X86)"] || "",
            "Microsoft",
            "Edge",
            "Application",
            "msedge.exe"
          ),
          path.join(localAppData, "Microsoft", "Edge", "Application", "msedge.exe")
        ]
      : [];
  const macCandidates =
    process.platform === "darwin"
      ? ["/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"]
      : [];

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

runChromiumSmoke({
  browserName: "Edge",
  sourceExtensionDir: path.join(repoRoot, "dist", "chrome"),
  buildCommand: "npm run build:chrome",
  findBrowserExecutable: findEdgeExecutable,
  headlessEnvName: "LEAKGUARD_EDGE_HEADLESS",
  missingMessage: "Microsoft Edge was not found. Set EDGE_BIN or MSEDGE_BIN to run this smoke test."
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
