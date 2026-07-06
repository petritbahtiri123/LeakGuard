const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { pathToFileURL } = require("url");

const repoRoot = path.join(__dirname, "..");
const policyModule = require(path.join(repoRoot, "src/shared/policy.js"));
const protectedSitesModule = require(path.join(repoRoot, "src/shared/protected_sites.js"));

const restrictiveExtensionPageCsp =
  "script-src 'self' 'wasm-unsafe-eval'; object-src 'none'; base-uri 'none'; frame-ancestors 'none';";
const restrictiveSandboxCsp =
  "sandbox allow-scripts; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; object-src 'none'; base-uri 'none';";
const tesseractCoreProofFiles = Object.freeze([
  "shared/ocr/tesseract-core/tesseract-core.js",
  "shared/ocr/tesseract-core/tesseract-core.wasm"
]);
const englishLanguageProofFiles = Object.freeze([
  "shared/ocr/tessdata/eng.traineddata.gz"
]);
const syntheticRecognitionProofFiles = Object.freeze([
  "shared/ocr/fixtures/synthetic-test-ocr.png"
]);
const forbiddenPackageDirectories = new Set([
  ".git",
  ".github",
  "artifacts",
  "dist",
  "docs",
  "manifests",
  "node_modules",
  "scripts",
  "src",
  "tests"
]);
const forbiddenPackageBasenames = new Set([
  ".env",
  ".gitignore",
  ".npmrc",
  "AGENTS.md",
  "package-lock.json",
  "package.json",
  "README.md"
]);
const forbiddenPackageExtensions = new Set([
  ".crx",
  ".pem",
  ".pfx",
  ".p12",
  ".log",
  ".xpi",
  ".zip"
]);

function walkFiles(rootDir) {
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function dirSizeBytes(rootDir) {
  return walkFiles(rootDir).reduce((total, file) => total + fs.statSync(file).size, 0);
}

function getServiceWorkerImportScripts() {
  const source = fs.readFileSync(path.join(repoRoot, "src/background/service_worker.js"), "utf8");
  const match = source.match(/importScripts\(([\s\S]*?)\);/);
  assert.ok(match, "background service worker should declare importScripts()");
  return [...match[1].matchAll(/"([^"]+)"/g)].map(([, script]) =>
    path.posix.normalize(path.posix.join("background", script))
  );
}

function assertReleaseArtifactsAreSanitized(results) {
  const sourceContent = fs.readFileSync(path.join(repoRoot, "src/content/content.js"), "utf8");
  const debugLoggerSource = fs.readFileSync(
    path.join(repoRoot, "src/content/diagnostics/debugLogger.js"),
    "utf8"
  );
  assert.ok(
    sourceContent.includes("debugReveal") && debugLoggerSource.includes("pwm:debug"),
    "developer source diagnostics should remain available outside release builds"
  );

  for (const result of results) {
    const files = walkFiles(result.targetRoot);
    const mapFiles = files.filter(
      (file) => file.endsWith(".map") || path.basename(file).toLowerCase().includes(".map.")
    );
    assert.deepStrictEqual(mapFiles, [], `${result.target} release should not ship sourcemaps`);

    for (const file of files.filter((entry) => /\.(?:js|json|html|css)$/i.test(entry))) {
      const relativePath = path.relative(result.targetRoot, file).split(path.sep).join("/");
      const source = fs.readFileSync(file, "utf8");
      assert.strictEqual(
        source.includes("sourceMappingURL"),
        false,
        `${result.target}:${relativePath} should not contain sourceMappingURL`
      );
    }

    for (const relativeContentScript of [
      "content/content.js",
      "content/file_handoff_state.js",
      "content/file_handoff_pending.js",
      "content/file_handoff_flow.js"
    ]) {
      const contentSource = fs.readFileSync(path.join(result.targetRoot, relativeContentScript), "utf8");
      for (const banned of [
        "pwm:debug",
        "debugReveal",
        "debugLogSnapshot",
        "console.group(",
        "console.groupCollapsed(",
        "console.groupEnd(",
        "console.log("
      ]) {
        assert.strictEqual(
          contentSource.includes(banned),
          false,
          `${result.target} release ${relativeContentScript} should not contain ${banned}`
        );
      }
    }

    const debugLoggerSource = fs.readFileSync(
      path.join(result.targetRoot, "content/diagnostics/debugLogger.js"),
      "utf8"
    );
    for (const banned of [
      "pwm:debug",
      "console.groupCollapsed",
      "console.groupEnd",
      "console.log",
      "localStorage",
      "sessionStorage"
    ]) {
      assert.strictEqual(
        debugLoggerSource.includes(banned),
        false,
        `${result.target} release debug logger should not contain ${banned}`
      );
    }
  }
}

function relativePackagePath(targetRoot, file) {
  return path.relative(targetRoot, file).split(path.sep).join("/");
}

function assertNoInlineJavaScript(target, targetRoot, file) {
  if (!file.endsWith(".html")) return;

  const relativePath = relativePackagePath(targetRoot, file);
  const source = fs.readFileSync(file, "utf8");
  assert.strictEqual(
    /<script\b(?![^>]*\bsrc=)[^>]*>/i.test(source),
    false,
    `${target}:${relativePath} must not contain inline script tags`
  );
  assert.strictEqual(
    /\son[a-z]+\s*=/i.test(source),
    false,
    `${target}:${relativePath} must not contain inline event handlers`
  );
}

function assertPackageContentsAreRuntimeOnly(result) {
  const files = walkFiles(result.targetRoot);
  const requiredFiles = [
    "manifest.json",
    "compat/browser_api.js",
    "content/content.js",
    "content/overlay.css",
    "popup/popup.html",
    "options/options.html",
    "scanner/scanner.html",
    "scanner/scanner.js",
    "shared/fileLimits.js",
    "shared/fileTypeRegistry.js",
    "shared/fileExtractors.js",
    "shared/fileScanner.js",
    "shared/imageRedactor.js",
    "vendor/onnxruntime/ort.wasm.min.js",
    "ai/models/leakguard_secret_classifier.features.json",
    "ai/models/leakguard_secret_classifier.onnx"
  ];

  requiredFiles.forEach((relativePath) => {
    assert.ok(
      fs.existsSync(path.join(result.targetRoot, relativePath)),
      `${result.target} package should include ${relativePath}`
    );
  });
  const extractorBytes = fs.statSync(path.join(result.targetRoot, "shared/fileExtractors.js")).size;
  assert.ok(
    extractorBytes < 36000,
    `${result.target} document extractor support should stay below the lightweight bundle budget`
  );

  for (const file of files) {
    const relativePath = relativePackagePath(result.targetRoot, file);
    const parts = relativePath.split("/");
    const basename = path.basename(relativePath);
    const extension = path.extname(relativePath).toLowerCase();

    for (const part of parts) {
      assert.strictEqual(
        forbiddenPackageDirectories.has(part),
        false,
        `${result.target} package should not include source-only directory ${relativePath}`
      );
    }

    assert.strictEqual(
      forbiddenPackageBasenames.has(basename),
      false,
      `${result.target} package should not include source-only file ${relativePath}`
    );
    assert.strictEqual(
      forbiddenPackageExtensions.has(extension),
      false,
      `${result.target} package should not include forbidden artifact ${relativePath}`
    );

    assertNoInlineJavaScript(result.target, result.targetRoot, file);
  }
}

