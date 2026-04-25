(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  const MODEL_PATH = "ai/models/leakguard_secret_classifier.onnx";
  const FEATURE_SPEC_PATH = "ai/models/leakguard_secret_classifier.features.json";
  const LABELS = ["NOT_SECRET", "SECRET", "UNSURE"];
  const SECRET_KEYWORDS = [
    "api_key",
    "apikey",
    "authorization",
    "bearer",
    "client_secret",
    "connection_string",
    "database_url",
    "db_password",
    "jwt",
    "password",
    "private_key",
    "secret",
    "session",
    "token"
  ];
  const SAFE_KEYWORDS = ["api_version", "region", "secret_santa", "token_limit", "username", "version"];

  let runtimePromise = null;
  let sessionPromise = null;
  let featureSpecPromise = null;

  function getExtensionUrl(relativePath) {
    const ext = root.PWM.ext || root.browser || root.chrome || null;
    if (!ext?.runtime?.getURL) return relativePath;
    return ext.runtime.getURL(relativePath);
  }

  function logAiWarning(message, error) {
    if (root.console?.warn) {
      root.console.warn(`LeakGuard AI assist: ${message}`, error || "");
    }
  }

  async function loadOnnxRuntime() {
    if (root.ort?.InferenceSession?.create) {
      return {
        ort: root.ort,
        env: root.ort.env
      };
    }

    if (!runtimePromise) {
      runtimePromise = Promise.resolve(null);
    }
    return runtimePromise;
  }

  async function loadFeatureSpec() {
    if (!featureSpecPromise) {
      featureSpecPromise = fetch(getExtensionUrl(FEATURE_SPEC_PATH))
        .then((response) => {
          if (!response.ok) throw new Error(`feature spec load failed: ${response.status}`);
          return response.json();
        })
        .catch((error) => {
          logAiWarning("feature spec unavailable", error);
          return null;
        });
    }
    return featureSpecPromise;
  }

  async function loadSession() {
    if (!sessionPromise) {
      sessionPromise = (async () => {
        const onnxRuntime = await loadOnnxRuntime();
        const runtime = onnxRuntime?.ort || root.ort;
        if (!runtime?.InferenceSession?.create) {
          throw new Error("ONNX Runtime session API is unavailable");
        }
        if (runtime.env?.wasm) {
          runtime.env.wasm.wasmPaths = getExtensionUrl("vendor/onnxruntime/");
          runtime.env.wasm.numThreads = 1;
        }
        return runtime.InferenceSession.create(getExtensionUrl(MODEL_PATH));
      })().catch((error) => {
        logAiWarning("model unavailable", error);
        return null;
      });
    }
    return sessionPromise;
  }

  function shannonEntropy(text) {
    const input = String(text || "");
    if (!input) return 0;
    const counts = Object.create(null);
    for (const char of input) counts[char] = (counts[char] || 0) + 1;
    let entropy = 0;
    for (const count of Object.values(counts)) {
      const probability = count / input.length;
      entropy -= probability * Math.log2(probability);
    }
    return entropy;
  }

  function splitContext(text) {
    const input = String(text || "");
    const match = /[:=]\s*/.exec(input);
    if (!match) return { left: "", target: input, right: "" };
    return {
      left: input.slice(0, match.index),
      target: input.slice(match.index + match[0].length),
      right: input.slice(match.index + match[0].length)
    };
  }

  function keywordPresent(text, keywords) {
    const normalized = String(text || "").toLowerCase();
    return keywords.some((keyword) =>
      new RegExp(`(^|[^a-z0-9])${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(
        normalized
      )
    );
  }

  function numericFeatures(text) {
    const value = String(text || "");
    const context = splitContext(value);
    const target = context.target || value;
    const classes = {
      digit: /\d/.test(target),
      upper: /[A-Z]/.test(target),
      lower: /[a-z]/.test(target),
      symbol: /[^A-Za-z0-9]/.test(target)
    };

    return [
      target.length,
      shannonEntropy(target),
      Number(classes.digit),
      Number(classes.upper),
      Number(classes.lower),
      Number(classes.symbol),
      Number(classes.digit) + Number(classes.upper) + Number(classes.lower) + Number(classes.symbol),
      Number(/^[A-Za-z0-9+/_-]{20,}={0,2}$/.test(target)),
      Number(/^[A-Fa-f0-9]{24,}$/.test(target)),
      Number(/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(target)),
      Number(keywordPresent(value, SECRET_KEYWORDS)),
      Number(keywordPresent(value, SAFE_KEYWORDS)),
      Number(/[:=]/.test(value)),
      Number(keywordPresent(context.left, SECRET_KEYWORDS)),
      Number(keywordPresent(context.right, SECRET_KEYWORDS))
    ];
  }

  function charNgrams(text, minN, maxN) {
    const padded = ` ${String(text || "")} `;
    const counts = new Map();
    for (let size = minN; size <= maxN; size += 1) {
      for (let index = 0; index <= padded.length - size; index += 1) {
        const ngram = padded.slice(index, index + size);
        counts.set(ngram, (counts.get(ngram) || 0) + 1);
      }
    }
    return counts;
  }

  function computeFeatures(text, featureSpec) {
    const vocabulary = featureSpec?.char_vocabulary || [];
    const [minN, maxN] = featureSpec?.char_ngram_range || [3, 5];
    const ngramCounts = charNgrams(text, minN, maxN);
    const numeric = numericFeatures(text);
    const output = new Float32Array(vocabulary.length + numeric.length);

    vocabulary.forEach((ngram, index) => {
      output[index] = ngramCounts.get(ngram) || 0;
    });
    numeric.forEach((value, index) => {
      output[vocabulary.length + index] = value;
    });

    return output;
  }

  function readProbabilities(outputs) {
    if (!outputs || typeof outputs !== "object") return null;
    const output = outputs.probabilities || outputs.probability || Object.values(outputs)[1] || Object.values(outputs)[0];
    const data = output?.data || output;
    if (!data || typeof data.length !== "number") return null;
    return Array.from(data).slice(0, LABELS.length);
  }

  async function classify(text) {
    const input = String(text || "");
    if (!input.trim()) {
      return { risk: "NOT_SECRET", confidence: 0 };
    }

    const [featureSpec, session] = await Promise.all([loadFeatureSpec(), loadSession()]);
    if (!featureSpec || !session) {
      return { risk: "UNSURE", confidence: 0, unavailable: true };
    }

    try {
      const onnxRuntime = await loadOnnxRuntime();
      const runtime = onnxRuntime?.ort || root.ort;
      const Tensor = runtime?.Tensor || root.ort?.Tensor;
      if (!Tensor) throw new Error("ONNX Tensor API is unavailable");

      const features = computeFeatures(input, featureSpec);
      const tensor = new Tensor("float32", features, [1, features.length]);
      const inputName = session.inputNames?.[0] || "input";
      const outputs = await session.run({ [inputName]: tensor });
      const probabilities = readProbabilities(outputs);
      if (!probabilities) throw new Error("ONNX probability output missing");

      let bestIndex = 0;
      for (let index = 1; index < probabilities.length; index += 1) {
        if (probabilities[index] > probabilities[bestIndex]) bestIndex = index;
      }

      const secretIndex = LABELS.indexOf("SECRET");
      return {
        risk: LABELS[bestIndex] || "UNSURE",
        confidence: Number(probabilities[secretIndex] || 0)
      };
    } catch (error) {
      logAiWarning("classification failed", error);
      return { risk: "UNSURE", confidence: 0, unavailable: true };
    }
  }

  root.PWM.LeakGuardAiClassifier = {
    classify,
    computeFeatures,
    loadFeatureSpec,
    loadSession
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.LeakGuardAiClassifier;
  }
})();
