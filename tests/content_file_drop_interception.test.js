const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");
const contentSource = fs.readFileSync(path.join(repoRoot, "src/content/content.js"), "utf8");

require(path.join(repoRoot, "src/content/file_paste_helpers.js"));
require(path.join(repoRoot, "src/content/composer_helpers.js"));
require(path.join(repoRoot, "src/shared/fileScanner.js"));
require(path.join(repoRoot, "src/shared/streamingFileRedactor.js"));

const { dataTransferHasFiles } = globalThis.PWM.FilePasteHelpers;

function extractFunctionSource(source, name) {
  const match = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(source);
  assert.ok(match, `expected to find function ${name}`);

  const start = match.index;
  const openBrace = source.indexOf("{", start);
  assert.notStrictEqual(openBrace, -1, `expected ${name} to have a body`);

  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = openBrace; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }

    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  throw new Error(`Could not extract function ${name}`);
}

function createDataTransfer({ files = true, exposeFiles = true } = {}) {
  const file = {
    name: "secrets.env",
    type: "text/plain",
    size: 42
  };

  if (!files) {
    return {
      types: ["text/plain"],
      files: [],
      items: [],
      dropEffect: "none"
    };
  }

  return {
    types: ["Files"],
    files: exposeFiles ? [file] : [],
    items: [
      {
        kind: "file",
        getAsFile: () => file
      }
    ],
    dropEffect: "none"
  };
}

function createEvent({
  dataTransfer = createDataTransfer(),
  target = { tagName: "SPAN" },
  sanitized = false,
  defaultPrevented: initialDefaultPrevented = false
} = {}) {
  let defaultPrevented = initialDefaultPrevented;
  const calls = {
    preventDefault: 0,
    stopPropagation: 0,
    stopImmediatePropagation: 0
  };
  const event = {
    dataTransfer,
    target,
    get defaultPrevented() {
      return defaultPrevented;
    },
    preventDefault() {
      calls.preventDefault += 1;
      defaultPrevented = true;
    },
    stopPropagation() {
      calls.stopPropagation += 1;
    },
    stopImmediatePropagation() {
      calls.stopImmediatePropagation += 1;
    }
  };

  if (sanitized) {
    Object.defineProperty(event, "__PWM_SANITIZED_FILE_HANDOFF__", {
      value: true,
      configurable: true
    });
  }

  return { event, calls };
}

function createClipboardEvent({
  text = "API_KEY=LeakGuardPasteApiKey1234567890",
  target = { tagName: "SPAN" },
  defaultPrevented: initialDefaultPrevented = false
} = {}) {
  let defaultPrevented = initialDefaultPrevented;
  const calls = {
    preventDefault: 0,
    stopPropagation: 0,
    stopImmediatePropagation: 0
  };
  const event = {
    clipboardData: {
      getData(type) {
        return type === "text/plain" || type === "text" ? text : "";
      }
    },
    target,
    get defaultPrevented() {
      return defaultPrevented;
    },
    preventDefault() {
      calls.preventDefault += 1;
      defaultPrevented = true;
    },
    stopPropagation() {
      calls.stopPropagation += 1;
    },
    stopImmediatePropagation() {
      calls.stopImmediatePropagation += 1;
    }
  };

  return { event, calls };
}

function createGeminiEditor(initialText = "") {
  const editor = {
    nodeType: 1,
    tagName: "DIV",
    className: "ql-editor",
    text: initialText,
    attributes: {
      spellcheck: "true",
      autocorrect: "on",
      autocomplete: "on",
      autocapitalize: "sentences"
    },
    spellcheck: true,
    textContentWrites: 0,
    focusCalls: 0,
    inputEvents: [],
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
    },
    hasAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attributes, name);
    },
    removeAttribute(name) {
      delete this.attributes[name];
    },
    focus() {
      this.focusCalls += 1;
    },
    dispatchEvent(event) {
      this.inputEvents.push(event);
      return true;
    },
    closest(selector) {
      if (selector === ".ql-editor" || selector === '[contenteditable="true"]') {
        return this;
      }
      return null;
    }
  };
  Object.defineProperty(editor, "textContent", {
    get() {
      return this.text;
    },
    set(value) {
      this.textContentWrites += 1;
      this.inputAssistAtWrite = {
        spellcheckAttribute: this.attributes.spellcheck,
        spellcheckProperty: this.spellcheck,
        autocorrect: this.attributes.autocorrect,
        autocomplete: this.attributes.autocomplete,
        autocapitalize: this.attributes.autocapitalize
      };
      if (typeof this.onTextContentSet === "function") {
        this.onTextContentSet(String(value || ""));
      }
      this.text = String(value || "");
    }
  });
  const child = {
    nodeType: 1,
    tagName: "SPAN",
    closest(selector) {
      return selector === ".ql-editor" || selector === '[contenteditable="true"]' ? editor : null;
    }
  };

  return { editor, child };
}

function createTextFile({ name = "secrets.env", type = "text/plain", text }) {
  const input = String(text || "");
  return {
    name,
    type,
    size: new TextEncoder().encode(input).byteLength,
    async text() {
      return input;
    }
  };
}

function buildLargeGeminiPayload({ minBytes, rawSecret }) {
  const header = [
    "Before the secret",
    `API_KEY=${rawSecret}`,
    "token_limit=4096"
  ].join("\n");
  const footer = `\nSECOND_API_KEY=${rawSecret}\n`;
  const fillerLine =
    "safe_line=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef\n";
  let filler = "";

  while (Buffer.byteLength(`${header}\n${filler}${footer}`, "utf8") < minBytes) {
    filler += fillerLine;
  }

  return `${header}\n${filler}${footer}`;
}

function buildSizedText({ minBytes, rawSecret = "LeakGuardSizedApiKey1234567890" }) {
  const header = `API_KEY=${rawSecret}\n`;
  const fillerLine = "safe_size_line=0123456789abcdef0123456789abcdef0123456789abcdef\n";
  const remaining = Math.max(0, minBytes - Buffer.byteLength(header, "utf8"));
  const fillerCount = Math.ceil(remaining / Buffer.byteLength(fillerLine, "utf8"));
  const filler = fillerLine.repeat(fillerCount);

  return `${header}${filler}`;
}

