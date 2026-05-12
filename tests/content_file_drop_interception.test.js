const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");
const contentSource = fs.readFileSync(path.join(repoRoot, "src/content/content.js"), "utf8");
const backgroundSource = fs.readFileSync(path.join(repoRoot, "src/background/core.js"), "utf8");

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
      event.__immediateStopped = true;
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
    analyzeTextWithAiAssist: async (text) => dependencies.analyzeText(text),
    getPolicyForAction: async () => ({
      allowUserOverride: true,
      defaultAction: "redact"
    }),
    handleDestinationPolicy: async () => ({ blocked: false }),
    shouldForceDestinationRedaction: () => false,
    handleHttpSecretPolicy: async () => false,
    isProtectionPauseActiveAfterPolicy: () => false,
    promptForSensitiveContentDecision: async () => "redact",
    requestRedaction: async (text, findings, options) => {
      calls.redactions.push({ text, findings, options });
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
    hasPendingGeminiSanitizedFileHandoff: () => false,
    resolveFileInputForHandoff: () => null,
    handOffSanitizedFileInput: (fileInput, transfer) => {
      calls.originalFileInputHandoffs = calls.originalFileInputHandoffs || [];
      calls.originalFileInputHandoffs.push({ fileInput, transfer });
      fileInput.files = transfer.files;
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
    noteActiveRiskEditor: () => {},
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
      'const LOCAL_FILE_SANITIZED_TEXT_FALLBACK_MESSAGE = "Sanitized content inserted as text because the site did not accept a sanitized file upload.";',
      "const PROGRAMMATIC_INPUT_SUPPRESS_MS = 500;",
      "const CHATGPT_LARGE_PASTE_FILE_THRESHOLD = 16 * 1024;",
      'const CHATGPT_SANITIZED_PASTE_FILE_NAME = "leakguard-redacted-paste.txt";',
      "const GEMINI_DIRECT_TEXT_INSERT_THRESHOLD = 8 * 1024;",
      "const GEMINI_AUTO_INSERT_TEXT_LIMIT = 256 * 1024;",
      "const GEMINI_LARGE_TEXT_SUPPRESS_MS = 2500;",
      "const GEMINI_UPLOAD_INPUT_WAIT_MS = 450;",
      "const LOCAL_TEXT_FAST_MAX_BYTES = 2 * 1024 * 1024;",
      "const LOCAL_TEXT_OPTIMIZED_MAX_BYTES = 4 * 1024 * 1024;",
      "const LOCAL_TEXT_HARD_BLOCK_BYTES = 4 * 1024 * 1024;",
      'const LOCAL_TEXT_HARD_BLOCK_TITLE = "Large payload blocked for browser stability";',
      'const LOCAL_TEXT_HARD_BLOCK_MESSAGE = "This content is over 4 MB. LeakGuard did not process or send it automatically to avoid browser instability. Split the file into smaller parts, or sanitize it separately before upload.";',
      "let suppressInputScanUntil = 0;",
      extractFunctionSource(contentSource, "consumeInterceptionEvent"),
      extractFunctionSource(contentSource, "dataTransferLooksLikeFiles"),
      extractFunctionSource(contentSource, "listLocalTransferFiles"),
      extractFunctionSource(contentSource, "snapshotLocalFileDataTransfer"),
      extractFunctionSource(contentSource, "hashLocalString"),
      extractFunctionSource(contentSource, "getGeminiDropSessionHash"),
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
      extractFunctionSource(contentSource, "isGrokHost"),
      extractFunctionSource(contentSource, "shouldHandleChatGptLargeTextPaste"),
      extractFunctionSource(contentSource, "createSanitizedChatGptPasteFile"),
      extractFunctionSource(contentSource, "applyChatGptLargePasteTextFallback"),
      extractFunctionSource(contentSource, "maybeHandleChatGptLargeTextPaste"),
      extractFunctionSource(contentSource, "resolveGeminiEditorTarget"),
      extractFunctionSource(contentSource, "resolveGeminiFallbackEditor"),
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
      extractFunctionSource(contentSource, "markSanitizedFileHandoffEvent"),
      extractFunctionSource(contentSource, "createSanitizedDataTransfer"),
      extractFunctionSource(contentSource, "attachEventDataTransfer"),
      extractFunctionSource(contentSource, "dispatchSanitizedFileEvent"),
      extractFunctionSource(contentSource, "isFileInputElement"),
      extractFunctionSource(contentSource, "handOffOriginalLocalFile"),
      extractFunctionSource(contentSource, "describeFileForDebug"),
      extractFunctionSource(contentSource, "applyGeminiSanitizedTextFallback"),
      extractFunctionSource(contentSource, "applySanitizedTextFallback"),
      extractFunctionSource(contentSource, "readSanitizedFileTextForFallback"),
      extractFunctionSource(contentSource, "insertGeminiLocalFileText"),
      extractFunctionSource(contentSource, "maybeHandleLocalFileInsert"),
      extractFunctionSource(contentSource, "maybeHandlePaste"),
      extractFunctionSource(contentSource, "maybeHandleDrop"),
      extractFunctionSource(contentSource, "maybeHandleFileDrag"),
      "const sanitizedFileInputHandoffs = new WeakSet();",
      'let lastGeminiDropSessionHash = "";',
      extractFunctionSource(contentSource, "maybeHandleFileInputChange"),
      "return { maybeHandleChatGptLargeTextPaste, maybeHandlePaste, maybeHandleDrop, maybeHandleFileDrag, maybeHandleFileInputChange, getSuppressInputScanUntil: () => suppressInputScanUntil, isProgrammaticInputScanSuppressed };"
    ].join("\n\n")
  );
  const handlers = factory(...Object.values(dependencies));

  return {
    ...handlers,
    calls,
    activeElement
  };
}

function createFileInput({ source = "light-dom", disabled = false, multiple = false, inGeminiUploader = false } = {}) {
  const events = [];
  const eventObjects = [];
  return {
    tagName: "INPUT",
    type: "file",
    disabled,
    hidden: source !== "light-dom",
    accept: ".env,text/plain",
    multiple,
    files: [],
    events,
    eventObjects,
    closest(selector) {
      return selector === "images-files-uploader" && inGeminiUploader
        ? { tagName: "IMAGES-FILES-UPLOADER" }
        : null;
    },
    dispatchEvent(event) {
      events.push(event.type);
      eventObjects.push(event);
      return true;
    }
  };
}

function createUploadTrigger({ ariaLabel = "Open upload file menu", className = "upload-card", onClick = null } = {}) {
  const events = [];
  return {
    nodeType: 1,
    tagName: "BUTTON",
    className,
    disabled: false,
    events,
    getAttribute(name) {
      if (name === "aria-label") return ariaLabel;
      if (name === "class") return className;
      return "";
    },
    click() {
      events.push("click");
      if (typeof onClick === "function") {
        onClick();
      }
      return true;
    },
    dispatchEvent(event) {
      events.push(event.type);
      if (event.type === "click" && typeof onClick === "function") {
        onClick();
      }
      return true;
    }
  };
}

function createOverlayItem({
  ariaLabel = "Upload files. Documents, data, code files",
  text = "Upload files",
  role = "menuitem",
  className = "mat-mdc-menu-item",
  onClick = null
} = {}) {
  const events = [];
  return {
    nodeType: 1,
    tagName: "BUTTON",
    className,
    role,
    innerText: text,
    textContent: text,
    disabled: false,
    events,
    getAttribute(name) {
      if (name === "aria-label") return ariaLabel;
      if (name === "class") return className;
      if (name === "role") return role;
      return "";
    },
    matches(selector) {
      return selector === '[role="menuitem"]' || selector === "button";
    },
    click() {
      events.push("click");
      if (typeof onClick === "function") {
        onClick();
      }
      return true;
    },
    dispatchEvent(event) {
      events.push(event.type);
      if (event.type === "click" && typeof onClick === "function") {
        onClick();
      }
      return true;
    }
  };
}