function assertOcrRuntimeAssets(result) {
  const files = walkFiles(result.targetRoot);
  const ocrFiles = files
    .map((file) => relativePackagePath(result.targetRoot, file).split("\\").join("/"))
    .filter((relativePath) => relativePath.startsWith("shared/ocr/"))
    .sort();

  assert.deepStrictEqual(
    ocrFiles,
    [
      "shared/ocr/ocrRuntime.js",
      "shared/ocr/ocrWasmProbe.wasm",
      "shared/ocr/ocrWorker.js",
      ...tesseractCoreProofFiles,
      ...englishLanguageProofFiles,
      ...syntheticRecognitionProofFiles
    ].sort(),
    `${result.target} should include only local OCR proof shell/assets, English traineddata, and the synthetic recognition fixture`
  );
  const wasmProbePath = path.join(result.targetRoot, "shared/ocr/ocrWasmProbe.wasm");
  assert.ok(fs.statSync(wasmProbePath).size <= 64, `${result.target} WASM probe asset should stay tiny`);
  assert.ok(
    fs.statSync(path.join(result.targetRoot, "shared/ocr/tesseract-core/tesseract-core.js")).size < 160000,
    `${result.target} tesseract.js-core loader proof should include the small external-WASM loader only`
  );
  assert.ok(
    fs.statSync(path.join(result.targetRoot, "shared/ocr/tesseract-core/tesseract-core.wasm")).size < 4 * 1024 * 1024,
    `${result.target} tesseract.js-core proof should include one local core WASM asset only`
  );
  assert.ok(
    fs.statSync(path.join(result.targetRoot, "shared/ocr/tessdata/eng.traineddata.gz")).size < 3 * 1024 * 1024,
    `${result.target} English language proof should include the smallest packaged compressed traineddata asset`
  );
  assert.ok(
    fs.statSync(path.join(result.targetRoot, "shared/ocr/fixtures/synthetic-test-ocr.png")).size < 5000,
    `${result.target} synthetic OCR fixture should stay tiny`
  );

  const ocrBytes = ocrFiles.reduce(
    (total, relativePath) => total + fs.statSync(path.join(result.targetRoot, relativePath)).size,
    0
  );
  assert.ok(
    ocrBytes < 7 * 1024 * 1024,
    `${result.target} OCR proof assets should stay below the English loading-only budget`
  );

  for (const file of files) {
    const relativePath = relativePackagePath(result.targetRoot, file).toLowerCase();
    const isAllowedTesseractCoreProof = tesseractCoreProofFiles.includes(
      relativePackagePath(result.targetRoot, file).split("\\").join("/")
    );
    const isAllowedEnglishLanguageProof = englishLanguageProofFiles.includes(
      relativePackagePath(result.targetRoot, file).split("\\").join("/")
    );
    const isAllowedSyntheticRecognitionProof = syntheticRecognitionProofFiles.includes(
      relativePackagePath(result.targetRoot, file).split("\\").join("/")
    );
    if (!isAllowedTesseractCoreProof && !isAllowedEnglishLanguageProof && !isAllowedSyntheticRecognitionProof) {
      assert.strictEqual(
        /tesseract|ocrad|traineddata|ocr[-_.](?!wasmprobe\.wasm).*\.wasm|\.traineddata|ocr-model|ocr-assets/.test(
          relativePath
        ),
        false,
        `${result.target} should not contain OCR engine/model asset ${relativePath}`
      );
    }
    assert.strictEqual(
      /shared\/ocr\/tessdata\/(?!eng\.traineddata\.gz$).*traineddata/i.test(relativePath),
      false,
      `${result.target} should not package non-English traineddata assets`
    );
    if (/\.(?:js|json|html|css|txt|md)$/i.test(file)) {
      const source = fs.readFileSync(file, "utf8").toLowerCase();
      for (const forbidden of ["ocrad", "traineddata", "cdn.jsdelivr", "unpkg.com"]) {
        const allowedEnglishTrainedDataReference =
          forbidden === "traineddata" &&
          (relativePath.startsWith("shared/ocr/") || relativePath === "manifest.json") &&
          source.includes("eng.traineddata.gz") &&
          !/tessdata\/(?!eng\.traineddata\.gz)/i.test(source);
        if (!allowedEnglishTrainedDataReference) {
          assert.strictEqual(
            source.includes(forbidden),
            false,
            `${result.target}:${relativePath} should not contain OCR dependency or remote asset string ${forbidden}`
          );
        }
      }
      assert.strictEqual(
        /https?:\/\//i.test(source) && relativePath.startsWith("shared/ocr/"),
        false,
        `${result.target}:${relativePath} should not contain remote URL strings`
      );
      assert.strictEqual(
        /\beval\s*\(|\bnew\s+Function\b|\bFunction\s*\(/.test(source) && relativePath.startsWith("shared/ocr/"),
        false,
        `${result.target}:${relativePath} should not use eval or Function`
      );
    }
  }
}

function plainObject(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseCspDirectives(csp) {
  const directives = {};
  for (const directive of String(csp || "").split(";")) {
    const parts = directive.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) continue;
    directives[parts[0]] = parts.slice(1);
  }
  return directives;
}

async function assertOcrRuntimeProbeShell(targetRoot) {
  const runtimeSource = fs.readFileSync(path.join(targetRoot, "shared/ocr/ocrRuntime.js"), "utf8");
  const createdWorkers = [];
  class ProbeWorker {
    constructor(url) {
      this.url = String(url);
      this.messages = [];
      this.terminated = false;
      createdWorkers.push(this);
    }

    postMessage(message) {
      this.messages.push(message);
      if (message?.type === "wasm_probe") {
        this.onmessage?.({
          data: {
            ok: true,
            status: "wasm_ready",
            wasmLoaded: true
          }
        });
        return;
      }
      if (message?.type === "ocr_engine_probe") {
        this.onmessage?.({
          data: {
            ok: false,
            status: "engine_blocked",
            ocrImplemented: false,
            engine: null,
            reason: "no_candidate_passed_security_size_csp_gates"
          }
        });
        return;
      }
      if (message?.type === "tesseract_core_probe") {
        this.onmessage?.({
          data: {
            ok: true,
            status: "tesseract_core_ready",
            ocrImplemented: false
          }
        });
        return;
      }
      if (message?.type === "ocr_language_probe") {
        this.onmessage?.({
          data: {
            ok: true,
            status: "language_ready",
            language: "eng",
            ocrImplemented: false
          }
        });
        return;
      }
      if (message?.type === "ocr_recognition_probe") {
        this.onmessage?.({
          data: {
            ok: true,
            status: "ocr_recognition_ready",
            ocrImplemented: true,
            language: "eng",
            textLength: 8,
            containsExpectedText: true,
            confidenceBucket: "high"
          }
        });
        return;
      }
      if (message?.type === "ocr_recognize_image") {
        this.onmessage?.({
          data: {
            ok: true,
            status: "ocr_recognition_ready",
            language: "eng",
            text: "API_KEY=sk-proj-LeakGuardScannerOcrApiKey1234567890abcdef",
            textLength: 61,
            confidenceBucket: "high",
            warnings: []
          }
        });
        return;
      }
      this.onmessage?.({
        data: {
          ok: true,
          status: "worker_ready",
          ocrImplemented: false
        }
      });
    }

    terminate() {
      this.terminated = true;
    }
  }

  const sandbox = {
    globalThis: {
      PWM: {},
      PWM_BUILD_INFO: {
        features: {
          ocr: {
            enabled: true,
            status: "scanner_page_v1",
            scope: "scanner_image_english_only"
          }
        }
      },
      chrome: {
        runtime: {
          getURL: (resourcePath) => `chrome-extension://test-id/${resourcePath}`
        }
      },
      setTimeout,
      clearTimeout,
      Worker: ProbeWorker
    }
  };
  sandbox.globalThis.globalThis = sandbox.globalThis;
  sandbox.globalThis.self = sandbox.globalThis;
  sandbox.globalThis.window = sandbox.globalThis;

  vm.runInNewContext(runtimeSource, sandbox, {
    filename: "ocrRuntime.js"
  });

  const runtime = sandbox.globalThis.PWM.OcrRuntime;
  assert.strictEqual(runtime.isAvailable(), true, "OCR runtime shell should be available in normal builds");
  assert.deepStrictEqual(
    plainObject(runtime.getStatus()),
    {
      available: true,
      status: "scanner_page_v1",
      ocrImplemented: true,
      workerStatus: "idle"
    },
    "OCR runtime shell should report scanner-page v1 idle status before probing"
  );
  assert.strictEqual(createdWorkers.length, 0, "OCR runtime should not create a worker before an explicit probe");

  const probe = plainObject(await runtime.createWorkerProbe());
  assert.deepStrictEqual(
    probe,
    {
      ok: true,
      status: "worker_ready",
      ocrImplemented: false
    },
    "OCR runtime shell should round-trip the worker probe payload"
  );
  assert.strictEqual(
    createdWorkers[0].url,
    "chrome-extension://test-id/shared/ocr/ocrWorker.js",
    "OCR runtime shell should load the packaged worker URL"
  );
  assert.deepStrictEqual(
    plainObject(createdWorkers[0].messages),
    [{ type: "ocr_probe" }],
    "OCR runtime shell should only send the harmless probe message"
  );

  const wasmProbe = plainObject(await runtime.createWasmProbe());
  assert.deepStrictEqual(
    wasmProbe,
    {
      ok: true,
      status: "wasm_ready",
      wasmLoaded: true
    },
    "OCR WASM proof should report local packaged WASM readiness without enabling OCR"
  );
  assert.deepStrictEqual(
    plainObject(createdWorkers[0].messages),
    [{ type: "ocr_probe" }, { type: "wasm_probe" }],
    "OCR WASM proof should send only the explicit data-free WASM probe message"
  );

  const engineProbe = plainObject(await runtime.createEngineProbe());
  assert.deepStrictEqual(
    engineProbe,
    {
      ok: false,
      status: "engine_blocked",
      ocrImplemented: false,
      engine: null,
      reason: "no_candidate_passed_security_size_csp_gates"
    },
    "OCR engine proof should report blocked when no candidate passes local/CSP/size gates"
  );
  assert.deepStrictEqual(
    plainObject(createdWorkers[0].messages),
    [{ type: "ocr_probe" }, { type: "wasm_probe" }, { type: "ocr_engine_probe" }],
    "OCR engine proof should only send the explicit engine probe message after the worker probe"
  );

  const tesseractCoreProbe = plainObject(await runtime.createTesseractCoreProbe());
  assert.deepStrictEqual(
    tesseractCoreProbe,
    {
      ok: true,
      status: "tesseract_core_ready",
      ocrImplemented: false
    },
    "tesseract.js-core proof should round-trip only the explicit core probe payload"
  );
  assert.deepStrictEqual(
    plainObject(createdWorkers[0].messages),
    [{ type: "ocr_probe" }, { type: "wasm_probe" }, { type: "ocr_engine_probe" }, { type: "tesseract_core_probe" }],
    "tesseract.js-core proof should remain explicit-only and separate from engine probing"
  );

  const languageProbe = plainObject(await runtime.createLanguageProbe("eng"));
  assert.deepStrictEqual(
    languageProbe,
    {
      ok: true,
      status: "language_ready",
      language: "eng",
      ocrImplemented: false
    },
    "English language proof should round-trip only the explicit language probe payload"
  );
  assert.deepStrictEqual(
    plainObject(createdWorkers[0].messages),
    [
      { type: "ocr_probe" },
      { type: "wasm_probe" },
      { type: "ocr_engine_probe" },
      { type: "tesseract_core_probe" },
      { type: "ocr_language_probe", language: "eng" }
    ],
    "English language proof should remain explicit-only and separate from engine probing"
  );

  const recognitionProbe = plainObject(await runtime.createRecognitionProbe());
  assert.deepStrictEqual(
    recognitionProbe,
    {
      ok: true,
      status: "ocr_recognition_ready",
      ocrImplemented: true,
      language: "eng",
      textLength: 8,
      containsExpectedText: true,
      confidenceBucket: "high"
    },
    "Synthetic OCR recognition proof should return metadata only"
  );
  assert.deepStrictEqual(
    plainObject(createdWorkers[0].messages),
    [
      { type: "ocr_probe" },
      { type: "wasm_probe" },
      { type: "ocr_engine_probe" },
      { type: "tesseract_core_probe" },
      { type: "ocr_language_probe", language: "eng" },
      { type: "ocr_recognition_probe" }
    ],
    "Synthetic OCR recognition proof should remain explicit-only and separate from engine probing"
  );

  const imageBytes = new Uint8Array([137, 80, 78, 71]);
  const imageRecognition = plainObject(await runtime.recognizeImageBytes({
    type: "ocr_recognize_image",
    language: "eng",
    imageBytes,
    mimeType: "image/png"
  }));
  assert.deepStrictEqual(
    imageRecognition,
    {
      ok: true,
      status: "ocr_recognition_ready",
      language: "eng",
      text: "API_KEY=sk-proj-LeakGuardScannerOcrApiKey1234567890abcdef",
      textLength: 61,
      confidenceBucket: "high",
      warnings: []
    },
    "Scanner OCR runtime should return raw OCR text only for the explicit image-recognition message"
  );
  const lastImageMessage = createdWorkers[0].messages.at(-1);
  assert.strictEqual(lastImageMessage.type, "ocr_recognize_image");
  assert.strictEqual(lastImageMessage.language, "eng");
  assert.strictEqual(lastImageMessage.mimeType, "image/png");
  assert.deepStrictEqual(
    Array.from(lastImageMessage.imageBytes),
    Array.from(imageBytes),
    "Scanner OCR runtime should send only the explicit scanner image-recognition payload"
  );

  runtime.terminate();
  assert.strictEqual(createdWorkers[0].terminated, true, "OCR runtime shell should terminate its worker");
}

async function assertOcrWorkerEngineProof(targetRoot) {
  const workerSource = fs.readFileSync(path.join(targetRoot, "shared/ocr/ocrWorker.js"), "utf8");
  const tesseractCoreSource = fs.readFileSync(
    path.join(targetRoot, "shared/ocr/tesseract-core/tesseract-core.js"),
    "utf8"
  );
  const postedMessages = [];
  const fetchedUrls = [];
  const wasmProbeBytes = fs.readFileSync(path.join(targetRoot, "shared/ocr/ocrWasmProbe.wasm"));
  const tesseractCoreBytes = fs.readFileSync(
    path.join(targetRoot, "shared/ocr/tesseract-core/tesseract-core.wasm")
  );
  const englishTrainedDataBytes = fs.readFileSync(
    path.join(targetRoot, "shared/ocr/tessdata/eng.traineddata.gz")
  );
  const syntheticFixtureBytes = fs.readFileSync(
    path.join(targetRoot, "shared/ocr/fixtures/synthetic-test-ocr.png")
  );
  const syntheticFixtureRaw = require("sharp")(syntheticFixtureBytes).grayscale().raw().toBuffer({
    resolveWithObject: true
  });
  const wasmApi = {
    instantiate: WebAssembly.instantiate,
    instantiateStreaming: WebAssembly.instantiateStreaming,
    async compile(bytes) {
      assert.ok(ArrayBuffer.isView(bytes), "WASM proof should compile byte content only");
      assert.deepStrictEqual(
        Array.from(bytes),
        Array.from(wasmProbeBytes),
        "WASM proof should compile the packaged proof asset bytes"
      );
      return {};
    }
  };
  const fetchApi = async (url) => {
    fetchedUrls.push(String(url));
    const bytes = String(url).endsWith("/shared/ocr/tesseract-core/tesseract-core.wasm")
      ? tesseractCoreBytes
      : String(url).endsWith("/shared/ocr/tessdata/eng.traineddata.gz")
        ? englishTrainedDataBytes
        : String(url).endsWith("/shared/ocr/fixtures/synthetic-test-ocr.png")
          ? syntheticFixtureBytes
      : wasmProbeBytes;
    return {
      ok: true,
      status: 200,
      async arrayBuffer() {
        return bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength
        );
      }
    };
  };
  const sandbox = vm.createContext({
    console: {
      log() {},
      warn() {},
      error() {}
    },
    WebAssembly: wasmApi,
    fetch: fetchApi,
    importScripts(url) {
      assert.strictEqual(
        String(url),
        "chrome-extension://test-id/shared/ocr/tesseract-core/tesseract-core.js",
        "tesseract.js-core proof should import only the packaged core loader script"
      );
      vm.runInContext(tesseractCoreSource, sandbox, {
        filename: "tesseract-core.js"
      });
      sandbox.self.TesseractCore = sandbox.TesseractCore;
    },
    self: {
      WebAssembly: wasmApi,
      fetch: fetchApi,
      importScripts(url) {
        sandbox.importScripts(url);
      },
      location: {
        href: "chrome-extension://test-id/shared/ocr/ocrWorker.js"
      },
      chrome: {
        runtime: {
          getURL: (resourcePath) => `chrome-extension://test-id/${resourcePath}`
        }
      },
      postMessage(message) {
        postedMessages.push(message);
      }
    },
    setTimeout,
    clearTimeout,
    Promise,
    URL,
    Uint8Array,
    Int8Array,
    ArrayBuffer,
    TextDecoder,
    TextEncoder,
    Blob,
    Response,
    DecompressionStream,
    async createImageBitmap() {
      const raw = await syntheticFixtureRaw;
      return {
        width: raw.info.width,
        height: raw.info.height,
        close() {}
      };
    },
    OffscreenCanvas: class {
      constructor(width, height) {
        this.width = width;
        this.height = height;
      }

      getContext() {
        return {
          drawImage() {},
          getImageData: () => {
            const raw = syntheticFixtureRawResult;
            const rgba = new Uint8ClampedArray(raw.info.width * raw.info.height * 4);
            for (let index = 0; index < raw.data.length; index += 1) {
              const outputIndex = index * 4;
              const value = raw.data[index];
              rgba[outputIndex] = value;
              rgba[outputIndex + 1] = value;
              rgba[outputIndex + 2] = value;
              rgba[outputIndex + 3] = 255;
            }
            return { data: rgba };
          }
        };
      }
    }
  });
  const syntheticFixtureRawResult = await syntheticFixtureRaw;
  sandbox.globalThis = sandbox.self;

  vm.runInContext(workerSource, sandbox, {
    filename: "ocrWorker.js"
  });

  await sandbox.self.onmessage({ data: { type: "ocr_probe" } });
  await sandbox.self.onmessage({
    data: {
      type: "wasm_probe",
      imageData: "must-not-be-read",
      pixels: [1, 2, 3],
      userText: "must-not-be-read"
    }
  });
  await sandbox.self.onmessage({ data: { type: "ocr_engine_probe", imageData: "must-not-be-read" } });
  await sandbox.self.onmessage({
    data: {
      type: "tesseract_core_probe",
      imageData: "must-not-be-read",
      pixels: [1, 2, 3],
      userText: "must-not-be-read"
    }
  });
  await sandbox.self.onmessage({
    data: {
      type: "ocr_language_probe",
      language: "eng",
      imageData: "must-not-be-read",
      pixels: [1, 2, 3],
      userText: "must-not-be-read"
    }
  });
  await sandbox.self.onmessage({
    data: {
      type: "ocr_recognition_probe",
      imageData: "must-not-be-read",
      pixels: [1, 2, 3],
      userText: "must-not-be-read"
    }
  });
  await sandbox.self.onmessage({
    data: {
      type: "ocr_recognize_image",
      language: "eng",
      imageBytes: syntheticFixtureBytes,
      mimeType: "image/png",
      userText: "must-not-be-read"
    }
  });
  await sandbox.self.onmessage({
    data: {
      type: "ocr_language_probe",
      language: "deu"
    }
  });
  assert.deepStrictEqual(
    fetchedUrls,
    [
      "chrome-extension://test-id/shared/ocr/ocrWasmProbe.wasm",
      "chrome-extension://test-id/shared/ocr/tesseract-core/tesseract-core.wasm",
      "chrome-extension://test-id/shared/ocr/tessdata/eng.traineddata.gz",
      "chrome-extension://test-id/shared/ocr/fixtures/synthetic-test-ocr.png"
    ],
    "OCR recognition proof should fetch only packaged extension-local WASM, English traineddata, and synthetic fixture assets"
  );
  assert.ok(
    fetchedUrls.every((url) => !/^https?:\/\//i.test(url) && !/cdn|unpkg/i.test(url)),
    "OCR WASM proof must not use remote URLs"
  );
  assert.deepStrictEqual(
    plainObject(postedMessages),
    [
      {
        ok: true,
        status: "worker_ready",
        ocrImplemented: false
      },
      {
        ok: true,
        status: "wasm_ready",
        wasmLoaded: true
      },
      {
        ok: false,
        status: "engine_blocked",
        ocrImplemented: false,
        engine: null,
        reason: "no_candidate_passed_security_size_csp_gates"
      },
      {
        ok: true,
        status: "tesseract_core_ready",
        ocrImplemented: false
      },
      {
        ok: true,
        status: "language_ready",
        language: "eng",
        ocrImplemented: false
      },
      {
        ok: true,
        status: "ocr_recognition_ready",
        ocrImplemented: true,
        language: "eng",
        textLength: 8,
        containsExpectedText: true,
        confidenceBucket: "high"
      },
      {
        ok: true,
        status: "ocr_recognition_ready",
        language: "eng",
        text: "TEST OCR",
        textLength: 8,
        confidenceBucket: "high",
        layout: {
          source: "word",
          boxKind: "word",
          fallbackUsed: false,
          visualRedactionSafe: true,
          protectedSiteEligible: true,
          boxes: [
            {
              boxKind: "word",
              kind: "word",
              start: 0,
              end: 4,
              x: 13,
              y: 28,
              width: 106,
              height: 32,
              confidenceBucket: "high",
              fallbackUsed: false,
              visualRedactionSafe: true,
              protectedSiteEligible: true
            },
            {
              boxKind: "word",
              kind: "word",
              start: 5,
              end: 8,
              x: 133,
              y: 28,
              width: 91,
              height: 32,
              confidenceBucket: "high",
              fallbackUsed: false,
              visualRedactionSafe: true,
              protectedSiteEligible: true
            }
          ]
        },
        warnings: []
      },
      {
        ok: false,
        status: "language_blocked",
        language: "deu",
        reason: "unsupported_language"
      }
    ],
    "OCR worker should keep probes metadata-only, prove WASM/core/English language/fixture recognition, and report engine_blocked"
  );
  assert.strictEqual(
    postedMessages
      .filter((message) => message.status !== "ocr_recognition_ready" || message.containsExpectedText === true)
      .some((message) => Object.prototype.hasOwnProperty.call(message, "text")),
    false,
    "OCR probe messages must not post raw OCR text"
  );
}

async function assertOcrWorkerWasmProofUsesSiblingFallback(targetRoot) {
  const workerSource = fs.readFileSync(path.join(targetRoot, "shared/ocr/ocrWorker.js"), "utf8");
  const postedMessages = [];
  const fetchedUrls = [];
  const wasmProbeBytes = fs.readFileSync(path.join(targetRoot, "shared/ocr/ocrWasmProbe.wasm"));
  const sandbox = {
    URL,
    self: {
      WebAssembly: {
        async compile() {
          return {};
        }
      },
      fetch: async (url) => {
        fetchedUrls.push(String(url));
        return {
          ok: true,
          status: 200,
          async arrayBuffer() {
            return wasmProbeBytes.buffer.slice(
              wasmProbeBytes.byteOffset,
              wasmProbeBytes.byteOffset + wasmProbeBytes.byteLength
            );
          }
        };
      },
      location: {
        href: "chrome-extension://test-id/shared/ocr/ocrWorker.js"
      },
      postMessage(message) {
        postedMessages.push(message);
      }
    }
  };
  sandbox.globalThis = sandbox.self;

  vm.runInNewContext(workerSource, sandbox, {
    filename: "ocrWorker.js"
  });

  await sandbox.self.onmessage({ data: { type: "wasm_probe" } });
  assert.deepStrictEqual(
    fetchedUrls,
    ["chrome-extension://test-id/shared/ocr/ocrWasmProbe.wasm"],
    "OCR WASM proof should resolve a packaged sibling asset when runtime APIs are unavailable in the worker"
  );
  assert.deepStrictEqual(plainObject(postedMessages), [
    {
      ok: true,
      status: "wasm_ready",
      wasmLoaded: true
    }
  ]);
}

function assertOcrWorkerStaticSafety(targetRoot) {
  const workerSource = fs.readFileSync(path.join(targetRoot, "shared/ocr/ocrWorker.js"), "utf8");
  assert.deepStrictEqual(
    [/https?:\/\//i, /cdn/i, /unpkg/i, /\beval\s*\(/i, /\bFunction\s*\(/].map((pattern) => pattern.test(workerSource)),
    [false, false, false, false, false],
    "OCR worker proof should avoid remote URLs, eval, and Function"
  );
  assert.strictEqual(
    /event\.data\.(?:imageData|pixels|userText|bitmap|canvas)/i.test(workerSource),
    false,
    "OCR worker should ignore probe-only user data fields"
  );
  assert.ok(
    workerSource.includes("fixtures/synthetic-test-ocr.png"),
    "OCR recognition proof worker should keep using the packaged synthetic fixture"
  );
  assert.strictEqual(
    /ocr_recognition_probe[\s\S]*?postMessage\s*\([^)]*\btext\b/i.test(workerSource),
    false,
    "OCR recognition probe path should not post raw OCR text"
  );

  for (const relativePath of [...tesseractCoreProofFiles, ...englishLanguageProofFiles]) {
    const sourcePath = path.join(targetRoot, relativePath);
    const source = relativePath.endsWith(".gz") ? "" : fs.readFileSync(sourcePath, "utf8");
    if (source) {
      assert.strictEqual(
        /https?:\/\/|cdn\.jsdelivr|unpkg/i.test(source),
        false,
        `${relativePath} should not contain remote URL or CDN strings`
      );
    }
    if (relativePath.endsWith(".js")) {
      assert.strictEqual(
        /\beval\s*\(|\bnew\s+Function\b|\bFunction\s*\(/.test(source),
        false,
        `${relativePath} should not use eval or Function`
      );
    }
  }
}

function assertManifestStructure(result, expectedHostPermissions) {
  const manifest = result.manifest;
  const contentScript = manifest.content_scripts?.[0] || {};

  assert.strictEqual(manifest.manifest_version, 3, `${result.target} should remain MV3`);
  assert.deepStrictEqual(
    manifest.content_security_policy,
    {
      extension_pages: restrictiveExtensionPageCsp,
      sandbox: restrictiveSandboxCsp
    },
    `${result.target} should keep the restrictive extension-page CSP with local WASM compilation only`
  );
  assert.deepStrictEqual(
    manifest.sandbox,
    { pages: ["content/protected_site_ocr_broker.html"] },
    `${result.target} should sandbox only the protected-site OCR broker page`
  );
  const cspDirectives = parseCspDirectives(manifest.content_security_policy?.extension_pages);
  assert.deepStrictEqual(
    cspDirectives["script-src"],
    ["'self'", "'wasm-unsafe-eval'"],
    `${result.target} script-src should allow only packaged scripts and local WASM compilation`
  );
  assert.strictEqual(
    cspDirectives["script-src"].includes("'unsafe-eval'"),
    false,
    `${result.target} script-src must not allow unsafe-eval`
  );
  assert.strictEqual(
    cspDirectives["script-src"].some((source) => /^(?:https?:|wss?:|data:|blob:)|cdn|unpkg/i.test(source)),
    false,
    `${result.target} script-src must not allow remote, CDN, data, or blob sources`
  );
  assert.deepStrictEqual(cspDirectives["object-src"], ["'none'"], `${result.target} object-src should stay none`);
  assert.deepStrictEqual(cspDirectives["base-uri"], ["'none'"], `${result.target} base-uri should stay none`);
  assert.deepStrictEqual(
    cspDirectives["frame-ancestors"],
    ["'none'"],
    `${result.target} frame-ancestors should stay none`
  );
  assert.deepStrictEqual(
    [...(manifest.host_permissions || [])].sort(),
    expectedHostPermissions,
    `${result.target} host permissions should stay limited to built-in protected sites`
  );
  assert.deepStrictEqual(
    [...(contentScript.matches || [])].sort(),
    expectedHostPermissions,
    `${result.target} content-script matches should stay aligned with host permissions`
  );
  assert.deepStrictEqual(
    [...(manifest.optional_host_permissions || [])].sort(),
    ["http://*/*", "https://*/*"].sort(),
    `${result.target} optional host permissions should remain user-managed-site scoped`
  );
  assert.strictEqual(
    (contentScript.js || []).some((script) => script.startsWith("scanner/")),
    false,
    `${result.target} should not inject scanner pages into protected sites`
  );
  assert.strictEqual(
    (manifest.web_accessible_resources || []).some((entry) =>
      (entry.resources || []).some((resource) => resource.startsWith("scanner/"))
    ),
    false,
    `${result.target} should not expose scanner pages as web-accessible resources`
  );
  assert.strictEqual(
    (manifest.host_permissions || []).some((pattern) =>
      pattern === "<all_urls>" || pattern === "*://*/*" || pattern.includes("127.0.0.1")
    ),
    false,
    `${result.target} package manifest should not include test-only or all-site host permissions`
  );

  if (result.browser === "chrome") {
    assert.strictEqual(
      manifest.background?.service_worker,
      "background/service_worker.js",
      `${result.target} should use the Chrome MV3 service worker entry`
    );
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(manifest.background || {}, "scripts"),
      false,
      `${result.target} should not use Firefox background scripts`
    );
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(manifest, "browser_specific_settings"),
      false,
      `${result.target} should not include Firefox-only manifest metadata`
    );
  } else {
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(manifest.background || {}, "service_worker"),
      false,
      `${result.target} should not use a Chrome service worker entry`
    );
    assert.deepStrictEqual(
      manifest.background?.scripts || [],
      getServiceWorkerImportScripts(),
      `${result.target} Firefox background scripts should mirror the service worker runtime imports`
    );
    assert.deepStrictEqual(
      manifest.browser_specific_settings?.gecko?.data_collection_permissions,
      { required: ["none"] },
      `${result.target} should disclose no transmitted data collection for Firefox`
    );
  }
}

function assertPackageStructure(results) {
  const expectedHostPermissions = protectedSitesModule.BUILTIN_PROTECTED_SITES
    .map((rule) => rule.matchPattern)
    .sort();

  for (const result of results) {
    assertManifestStructure(result, expectedHostPermissions);
    assertPackageContentsAreRuntimeOnly(result);
    assertOcrRuntimeAssets(result);
  }
}

async function run() {
  const { BUILD_TARGETS, OCR_SIZE_BUDGETS, buildTarget } = await import(
    pathToFileURL(path.join(repoRoot, "scripts/build-extension.mjs")).href
  );
  assert.deepStrictEqual(
    BUILD_TARGETS.map((target) => target.folder).sort(),
    ["chrome", "chrome-enterprise", "firefox", "firefox-enterprise"].sort(),
    "build target matrix should stay single-extension without optional OCR editions"
  );
  assert.deepStrictEqual(
    OCR_SIZE_BUDGETS,
    Object.freeze({
      currentInstalledWarningBytes: 50 * 1024 * 1024,
      hardReviewInstalledBytes: 100 * 1024 * 1024,
      firefoxUploadHardLimitBytes: 200 * 1000 * 1000,
      chromeZipHardLimitBytes: 2 * 1024 * 1024 * 1024
    }),
    "OCR size budget should document internal warning/review gates and external store limits"
  );

  const results = BUILD_TARGETS.map((target) => buildTarget(target.browser, target.mode));
  assertReleaseArtifactsAreSanitized(results);
  assertPackageStructure(results);

  const debugResult = buildTarget("chrome", "debug");
  assert.strictEqual(debugResult.target, "chrome-debug", "debug build should use a separate unpacked folder");
  assert.strictEqual(debugResult.mode, "debug", "debug build should record debug mode");
  const debugContentSource = fs.readFileSync(path.join(debugResult.targetRoot, "content/content.js"), "utf8");
  const debugLoggerSource = fs.readFileSync(
    path.join(debugResult.targetRoot, "content/diagnostics/debugLogger.js"),
    "utf8"
  );
  assert.ok(debugContentSource.includes("debugReveal"), "debug build should preserve content debug calls");
  assert.ok(debugLoggerSource.includes("pwm:debug"), "debug build should preserve local debug storage key");
  assert.ok(
    debugLoggerSource.includes("targetConsole.groupCollapsed"),
    "debug build should preserve safe console debug output"
  );

  results.forEach((result) => {
    const manifestPath = path.join(result.targetRoot, "manifest.json");
    assert.ok(fs.existsSync(manifestPath), `expected manifest to exist for ${result.target}`);
    assert.ok(
      fs.existsSync(path.join(result.targetRoot, "scanner/scanner.html")),
      `expected scanner page to be packaged for ${result.target}`
    );
  });

  const consumerBuildInfo = require(path.join(repoRoot, "dist/chrome/shared/build_info.js"));
  const chromeEnterpriseBuildInfo = require(
    path.join(repoRoot, "dist/chrome-enterprise/shared/build_info.js")
  );
  const firefoxEnterpriseBuildInfo = require(
    path.join(repoRoot, "dist/firefox-enterprise/shared/build_info.js")
  );

  assert.strictEqual(consumerBuildInfo.enterprise, false, "consumer build should stay non-enterprise");
  assert.deepStrictEqual(
    consumerBuildInfo.features?.ocr,
    {
      enabled: true,
      status: "image_ocr_v1",
      scope: "scanner_and_protected_site_image_english_only_default_on_with_setting"
    },
    "default consumer build should expose scanner OCR and default-on protected-site image OCR metadata"
  );
  assert.strictEqual(chromeEnterpriseBuildInfo.enterprise, true, "chrome enterprise build should mark enterprise");
  assert.strictEqual(
    firefoxEnterpriseBuildInfo.enterprise,
    true,
    "firefox enterprise build should mark enterprise"
  );
  for (const target of ["chrome", "chrome-enterprise", "firefox", "firefox-enterprise"]) {
    const buildInfo = require(path.join(repoRoot, `dist/${target}/shared/build_info.js`));
    assert.deepStrictEqual(
      buildInfo.features?.ocr,
      {
        enabled: true,
        status: "image_ocr_v1",
        scope: "scanner_and_protected_site_image_english_only_default_on_with_setting"
      },
      `${target} should report image OCR v1 metadata`
    );
    await assertOcrRuntimeProbeShell(path.join(repoRoot, "dist", target));
    await assertOcrWorkerEngineProof(path.join(repoRoot, "dist", target));
    await assertOcrWorkerWasmProofUsesSiblingFallback(path.join(repoRoot, "dist", target));
    assertOcrWorkerStaticSafety(path.join(repoRoot, "dist", target));
  }

  const chromeEnterpriseManifest = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "dist/chrome-enterprise/manifest.json"), "utf8")
  );
  const chromeManifest = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "dist/chrome/manifest.json"), "utf8")
  );
  const firefoxManifest = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "dist/firefox/manifest.json"), "utf8")
  );
  const firefoxEnterpriseManifest = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "dist/firefox-enterprise/manifest.json"), "utf8")
  );
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  const scannerHtml = fs.readFileSync(path.join(repoRoot, "dist/chrome/scanner/scanner.html"), "utf8");
  assert.ok(
    scannerHtml.includes("Image OCR is English-only") &&
      scannerHtml.includes("scanned locally") &&
      scannerHtml.includes("limited to image files on this scanner page") &&
      scannerHtml.includes("Scanner image visual redaction outputs a flattened PNG") &&
      scannerHtml.includes("JPG, JPEG, and WEBP inputs are not preserved as their original format") &&
      scannerHtml.includes("Protected-site upload OCR is on by default for supported image uploads") &&
      scannerHtml.includes("can be turned off in settings") &&
      scannerHtml.includes("flattened redacted PNG only when OCR box confidence is eligible") &&
      scannerHtml.includes("Text PDF, DOCX, and XLSX scans can also export regenerated .redacted.pdf, .redacted.docx, or .redacted.xlsx files") &&
      scannerHtml.includes("not layout-preserving") &&
      scannerHtml.includes(".redacted.txt remains available as the fallback") &&
      scannerHtml.includes("Protected-site PDF, DOCX, and XLSX output can hand off regenerated redacted files when complete") &&
      scannerHtml.includes("truncated or unsafe regeneration falls back to .redacted.txt or blocks raw upload") &&
      scannerHtml.includes("Scanned PDF OCR") &&
      scannerHtml.includes("original XLSX XML parts are not preserved") &&
      scannerHtml.includes("layout-preserving PDF/DOCX/XLSX redaction") &&
      scannerHtml.includes("image format preservation"),
    "scanner UI should scope OCR to local English image scanning, scanner/protected-site PNG visual redaction, settings-controlled protected-site OCR, and explicitly exclude scanned PDFs, rebuilds, and format preservation"
  );
  for (const [target, manifest] of [
    ["chrome", chromeManifest],
    ["chrome-enterprise", chromeEnterpriseManifest],
    ["firefox", firefoxManifest],
    ["firefox-enterprise", firefoxEnterpriseManifest]
  ]) {
    assert.strictEqual(
      manifest.version,
      packageJson.version,
      `${target} manifest should inherit package release version`
    );
  }
  assert.strictEqual(
    Object.keys(packageJson.scripts || {}).some((scriptName) =>
      ["build:chrome-ocr", "prebuild:chrome-ocr", "build:firefox-ocr", "prebuild:firefox-ocr"].includes(scriptName)
    ) || Object.values(packageJson.scripts || {}).some((script) => String(script).includes("--mode ocr")),
    false,
    "single-extension architecture should not expose optional OCR edition build scripts"
  );
  assert.strictEqual(
    packageJson.scripts?.["build:chrome-debug"],
    "node scripts/build-extension.mjs --browser chrome --mode debug",
    "local Chrome debug build should be available without changing release builds"
  );
  for (const dependencySet of [packageJson.dependencies || {}, packageJson.devDependencies || {}]) {
    for (const forbidden of ["tesseract.js", "tesseract.js-core", "@tesseract.js-data/eng", "ocrad.js"]) {
      assert.strictEqual(
        Object.prototype.hasOwnProperty.call(dependencySet, forbidden),
        false,
        `OCR package ${forbidden} should not be installed; tesseract.js-core proof assets should be isolated vendored files`
      );
    }
  }
  const chromeBytes = dirSizeBytes(path.join(repoRoot, "dist/chrome"));
  const firefoxBytes = dirSizeBytes(path.join(repoRoot, "dist/firefox"));
  const tesseractCoreProofBytes = tesseractCoreProofFiles.reduce(
    (total, relativePath) => total + fs.statSync(path.join(repoRoot, "dist/chrome", relativePath)).size,
    0
  );
  assert.ok(
    tesseractCoreProofBytes < 4 * 1024 * 1024,
    "tesseract.js-core loading proof should add only the minimal local core JS/WASM pair"
  );
  const englishLanguageProofBytes = englishLanguageProofFiles.reduce(
    (total, relativePath) => total + fs.statSync(path.join(repoRoot, "dist/chrome", relativePath)).size,
    0
  );
  assert.ok(
    englishLanguageProofBytes < 3 * 1024 * 1024,
    "English language loading proof should add only the compressed eng.traineddata asset"
  );
  assert.ok(
    chromeBytes < OCR_SIZE_BUDGETS.currentInstalledWarningBytes,
    "Chrome installed package should stay below OCR planning warning threshold with core loading proof assets"
  );
  assert.ok(
    firefoxBytes < OCR_SIZE_BUDGETS.currentInstalledWarningBytes,
    "Firefox installed package should stay below OCR planning warning threshold with core loading proof assets"
  );
  for (const target of ["chrome", "chrome-enterprise", "firefox", "firefox-enterprise"]) {
    const releaseZip = path.join(repoRoot, "artifacts", "release", `leakguard-${target}-v${packageJson.version}.zip`);
    if (fs.existsSync(releaseZip)) {
      assert.ok(
        fs.statSync(releaseZip).size < OCR_SIZE_BUDGETS.currentInstalledWarningBytes,
        `${target} release zip should stay below OCR planning warning threshold before OCR assets exist`
      );
    }
  }
  const contentScripts = chromeManifest.content_scripts[0].js;
  const placeholderFamiliesIndex = contentScripts.indexOf("shared/placeholders/families.js");
  const placeholdersIndex = contentScripts.indexOf("shared/placeholders.js");
  const detectorIndex = contentScripts.indexOf("shared/detector.js");
  const detectionModuleScripts = [
    "shared/detection/constants/enterpriseTokens.js",
    "shared/detection/constants/providerTokens.js",
    "shared/detection/constants/contextRegexes.js",
    "shared/detection/contextWindow.js",
    "shared/detection/cloudScoring.js",
    "shared/detection/enterprise/shared.js",
    "shared/detection/enterprise/uncPaths.js",
    "shared/detection/enterprise/directoryMetadata.js",
    "shared/detection/enterprise/internalNetwork.js",
    "shared/detection/enterprise/fileShares.js",
    "shared/detection/enterprise/adGroups.js",
    "shared/detection/enterprise/hostnames.js",
    "shared/detection/enterprise/identity.js",
    "shared/detection/enterprise/storageAccounts.js",
    "shared/detection/enterprise/azureResourceGroups.js",
    "shared/detection/enterprise/cloudResourceNames.js",
    "shared/detection/enterprise/index.js",
    "shared/detection/providers/azure.js",
    "shared/detection/providers/azureIds.js",
    "shared/detection/providers/aws.js",
    "shared/detection/providers/gcp.js",
    "shared/detection/providers/otcOpenStack.js",
    "shared/detection/providers/kubernetes.js",
    "shared/detection/providers/genericEndpoints.js",
    "shared/detection/providers/index.js",
    "shared/detection/urlUserinfo.js"
  ];
  const detectionModuleIndexes = detectionModuleScripts.map((script) => contentScripts.indexOf(script));
  const knownSecretReuseIndex = contentScripts.indexOf("shared/knownSecretReuse.js");
  const transformOutboundPromptIndex = contentScripts.indexOf("shared/transformOutboundPrompt.js");
  const redactorIndex = contentScripts.indexOf("shared/redactor.js");
  const fileLimitsIndex = contentScripts.indexOf("shared/fileLimits.js");
  const fileTypeRegistryIndex = contentScripts.indexOf("shared/fileTypeRegistry.js");
  const fileExtractorsIndex = contentScripts.indexOf("shared/fileExtractors.js");
  const fileScannerIndex = contentScripts.indexOf("shared/fileScanner.js");
  const docxRedactorIndex = contentScripts.indexOf("shared/docxRedactor.js");
  const xlsxRedactorIndex = contentScripts.indexOf("shared/xlsxRedactor.js");
  const ocrRuntimeIndex = contentScripts.indexOf("shared/ocr/ocrRuntime.js");
  const scannerOcrIndex = contentScripts.indexOf("shared/scannerOcr.js");
  const imageRedactorIndex = contentScripts.indexOf("shared/imageRedactor.js");
  const streamingRedactorIndex = contentScripts.indexOf("shared/streamingFileRedactor.js");
  const filePasteHelperIndex = contentScripts.indexOf("content/file_paste_helpers.js");
  const fileHandoffStateIndex = contentScripts.indexOf("content/file_handoff_state.js");
  const fileHandoffPendingIndex = contentScripts.indexOf("content/file_handoff_pending.js");
  const fileHandoffFlowIndex = contentScripts.indexOf("content/file_handoff_flow.js");
  const rewriteVerificationTextIndex = contentScripts.indexOf("content/input/rewriteVerificationText.js");
  const fileTransferPolicyIndex = contentScripts.indexOf("content/files/fileTransferPolicy.js");
  const fileExtractionSessionCacheIndex = contentScripts.indexOf("content/files/fileExtractionSessionCache.js");
  const protectedSiteOcrBrokerIndex = contentScripts.indexOf("content/files/protectedSiteOcrBroker.js");
  const contentFileExtractionPipelineIndex = contentScripts.indexOf("content/files/contentFileExtractionPipeline.js");
  const hostMatchingIndex = contentScripts.indexOf("content/adapters/hostMatching.js");
  const adapterScripts = [
    "content/adapters/chatgptAdapter.js",
    "content/adapters/openaiAdapter.js",
    "content/adapters/geminiDiagnosticsAdapter.js",
    "content/adapters/geminiAdapter.js",
    "content/adapters/geminiUploadDiscovery.js",
    "content/adapters/claudeAdapter.js",
    "content/adapters/grokAdapter.js",
    "content/adapters/grokFileHandoff.js",
    "content/adapters/xAdapter.js",
    "content/adapters/whatsappAdapter.js",
    "content/adapters/index.js"
  ];
  const adapterIndexes = adapterScripts.map((script) => contentScripts.indexOf(script));
  const whatsAppCapabilitiesIndex = contentScripts.indexOf("content/whatsapp/whatsappCapabilities.js");
  const whatsAppTextFlowIndex = contentScripts.indexOf("content/whatsapp/whatsappTextFlow.js");
  const whatsAppSelectorsIndex = contentScripts.indexOf("content/whatsapp/whatsappSelectors.js");
  const geminiFallbackWriterIndex = contentScripts.indexOf("content/adapters/geminiFallbackWriter.js");
  const safeSnapshotsIndex = contentScripts.indexOf("content/diagnostics/safeSnapshots.js");
  const fileProcessingUiIndex = contentScripts.indexOf("content/files/fileProcessingUi.js");
  const fileAttachPipelineIndex = contentScripts.indexOf("content/files/fileAttachPipeline.js");
  const fileInputPreparationIndex = contentScripts.indexOf("content/files/fileInputPreparation.js");
  const fileHandoffDiscoveryIndex = contentScripts.indexOf("content/files/fileHandoffDiscovery.js");
  const sanitizedFileHandoffIndex = contentScripts.indexOf("content/files/sanitizedFileHandoff.js");
  const placeholderRehydratorIndex = contentScripts.indexOf("content/rehydration/placeholderRehydrator.js");
  const responseObserverIndex = contentScripts.indexOf("content/rehydration/responseObserver.js");
  const revealControllerIndex = contentScripts.indexOf("content/rehydration/revealController.js");
  const debugLoggerIndex = contentScripts.indexOf("content/diagnostics/debugLogger.js");
  const contentDebugFacadeIndex = contentScripts.indexOf("content/diagnostics/contentDebugFacade.js");
  const contentModalUiIndex = contentScripts.indexOf("content/ui/contentModalUi.js");
  const contentStatusUiIndex = contentScripts.indexOf("content/ui/contentStatusUi.js");
  const contentEventBindingsIndex = contentScripts.indexOf("content/bootstrap/eventBindings.js");
  const contentIndex = contentScripts.indexOf("content/content.js");

  assert.ok(knownSecretReuseIndex > -1, "content scripts should include known-secret reuse helpers");
  assert.ok(placeholderFamiliesIndex > -1, "content scripts should include placeholder family registry");
  assert.ok(placeholdersIndex > -1, "content scripts should include placeholder manager");
  assert.ok(detectorIndex > -1, "content scripts should include detector");
  assert.ok(
    detectionModuleIndexes.every((index) => index > -1),
    "content scripts should include modular enterprise/cloud detection helpers"
  );
  assert.ok(
    placeholderFamiliesIndex < placeholdersIndex &&
      detectionModuleIndexes.every((index) => index < detectorIndex) &&
      detectionModuleIndexes[detectionModuleIndexes.length - 1] < detectorIndex,
    "placeholder families must load before placeholders.js and detection modules/indexes must load before detector.js"
  );
  assert.ok(
    knownSecretReuseIndex < transformOutboundPromptIndex && knownSecretReuseIndex < redactorIndex,
    "known-secret reuse helpers should load before prompt transform and redactor modules"
  );
  assert.ok(fileScannerIndex > -1, "content scripts should include shared file scanner helpers");
  assert.ok(fileLimitsIndex > -1, "content scripts should include shared file limit constants");
  assert.ok(fileTypeRegistryIndex > -1, "content scripts should include shared file type registry helpers");
  assert.ok(fileExtractorsIndex > -1, "content scripts should include shared file extractor helpers");
  assert.ok(docxRedactorIndex > -1, "content scripts should include shared DOCX redactor helpers");
  assert.ok(xlsxRedactorIndex > -1, "content scripts should include shared XLSX redactor helpers");
  assert.ok(ocrRuntimeIndex > -1, "content scripts should include shared OCR runtime helpers");
  assert.ok(scannerOcrIndex > -1, "content scripts should include shared scanner OCR helpers");
  assert.ok(imageRedactorIndex > -1, "content scripts should include shared image redactor helpers");
  assert.ok(streamingRedactorIndex > -1, "content scripts should include streaming file redactor helpers");
  assert.ok(filePasteHelperIndex > -1, "content scripts should include local file paste helpers");
  assert.ok(fileHandoffStateIndex > -1, "content scripts should include file handoff state helpers");
  assert.ok(fileHandoffPendingIndex > -1, "content scripts should include file handoff pending helpers");
  assert.ok(fileHandoffFlowIndex > -1, "content scripts should include file handoff flow helpers");
  assert.ok(rewriteVerificationTextIndex > -1, "content scripts should include rewrite verification text helpers");
  assert.ok(fileTransferPolicyIndex > -1, "content scripts should include file transfer policy helpers");
  assert.ok(fileExtractionSessionCacheIndex > -1, "content scripts should include file extraction session cache helpers");
  assert.ok(protectedSiteOcrBrokerIndex > -1, "content scripts should include protected-site OCR broker helpers");
  assert.ok(
    contentFileExtractionPipelineIndex > -1,
    "content scripts should include content file extraction pipeline helpers"
  );
  assert.ok(hostMatchingIndex > -1, "content scripts should include host matching helpers");
  assert.ok(adapterIndexes.every((index) => index > -1), "content scripts should include site adapter helpers");
  assert.ok(whatsAppCapabilitiesIndex > -1, "content scripts should include WhatsApp capability helpers");
  assert.ok(whatsAppTextFlowIndex > -1, "content scripts should include WhatsApp text flow helpers");
  assert.ok(whatsAppSelectorsIndex > -1, "content scripts should include WhatsApp selector helpers");
  assert.ok(geminiFallbackWriterIndex > -1, "content scripts should include Gemini fallback writer helpers");
  assert.ok(safeSnapshotsIndex > -1, "content scripts should include safe snapshot helpers");
  assert.ok(fileProcessingUiIndex > -1, "content scripts should include file processing UI helpers");
  assert.ok(fileAttachPipelineIndex > -1, "content scripts should include file attach pipeline helpers");
  assert.ok(fileInputPreparationIndex > -1, "content scripts should include file input preparation helpers");
  assert.ok(fileHandoffDiscoveryIndex > -1, "content scripts should include file handoff discovery helpers");
  assert.ok(sanitizedFileHandoffIndex > -1, "content scripts should include sanitized file handoff helpers");
  assert.ok(placeholderRehydratorIndex > -1, "content scripts should include placeholder rehydration helpers");
  assert.ok(responseObserverIndex > -1, "content scripts should include response observer helpers");
  assert.ok(revealControllerIndex > -1, "content scripts should include reveal controller helpers");
  assert.ok(debugLoggerIndex > -1, "content scripts should include raw-safe debug logger helpers");
  assert.ok(contentDebugFacadeIndex > -1, "content scripts should include raw-safe content debug facade helpers");
  assert.ok(contentModalUiIndex > -1, "content scripts should include content modal UI helpers");
  assert.ok(contentStatusUiIndex > -1, "content scripts should include content status UI helpers");
  assert.ok(contentEventBindingsIndex > -1, "content scripts should include content event binding helpers");
  const adapterOrderAligned = adapterIndexes.every(
    (index, offset) => offset === 0 || adapterIndexes[offset - 1] < index
  );
  assert.ok(
    fileLimitsIndex < fileTypeRegistryIndex &&
      fileTypeRegistryIndex < fileExtractorsIndex &&
      fileExtractorsIndex < fileScannerIndex &&
      fileScannerIndex < docxRedactorIndex &&
      docxRedactorIndex < xlsxRedactorIndex &&
      xlsxRedactorIndex < ocrRuntimeIndex &&
      ocrRuntimeIndex < scannerOcrIndex &&
      scannerOcrIndex < imageRedactorIndex &&
      imageRedactorIndex < streamingRedactorIndex &&
      streamingRedactorIndex < filePasteHelperIndex &&
      filePasteHelperIndex < fileHandoffStateIndex &&
      fileHandoffStateIndex < fileHandoffPendingIndex &&
      fileHandoffPendingIndex < fileHandoffFlowIndex &&
      fileHandoffFlowIndex < rewriteVerificationTextIndex &&
      rewriteVerificationTextIndex < fileTransferPolicyIndex &&
      fileTransferPolicyIndex < fileExtractionSessionCacheIndex &&
      fileExtractionSessionCacheIndex < protectedSiteOcrBrokerIndex &&
      protectedSiteOcrBrokerIndex < contentFileExtractionPipelineIndex &&
      contentFileExtractionPipelineIndex < hostMatchingIndex &&
      hostMatchingIndex < adapterIndexes[0] &&
      adapterOrderAligned &&
      adapterIndexes.at(-1) < whatsAppCapabilitiesIndex &&
      whatsAppCapabilitiesIndex < whatsAppTextFlowIndex &&
      whatsAppTextFlowIndex < whatsAppSelectorsIndex &&
      whatsAppSelectorsIndex < geminiFallbackWriterIndex &&
      geminiFallbackWriterIndex < safeSnapshotsIndex &&
      safeSnapshotsIndex < fileProcessingUiIndex &&
      fileProcessingUiIndex < fileAttachPipelineIndex &&
      fileAttachPipelineIndex < fileInputPreparationIndex &&
      fileInputPreparationIndex < fileHandoffDiscoveryIndex &&
      fileHandoffDiscoveryIndex < sanitizedFileHandoffIndex &&
      sanitizedFileHandoffIndex < placeholderRehydratorIndex &&
      placeholderRehydratorIndex < responseObserverIndex &&
      responseObserverIndex < revealControllerIndex &&
      revealControllerIndex < debugLoggerIndex &&
      debugLoggerIndex < contentDebugFacadeIndex &&
      contentDebugFacadeIndex < contentModalUiIndex &&
      contentModalUiIndex < contentStatusUiIndex &&
      contentStatusUiIndex < contentEventBindingsIndex &&
      contentEventBindingsIndex < contentIndex,
    "file scanner, streaming redactor, file paste helper, file handoff, pure helper, adapter, and content script injection order should stay aligned"
  );
  assert.strictEqual(
    chromeEnterpriseManifest.storage?.managed_schema,
    "config/managed_policy_schema.json",
    "chrome enterprise manifest should declare managed policy schema support"
  );
  assert.deepStrictEqual(
    firefoxManifest.browser_specific_settings?.gecko?.data_collection_permissions,
    { required: ["none"] },
    "firefox manifest should disclose no transmitted data collection"
  );

  const firefoxOnnxLoader = fs.readFileSync(
    path.join(repoRoot, "dist/firefox/vendor/onnxruntime/ort.wasm.min.js"),
    "utf8"
  );
  assert.ok(
    firefoxOnnxLoader.includes("import(e)"),
    "packaged ONNX loader should import the runtime-selected extension URL for the WASM sidecar"
  );
  assert.ok(
    !firefoxOnnxLoader.includes("/*@vite-ignore*/e"),
    "packaged ONNX loader should not keep the dynamic import target flagged by AMO lint"
  );
  assert.ok(
    !firefoxOnnxLoader.includes('import("./ort-wasm-simd-threaded.mjs")'),
    "packaged ONNX loader must not use a page-relative sidecar import in Firefox content scripts"
  );

  const consumerDefaults = await policyModule.loadDefaultPolicy({
    browser: "chrome",
    mode: "consumer",
    enterprise: false
  });
  const enterpriseDefaults = await policyModule.loadDefaultPolicy({
    browser: "chrome",
    mode: "enterprise",
    enterprise: true
  });

  assert.strictEqual(
    consumerDefaults.enterpriseMode,
    false,
    "consumer build should not enable enterprise policy defaults"
  );
  assert.strictEqual(
    enterpriseDefaults.allowReveal,
    false,
    "enterprise build should disable reveal by default"
  );
  assert.strictEqual(
    enterpriseDefaults.blockHttpSecrets,
    true,
    "enterprise build should block HTTP secrets by default"
  );
  assert.strictEqual(
    enterpriseDefaults.auditRetentionDays,
    30,
    "enterprise build should default to bounded audit retention"
  );

  console.log("PASS multi-target build regressions");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