function createHarness(overrides = {}) {
  const calls = {
    reads: [],
    redactions: [],
    createdFiles: [],
    handoffs: [],
    textFallbacks: [],
    badges: [],
    hideBadgeSoon: 0,
    refreshBadge: 0,
    modals: [],
    debugEvents: [],
    dragDetections: 0,
    clearedDragSessions: 0
  };
  const activeElement = { tagName: "TEXTAREA" };
  const dependencies = {
    extensionRuntimeAvailable: true,
    modalOpen: false,
    Node: { ELEMENT_NODE: 1 },
    Event,
    InputEvent: typeof InputEvent === "function" ? InputEvent : Event,
    window: {
      getSelection: () => null,
      setTimeout: (callback) => {
        callback();
        return 0;
      },
      requestAnimationFrame: (callback) => {
        callback();
        return 0;
      }
    },
    fileDragGuard: null,
    rawFileDropInterceptions: new WeakSet(),
    FilePasteHelpers: globalThis.PWM.FilePasteHelpers,
    StreamingFileRedactor: globalThis.PWM.StreamingFileRedactor || {},
    normalizeComposerText: globalThis.PWM.ComposerHelpers.normalizeComposerText,
    spliceSelectionText: globalThis.PWM.ComposerHelpers.spliceSelectionText,
    buildComposerWritePlan: (input, text) => ({
      canonical: globalThis.PWM.ComposerHelpers.normalizeComposerText(text),
      writeText: globalThis.PWM.ComposerHelpers.normalizeComposerText(text)
    }),
    matchesComposerPlan: (plan, actual) =>
      globalThis.PWM.ComposerHelpers.normalizeComposerText(actual) === plan.canonical,
    collectFailureDetails: () => ({}),
    showRewriteFailure: async () => {},
    dataTransferHasFiles,
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      return {
        handled: true,
        ok: true,
        text: "API_KEY=LeakGuardDropApiKey1234567890",
        file: {
          name: "secrets.env",
          type: "text/plain"
        }
      };
    },
    createSanitizedTextFile: (file, text) => {
      const sanitizedFile = { name: file.name, type: file.type, text };
      calls.createdFiles.push({ file, text, sanitizedFile });
      return sanitizedFile;
    },
    analyzeText: (text) => ({
      normalizedText: text,
      secretFindings: /LeakGuard(?:Drop|Paste|File)ApiKey1234567890/.test(text)
        ? [{ raw: "LeakGuardApiKey" }]
        : [],
      findings: /LeakGuard(?:Drop|Paste|File)ApiKey1234567890/.test(text)
        ? [{ raw: "LeakGuardApiKey" }]
        : [],
      placeholderNormalized: false
    }),
    requestRedaction: async (text, findings) => {
      calls.redactions.push({ text, findings });
      return {
        redactedText: text.replace(
          /LeakGuard(?:Drop|Paste|File)ApiKey1234567890/g,
          "[PWM_1]"
        )
      };
    },
    handOffSanitizedLocalFile: (event, input, sanitizedFile, context) => {
      calls.handoffs.push({ event, input, sanitizedFile, context });
      return true;
    },
    handOffGeminiSanitizedFileUpload: (event, input, sanitizedFile) => {
      calls.handoffs.push({ event, input, sanitizedFile, context: "gemini-file-input" });
      return true;
    },
    getInputText: (input) => input?.text || "",
    getSelectionOffsets: (input) => input?.selection || { start: 0, end: 0 },
    applyPasteDecision: async (input, originalText, selection, insertedText, context) => {
      calls.textFallbacks.push({ input, originalText, selection, insertedText, context });
      input.text = `${originalText.slice(0, selection.start)}${insertedText}${originalText.slice(selection.end)}`;
      return true;
    },
    setInputTextDirect: (input, text, options = {}) => {
      calls.directTextWrites = calls.directTextWrites || [];
      calls.directTextWrites.push({ input, text, options });
      input.text = String(text || "");
      return true;
    },
    setBadge: (...args) => calls.badges.push(args),
    hideBadgeSoon: () => {
      calls.hideBadgeSoon += 1;
    },
    refreshBadgeFromCurrentInput: () => {
      calls.refreshBadge += 1;
    },
    showMessageModal: async (...args) => {
      calls.modals.push(args);
    },
    showGeminiLargeTextConfirmationModal: async (...args) => {
      calls.largeTextConfirmations = calls.largeTextConfirmations || [];
      calls.largeTextConfirmations.push(args);
      return { action: "insert" };
    },
    debugReveal: (label, details) => {
      calls.debugEvents.push({ label, details });
    },
    handleContentError: (error) => {
      calls.errors = calls.errors || [];
      calls.errors.push(error);
    },
    suppressFollowupInputScan: () => {},
    getActivePolicy: () => ({}),
    handleFileDragDetected: () => {
      calls.dragDetections += 1;
    },
    clearFileDragSession: () => {
      calls.clearedDragSessions += 1;
    },
    findComposer: () => null,
    document: {
      activeElement,
      execCommand: () => false,
      createRange: () => null
    },
    location: { hostname: "chatgpt.com" }
  };
  Object.assign(dependencies, overrides);

  const factory = new Function(
    ...Object.keys(dependencies),
    [
      'const GEMINI_SANITIZED_TEXT_FALLBACK_MESSAGE = "Sanitized content inserted as text because Gemini rejected sanitized file upload.";',
      "const PROGRAMMATIC_INPUT_SUPPRESS_MS = 500;",
      "const CHATGPT_LARGE_PASTE_FILE_THRESHOLD = 16 * 1024;",
      'const CHATGPT_SANITIZED_PASTE_FILE_NAME = "leakguard-redacted-paste.txt";',
      "const GEMINI_DIRECT_TEXT_INSERT_THRESHOLD = 8 * 1024;",
      "const GEMINI_AUTO_INSERT_TEXT_LIMIT = 256 * 1024;",
      "const GEMINI_LARGE_TEXT_SUPPRESS_MS = 2500;",
      "const LOCAL_TEXT_FAST_MAX_BYTES = 2 * 1024 * 1024;",
      "const LOCAL_TEXT_OPTIMIZED_MAX_BYTES = 4 * 1024 * 1024;",
      "const LOCAL_TEXT_HARD_BLOCK_BYTES = 4 * 1024 * 1024;",
      'const LOCAL_TEXT_HARD_BLOCK_TITLE = "Large payload blocked for browser stability";',
      'const LOCAL_TEXT_HARD_BLOCK_MESSAGE = "This content is over 4 MB. LeakGuard did not process or send it automatically to avoid browser instability. Split the file into smaller parts, or sanitize it separately before upload.";',
      "let suppressInputScanUntil = 0;",
      extractFunctionSource(contentSource, "consumeInterceptionEvent"),
      extractFunctionSource(contentSource, "dataTransferLooksLikeFiles"),
      extractFunctionSource(contentSource, "listLocalTransferFiles"),
      extractFunctionSource(contentSource, "isStrictUnsupportedFileMode"),
      extractFunctionSource(contentSource, "classifyLocalFile"),
      extractFunctionSource(contentSource, "resolveLocalFileTransferPolicy"),
      extractFunctionSource(contentSource, "resolveFileDragGuardPolicy"),
      extractFunctionSource(contentSource, "showUnsupportedFilePassThroughNotice"),
      extractFunctionSource(contentSource, "getLocalTextPayloadByteLength"),
      extractFunctionSource(contentSource, "classifyLocalTextPayloadSize"),
      extractFunctionSource(contentSource, "showLocalPayloadOptimizationStatus"),
      extractFunctionSource(contentSource, "clearLocalPayloadOptimizationStatus"),
      extractFunctionSource(contentSource, "blockLargeLocalTextPayload"),
      extractFunctionSource(contentSource, "showStreamingRedactionStatus"),
      extractFunctionSource(contentSource, "updateStreamingRedactionProgress"),
      extractFunctionSource(contentSource, "clearStreamingRedactionStatus"),
      extractFunctionSource(contentSource, "createStreamingSanitizedFile"),
      extractFunctionSource(contentSource, "streamRedactLocalTextFile"),
      extractFunctionSource(contentSource, "blockStreamingLocalFile"),
      extractFunctionSource(contentSource, "isSanitizedFileHandoffEvent"),
      extractFunctionSource(contentSource, "normalizeTarget"),
      extractFunctionSource(contentSource, "isChatGptHost"),
      extractFunctionSource(contentSource, "isGeminiHost"),
      extractFunctionSource(contentSource, "shouldHandleChatGptLargeTextPaste"),
      extractFunctionSource(contentSource, "createSanitizedChatGptPasteFile"),
      extractFunctionSource(contentSource, "applyChatGptLargePasteTextFallback"),
      extractFunctionSource(contentSource, "maybeHandleChatGptLargeTextPaste"),
      extractFunctionSource(contentSource, "resolveGeminiEditorTarget"),
      extractFunctionSource(contentSource, "redactGeminiEditorText"),
      extractFunctionSource(contentSource, "settleComposer"),
      extractFunctionSource(contentSource, "readStableComposerText"),
      extractFunctionSource(contentSource, "suppressFollowupInputScan"),
      extractFunctionSource(contentSource, "isProgrammaticInputScanSuppressed"),
      extractFunctionSource(contentSource, "placeGeminiEditorCaretAtEnd"),
      extractFunctionSource(contentSource, "setEditorAttribute"),
      extractFunctionSource(contentSource, "captureEditorAttribute"),
      extractFunctionSource(contentSource, "disableGeminiEditorInputAssist"),
      extractFunctionSource(contentSource, "restoreGeminiEditorInputAssist"),
      extractFunctionSource(contentSource, "setGeminiEditorTextDirect"),
      extractFunctionSource(contentSource, "insertLargeGeminiEditorText"),
      extractFunctionSource(contentSource, "insertGeminiEditorText"),
      extractFunctionSource(contentSource, "dispatchGeminiEditorInput"),
      extractFunctionSource(contentSource, "confirmGeminiLargeSanitizedTextInsertion"),
      extractFunctionSource(contentSource, "applyGeminiEditorText"),
      extractFunctionSource(contentSource, "blockGeminiEditorRawContent"),
      extractFunctionSource(contentSource, "maybeHandleGeminiEditorPaste"),
      extractFunctionSource(contentSource, "listGeminiDropFiles"),
      extractFunctionSource(contentSource, "isSupportedGeminiTextFile"),
      extractFunctionSource(contentSource, "readGeminiTextFile"),
      extractFunctionSource(contentSource, "maybeHandleGeminiEditorDrop"),
      extractFunctionSource(contentSource, "describeFileForDebug"),
      extractFunctionSource(contentSource, "applyGeminiSanitizedTextFallback"),
      extractFunctionSource(contentSource, "insertGeminiLocalFileText"),
      extractFunctionSource(contentSource, "maybeHandleLocalFileInsert"),
      extractFunctionSource(contentSource, "maybeHandlePaste"),
      extractFunctionSource(contentSource, "maybeHandleDrop"),
      extractFunctionSource(contentSource, "maybeHandleFileDrag"),
      "return { maybeHandleChatGptLargeTextPaste, maybeHandlePaste, maybeHandleDrop, maybeHandleFileDrag, getSuppressInputScanUntil: () => suppressInputScanUntil, isProgrammaticInputScanSuppressed };"
    ].join("\n\n")
  );
  const handlers = factory(...Object.values(dependencies));

  return {
    ...handlers,
    calls,
    activeElement
  };
}

function createFileInput({ source = "light-dom", disabled = false } = {}) {
  const events = [];
  return {
    tagName: "INPUT",
    type: "file",
    disabled,
    hidden: source !== "light-dom",
    accept: ".env,text/plain",
    multiple: false,
    files: [],
    events,
    dispatchEvent(event) {
      events.push(event.type);
      return true;
    }
  };
}

function createHandoffHarness({ hostname = "gemini.google.com", fileInputs = [], shadowInputs = [] } = {}) {
  const debugEvents = [];
  const fallbackDrops = [];
  const stats = {
    documentQueries: 0
  };
  class TestEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.bubbles = Boolean(init.bubbles);
      this.cancelable = Boolean(init.cancelable);
    }
  }

  class TestDataTransfer {
    constructor() {
      this.files = [];
      this.items = {
        add: (file) => {
          this.files.push(file);
        }
      };
      this.dropEffect = "none";
    }
  }

  const shadowHosts = shadowInputs.map((input) => ({
    shadowRoot: {
      querySelectorAll(selector) {
        if (selector === "input[type='file']") return [input];
        if (selector === "*") return [];
        return [];
      }
    }
  }));
  const documentRoot = {
    querySelectorAll(selector) {
      stats.documentQueries += 1;
      if (selector === "input[type='file']") return fileInputs;
      if (selector === "*") return shadowHosts;
      return [];
    }
  };

  const dependencies = {
    Node: { ELEMENT_NODE: 1 },
    Event: TestEvent,
    DragEvent: undefined,
    ClipboardEvent: undefined,
    DataTransfer: TestDataTransfer,
    location: { hostname },
    document: documentRoot,
    sanitizedFileInputHandoffs: new WeakSet(),
    fallbackDrops,
    debugReveal: (label, payload) => debugEvents.push({ label, payload })
  };

  const factory = new Function(
    ...Object.keys(dependencies),
    [
      "let lastDiscoveredFileInput = null;",
      "let fileDragDiscoveryCompleted = false;",
      "let fileDragDiscoveryScheduled = false;",
      extractFunctionSource(contentSource, "normalizeTarget"),
      extractFunctionSource(contentSource, "isSanitizedFileHandoffEvent"),
      extractFunctionSource(contentSource, "markSanitizedFileHandoffEvent"),
      extractFunctionSource(contentSource, "createSanitizedDataTransfer"),
      extractFunctionSource(contentSource, "attachEventDataTransfer"),
      extractFunctionSource(contentSource, "dispatchSanitizedFileEvent").replace(
        "target.dispatchEvent(handoffEvent);",
        "fallbackDrops.push({ target, handoffEvent }); target.dispatchEvent(handoffEvent);"
      ),
      extractFunctionSource(contentSource, "isGeminiHost"),
      extractFunctionSource(contentSource, "isFileInputElement"),
      extractFunctionSource(contentSource, "describeFileForDebug"),
      extractFunctionSource(contentSource, "describeFileInputForDebug"),
      extractFunctionSource(contentSource, "collectFileInputsFromAncestry"),
      extractFunctionSource(contentSource, "collectFileInputsFromRoot"),
      extractFunctionSource(contentSource, "discoverFileInputForHandoff"),
      extractFunctionSource(contentSource, "resolveFileInputForHandoff"),
      extractFunctionSource(contentSource, "handOffSanitizedFileInput"),
      extractFunctionSource(contentSource, "handOffSanitizedLocalFile"),
      extractFunctionSource(contentSource, "handOffGeminiSanitizedFileUpload"),
      "return { handOffSanitizedLocalFile, handOffGeminiSanitizedFileUpload, resolveFileInputForHandoff };"
    ].join("\n\n")
  );

  const handlers = factory(...Object.values(dependencies));
  return {
    ...handlers,
    debugEvents,
    fallbackDrops,
    stats
  };
}