function createHandoffHarness({
  hostname = "gemini.google.com",
  fileInputs = [],
  shadowInputs = [],
  uploadTriggers = [],
  overlayItems = []
} = {}) {
  const debugEvents = [];
  const consoleErrors = [];
  const fallbackDrops = [];
  const badges = [];
  const clickHandlers = [];
  const timeoutCallbacks = [];
  const observers = [];
  const clearedTimeouts = [];
  const stats = {
    documentQueries: 0
  };
  class TestEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.bubbles = Boolean(init.bubbles);
      this.cancelable = Boolean(init.cancelable);
      this.composed = Boolean(init.composed);
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

  class TestMouseEvent extends TestEvent {}

  class TestMutationObserver {
    constructor(callback) {
      this.callback = callback;
      this.observed = [];
      this.disconnected = false;
      observers.push(this);
    }

    observe(target, options) {
      this.observed.push({ target, options });
    }

    disconnect() {
      this.disconnected = true;
    }

    trigger() {
      this.callback([]);
    }
  }

  const shadowHosts = shadowInputs.map((input) => ({
    shadowRoot: {
      querySelectorAll(selector) {
        if (selector === "input[type='file']") return [input];
        if (
          selector === 'button[aria-label="Add files"]' ||
          selector === 'button[aria-label="Open upload file menu"]' ||
          selector === '[role="button"][aria-label*="add files" i]' ||
          selector === '[role="button"][aria-label*="upload" i]' ||
          selector === 'button[aria-label*="upload" i]' ||
          selector === 'button[aria-label*="file" i]' ||
          selector === 'button[aria-label*="attach" i]' ||
          selector === "button"
        ) {
          return [];
        }
        if (selector === "*") return [];
        return [];
      }
    }
  }));
  const documentRoot = {
    documentElement: null,
    addEventListener(type, handler) {
      if (type === "click") clickHandlers.push(handler);
    },
    removeEventListener(type, handler) {
      if (type !== "click") return;
      const index = clickHandlers.indexOf(handler);
      if (index !== -1) clickHandlers.splice(index, 1);
    },
    querySelectorAll(selector) {
      stats.documentQueries += 1;
      if (selector === "input[type='file']") return fileInputs;
      if (
        selector === ".cdk-overlay-container" ||
        selector === ".cdk-overlay-pane" ||
        selector === ".mat-mdc-menu-panel" ||
        selector === 'mat-action-list[role="menu"]' ||
        selector === '[role="menuitem"]' ||
        selector === "button"
      ) {
        return selector === "button" ? [...uploadTriggers, ...overlayItems] : overlayItems;
      }
      if (
        selector === 'button[aria-label="Add files"]' ||
        selector === 'button[aria-label="Open upload file menu"]' ||
        selector === '[role="button"][aria-label*="add files" i]' ||
        selector === '[role="button"][aria-label*="upload" i]' ||
        selector === 'button[aria-label*="upload" i]' ||
        selector === 'button[aria-label*="file" i]' ||
        selector === 'button[aria-label*="attach" i]' ||
        selector === "button"
      ) {
        return uploadTriggers;
      }
      if (selector === "*") return shadowHosts;
      return [];
    }
  };

  const dependencies = {
    Node: { ELEMENT_NODE: 1 },
    Event: TestEvent,
    MouseEvent: TestMouseEvent,
    DragEvent: undefined,
    ClipboardEvent: undefined,
    DataTransfer: TestDataTransfer,
    MutationObserver: TestMutationObserver,
    location: { hostname },
    document: documentRoot,
    setBadge: (...args) => badges.push(args),
    hideBadgeSoon: () => {},
    refreshBadgeFromCurrentInput: () => {},
    handleContentError: (error) => {
      throw error;
    },
    setTimeout: (callback, delay = 0) => {
      const id = timeoutCallbacks.length + 1;
      timeoutCallbacks.push({ id, callback, delay });
      if (delay === 0) callback();
      return id;
    },
    clearTimeout: (id) => {
      clearedTimeouts.push(id);
    },
    console: {
      error: (...args) => consoleErrors.push(args)
    },
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
      'let lastGeminiDropSessionHash = "";',
      "const GEMINI_UPLOAD_INPUT_WAIT_MS = 450;",
      "const GEMINI_PENDING_SANITIZED_FILE_HANDOFF_MS = 30000;",
      "let pendingGeminiSanitizedFileHandoff = null;",
      "let pendingGeminiSanitizedFileObserver = null;",
      "let pendingGeminiSanitizedFileTimer = 0;",
      "let pendingGeminiSanitizedFileClickHandler = null;",
      extractFunctionSource(contentSource, "normalizeTarget"),
      extractFunctionSource(contentSource, "isSanitizedFileHandoffEvent"),
      extractFunctionSource(contentSource, "markSanitizedFileHandoffEvent"),
      extractFunctionSource(contentSource, "createSanitizedDataTransfer"),
      extractFunctionSource(contentSource, "createSanitizedDataTransferForHandoff"),
      extractFunctionSource(contentSource, "attachEventDataTransfer"),
      extractFunctionSource(contentSource, "dispatchSanitizedFileEvent").replace(
        "target.dispatchEvent(handoffEvent);",
        "fallbackDrops.push({ target, handoffEvent }); target.dispatchEvent(handoffEvent);"
      ),
      extractFunctionSource(contentSource, "isGeminiHost"),
      extractFunctionSource(contentSource, "isGrokHost"),
      extractFunctionSource(contentSource, "isFileInputElement"),
      extractFunctionSource(contentSource, "describeFileForDebug"),
      extractFunctionSource(contentSource, "describeFileInputForDebug"),
      extractFunctionSource(contentSource, "getSafeTextSnippet"),
      extractFunctionSource(contentSource, "describeElementForDebug"),
      extractFunctionSource(contentSource, "originalFileMetadataFromEvent"),
      extractFunctionSource(contentSource, "createSanitizedFileHandoffDetails"),
      extractFunctionSource(contentSource, "logSanitizedFileHandoffFailure"),
      extractFunctionSource(contentSource, "clearPendingGeminiSanitizedFileHandoff"),
      extractFunctionSource(contentSource, "isLikelyGeminiUploadClickTarget"),
      extractFunctionSource(contentSource, "schedulePendingGeminiSanitizedFileAttempt"),
      extractFunctionSource(contentSource, "describeGeminiHandoffDiscovery"),
      extractFunctionSource(contentSource, "describeGeminiOverlayExposure"),
      extractFunctionSource(contentSource, "attemptPendingGeminiSanitizedFileHandoff"),
      extractFunctionSource(contentSource, "queuePendingGeminiSanitizedFileHandoff"),
      extractFunctionSource(contentSource, "hasPendingGeminiSanitizedFileHandoff"),
      extractFunctionSource(contentSource, "getPendingGeminiSanitizedFileHandoffDebug"),
      extractFunctionSource(contentSource, "describeUploadTriggerForDebug"),
      extractFunctionSource(contentSource, "collectFileInputsFromAncestry"),
      extractFunctionSource(contentSource, "collectFileInputsFromRoot"),
      extractFunctionSource(contentSource, "collectFileHandoffElementsFromRoot"),
      extractFunctionSource(contentSource, "isWithinGeminiImagesFilesUploader"),
      extractFunctionSource(contentSource, "scoreGeminiFileInput"),
      extractFunctionSource(contentSource, "discoverGeminiFileHandoffElements"),
      extractFunctionSource(contentSource, "collectRootsWithOpenShadow"),
      extractFunctionSource(contentSource, "isRejectedGeminiUploadMenuItem"),
      extractFunctionSource(contentSource, "scoreGeminiUploadMenuItem"),
      extractFunctionSource(contentSource, "discoverGeminiUploadOverlayItem"),
      extractFunctionSource(contentSource, "discoverFileInputForHandoff"),
      extractFunctionSource(contentSource, "resolveFileInputForHandoff"),
      extractFunctionSource(contentSource, "waitForGeminiUploadMenuInput"),
      extractFunctionSource(contentSource, "handOffSanitizedFileInput"),
      extractFunctionSource(contentSource, "handOffSanitizedLocalFile"),
      extractFunctionSource(contentSource, "handOffGeminiSanitizedFileUpload"),
      extractFunctionSource(contentSource, "handOffGrokSanitizedFileUpload"),
      "return { handOffSanitizedLocalFile, handOffGeminiSanitizedFileUpload, handOffGrokSanitizedFileUpload, resolveFileInputForHandoff, attemptPendingGeminiSanitizedFileHandoff, hasPendingGeminiSanitizedFileHandoff, getPendingGeminiSanitizedFileHandoffDebug };"
    ].join("\n\n")
  );

  const handlers = factory(...Object.values(dependencies));
  return {
    ...handlers,
    debugEvents,
    consoleErrors,
    fallbackDrops,
    badges,
    clickHandlers,
    timeoutCallbacks,
    clearedTimeouts,
    observers,
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
  assert.notStrictEqual(calls.reads[0], dataTransfer);
  assert.deepStrictEqual(calls.reads[0].files, dataTransfer.files);
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

async function testGeminiDropUsesDiscoveredFileInputHandoff() {
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

  const handedOff = await handOffSanitizedLocalFile(event, null, sanitizedFile, "drop");

  assert.strictEqual(handedOff, true);
  assert.deepStrictEqual(shadowInput.events, ["input", "change"]);
  assert.strictEqual(shadowInput.files.length, 1);
  assert.strictEqual(shadowInput.files[0], sanitizedFile);
  assert.strictEqual(fallbackDrops.length, 0);
  assert.ok(
    debugEvents.some((entry) => entry.label === "file-handoff:assignment-success"),
    "expected Gemini file upload handoff to assign sanitized file input"
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

  const handedOff = await handOffGeminiSanitizedFileUpload(event, null, sanitizedFile);

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

async function testGeminiDropNeverClicksUploadFlowWhenInputAppearsAfterClick() {
  const rawSecret = "LeakGuardDropApiKey1234567890";
  const sanitizedFile = {
    name: "lazy-gemini.env",
    type: "text/plain",
    size: 37,
    text: `API_KEY=[PWM_1]\ntoken_limit=4096`
  };
  const fileInputs = [];
  const overlayItems = [];
  const uploadTrigger = createUploadTrigger({
    ariaLabel: "Open upload file menu",
    className: "upload-card mat-mdc-button",
    onClick: () => {
      if (!overlayItems.length) {
        overlayItems.push(
          createOverlayItem({
            ariaLabel: "Upload files. Documents, data, code files",
            text: "Upload files",
            onClick: () => {
              if (!fileInputs.length) {
                fileInputs.push(createFileInput({ source: "light-dom" }));
              }
            }
          })
        );
      }
    }
  });
  const {
    handOffGeminiSanitizedFileUpload,
    hasPendingGeminiSanitizedFileHandoff,
    debugEvents,
    fallbackDrops,
    consoleErrors,
    badges
  } = createHandoffHarness({
    fileInputs,
    uploadTriggers: [uploadTrigger],
    overlayItems
  });
  const event = {
    type: "drop",
    target: {
      nodeType: 1,
      tagName: "DIV",
      dispatchEvent() {
        throw new Error("Gemini lazy input handoff should not fall back to text/drop replay");
      }
    },
    dataTransfer: createDataTransfer({
      files: [
        {
          name: "lazy-gemini.env",
          type: "text/plain",
          size: 58
        }
      ]
    })
  };

  const handedOff = await handOffGeminiSanitizedFileUpload(event, null, sanitizedFile);

  assert.strictEqual(handedOff, false);
  assert.deepStrictEqual(uploadTrigger.events, []);
  assert.strictEqual(overlayItems.length, 0);
  assert.strictEqual(fileInputs.length, 0);
  assert.strictEqual(fallbackDrops.length, 0);
  assert.strictEqual(consoleErrors.length, 0);
  assert.strictEqual(hasPendingGeminiSanitizedFileHandoff(sanitizedFile), true);
  assert.strictEqual(sanitizedFile.text.includes(rawSecret), false);
  assert.ok(sanitizedFile.text.includes("[PWM_1]"));
  assert.ok(badges.some(([message]) => /Sanitized file ready/.test(message)));
  assert.ok(
    debugEvents.some((entry) => entry.label === "file-handoff:gemini-input-not-found"),
    "expected Gemini drop to fail closed without opening the upload picker"
  );
  assert.ok(
    debugEvents.some((entry) => entry.label === "file-handoff:gemini-pending-queued"),
    "expected Gemini drop to queue a sanitized-only pending handoff"
  );
}

async function testGeminiDropNeverClicksExistingOverlayMenuItem() {
  const sanitizedFile = {
    name: "overlay-gemini.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  const overlayItem = createOverlayItem({
    ariaLabel: "Upload files. Documents, data, code files",
    text: "Upload files",
    onClick: () => {
      throw new Error("Gemini drop must not click existing upload overlay items");
    }
  });
  const {
    handOffGeminiSanitizedFileUpload,
    hasPendingGeminiSanitizedFileHandoff,
    fallbackDrops,
    consoleErrors
  } = createHandoffHarness({
    overlayItems: [overlayItem]
  });
  const event = {
    type: "drop",
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer()
  };

  const handedOff = await handOffGeminiSanitizedFileUpload(event, null, sanitizedFile);

  assert.strictEqual(handedOff, false);
  assert.deepStrictEqual(overlayItem.events, []);
  assert.strictEqual(fallbackDrops.length, 0);
  assert.strictEqual(consoleErrors.length, 0);
  assert.strictEqual(hasPendingGeminiSanitizedFileHandoff(sanitizedFile), true);
}

async function testGeminiPendingDropAssignsSanitizedFileWhenInputLaterAppears() {
  const rawSecret = "LeakGuardDropApiKey1234567890";
  const sanitizedFile = {
    name: "pending-gemini.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  const fileInputs = [];
  const uploadTrigger = createUploadTrigger({
    ariaLabel: "Open upload file menu",
    className: "upload-card mat-mdc-button"
  });
  const {
    handOffGeminiSanitizedFileUpload,
    attemptPendingGeminiSanitizedFileHandoff,
    hasPendingGeminiSanitizedFileHandoff,
    debugEvents,
    fallbackDrops,
    consoleErrors
  } = createHandoffHarness({
    fileInputs,
    uploadTriggers: [uploadTrigger]
  });
  const event = {
    type: "drop",
    target: {
      nodeType: 1,
      tagName: "DIV",
      dispatchEvent() {
        throw new Error("Gemini pending file handoff must not replay a synthetic drop");
      }
    },
    dataTransfer: createDataTransfer({
      files: [
        {
          name: "pending-gemini.env",
          type: "text/plain",
          size: 42
        }
      ]
    })
  };

  const handedOff = await handOffGeminiSanitizedFileUpload(event, null, sanitizedFile);
  fileInputs.push(createFileInput({ source: "light-dom" }));
  const assigned = attemptPendingGeminiSanitizedFileHandoff("test-input-added");

  assert.strictEqual(handedOff, false);
  assert.strictEqual(assigned, true);
  assert.strictEqual(hasPendingGeminiSanitizedFileHandoff(sanitizedFile), false);
  assert.strictEqual(fileInputs[0].files.length, 1);
  assert.strictEqual(fileInputs[0].files[0], sanitizedFile);
  assert.deepStrictEqual(fileInputs[0].events, ["input", "change"]);
  assert.strictEqual(fallbackDrops.length, 0);
  assert.strictEqual(consoleErrors.length, 0);
  assert.strictEqual(JSON.stringify(debugEvents).includes(rawSecret), false);
  assert.ok(
    debugEvents.some((entry) => entry.label === "file-handoff:gemini-pending-assigned"),
    "expected pending Gemini sanitized file to attach when a real input appears"
  );
}

async function testGeminiPendingDropLogsExposureDiagnosticsWithoutRawContent() {
  const rawSecret = "LeakGuardDropApiKey1234567890";
  const sanitizedFile = {
    name: "diagnostic-gemini.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  const overlayItem = createOverlayItem({
    ariaLabel: "Upload files. Documents, data, code files",
    text: "Upload files"
  });
  const uploadTrigger = createUploadTrigger({
    ariaLabel: "Open upload file menu",
    className: "upload-card-button"
  });
  const {
    handOffGeminiSanitizedFileUpload,
    attemptPendingGeminiSanitizedFileHandoff,
    debugEvents,
    fallbackDrops,
    consoleErrors
  } = createHandoffHarness({
    uploadTriggers: [uploadTrigger],
    overlayItems: [overlayItem]
  });
  const event = {
    type: "drop",
    target: {
      nodeType: 1,
      tagName: "P",
      dispatchEvent() {
        throw new Error("Gemini diagnostics must not replay a synthetic drop");
      }
    },
    dataTransfer: createDataTransfer({
      files: [
        {
          name: "diagnostic-gemini.env",
          type: "text/plain",
          size: 42
        }
      ]
    })
  };

  await handOffGeminiSanitizedFileUpload(event, null, sanitizedFile);
  const assigned = attemptPendingGeminiSanitizedFileHandoff("manual-diagnostics");

  assert.strictEqual(assigned, false);
  assert.strictEqual(fallbackDrops.length, 0);
  assert.strictEqual(consoleErrors.length, 0);
  const diagnostic = debugEvents.find(
    (entry) =>
      entry.label === "file-handoff:gemini-pending-input-not-found" &&
      entry.payload.reason === "manual-diagnostics"
  );
  assert.ok(diagnostic, "expected pending not-found diagnostics");
  assert.strictEqual(diagnostic.payload.fileInputCount, 0);
  assert.ok(diagnostic.payload.uploadTriggerCandidates.length >= 1);
  assert.ok(diagnostic.payload.overlay.overlayCandidates.length >= 1);
  assert.strictEqual(JSON.stringify(diagnostic).includes(rawSecret), false);
}

async function testGeminiPendingHandoffStoresSanitizedFileOnly() {
  const rawSecret = "LeakGuardDropApiKey1234567890";
  const sanitizedFile = {
    name: "pending-only.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  const {
    handOffGeminiSanitizedFileUpload,
    getPendingGeminiSanitizedFileHandoffDebug,
    fallbackDrops,
    consoleErrors
  } = createHandoffHarness({
    uploadTriggers: [
      createUploadTrigger({
        ariaLabel: "Open upload file menu"
      })
    ]
  });
  const event = {
    type: "drop",
    target: { nodeType: 1, tagName: "P", dispatchEvent: () => true },
    dataTransfer: createDataTransfer({
      files: [
        {
          name: "pending-only.env",
          type: "text/plain",
          size: 42,
          rawMarker: rawSecret
        }
      ]
    })
  };

  await handOffGeminiSanitizedFileUpload(event, null, sanitizedFile);

  const pending = getPendingGeminiSanitizedFileHandoffDebug();
  assert.ok(pending, "expected pending sanitized handoff");
  assert.deepStrictEqual(
    pending.keys.sort(),
    ["createdAt", "expiresAt", "sanitizedFile", "sessionHash"].sort()
  );
  assert.strictEqual(pending.sanitizedFile, sanitizedFile);
  assert.strictEqual(JSON.stringify(pending.sanitizedFileDebug).includes(rawSecret), false);
  assert.strictEqual(fallbackDrops.length, 0);
  assert.strictEqual(consoleErrors.length, 0);
}

async function testGeminiPendingHandoffExpiresAndCleansUp() {
  const sanitizedFile = {
    name: "expires-gemini.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  const {
    handOffGeminiSanitizedFileUpload,
    hasPendingGeminiSanitizedFileHandoff,
    clickHandlers,
    timeoutCallbacks,
    clearedTimeouts,
    observers,
    debugEvents
  } = createHandoffHarness({
    uploadTriggers: [
      createUploadTrigger({
        ariaLabel: "Open upload file menu"
      })
    ]
  });
  const event = {
    type: "drop",
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer()
  };

  await handOffGeminiSanitizedFileUpload(event, null, sanitizedFile);
  const expiryTimer = timeoutCallbacks.find((entry) => entry.delay === 30000);
  assert.ok(expiryTimer, "expected pending handoff expiry timer");
  assert.strictEqual(hasPendingGeminiSanitizedFileHandoff(sanitizedFile), true);
  assert.strictEqual(clickHandlers.length, 1);
  assert.ok(observers.length >= 1);

  expiryTimer.callback();

  assert.strictEqual(hasPendingGeminiSanitizedFileHandoff(sanitizedFile), false);
  assert.strictEqual(clickHandlers.length, 0);
  assert.ok(clearedTimeouts.includes(expiryTimer.id));
  assert.ok(observers.some((observer) => observer.disconnected));
  assert.ok(
    debugEvents.some(
      (entry) => entry.label === "file-handoff:gemini-pending-cleared" && entry.payload.reason === "expired"
    )
  );
}

async function testGeminiPendingHandoffReplacementClearsOldState() {
  const firstSanitizedFile = {
    name: "first-gemini.env",
    type: "text/plain",
    size: 18,
    text: "FIRST=[PWM_1]"
  };
  const secondSanitizedFile = {
    name: "second-gemini.env",
    type: "text/plain",
    size: 19,
    text: "SECOND=[PWM_2]"
  };
  const {
    handOffGeminiSanitizedFileUpload,
    hasPendingGeminiSanitizedFileHandoff,
    getPendingGeminiSanitizedFileHandoffDebug,
    clickHandlers,
    observers,
    debugEvents
  } = createHandoffHarness({
    uploadTriggers: [
      createUploadTrigger({
        ariaLabel: "Open upload file menu"
      })
    ]
  });
  const event = {
    type: "drop",
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer()
  };

  await handOffGeminiSanitizedFileUpload(event, null, firstSanitizedFile);
  await handOffGeminiSanitizedFileUpload(event, null, secondSanitizedFile);

  const pending = getPendingGeminiSanitizedFileHandoffDebug();
  assert.strictEqual(hasPendingGeminiSanitizedFileHandoff(firstSanitizedFile), false);
  assert.strictEqual(hasPendingGeminiSanitizedFileHandoff(secondSanitizedFile), true);
  assert.strictEqual(pending.sanitizedFile, secondSanitizedFile);
  assert.strictEqual(clickHandlers.length, 1);
  assert.ok(observers.some((observer) => observer.disconnected));
  assert.ok(
    debugEvents.some(
      (entry) => entry.label === "file-handoff:gemini-pending-cleared" && entry.payload.reason === "replaced"
    )
  );
}

async function testGeminiPendingClickObserverDoesNotClickUploadUi() {
  const sanitizedFile = {
    name: "click-observed-gemini.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  const uploadTrigger = createUploadTrigger({
    ariaLabel: "Open upload file menu",
    className: "upload-card-button",
    onClick: () => {
      throw new Error("Pending handoff must observe user clicks, not call click()");
    }
  });
  const {
    handOffGeminiSanitizedFileUpload,
    clickHandlers,
    debugEvents,
    consoleErrors
  } = createHandoffHarness({
    uploadTriggers: [uploadTrigger]
  });
  const event = {
    type: "drop",
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer()
  };

  await handOffGeminiSanitizedFileUpload(event, null, sanitizedFile);
  assert.strictEqual(clickHandlers.length, 1);

  clickHandlers[0]({ target: uploadTrigger });

  assert.deepStrictEqual(uploadTrigger.events, []);
  assert.strictEqual(consoleErrors.length, 0);
  assert.ok(
    debugEvents.some((entry) => entry.label === "file-handoff:gemini-upload-click-observed"),
    "expected click observation without programmatic upload click"
  );
}

function testGeminiUploadHandoffDoesNotRedispatchSyntheticDrop() {
  const source = extractFunctionSource(contentSource, "handOffGeminiSanitizedFileUpload");
  assert.strictEqual(
    source.includes("dispatchSanitizedFileEvent"),
    false,
    "Gemini upload handoff must not redispatch synthetic drop events"
  );
}

function testUrlChangeClearsPendingGeminiHandoff() {
  const source = extractFunctionSource(contentSource, "handleUrlChange");
  assert.ok(
    source.includes('clearPendingGeminiSanitizedFileHandoff("navigation")'),
    "route changes should clear pending Gemini sanitized file handoff"
  );
}

async function testGeminiNonDropUploadFlowMayClickWhenInputAppearsAfterClick() {
  const sanitizedFile = {
    name: "lazy-gemini.env",
    type: "text/plain",
    size: 37,
    text: `API_KEY=[PWM_1]\ntoken_limit=4096`
  };
  const fileInputs = [];
  const overlayItems = [];
  const uploadTrigger = createUploadTrigger({
    ariaLabel: "Open upload file menu",
    className: "upload-card mat-mdc-button",
    onClick: () => {
      if (!overlayItems.length) {
        overlayItems.push(
          createOverlayItem({
            ariaLabel: "Upload files. Documents, data, code files",
            text: "Upload files",
            onClick: () => {
              if (!fileInputs.length) {
                fileInputs.push(createFileInput({ source: "light-dom" }));
              }
            }
          })
        );
      }
    }
  });
  const {
    handOffGeminiSanitizedFileUpload,
    debugEvents,
    fallbackDrops,
    consoleErrors
  } = createHandoffHarness({
    fileInputs,
    uploadTriggers: [uploadTrigger],
    overlayItems
  });
  const event = {
    type: "file-input",
    target: {
      nodeType: 1,
      tagName: "DIV",
      dispatchEvent() {
        throw new Error("Gemini non-drop handoff should use file input assignment");
      }
    },
    dataTransfer: createDataTransfer()
  };

  const handedOff = await handOffGeminiSanitizedFileUpload(event, null, sanitizedFile);

  assert.strictEqual(handedOff, true);
  assert.deepStrictEqual(uploadTrigger.events, ["click"]);
  assert.strictEqual(overlayItems.length, 1);
  assert.strictEqual(fileInputs.length, 1);
  assert.strictEqual(fileInputs[0].files[0], sanitizedFile);
  assert.deepStrictEqual(fileInputs[0].events, ["input", "change"]);
  assert.strictEqual(fallbackDrops.length, 0);
  assert.strictEqual(consoleErrors.length, 0);
  assert.ok(
    debugEvents.some((entry) => entry.label === "file-handoff:assignment-success"),
    "expected non-drop Gemini file upload handoff to assign the dynamically-created input"
  );
}

async function testGeminiUploadOverlayFailureLogsMetadataOnly() {
  const rawSecret = "LeakGuardDropApiKey1234567890";
  const sanitizedFile = {
    name: "13-large-25mb.txt",
    type: "text/plain",
    size: 26213285,
    text: `API_KEY=[PWM_1]\ntoken_limit=4096`
  };
  const overlayItems = [];
  const uploadTrigger = createUploadTrigger({
    ariaLabel: "Open upload file menu",
    className: "upload-card mat-mdc-button",
    onClick: () => {
      if (!overlayItems.length) {
        overlayItems.push(
          createOverlayItem({
            ariaLabel: "Upload files. Documents, data, code files",
            text: "Upload files",
            onClick: () => {}
          })
        );
      }
    }
  });
  const {
    handOffGeminiSanitizedFileUpload,
    hasPendingGeminiSanitizedFileHandoff,
    debugEvents,
    fallbackDrops,
    consoleErrors
  } = createHandoffHarness({
    fileInputs: [],
    uploadTriggers: [uploadTrigger],
    overlayItems
  });
  const event = {
    type: "drop",
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer({
      files: [
        {
          name: "13-large-25mb.txt",
          type: "text/plain",
          size: 26213285
        }
      ]
    })
  };

  const handedOff = await handOffGeminiSanitizedFileUpload(event, null, sanitizedFile);

  assert.strictEqual(handedOff, false);
  assert.deepStrictEqual(uploadTrigger.events, []);
  assert.strictEqual(overlayItems.length, 0);
  assert.strictEqual(fallbackDrops.length, 0);
  assert.strictEqual(consoleErrors.length, 0);
  assert.strictEqual(hasPendingGeminiSanitizedFileHandoff(sanitizedFile), true);
  const queued = debugEvents.find((entry) => entry.label === "file-handoff:gemini-pending-queued");
  assert.ok(queued, "expected metadata-only pending queue breadcrumb");
  assert.strictEqual(queued.payload.sanitizedFile.size, 26213285);
  const serialized = JSON.stringify(queued.payload);
  assert.strictEqual(serialized.includes(rawSecret), false);
  assert.ok(
    debugEvents.some((entry) => entry.label === "file-handoff:gemini-pending-after-input-not-found"),
    "expected Gemini drop to leave sanitized file pending instead of opening the picker"
  );
}

async function testGeminiUploadMenuDirectInputStillWorks() {
  const sanitizedFile = {
    name: "lazy-gemini.env",
    type: "text/plain",
    size: 37,
    text: `API_KEY=[PWM_1]\ntoken_limit=4096`
  };
  const fileInputs = [];
  const uploadTrigger = createUploadTrigger({
    ariaLabel: "Open upload file menu",
    className: "upload-card mat-mdc-button",
    onClick: () => {
      if (!fileInputs.length) {
        fileInputs.push(createFileInput({ source: "light-dom" }));
      }
    }
  });
  const { handOffGeminiSanitizedFileUpload, debugEvents, fallbackDrops } = createHandoffHarness({
    fileInputs,
    uploadTriggers: [uploadTrigger]
  });
  const event = {
    target: {
      nodeType: 1,
      tagName: "DIV",
      dispatchEvent() {
        throw new Error("Gemini lazy input handoff should not fall back to text/drop replay");
      }
    },
    dataTransfer: createDataTransfer()
  };

  const handedOff = await handOffGeminiSanitizedFileUpload(event, null, sanitizedFile);

  assert.strictEqual(handedOff, true);
  assert.deepStrictEqual(uploadTrigger.events, ["click"]);
  assert.strictEqual(fileInputs.length, 1);
  assert.strictEqual(fileInputs[0].files.length, 1);
  assert.strictEqual(fileInputs[0].files[0], sanitizedFile);
  assert.deepStrictEqual(fileInputs[0].events, ["input", "change"]);
  assert.strictEqual(fallbackDrops.length, 0);
  assert.ok(sanitizedFile.text.includes("[PWM_1]"));
  assert.ok(
    debugEvents.some((entry) => entry.label === "file-handoff:assignment-success"),
    "expected lazy Gemini file input assignment to succeed"
  );
}

async function testGeminiUploadButtonHandoffDispatchesInputAndChange() {
  const sanitizedFile = {
    name: "button-gemini.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  const fileInput = createFileInput({ source: "light-dom" });
  const { handOffSanitizedLocalFile } = createHandoffHarness();
  const event = {
    target: fileInput
  };

  const handedOff = await handOffSanitizedLocalFile(event, null, sanitizedFile, "file-input");

  assert.strictEqual(handedOff, true);
  assert.strictEqual(fileInput.files.length, 1);
  assert.strictEqual(fileInput.files[0], sanitizedFile);
  assert.deepStrictEqual(fileInput.events, ["input", "change"]);
  assert.deepStrictEqual(
    fileInput.eventObjects.map((eventObject) => eventObject.composed),
    [true, true],
    "Gemini file input handoff should dispatch composed input/change events"
  );
}

async function testGeminiLargeFileInputWithoutComposerUsesStreamingSanitizedHandoff() {
  const repeatedSecret = "sk-proj-ZZZ111ZZZ111ZZZ111ZZZ111ZZZ111ZZZ111ZZZ111ZZZ111";
  const anotherSecret = "sk-proj-BBB222";
  const rawText = [
    `backup_key=${repeatedSecret}`,
    `repeat_backup_key=${repeatedSecret}`,
    `another_key=${anotherSecret}`,
    "token_limit=4096",
    "password_hint=use a password manager",
    "secret_santa=party"
  ].join("\n");
  const rawFile = createTextFile({
    name: "large-gemini.env",
    text: rawText
  });
  rawFile.size = 12 * 1024 * 1024;
  const fileInput = createFileInput({ source: "shadow-root" });
  fileInput.files = [rawFile];
  fileInput.value = "C:\\fakepath\\large-gemini.env";
  const geminiObservedChanges = [];
  fileInput.dispatchEvent = (dispatchedEvent) => {
    fileInput.events.push(dispatchedEvent.type);
    if (dispatchedEvent.type === "change") {
      geminiObservedChanges.push(Array.from(fileInput.files || []));
    }
    return true;
  };
  const findComposerCalls = [];
  let streamedFile = null;
  const { maybeHandleFileInputChange, calls } = createHarness({
    location: { hostname: "gemini.google.com" },
    findComposer: (target) => {
      findComposerCalls.push(target);
      return null;
    },
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      return {
        handled: true,
        ok: false,
        code: "streaming_required",
        sourceFile: rawFile,
        file: {
          name: rawFile.name,
          type: rawFile.type,
          sizeBytes: rawFile.size
        }
      };
    },
    requestRedaction: async (text, findings) => {
      calls.redactions.push({ text, findings });
      return {
        redactedText: text.replaceAll(repeatedSecret, "[PWM_1]").replaceAll(anotherSecret, "[PWM_2]")
      };
    },
    StreamingFileRedactor: {
      LARGE_TEXT_STREAMING_MAX_BYTES: 50 * 1024 * 1024,
      STREAMING_BLOCK_TITLE: "File too large for local redaction",
      STREAMING_BLOCK_MESSAGE:
        "This file is over 50 MB. LeakGuard blocked the upload because it cannot safely sanitize it yet.",
      redactTextFileStream: async (file, options) => {
        streamedFile = file;
        const result = await options.redactText(rawText);
        return {
          action: "redacted",
          sanitizedFile: {
            name: file.name,
            type: file.type,
            size: result.redactedText.length,
            text: result.redactedText
          },
          bytesProcessed: file.size,
          findingsCount: result.replacements?.length || 2
        };
      }
    },
    handOffSanitizedLocalFile: (event, input, sanitizedFile, context) => {
      calls.handoffs.push({ event, input, sanitizedFile, context });
      assert.strictEqual(event.target, fileInput);
      assert.strictEqual(input, null);
      assert.strictEqual(context, "file-input");
      assert.strictEqual(sanitizedFile.text.includes(repeatedSecret), false);
      assert.strictEqual(sanitizedFile.text.includes(anotherSecret), false);
      fileInput.files = [sanitizedFile];
      fileInput.dispatchEvent({ type: "change", bubbles: true, cancelable: true });
      return true;
    }
  });
  const { event, calls: eventCalls } = createEvent({
    target: fileInput
  });

  await maybeHandleFileInputChange(event);
  if (!event.__immediateStopped) {
    geminiObservedChanges.push(Array.from(fileInput.files || []));
  }

  assert.deepStrictEqual(findComposerCalls, [fileInput]);
  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(eventCalls.stopImmediatePropagation, 1);
  assert.strictEqual(streamedFile, rawFile);
  assert.strictEqual(fileInput.value, "");
  assert.strictEqual(calls.reads.length, 1);
  assert.deepStrictEqual(calls.reads[0].files, [rawFile]);
  assert.strictEqual(calls.redactions.length, 1);
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.handoffs[0].context, "file-input");
  assert.strictEqual(calls.handoffs[0].sanitizedFile.text.includes(repeatedSecret), false);
  assert.strictEqual(calls.handoffs[0].sanitizedFile.text.includes(anotherSecret), false);
  assert.strictEqual(
    (calls.handoffs[0].sanitizedFile.text.match(/\[PWM_1\]/g) || []).length,
    2,
    "repeated raw secrets should reuse the same placeholder in the handed-off file"
  );
  assert.ok(calls.handoffs[0].sanitizedFile.text.includes("another_key=[PWM_2]"));
  assert.ok(calls.handoffs[0].sanitizedFile.text.includes("token_limit=4096"));
  assert.ok(calls.handoffs[0].sanitizedFile.text.includes("password_hint=use a password manager"));
  assert.ok(calls.handoffs[0].sanitizedFile.text.includes("secret_santa=party"));
  assert.strictEqual(calls.textFallbacks.length, 0);
  assert.strictEqual(calls.directTextWrites?.length || 0, 0);
  assert.strictEqual(calls.largeTextConfirmations?.length || 0, 0);
  assert.deepStrictEqual(fileInput.events, ["change"]);
  assert.strictEqual(geminiObservedChanges.length, 1);
  assert.strictEqual(geminiObservedChanges[0][0], calls.handoffs[0].sanitizedFile);
  assert.notStrictEqual(geminiObservedChanges[0][0], rawFile);
  assert.strictEqual(geminiObservedChanges[0][0].text.includes(repeatedSecret), false);
  assert.strictEqual(geminiObservedChanges[0][0].text.includes(anotherSecret), false);
}

async function testNonGeminiFileInputWithoutComposerStillIgnored() {
  const rawFile = createTextFile({
    name: "chatgpt.env",
    text: "API_KEY=LeakGuardFileApiKey1234567890"
  });
  const fileInput = createFileInput();
  fileInput.files = [rawFile];
  const findComposerCalls = [];
  const { maybeHandleFileInputChange, calls } = createHarness({
    location: { hostname: "chatgpt.com" },
    findComposer: (target) => {
      findComposerCalls.push(target);
      return null;
    }
  });
  const { event } = createEvent({
    target: fileInput
  });

  await maybeHandleFileInputChange(event);

  assert.deepStrictEqual(findComposerCalls, [fileInput]);
  assert.strictEqual(event.defaultPrevented, false);
  assert.strictEqual(calls.reads.length, 0);
  assert.strictEqual(calls.redactions.length, 0);
  assert.strictEqual(calls.handoffs.length, 0);
}

async function testChangeListenerUsesCapturePhaseForFileInputInterception() {
  assert.ok(
    /document\.addEventListener\(\s*"change"[\s\S]*maybeHandleFileInputChange\(event\)[\s\S]*true\s*\)/.test(
      contentSource
    ),
    "file input change interception should stay capture-phase"
  );
}

async function testGeminiDropDiscoversEnabledInput() {
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

  const handedOff = await handOffSanitizedLocalFile(event, null, sanitizedFile, "drop");

  assert.strictEqual(handedOff, true);
  assert.strictEqual(disabledInput.files.length, 0);
  assert.strictEqual(shadowInput.files.length, 1);
  assert.strictEqual(shadowInput.files[0], sanitizedFile);
  assert.deepStrictEqual(shadowInput.events, ["input", "change"]);
}