async function testFileDragoverIsAcceptedWithoutComposerTarget() {
  const { maybeHandleFileDrag } = createHarness({
    findComposer: () => {
      throw new Error("dragover should not require composer detection");
    }
  });
  const dataTransfer = createDataTransfer({ exposeFiles: false });
  const { event, calls } = createEvent({
    dataTransfer,
    target: { tagName: "MAT-ICON" }
  });

  maybeHandleFileDrag(event);

  assert.strictEqual(calls.preventDefault, 1);
  assert.strictEqual(calls.stopPropagation, 1);
  assert.strictEqual(calls.stopImmediatePropagation, 1);
  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(dataTransfer.dropEffect, "copy");
}

async function testFileDragoverIsAcceptedWithoutHelperLoaded() {
  const { maybeHandleFileDrag } = createHarness({
    dataTransferHasFiles: undefined
  });
  const dataTransfer = createDataTransfer({ exposeFiles: false });
  const { event, calls } = createEvent({
    dataTransfer,
    target: { tagName: "P" }
  });

  maybeHandleFileDrag(event);

  assert.strictEqual(calls.preventDefault, 1);
  assert.strictEqual(calls.stopPropagation, 1);
  assert.strictEqual(calls.stopImmediatePropagation, 1);
  assert.strictEqual(dataTransfer.dropEffect, "copy");
}

async function testFileDropIsHandledWithoutComposerTarget() {
  const dropTarget = { tagName: "MAT-ICON" };
  const findComposerCalls = [];
  const { maybeHandleDrop, calls, activeElement } = createHarness({
    findComposer: (target) => {
      findComposerCalls.push(target);
      return null;
    }
  });
  const dataTransfer = createDataTransfer();
  const { event, calls: eventCalls } = createEvent({
    dataTransfer,
    target: dropTarget
  });

  await maybeHandleDrop(event);

  assert.deepStrictEqual(findComposerCalls, [dropTarget, activeElement]);
  assert.strictEqual(calls.reads.length, 1);
  assert.strictEqual(calls.reads[0], dataTransfer);
  assert.strictEqual(calls.redactions.length, 1);
  assert.strictEqual(calls.createdFiles.length, 1);
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.handoffs[0].input, null);
  assert.strictEqual(calls.handoffs[0].context, "drop");
  assert.strictEqual(calls.createdFiles[0].text.includes("LeakGuardDropApiKey"), false);
  assert.strictEqual(calls.handoffs[0].sanitizedFile.text.includes("LeakGuardDropApiKey"), false);
  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(eventCalls.stopImmediatePropagation, 2);
}

async function testFileDropIsBlockedWithoutHelperLoaded() {
  const { maybeHandleDrop, calls } = createHarness({
    dataTransferHasFiles: undefined,
    readLocalTextFileFromDataTransfer: undefined
  });
  const { event, calls: eventCalls } = createEvent({
    dataTransfer: createDataTransfer(),
    target: { tagName: "P" }
  });

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(eventCalls.stopImmediatePropagation, 1);
  assert.strictEqual(calls.reads.length, 0);
  assert.strictEqual(calls.handoffs.length, 0);
}

async function testFileDropIsConsumedBeforeComposerLookup() {
  const findComposerCalls = [];
  const { maybeHandleDrop, calls } = createHarness({
    findComposer: (target) => {
      findComposerCalls.push(target);
      assert.strictEqual(event.defaultPrevented, true);
      return null;
    }
  });
  const { event, calls: eventCalls } = createEvent({
    dataTransfer: createDataTransfer(),
    target: { tagName: "P" }
  });

  await maybeHandleDrop(event);

  assert.strictEqual(findComposerCalls.length, 2);
  assert.strictEqual(calls.reads.length, 1);
  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(eventCalls.preventDefault, 2);
  assert.strictEqual(eventCalls.stopImmediatePropagation, 2);
}

async function testDuplicateDropListenerDoesNotDoubleHandleSameEvent() {
  const { maybeHandleDrop, calls } = createHarness({
    findComposer: () => null
  });
  const { event, calls: eventCalls } = createEvent({
    dataTransfer: createDataTransfer(),
    target: { tagName: "DIV" }
  });

  await maybeHandleDrop(event);
  await maybeHandleDrop(event);

  assert.strictEqual(calls.reads.length, 1);
  assert.strictEqual(calls.redactions.length, 1);
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(eventCalls.stopImmediatePropagation, 2);
}

async function testFileDropHandlesEarlierPreventDefaultWithoutComposerTarget() {
  const { maybeHandleDrop, calls } = createHarness({
    findComposer: () => null
  });
  const { event, calls: eventCalls } = createEvent({
    dataTransfer: createDataTransfer(),
    target: { tagName: "DIV" },
    defaultPrevented: true
  });

  await maybeHandleDrop(event);

  assert.strictEqual(calls.reads.length, 1);
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.handoffs[0].input, null);
  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(eventCalls.stopImmediatePropagation, 2);
}

async function testNonFileDragoverIsIgnored() {
  const dataTransfer = createDataTransfer({ files: false });
  const drag = createEvent({ dataTransfer });
  const drop = createEvent({ dataTransfer });
  const { maybeHandleDrop, maybeHandleFileDrag, calls } = createHarness();

  maybeHandleFileDrag(drag.event);
  await maybeHandleDrop(drop.event);

  assert.strictEqual(drag.calls.preventDefault, 0);
  assert.strictEqual(drop.calls.preventDefault, 0);
  assert.strictEqual(calls.reads.length, 0);
  assert.strictEqual(dataTransfer.dropEffect, "none");
}

async function testSanitizedFileHandoffDropIsIgnored() {
  const { maybeHandleDrop, calls } = createHarness({
    findComposer: () => {
      throw new Error("sanitized handoff drops should bypass interception");
    }
  });
  const { event, calls: eventCalls } = createEvent({
    dataTransfer: createDataTransfer(),
    sanitized: true
  });

  await maybeHandleDrop(event);

  assert.strictEqual(calls.reads.length, 0);
  assert.strictEqual(calls.handoffs.length, 0);
  assert.strictEqual(event.defaultPrevented, false);
  assert.strictEqual(eventCalls.stopImmediatePropagation, 0);
}

async function testComposerTargetDropStillPassesComposer() {
  const dropTarget = { tagName: "TEXTAREA" };
  const composer = { tagName: "TEXTAREA", id: "prompt-textarea" };
  const findComposerCalls = [];
  const { maybeHandleDrop, calls } = createHarness({
    findComposer: (target) => {
      findComposerCalls.push(target);
      return target === dropTarget ? composer : null;
    }
  });
  const { event } = createEvent({
    dataTransfer: createDataTransfer(),
    target: dropTarget
  });

  await maybeHandleDrop(event);

  assert.deepStrictEqual(findComposerCalls, [dropTarget]);
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.handoffs[0].input, composer);
  assert.strictEqual(calls.handoffs[0].context, "drop");
}

async function testGeminiDropSkipsSanitizedFileInputHandoff() {
  const rawFile = {
    name: "secrets.env",
    type: "text/plain",
    size: 49,
    text: "API_KEY=LeakGuardDropApiKey1234567890"
  };
  const sanitizedFile = {
    name: "secrets.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  const shadowInput = createFileInput({ source: "shadow-root" });
  const { handOffSanitizedLocalFile, debugEvents, fallbackDrops } = createHandoffHarness({
    shadowInputs: [shadowInput]
  });
  const event = {
    target: {
      nodeType: 1,
      tagName: "P",
      dispatchEvent() {
        throw new Error("Gemini input handoff should not fall back to synthetic raw-target drop");
      }
    },
    dataTransfer: { files: [rawFile] }
  };

  const handedOff = handOffSanitizedLocalFile(event, null, sanitizedFile, "drop");

  assert.strictEqual(handedOff, false);
  assert.deepStrictEqual(shadowInput.events, []);
  assert.strictEqual(shadowInput.files.length, 0);
  assert.strictEqual(fallbackDrops.length, 0);
  assert.ok(
    debugEvents.some((entry) => entry.label === "file-handoff:gemini-file-upload-skipped"),
    "expected Gemini file upload handoff to be skipped"
  );
}

async function testGeminiStreamingHandoffUsesDiscoveredFileInput() {
  const sanitizedFile = {
    name: "large-stream.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  const shadowInput = createFileInput({ source: "shadow-root" });
  const { handOffGeminiSanitizedFileUpload, debugEvents, fallbackDrops } = createHandoffHarness({
    shadowInputs: [shadowInput]
  });
  const event = {
    target: {
      nodeType: 1,
      tagName: "P",
      dispatchEvent() {
        throw new Error("Gemini streaming handoff should use file input assignment");
      }
    },
    dataTransfer: createDataTransfer()
  };

  const handedOff = handOffGeminiSanitizedFileUpload(event, null, sanitizedFile);

  assert.strictEqual(handedOff, true);
  assert.strictEqual(shadowInput.files.length, 1);
  assert.strictEqual(shadowInput.files[0], sanitizedFile);
  assert.deepStrictEqual(shadowInput.events, ["input", "change"]);
  assert.strictEqual(fallbackDrops.length, 0);
  assert.ok(
    debugEvents.some((entry) => entry.label === "file-handoff:assignment-success"),
    "expected Gemini streaming handoff to assign sanitized file input"
  );
}

async function testGeminiDropDoesNotDiscoverEnabledInput() {
  const disabledInput = createFileInput({ disabled: true });
  const shadowInput = createFileInput({ source: "shadow-root" });
  const sanitizedFile = {
    name: "secrets.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  const { handOffSanitizedLocalFile } = createHandoffHarness({
    fileInputs: [disabledInput],
    shadowInputs: [shadowInput]
  });
  const event = {
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer()
  };

  const handedOff = handOffSanitizedLocalFile(event, null, sanitizedFile, "drop");

  assert.strictEqual(handedOff, false);
  assert.strictEqual(disabledInput.files.length, 0);
  assert.strictEqual(shadowInput.files.length, 0);
  assert.deepStrictEqual(shadowInput.events, []);
}

async function testGeminiDropSkipsDiscoveryPerDragSession() {
  const shadowInput = createFileInput({ source: "shadow-root" });
  const sanitizedFile = {
    name: "secrets.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  const { handOffSanitizedLocalFile, stats } = createHandoffHarness({
    shadowInputs: [shadowInput]
  });
  const event = {
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer()
  };

  assert.strictEqual(handOffSanitizedLocalFile(event, null, sanitizedFile, "drop"), false);
  const queriesAfterFirstDrop = stats.documentQueries;
  assert.strictEqual(handOffSanitizedLocalFile(event, null, sanitizedFile, "drop"), false);

  assert.strictEqual(queriesAfterFirstDrop, 0, "expected Gemini drop to skip file input discovery");
  assert.strictEqual(stats.documentQueries, queriesAfterFirstDrop);
}