async function testGeminiDropCachesDiscoveryPerDragSession() {
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

  assert.strictEqual(await handOffSanitizedLocalFile(event, null, sanitizedFile, "drop"), true);
  const queriesAfterFirstDrop = stats.documentQueries;
  assert.strictEqual(await handOffSanitizedLocalFile(event, null, sanitizedFile, "drop"), true);

  assert.ok(queriesAfterFirstDrop > 0, "expected Gemini drop to discover file input once");
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

  const handedOff = await handOffSanitizedLocalFile(event, null, sanitizedFile, "drop");

  assert.strictEqual(handedOff, false);
  assert.strictEqual(fallbackDrops.length, 0);
  assert.ok(
    debugEvents.some((entry) => entry.label === "file-handoff:gemini-input-not-found"),
    "expected Gemini upload handoff missing-input breadcrumb"
  );
}

async function testGrokDropUsesDiscoveredFileInputHandoff() {
  const sanitizedFile = {
    name: "grok-secrets.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  const fileInput = createFileInput({ source: "shadow-root" });
  const { handOffSanitizedLocalFile, fallbackDrops, debugEvents } = createHandoffHarness({
    hostname: "grok.com",
    shadowInputs: [fileInput]
  });
  const event = {
    target: {
      nodeType: 1,
      tagName: "DIV",
      dispatchEvent() {
        throw new Error("Grok should prefer native file input assignment when available");
      }
    },
    dataTransfer: createDataTransfer()
  };

  const handedOff = await handOffSanitizedLocalFile(event, null, sanitizedFile, "drop");

  assert.strictEqual(handedOff, true);
  assert.strictEqual(fileInput.files.length, 1);
  assert.strictEqual(fileInput.files[0], sanitizedFile);
  assert.deepStrictEqual(fileInput.events, ["input", "change"]);
  assert.strictEqual(fallbackDrops.length, 0);
  assert.ok(
    debugEvents.some((entry) => entry.label === "file-handoff:assignment-success"),
    "expected Grok handoff to assign sanitized file input"
  );
}

async function testGrokDropCreatesSanitizedFileWithoutComposerTextFallback() {
  const rawSecret = "LeakGuardDropApiKey1234567890";
  const composer = {
    tagName: "TEXTAREA",
    text: "",
    selection: { start: 0, end: 0 }
  };
  const { maybeHandleDrop, calls } = createHarness({
    location: { hostname: "grok.com" },
    findComposer: () => composer,
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      const file = transfer.files[0];
      return {
        handled: true,
        ok: true,
        text: await file.text(),
        file
      };
    }
  });
  const { event } = createEvent({
    dataTransfer: {
      types: ["Files"],
      files: [
        createTextFile({
          name: "grok-secrets.env",
          text: `API_KEY=${rawSecret}\ntoken_limit=4096`
        })
      ],
      items: [],
      dropEffect: "none"
    },
    target: { tagName: "DIV" }
  });

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.redactions.length, 1);
  assert.strictEqual(calls.createdFiles.length, 1);
  assert.strictEqual(calls.createdFiles[0].sanitizedFile.name, "grok-secrets.env");
  assert.strictEqual(calls.createdFiles[0].sanitizedFile.text.includes(rawSecret), false);
  assert.ok(calls.createdFiles[0].sanitizedFile.text.includes("API_KEY=[PWM_1]"));
  assert.ok(calls.createdFiles[0].sanitizedFile.text.includes("token_limit=4096"));
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.handoffs[0].context, "drop");
  assert.strictEqual(calls.textFallbacks.length, 0);
  assert.strictEqual(composer.text, "");
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