async function testGeminiDropWithoutInputSkipsUploadHandoff() {
  const sanitizedFile = {
    name: "secrets.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  const { handOffSanitizedLocalFile, debugEvents, fallbackDrops } = createHandoffHarness();
  const event = {
    target: {
      nodeType: 1,
      tagName: "P",
      dispatchEvent() {
        throw new Error("Gemini missing-input handoff must not replay a synthetic drop");
      }
    },
    dataTransfer: createDataTransfer()
  };

  const handedOff = handOffSanitizedLocalFile(event, null, sanitizedFile, "drop");

  assert.strictEqual(handedOff, false);
  assert.strictEqual(fallbackDrops.length, 0);
  assert.ok(
    debugEvents.some((entry) => entry.label === "file-handoff:gemini-file-upload-skipped"),
    "expected Gemini upload handoff skip breadcrumb"
  );
}

async function testGeminiQlEditorPasteIsSanitizedBeforePageHandlers() {
  const rawSecret = "LeakGuardPasteApiKey1234567890";
  const { editor, child } = createGeminiEditor("");
  const { maybeHandlePaste, calls } = createHarness({
    location: { hostname: "gemini.google.com" },
    document: {
      activeElement: editor,
      execCommand(command, _showUi, value) {
        assert.strictEqual(command, "insertText");
        editor.text += value;
        return true;
      }
    }
  });
  const { event, calls: eventCalls } = createClipboardEvent({
    text: `API_KEY=${rawSecret}`,
    target: child
  });

  await maybeHandlePaste(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(eventCalls.preventDefault, 1);
  assert.strictEqual(eventCalls.stopImmediatePropagation, 1);
  assert.strictEqual(editor.focusCalls, 1);
  assert.strictEqual(editor.inputEvents.length, 1);
  assert.strictEqual(editor.text, "API_KEY=[PWM_1]");
  assert.strictEqual(editor.text.includes(rawSecret), false);
  assert.strictEqual(calls.redactions.length, 1);
}

async function testGeminiQlEditorDropTextFileIsSanitizedAndInserted() {
  const rawSecret = "LeakGuardFileApiKey1234567890";
  const file = createTextFile({
    text: `API_KEY=${rawSecret}`
  });
  const { editor, child } = createGeminiEditor("");
  const { maybeHandleDrop, calls } = createHarness({
    location: { hostname: "gemini.google.com" },
    document: {
      activeElement: editor,
      execCommand(command, _showUi, value) {
        assert.strictEqual(command, "insertText");
        editor.text += value;
        return true;
      }
    }
  });
  const { event, calls: eventCalls } = createEvent({
    dataTransfer: {
      types: ["Files"],
      files: [file],
      items: [],
      dropEffect: "none"
    },
    target: child
  });

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.ok(eventCalls.stopImmediatePropagation >= 1);
  assert.strictEqual(editor.focusCalls, 1);
  assert.strictEqual(editor.inputEvents.length, 1);
  assert.strictEqual(editor.text, "API_KEY=[PWM_1]");
  assert.strictEqual(editor.text.includes(rawSecret), false);
  assert.strictEqual(calls.handoffs.length, 0);
  assert.strictEqual(calls.dragDetections, 0);
  assert.strictEqual(calls.redactions.length, 1);
}

async function testLargeGeminiDropUsesDirectSanitizedInsertion() {
  const rawSecret = "LeakGuardFileApiKey1234567890";
  const largeText = buildLargeGeminiPayload({
    minBytes: 15 * 1024,
    rawSecret
  });
  const sanitizedLargeText = largeText.replace(
    /LeakGuard(?:Drop|Paste|File)ApiKey1234567890/g,
    "[PWM_1]"
  );
  const file = createTextFile({
    name: "large.env",
    text: largeText
  });
  const { editor, child } = createGeminiEditor("Review this:\n");
  editor.selection = { start: "Review this:\n".length, end: "Review this:\n".length };
  let redactionCompleted = false;
  editor.onTextContentSet = (value) => {
    assert.strictEqual(redactionCompleted, true, "Gemini text must be redacted before insertion");
    assert.strictEqual(value.includes(rawSecret), false, "raw file content must not be inserted");
  };
  class TestInputEvent extends Event {
    constructor(type, init = {}) {
      super(type, init);
      this.inputType = init.inputType;
      this.data = init.data;
    }
  }
  let execCommandCalls = 0;
  let dropEvent = null;
  const { maybeHandleDrop, calls, getSuppressInputScanUntil, isProgrammaticInputScanSuppressed } = createHarness({
    location: { hostname: "gemini.google.com" },
    InputEvent: TestInputEvent,
    readLocalTextFileFromDataTransfer: async (transfer) => {
      assert.strictEqual(dropEvent.defaultPrevented, true, "raw drop should be blocked before file read");
      calls.reads.push(transfer);
      return {
        handled: true,
        ok: true,
        text: largeText,
        file: {
          name: "large.env",
          type: "text/plain"
        }
      };
    },
    requestRedaction: async (text, findings) => {
      calls.redactions.push({ text, findings });
      redactionCompleted = true;
      return {
        redactedText: sanitizedLargeText
      };
    },
    document: {
      activeElement: editor,
      execCommand() {
        execCommandCalls += 1;
        throw new Error("large Gemini insertion should bypass execCommand");
      },
      createRange: () => null
    }
  });
  const { event } = createEvent({
    dataTransfer: {
      types: ["Files"],
      files: [file],
      items: [],
      dropEffect: "none"
    },
    target: child
  });
  dropEvent = event;

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(execCommandCalls, 0);
  assert.strictEqual(calls.reads.length, 1);
  assert.strictEqual(calls.redactions.length, 1);
  assert.strictEqual(calls.largeTextConfirmations?.length || 0, 0);
  assert.strictEqual(editor.inputEvents.length, 1);
  assert.strictEqual(editor.inputEvents[0].inputType, "insertReplacementText");
  assert.strictEqual(editor.inputEvents[0].data, null);
  assert.notStrictEqual(editor.inputEvents[0].data, sanitizedLargeText);
  assert.strictEqual(editor.textContentWrites, 1);
  assert.deepStrictEqual(editor.inputAssistAtWrite, {
    spellcheckAttribute: "false",
    spellcheckProperty: false,
    autocorrect: "off",
    autocomplete: "off",
    autocapitalize: "off"
  });
  assert.strictEqual(editor.getAttribute("spellcheck"), "true");
  assert.strictEqual(editor.getAttribute("autocorrect"), "on");
  assert.strictEqual(editor.getAttribute("autocomplete"), "on");
  assert.strictEqual(editor.getAttribute("autocapitalize"), "sentences");
  assert.strictEqual(editor.spellcheck, true);
  assert.strictEqual(editor.text.includes(rawSecret), false);
  assert.strictEqual((editor.text.match(/\[PWM_1\]/g) || []).length, 2);
  assert.strictEqual(editor.text.includes("[PWM_2]"), false);
  assert.strictEqual(editor.text, `Review this:\n${sanitizedLargeText}`);
  assert.strictEqual(editor.text.startsWith("Review this:\nBefore the secret"), true);
  assert.strictEqual(calls.textFallbacks.length, 0);
  assert.strictEqual(calls.handoffs.length, 0);
  assert.ok(
    calls.debugEvents.some((entry) => entry.label === "gemini-text:direct-large-insert"),
    "expected direct large Gemini insertion breadcrumb"
  );
  assert.ok(getSuppressInputScanUntil() > Date.now(), "large insertion should suppress follow-up scans");
  assert.strictEqual(
    isProgrammaticInputScanSuppressed(),
    true,
    "programmatic scan suppression should prevent re-entrant self-processing"
  );
}

async function testVeryLargeGeminiDropDoesNotUseEventOrCommandLoops() {
  const rawSecret = "LeakGuardFileApiKey1234567890";
  const largeText = buildLargeGeminiPayload({
    minBytes: 500 * 1024,
    rawSecret
  });
  const sanitizedLargeText = largeText.replace(
    /LeakGuard(?:Drop|Paste|File)ApiKey1234567890/g,
    "[PWM_1]"
  );
  const file = createTextFile({
    name: "very-large.env",
    text: largeText
  });
  const { editor, child } = createGeminiEditor("");
  class TestInputEvent extends Event {
    constructor(type, init = {}) {
      super(type, init);
      this.inputType = init.inputType;
      this.data = init.data;
    }
  }
  let execCommandCalls = 0;
  const { maybeHandleDrop, calls, getSuppressInputScanUntil } = createHarness({
    location: { hostname: "gemini.google.com" },
    InputEvent: TestInputEvent,
    readLocalTextFileFromDataTransfer: async (transfer) => {
      assert.strictEqual(transfer.files[0], file);
      calls.reads.push(transfer);
      return {
        handled: true,
        ok: true,
        text: largeText,
        file: {
          name: "very-large.env",
          type: "text/plain"
        }
      };
    },
    requestRedaction: async (text, findings) => {
      calls.redactions.push({ text, findings });
      return {
        redactedText: sanitizedLargeText
      };
    },
    document: {
      activeElement: editor,
      execCommand(command, _showUi, value) {
        execCommandCalls += 1;
        assert.notStrictEqual(value, sanitizedLargeText, "huge sanitized text must not go through execCommand");
        return false;
      },
      createRange: () => null
    }
  });
  const { event, calls: eventCalls } = createEvent({
    dataTransfer: {
      types: ["Files"],
      files: [file],
      items: [],
      dropEffect: "none"
    },
    target: child
  });

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.ok(eventCalls.stopImmediatePropagation >= 1);
  assert.strictEqual(calls.reads.length, 1, "file should be read once");
  assert.strictEqual(calls.redactions.length, 1, "large payload should be redacted once");
  assert.strictEqual(calls.largeTextConfirmations.length, 1, "huge payload should require explicit confirmation");
  assert.strictEqual(
    calls.largeTextConfirmations[0][0],
    sanitizedLargeText.length,
    "confirmation should receive only sanitized text length"
  );
  assert.strictEqual(execCommandCalls, 0, "large payload should bypass execCommand entirely");
  assert.strictEqual(editor.textContentWrites, 1, "large payload should be inserted with one DOM write");
  assert.deepStrictEqual(editor.inputAssistAtWrite, {
    spellcheckAttribute: "false",
    spellcheckProperty: false,
    autocorrect: "off",
    autocomplete: "off",
    autocapitalize: "off"
  });
  assert.strictEqual(editor.getAttribute("spellcheck"), "true", "spellcheck attribute should be restored");
  assert.strictEqual(editor.getAttribute("autocorrect"), "on", "autocorrect attribute should be restored");
  assert.strictEqual(editor.getAttribute("autocomplete"), "on", "autocomplete attribute should be restored");
  assert.strictEqual(editor.getAttribute("autocapitalize"), "sentences", "autocapitalize attribute should be restored");
  assert.strictEqual(editor.spellcheck, true, "spellcheck property should be restored");
  assert.strictEqual(editor.inputEvents.length, 1, "large payload should dispatch one input event");
  assert.strictEqual(editor.inputEvents[0].inputType, "insertReplacementText");
  assert.strictEqual(editor.inputEvents[0].data, null, "large input event must not carry the file body");
  assert.strictEqual(calls.textFallbacks.length, 0, "large path should not use line/character paste fallback loops");
  assert.strictEqual(calls.handoffs.length, 0, "Gemini large path should not replay sanitized file upload");
  assert.strictEqual(editor.text, sanitizedLargeText, "large sanitized text should be inserted exactly once");
  assert.strictEqual(editor.text.includes(rawSecret), false);
  assert.strictEqual((editor.text.match(/\[PWM_1\]/g) || []).length, 2);
  assert.ok(getSuppressInputScanUntil() > Date.now(), "large insertion should suppress re-entrant scans");
}

async function testVeryLargeGeminiDropCancelDoesNotInsertText() {
  const rawSecret = "LeakGuardFileApiKey1234567890";
  const largeText = buildLargeGeminiPayload({
    minBytes: 500 * 1024,
    rawSecret
  });
  const sanitizedLargeText = largeText.replace(
    /LeakGuard(?:Drop|Paste|File)ApiKey1234567890/g,
    "[PWM_1]"
  );
  const file = createTextFile({
    name: "very-large.env",
    text: largeText
  });
  const { editor, child } = createGeminiEditor("Existing prompt");
  let execCommandCalls = 0;
  const confirmationLengths = [];
  const { maybeHandleDrop, calls } = createHarness({
    location: { hostname: "gemini.google.com" },
    showGeminiLargeTextConfirmationModal: async (redactedLength) => {
      confirmationLengths.push(redactedLength);
      return { action: "cancel" };
    },
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      return {
        handled: true,
        ok: true,
        text: largeText,
        file: {
          name: "very-large.env",
          type: "text/plain"
        }
      };
    },
    requestRedaction: async (text, findings) => {
      calls.redactions.push({ text, findings });
      return {
        redactedText: sanitizedLargeText
      };
    },
    document: {
      activeElement: editor,
      execCommand() {
        execCommandCalls += 1;
        throw new Error("cancelled large Gemini insertion must not use execCommand");
      },
      createRange: () => null
    }
  });
  const { event } = createEvent({
    dataTransfer: {
      types: ["Files"],
      files: [file],
      items: [],
      dropEffect: "none"
    },
    target: child
  });

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.reads.length, 1, "raw file should still be read locally once");
  assert.strictEqual(calls.redactions.length, 1, "large text must be redacted before confirmation");
  assert.strictEqual(confirmationLengths.length, 1, "large fallback should ask before insertion");
  assert.strictEqual(confirmationLengths[0], sanitizedLargeText.length);
  assert.strictEqual(execCommandCalls, 0);
  assert.strictEqual(editor.textContentWrites, 0, "cancel should leave Gemini editor unchanged");
  assert.strictEqual(editor.inputEvents.length, 0, "cancel should not dispatch Gemini input events");
  assert.strictEqual(editor.text, "Existing prompt");
  assert.strictEqual(editor.text.includes(rawSecret), false);
  assert.ok(
    calls.badges.some(([message]) => message === "Sanitized text insertion cancelled"),
    "cancel should show a short status message"
  );
  assert.ok(
    calls.debugEvents.some((entry) => entry.label === "gemini-text:large-confirmation-cancelled"),
    "cancel path should leave a safe debug breadcrumb"
  );
}