async function testGeminiQlEditorPastePauseInsertsRawText() {
  const rawSecret = "LeakGuardPasteApiKey1234567890";
  const rawText = `API_KEY=${rawSecret}`;
  const { editor, child } = createGeminiEditor("");
  const { maybeHandlePaste, calls } = createHarness({
    location: { hostname: "gemini.google.com" },
    isProtectionPauseActiveAfterPolicy: () => true,
    promptForSensitiveContentDecision: async (findings, mode, _policy, input, normalizedText) => {
      throw new Error("paused Gemini paste should not prompt");
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
  const { event, calls: eventCalls } = createClipboardEvent({
    text: rawText,
    target: child
  });

  await maybeHandlePaste(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(eventCalls.stopImmediatePropagation, 1);
  assert.strictEqual(editor.text, rawText, "paused Gemini paste should insert the original text");
  assert.strictEqual(calls.redactions.length, 0, "paused Gemini paste should not request redaction");
  assert.strictEqual(editor.inputEvents.length, 1, "Gemini editor should stay usable after pause");
}

async function testGeminiQlEditorDropTextFileIsSanitizedAndHandedOff() {
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
  assert.strictEqual(editor.focusCalls, 0);
  assert.strictEqual(editor.inputEvents.length, 0);
  assert.strictEqual(editor.text, "");
  assert.strictEqual(editor.text.includes(rawSecret), false);
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.handoffs[0].context, "drop");
  assert.strictEqual(calls.handoffs[0].sanitizedFile.text, "API_KEY=[PWM_1]");
  assert.strictEqual(calls.redactions.length, 1);
  assert.strictEqual(calls.textFallbacks.length, 0);
}

async function testGeminiDropPrefersImagesFilesUploaderMultipleInput() {
  const genericInput = createFileInput({ source: "light-dom" });
  const uploaderInput = createFileInput({
    source: "shadow-root",
    multiple: true,
    inGeminiUploader: true
  });
  const sanitizedFile = {
    name: "secrets.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  const { handOffSanitizedLocalFile } = createHandoffHarness({
    fileInputs: [genericInput],
    shadowInputs: [uploaderInput]
  });
  const event = {
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer()
  };

  const handedOff = await handOffSanitizedLocalFile(event, null, sanitizedFile, "drop");

  assert.strictEqual(handedOff, true);
  assert.strictEqual(genericInput.files.length, 0);
  assert.strictEqual(uploaderInput.files.length, 1);
  assert.strictEqual(uploaderInput.files[0], sanitizedFile);
  assert.deepStrictEqual(uploaderInput.events, ["input", "change"]);
}

async function testGeminiDropCopiesFileSnapshotBeforeAsyncHandoff() {
  const rawFile = createTextFile({
    name: "snapshot.env",
    text: "API_KEY=LeakGuardDropApiKey1234567890"
  });
  let filesAccesses = 0;
  const dataTransfer = {
    types: ["Files"],
    get files() {
      filesAccesses += 1;
      return filesAccesses <= 4 ? [rawFile] : [];
    },
    items: [],
    dropEffect: "none"
  };
  const { maybeHandleDrop, calls } = createHarness({
    location: { hostname: "gemini.google.com" },
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      assert.deepStrictEqual(transfer.files, [rawFile]);
      return {
        handled: true,
        ok: true,
        text: await rawFile.text(),
        file: rawFile
      };
    }
  });
  const { event } = createEvent({
    dataTransfer,
    target: { tagName: "DIV" }
  });

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.reads.length, 1);
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.handoffs[0].sanitizedFile.text.includes("LeakGuardDropApiKey"), false);
}