async function testFastLocalFileDropDoesNotShowOptimizationStatus() {
  const rawSecret = "LeakGuardFileApiKey1234567890";
  const text = buildSizedText({ minBytes: 50 * 1024, rawSecret });
  const file = createTextFile({
    name: "fast-zone.env",
    text
  });
  const composer = {
    tagName: "TEXTAREA",
    text: "",
    selection: { start: 0, end: 0 }
  };
  const { maybeHandleDrop, calls } = createHarness({
    location: { hostname: "chatgpt.com" },
    findComposer: () => composer,
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      return {
        handled: true,
        ok: true,
        text,
        file: {
          name: "fast-zone.env",
          type: "text/plain",
          sizeBytes: Buffer.byteLength(text, "utf8")
        }
      };
    }
  });
  const { event } = createEvent({
    dataTransfer: {
      types: ["Files"],
      files: [file],
      items: [],
      dropEffect: "none"
    },
    target: composer
  });

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.redactions.length, 1);
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.handoffs[0].sanitizedFile.text.includes(rawSecret), false);
  assert.strictEqual(
    calls.debugEvents.some((entry) => entry.label === "local-payload:optimization-started"),
    false,
    "fast-zone payload should not show optimization status"
  );
}

async function testOptimizedLocalFileDropShowsStatusAndProcessesSanitizedContent() {
  const rawSecret = "LeakGuardOptimizedZoneApiKey1234567890";
  const text = buildSizedText({ minBytes: 2 * 1024 * 1024 + 128 * 1024, rawSecret });
  const file = createTextFile({
    name: "optimized-zone.log",
    text
  });
  const composer = {
    tagName: "TEXTAREA",
    text: "",
    selection: { start: 0, end: 0 }
  };
  const { maybeHandleDrop, calls } = createHarness({
    location: { hostname: "chatgpt.com" },
    findComposer: () => composer,
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      return {
        handled: true,
        ok: true,
        text,
        file: {
          name: "optimized-zone.log",
          type: "text/plain",
          sizeBytes: Buffer.byteLength(text, "utf8")
        }
      };
    },
    requestRedaction: async (input, findings) => {
      calls.redactions.push({ text: input, findings });
      return {
        redactedText: input.replaceAll(rawSecret, "[PWM_1]")
      };
    }
  });
  const { event } = createEvent({
    dataTransfer: {
      types: ["Files"],
      files: [file],
      items: [],
      dropEffect: "none"
    },
    target: composer
  });

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.redactions.length, 1);
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.handoffs[0].sanitizedFile.text.includes(rawSecret), false);
  assert.ok(calls.handoffs[0].sanitizedFile.text.includes("[PWM_1]"));
  assert.ok(
    calls.debugEvents.some((entry) => entry.label === "local-payload:optimization-started"),
    "optimized-zone payload should show optimization status"
  );
  assert.ok(
    calls.debugEvents.some(
      (entry) => entry.label === "local-payload:optimization-finished" && entry.details.outcome === "complete"
    ),
    "optimized-zone payload should clear optimization status on completion"
  );
  assert.ok(calls.badges.some(([message]) => String(message || "").includes("Optimizing redaction")));
  assert.ok(calls.badges.some(([message]) => String(message || "").includes("Redaction complete")));
}

async function testChatGptOverHardLimitPasteIsBlockedBeforeHandoff() {
  const rawSecret = "LeakGuardOversizePasteApiKey1234567890";
  const text = buildSizedText({ minBytes: 4 * 1024 * 1024 + 64 * 1024, rawSecret });
  const composer = {
    tagName: "TEXTAREA",
    text: "",
    selection: { start: 0, end: 0 }
  };
  const { maybeHandlePaste, calls } = createHarness({
    location: { hostname: "chatgpt.com" },
    findComposer: () => composer,
    requestRedaction: async () => {
      throw new Error("oversized ChatGPT paste must not be redacted or handed off");
    }
  });
  const { event, calls: eventCalls } = createClipboardEvent({
    text,
    target: composer
  });

  await maybeHandlePaste(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.ok(eventCalls.stopImmediatePropagation >= 1);
  assert.strictEqual(calls.redactions.length, 0);
  assert.strictEqual(calls.createdFiles.length, 0);
  assert.strictEqual(calls.handoffs.length, 0);
  assert.strictEqual(calls.textFallbacks.length, 0);
  assert.strictEqual(calls.directTextWrites?.length || 0, 0);
  assert.ok(calls.modals.some(([title]) => title === "Large payload blocked for browser stability"));
  assert.strictEqual(calls.modals.flat().join("\n").includes(rawSecret), false);
}

async function testGeminiOverHardLimitDropIsBlockedBeforeInsertion() {
  const rawSecret = "LeakGuardOversizeGeminiApiKey1234567890";
  const text = buildSizedText({ minBytes: 4 * 1024 * 1024 + 64 * 1024, rawSecret });
  const file = createTextFile({
    name: "oversize-gemini.log",
    text
  });
  const { editor, child } = createGeminiEditor("");
  let execCommandCalls = 0;
  const { maybeHandleDrop, calls } = createHarness({
    location: { hostname: "gemini.google.com" },
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      return {
        handled: true,
        ok: true,
        text,
        file: {
          name: "oversize-gemini.log",
          type: "text/plain",
          sizeBytes: Buffer.byteLength(text, "utf8")
        }
      };
    },
    requestRedaction: async () => {
      throw new Error("oversized Gemini payload must not be redacted or inserted");
    },
    document: {
      activeElement: editor,
      execCommand() {
        execCommandCalls += 1;
        return false;
      },
      createRange: () => null
    }
  });
  const { event } = createEvent({
    dataTransfer: {
      types: ["Files"],
      files: [file],
      items: [],
      dropEffect: "none"
    },
    target: child
  });

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.redactions.length, 0);
  assert.strictEqual(calls.handoffs.length, 0);
  assert.strictEqual(calls.textFallbacks.length, 0);
  assert.strictEqual(editor.text, "");
  assert.strictEqual(editor.textContentWrites, 0);
  assert.strictEqual(editor.inputEvents.length, 0);
  assert.strictEqual(execCommandCalls, 0);
  assert.ok(calls.modals.some(([title]) => title === "Large payload blocked for browser stability"));
  assert.strictEqual(calls.modals.flat().join("\n").includes(rawSecret), false);
}