async function testLargeGeminiDropUsesSanitizedFileHandoff() {
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
  editor.onTextContentSet = (value) => {
    throw new Error(`Gemini file drop must not write editor text: ${value}`);
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
  const { maybeHandleDrop, calls } = createHarness({
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
  assert.strictEqual(editor.inputEvents.length, 0);
  assert.strictEqual(editor.textContentWrites, 0);
  assert.strictEqual(editor.text.includes(rawSecret), false);
  assert.strictEqual(editor.text, "Review this:\n");
  assert.strictEqual(calls.textFallbacks.length, 0);
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.handoffs[0].sanitizedFile.text, sanitizedLargeText);
}

async function testVeryLargeGeminiDropUsesSanitizedFileHandoffWithoutTextLoops() {
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
  const { maybeHandleDrop, calls } = createHarness({
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
  assert.strictEqual(calls.largeTextConfirmations?.length || 0, 0, "file handoff should not require text fallback confirmation");
  assert.strictEqual(execCommandCalls, 0, "large payload should bypass execCommand entirely");
  assert.strictEqual(editor.textContentWrites, 0, "large payload should not be written into Gemini editor");
  assert.strictEqual(editor.inputEvents.length, 0, "large payload should not dispatch editor input events");
  assert.strictEqual(calls.textFallbacks.length, 0, "large path should not use line/character paste fallback loops");
  assert.strictEqual(calls.handoffs.length, 1, "Gemini large path should hand off a sanitized file");
  assert.strictEqual(calls.handoffs[0].sanitizedFile.text, sanitizedLargeText);
  assert.strictEqual(editor.text, "", "large sanitized text should not be inserted into composer");
  assert.strictEqual(editor.text.includes(rawSecret), false);
  assert.strictEqual(calls.handoffs[0].sanitizedFile.text.includes(rawSecret), false);
}

async function testVeryLargeGeminiDropDoesNotUseTextFallbackConfirmation() {
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
  assert.strictEqual(confirmationLengths.length, 0, "native file handoff should not ask for text insertion");
  assert.strictEqual(execCommandCalls, 0);
  assert.strictEqual(editor.textContentWrites, 0, "file handoff should leave Gemini editor unchanged");
  assert.strictEqual(editor.inputEvents.length, 0, "file handoff should not dispatch Gemini input events");
  assert.strictEqual(editor.text, "Existing prompt");
  assert.strictEqual(editor.text.includes(rawSecret), false);
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.handoffs[0].sanitizedFile.text, sanitizedLargeText);
  assert.strictEqual(calls.handoffs[0].sanitizedFile.text.includes(rawSecret), false);
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
        await options.redactText("API_KEY=LeakGuardDropApiKey1234567890");
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
  assert.strictEqual(calls.redactions.length, 1, "large streaming path should redact only through streaming chunks");
  assert.strictEqual(calls.redactions[0].options?.skipBackgroundScan, true);
  assert.strictEqual(calls.redactions[0].options?.auditReason, "streaming_file_redaction");
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.handoffs[0].sanitizedFile, sanitizedFile);
  assert.strictEqual(calls.handoffs[0].context, "drop");
  assert.ok(calls.badges.some(([message]) => String(message || "").includes("Streaming redaction")));
  assert.ok(calls.badges.some(([message]) => message === "LeakGuard attached a sanitized local file."));
}

async function testGeminiStreamingDropBlocksWhenNativeUploadRejected() {
  const rawSecret = "LeakGuardDropApiKey1234567890";
  const sanitizedText = "API_KEY=[PWM_1]\ntoken_limit=4096";
  const sourceFile = {
    name: "large-stream.env",
    type: "text/plain",
    size: 5 * 1024 * 1024,
    async text() {
      throw new Error("streaming Gemini drop must not read raw file text");
    }
  };
  const sanitizedFile = {
    name: "large-stream.env",
    type: "text/plain",
    size: sanitizedText.length,
    async text() {
      return sanitizedText;
    }
  };
  const { editor, child } = createGeminiEditor("");
  const { maybeHandleDrop, calls } = createHarness({
    location: { hostname: "gemini.google.com" },
    findComposer: () => editor,
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
      redactTextFileStream: async (file, options) => {
        assert.strictEqual(file, sourceFile);
        await options.redactText(`API_KEY=${rawSecret}`);
        return {
          action: "redacted",
          sanitizedFile,
          findingsCount: 1,
          bytesProcessed: sourceFile.size
        };
      }
    },
    handOffGeminiSanitizedFileUpload: (event, input, file) => {
      calls.handoffs.push({ event, input, sanitizedFile: file, context: "gemini-file-input" });
      return false;
    }
  });
  const { event } = createEvent({
    dataTransfer: {
      types: ["Files"],
      files: [sourceFile],
      items: [],
      dropEffect: "none"
    },
    target: child
  });

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.textFallbacks.length, 0);
  assert.strictEqual(editor.text.includes(rawSecret), false);
  assert.strictEqual(editor.text, "");
  assert.ok(calls.modals.some(([title]) => title === "Raw file upload blocked"));
  assert.strictEqual(calls.modals.flat().join("\n").includes(rawSecret), false);
}

async function testGeminiStreamingDropAtFiftyMiBUsesSanitizedFileHandoff() {
  const rawSecret = "LeakGuardDropApiKey1234567890";
  const sourceFile = {
    name: "fifty-mib-gemini.env",
    type: "text/plain",
    size: 50 * 1024 * 1024,
    async text() {
      throw new Error("50 MiB Gemini drop must use streaming, not full file.text()");
    },
    async arrayBuffer() {
      throw new Error("50 MiB Gemini drop must not buffer the full file before streaming");
    }
  };
  const sanitizedFile = {
    name: "fifty-mib-gemini.env",
    type: "text/plain",
    size: 36,
    text: "API_KEY=[PWM_1]\ntoken_limit=4096"
  };
  const { editor, child } = createGeminiEditor("");
  const { maybeHandleDrop, calls } = createHarness({
    location: { hostname: "gemini.google.com" },
    findComposer: () => editor,
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
        await options.redactText(`API_KEY=${rawSecret}\ntoken_limit=4096`);
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
    target: child
  });

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.reads.length, 1);
  assert.strictEqual(calls.redactions.length, 1);
  assert.strictEqual(calls.redactions[0].options?.skipBackgroundScan, true);
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.handoffs[0].context, "gemini-file-input");
  assert.strictEqual(calls.handoffs[0].sanitizedFile, sanitizedFile);
  assert.strictEqual(calls.handoffs[0].sanitizedFile.text.includes(rawSecret), false);
  assert.strictEqual(calls.textFallbacks.length, 0);
  assert.strictEqual(editor.text, "");
  assert.strictEqual(calls.modals.some(([title]) => title === "Raw file upload blocked"), false);
}

async function testGeminiStreamingFileInputFallsBackToSanitizedTextWhenUploadRejected() {
  const rawSecret = "LeakGuardFileApiKey1234567890";
  const sanitizedText = "API_KEY=[PWM_1]\ndevelopment_mode=true";
  const sourceFile = {
    name: "large-input.env",
    type: "text/plain",
    size: 5 * 1024 * 1024
  };
  const sanitizedFile = {
    name: "large-input.env",
    type: "text/plain",
    size: sanitizedText.length,
    async text() {
      return sanitizedText;
    }
  };
  const fileInput = createFileInput();
  fileInput.files = [sourceFile];
  fileInput.value = "C:\\fakepath\\large-input.env";
  const composer = {
    tagName: "TEXTAREA",
    text: "",
    selection: { start: 0, end: 0 }
  };
  const { maybeHandleFileInputChange, calls } = createHarness({
    location: { hostname: "gemini.google.com" },
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
      redactTextFileStream: async (file, options) => {
        assert.strictEqual(file, sourceFile);
        await options.redactText(`API_KEY=${rawSecret}`);
        return {
          action: "redacted",
          sanitizedFile,
          findingsCount: 1,
          bytesProcessed: sourceFile.size
        };
      }
    },
    handOffSanitizedLocalFile: (event, input, file, context) => {
      calls.handoffs.push({ event, input, sanitizedFile: file, context });
      return false;
    }
  });
  const { event } = createEvent({
    target: fileInput
  });

  await maybeHandleFileInputChange(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(fileInput.value, "");
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.handoffs[0].context, "file-input");
  assert.strictEqual(calls.textFallbacks.length, 1);
  assert.strictEqual(calls.textFallbacks[0].context, "file-text-fallback");
  assert.strictEqual(calls.textFallbacks[0].insertedText.includes(rawSecret), false);
  assert.ok(composer.text.includes("API_KEY=[PWM_1]"));
  assert.ok(composer.text.includes("development_mode=true"));
  assert.strictEqual(calls.modals.some(([title]) => title === "Raw file upload blocked"), false);
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