async function testDropOverHardLimitUsesStreamingSanitizedFileHandoff() {
  const sourceFile = {
    name: "large-stream.env",
    type: "text/plain",
    size: 5 * 1024 * 1024,
    async text() {
      throw new Error("streaming drop must not call file.text()");
    },
    async arrayBuffer() {
      throw new Error("streaming drop must not call file.arrayBuffer()");
    }
  };
  const composer = {
    tagName: "TEXTAREA",
    text: "",
    selection: { start: 0, end: 0 }
  };
  const sanitizedFile = {
    name: "large-stream.env",
    type: "text/plain",
    text: "API_KEY=[PWM_1]"
  };
  const { maybeHandleDrop, calls } = createHarness({
    findComposer: () => composer,
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      return {
        handled: true,
        ok: false,
        code: "streaming_required",
        sourceFile,
        file: {
          name: sourceFile.name,
          type: sourceFile.type,
          sizeBytes: sourceFile.size
        }
      };
    },
    StreamingFileRedactor: {
      LARGE_TEXT_STREAMING_MAX_BYTES: 50 * 1024 * 1024,
      STREAMING_BLOCK_TITLE: "File too large for local redaction",
      STREAMING_BLOCK_MESSAGE:
        "This file is over 50 MB. LeakGuard blocked the upload because it cannot safely sanitize it yet.",
      redactTextFileStream: async (file, options) => {
        assert.strictEqual(file, sourceFile);
        options.onProgress?.({ bytesProcessed: sourceFile.size, totalBytes: sourceFile.size });
        return {
          action: "redacted",
          sanitizedFile,
          findingsCount: 1,
          bytesProcessed: sourceFile.size
        };
      }
    }
  });
  const { event } = createEvent({
    dataTransfer: {
      types: ["Files"],
      files: [sourceFile],
      items: [],
      dropEffect: "none"
    },
    target: composer
  });

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.redactions.length, 0, "large streaming path should not use single-shot redaction");
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.handoffs[0].sanitizedFile, sanitizedFile);
  assert.strictEqual(calls.handoffs[0].context, "drop");
  assert.ok(calls.badges.some(([message]) => String(message || "").includes("Streaming redaction")));
  assert.ok(calls.badges.some(([message]) => message === "LeakGuard attached a sanitized local file."));
}

async function testDropOverFiftyMiBBlocksBeforeStreaming() {
  const sourceFile = {
    name: "too-large-stream.env",
    type: "text/plain",
    size: 51 * 1024 * 1024
  };
  const composer = {
    tagName: "TEXTAREA",
    text: "",
    selection: { start: 0, end: 0 }
  };
  const { maybeHandleDrop, calls } = createHarness({
    findComposer: () => composer,
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      return {
        handled: true,
        ok: false,
        code: "streaming_required",
        sourceFile,
        file: {
          name: sourceFile.name,
          type: sourceFile.type,
          sizeBytes: sourceFile.size
        }
      };
    },
    StreamingFileRedactor: {
      LARGE_TEXT_STREAMING_MAX_BYTES: 50 * 1024 * 1024,
      STREAMING_BLOCK_TITLE: "File too large for local redaction",
      STREAMING_BLOCK_MESSAGE:
        "This file is over 50 MB. LeakGuard blocked the upload because it cannot safely sanitize it yet.",
      redactTextFileStream: async () => ({
        action: "blocked",
        title: "File too large for local redaction",
        error: "This file is over 50 MB. LeakGuard blocked the upload because it cannot safely sanitize it yet.",
        bytesProcessed: 0,
        findingsCount: 0
      })
    }
  });
  const { event } = createEvent({
    dataTransfer: {
      types: ["Files"],
      files: [sourceFile],
      items: [],
      dropEffect: "none"
    },
    target: composer
  });

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.handoffs.length, 0);
  assert.ok(calls.modals.some(([title]) => title === "File too large for local redaction"));
  assert.ok(calls.modals.flat().join("\n").includes("over 50 MB"));
}

async function testGeminiTextLikeFileExtensionsAreSanitized() {
  for (const name of ["secrets.env", "notes.txt", "payload.json"]) {
    const rawSecret = "LeakGuardFileApiKey1234567890";
    const file = createTextFile({
      name,
      text: `API_KEY=${rawSecret}`
    });
    const { editor, child } = createGeminiEditor("");
    const { maybeHandleDrop, calls } = createHarness({
      location: { hostname: "gemini.google.com" },
      document: {
        activeElement: editor,
        execCommand(command, _showUi, value) {
          assert.strictEqual(command, "insertText");
          editor.text += value;
          return true;
        }
      }
    });
    const { event } = createEvent({
      dataTransfer: {
        types: ["Files"],
        files: [file],
        items: [],
        dropEffect: "none"
      },
      target: child
    });

    await maybeHandleDrop(event);

    assert.strictEqual(event.defaultPrevented, true, `expected ${name} to be intercepted`);
    assert.strictEqual(editor.text.includes(rawSecret), false, `expected ${name} raw secret removed`);
    assert.ok(editor.text.includes("API_KEY=[PWM_1]"), `expected ${name} sanitized insertion`);
    assert.strictEqual(calls.redactions.length, 1, `expected ${name} redaction`);
  }
}

async function testGeminiTextLikeSanitizerFailureBlocksRawFile() {
  const rawSecret = "LeakGuardFileApiKey1234567890";
  const { editor, child } = createGeminiEditor("");
  const { maybeHandleDrop, calls } = createHarness({
    location: { hostname: "gemini.google.com" },
    requestRedaction: async (text, findings) => {
      calls.redactions.push({ text, findings });
      throw new Error("redaction unavailable");
    },
    document: {
      activeElement: editor,
      execCommand() {
        throw new Error("raw content must not be inserted after sanitizer failure");
      }
    }
  });
  const { event } = createEvent({
    dataTransfer: {
      types: ["Files"],
      files: [
        createTextFile({
          name: "secrets.env",
          text: `API_KEY=${rawSecret}`
        })
      ],
      items: [],
      dropEffect: "none"
    },
    target: child
  });

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(editor.text.includes(rawSecret), false);
  assert.ok(calls.modals.some(([title]) => title === "Raw file upload blocked"));
  assert.strictEqual(calls.modals.flat().join("\n").includes(rawSecret), false);
}

async function testUnsupportedDocumentAndImageFilesPassThroughByDefault() {
  for (const name of [
    "brief.pdf",
    "brief.docx",
    "sheet.xlsx",
    "image.png",
    "photo.jpg",
    "archive.bin"
  ]) {
    const { editor, child } = createGeminiEditor("");
    const { maybeHandleDrop, calls } = createHarness({
      location: { hostname: "gemini.google.com" },
      document: {
        activeElement: editor,
        execCommand() {
          throw new Error(`${name} should not be inserted by LeakGuard`);
        }
      }
    });
    const { event } = createEvent({
      dataTransfer: {
        types: ["Files"],
        files: [
          createTextFile({
            name,
            type: name.endsWith(".png") || name.endsWith(".jpg") ? "image/png" : "application/octet-stream",
            text: "binary"
          })
        ],
        items: [],
        dropEffect: "none"
      },
      target: child
    });

    await maybeHandleDrop(event);

    assert.strictEqual(event.defaultPrevented, false, `expected ${name} to pass through`);
    assert.strictEqual(calls.redactions.length, 0, `expected ${name} not to redact`);
    assert.strictEqual(calls.handoffs.length, 0, `expected ${name} not to hand off`);
    assert.ok(
      calls.badges.some(([message]) => message === "LeakGuard does not inspect this file type yet. Upload allowed."),
      `expected ${name} pass-through notice`
    );
  }
}

async function testUnknownBinaryBlocksInStrictMode() {
  const { editor, child } = createGeminiEditor("");
  const { maybeHandleDrop, calls } = createHarness({
    location: { hostname: "gemini.google.com" },
    getActivePolicy: () => ({ strictUnsupportedFileBlocking: true }),
    document: {
      activeElement: editor,
      execCommand() {
        throw new Error("strict unknown binary must not be inserted");
      }
    }
  });
  const { event } = createEvent({
    dataTransfer: {
      types: ["Files"],
      files: [
        createTextFile({
          name: "payload.bin",
          type: "application/octet-stream",
          text: "binary"
        })
      ],
      items: [],
      dropEffect: "none"
    },
    target: child
  });

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.redactions.length, 0);
  assert.ok(calls.modals.some(([title]) => title === "Raw file upload blocked"));
}

async function testGeminiEditorResolvesContenteditableFallback() {
  const rawSecret = "LeakGuardPasteApiKey1234567890";
  const editor = {
    nodeType: 1,
    tagName: "DIV",
    text: "",
    focusCalls: 0,
    inputEvents: [],
    focus() {
      this.focusCalls += 1;
    },
    dispatchEvent(event) {
      this.inputEvents.push(event);
      return true;
    },
    closest(selector) {
      return selector === '[contenteditable="true"]' ? this : null;
    }
  };
  const child = {
    nodeType: 1,
    tagName: "SPAN",
    closest(selector) {
      return selector === '[contenteditable="true"]' ? editor : null;
    }
  };
  const { maybeHandlePaste } = createHarness({
    location: { hostname: "gemini.google.com" },
    document: {
      activeElement: editor,
      execCommand(command, _showUi, value) {
        assert.strictEqual(command, "insertText");
        editor.text += value;
        return true;
      }
    }
  });
  const { event } = createClipboardEvent({
    text: `API_KEY=${rawSecret}`,
    target: child
  });

  await maybeHandlePaste(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(editor.text, "API_KEY=[PWM_1]");
  assert.strictEqual(editor.text.includes(rawSecret), false);
}

function buildLargeChatGptPastePayload() {
  const repeatedKey = "sk-proj-CHATGPTPASTE111111111111111111111111111111111111111111";
  const dbPassword = "SuperSecretPassword123";
  const awsSecret = "ChatGptPasteSecret1234567890abcdefFAKE";
  const header = [
    `OPENAI_API_KEY=${repeatedKey}`,
    `backup_key=${repeatedKey}`,
    `DATABASE_URL=postgres://admin:${dbPassword}@db.example.com:5432/app`,
    "AWS_ACCESS_KEY_ID=AKIACHATGPTPASTE1234",
    `AWS_SECRET_ACCESS_KEY=${awsSecret}`
  ].join("\n");
  const fillerLine =
    "safe_chatgpt_large_paste_line=0123456789abcdef0123456789abcdef0123456789abcdef\n";
  let filler = "";

  while (Buffer.byteLength(`${header}\n${filler}`, "utf8") < 20 * 1024) {
    filler += fillerLine;
  }

  return {
    text: `${header}\n${filler}`,
    repeatedKey,
    dbPassword,
    awsSecret
  };
}

function redactChatGptPasteFixture(text, repeatedKey, dbPassword, awsSecret) {
  return String(text || "")
    .replaceAll(repeatedKey, "[PWM_1]")
    .replace("postgres://admin:", "postgres://[PWM_2]:")
    .replace(dbPassword, "[PWM_3]")
    .replace(awsSecret, "[PWM_4]");
}

async function testChatGptLargePasteCreatesSanitizedPlainTextFileHandoff() {
  const { text, repeatedKey, dbPassword, awsSecret } = buildLargeChatGptPastePayload();
  const redactedText = redactChatGptPasteFixture(text, repeatedKey, dbPassword, awsSecret);
  const composer = {
    tagName: "TEXTAREA",
    text: "",
    selection: { start: 0, end: 0 }
  };
  let redactionCompleted = false;
  const { maybeHandlePaste, calls } = createHarness({
    location: { hostname: "chatgpt.com" },
    findComposer: () => composer,
    analyzeText: (input) => ({
      normalizedText: input,
      secretFindings:
        input.includes(repeatedKey) || input.includes(dbPassword) || input.includes(awsSecret)
          ? [{ raw: repeatedKey }]
          : [],
      findings:
        input.includes(repeatedKey) || input.includes(dbPassword) || input.includes(awsSecret)
          ? [{ raw: repeatedKey }]
          : [],
      placeholderNormalized: false
    }),
    requestRedaction: async (input, findings) => {
      calls.redactions.push({ text: input, findings });
      redactionCompleted = true;
      return { redactedText };
    },
    handOffSanitizedLocalFile: (event, input, sanitizedFile, context) => {
      assert.strictEqual(redactionCompleted, true, "redaction must finish before ChatGPT handoff");
      assert.strictEqual(sanitizedFile.text.includes(repeatedKey), false);
      assert.strictEqual(sanitizedFile.text.includes(dbPassword), false);
      assert.strictEqual(sanitizedFile.text.includes(awsSecret), false);
      calls.handoffs.push({ event, input, sanitizedFile, context });
      return true;
    }
  });
  const { event, calls: eventCalls } = createClipboardEvent({
    text,
    target: composer
  });

  await maybeHandlePaste(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.ok(eventCalls.stopImmediatePropagation >= 1);
  assert.strictEqual(calls.redactions.length, 1);
  assert.strictEqual(calls.createdFiles.length, 1);
  assert.strictEqual(calls.createdFiles[0].file.name, "leakguard-redacted-paste.txt");
  assert.strictEqual(calls.createdFiles[0].file.type, "text/plain");
  assert.strictEqual(calls.createdFiles[0].text, redactedText);
  assert.strictEqual(calls.createdFiles[0].text.includes(repeatedKey), false);
  assert.strictEqual(calls.createdFiles[0].text.includes(dbPassword), false);
  assert.strictEqual(calls.createdFiles[0].text.includes(awsSecret), false);
  assert.ok(calls.createdFiles[0].text.includes("OPENAI_API_KEY=[PWM_1]"));
  assert.ok(calls.createdFiles[0].text.includes("backup_key=[PWM_1]"));
  assert.ok(
    /DATABASE_URL=postgres:\/\/\[PWM_2\]:\[PWM_3\]@db\.example\.com:5432\/app/.test(
      calls.createdFiles[0].text
    )
  );
  assert.ok(calls.createdFiles[0].text.includes("AWS_SECRET_ACCESS_KEY=[PWM_4]"));
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.handoffs[0].context, "paste");
  assert.strictEqual(calls.handoffs[0].input, composer);
  assert.strictEqual(calls.handoffs[0].sanitizedFile.name, "leakguard-redacted-paste.txt");
  assert.strictEqual(calls.handoffs[0].sanitizedFile.type, "text/plain");
  assert.strictEqual(calls.textFallbacks.length, 0);
  assert.strictEqual(calls.directTextWrites?.length || 0, 0);
  assert.strictEqual(composer.text, "");
  assert.ok(
    calls.badges.some(([message]) => message === "LeakGuard redacted pasted text before attachment.")
  );
}

async function testChatGptLargePasteFallsBackToSanitizedTextOnlyWhenFileHandoffFails() {
  const { text, repeatedKey, dbPassword, awsSecret } = buildLargeChatGptPastePayload();
  const redactedText = redactChatGptPasteFixture(text, repeatedKey, dbPassword, awsSecret);
  const composer = {
    tagName: "TEXTAREA",
    text: "Before:\n",
    selection: { start: "Before:\n".length, end: "Before:\n".length }
  };
  const { maybeHandlePaste, calls } = createHarness({
    location: { hostname: "chat.openai.com" },
    findComposer: () => composer,
    analyzeText: (input) => ({
      normalizedText: input,
      secretFindings:
        input.includes(repeatedKey) || input.includes(dbPassword) || input.includes(awsSecret)
          ? [{ raw: repeatedKey }]
          : [],
      findings:
        input.includes(repeatedKey) || input.includes(dbPassword) || input.includes(awsSecret)
          ? [{ raw: repeatedKey }]
          : [],
      placeholderNormalized: false
    }),
    requestRedaction: async (input, findings) => {
      calls.redactions.push({ text: input, findings });
      return { redactedText };
    },
    handOffSanitizedLocalFile: (event, input, sanitizedFile, context) => {
      calls.handoffs.push({ event, input, sanitizedFile, context });
      return false;
    }
  });
  const { event } = createClipboardEvent({
    text,
    target: composer
  });

  await maybeHandlePaste(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.redactions.length, 1);
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.textFallbacks.length, 0, "large fallback should avoid paste-decision event data");
  assert.strictEqual(calls.directTextWrites.length, 1);
  assert.strictEqual(calls.directTextWrites[0].text.includes(repeatedKey), false);
  assert.strictEqual(calls.directTextWrites[0].text.includes(dbPassword), false);
  assert.strictEqual(calls.directTextWrites[0].text.includes(awsSecret), false);
  assert.strictEqual(composer.text.includes(repeatedKey), false);
  assert.strictEqual(composer.text.includes(dbPassword), false);
  assert.strictEqual(composer.text.includes(awsSecret), false);
  assert.ok(composer.text.startsWith("Before:\n"));
  assert.ok(composer.text.includes("OPENAI_API_KEY=[PWM_1]"));
  assert.ok(composer.text.includes("backup_key=[PWM_1]"));
}

async function testNonChatGptLargePasteDoesNotUsePlainTextFileHandoff() {
  const { text, repeatedKey, dbPassword, awsSecret } = buildLargeChatGptPastePayload();
  const composer = {
    tagName: "TEXTAREA",
    text: "",
    selection: { start: 0, end: 0 }
  };
  const { maybeHandleChatGptLargeTextPaste, calls } = createHarness({
    location: { hostname: "claude.ai" },
    findComposer: () => composer,
    analyzeText: (input) => ({
      normalizedText: input,
      secretFindings:
        input.includes(repeatedKey) || input.includes(dbPassword) || input.includes(awsSecret)
          ? [{ raw: repeatedKey }]
          : [],
      findings:
        input.includes(repeatedKey) || input.includes(dbPassword) || input.includes(awsSecret)
          ? [{ raw: repeatedKey }]
          : [],
      placeholderNormalized: false
    })
  });
  const { event } = createClipboardEvent({
    text,
    target: composer
  });
  const handled = await maybeHandleChatGptLargeTextPaste(event, composer, text, {
    findings: [{ raw: repeatedKey }],
    secretFindings: [{ raw: repeatedKey }],
    placeholderNormalized: false
  });

  assert.strictEqual(handled, false);
  assert.strictEqual(event.defaultPrevented, false);
  assert.strictEqual(calls.createdFiles.length, 0);
  assert.strictEqual(calls.handoffs.length, 0);
  assert.strictEqual(calls.directTextWrites?.length || 0, 0);
}

async function testSmallChatGptPasteDoesNotUsePlainTextFileHandoff() {
  const composer = {
    tagName: "TEXTAREA",
    text: "",
    selection: { start: 0, end: 0 }
  };
  const { maybeHandlePaste, calls } = createHarness({
    location: { hostname: "chatgpt.com" },
    findComposer: () => composer
  });
  const { event } = createClipboardEvent({
    text: "Small safe paste",
    target: composer
  });

  await maybeHandlePaste(event);

  assert.strictEqual(calls.createdFiles.length, 0);
  assert.strictEqual(calls.handoffs.length, 0);
}