function testBackgroundSkipsDuplicateDetectorScanForStreamingChunks() {
  assert.ok(
    contentSource.includes("skipBackgroundScan: true") &&
      contentSource.includes('auditReason: "streaming_file_redaction"'),
    "streaming file redaction should request background detector skip"
  );
  assert.ok(
    backgroundSource.includes("const shouldScanInBackground = !options.skipBackgroundScan") &&
      backgroundSource.includes("skipBackgroundScan: Boolean(message.skipBackgroundScan)"),
    "background redaction should honor streaming skipBackgroundScan flag"
  );
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
    assert.strictEqual(editor.text, "", `expected ${name} not to inject into Gemini editor`);
    assert.strictEqual(calls.handoffs.length, 1, `expected ${name} to use sanitized Gemini file handoff`);
    assert.ok(calls.handoffs[0].sanitizedFile.text.includes("API_KEY=[PWM_1]"), `expected ${name} sanitized file content`);
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

async function testSupportedTextFileHandoffFailureFallsBackToSanitizedText() {
  const rawSecret = "LeakGuardDropApiKey1234567890";
  const file = createTextFile({
    name: "secrets.env",
    text: `API_KEY=${rawSecret}`
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
        text: `API_KEY=${rawSecret}`,
        file: {
          name: "secrets.env",
          type: "text/plain",
          sizeBytes: Buffer.byteLength(`API_KEY=${rawSecret}`, "utf8")
        }
      };
    },
    handOffSanitizedLocalFile: (event, input, sanitizedFile, context) => {
      calls.handoffs.push({ event, input, sanitizedFile, context });
      return false;
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
  assert.strictEqual(calls.textFallbacks.length, 1, "supported text fallback should use redacted content");
  assert.strictEqual(calls.textFallbacks[0].insertedText.includes(rawSecret), false);
  assert.ok(calls.textFallbacks[0].insertedText.includes("API_KEY=[PWM_1]"));
  assert.strictEqual(composer.text.includes(rawSecret), false);
  assert.ok(composer.text.includes("API_KEY=[PWM_1]"));
  assert.strictEqual(calls.modals.some(([title]) => title === "Raw file upload blocked"), false);
  assert.strictEqual(calls.modals.flat().join("\n").includes(rawSecret), false);
}

async function testUnsupportedDocumentAndImageFilesPassThroughByDefault() {
  for (const name of [
    "brief.pdf",
    "brief.docx",
    "archive.zip",
    "sheet.xlsx",
    "image.png",
    "photo.jpg",
    "installer.exe",
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

    assert.strictEqual(event.defaultPrevented, true, `expected ${name} Gemini raw drop to be blocked before policy pass-through`);
    assert.strictEqual(calls.redactions.length, 0, `expected ${name} not to redact`);
    assert.strictEqual(calls.handoffs.length, 0, `expected ${name} not to hand off`);
    assert.strictEqual(editor.inputEvents.length, 0, `expected ${name} not to be marked protected or sanitized`);
    assert.ok(
      calls.badges.some(([message]) => String(message || "").includes("normal upload may continue")),
      `expected ${name} pass-through notice`
    );
    assert.strictEqual(calls.modals.length, 0, `expected ${name} warning not to block native upload`);
  }
}

async function testUnsupportedFileInputWarnsAndKeepsComposerUsable() {
  for (const name of ["brief.pdf", "brief.docx", "archive.zip", "installer.exe", "photo.png"]) {
    const { editor } = createGeminiEditor("Existing prompt");
    const rawFile = createTextFile({
      name,
      type: name.endsWith(".png") ? "image/png" : "application/octet-stream",
      text: "binary"
    });
    const fileInput = createFileInput({ source: "shadow-root" });
    fileInput.files = [rawFile];
    fileInput.value = `C:\\fakepath\\${name}`;
    const { maybeHandleFileInputChange, calls } = createHarness({
      location: { hostname: "gemini.google.com" },
      findComposer: () => editor,
      document: {
        activeElement: editor,
        execCommand() {
          throw new Error(`${name} should not be inserted by LeakGuard`);
        }
      }
    });
    const { event, calls: eventCalls } = createEvent({
      target: fileInput
    });

    await maybeHandleFileInputChange(event);

    assert.strictEqual(event.defaultPrevented, false, `expected ${name} file input to continue`);
    assert.strictEqual(eventCalls.stopImmediatePropagation, 0, `expected ${name} not to be stopped`);
    assert.strictEqual(fileInput.value, `C:\\fakepath\\${name}`, `expected ${name} selection to remain`);
    assert.strictEqual(calls.reads.length, 0, `expected ${name} not to be read`);
    assert.strictEqual(calls.redactions.length, 0, `expected ${name} not to redact`);
    assert.strictEqual(calls.createdFiles.length, 0, `expected ${name} not to create sanitized file`);
    assert.strictEqual(calls.handoffs.length, 0, `expected ${name} not to hand off sanitized file`);
    assert.strictEqual(editor.text, "Existing prompt", `expected ${name} not to alter composer text`);
    assert.strictEqual(editor.inputEvents.length, 0, `expected ${name} composer to remain usable`);
    assert.ok(
      calls.badges.some(([message]) => String(message || "").includes("normal upload may continue")),
      `expected ${name} warning`
    );
    assert.strictEqual(calls.modals.length, 0, `expected ${name} warning not to block native upload`);
  }
}

async function testUnsupportedBinaryIsBlockedBeforeGeminiPolicyPassThrough() {
  const { editor, child } = createGeminiEditor("");
  const { maybeHandleDrop, calls } = createHarness({
    location: { hostname: "gemini.google.com" },
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
  assert.strictEqual(calls.handoffs.length, 0);
  assert.ok(
    calls.badges.some(([message]) => String(message || "").includes("normal upload may continue"))
  );
  assert.strictEqual(calls.modals.length, 0);
}

async function testInvalidUtf8DropWarnsAndHandsBackOriginalFile() {
  const rawFile = createTextFile({
    name: "bad.txt",
    text: "not actually decoded"
  });
  const handedBackEvents = [];
  const dropTarget = {
    tagName: "DIV",
    dispatchEvent(event) {
      handedBackEvents.push(event);
      return true;
    }
  };
  const { maybeHandleDrop, calls } = createHarness({
    location: { hostname: "chatgpt.com" },
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      return {
        handled: false,
        ok: false,
        code: "invalid_utf8",
        message:
          "LeakGuard did not scan or redact this file. Unsupported file types such as PDF, DOCX, images, archives, executables, and binary files are not protected in this release. Normal upload may continue through the site."
      };
    }
  });
  const { event, calls: eventCalls } = createEvent({
    dataTransfer: {
      types: ["Files"],
      files: [rawFile],
      items: [],
      dropEffect: "none"
    },
    target: dropTarget
  });

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.ok(eventCalls.stopImmediatePropagation >= 1);
  assert.strictEqual(calls.reads.length, 1);
  assert.strictEqual(calls.redactions.length, 0);
  assert.strictEqual(calls.createdFiles.length, 0);
  assert.strictEqual(calls.handoffs.length, 0);
  assert.strictEqual(handedBackEvents.length, 1, "consumed invalid UTF-8 drops should be replayed for native upload");
  assert.strictEqual(handedBackEvents[0].__PWM_SANITIZED_FILE_HANDOFF__, true);
  assert.deepStrictEqual(Array.from(handedBackEvents[0].dataTransfer.files || []), [rawFile]);
  assert.ok(
    calls.badges.some(([message]) => String(message || "").includes("normal upload may continue"))
  );
  assert.strictEqual(calls.modals.length, 0);
  assert.strictEqual(calls.modals.flat().join("\n").includes("Local file not attached"), false);
  assert.strictEqual(calls.modals.flat().join("\n").includes("not valid UTF-8"), false);
  assert.strictEqual(calls.modals.flat().join("\n").includes("did not attach"), false);
}

async function testInvalidUtf8DropPrefersOriginalFileInputHandoff() {
  const rawFile = createTextFile({
    name: "bad.txt",
    text: "not actually decoded"
  });
  const fileInput = createFileInput();
  const { maybeHandleDrop, calls } = createHarness({
    location: { hostname: "chatgpt.com" },
    resolveFileInputForHandoff: () => fileInput,
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      return {
        handled: false,
        ok: false,
        code: "invalid_utf8",
        message:
          "LeakGuard did not scan or redact this file. Unsupported file types such as PDF, DOCX, images, archives, executables, and binary files are not protected in this release. Normal upload may continue through the site."
      };
    }
  });
  const { event } = createEvent({
    dataTransfer: {
      types: ["Files"],
      files: [rawFile],
      items: [],
      dropEffect: "none"
    },
    target: {
      tagName: "DIV",
      dispatchEvent() {
        throw new Error("original file input handoff should avoid synthetic drop fallback");
      }
    }
  });

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.reads.length, 1);
  assert.strictEqual(calls.originalFileInputHandoffs.length, 1);
  assert.strictEqual(calls.originalFileInputHandoffs[0].fileInput, fileInput);
  assert.deepStrictEqual(Array.from(calls.originalFileInputHandoffs[0].transfer.files || []), [rawFile]);
  assert.strictEqual(calls.redactions.length, 0);
  assert.strictEqual(calls.createdFiles.length, 0);
  assert.strictEqual(calls.handoffs.length, 0);
  assert.strictEqual(calls.modals.length, 0);
  assert.ok(
    calls.badges.some(([message]) => String(message || "").includes("normal upload may continue"))
  );
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
    .replace(dbPassword, "[PWM_2]")
    .replace(awsSecret, "[PWM_3]");
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
    /DATABASE_URL=postgres:\/\/admin:\[PWM_2\]@db\.example\.com:5432\/app/.test(
      calls.createdFiles[0].text
    )
  );
  assert.ok(calls.createdFiles[0].text.includes("AWS_SECRET_ACCESS_KEY=[PWM_3]"));
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

async function testGeminiDropFallsBackToSanitizedComposerTextWhenNativeUploadUnavailable() {
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
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.textFallbacks.length, 1);
  assert.strictEqual(calls.textFallbacks[0].context, "file-text-fallback");
  assert.strictEqual(composer.text.includes(rawSecret), false);
  assert.ok(composer.text.includes("Review this:\n"));
  assert.ok(composer.text.includes("API_KEY=[PWM_1]"));
  assert.ok(calls.modals.some(([title]) => title === "Sanitized content inserted as text"));
  assert.strictEqual(calls.modals.some(([title]) => title === "Raw file upload blocked"), false);
  assert.strictEqual(calls.modals.flat().join("\n").includes(rawSecret), false);
}

async function testGeminiHiddenFileDropUsesSnapshotThenSanitizedTextFallback() {
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
        return false;
      }
    }
  });
  const { event } = createEvent({
    dataTransfer: createDataTransfer({ exposeFiles: false }),
    target: child
  });

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.handoffs[0].context, "drop");
  assert.strictEqual(calls.textFallbacks.length, 1);
  assert.ok(editor.focusCalls >= 1);
  assert.strictEqual(editor.text, "API_KEY=[PWM_1]");
  assert.strictEqual(editor.text.includes(rawSecret), false);
  assert.strictEqual(calls.modals.some(([title]) => title === "Raw file upload blocked"), false);
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
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.textFallbacks.length, 1);
  assert.strictEqual(calls.textFallbacks[0].insertedText.includes(rawSecret), false);
  assert.ok(calls.textFallbacks[0].insertedText.includes("API_KEY=[PWM_1]"));
  assert.strictEqual(composer.text.includes(rawSecret), false);
  assert.strictEqual(composer.text, "");
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