async function testGeminiNonEditorPasteAndDropAreIgnoredByEditorHandler() {
  const { maybeHandlePaste, maybeHandleDrop, calls } = createHarness({
    location: { hostname: "gemini.google.com" }
  });
  const paste = createClipboardEvent({
    target: {
      tagName: "DIV",
      closest: () => null
    }
  });
  const drop = createEvent({
    dataTransfer: {
      types: ["text/plain"],
      files: [],
      items: [],
      dropEffect: "none"
    },
    target: {
      tagName: "DIV",
      closest: () => null
    }
  });

  await maybeHandlePaste(paste.event);
  await maybeHandleDrop(drop.event);

  assert.strictEqual(paste.event.defaultPrevented, false);
  assert.strictEqual(drop.event.defaultPrevented, false);
  assert.strictEqual(calls.redactions.length, 0);
  assert.strictEqual(calls.handoffs.length, 0);
}

async function testGeminiSanitizerFailureBlocksRawPasteAndDrop() {
  const rawSecret = "LeakGuardPasteApiKey1234567890";
  const { editor, child } = createGeminiEditor("");
  const { maybeHandlePaste, maybeHandleDrop, calls } = createHarness({
    location: { hostname: "gemini.google.com" },
    requestRedaction: async (text, findings) => {
      calls.redactions.push({ text, findings });
      throw new Error("redaction unavailable");
    },
    document: {
      activeElement: editor,
      execCommand() {
        throw new Error("raw content must not be inserted after sanitizer failure");
      }
    }
  });
  const paste = createClipboardEvent({
    text: `API_KEY=${rawSecret}`,
    target: child
  });
  const drop = createEvent({
    dataTransfer: {
      types: ["Files"],
      files: [
        createTextFile({
          text: "API_KEY=LeakGuardFileApiKey1234567890"
        })
      ],
      items: [],
      dropEffect: "none"
    },
    target: child
  });

  await maybeHandlePaste(paste.event);
  await maybeHandleDrop(drop.event);

  assert.strictEqual(paste.event.defaultPrevented, true);
  assert.strictEqual(drop.event.defaultPrevented, true);
  assert.strictEqual(editor.text.includes(rawSecret), false);
  assert.strictEqual(editor.text.includes("LeakGuardFileApiKey"), false);
  assert.ok(calls.modals.some(([title]) => title === "Raw paste blocked"));
  assert.ok(calls.modals.some(([title]) => title === "Raw file upload blocked"));
  assert.strictEqual(calls.modals.flat().join("\n").includes(rawSecret), false);
}

async function testGeminiDropFallsBackToSanitizedTextWhenUploadRejected() {
  const rawSecret = "LeakGuardDropApiKey1234567890";
  const composer = {
    tagName: "TEXTAREA",
    text: "Review this:\n",
    selection: { start: "Review this:\n".length, end: "Review this:\n".length }
  };
  const { maybeHandleDrop, calls } = createHarness({
    location: { hostname: "gemini.google.com" },
    findComposer: () => composer,
    handOffSanitizedLocalFile: (event, input, sanitizedFile, context) => {
      calls.handoffs.push({ event, input, sanitizedFile, context });
      return false;
    }
  });
  const { event } = createEvent({
    dataTransfer: createDataTransfer(),
    target: { tagName: "DIV" }
  });

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.handoffs.length, 0);
  assert.strictEqual(calls.textFallbacks.length, 1);
  assert.strictEqual(calls.textFallbacks[0].context, "gemini-file-text");
  assert.strictEqual(calls.textFallbacks[0].insertedText.includes(rawSecret), false);
  assert.ok(calls.textFallbacks[0].insertedText.includes("[PWM_1]"));
  assert.strictEqual(composer.text.includes(rawSecret), false);
  assert.ok(composer.text.includes("API_KEY=[PWM_1]"));
  assert.ok(
    calls.badges.some(([message]) => message === "Sanitized content inserted as text")
  );
  assert.strictEqual(calls.modals.length, 0);
}

async function testGeminiHiddenFileDropUsesQlEditorInsertionWithoutUploadHandoff() {
  const rawSecret = "LeakGuardDropApiKey1234567890";
  const { editor, child } = createGeminiEditor("");
  const { maybeHandleDrop, calls } = createHarness({
    location: { hostname: "gemini.google.com" },
    findComposer: () => editor,
    handOffSanitizedLocalFile: (event, input, sanitizedFile, context) => {
      calls.handoffs.push({ event, input, sanitizedFile, context });
      return false;
    },
    document: {
      activeElement: editor,
      execCommand(command, _showUi, value) {
        assert.strictEqual(command, "insertText");
        editor.text += value;
        return true;
      }
    }
  });
  const { event } = createEvent({
    dataTransfer: createDataTransfer({ exposeFiles: false }),
    target: child
  });

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.handoffs.length, 0);
  assert.strictEqual(calls.textFallbacks.length, 0);
  assert.strictEqual(calls.dragDetections, 0);
  assert.strictEqual(editor.focusCalls, 1);
  assert.strictEqual(editor.inputEvents.length, 1);
  assert.ok(editor.text.includes("API_KEY=[PWM_1]"));
  assert.strictEqual(editor.text.includes(rawSecret), false);
}

async function testGeminiTextFallbackFailureNeverLeaksRawContent() {
  const rawSecret = "LeakGuardDropApiKey1234567890";
  const composer = {
    tagName: "TEXTAREA",
    text: "",
    selection: { start: 0, end: 0 }
  };
  const { maybeHandleDrop, calls } = createHarness({
    location: { hostname: "gemini.google.com" },
    findComposer: () => composer,
    handOffSanitizedLocalFile: (event, input, sanitizedFile, context) => {
      calls.handoffs.push({ event, input, sanitizedFile, context });
      return false;
    },
    applyPasteDecision: async (input, originalText, selection, insertedText, context) => {
      calls.textFallbacks.push({ input, originalText, selection, insertedText, context });
      return false;
    }
  });
  const { event } = createEvent({
    dataTransfer: createDataTransfer(),
    target: { tagName: "DIV" }
  });

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.textFallbacks.length, 1);
  assert.strictEqual(calls.textFallbacks[0].insertedText.includes(rawSecret), false);
  assert.strictEqual(composer.text.includes(rawSecret), false);
  assert.ok(calls.modals.some(([title]) => title === "Raw file upload blocked"));
  assert.strictEqual(calls.modals.flat().join("\n").includes(rawSecret), false);
}

async function testChatGptAndClaudeStillUseSanitizedFileHandoffOnly() {
  for (const hostname of ["chatgpt.com", "claude.ai"]) {
    const composer = {
      tagName: "TEXTAREA",
      text: "",
      selection: { start: 0, end: 0 }
    };
    const { maybeHandleDrop, calls } = createHarness({
      location: { hostname },
      findComposer: () => composer
    });
    const { event } = createEvent({
      dataTransfer: createDataTransfer(),
      target: { tagName: "TEXTAREA" }
    });

    await maybeHandleDrop(event);

    assert.strictEqual(calls.handoffs.length, 1, `expected ${hostname} sanitized handoff`);
    assert.strictEqual(calls.textFallbacks.length, 0, `expected no text fallback for ${hostname}`);
    assert.ok(
      calls.badges.some(([message]) => message === "LeakGuard attached a sanitized local file."),
      `expected ${hostname} attachment status`
    );
  }
}

(async () => {
  await testFileDragoverIsAcceptedWithoutComposerTarget();
  await testFileDragoverIsAcceptedWithoutHelperLoaded();
  await testFileDropIsHandledWithoutComposerTarget();
  await testFileDropIsBlockedWithoutHelperLoaded();
  await testFileDropIsConsumedBeforeComposerLookup();
  await testDuplicateDropListenerDoesNotDoubleHandleSameEvent();
  await testFileDropHandlesEarlierPreventDefaultWithoutComposerTarget();
  await testNonFileDragoverIsIgnored();
  await testSanitizedFileHandoffDropIsIgnored();
  await testComposerTargetDropStillPassesComposer();
  await testGeminiDropSkipsSanitizedFileInputHandoff();
  await testGeminiStreamingHandoffUsesDiscoveredFileInput();
  await testGeminiDropDoesNotDiscoverEnabledInput();
  await testGeminiDropSkipsDiscoveryPerDragSession();
  await testGeminiDropWithoutInputSkipsUploadHandoff();
  await testGeminiQlEditorPasteIsSanitizedBeforePageHandlers();
  await testChatGptLargePasteCreatesSanitizedPlainTextFileHandoff();
  await testChatGptLargePasteFallsBackToSanitizedTextOnlyWhenFileHandoffFails();
  await testNonChatGptLargePasteDoesNotUsePlainTextFileHandoff();
  await testSmallChatGptPasteDoesNotUsePlainTextFileHandoff();
  await testGeminiQlEditorDropTextFileIsSanitizedAndInserted();
  await testLargeGeminiDropUsesDirectSanitizedInsertion();
  await testVeryLargeGeminiDropDoesNotUseEventOrCommandLoops();
  await testVeryLargeGeminiDropCancelDoesNotInsertText();
  await testFastLocalFileDropDoesNotShowOptimizationStatus();
  await testOptimizedLocalFileDropShowsStatusAndProcessesSanitizedContent();
  await testChatGptOverHardLimitPasteIsBlockedBeforeHandoff();
  await testGeminiOverHardLimitDropIsBlockedBeforeInsertion();
  await testDropOverHardLimitUsesStreamingSanitizedFileHandoff();
  await testDropOverFiftyMiBBlocksBeforeStreaming();
  await testGeminiTextLikeFileExtensionsAreSanitized();
  await testGeminiTextLikeSanitizerFailureBlocksRawFile();
  await testUnsupportedDocumentAndImageFilesPassThroughByDefault();
  await testUnknownBinaryBlocksInStrictMode();
  await testGeminiEditorResolvesContenteditableFallback();
  await testGeminiNonEditorPasteAndDropAreIgnoredByEditorHandler();
  await testGeminiSanitizerFailureBlocksRawPasteAndDrop();
  await testGeminiDropFallsBackToSanitizedTextWhenUploadRejected();
  await testGeminiHiddenFileDropUsesQlEditorInsertionWithoutUploadHandoff();
  await testGeminiTextFallbackFailureNeverLeaksRawContent();
  await testChatGptAndClaudeStillUseSanitizedFileHandoffOnly();
  console.log("PASS content file drop interception regressions");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