async function testUserManagedProtectedSiteDropUsesGenericSanitizedHandoff() {
  const rawSecret = "LeakGuardDropApiKey1234567890";
  const composer = {
    tagName: "DIV",
    isContentEditable: true,
    text: "",
    selection: { start: 0, end: 0 }
  };
  const { maybeHandleDrop, calls } = createHarness({
    location: { hostname: "perplexity.ai" },
    findComposer: () => composer
  });
  const { event } = createEvent({
    dataTransfer: {
      types: ["Files"],
      files: [
        createTextFile({
          name: "perplexity.env",
          text: `API_KEY=${rawSecret}`
        })
      ],
      items: [],
      dropEffect: "none"
    },
    target: composer
  });

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.redactions.length, 1);
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.handoffs[0].context, "drop");
  assert.notStrictEqual(calls.handoffs[0].context, "gemini-file-input");
  assert.strictEqual(calls.handoffs[0].sanitizedFile.text.includes(rawSecret), false);
  assert.ok(calls.handoffs[0].sanitizedFile.text.includes("API_KEY=[PWM_1]"));
  assert.strictEqual(calls.textFallbacks.length, 0);
}

async function testUserManagedProtectedSiteDropFallsBackToSanitizedTextWhenHandoffRejected() {
  const rawSecret = "LeakGuardDropApiKey1234567890";
  const composer = {
    tagName: "DIV",
    isContentEditable: true,
    text: "Summarize:\n",
    selection: { start: "Summarize:\n".length, end: "Summarize:\n".length }
  };
  const { maybeHandleDrop, calls } = createHarness({
    location: { hostname: "perplexity.ai" },
    findComposer: () => composer,
    handOffSanitizedLocalFile: (event, input, sanitizedFile, context) => {
      calls.handoffs.push({ event, input, sanitizedFile, context });
      return false;
    }
  });
  const { event } = createEvent({
    dataTransfer: {
      types: ["Files"],
      files: [
        createTextFile({
          name: "perplexity.env",
          text: `API_KEY=${rawSecret}`
        })
      ],
      items: [],
      dropEffect: "none"
    },
    target: composer
  });

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.textFallbacks.length, 1);
  assert.strictEqual(calls.textFallbacks[0].context, "file-text-fallback");
  assert.strictEqual(calls.textFallbacks[0].insertedText.includes(rawSecret), false);
  assert.strictEqual(composer.text.includes(rawSecret), false);
  assert.ok(composer.text.includes("API_KEY=[PWM_1]"));
  assert.strictEqual(calls.modals.some(([title]) => title === "Raw file upload blocked"), false);
}

async function testGenericTextFallbackFailureStillBlocksRawUpload() {
  const rawSecret = "LeakGuardDropApiKey1234567890";
  const composer = {
    tagName: "TEXTAREA",
    text: "",
    selection: { start: 0, end: 0 }
  };
  const { maybeHandleDrop, calls } = createHarness({
    location: { hostname: "chatgpt.com" },
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
    dataTransfer: {
      types: ["Files"],
      files: [
        createTextFile({
          name: "chatgpt.env",
          text: `API_KEY=${rawSecret}`
        })
      ],
      items: [],
      dropEffect: "none"
    },
    target: composer
  });

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.textFallbacks.length, 1);
  assert.strictEqual(calls.textFallbacks[0].insertedText.includes(rawSecret), false);
  assert.strictEqual(composer.text.includes(rawSecret), false);
  assert.strictEqual(composer.text, "");
  assert.ok(calls.modals.some(([title]) => title === "Raw file upload blocked"));
  assert.strictEqual(calls.modals.flat().join("\n").includes(rawSecret), false);
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
  await testGeminiDropUsesDiscoveredFileInputHandoff();
  await testGeminiStreamingHandoffUsesDiscoveredFileInput();
  await testGeminiDropNeverClicksUploadFlowWhenInputAppearsAfterClick();
  await testGeminiDropNeverClicksExistingOverlayMenuItem();
  await testGeminiPendingDropAssignsSanitizedFileWhenInputLaterAppears();
  await testGeminiPendingDropLogsExposureDiagnosticsWithoutRawContent();
  await testGeminiPendingHandoffStoresSanitizedFileOnly();
  await testGeminiPendingHandoffExpiresAndCleansUp();
  await testGeminiPendingHandoffReplacementClearsOldState();
  await testGeminiPendingClickObserverDoesNotClickUploadUi();
  testGeminiUploadHandoffDoesNotRedispatchSyntheticDrop();
  testUrlChangeClearsPendingGeminiHandoff();
  await testGeminiNonDropUploadFlowMayClickWhenInputAppearsAfterClick();
  await testGeminiUploadOverlayFailureLogsMetadataOnly();
  await testGeminiUploadMenuDirectInputStillWorks();
  await testGeminiUploadButtonHandoffDispatchesInputAndChange();
  await testGeminiLargeFileInputWithoutComposerUsesStreamingSanitizedHandoff();
  await testNonGeminiFileInputWithoutComposerStillIgnored();
  await testChangeListenerUsesCapturePhaseForFileInputInterception();
  await testGeminiDropDiscoversEnabledInput();
  await testGeminiDropPrefersImagesFilesUploaderMultipleInput();
  await testGeminiDropCopiesFileSnapshotBeforeAsyncHandoff();
  await testGeminiDropCachesDiscoveryPerDragSession();
  await testGeminiDropWithoutInputSkipsUploadHandoff();
  await testGrokDropUsesDiscoveredFileInputHandoff();
  await testGrokDropCreatesSanitizedFileWithoutComposerTextFallback();
  await testGeminiQlEditorPasteIsSanitizedBeforePageHandlers();
  await testGeminiQlEditorPastePauseInsertsRawText();
  await testChatGptLargePasteCreatesSanitizedPlainTextFileHandoff();
  await testChatGptLargePasteFallsBackToSanitizedTextOnlyWhenFileHandoffFails();
  await testNonChatGptLargePasteDoesNotUsePlainTextFileHandoff();
  await testSmallChatGptPasteDoesNotUsePlainTextFileHandoff();
  await testGeminiQlEditorDropTextFileIsSanitizedAndHandedOff();
  await testLargeGeminiDropUsesSanitizedFileHandoff();
  await testVeryLargeGeminiDropUsesSanitizedFileHandoffWithoutTextLoops();
  await testVeryLargeGeminiDropDoesNotUseTextFallbackConfirmation();
  await testFastLocalFileDropDoesNotShowOptimizationStatus();
  await testOptimizedLocalFileDropShowsStatusAndProcessesSanitizedContent();
  await testChatGptOverHardLimitPasteIsBlockedBeforeHandoff();
  await testGeminiOverHardLimitDropIsBlockedBeforeInsertion();
  await testDropOverHardLimitUsesStreamingSanitizedFileHandoff();
  await testGeminiStreamingDropBlocksWhenNativeUploadRejected();
  await testGeminiStreamingDropAtFiftyMiBUsesSanitizedFileHandoff();
  await testGeminiStreamingFileInputFallsBackToSanitizedTextWhenUploadRejected();
  await testDropOverFiftyMiBBlocksBeforeStreaming();
  testBackgroundSkipsDuplicateDetectorScanForStreamingChunks();
  await testGeminiTextLikeFileExtensionsAreSanitized();
  await testGeminiTextLikeSanitizerFailureBlocksRawFile();
  await testSupportedTextFileHandoffFailureFallsBackToSanitizedText();
  await testUnsupportedDocumentAndImageFilesPassThroughByDefault();
  await testUnsupportedFileInputWarnsAndKeepsComposerUsable();
  await testUnsupportedBinaryIsBlockedBeforeGeminiPolicyPassThrough();
  await testInvalidUtf8DropWarnsAndHandsBackOriginalFile();
  await testInvalidUtf8DropPrefersOriginalFileInputHandoff();
  await testGeminiEditorResolvesContenteditableFallback();
  await testGeminiNonEditorPasteAndDropAreIgnoredByEditorHandler();
  await testGeminiSanitizerFailureBlocksRawPasteAndDrop();
  await testGeminiDropFallsBackToSanitizedComposerTextWhenNativeUploadUnavailable();
  await testGeminiHiddenFileDropUsesSnapshotThenSanitizedTextFallback();
  await testGeminiTextFallbackFailureNeverLeaksRawContent();
  await testChatGptAndClaudeStillUseSanitizedFileHandoffOnly();
  await testUserManagedProtectedSiteDropUsesGenericSanitizedHandoff();
  await testUserManagedProtectedSiteDropFallsBackToSanitizedTextWhenHandoffRejected();
  await testGenericTextFallbackFailureStillBlocksRawUpload();
  console.log("PASS content file drop interception regressions");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
