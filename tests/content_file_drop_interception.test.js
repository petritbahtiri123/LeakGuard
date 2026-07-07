const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");
const contentSource = fs.readFileSync(path.join(repoRoot, "src/content/content.js"), "utf8");
const chatGptComposerSyncSource = fs.readFileSync(
  path.join(repoRoot, "src/content/composer/chatgptComposerSync.js"),
  "utf8"
);
const fileDebugMetadataSource = fs.readFileSync(
  path.join(repoRoot, "src/content/diagnostics/fileDebugMetadata.js"),
  "utf8"
);
const fileProcessingUiSource = fs.readFileSync(
  path.join(repoRoot, "src/content/files/fileProcessingUi.js"),
  "utf8"
);
const fileDropOrchestrationSource = fs.readFileSync(
  path.join(repoRoot, "src/content/files/fileDropOrchestration.js"),
  "utf8"
);
const adapterSourceFiles = [
  "src/content/adapters/chatgptAdapter.js",
  "src/content/adapters/openaiAdapter.js",
  "src/content/adapters/geminiDiagnosticsAdapter.js",
  "src/content/adapters/geminiAdapter.js",
  "src/content/adapters/geminiUploadDiscovery.js",
  "src/content/adapters/claudeAdapter.js",
  "src/content/adapters/grokAdapter.js",
  "src/content/adapters/grokFileHandoff.js",
  "src/content/adapters/xAdapter.js",
  "src/content/adapters/whatsappAdapter.js",
  "src/content/adapters/index.js"
];
const adapterRegistrySource = adapterSourceFiles
  .map((relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8"))
  .join("\n");
const fileHandoffStateSource = fs.readFileSync(
  path.join(repoRoot, "src/content/file_handoff_state.js"),
  "utf8"
);
const fileHandoffPendingSource = fs.readFileSync(
  path.join(repoRoot, "src/content/file_handoff_pending.js"),
  "utf8"
);
const pendingSanitizedFileHandoffSource = fs.readFileSync(
  path.join(repoRoot, "src/content/files/pendingSanitizedFileHandoff.js"),
  "utf8"
);
const fileHandoffFlowSource = fs.readFileSync(
  path.join(repoRoot, "src/content/file_handoff_flow.js"),
  "utf8"
);
const geminiFileHandoffSource = fs.readFileSync(
  path.join(repoRoot, "src/content/adapters/geminiFileHandoff.js"),
  "utf8"
);
const contentEventBindingsSource = fs.readFileSync(
  path.join(repoRoot, "src/content/bootstrap/eventBindings.js"),
  "utf8"
);
const backgroundSource = fs.readFileSync(path.join(repoRoot, "src/background/core.js"), "utf8");
const overlayCssSource = fs.readFileSync(path.join(repoRoot, "src/content/overlay.css"), "utf8");
const MiB = 1024 * 1024;

require(path.join(repoRoot, "src/shared/fileLimits.js"));
require(path.join(repoRoot, "src/content/file_paste_helpers.js"));
require(path.join(repoRoot, "src/content/composer_helpers.js"));
require(path.join(repoRoot, "src/content/input/rewriteVerificationText.js"));
require(path.join(repoRoot, "src/content/composer/chatgptComposerSync.js"));
require(path.join(repoRoot, "src/content/composer/chatgptLargePasteOrchestration.js"));
require(path.join(repoRoot, "src/content/composer/geminiEditorPasteOrchestration.js"));
require(path.join(repoRoot, "src/content/composer/pasteOrchestration.js"));
require(path.join(repoRoot, "src/content/files/fileTransferPolicy.js"));
require(path.join(repoRoot, "src/shared/entropy.js"));
require(path.join(repoRoot, "src/shared/patterns.js"));
require(path.join(repoRoot, "src/shared/detector.js"));
require(path.join(repoRoot, "src/shared/placeholders.js"));
require(path.join(repoRoot, "src/shared/sessionMapStore.js"));
require(path.join(repoRoot, "src/shared/ipClassification.js"));
require(path.join(repoRoot, "src/shared/ipDetection.js"));
require(path.join(repoRoot, "src/shared/networkHierarchy.js"));
require(path.join(repoRoot, "src/shared/placeholderAllocator.js"));
require(path.join(repoRoot, "src/shared/knownSecretReuse.js"));
require(path.join(repoRoot, "src/shared/transformOutboundPrompt.js"));
require(path.join(repoRoot, "src/shared/fileTypeRegistry.js"));
require(path.join(repoRoot, "src/shared/fileExtractors.js"));
require(path.join(repoRoot, "src/content/adapters/hostMatching.js"));
require(path.join(repoRoot, "src/content/adapters/chatgptAdapter.js"));
require(path.join(repoRoot, "src/content/adapters/openaiAdapter.js"));
require(path.join(repoRoot, "src/content/adapters/geminiDiagnosticsAdapter.js"));
require(path.join(repoRoot, "src/content/adapters/geminiAdapter.js"));
require(path.join(repoRoot, "src/content/adapters/geminiUploadDiscovery.js"));
require(path.join(repoRoot, "src/content/adapters/geminiFileHandoff.js"));
require(path.join(repoRoot, "src/content/adapters/claudeAdapter.js"));
require(path.join(repoRoot, "src/content/adapters/grokAdapter.js"));
require(path.join(repoRoot, "src/content/adapters/grokFileHandoff.js"));
require(path.join(repoRoot, "src/content/adapters/xAdapter.js"));
require(path.join(repoRoot, "src/content/adapters/whatsappAdapter.js"));
require(path.join(repoRoot, "src/content/adapters/index.js"));
require(path.join(repoRoot, "src/content/adapters/geminiFallbackWriter.js"));
require(path.join(repoRoot, "src/content/diagnostics/safeSnapshots.js"));
require(path.join(repoRoot, "src/content/diagnostics/fileDebugMetadata.js"));
require(path.join(repoRoot, "src/content/files/fileProcessingUi.js"));
require(path.join(repoRoot, "src/content/diagnostics/debugLogger.js"));
require(path.join(repoRoot, "src/content/files/fileAttachPipeline.js"));
require(path.join(repoRoot, "src/content/file_handoff_flow.js"));
require(path.join(repoRoot, "src/shared/fileScanner.js"));
require(path.join(repoRoot, "src/shared/scannerOcr.js"));
require(path.join(repoRoot, "src/shared/imageRedactor.js"));
require(path.join(repoRoot, "src/content/files/contentFileExtractionPipeline.js"));
require(path.join(repoRoot, "src/content/files/fileTypeSupport.js"));
require(path.join(repoRoot, "src/shared/streamingFileRedactor.js"));
require(path.join(repoRoot, "src/content/files/sanitizedFileBatchProcessor.js"));
require(path.join(repoRoot, "src/content/files/fileHandoffVerification.js"));
require(path.join(repoRoot, "src/content/files/fileInputPreparation.js"));
require(path.join(repoRoot, "src/content/files/fileHandoffDiscovery.js"));
require(path.join(repoRoot, "src/content/files/sanitizedFileHandoff.js"));
require(path.join(repoRoot, "src/content/files/fileDropInterception.js"));
require(path.join(repoRoot, "src/content/files/fileInputInterception.js"));
require(path.join(repoRoot, "src/content/files/multiFileInsertOrchestration.js"));
require(path.join(repoRoot, "src/content/files/streamingFileInsertOrchestration.js"));
require(path.join(repoRoot, "src/content/files/localFileReadOrchestration.js"));
require(path.join(repoRoot, "src/content/files/localFileAttachPreflightOrchestration.js"));
require(path.join(repoRoot, "src/content/files/localFileSanitizationOrchestration.js"));
require(path.join(repoRoot, "src/content/files/sanitizedFileInsertOrchestration.js"));
require(path.join(repoRoot, "src/content/files/localFileInsertOrchestration.js"));
require(path.join(repoRoot, "src/content/files/fileDropOrchestration.js"));
require(path.join(repoRoot, "src/content/whatsapp/whatsappCapabilities.js"));
require(path.join(repoRoot, "src/content/whatsapp/whatsappTextFlow.js"));
require(path.join(repoRoot, "src/content/whatsapp/whatsappSelectors.js"));

const { dataTransferHasFiles } = globalThis.PWM.FilePasteHelpers;

function extractFunctionSource(source, name) {
  const match = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(source);
  assert.ok(match, `expected to find function ${name}`);

  const start = match.index;
  const signatureStart = source.indexOf("(", start);
  assert.notStrictEqual(signatureStart, -1, `expected ${name} to have parameters`);
  let signatureDepth = 0;
  let signatureQuote = null;
  let signatureEscaped = false;
  let signatureEnd = -1;
  for (let index = signatureStart; index < source.length; index += 1) {
    const char = source[index];
    if (signatureQuote) {
      if (signatureEscaped) {
        signatureEscaped = false;
      } else if (char === "\\") {
        signatureEscaped = true;
      } else if (char === signatureQuote) {
        signatureQuote = null;
      }
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      signatureQuote = char;
      continue;
    }
    if (char === "(" || char === "{" || char === "[") {
      signatureDepth += 1;
    } else if (char === ")" || char === "}" || char === "]") {
      signatureDepth -= 1;
      if (signatureDepth === 0 && char === ")") {
        signatureEnd = index;
        break;
      }
    }
  }
  assert.notStrictEqual(signatureEnd, -1, `expected ${name} signature to close`);
  const openBrace = source.indexOf("{", signatureEnd);
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

function extractConstSource(source, name) {
  const match = new RegExp(`const\\s+${name}\\s*=`).exec(source);
  assert.ok(match, `expected to find const ${name}`);

  let index = source.indexOf("=", match.index) + 1;
  while (/\s/.test(source[index])) index += 1;

  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (; index < source.length; index += 1) {
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

    if (char === "{" || char === "(" || char === "[") {
      depth += 1;
    } else if (char === "}" || char === ")" || char === "]") {
      depth -= 1;
    } else if (char === ";" && depth === 0) {
      return source.slice(match.index, index + 1);
    }
  }

  throw new Error(`Could not extract const ${name}`);
}

function fileHandoffAdapterHarnessSource() {
  return [
    extractConstSource(contentSource, "FILE_HANDOFF_PENDING_ATTACH_ENABLED"),
    extractConstSource(contentSource, "FILE_HANDOFF_ADAPTERS"),
    extractFunctionSource(contentSource, "isOpenAiChatHost"),
    extractFunctionSource(contentSource, "isXHost"),
    extractFunctionSource(contentSource, "getFileHandoffAdapterById"),
    extractFunctionSource(contentSource, "hostMatchesFileHandoffAdapter"),
    extractFunctionSource(contentSource, "getFileHandoffAdapterForLocation"),
    extractFunctionSource(contentSource, "isFileHandoffAdapterPendingAttachEnabled"),
    extractFunctionSource(contentSource, "describeFileHandoffAdapter"),
    ...fileAttachDebugMetadataHarnessSource(),
    extractFunctionSource(contentSource, "debugFileHandoffAdapterSelected"),
    extractFunctionSource(contentSource, "candidateMatchesAnySelector"),
    extractFunctionSource(contentSource, "getAdapterUploadClickCandidates"),
    extractFunctionSource(contentSource, "isUnsafeFileHandoffClickTarget"),
    extractFunctionSource(contentSource, "isLikelyGenericUploadClickTarget"),
    extractFunctionSource(contentSource, "collectAdapterSelectorCandidates"),
    extractFunctionSource(contentSource, "resolveGenericAdapterFileInput"),
    extractFunctionSource(contentSource, "findGenericAdapterUploadTrigger"),
    extractFunctionSource(contentSource, "activateAdapterUploadElementSafely"),
    extractFunctionSource(contentSource, "waitForGenericAdapterFileInput"),
    extractFunctionSource(contentSource, "attachGenericPendingWithTrustedActivation"),
    extractFunctionSource(contentSource, "normalizeFileHandoffAdapter")
  ];
}

function contentDebugEventsHarnessSource() {
  return [extractConstSource(contentSource, "CONTENT_DEBUG_EVENTS")];
}

function fileAttachDebugMetadataHarnessSource() {
  return [
    extractFunctionSource(fileDebugMetadataSource, "normalizeFileDebugString"),
    extractFunctionSource(fileDebugMetadataSource, "normalizeSafeFileDebugEvent"),
    extractFunctionSource(fileDebugMetadataSource, "isSafeFileDebugToken"),
    extractFunctionSource(fileDebugMetadataSource, "isSafeFileDebugErrorCode"),
    extractFunctionSource(fileDebugMetadataSource, "getFileDebugExtension"),
    extractFunctionSource(fileDebugMetadataSource, "getFileDebugMimeCategory"),
    extractFunctionSource(fileDebugMetadataSource, "describeSafeFileDebugMetadata"),
    extractFunctionSource(fileDebugMetadataSource, "describeSafeFileInputDebugMetadata"),
    extractFunctionSource(fileDebugMetadataSource, "describeSafeFileHandoffAdapterDebugMetadata"),
    extractFunctionSource(fileDebugMetadataSource, "describeSafeFileAttachErrorMetadata"),
    extractFunctionSource(fileDebugMetadataSource, "assignSafeFileAttachErrorMetadata"),
    extractFunctionSource(fileDebugMetadataSource, "copySafeFileDebugScalar"),
    extractFunctionSource(fileDebugMetadataSource, "createSafeFileAttachDebugPayload"),
    extractFunctionSource(contentSource, "debugFileAttachMetadata")
  ];
}

function createAdapterRegistryForTest() {
  const noopHooks = {
    findGeminiUploadMenuButton: () => null,
    findGeminiUploadFilesMenuItem: () => null,
    findGeminiFileInput: () => ({ fileInput: null }),
    isLikelyGeminiUploadClickTarget: () => false,
    performPendingGeminiUserAttach: async () => false,
    findGrokUploadButton: () => null,
    discoverGrokPendingFileInput: () => ({ fileInput: null }),
    isLikelyGrokUploadClickTarget: () => false,
    performPendingGrokUserAttach: async () => false,
    findGenericAdapterUploadTrigger: () => null,
    resolveGenericAdapterFileInput: () => null,
    isLikelyGenericUploadClickTarget: () => false,
    attachGenericPendingWithTrustedActivation: async () => false
  };
  return globalThis.PWM.SiteAdapters.createFileHandoffAdapters({
    pendingAttachEnabled: {
      gemini: true,
      grok: true,
      chatgpt: true,
      claude: true,
      openai: true,
      x: true,
      whatsapp: false
    },
    hooks: noopHooks
  });
}

function createSanitizedFallbackFormatterHarness() {
  const factory = new Function(
    [
      "const redactSensitiveFileName = (value) => String(value || '');",
      "const sanitizeDownloadFileNameSegment = (value) => String(value || 'sanitized-file.txt');",
      extractFunctionSource(contentSource, "fallbackLanguageFromFileName"),
      extractFunctionSource(contentSource, "formatSanitizedFileFallbackText"),
      "return { formatSanitizedFileFallbackText };"
    ].join("\n\n")
  );
  return factory();
}

function testSanitizedFileFallbackTextPrefersRedactedSanitizedFileName() {
  const rawSecret = "sk-proj-FallbackFileNameSecret1234567890abcdef";
  const redactedText = "API_KEY=[PWM_1]\nSERVICE=orders";
  const { formatSanitizedFileFallbackText } = createSanitizedFallbackFormatterHarness();
  const fallbackText = formatSanitizedFileFallbackText({
    originalFile: {
      name: `customer-${rawSecret}.env`
    },
    sanitizedFile: {
      name: "customer-[PWM_1].env"
    },
    redactedText
  });

  assert.strictEqual(fallbackText.includes(rawSecret), false);
  assert.ok(fallbackText.includes(`LeakGuard sanitized file: customer-[PWM_1].env\n\n\`\`\`env\n${redactedText}`));
}

function fileHandoffStateHarnessSource() {
  return [
    extractFunctionSource(fileHandoffStateSource, "createFileHandoffState"),
    `const {
      sanitizedFileInputHandoffs,
      getFileMetadataSignature,
      getFileListMetadataSignature,
      markSanitizedFileHandoff,
      deleteSanitizedFileHandoffMark,
      getSanitizedFileInputHandoffSuppression,
      suppressSanitizedFileInputHandoffEvent,
      shouldSuppressSanitizedFileReprocessing,
      isFileUnavailableLocalFileResult,
      getFileUnavailableAfterHandoffSuppression,
      suppressFileUnavailableAfterHandoff,
      suppressStaleHandoffErrorAfterSuccess,
      isFirefoxProtectedFileInputEvent,
      getFirefoxFileInputTransaction,
      setFirefoxFileInputTransaction,
      markFirefoxFileInputTransactionReplaced,
      shouldSuppressFirefoxFileInputEvent,
      clearLocalFileInputSelection
    } = createFileHandoffState({
      emitDebug: debugReveal,
      describeFileForDebug,
      describeFileInputForDebug,
      getCurrentHandoffDriverId,
      getFileHandoffAdapterForLocation,
      isFileInputElement,
      isFirefoxRuntime,
      isProtectedFileDropDriver,
      listLocalTransferFiles,
      locationRef: location,
      setTimeoutFn: setTimeout,
      DataTransferCtor: typeof DataTransfer === "function" ? DataTransfer : null,
      constants: {
        PROGRAMMATIC_INPUT_SUPPRESS_MS,
        SANITIZED_FILE_HANDOFF_SUPPRESS_MS
      }
    });`
  ];
}

function fileHandoffPendingHarnessSource() {
  return [
    extractFunctionSource(pendingSanitizedFileHandoffSource, "createPendingSanitizedFileHandoffManager"),
    `const pendingSanitizedFileHandoff = createPendingSanitizedFileHandoffManager({
      clearPendingGeminiGhostIngressClickInterceptor,
      clearPendingSanitizedAttachPrompt,
      createPendingAttachEvent: (event, type) => createPendingAttachEvent(event, type),
      createSanitizedDataTransferForHandoff,
      createSanitizedFileHandoffDetails,
      debugReveal,
      describeElementForDebug,
      describeFileForDebug,
      describeFileHandoffAdapter,
      describeFileInputForDebug,
      describeGeminiHandoffDiscovery,
      describeGeminiOverlayExposure: typeof describeGeminiOverlayExposure === "function" ? describeGeminiOverlayExposure : () => ({}),
      describeGrokPendingInputDiscovery,
      discoverGeminiFileHandoffElements,
      discoverGrokPendingFileInput,
      documentRef: document,
      geminiTtlMs: GEMINI_PENDING_SANITIZED_FILE_HANDOFF_MS,
      genericTtlMs: GROK_PENDING_SANITIZED_FILE_HANDOFF_MS,
      getFileHandoffAdapterById,
      getGeminiSessionHash: () => lastGeminiDropSessionHash || "",
      getPendingSanitizedAttachPromptMessage,
      grokTtlMs: GROK_PENDING_SANITIZED_FILE_HANDOFF_MS,
      handOffSanitizedFileInput,
      handleContentError,
      hideBadgeSoon,
      hideDmzOverlay,
      isFileHandoffAdapterPendingAttachEnabled,
      isGeminiHost,
      isGrokHost,
      isLikelyGeminiUploadClickTarget,
      isLikelyGrokUploadClickTarget,
      logSanitizedFileHandoffFailure,
      normalizeFileHandoffAdapter,
      normalizeTarget,
      refreshBadgeFromCurrentInput,
      setBadge,
      showFileProcessingSuccess,
      showPendingSanitizedAttachPrompt
    });`,
    extractFunctionSource(fileHandoffPendingSource, "createFileHandoffPending"),
    `const {
      createPendingAttachEvent,
      queuePendingSanitizedFileHandoff,
      attemptPendingSanitizedFileHandoff,
      clearPendingSanitizedFileHandoff,
      attachPendingSanitizedFileWithTrustedActivation,
      insertPendingSanitizedFileText,
      downloadPendingSanitizedFile,
      cancelPendingSanitizedFileAttach
    } = createFileHandoffPending({
      attemptPendingGeminiSanitizedFileHandoff,
      attemptPendingGrokSanitizedFileHandoff,
      clearPendingGeminiSanitizedFileHandoff,
      clearPendingGrokSanitizedFileHandoff,
      clearPendingGenericSanitizedFileHandoff,
      clearPendingSanitizedAttachPrompt,
      createSanitizedFileHandoffDetails,
      debugFileHandoffAdapterSelected,
      describeFileForDebug,
      describeFileHandoffAdapter,
      downloadSanitizedFileFallback:
        (...args) =>
          typeof downloadSanitizedFileFallback === "function"
            ? downloadSanitizedFileFallback(...args)
            : false,
      emitDebug: debugReveal,
      getCurrentHandoffDriver:
        (...args) =>
          typeof getCurrentHandoffDriver === "function" ? getCurrentHandoffDriver(...args) : null,
      hideBadgeSoon,
      isFileHandoffAdapterPendingAttachEnabled,
      normalizeFileHandoffAdapter,
      normalizeTarget,
      queuePendingGeminiSanitizedFileHandoff,
      queuePendingGrokSanitizedFileHandoff,
      queuePendingGenericSanitizedFileHandoff,
      readSanitizedFileTextForFallback:
        typeof readSanitizedFileTextForFallback === "function"
          ? readSanitizedFileTextForFallback
          : async () => "",
      refreshBadgeFromCurrentInput,
      setBadge,
      suppressStaleHandoffErrorAfterSuccess
    });`
  ];
}

function fileHandoffFlowHarnessSource(options = {}) {
  const includeLegacyLocalFile = options.includeLegacyLocalFile !== false;
  return [
    extractFunctionSource(fileHandoffFlowSource, "createFileHandoffFlow"),
    `const {
      isFileOnlySanitizedPayload,
      isSafeSanitizedPayload,
      ${includeLegacyLocalFile ? "handOffSanitizedLocalFile," : ""}
      tryRealFileInputSanitizedFileAttach,
      insertSanitizedPayloadText,
      downloadSanitizedFileFallback,
      getCurrentHandoffDriver,
      handoffSanitizedPayload
    } = createFileHandoffFlow({
      applySanitizedTextFallback:
        typeof applySanitizedTextFallback === "function"
          ? applySanitizedTextFallback
          : async () => false,
      buildSanitizedDownloadFileName:
        typeof buildSanitizedDownloadFileName === "function"
          ? buildSanitizedDownloadFileName
          : () => "sanitized-file.txt",
      createSanitizedDataTransfer:
        typeof createSanitizedDataTransfer === "function" ? createSanitizedDataTransfer : () => null,
      createSanitizedDataTransferForHandoff:
        typeof createSanitizedDataTransferForHandoff === "function"
          ? createSanitizedDataTransferForHandoff
          : () => null,
      createSanitizedFileHandoffDetails:
        typeof createSanitizedFileHandoffDetails === "function"
          ? createSanitizedFileHandoffDetails
          : () => ({}),
      createSanitizedPayload:
        typeof createSanitizedPayload === "function" ? createSanitizedPayload : () => null,
      debugFileHandoffAdapterSelected,
      describeFileForDebug,
      describeFileHandoffAdapter,
      documentRef: document,
      dispatchSanitizedFileEvent:
        typeof dispatchSanitizedFileEvent === "function" ? dispatchSanitizedFileEvent : () => false,
      downloadGeminiSanitizedFileFallback:
        typeof downloadGeminiSanitizedFileFallback === "function"
          ? downloadGeminiSanitizedFileFallback
          : async () => false,
      assignSafeFileAttachErrorMetadata:
        typeof assignSafeFileAttachErrorMetadata === "function"
          ? assignSafeFileAttachErrorMetadata
          : () => {},
      emitDebug: debugReveal,
      findGeminiFileInput:
        typeof findGeminiFileInput === "function" ? findGeminiFileInput : () => ({ fileInput: null }),
      formatSanitizedFileFallbackText:
        typeof formatSanitizedFileFallbackText === "function"
          ? formatSanitizedFileFallbackText
          : () => "",
      getCurrentHandoffDriverId,
      getFileHandoffAdapterById,
      getFileHandoffAdapterForLocation,
      handOffGeminiSanitizedFileUpload:
        typeof handOffGeminiSanitizedFileUpload === "function"
          ? handOffGeminiSanitizedFileUpload
          : async () => false,
      handOffGrokSanitizedFileUpload:
        typeof handOffGrokSanitizedFileUpload === "function"
          ? handOffGrokSanitizedFileUpload
          : async () => false,
      handOffSanitizedFileInput:
        typeof handOffSanitizedFileInput === "function" ? handOffSanitizedFileInput : () => false,
      hideBadgeSoon: typeof hideBadgeSoon === "function" ? hideBadgeSoon : () => {},
      hideDmzOverlay: typeof hideDmzOverlay === "function" ? hideDmzOverlay : () => {},
      insertGeminiSanitizedText:
        typeof insertGeminiSanitizedText === "function"
          ? insertGeminiSanitizedText
          : async () => false,
      isFileHandoffAdapterPendingAttachEnabled,
      isFirefoxRuntime,
      isGeminiHost,
      isGrokHost,
      isProtectedFileDropDriver,
      locationRef: location,
      logSanitizedFileHandoffFailure,
      queuePendingSanitizedFileHandoff,
      readSanitizedFileTextForFallback,
      refreshBadgeFromCurrentInput:
        typeof refreshBadgeFromCurrentInput === "function" ? refreshBadgeFromCurrentInput : () => {},
      resolveFileInputForHandoff:
        typeof resolveFileInputForHandoff === "function" ? resolveFileInputForHandoff : () => null,
      scheduleDmzOverlayCleanup:
        typeof scheduleDmzOverlayCleanup === "function" ? scheduleDmzOverlayCleanup : () => {},
      sendRuntimeMessage:
        typeof sendRuntimeMessage === "function" ? sendRuntimeMessage : async () => null,
      setBadge: typeof setBadge === "function" ? setBadge : () => {},
      setDmzOverlayState: typeof setDmzOverlayState === "function" ? setDmzOverlayState : () => {},
      shouldUseFirefoxTextFallbackForFileHandoff:
        typeof shouldUseFirefoxTextFallbackForFileHandoff === "function"
          ? shouldUseFirefoxTextFallbackForFileHandoff
          : () => false,
      tryFirefoxGeminiFileInputBridge:
        typeof tryFirefoxGeminiFileInputBridge === "function"
          ? tryFirefoxGeminiFileInputBridge
          : async () => ({ handled: false, ok: false }),
      tryGeminiSanitizedFileAttach:
        typeof tryGeminiSanitizedFileAttach === "function"
          ? tryGeminiSanitizedFileAttach
          : async () => false
    });`
  ];
}

function createDataTransfer({ files = true, exposeFiles = true, getAsFileReturnsNull = false } = {}) {
  const file = {
    name: "secrets.env",
    type: "text/plain",
    size: 42
  };
  const selectedFiles = Array.isArray(files) ? files : [file];

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
    files: exposeFiles ? selectedFiles : [],
    items: selectedFiles.map((entry) => ({
      kind: "file",
      type: entry.type,
      getAsFile: () => (getAsFileReturnsNull ? null : entry)
    })),
    dropEffect: "none"
  };
}

function createEvent({
  type = "drop",
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
    type,
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

function createClickEvent(target, path = null) {
  const calls = {
    preventDefault: 0,
    stopPropagation: 0,
    stopImmediatePropagation: 0
  };
  const event = {
    type: "click",
    target,
    defaultPrevented: false,
    propagationStopped: false,
    immediatePropagationStopped: false,
    preventDefault() {
      calls.preventDefault += 1;
      event.defaultPrevented = true;
    },
    stopPropagation() {
      calls.stopPropagation += 1;
      event.propagationStopped = true;
    },
    stopImmediatePropagation() {
      calls.stopImmediatePropagation += 1;
      event.immediatePropagationStopped = true;
    },
    composedPath: Array.isArray(path) ? () => path : undefined
  };
  return { event, calls };
}

function findButtonByText(root, text) {
  if (!root) return null;
  if (root.tagName === "BUTTON" && root.textContent === text) return root;
  for (const child of root.children || []) {
    const match = findButtonByText(child, text);
    if (match) return match;
  }
  return null;
}

function triggerGhostIngressTimeout(harness) {
  harness.timeoutCallbacks
    .filter((entry) => entry.delay === 2200)
    .forEach((entry) => entry.callback());
}

function createClipboardEvent({
  text = "API_KEY=LeakGuardPasteApiKey1234567890",
  clipboardData = null,
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
    type: "paste",
    clipboardData: clipboardData || {
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

function createChatGptContentEditableComposer(initialText = "") {
  const events = [];
  const composer = {
    nodeType: 1,
    tagName: "DIV",
    id: "prompt-textarea",
    className: "ProseMirror",
    isContentEditable: true,
    text: initialText,
    selection: { start: initialText.length, end: initialText.length },
    focusCalls: 0,
    events,
    focus() {
      this.focusCalls += 1;
    },
    getAttribute(name) {
      if (name === "contenteditable") return "true";
      if (name === "data-testid") return "prompt-textarea";
      if (name === "role") return "textbox";
      if (name === "id") return this.id;
      if (name === "class") return this.className;
      return "";
    },
    closest(selector) {
      if (
        selector === "form" ||
        selector === "main" ||
        selector === "[contenteditable='true']" ||
        selector === '[contenteditable="true"]'
      ) {
        return null;
      }
      return null;
    },
    contains(node) {
      return node === this;
    },
    dispatchEvent(event) {
      events.push({
        type: event.type,
        inputType: event.inputType || "",
        dataLength: typeof event.data === "string" ? event.data.length : null
      });
      return true;
    }
  };
  Object.defineProperty(composer, "innerText", {
    get() {
      return this.text;
    },
    set(value) {
      this.text = String(value || "");
    }
  });
  Object.defineProperty(composer, "textContent", {
    get() {
      return this.text;
    },
    set(value) {
      this.text = String(value || "");
    }
  });
  return composer;
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

function createReadableTextFile({ name = "secrets.env", type = "text/plain", text }) {
  const input = String(text || "");
  const bytes = new TextEncoder().encode(input);
  return {
    name,
    type,
    size: bytes.byteLength,
    async text() {
      return input;
    },
    async arrayBuffer() {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
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
    consoleErrors: [],
    runtimeMessages: [],
    dragDetections: 0,
    clearedDragSessions: 0,
    dmzStates: [],
    dmzCleanups: []
  };
  const activeElement = { tagName: "TEXTAREA" };
  class HarnessDataTransfer {
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
  const dependencies = {
    extensionRuntimeAvailable: true,
    calls,
    currentPublicState: {
      currentSite: {
        protected: true
      }
    },
    modalOpen: false,
    Node: { ELEMENT_NODE: 1 },
    Event,
    DataTransfer: HarnessDataTransfer,
    MutationObserver: class {
      constructor(callback) {
        this.callback = callback;
      }
      observe() {}
      disconnect() {}
    },
    setTimeout: (callback, delay = 0) => {
      if (delay === 0) callback();
      if (delay === 450 || delay === 1200 || delay === 2500 || delay === 3000) Promise.resolve().then(callback);
      return 0;
    },
    clearTimeout: () => {},
    InputEvent: typeof InputEvent === "function" ? InputEvent : Event,
    console: {
      log: () => {},
      error: (...args) => calls.consoleErrors.push(args),
      group: () => {},
      groupCollapsed: () => {},
      groupEnd: () => {}
    },
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
    navigator: {
      userAgent: "Chrome"
    },
    fileDragGuard: null,
    rawFileDropInterceptions: new WeakSet(),
    FilePasteHelpers: globalThis.PWM.FilePasteHelpers,
    FileScanner: globalThis.PWM.FileScanner || {},
    FileTypeRegistry: globalThis.PWM.FileTypeRegistry || {},
    ContentFileTypeSupport: globalThis.PWM.ContentFileTypeSupport || {},
    SanitizedFileBatchProcessor: globalThis.PWM.SanitizedFileBatchProcessor || {},
    FileHandoffVerification: globalThis.PWM.FileHandoffVerification || {},
    FileInputPreparation: globalThis.PWM.FileInputPreparation || {},
    FileHandoffDiscovery: globalThis.PWM.FileHandoffDiscovery || {},
    SanitizedFileHandoff: globalThis.PWM.SanitizedFileHandoff || {},
    FileDropInterception: globalThis.PWM.FileDropInterception || {},
    FileInputInterception: globalThis.PWM.FileInputInterception || {},
    FileProcessingUi: globalThis.PWM.FileProcessingUi || {},
    WhatsAppCapabilities: globalThis.PWM.WhatsAppCapabilities || {},
    WhatsAppTextFlow: globalThis.PWM.WhatsAppTextFlow || {},
    WhatsAppSelectors: globalThis.PWM.WhatsAppSelectors || {},
    GeminiUploadDiscovery: globalThis.PWM.GeminiUploadDiscovery || {},
    GeminiFileHandoff: globalThis.PWM.GeminiFileHandoff || {},
    GrokFileHandoff: globalThis.PWM.GrokFileHandoff || {},
    StreamingFileRedactor: globalThis.PWM.StreamingFileRedactor || {},
    PLACEHOLDER_TOKEN_REGEX: globalThis.PWM.PLACEHOLDER_TOKEN_REGEX,
    ANY_PLACEHOLDER_TOKEN_REGEX: globalThis.PWM.ANY_PLACEHOLDER_TOKEN_REGEX,
    normalizeVisiblePlaceholders: globalThis.PWM.normalizeVisiblePlaceholders,
    PlaceholderFamilies: globalThis.PWM.PlaceholderFamilies || {},
    normalizeComposerText: globalThis.PWM.ComposerHelpers.normalizeComposerText,
    isTextArea: globalThis.PWM.ComposerHelpers.isTextArea,
    isContentEditable: globalThis.PWM.ComposerHelpers.isContentEditable,
    spliceSelectionText: globalThis.PWM.ComposerHelpers.spliceSelectionText,
    buildComposerWritePlan: (input, text) => ({
      canonical: globalThis.PWM.ComposerHelpers.normalizeComposerText(text),
      writeText: globalThis.PWM.ComposerHelpers.normalizeComposerText(text)
    }),
    matchesComposerPlan: (plan, actual) =>
      globalThis.PWM.ComposerHelpers.normalizeComposerText(actual) === plan.canonical,
    detectMultilineCollapse: (expected, actual) => {
      const expectedBreaks = (globalThis.PWM.ComposerHelpers.normalizeComposerText(expected).match(/\n/g) || []).length;
      const actualBreaks = (globalThis.PWM.ComposerHelpers.normalizeComposerText(actual).match(/\n/g) || []).length;
      return expectedBreaks >= 2 && actualBreaks === 0;
    },
    writePlainTextToContentEditablePreservingNewlines: (input, text) => {
      input.text = globalThis.PWM.ComposerHelpers.normalizeComposerText(text);
      input.textContentWrites = (input.textContentWrites || 0) + 1;
      input.dispatchEvent?.(new Event("input", { bubbles: true, composed: true }));
      input.dispatchEvent?.(new Event("change", { bubbles: true, composed: true }));
      return true;
    },
    verifyComposerRewriteSafe: async ({ input, expectedText, actualText }) => {
      const actual = globalThis.PWM.ComposerHelpers.normalizeComposerText(
        actualText == null ? dependencies.getInputText(input) : actualText
      );
      const expected = globalThis.PWM.ComposerHelpers.normalizeComposerText(expectedText);
      return {
        ok: actual === expected || actual.includes(expected) || expected.includes(actual),
        actual,
        strategy: "harness"
      };
    },
    collectFailureDetails: () => ({}),
    showRewriteFailure: async () => {},
    dataTransferHasFiles,
    normalizeClipboardImageDataTransfer: globalThis.PWM.FilePasteHelpers.normalizeClipboardImageDataTransfer,
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
    canExtractForAdapterHandoff: () => false,
    processFileForAdapterHandoff: async () => null,
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
    handOffGrokSanitizedFileUpload: (event, input, sanitizedFile) => {
      calls.handoffs.push({ event, input, sanitizedFile, context: "grok-file-input" });
      return true;
    },
    hasPendingGeminiSanitizedFileHandoff: () => false,
    hasGeminiSanitizedDownloadFallback: () => false,
    resolveFileInputForHandoff: () => null,
    handOffSanitizedFileInput: (fileInput, transfer) => {
      calls.originalFileInputHandoffs = calls.originalFileInputHandoffs || [];
      calls.originalFileInputHandoffs.push({ fileInput, transfer });
      fileInput.files = transfer.files;
      fileInput.dispatchEvent?.(new Event("input", { bubbles: true, cancelable: true, composed: true }));
      fileInput.dispatchEvent?.(new Event("change", { bubbles: true, cancelable: true, composed: true }));
      return true;
    },
    getInputText: (input) => input?.text || "",
    getSelectionOffsets: (input) => input?.selection || { start: 0, end: 0 },
    applyPasteDecision: async (input, originalText, selection, insertedText, context) => {
      calls.textFallbacks.push({ input, originalText, selection, insertedText, context });
      input.text = `${originalText.slice(0, selection.start)}${insertedText}${originalText.slice(selection.end)}`;
      return true;
    },
    setInputText: (input, text, options = {}) => {
      calls.primaryTextWrites = calls.primaryTextWrites || [];
      calls.primaryTextWrites.push({ input, text, options });
      input.text = String(text || "");
    },
    forceRewriteInputText: (input, text, options = {}) => {
      calls.forceTextWrites = calls.forceTextWrites || [];
      calls.forceTextWrites.push({ input, text, options });
      input.text = String(text || "");
    },
    setInputTextDirect: (input, text, options = {}) => {
      calls.directTextWrites = calls.directTextWrites || [];
      calls.directTextWrites.push({ input, text, options });
      input.text = String(text || "");
      return true;
    },
    debugLogSnapshot: () => {},
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
    sendRuntimeMessage: async (message) => {
      calls.runtimeMessages.push(message);
      return { ok: true, downloadId: 77 };
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
      createRange: () => null,
      createElement: (tagName) => ({
        tagName: String(tagName || "").toUpperCase(),
        type: "",
        files: []
      })
    },
    location: { hostname: "chatgpt.com" }
  };
  Object.assign(dependencies, overrides);

  const factory = new Function(
    ...Object.keys(dependencies),
    [
      'const GEMINI_SANITIZED_TEXT_FALLBACK_MESSAGE = "Sanitized content inserted as text because Gemini rejected sanitized file upload.";',
      'const LOCAL_FILE_SANITIZED_TEXT_FALLBACK_MESSAGE = "Sanitized content inserted as text because the site did not accept a sanitized file upload.";',
      'const FIREFOX_GEMINI_DROP_FILE_UNAVAILABLE_MESSAGE = "Firefox did not expose the dropped file to LeakGuard. Use Gemini\\\'s upload button so LeakGuard can sanitize and replace the selected file before upload.";',
      'const FIREFOX_GEMINI_FILE_INPUT_BRIDGE_FAILURE_MESSAGE = "LeakGuard blocked the raw file drop. Could not locate Gemini upload input. Please use the upload button or retry.";',
      'const GEMINI_PENDING_SANITIZED_FILE_HANDOFF_MESSAGE = "Large file sanitized. Click Attach sanitized file or Gemini Upload files.";',
      'const GROK_PENDING_SANITIZED_FILE_HANDOFF_MESSAGE = "Large file sanitized. Click Attach sanitized file or Grok Upload/Attach.";',
      "const PROGRAMMATIC_INPUT_SUPPRESS_MS = 500;",
      "const WHATSAPP_DUPLICATE_TEXT_PASTE_SUPPRESS_MS = 1200;",
      "const CHATGPT_LARGE_PASTE_FILE_THRESHOLD = 16 * 1024;",
      'const CHATGPT_SANITIZED_PASTE_FILE_NAME = "leakguard-redacted-paste.txt";',
      "const CHATGPT_SYNC_EVENT_DATA_MAX_CHARS = 256 * 1024;",
      "const CHATGPT_SYNC_VERIFY_DELAY_MS = 80;",
      "const GEMINI_DIRECT_TEXT_INSERT_THRESHOLD = 8 * 1024;",
      "const GEMINI_AUTO_INSERT_TEXT_LIMIT = 256 * 1024;",
      "const GEMINI_LARGE_TEXT_SUPPRESS_MS = 2500;",
      "const SANITIZED_FILE_HANDOFF_SUPPRESS_MS = 30000;",
      "const GEMINI_UPLOAD_INPUT_WAIT_MS = 450;",
      "const GEMINI_GHOST_INGRESS_TIMEOUT_MS = 2200;",
      "const GEMINI_PENDING_SANITIZED_FILE_HANDOFF_MS = 60000;",
      "const GROK_PENDING_SANITIZED_FILE_HANDOFF_MS = 60000;",
      "const WHATSAPP_SANITIZED_IMAGE_SEND_BYPASS_MS = 30000;",
      "const LOCAL_TEXT_FAST_MAX_BYTES = 2 * 1024 * 1024;",
      "const LOCAL_TEXT_OPTIMIZED_MAX_BYTES = 4 * 1024 * 1024;",
      "const LOCAL_TEXT_HARD_BLOCK_BYTES = 4 * 1024 * 1024;",
      "const MAX_MULTI_FILE_ATTACHMENTS = 5;",
      "const MAX_MULTI_FILE_SMALL_ATTACHMENTS = 20;",
      "const MAX_MULTI_FILE_LARGE_ATTACHMENTS = 5;",
      "const MULTI_FILE_SMALL_MAX_BYTES = 4 * 1024 * 1024;",
      "const MULTI_FILE_SUPPORTED_MAX_BYTES = 50 * 1024 * 1024;",
      "const ChatGptLargePasteOrchestration = globalThis.PWM?.ChatGptLargePasteOrchestration || {};",
      "const GeminiEditorPasteOrchestration = globalThis.PWM?.GeminiEditorPasteOrchestration || {};",
      "const PasteOrchestration = globalThis.PWM?.PasteOrchestration || {};",
      "const MultiFileInsertOrchestration = globalThis.PWM?.MultiFileInsertOrchestration || {};",
      "const StreamingFileInsertOrchestration = globalThis.PWM?.StreamingFileInsertOrchestration || {};",
      "const LocalFileReadOrchestration = globalThis.PWM?.LocalFileReadOrchestration || {};",
      "const LocalFileAttachPreflightOrchestration = globalThis.PWM?.LocalFileAttachPreflightOrchestration || {};",
      "const LocalFileSanitizationOrchestration = globalThis.PWM?.LocalFileSanitizationOrchestration || {};",
      "const SanitizedFileInsertOrchestration = globalThis.PWM?.SanitizedFileInsertOrchestration || {};",
      "const LocalFileInsertOrchestration = globalThis.PWM?.LocalFileInsertOrchestration || {};",
      "const FileDropOrchestration = globalThis.PWM?.FileDropOrchestration || {};",
      'const LOCAL_TEXT_HARD_BLOCK_TITLE = "Large payload blocked for browser stability";',
      'const LOCAL_TEXT_HARD_BLOCK_MESSAGE = "This content is over 4 MB. LeakGuard did not process or send it automatically to avoid browser instability. Split the file into smaller parts, or sanitize it separately before upload.";',
      "const LARGE_TEXT_STREAMING_MAX_BYTES = 50 * 1024 * 1024;",
      'const STREAMING_BLOCK_TITLE = "File too large for local redaction";',
      'const STREAMING_BLOCK_MESSAGE = "LeakGuard blocked raw file upload because the file is too large for local redaction.";',
      'const LOCAL_FILE_STREAMING_REQUIRED_MESSAGE = "LeakGuard will stream-redact this large text file locally before upload.";',
      'const LOCAL_FILE_UNSUPPORTED_WARNING = "LeakGuard did not scan or redact this unsupported file. Supported text, text PDF, DOCX, XLSX, and PNG/JPG/JPEG/WEBP image paths are protected where available. Unsupported archives, executables, legacy Office files, unsupported images, and binary files are blocked on protected sites when LeakGuard cannot safely replace them.";',
      'const WHATSAPP_FILE_ATTACH_UNSUPPORTED_REASON = "whatsapp_file_attachments_unsupported";',
      'const WHATSAPP_FILE_ATTACH_BLOCK_TITLE = "WhatsApp file upload blocked";',
      'const WHATSAPP_FILE_ATTACH_BLOCK_MESSAGE = "LeakGuard blocks unsupported WhatsApp Web file attachments in this phase. No raw file was uploaded.";',
      'const UNSUPPORTED_PROTECTED_IMAGE_BLOCKED_TITLE = "Raw image upload blocked";',
      'const UNSUPPORTED_PROTECTED_IMAGE_BLOCKED_MESSAGE = "Raw image upload blocked. This image type is not supported for safe redaction.";',
      'const SUPPORTED_IMAGE_REDACTION_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);',
      'const SUPPORTED_IMAGE_REDACTION_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);',
      'const SUPPORTED_WHATSAPP_PDF_ATTACH_EXTENSIONS = new Set([".pdf"]);',
      'const SUPPORTED_WHATSAPP_PDF_ATTACH_MIME_TYPES = new Set(["application/pdf"]);',
      'const SUPPORTED_WHATSAPP_DOCX_ATTACH_EXTENSIONS = new Set([".docx"]);',
      'const SUPPORTED_WHATSAPP_DOCX_ATTACH_MIME_TYPES = new Set(["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);',
      'const SUPPORTED_WHATSAPP_XLSX_ATTACH_EXTENSIONS = new Set([".xlsx"]);',
      'const SUPPORTED_WHATSAPP_XLSX_ATTACH_MIME_TYPES = new Set(["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]);',
      'const UNSUPPORTED_PROTECTED_IMAGE_EXTENSIONS = new Set([".gif", ".bmp", ".ico", ".svg"]);',
      "let suppressInputScanUntil = 0;",
      "let contentFileTypeSupport = null;",
      "let localFileTransferPolicyGate = null;",
      "let sanitizedFileBatchProcessor = null;",
      "let fileHandoffVerification = null;",
      "let fileInputPreparation = null;",
      "let fileHandoffDiscovery = null;",
      "let fileDropInterception = null;",
      "let fileInputInterception = null;",
      "let chatGptLargePasteOrchestration = null;",
      "let geminiEditorPasteOrchestration = null;",
      "let pasteOrchestration = null;",
      "let multiFileInsertOrchestration = null;",
      "let streamingFileInsertOrchestration = null;",
      "let localFileReadOrchestration = null;",
      "let localFileAttachPreflightOrchestration = null;",
      "let localFileSanitizationOrchestration = null;",
      "let sanitizedFileInsertOrchestration = null;",
      "let localFileInsertOrchestration = null;",
      "let fileDropOrchestration = null;",
      "let fileProcessingUi = null;",
      "let geminiUploadDiscovery = null;",
      "let geminiFileHandoff = null;",
      "let grokFileHandoff = null;",
      "let whatsAppCapabilities = null;",
      "let whatsAppTextFlow = null;",
      "let whatsAppSelectors = null;",
      "let sanitizedFileHandoff = null;",
      "let syntheticFileListCapabilityCache = null;",
      "let inputFileAssignmentCapabilityCache = null;",
      "let pendingGeminiSanitizedFileHandoff = null;",
      "let pendingGeminiSanitizedFileObserver = null;",
      "let pendingGeminiSanitizedFileTimer = 0;",
      "let pendingGeminiSanitizedFileClickHandler = null;",
      "let pendingGeminiGhostIngressClickCleanup = null;",
      "let pendingGrokSanitizedFileHandoff = null;",
      "let pendingGrokSanitizedFileObserver = null;",
      "let pendingGrokSanitizedFileTimer = 0;",
      "let pendingGrokSanitizedFileClickHandler = null;",
      "let pendingGenericSanitizedFileHandoff = null;",
      "let pendingGenericSanitizedFileTimer = 0;",
      "let fileInputProcessingSignatures = new WeakMap();",
      "const whatsAppSanitizedImageHandoffInputs = new WeakMap();",
      "let whatsAppSanitizedImageHandoffUntil = 0;",
      "let whatsAppBypassSanitizedImageSubmitUntil = 0;",
      ...contentDebugEventsHarnessSource(),
      ...fileHandoffAdapterHarnessSource(),
      "function setDmzOverlayState(message, state = \"\") { calls.dmzStates.push({ message, state }); }",
      "function scheduleDmzOverlayCleanup(delayMs = 1200) { calls.dmzCleanups.push(delayMs); }",
      "function setGeminiDmzOverlayState(message, state = \"\") { setDmzOverlayState(message, state); }",
      "function scheduleGeminiDmzOverlayCleanup(delayMs = 1200) { scheduleDmzOverlayCleanup(delayMs); }",
      "function hideDmzOverlay() { calls.dmzCleanups.push(\"hide\"); }",
      "function createSanitizedFileHandoffDetails() { return {}; }",
      "async function downloadGeminiSanitizedFileFallback() { return false; }",
      extractFunctionSource(contentSource, "getFileProcessingUi"),
      extractFunctionSource(contentSource, "formatFileProcessingProgress"),
      extractFunctionSource(contentSource, "showFileProcessingOverlay"),
      extractFunctionSource(contentSource, "updateFileProcessingOverlay"),
      extractFunctionSource(contentSource, "hideFileProcessingOverlay"),
      extractFunctionSource(contentSource, "showFileProcessingSuccess"),
      extractFunctionSource(contentSource, "showFileProcessingError"),
      extractFunctionSource(contentSource, "clearPendingSanitizedAttachPrompt"),
      extractFunctionSource(contentSource, "getPendingSanitizedAttachPromptMessage"),
      extractFunctionSource(contentSource, "describeSanitizedFileOrBatchForDebug"),
      extractFunctionSource(contentSource, "showPendingSanitizedAttachPrompt"),
      extractFunctionSource(contentSource, "consumeInterceptionEvent"),
      extractFunctionSource(contentSource, "logFileInterception"),
      extractFunctionSource(contentSource, "isFirefoxRuntime"),
      extractFunctionSource(contentSource, "createSafeCapabilityProbeFile"),
      extractFunctionSource(contentSource, "canUseSyntheticDataTransferFileList"),
      extractFunctionSource(contentSource, "canAssignFilesToInput"),
      extractFunctionSource(contentSource, "shouldUseFirefoxTextFallbackForFileHandoff"),
      extractFunctionSource(contentSource, "isExpectedFirefoxGeminiNoPickerMiss"),
      extractFunctionSource(contentSource, "shouldQueueFirefoxGeminiPendingSanitizedFileHandoff"),
      extractFunctionSource(contentSource, "getFirefoxRawFileUploadBlockedMessage"),
      ...fileHandoffStateHarnessSource(),
      ...fileHandoffPendingHarnessSource(),
      extractFunctionSource(contentSource, "isPasteBeforeInput"),
      extractFunctionSource(contentSource, "getPasteTransfer"),
      extractFunctionSource(contentSource, "getPastedPlainText"),
      extractFunctionSource(contentSource, "isTextPasteInterceptionEvent"),
      extractFunctionSource(contentSource, "getWhatsAppTextFlow"),
      extractFunctionSource(contentSource, "rememberWhatsAppTextPaste"),
      extractFunctionSource(contentSource, "shouldSuppressDuplicateWhatsAppTextPaste"),
      extractFunctionSource(contentSource, "dataTransferLooksLikeFiles"),
      extractFunctionSource(contentSource, "listLocalTransferFiles"),
      extractFunctionSource(contentSource, "snapshotFilesFromDataTransfer"),
      extractFunctionSource(contentSource, "countDataTransferFileItems"),
      extractFunctionSource(contentSource, "describeDataTransferFileSnapshot"),
      extractFunctionSource(contentSource, "snapshotLocalFileDataTransfer"),
      extractFunctionSource(contentSource, "isFirefoxDataTransferFileUnavailableSnapshot"),
      extractFunctionSource(contentSource, "blockFirefoxGeminiUnavailableDrop"),
      extractFunctionSource(contentSource, "getFileDropInterception"),
      extractFunctionSource(contentSource, "getFileInputInterception"),
      extractFunctionSource(contentSource, "hashLocalString"),
      extractFunctionSource(contentSource, "getGeminiDropSessionHash"),
      extractFunctionSource(contentSource, "classifyLocalFile"),
      extractFunctionSource(contentSource, "resolveLocalFileTransferPolicy"),
      extractFunctionSource(contentSource, "resolveFileDragGuardPolicy"),
      extractFunctionSource(contentSource, "showUnsupportedFilePassThroughNotice"),
      extractFunctionSource(contentSource, "shouldBlockUnsupportedFileTransfer"),
      extractFunctionSource(contentSource, "getUnsupportedFileBlockedMessage"),
      extractFunctionSource(contentSource, "getUnsupportedFileBlockedTitle"),
      extractFunctionSource(contentSource, "getLocalFileTransferPolicyGate"),
      extractFunctionSource(contentSource, "getContentFileTypeSupport"),
      extractFunctionSource(contentSource, "getWhatsAppCapabilities"),
      extractFunctionSource(contentSource, "getWhatsAppSelectors"),
      extractFunctionSource(contentSource, "isSupportedWhatsAppClipboardImagePaste"),
      extractFunctionSource(contentSource, "isWhatsAppSanitizedDropHandoffEnabled"),
      extractFunctionSource(contentSource, "isWhatsAppSanitizedFileHandoffContext"),
      extractFunctionSource(contentSource, "isSupportedWhatsAppAttachImageFile"),
      extractFunctionSource(contentSource, "isSupportedWhatsAppImageAttach"),
      extractFunctionSource(contentSource, "isSupportedWhatsAppTextDocumentAttachFile"),
      extractFunctionSource(contentSource, "isSupportedWhatsAppTextDocumentAttach"),
      extractFunctionSource(contentSource, "isSupportedWhatsAppPdfAttachFile"),
      extractFunctionSource(contentSource, "isSupportedWhatsAppPdfAttach"),
      extractFunctionSource(contentSource, "isSupportedWhatsAppDocxAttachFile"),
      extractFunctionSource(contentSource, "isSupportedWhatsAppDocxAttach"),
      extractFunctionSource(contentSource, "isSupportedWhatsAppXlsxAttachFile"),
      extractFunctionSource(contentSource, "isSupportedWhatsAppXlsxAttach"),
      extractFunctionSource(contentSource, "isWhatsAppSanitizedMultiFileAttachEnabled"),
      extractFunctionSource(contentSource, "isPotentialWhatsAppMultiFileAttach"),
      extractFunctionSource(contentSource, "isSupportedWhatsAppMultiFileAttachFile"),
      extractFunctionSource(contentSource, "isSupportedWhatsAppMultiFileAttach"),
      extractFunctionSource(contentSource, "isWhatsAppHandoffContext"),
      extractFunctionSource(contentSource, "blockWhatsAppFileAttachment"),
      extractFunctionSource(contentSource, "getContentExtractionBlockedMessage"),
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
      extractFunctionSource(contentSource, "isSanitizedTextRewriteEvent"),
      extractFunctionSource(contentSource, "normalizeTarget"),
      extractFunctionSource(contentSource, "isChatGptHost"),
      extractFunctionSource(contentSource, "isGeminiHost"),
      extractFunctionSource(contentSource, "isClaudeHost"),
      extractFunctionSource(contentSource, "isGrokHost"),
      extractFunctionSource(contentSource, "isOpenAiChatHost"),
      extractFunctionSource(contentSource, "isXHost"),
      extractFunctionSource(contentSource, "isWhatsAppHost"),
      extractFunctionSource(contentSource, "containsVisiblePlaceholderToken"),
      extractFunctionSource(contentSource, "hasUnsafeVisibleSecret"),
      extractFunctionSource(contentSource, "shouldOwnWhatsAppTextSend"),
      extractFunctionSource(contentSource, "markWhatsAppSanitizedImageHandoff"),
      extractFunctionSource(contentSource, "hasRecentWhatsAppSanitizedImageHandoff"),
      extractFunctionSource(contentSource, "consumeRecentWhatsAppSanitizedImageHandoff"),
      extractFunctionSource(contentSource, "isWhatsAppSanitizedImageSendTextSafe"),
      extractFunctionSource(contentSource, "shouldBypassWhatsAppSanitizedImageSend"),
      extractFunctionSource(contentSource, "getCurrentHandoffDriverId"),
      extractFunctionSource(contentSource, "getActiveProtection"),
      extractFunctionSource(contentSource, "isProtectedFileDropDriver"),
      extractFunctionSource(contentSource, "getChatGptLargePasteOrchestration"),
      extractFunctionSource(contentSource, "getSafeElementAttribute"),
      extractFunctionSource(contentSource, "countDebugPlaceholders"),
      extractFunctionSource(contentSource, "getDebugTextLength"),
      extractFunctionSource(contentSource, "getChatGptSendButtonDebugState"),
      extractFunctionSource(contentSource, "getChatGptComposerSyncDebug"),
      extractFunctionSource(contentSource, "debugChatGptSync"),
      extractFunctionSource(chatGptComposerSyncSource, "focusChatGptComposer"),
      extractFunctionSource(chatGptComposerSyncSource, "placeChatGptCaretAtEnd"),
      extractFunctionSource(chatGptComposerSyncSource, "dispatchChatGptComposerInputEvent"),
      extractFunctionSource(chatGptComposerSyncSource, "dispatchChatGptComposerBeforeInput"),
      extractFunctionSource(chatGptComposerSyncSource, "dispatchChatGptComposerChange"),
      extractFunctionSource(chatGptComposerSyncSource, "nudgeChatGptComposerState"),
      extractFunctionSource(chatGptComposerSyncSource, "waitForChatGptComposerVerification"),
      extractFunctionSource(chatGptComposerSyncSource, "tryChatGptExecCommandWrite"),
      extractFunctionSource(chatGptComposerSyncSource, "tryChatGptDirectWrite"),
      extractFunctionSource(chatGptComposerSyncSource, "tryChatGptComposerHelperWrite"),
      extractFunctionSource(chatGptComposerSyncSource, "runChatGptSyncedWriteAttempt"),
      extractFunctionSource(chatGptComposerSyncSource, "applyChatGptSyncedComposerText"),
      extractFunctionSource(contentSource, "isHighConfidenceRewriteFinding"),
      extractFunctionSource(contentSource, "isKnownSanitizedPlaceholderToken"),
      extractFunctionSource(contentSource, "maybeHandleChatGptLargeTextPaste"),
      extractFunctionSource(contentSource, "resolveGeminiEditorTarget"),
      extractFunctionSource(contentSource, "getGeminiEditorPasteOrchestration"),
      extractFunctionSource(contentSource, "findGeminiEditorCandidateInRoot"),
      extractFunctionSource(contentSource, "resolveGeminiFallbackEditor"),
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
      extractFunctionSource(contentSource, "verifyGeminiFirefoxInsertedText"),
      extractFunctionSource(contentSource, "buildGeminiFirefoxMultilineDirectText"),
      extractFunctionSource(contentSource, "insertGeminiFirefoxMultilineDirectText"),
      extractFunctionSource(contentSource, "insertGeminiFirefoxEditorText"),
      extractFunctionSource(contentSource, "insertLargeGeminiEditorText"),
      extractFunctionSource(contentSource, "insertGeminiEditorText"),
      extractFunctionSource(contentSource, "dispatchGeminiEditorInput"),
      extractFunctionSource(contentSource, "confirmGeminiLargeSanitizedTextInsertion"),
      extractFunctionSource(contentSource, "applyComposerText"),
      extractFunctionSource(contentSource, "rewriteComposerTransactionally"),
      extractFunctionSource(contentSource, "blockGeminiEditorRawContent"),
      extractFunctionSource(contentSource, "maybeHandleGeminiEditorPaste"),
      extractFunctionSource(contentSource, "markSanitizedFileHandoffEvent"),
      extractFunctionSource(contentSource, "createSanitizedDataTransfer"),
      extractFunctionSource(contentSource, "createSanitizedDataTransferForHandoff"),
      extractFunctionSource(contentSource, "attachEventDataTransfer"),
      extractFunctionSource(contentSource, "dispatchSanitizedFileEvent"),
      extractFunctionSource(contentSource, "isFileInputElement"),
      extractFunctionSource(contentSource, "handOffOriginalLocalFile"),
      extractFunctionSource(contentSource, "describeFileForDebug"),
      extractFunctionSource(contentSource, "describeFileInputForDebug"),
      extractFunctionSource(contentSource, "getSafeTextSnippet"),
      extractFunctionSource(contentSource, "describeElementForDebug"),
      extractFunctionSource(contentSource, "describeUploadTriggerForDebug"),
      extractFunctionSource(contentSource, "sanitizeDownloadFileNameSegment"),
      extractFunctionSource(contentSource, "logSanitizedFileHandoffFailure"),
      extractFunctionSource(contentSource, "performPendingGeminiUserAttach"),
      extractFunctionSource(contentSource, "getGrokFileHandoff"),
      extractFunctionSource(contentSource, "findGrokUploadButton"),
      extractFunctionSource(contentSource, "openGrokUploadButtonSafely"),
      extractFunctionSource(contentSource, "waitForGrokPendingFileInput"),
      extractFunctionSource(contentSource, "performPendingGrokUserAttach"),
      extractFunctionSource(contentSource, "clearPendingGeminiGhostIngressClickInterceptor"),
      extractFunctionSource(contentSource, "clearPendingGeminiSanitizedFileHandoff"),
      extractFunctionSource(contentSource, "isLikelyGeminiUploadClickTarget"),
      extractFunctionSource(pendingSanitizedFileHandoffSource, "schedulePendingGeminiSanitizedFileAttempt"),
      extractFunctionSource(contentSource, "describeGeminiHandoffDiscovery"),
      extractFunctionSource(contentSource, "attemptPendingGeminiSanitizedFileHandoff"),
      extractFunctionSource(contentSource, "queuePendingGeminiSanitizedFileHandoff"),
      extractFunctionSource(contentSource, "clearPendingGrokSanitizedFileHandoff"),
      extractFunctionSource(contentSource, "getGrokUploadClickCandidates"),
      extractFunctionSource(contentSource, "isLikelyGrokUploadClickTarget"),
      extractFunctionSource(contentSource, "scoreGrokFileInput"),
      extractFunctionSource(contentSource, "discoverGrokPendingFileInput"),
      extractFunctionSource(contentSource, "describeGrokPendingInputDiscovery"),
      extractFunctionSource(pendingSanitizedFileHandoffSource, "schedulePendingGrokSanitizedFileAttempt"),
      extractFunctionSource(contentSource, "attemptPendingGrokSanitizedFileHandoff"),
      extractFunctionSource(contentSource, "queuePendingGrokSanitizedFileHandoff"),
      extractFunctionSource(contentSource, "clearPendingGenericSanitizedFileHandoff"),
      extractFunctionSource(contentSource, "queuePendingGenericSanitizedFileHandoff"),
      extractFunctionSource(contentSource, "hasPendingGrokSanitizedFileHandoff"),
      extractFunctionSource(contentSource, "getPendingGrokSanitizedFileHandoffDebug"),
      extractFunctionSource(contentSource, "createSanitizedPayload"),
      extractFunctionSource(contentSource, "fallbackLanguageFromFileName"),
      extractFunctionSource(contentSource, "geminiFallbackLanguageFromFileName"),
      extractFunctionSource(contentSource, "formatSanitizedFileFallbackText"),
      extractFunctionSource(contentSource, "formatGeminiSanitizedFileFallbackText"),
      extractFunctionSource(contentSource, "tryGeminiSanitizedFileAttach"),
      extractFunctionSource(contentSource, "getFileInputPreparation"),
      extractFunctionSource(contentSource, "fileInputAcceptsHandoffFiles"),
      extractFunctionSource(contentSource, "getFileHandoffDiscovery"),
      extractFunctionSource(contentSource, "collectFileInputsFromAncestry"),
      extractFunctionSource(contentSource, "collectFileHandoffElementsFromRoot"),
      extractFunctionSource(contentSource, "isWithinGeminiImagesFilesUploader"),
      extractFunctionSource(contentSource, "scoreGeminiFileInput"),
      extractFunctionSource(contentSource, "discoverGeminiFileHandoffElements"),
      extractFunctionSource(contentSource, "collectRootsWithOpenShadow"),
      extractFunctionSource(contentSource, "listFirefoxGeminiBridgeSanitizedFiles"),
      extractFunctionSource(contentSource, "createFirefoxGeminiFileInputBridgeDebug"),
      extractFunctionSource(contentSource, "createFirefoxGeminiBridgeDataTransfer"),
      extractFunctionSource(contentSource, "findGeminiFileInput"),
      extractFunctionSource(contentSource, "isGeminiUploadMenuButtonVisible"),
      extractFunctionSource(contentSource, "isUnsafeGeminiUploadMenuButton"),
      extractFunctionSource(contentSource, "hasGeminiUploadMenuIntent"),
      extractFunctionSource(contentSource, "isGeminiSourceUploadIcon"),
      extractFunctionSource(contentSource, "isSafeGeminiUploadMenuButton"),
      extractFunctionSource(contentSource, "collectGeminiUploadMenuButtonsFromRoot"),
      extractFunctionSource(contentSource, "findGeminiUploadMenuButton"),
      extractFunctionSource(contentSource, "describeGeminiUploadMenuDiscovery"),
      extractFunctionSource(contentSource, "createGeminiUploadMenuEvent"),
      extractFunctionSource(contentSource, "isGeminiFileDataInputElement"),
      extractFunctionSource(contentSource, "findGeminiFileDataInputFromEvent"),
      extractFunctionSource(contentSource, "findGeminiFileDataInputInNode"),
      extractFunctionSource(contentSource, "findGeminiFileDataInputInMutations"),
      extractFunctionSource(contentSource, "createGeminiFirefoxFilePickerGuard"),
      extractFunctionSource(contentSource, "countGeminiAttachmentIndicators"),
      extractFunctionSource(contentSource, "waitForGeminiAttachmentIndicators"),
      extractFunctionSource(contentSource, "getGeminiUploadDiscovery"),
      extractFunctionSource(contentSource, "getGeminiFileHandoff"),
      extractFunctionSource(contentSource, "openGeminiUploadMenuSafely"),
      extractFunctionSource(contentSource, "isSafeGeminiUploadFilesMenuItem"),
      extractFunctionSource(contentSource, "collectGeminiUploadFilesMenuItemsFromRoot"),
      extractFunctionSource(contentSource, "findGeminiUploadFilesMenuItem"),
      extractFunctionSource(contentSource, "openGeminiUploadFilesMenuItemSafely"),
      extractFunctionSource(contentSource, "isGeminiHiddenFileSelectorTrigger"),
      extractFunctionSource(contentSource, "collectGeminiHiddenFileSelectorTriggersFromRoot"),
      extractFunctionSource(contentSource, "findGeminiHiddenFileSelectorTrigger"),
      extractFunctionSource(contentSource, "findGeminiHiddenFileSelectorTriggerInNode"),
      extractFunctionSource(contentSource, "findGeminiHiddenFileSelectorTriggerInMutations"),
      extractFunctionSource(contentSource, "activateGeminiHiddenFileSelectorTriggerSafely"),
      extractFunctionSource(contentSource, "waitForGeminiUploadFilesMenuItem"),
      extractFunctionSource(contentSource, "discoverGeminiUploadOverlayItem"),
      extractFunctionSource(contentSource, "describeGeminiOverlayExposure"),
      extractFunctionSource(contentSource, "isGeminiGhostIngressFileInput"),
      extractFunctionSource(contentSource, "waitForGeminiFileInput"),
      extractFunctionSource(contentSource, "verifyGeminiFirefoxFileInputBridgeAssignment"),
      extractFunctionSource(contentSource, "primeGeminiFirefoxUploadTarget"),
      extractFunctionSource(contentSource, "handOffPrimedGeminiFirefoxUploadTarget"),
      extractFunctionSource(contentSource, "tryFirefoxGeminiFileInputBridge"),
      extractFunctionSource(contentSource, "buildSanitizedDownloadFileName"),
      extractFunctionSource(contentSource, "applySanitizedTextFallback"),
      extractFunctionSource(contentSource, "readSanitizedFileTextForFallback"),
      `const {
        applyGeminiEditorText,
        applyGeminiSanitizedTextFallback,
        insertGeminiSanitizedText
      } = globalThis.PWM.GeminiFallbackWriter.createGeminiFallbackWriter({
        applyPasteDecision,
        confirmGeminiLargeSanitizedTextInsertion,
        contentDebugEvents: CONTENT_DEBUG_EVENTS,
        describeFileForDebug,
        documentRef: document,
        emitDebug: debugReveal,
        emitFileAttachMetadata: debugFileAttachMetadata,
        findComposer,
        formatSanitizedFileFallbackText,
        geminiSanitizedTextFallbackMessage: GEMINI_SANITIZED_TEXT_FALLBACK_MESSAGE,
        getInputText,
        getSelectionOffsets,
        hideBadgeSoon,
        insertGeminiEditorText,
        isGeminiHost,
        locationRef: location,
        normalizeComposerText,
        refreshBadgeFromCurrentInput,
        resolveGeminiFallbackEditor,
        rewriteComposerTransactionally,
        setBadge,
        setGeminiDmzOverlayState,
        showMessageModal
      });`,
      ...fileHandoffFlowHarnessSource({ includeLegacyLocalFile: false }),
      extractFunctionSource(contentSource, "isForbiddenGeminiUploadButton"),
      extractFunctionSource(contentSource, "isAllowedGeminiUploadMenuOpener"),
      extractFunctionSource(contentSource, "clickElementSafely"),
      extractFunctionSource(contentSource, "shouldUseContentFileExtractionPipeline"),
      extractFunctionSource(contentSource, "isImageContentExtractionResult"),
      extractFunctionSource(contentSource, "getContentExtractionBlockedTitle"),
      extractFunctionSource(contentSource, "getImageContentExtractionBlockedMessage"),
      extractFunctionSource(contentSource, "getContentExtractionBlockedMessage"),
      extractFunctionSource(contentSource, "localFileFromContentExtractionResult"),
      extractFunctionSource(contentSource, "isUnsupportedLegacyOfficeFile"),
      extractFunctionSource(contentSource, "isUnsupportedBinaryFileForProtectedUpload"),
      extractFunctionSource(contentSource, "getLocalFileExtension"),
      extractFunctionSource(contentSource, "getLocalFileMimeType"),
      extractFunctionSource(contentSource, "isUnsupportedImageFileForProtectedUpload"),
      extractFunctionSource(contentSource, "isUnsupportedProtectedImageTransfer"),
      extractFunctionSource(contentSource, "shouldFailClosedProtectedUnsupportedFileTransfer"),
      extractFunctionSource(contentSource, "createSingleFileDataTransfer"),
      extractFunctionSource(contentSource, "getLocalFileSafeMetadata"),
      extractFunctionSource(contentSource, "getSanitizedFileBatchProcessor"),
      extractFunctionSource(contentSource, "summarizeMultiFileItem"),
      extractFunctionSource(contentSource, "getFileHandoffVerification"),
      extractFunctionSource(contentSource, "isExpectedWhatsAppSanitizedMultiFileAttachFile"),
      extractFunctionSource(contentSource, "verifyWhatsAppSanitizedMultiFileAttach"),
      extractFunctionSource(contentSource, "processLocalFileForSanitizedBatch"),
      extractFunctionSource(contentSource, "shouldUseWhatsAppDocumentInputForFiles"),
      extractFunctionSource(contentSource, "resolveWhatsAppDocumentDropInputForHandoff"),
      extractFunctionSource(contentSource, "prepareFileInputForSanitizedHandoff"),
      extractFunctionSource(contentSource, "getSanitizedFileHandoff"),
      extractFunctionSource(contentSource, "handOffSanitizedFileBatch"),
      extractFunctionSource(contentSource, "getMultiFileInsertOrchestration"),
      extractFunctionSource(contentSource, "maybeHandleMultiFileInsert"),
      extractFunctionSource(contentSource, "getStreamingFileInsertOrchestration"),
      extractFunctionSource(contentSource, "getLocalFileReadOrchestration"),
      extractFunctionSource(contentSource, "getLocalFileAttachPreflightOrchestration"),
      extractFunctionSource(contentSource, "getLocalFileSanitizationOrchestration"),
      extractFunctionSource(contentSource, "getSanitizedFileInsertOrchestration"),
      extractFunctionSource(contentSource, "getLocalFileInsertOrchestration"),
      extractFunctionSource(contentSource, "maybeHandleLocalFileInsert"),
      extractFunctionSource(contentSource, "getPasteOrchestration"),
      extractFunctionSource(contentSource, "maybeHandlePaste"),
      extractFunctionSource(contentSource, "getFileDropOrchestration"),
      extractFunctionSource(contentSource, "maybeHandleDrop"),
      extractFunctionSource(contentSource, "maybeHandleFileDrag"),
      'let lastGeminiDropSessionHash = "";',
      extractFunctionSource(contentSource, "maybeHandleFileInputChange"),
      "return { maybeHandleChatGptLargeTextPaste, maybeHandlePaste, maybeHandleDrop, maybeHandleFileDrag, maybeHandleFileInputChange, handOffSanitizedFileInput, resolveFileDragGuardPolicy, hasPendingGrokSanitizedFileHandoff, getPendingGrokSanitizedFileHandoffDebug, markWhatsAppSanitizedImageHandoff, shouldBypassWhatsAppSanitizedImageSend, getSuppressInputScanUntil: () => suppressInputScanUntil, isProgrammaticInputScanSuppressed };"
    ].join("\n\n")
  );
  const handlers = factory(...Object.values(dependencies));

  return {
    ...handlers,
    calls,
    activeElement
  };
}

function createFileInput({
  source = "light-dom",
  disabled = false,
  multiple = false,
  inGeminiUploader = false,
  name = "",
  accept = ".env,text/plain"
} = {}) {
  const events = [];
  const eventObjects = [];
  return {
    nodeType: 1,
    tagName: "INPUT",
    type: "file",
    name,
    disabled,
    hidden: source !== "light-dom",
    accept,
    multiple,
    files: [],
    events,
    eventObjects,
    closest(selector) {
      return selector === "images-files-uploader" && inGeminiUploader
        ? { tagName: "IMAGES-FILES-UPLOADER" }
        : null;
    },
    getAttribute(attributeName) {
      if (attributeName === "name") return this.name;
      if (attributeName === "type") return this.type;
      if (attributeName === "class") return "";
      if (attributeName === "accept") return this.accept;
      return "";
    },
    matches(selector) {
      if (selector === 'input[type="file"][name="Filedata"]') {
        return this.type === "file" && this.name === "Filedata";
      }
      if (selector === "input[type='file']" || selector === 'input[type="file"]') {
        return this.type === "file";
      }
      return false;
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

function createGeminiSourceUploadIcon({
  text = "add_2",
  className = "upload-icon google-symbols icon-filled gds-icon-l",
  onClick = null
} = {}) {
  const events = [];
  return {
    nodeType: 1,
    tagName: "MAT-ICON",
    className,
    innerText: text,
    textContent: text,
    disabled: false,
    hidden: false,
    events,
    getAttribute(name) {
      if (name === "class") return className;
      if (name === "aria-hidden") return "";
      return "";
    },
    matches(selector) {
      return (
        (selector === "mat-icon.upload-icon" || selector === ".upload-icon") &&
        /\bupload-icon\b/.test(className)
      );
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
    },
    click() {
      events.push("click");
      if (typeof onClick === "function") {
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
  dataTestId = "",
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
      if (name === "data-test-id") return dataTestId;
      return "";
    },
    matches(selector) {
      return (
        selector === '[role="menuitem"]' ||
        selector === "button" ||
        (selector === 'button[data-test-id="local-images-files-uploader-button"]' &&
          dataTestId === "local-images-files-uploader-button") ||
        (selector === 'button[role="menuitem"][aria-label*="Upload files"]' &&
          role === "menuitem" &&
          ariaLabel.includes("Upload files"))
      );
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

function createHiddenFileSelectorTrigger({ onClick = null } = {}) {
  const events = [];
  return {
    nodeType: 1,
    tagName: "BUTTON",
    className: "hidden-local-file-image-selector-button",
    disabled: false,
    events,
    getAttribute(name) {
      if (name === "class") return this.className;
      if (name === "xapfileselectortrigger") return "";
      if (name === "aria-hidden") return "true";
      return "";
    },
    hasAttribute(name) {
      return name === "xapfileselectortrigger" || name === "aria-hidden";
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

function createClickEvent(target, path = null) {
  const calls = {
    preventDefault: 0,
    stopPropagation: 0,
    stopImmediatePropagation: 0
  };
  const event = {
    type: "click",
    target,
    defaultPrevented: false,
    propagationStopped: false,
    immediatePropagationStopped: false,
    preventDefault() {
      calls.preventDefault += 1;
      event.defaultPrevented = true;
    },
    stopPropagation() {
      calls.stopPropagation += 1;
      event.propagationStopped = true;
    },
    stopImmediatePropagation() {
      calls.stopImmediatePropagation += 1;
      event.immediatePropagationStopped = true;
    },
    composedPath: Array.isArray(path) ? () => path : undefined
  };
  return { event, calls };
}

function triggerGhostIngressTimeout(harness) {
  harness.timeoutCallbacks
    .filter((entry) => entry.delay === 2200)
    .forEach((entry) => entry.callback());
}

function createHandoffHarness({
  hostname = "gemini.google.com",
  userAgent = "Chrome",
  fileInputs = [],
  shadowInputs = [],
  uploadTriggers = [],
  hiddenTriggers = [],
  overlayItems = [],
  attachmentIndicators = [],
  documentRemoveEventListenerThrows = false,
  sendRuntimeMessage = async (_message) => ({ ok: true, downloadId: 77 })
} = {}) {
  const debugEvents = [];
  const consoleErrors = [];
  const fallbackDrops = [];
  const badges = [];
  const clickHandlers = [];
  const windowClickHandlers = [];
  const windowPointerHandlers = [];
  const windowMouseDownHandlers = [];
  const documentPointerHandlers = [];
  const documentMouseDownHandlers = [];
  const listenerEvents = [];
  const timeoutCallbacks = [];
  const observers = [];
  const clearedTimeouts = [];
  const runtimeMessages = [];
  const promptNodes = [];
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
  class TestPointerEvent extends TestMouseEvent {}

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

    trigger(mutations = []) {
      this.callback(mutations);
    }
  }

  const shadowHosts = shadowInputs.map((input) => ({
    shadowRoot: {
      querySelectorAll(selector) {
        if (
          selector === "input[type='file']" ||
          selector === 'input[type="file"]' ||
          selector === 'input[type="file"][name="Filedata"]' ||
          selector === 'input[type="file"][multiple]'
        ) {
          return [input];
        }
      if (
        selector === 'button[aria-label="Add files"]' ||
        selector === 'button[aria-label="Open upload file menu"]' ||
        selector === 'button[aria-label*="upload" i]' ||
        selector === 'button[aria-label*="attach" i]' ||
        selector === 'button[aria-label*="add" i]' ||
        selector === 'button[data-test-id="local-images-files-uploader-button"]' ||
        selector === 'button[role="menuitem"][aria-label*="Upload files"]' ||
        selector === "button.upload-card-button" ||
        selector === "mat-icon.upload-icon" ||
        selector === '[role="button"][aria-label*="add files" i]' ||
          selector === '[role="button"][aria-label*="upload" i]' ||
          selector === '[role="button"][aria-label*="attach" i]' ||
          selector === "[data-test-id*='upload' i]" ||
          selector === "[data-test-id*='attach' i]" ||
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
  function createDomElement(tagName) {
    const listeners = new Map();
    const element = {
      nodeType: 1,
      tagName: String(tagName || "").toUpperCase(),
      className: "",
      textContent: "",
      type: "",
      files: [],
      dataset: {},
      attributes: {},
      children: [],
      parentNode: null,
      isConnected: false,
      setAttribute(name, value) {
        this.attributes[name] = String(value);
      },
      getAttribute(name) {
        return this.attributes[name] || "";
      },
      append(...children) {
        children.forEach((child) => this.appendChild(child));
      },
      appendChild(child) {
        child.parentNode = this;
        child.isConnected = true;
        this.children.push(child);
        return child;
      },
      removeChild(child) {
        const index = this.children.indexOf(child);
        if (index !== -1) this.children.splice(index, 1);
        child.parentNode = null;
        child.isConnected = false;
        return child;
      },
      addEventListener(type, handler) {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(handler);
      },
      removeEventListener(type, handler) {
        const handlers = listeners.get(type) || [];
        const index = handlers.indexOf(handler);
        if (index !== -1) handlers.splice(index, 1);
      },
      dispatchEvent(event) {
        (listeners.get(event.type) || []).forEach((handler) => handler(event));
        return true;
      },
      querySelectorAll() {
        return [];
      }
    };
    return element;
  }
  const documentElement = createDomElement("html");
  const originalDocumentElementAppendChild = documentElement.appendChild.bind(documentElement);
  documentElement.appendChild = (child) => {
    promptNodes.push(child);
    return originalDocumentElementAppendChild(child);
  };
  const documentRoot = {
    documentElement,
    createElement(tagName) {
      return createDomElement(tagName);
    },
    addEventListener(type, handler) {
      if (type === "click") clickHandlers.push(handler);
      if (type === "pointerdown") documentPointerHandlers.push(handler);
      if (type === "mousedown") documentMouseDownHandlers.push(handler);
    },
    removeEventListener(type, handler) {
      if (documentRemoveEventListenerThrows) {
        throw new Error("remove listener failed");
      }
      const handlers =
        type === "click"
          ? clickHandlers
          : type === "pointerdown"
            ? documentPointerHandlers
            : type === "mousedown"
              ? documentMouseDownHandlers
              : null;
      if (!handlers) return;
      const index = handlers.indexOf(handler);
      if (index !== -1) handlers.splice(index, 1);
    },
    querySelectorAll(selector) {
      stats.documentQueries += 1;
      if (
        selector === "input[type='file']" ||
        selector === 'input[type="file"]' ||
        selector === 'input[type="file"][name="Filedata"]' ||
        selector === 'input[type="file"][multiple]'
      ) {
        return fileInputs;
      }
      if (
        selector === ".cdk-overlay-container" ||
        selector === ".cdk-overlay-pane" ||
        selector === 'mat-action-list[role="menu"]' ||
        selector === '[role="menuitem"]' ||
        selector === 'button[data-test-id="local-images-files-uploader-button"]' ||
        selector === 'button[role="menuitem"][aria-label*="Upload files"]' ||
        selector === "button"
      ) {
        if (selector === "button") return [...uploadTriggers, ...overlayItems, ...hiddenTriggers];
        return overlayItems.filter((item) => item.matches?.(selector) || selector !== "button");
      }
      if (
        selector === "button.hidden-local-file-image-selector-button[xapfileselectortrigger]" ||
        selector === ".hidden-local-file-image-selector-button[xapfileselectortrigger]" ||
        selector === "button.hidden-local-file-image-selector-button" ||
        selector === ".hidden-local-file-image-selector-button"
      ) {
        return hiddenTriggers;
      }
      if (selector === "mat-icon.upload-icon" || selector === ".upload-icon") {
        return uploadTriggers.filter(
          (trigger) =>
            trigger.matches?.(selector) ||
            /\bupload-icon\b/.test(String(trigger.className || trigger.getAttribute?.("class") || ""))
        );
      }
      if (
        selector === 'button[aria-label="Add files"]' ||
        selector === 'button[aria-label="Open upload file menu"]' ||
        selector === 'button[aria-label*="upload" i]' ||
        selector === 'button[aria-label*="attach" i]' ||
        selector === 'button[aria-label*="add" i]' ||
        selector === "button.upload-card-button" ||
        selector === '[role="button"][aria-label*="add files" i]' ||
        selector === '[role="button"][aria-label*="upload" i]' ||
        selector === '[role="button"][aria-label*="attach" i]' ||
        selector === "[data-test-id*='upload' i]" ||
        selector === "[data-test-id*='attach' i]" ||
        selector === 'button[aria-label*="upload" i]' ||
        selector === 'button[aria-label*="file" i]' ||
        selector === 'button[aria-label*="attach" i]' ||
        selector === "button"
      ) {
        return uploadTriggers;
      }
      if (
        selector === "images-files-uploader" ||
        selector === "file-preview" ||
        selector === "attachment-chip" ||
        selector === "mat-chip" ||
        selector === "[data-test-id*='attachment' i]" ||
        selector === "[data-test-id*='upload' i]" ||
        selector === "[aria-label*='attachment' i]" ||
        selector === "[aria-label*='uploaded' i]" ||
        selector === "[aria-label*='uploading' i]" ||
        selector === "[aria-label*='file attached' i]" ||
        selector === "[role='progressbar']"
      ) {
        return attachmentIndicators;
      }
      if (selector === "*") return shadowHosts;
      return [];
    }
  };

  const dependencies = {
    Node: { ELEMENT_NODE: 1 },
    Event: TestEvent,
    MouseEvent: TestMouseEvent,
    PointerEvent: TestPointerEvent,
    DragEvent: undefined,
    ClipboardEvent: undefined,
    DataTransfer: TestDataTransfer,
    MutationObserver: TestMutationObserver,
    FilePasteHelpers: globalThis.PWM.FilePasteHelpers,
    FileInputPreparation: globalThis.PWM.FileInputPreparation || {},
    FileHandoffDiscovery: globalThis.PWM.FileHandoffDiscovery || {},
    SanitizedFileHandoff: globalThis.PWM.SanitizedFileHandoff || {},
    WhatsAppSelectors: {},
    FileDropInterception: globalThis.PWM.FileDropInterception || {},
    FileProcessingUi: globalThis.PWM.FileProcessingUi || {},
    GeminiUploadDiscovery: globalThis.PWM.GeminiUploadDiscovery || {},
    GeminiFileHandoff: globalThis.PWM.GeminiFileHandoff || {},
    GrokFileHandoff: globalThis.PWM.GrokFileHandoff || {},
    navigator: { userAgent },
    location: { hostname },
    currentPublicState: {
      transformMode: "hide_public",
      placeholderCount: 0,
      trustedPlaceholders: [],
      policy: {
        allowProtectionPause: true,
        strictFailure: false
      },
      protection: {
        paused: false,
        pausedUntil: 0,
        allowProtectionPause: true,
        protectionEnforced: false
      }
    },
    window: {
      addEventListener(type, handler, options) {
        listenerEvents.push({ target: "window", action: "add", type, capture: options === true || Boolean(options?.capture) });
        if (type === "click") windowClickHandlers.push(handler);
        if (type === "pointerdown") windowPointerHandlers.push(handler);
        if (type === "mousedown") windowMouseDownHandlers.push(handler);
      },
      removeEventListener(type, handler, options) {
        listenerEvents.push({ target: "window", action: "remove", type, capture: options === true || Boolean(options?.capture) });
        const handlers =
          type === "click"
            ? windowClickHandlers
            : type === "pointerdown"
              ? windowPointerHandlers
              : type === "mousedown"
                ? windowMouseDownHandlers
                : null;
        if (!handlers) return;
        const index = handlers.indexOf(handler);
        if (index !== -1) handlers.splice(index, 1);
      }
    },
    document: documentRoot,
    setBadge: (...args) => badges.push(args),
    hideBadgeSoon: () => {},
    refreshBadgeFromCurrentInput: () => {},
    showMessageModal: async () => {},
    sendRuntimeMessage: async (message) => {
      runtimeMessages.push(message);
      return sendRuntimeMessage(message);
    },
    handleContentError: (error) => {
      throw error;
    },
    setTimeout: (callback, delay = 0) => {
      const id = timeoutCallbacks.length + 1;
      timeoutCallbacks.push({ id, callback, delay });
      if (delay === 0) callback();
      if (delay === 450 || delay === 2500 || delay === 3000) Promise.resolve().then(callback);
      return id;
    },
    clearTimeout: (id) => {
      clearedTimeouts.push(id);
    },
    console: {
      error: (...args) => consoleErrors.push(args)
    },
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
      "const GEMINI_GHOST_INGRESS_TIMEOUT_MS = 2200;",
      "const GEMINI_PENDING_SANITIZED_FILE_HANDOFF_MS = 60000;",
      "const GROK_PENDING_SANITIZED_FILE_HANDOFF_MS = 60000;",
      "const SANITIZED_FILE_HANDOFF_SUPPRESS_MS = 30000;",
      "const PROGRAMMATIC_INPUT_SUPPRESS_MS = 500;",
      'const GEMINI_PENDING_SANITIZED_FILE_HANDOFF_MESSAGE = "Large file sanitized. Click Attach sanitized file or Gemini Upload files.";',
      'const GROK_PENDING_SANITIZED_FILE_HANDOFF_MESSAGE = "Large file sanitized. Click Attach sanitized file or Grok Upload/Attach.";',
      "let pendingGeminiSanitizedFileHandoff = null;",
      "let pendingGeminiSanitizedFileObserver = null;",
      "let pendingGeminiSanitizedFileTimer = 0;",
      "let pendingGeminiSanitizedFileClickHandler = null;",
      "let pendingGrokSanitizedFileHandoff = null;",
      "let pendingGrokSanitizedFileObserver = null;",
      "let pendingGrokSanitizedFileTimer = 0;",
      "let pendingGrokSanitizedFileClickHandler = null;",
      "let pendingGenericSanitizedFileHandoff = null;",
      "let pendingGenericSanitizedFileTimer = 0;",
      "let fileInputPreparation = null;",
      "let fileHandoffDiscovery = null;",
      "let sanitizedFileHandoff = null;",
      "let whatsAppSelectors = null;",
      "let fileProcessingUi = null;",
      "let geminiUploadDiscovery = null;",
      "let geminiFileHandoff = null;",
      "let grokFileHandoff = null;",
      "let fileDropInterception = null;",
      "let syntheticFileListCapabilityCache = null;",
      "let inputFileAssignmentCapabilityCache = null;",
      "const geminiSanitizedDownloadFallbacks = new WeakSet();",
      'const GEMINI_SANITIZED_DOWNLOAD_MESSAGE = "Sanitized file downloaded. Upload the LeakGuard redacted copy to Gemini.";',
      'const GEMINI_SANITIZED_DOWNLOAD_MODAL_MESSAGE = "Gemini does not expose a safe upload target. LeakGuard downloaded a sanitized copy. Upload that redacted file manually.";',
      'const FIREFOX_GEMINI_FILE_INPUT_BRIDGE_FAILURE_MESSAGE = "LeakGuard blocked the raw file drop. Could not locate Gemini upload input. Please use the upload button or retry.";',
      ...contentDebugEventsHarnessSource(),
      ...fileHandoffAdapterHarnessSource(),
      "function setDmzOverlayState() {}",
      "function setGeminiDmzOverlayState() {}",
      "function hideDmzOverlay() {}",
      extractFunctionSource(contentSource, "getFileProcessingUi"),
      extractFunctionSource(contentSource, "formatFileProcessingProgress"),
      extractFunctionSource(contentSource, "showFileProcessingOverlay"),
      extractFunctionSource(contentSource, "updateFileProcessingOverlay"),
      extractFunctionSource(contentSource, "hideFileProcessingOverlay"),
      extractFunctionSource(contentSource, "showFileProcessingSuccess"),
      extractFunctionSource(contentSource, "showFileProcessingError"),
      extractFunctionSource(contentSource, "clearPendingSanitizedAttachPrompt"),
      extractFunctionSource(contentSource, "getPendingSanitizedAttachPromptMessage"),
      extractFunctionSource(contentSource, "describeSanitizedFileOrBatchForDebug"),
      extractFunctionSource(contentSource, "showPendingSanitizedAttachPrompt"),
      extractFunctionSource(contentSource, "consumeInterceptionEvent"),
      extractFunctionSource(contentSource, "normalizeTarget"),
      extractFunctionSource(contentSource, "isFirefoxRuntime"),
      extractFunctionSource(contentSource, "createSafeCapabilityProbeFile"),
      extractFunctionSource(contentSource, "canUseSyntheticDataTransferFileList"),
      extractFunctionSource(contentSource, "canAssignFilesToInput"),
      extractFunctionSource(contentSource, "shouldUseFirefoxTextFallbackForFileHandoff"),
      extractFunctionSource(contentSource, "isExpectedFirefoxGeminiNoPickerMiss"),
      extractFunctionSource(contentSource, "shouldQueueFirefoxGeminiPendingSanitizedFileHandoff"),
      ...fileHandoffStateHarnessSource(),
      ...fileHandoffPendingHarnessSource(),
      extractFunctionSource(contentSource, "isSanitizedFileHandoffEvent"),
      extractFunctionSource(contentSource, "markSanitizedFileHandoffEvent"),
      extractFunctionSource(contentSource, "listLocalTransferFiles"),
      extractFunctionSource(contentSource, "createSanitizedDataTransfer"),
      extractFunctionSource(contentSource, "createSanitizedDataTransferForHandoff"),
      extractFunctionSource(contentSource, "attachEventDataTransfer"),
      extractFunctionSource(contentSource, "dispatchSanitizedFileEvent").replace(
        "target.dispatchEvent(handoffEvent);",
        "fallbackDrops.push({ target, handoffEvent }); target.dispatchEvent(handoffEvent);"
      ),
      extractFunctionSource(contentSource, "isGeminiHost"),
      extractFunctionSource(contentSource, "isGrokHost"),
      extractFunctionSource(contentSource, "isChatGptHost"),
      extractFunctionSource(contentSource, "isClaudeHost"),
      extractFunctionSource(contentSource, "isWhatsAppHandoffContext"),
      extractFunctionSource(contentSource, "getCurrentHandoffDriverId"),
      extractFunctionSource(contentSource, "getActiveProtection"),
      extractFunctionSource(contentSource, "isProtectedFileDropDriver"),
      extractFunctionSource(contentSource, "isFileInputElement"),
      extractFunctionSource(contentSource, "describeFileForDebug"),
      extractFunctionSource(contentSource, "describeFileInputForDebug"),
      extractFunctionSource(contentSource, "logFileInterception"),
      extractFunctionSource(contentSource, "getSafeTextSnippet"),
      extractFunctionSource(contentSource, "describeElementForDebug"),
      extractFunctionSource(contentSource, "originalFileMetadataFromEvent"),
      extractFunctionSource(contentSource, "createSanitizedFileHandoffDetails"),
      extractFunctionSource(contentSource, "sanitizeDownloadFileNameSegment"),
      extractFunctionSource(contentSource, "buildSanitizedDownloadFileName"),
      extractFunctionSource(contentSource, "buildGeminiSanitizedDownloadFileName"),
      extractFunctionSource(contentSource, "downloadGeminiSanitizedFileFallback"),
      extractFunctionSource(contentSource, "hasGeminiSanitizedDownloadFallback"),
      extractFunctionSource(contentSource, "logSanitizedFileHandoffFailure"),
      extractFunctionSource(contentSource, "performPendingGeminiUserAttach"),
      extractFunctionSource(contentSource, "getGrokFileHandoff"),
      extractFunctionSource(contentSource, "findGrokUploadButton"),
      extractFunctionSource(contentSource, "openGrokUploadButtonSafely"),
      extractFunctionSource(contentSource, "waitForGrokPendingFileInput"),
      extractFunctionSource(contentSource, "performPendingGrokUserAttach"),
      extractFunctionSource(contentSource, "clearPendingGeminiSanitizedFileHandoff"),
      extractFunctionSource(contentSource, "isLikelyGeminiUploadClickTarget"),
      extractFunctionSource(pendingSanitizedFileHandoffSource, "schedulePendingGeminiSanitizedFileAttempt"),
      extractFunctionSource(contentSource, "describeGeminiHandoffDiscovery"),
      extractFunctionSource(contentSource, "describeGeminiOverlayExposure"),
      extractFunctionSource(contentSource, "attemptPendingGeminiSanitizedFileHandoff"),
      extractFunctionSource(contentSource, "queuePendingGeminiSanitizedFileHandoff"),
      extractFunctionSource(contentSource, "hasPendingGeminiSanitizedFileHandoff"),
      extractFunctionSource(contentSource, "getPendingGeminiSanitizedFileHandoffDebug"),
      extractFunctionSource(contentSource, "clearPendingGrokSanitizedFileHandoff"),
      extractFunctionSource(contentSource, "getGrokUploadClickCandidates"),
      extractFunctionSource(contentSource, "isLikelyGrokUploadClickTarget"),
      extractFunctionSource(contentSource, "scoreGrokFileInput"),
      extractFunctionSource(contentSource, "discoverGrokPendingFileInput"),
      extractFunctionSource(contentSource, "describeGrokPendingInputDiscovery"),
      extractFunctionSource(pendingSanitizedFileHandoffSource, "schedulePendingGrokSanitizedFileAttempt"),
      extractFunctionSource(contentSource, "attemptPendingGrokSanitizedFileHandoff"),
      extractFunctionSource(contentSource, "queuePendingGrokSanitizedFileHandoff"),
      extractFunctionSource(contentSource, "clearPendingGenericSanitizedFileHandoff"),
      extractFunctionSource(contentSource, "queuePendingGenericSanitizedFileHandoff"),
      extractFunctionSource(contentSource, "hasPendingGrokSanitizedFileHandoff"),
      extractFunctionSource(contentSource, "getPendingGrokSanitizedFileHandoffDebug"),
      extractFunctionSource(contentSource, "getFileHandoffDiscovery"),
      extractFunctionSource(contentSource, "describeUploadTriggerForDebug"),
      extractFunctionSource(contentSource, "collectFileInputsFromAncestry"),
      extractFunctionSource(contentSource, "collectFileInputsFromRoot"),
      extractFunctionSource(contentSource, "getFileInputPreparation"),
      extractFunctionSource(contentSource, "fileInputAcceptsHandoffFiles"),
      extractFunctionSource(contentSource, "scoreFileInputForHandoff"),
      extractFunctionSource(contentSource, "collectFileHandoffElementsFromRoot"),
      extractFunctionSource(contentSource, "isWithinGeminiImagesFilesUploader"),
      extractFunctionSource(contentSource, "scoreGeminiFileInput"),
      extractFunctionSource(contentSource, "discoverGeminiFileHandoffElements"),
      extractFunctionSource(contentSource, "collectRootsWithOpenShadow"),
      extractFunctionSource(contentSource, "isRejectedGeminiUploadMenuItem"),
      extractFunctionSource(contentSource, "scoreGeminiUploadMenuItem"),
      extractFunctionSource(contentSource, "discoverGeminiUploadOverlayItem"),
      extractFunctionSource(contentSource, "countGeminiAttachmentIndicators"),
      extractFunctionSource(contentSource, "waitForGeminiAttachmentIndicators"),
      extractFunctionSource(contentSource, "discoverFileInputForHandoff"),
      extractFunctionSource(contentSource, "resolveFileInputForHandoff"),
      extractFunctionSource(contentSource, "waitForGeminiUploadMenuInput"),
      "function verifyWhatsAppSanitizedMultiFileAttach() { return { ok: false }; }",
      "function shouldUseWhatsAppDocumentInputForFiles() { return false; }",
      "async function resolveWhatsAppDocumentDropInputForHandoff() { return null; }",
      "function prepareFileInputForSanitizedHandoff() { return () => {}; }",
      extractFunctionSource(contentSource, "getSanitizedFileHandoff"),
      extractFunctionSource(contentSource, "handOffSanitizedFileInput"),
      extractFunctionSource(contentSource, "getGeminiFileHandoff"),
      extractFunctionSource(contentSource, "handOffGeminiSanitizedFileInput"),
      extractFunctionSource(contentSource, "readSanitizedFileTextForFallback"),
      extractFunctionSource(contentSource, "isForbiddenGeminiUploadButton"),
      extractFunctionSource(contentSource, "isAllowedGeminiUploadMenuOpener"),
      extractFunctionSource(contentSource, "clickElementSafely"),
      extractFunctionSource(contentSource, "isGeminiGhostIngressFileInput"),
      extractFunctionSource(contentSource, "clearPendingGeminiGhostIngressClickInterceptor"),
      extractFunctionSource(contentSource, "createGeminiGhostIngressClickInterceptor"),
      extractFunctionSource(contentSource, "waitForGeminiGhostIngressFileInput"),
      extractFunctionSource(contentSource, "handOffGeminiSanitizedFileUpload"),
      extractFunctionSource(contentSource, "listFirefoxGeminiBridgeSanitizedFiles"),
      extractFunctionSource(contentSource, "createFirefoxGeminiFileInputBridgeDebug"),
      extractFunctionSource(contentSource, "createFirefoxGeminiBridgeDataTransfer"),
      extractFunctionSource(contentSource, "findGeminiFileInput"),
      extractFunctionSource(contentSource, "isGeminiUploadMenuButtonVisible"),
      extractFunctionSource(contentSource, "isUnsafeGeminiUploadMenuButton"),
      extractFunctionSource(contentSource, "hasGeminiUploadMenuIntent"),
      extractFunctionSource(contentSource, "isGeminiSourceUploadIcon"),
      extractFunctionSource(contentSource, "isSafeGeminiUploadMenuButton"),
      extractFunctionSource(contentSource, "collectGeminiUploadMenuButtonsFromRoot"),
      extractFunctionSource(contentSource, "findGeminiUploadMenuButton"),
      extractFunctionSource(contentSource, "describeGeminiUploadMenuDiscovery"),
      extractFunctionSource(contentSource, "createGeminiUploadMenuEvent"),
      extractFunctionSource(contentSource, "isGeminiFileDataInputElement"),
      extractFunctionSource(contentSource, "findGeminiFileDataInputFromEvent"),
      extractFunctionSource(contentSource, "findGeminiFileDataInputInNode"),
      extractFunctionSource(contentSource, "findGeminiFileDataInputInMutations"),
      extractFunctionSource(contentSource, "createGeminiFirefoxFilePickerGuard"),
      extractFunctionSource(contentSource, "getGeminiUploadDiscovery"),
      extractFunctionSource(contentSource, "openGeminiUploadMenuSafely"),
      extractFunctionSource(contentSource, "isSafeGeminiUploadFilesMenuItem"),
      extractFunctionSource(contentSource, "collectGeminiUploadFilesMenuItemsFromRoot"),
      extractFunctionSource(contentSource, "findGeminiUploadFilesMenuItem"),
      extractFunctionSource(contentSource, "openGeminiUploadFilesMenuItemSafely"),
      extractFunctionSource(contentSource, "isGeminiHiddenFileSelectorTrigger"),
      extractFunctionSource(contentSource, "collectGeminiHiddenFileSelectorTriggersFromRoot"),
      extractFunctionSource(contentSource, "findGeminiHiddenFileSelectorTrigger"),
      extractFunctionSource(contentSource, "findGeminiHiddenFileSelectorTriggerInNode"),
      extractFunctionSource(contentSource, "findGeminiHiddenFileSelectorTriggerInMutations"),
      extractFunctionSource(contentSource, "activateGeminiHiddenFileSelectorTriggerSafely"),
      extractFunctionSource(contentSource, "waitForGeminiUploadFilesMenuItem"),
      extractFunctionSource(contentSource, "waitForGeminiFileInput"),
      extractFunctionSource(contentSource, "verifyGeminiFirefoxFileInputBridgeAssignment"),
      extractFunctionSource(contentSource, "primeGeminiFirefoxUploadTarget"),
      extractFunctionSource(contentSource, "handOffPrimedGeminiFirefoxUploadTarget"),
      extractFunctionSource(contentSource, "tryFirefoxGeminiFileInputBridge"),
      extractFunctionSource(contentSource, "handOffGrokSanitizedFileUpload"),
      ...fileHandoffFlowHarnessSource(),
      "return { handOffSanitizedLocalFile, handOffGeminiSanitizedFileUpload, primeGeminiFirefoxUploadTarget, handOffPrimedGeminiFirefoxUploadTarget, tryFirefoxGeminiFileInputBridge, findGeminiUploadMenuButton, openGeminiUploadMenuSafely, findGeminiUploadFilesMenuItem, openGeminiUploadFilesMenuItemSafely, waitForGeminiUploadFilesMenuItem, waitForGeminiFileInput, handOffGrokSanitizedFileUpload, resolveFileInputForHandoff, getFileHandoffAdapterById, getFileHandoffAdapterForLocation, isFileHandoffAdapterPendingAttachEnabled, queuePendingSanitizedFileHandoff, attemptPendingSanitizedFileHandoff, clearPendingSanitizedFileHandoff, cancelPendingSanitizedFileAttach, attemptPendingGeminiSanitizedFileHandoff, hasPendingGeminiSanitizedFileHandoff, getPendingGeminiSanitizedFileHandoffDebug, queuePendingGeminiSanitizedFileHandoff, queuePendingGrokSanitizedFileHandoff, attemptPendingGrokSanitizedFileHandoff, hasPendingGrokSanitizedFileHandoff, getPendingGrokSanitizedFileHandoffDebug, hasGeminiSanitizedDownloadFallback, clearPendingGeminiGhostIngressClickInterceptor, isAllowedGeminiUploadMenuOpener, clickElementSafely, activateGeminiHiddenFileSelectorTriggerSafely };"
    ].join("\n\n")
  );

  const handlers = factory(...Object.values(dependencies));
  return {
    ...handlers,
    debugEvents,
    consoleErrors,
    fallbackDrops,
    runtimeMessages,
    badges,
    clickHandlers,
    windowClickHandlers,
    windowPointerHandlers,
    windowMouseDownHandlers,
    documentPointerHandlers,
    documentMouseDownHandlers,
    listenerEvents,
    promptNodes,
    timeoutCallbacks,
    clearedTimeouts,
    observers,
    stats
  };
}

async function queuePendingGeminiHandoffThroughGhostTimeout(harness, event, sanitizedFile) {
  const handoffPromise = harness.handOffGeminiSanitizedFileUpload(event, null, sanitizedFile, {
    allowUploadUiClick: true
  });
  const ghostTimeout = harness.timeoutCallbacks.find((entry) => entry.delay === 2200);
  assert.ok(ghostTimeout, "expected Gemini ghost ingress timeout to drive pending handoff");
  ghostTimeout.callback();
  return await handoffPromise;
}

function createDmzOverlayHarness({
  hostname = "gemini.google.com",
  currentSiteProtected = true
} = {}) {
  const appended = [];
  const removed = [];
  const timeoutCallbacks = [];
  const clearedTimeouts = [];
  const debugEvents = [];
  const childrenFor = new WeakMap();

  function createElement(tagName) {
    const element = {
      tagName: String(tagName || "").toUpperCase(),
      className: "",
      textContent: "",
      dataset: {},
      attributes: {},
      parentNode: null,
      isConnected: false,
      setAttribute(name, value) {
        this.attributes[name] = String(value);
      },
      append(...children) {
        for (const child of children) {
          child.parentNode = this;
          child.isConnected = true;
          childrenFor.get(this).push(child);
        }
      },
      appendChild(child) {
        child.parentNode = this;
        child.isConnected = true;
        childrenFor.get(this).push(child);
        return child;
      },
      removeChild(child) {
        const children = childrenFor.get(this);
        const index = children.indexOf(child);
        if (index !== -1) children.splice(index, 1);
        child.parentNode = null;
        child.isConnected = false;
        removed.push(child);
        return child;
      }
    };
    childrenFor.set(element, []);
    return element;
  }

  const documentElement = createElement("html");
  const originalAppendChild = documentElement.appendChild.bind(documentElement);
  documentElement.appendChild = (child) => {
    appended.push(child);
    return originalAppendChild(child);
  };

  const dependencies = {
    location: { hostname },
    FileDropInterception: globalThis.PWM.FileDropInterception || {},
    document: {
      documentElement,
      createElement
    },
    currentPublicState: {
      currentSite: {
        protected: currentSiteProtected
      }
    },
    setTimeout: (callback, delay = 0) => {
      const id = timeoutCallbacks.length + 1;
      timeoutCallbacks.push({ id, callback, delay });
      return id;
    },
    clearTimeout: (id) => {
      clearedTimeouts.push(id);
    },
    debugReveal: (label, details) => debugEvents.push({ label, details })
  };

  const factory = new Function(
    ...Object.keys(dependencies),
    [
      "const FILE_DRAG_SESSION_RESET_MS = 5000;",
      "let dmzOverlayEl = null;",
      "let dmzOverlayStatusEl = null;",
      "let dmzOverlayTimer = 0;",
      "let fileDragDetectedLogged = false;",
      "let fileDropInterception = null;",
      "function scheduleFileDragSessionReset() {}",
      "function scheduleFileInputDiscovery() {}",
      extractFunctionSource(contentSource, "normalizeTarget"),
      extractFunctionSource(contentSource, "dataTransferLooksLikeFiles"),
      extractFunctionSource(contentSource, "isChatGptHost"),
      extractFunctionSource(contentSource, "isGeminiHost"),
      extractFunctionSource(contentSource, "isClaudeHost"),
      extractFunctionSource(contentSource, "isGrokHost"),
      extractFunctionSource(contentSource, "getCurrentHandoffDriverId"),
      extractFunctionSource(contentSource, "isProtectedFileDropDriver"),
      extractFunctionSource(contentSource, "getCurrentHandoffDriver"),
      extractFunctionSource(contentSource, "clearDmzOverlayTimer"),
      extractFunctionSource(contentSource, "hideDmzOverlay"),
      extractFunctionSource(contentSource, "setDmzOverlayState"),
      extractFunctionSource(contentSource, "scheduleDmzOverlayCleanup"),
      extractFunctionSource(contentSource, "showDmzOverlay"),
      extractFunctionSource(contentSource, "handleFileDragDetected"),
      extractFunctionSource(contentSource, "getFileDropInterception"),
      extractFunctionSource(contentSource, "maybeHandleFileDrag"),
      "return { maybeHandleFileDrag, hideDmzOverlay, getOverlay: () => dmzOverlayEl, getStatus: () => dmzOverlayStatusEl };"
    ].join("\n\n")
  );

  return {
    ...factory(...Object.values(dependencies)),
    appended,
    removed,
    timeoutCallbacks,
    clearedTimeouts,
    debugEvents,
    childrenFor
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
  assert.strictEqual(calls.handoffs.length, 0);
  assert.strictEqual(calls.runtimeMessages.length, 0);
  assert.ok(
    calls.debugEvents.some(
      (entry) => entry.label === "file-handoff:generic-pending-queued" && entry.details.site === "chatgpt"
    )
  );
  assert.strictEqual(calls.createdFiles[0].text.includes("LeakGuardDropApiKey"), false);
  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(eventCalls.stopImmediatePropagation, 2);
}

async function testMultiFileDropSanitizesTwoFilesAsBatch() {
  const dispatched = [];
  const target = { tagName: "DIV", dispatchEvent: (event) => { dispatched.push(event); return true; } };
  const files = [
    { name: "one.env", type: "text/plain", size: 20 },
    { name: "two.json", type: "application/json", size: 22 }
  ];
  const { maybeHandleDrop, calls } = createHarness({
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      const file = transfer.files[0];
      return {
        handled: true,
        ok: true,
        text: `API_KEY=LeakGuardDropApiKey1234567890\nfile=${file.name}`,
        file: { name: file.name, type: file.type, sizeBytes: file.size }
      };
    }
  });
  const dataTransfer = createDataTransfer({ files });
  const { event } = createEvent({ dataTransfer, target });

  await maybeHandleDrop(event);

  assert.strictEqual(calls.reads.length, 2);
  assert.strictEqual(calls.redactions.length, 2);
  assert.strictEqual(calls.createdFiles.length, 2);
  assert.strictEqual(dispatched.length, 1);
  assert.strictEqual(dispatched[0].dataTransfer.files.length, 2);
  assert.deepStrictEqual(dispatched[0].dataTransfer.files.map((file) => file.name), ["one.env", "two.json"]);
  assert.strictEqual(JSON.stringify(dispatched).includes("LeakGuardDropApiKey1234567890"), false);
  assert.ok(calls.debugEvents.some((entry) => entry.label === "file-handoff:multi-file-processed"));
}

async function testMultiFileDropSanitizesFiveFilesInOrder() {
  const dispatched = [];
  const target = { tagName: "DIV", dispatchEvent: (event) => { dispatched.push(event); return true; } };
  const files = Array.from({ length: 5 }, (_, index) => ({
    name: `batch-${index + 1}.env`,
    type: "text/plain",
    size: 30 + index
  }));
  const { maybeHandleDrop, calls } = createHarness({
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      const file = transfer.files[0];
      return {
        handled: true,
        ok: true,
        text: `API_KEY=LeakGuardDropApiKey1234567890\nfile=${file.name}`,
        file: { name: file.name, type: file.type, sizeBytes: file.size }
      };
    }
  });
  const { event } = createEvent({ dataTransfer: createDataTransfer({ files }), target });

  await maybeHandleDrop(event);

  assert.strictEqual(calls.reads.length, 5);
  assert.strictEqual(calls.createdFiles.length, 5);
  assert.strictEqual(dispatched.length, 1);
  assert.deepStrictEqual(dispatched[0].dataTransfer.files.map((file) => file.name), files.map((file) => file.name));
}

async function testMultiFileDropSanitizesFiveLargeFilesByStreamingAsBatch() {
  const dispatched = [];
  const target = { tagName: "DIV", dispatchEvent: (event) => { dispatched.push(event); return true; } };
  const sizesMb = [1, 5, 10, 25, 50];
  const files = sizesMb.map((sizeMb, index) => ({
    name: `large-${index + 1}.txt`,
    type: "text/plain",
    size: sizeMb * MiB
  }));
  let streamCalls = 0;
  const { maybeHandleDrop, calls } = createHarness({
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      const file = transfer.files[0];
      if (file.size > 4 * MiB) {
        return {
          handled: true,
          ok: false,
          code: "streaming_required",
          sourceFile: file,
          file: { name: file.name, type: file.type, sizeBytes: file.size }
        };
      }
      return {
        handled: true,
        ok: true,
        text: "API_KEY=LeakGuardDropApiKey1234567890",
        file: { name: file.name, type: file.type, sizeBytes: file.size }
      };
    },
    StreamingFileRedactor: {
      LARGE_TEXT_STREAMING_MAX_BYTES: 50 * MiB,
      redactTextFileStream: async (file, options) => {
        streamCalls += 1;
        await options.redactText("API_KEY=LeakGuardDropApiKey1234567890");
        return {
          action: "redacted",
          sanitizedFile: { name: file.name, type: file.type, size: Math.min(file.size, 128), text: "API_KEY=[PWM_1]" },
          findingsCount: 1,
          bytesProcessed: file.size
        };
      }
    }
  });
  const { event } = createEvent({ dataTransfer: createDataTransfer({ files }), target });

  await maybeHandleDrop(event);

  assert.strictEqual(calls.reads.length, 5);
  assert.strictEqual(streamCalls, 4);
  assert.strictEqual(calls.createdFiles.length, 1);
  assert.strictEqual(dispatched.length, 1);
  assert.strictEqual(dispatched[0].dataTransfer.files.length, 5);
  assert.deepStrictEqual(dispatched[0].dataTransfer.files.map((file) => file.name), files.map((file) => file.name));
  assert.strictEqual(JSON.stringify(calls.modals).includes("file_too_large"), false);
  const modal = calls.modals.find(([title]) => title === "Some files were blocked" || title === "Raw file upload blocked");
  assert.strictEqual(Boolean(modal), false);
}

async function testMultiFileDropSanitizesTwentySmallFilesInOrder() {
  const dispatched = [];
  const target = { tagName: "DIV", dispatchEvent: (event) => { dispatched.push(event); return true; } };
  const files = Array.from({ length: 20 }, (_, index) => ({
    name: `small-${index + 1}.txt`,
    type: "text/plain",
    size: 32 + index
  }));
  const { maybeHandleDrop, calls } = createHarness({
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      const file = transfer.files[0];
      return {
        handled: true,
        ok: true,
        text: "API_KEY=LeakGuardDropApiKey1234567890",
        file: { name: file.name, type: file.type, sizeBytes: file.size }
      };
    }
  });
  const { event } = createEvent({ dataTransfer: createDataTransfer({ files }), target });

  await maybeHandleDrop(event);

  assert.strictEqual(calls.reads.length, 20);
  assert.strictEqual(calls.createdFiles.length, 20);
  assert.strictEqual(dispatched.length, 1);
  assert.deepStrictEqual(dispatched[0].dataTransfer.files.map((file) => file.name), files.map((file) => file.name));
}

async function testMultiFileDropBlocksTwentyOneSmallFilesBeforeReading() {
  const files = Array.from({ length: 21 }, (_, index) => ({
    name: `too-many-small-${index + 1}.env`,
    type: "text/plain",
    size: 12
  }));
  const { maybeHandleDrop, calls } = createHarness();
  const { event } = createEvent({ dataTransfer: createDataTransfer({ files }) });

  await maybeHandleDrop(event);

  assert.strictEqual(calls.reads.length, 0);
  assert.strictEqual(calls.createdFiles.length, 0);
  const modal = calls.modals.find(([title]) => title === "Raw file upload blocked");
  assert.ok(modal);
  assert.match(String(modal[1]), /blocked before reading or processing/);
  assert.match(String(modal[1]), /reason: small_file_count_exceeded/);
  assert.strictEqual(String(modal[1]).includes("too-many-small-1.env"), false);
  assert.ok(calls.debugEvents.some((entry) => entry.label === "file-handoff:multi-file-blocked" && entry.details.reason === "small_file_count_exceeded"));
}

async function testMultiFileDropBlocksSixLargeFilesBeforeReading() {
  const files = Array.from({ length: 6 }, (_, index) => ({
    name: `too-many-large-${index + 1}.env`,
    type: "text/plain",
    size: 5 * MiB
  }));
  const { maybeHandleDrop, calls } = createHarness();
  const { event } = createEvent({ dataTransfer: createDataTransfer({ files }) });

  await maybeHandleDrop(event);

  assert.strictEqual(calls.reads.length, 0);
  assert.strictEqual(calls.createdFiles.length, 0);
  const modal = calls.modals.find(([title]) => title === "Raw file upload blocked");
  assert.ok(modal);
  assert.match(String(modal[1]), /Up to 5 large files/);
  assert.match(String(modal[1]), /blocked before reading or processing/);
  assert.match(String(modal[1]), /No raw files were uploaded/);
  assert.match(String(modal[1]), /file-1/);
  assert.match(String(modal[1]), /reason: large_file_count_exceeded/);
  assert.strictEqual(String(modal[1]).includes("too-many-large-1.env"), false);
  assert.ok(calls.debugEvents.some((entry) => entry.label === "file-handoff:multi-file-blocked" && entry.details.reason === "large_file_count_exceeded"));
}

async function testMultiFileDropSanitizesMixedSmallAndLargeBatch() {
  const dispatched = [];
  const target = { tagName: "DIV", dispatchEvent: (event) => { dispatched.push(event); return true; } };
  const smallFiles = Array.from({ length: 10 }, (_, index) => ({
    name: `mixed-small-${index + 1}.txt`,
    type: "text/plain",
    size: 100 + index
  }));
  const largeFiles = [5, 10, 25].map((sizeMb, index) => ({
    name: `mixed-large-${index + 1}.txt`,
    type: "text/plain",
    size: sizeMb * MiB
  }));
  const files = [...smallFiles, ...largeFiles];
  let streamCalls = 0;
  const { maybeHandleDrop, calls } = createHarness({
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      const file = transfer.files[0];
      if (file.size > 4 * MiB) {
        return {
          handled: true,
          ok: false,
          code: "streaming_required",
          sourceFile: file,
          file: { name: file.name, type: file.type, sizeBytes: file.size }
        };
      }
      return {
        handled: true,
        ok: true,
        text: "API_KEY=LeakGuardDropApiKey1234567890",
        file: { name: file.name, type: file.type, sizeBytes: file.size }
      };
    },
    StreamingFileRedactor: {
      LARGE_TEXT_STREAMING_MAX_BYTES: 50 * MiB,
      redactTextFileStream: async (file, options) => {
        streamCalls += 1;
        await options.redactText("API_KEY=LeakGuardDropApiKey1234567890");
        return {
          action: "redacted",
          sanitizedFile: { name: file.name, type: file.type, size: 128, text: "API_KEY=[PWM_1]" },
          findingsCount: 1,
          bytesProcessed: file.size
        };
      }
    }
  });
  const { event } = createEvent({ dataTransfer: createDataTransfer({ files }), target });

  await maybeHandleDrop(event);

  assert.strictEqual(calls.reads.length, 13);
  assert.strictEqual(streamCalls, 3);
  assert.strictEqual(dispatched.length, 1);
  assert.deepStrictEqual(dispatched[0].dataTransfer.files.map((file) => file.name), files.map((file) => file.name));
}

async function testMultiFileDropBlocksMixedBatchWithTooManyLargeFilesBeforeReading() {
  const files = [
    ...Array.from({ length: 10 }, (_, index) => ({ name: `small-${index + 1}.txt`, type: "text/plain", size: 100 })),
    ...Array.from({ length: 6 }, (_, index) => ({ name: `large-${index + 1}.txt`, type: "text/plain", size: 5 * MiB }))
  ];
  const { maybeHandleDrop, calls } = createHarness();
  const { event } = createEvent({ dataTransfer: createDataTransfer({ files }) });

  await maybeHandleDrop(event);

  assert.strictEqual(calls.reads.length, 0);
  assert.strictEqual(calls.createdFiles.length, 0);
  const modal = calls.modals.find(([title]) => title === "Raw file upload blocked");
  assert.ok(modal);
  assert.match(String(modal[1]), /reason: large_file_count_exceeded/);
}

async function testMultiFileDropBlocksFileExceedingSupportedSize() {
  const files = [
    { name: "small.txt", type: "text/plain", size: 100 },
    { name: "too-big.txt", type: "text/plain", size: 51 * MiB }
  ];
  const { maybeHandleDrop, calls } = createHarness();
  const { event } = createEvent({ dataTransfer: createDataTransfer({ files }) });

  await maybeHandleDrop(event);

  assert.strictEqual(calls.reads.length, 0);
  const modal = calls.modals.find(([title]) => title === "Raw file upload blocked");
  assert.ok(modal);
  assert.match(String(modal[1]), /reason: file_exceeds_supported_size/);
  assert.strictEqual(String(modal[1]).includes("too-big.txt"), false);
}

async function testMultiFileInputSanitizesMixedSmallAndLargeBatch() {
  const fileInput = createFileInput({ multiple: true });
  const smallFiles = Array.from({ length: 10 }, (_, index) => ({
    name: `input-small-${index + 1}.txt`,
    type: "text/plain",
    size: 100 + index
  }));
  const largeFiles = [5, 10, 25].map((sizeMb, index) => ({
    name: `input-large-${index + 1}.txt`,
    type: "text/plain",
    size: sizeMb * MiB
  }));
  fileInput.files = [...smallFiles, ...largeFiles];
  let streamCalls = 0;
  const composer = { tagName: "TEXTAREA", text: "", selection: { start: 0, end: 0 } };
  const { maybeHandleFileInputChange, calls } = createHarness({
    location: { hostname: "chatgpt.com" },
    findComposer: () => composer,
    requestRedaction: async (text, findings, options) => {
      calls.redactions.push({ text, findings, options });
      return { redactedText: "API_KEY=[PWM_1]" };
    },
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      const file = transfer.files[0];
      if (file.size > 4 * MiB) {
        return {
          handled: true,
          ok: false,
          code: "streaming_required",
          sourceFile: file,
          file: { name: file.name, type: file.type, sizeBytes: file.size }
        };
      }
      return {
        handled: true,
        ok: true,
        text: "API_KEY=LeakGuardInputApiKey1234567890",
        file: { name: file.name, type: file.type, sizeBytes: file.size }
      };
    },
    StreamingFileRedactor: {
      LARGE_TEXT_STREAMING_MAX_BYTES: 50 * MiB,
      redactTextFileStream: async (file, options) => {
        streamCalls += 1;
        await options.redactText("API_KEY=LeakGuardInputApiKey1234567890");
        return {
          action: "redacted",
          sanitizedFile: { name: file.name, type: file.type, size: 128, text: "API_KEY=[PWM_1]" },
          findingsCount: 1,
          bytesProcessed: file.size
        };
      }
    }
  });
  const { event } = createEvent({ type: "change", target: fileInput });

  await maybeHandleFileInputChange(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.reads.length, 13);
  assert.strictEqual(streamCalls, 3);
  assert.strictEqual(fileInput.files.length, 13);
  assert.deepStrictEqual(fileInput.files.map((file) => file.name), [...smallFiles, ...largeFiles].map((file) => file.name));
  fileInput.files.forEach((file) => {
    assert.strictEqual(String(file.text || "").includes("LeakGuardInputApiKey1234567890"), false);
  });
}

async function testMultiFileInputBlocksTooManyLargeFilesBeforeReading() {
  const fileInput = createFileInput({ multiple: true });
  fileInput.files = [
    ...Array.from({ length: 10 }, (_, index) => ({ name: `input-small-${index + 1}.txt`, type: "text/plain", size: 100 })),
    ...Array.from({ length: 6 }, (_, index) => ({ name: `input-large-${index + 1}.txt`, type: "text/plain", size: 5 * MiB }))
  ];
  const { maybeHandleFileInputChange, calls } = createHarness({
    location: { hostname: "chatgpt.com" },
    findComposer: () => ({ tagName: "TEXTAREA", text: "", selection: { start: 0, end: 0 } })
  });
  const { event } = createEvent({ type: "change", target: fileInput });

  await maybeHandleFileInputChange(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.reads.length, 0);
  assert.strictEqual(fileInput.files.length, 0);
  const modal = calls.modals.find(([title]) => title === "Raw file upload blocked");
  assert.ok(modal);
  assert.match(String(modal[1]), /reason: large_file_count_exceeded/);
  assert.strictEqual(String(modal[1]).includes("input-large-1.txt"), false);
}

async function testMultiFileInputKeepsUnsupportedOutOfSanitizedAssignment() {
  const fileInput = createFileInput({ multiple: true });
  const files = [
    { name: "input-safe.env", type: "text/plain", size: 18 },
    { name: "input-blocked.svg", type: "image/svg+xml", size: 20 },
    { name: "input-safe.log", type: "text/plain", size: 22 }
  ];
  fileInput.files = files;
  const { maybeHandleFileInputChange, calls } = createHarness({
    location: { hostname: "chatgpt.com" },
    findComposer: () => ({ tagName: "TEXTAREA", text: "", selection: { start: 0, end: 0 } }),
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      const file = transfer.files[0];
      if (/\.svg$/i.test(file.name)) {
        return { handled: true, ok: false, code: "unsupported_file_type", message: `raw unsupported ${file.name}` };
      }
      return {
        handled: true,
        ok: true,
        text: "API_KEY=LeakGuardInputApiKey1234567890",
        file: { name: file.name, type: file.type, sizeBytes: file.size }
      };
    }
  });
  const { event } = createEvent({ type: "change", target: fileInput });

  await maybeHandleFileInputChange(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(fileInput.files.length, 2);
  assert.deepStrictEqual(fileInput.files.map((file) => file.name), ["input-safe.env", "input-safe.log"]);
  assert.strictEqual(JSON.stringify(fileInput.files).includes("input-blocked.svg"), false);
  const modal = calls.modals.find(([title]) => title === "Some files were blocked");
  assert.ok(modal);
  assert.match(String(modal[1]), /reason: unsupported_file_type/);
  assert.strictEqual(String(modal[1]).includes("input-blocked.svg"), false);
}

async function testMultiFilePasteSanitizesTwentySmallFiles() {
  const dispatched = [];
  const target = { tagName: "TEXTAREA", text: "", selection: { start: 0, end: 0 }, dispatchEvent: (event) => { dispatched.push(event); return true; } };
  const files = Array.from({ length: 20 }, (_, index) => ({
    name: `paste-small-${index + 1}.txt`,
    type: "text/plain",
    size: 32 + index
  }));
  const transfer = createDataTransfer({ files });
  const { maybeHandlePaste, calls } = createHarness({
    location: { hostname: "chatgpt.com" },
    findComposer: () => target,
    requestRedaction: async (text, findings, options) => {
      calls.redactions.push({ text, findings, options });
      return { redactedText: "API_KEY=[PWM_1]" };
    },
    readLocalTextFileFromDataTransfer: async (dataTransfer) => {
      calls.reads.push(dataTransfer);
      const file = dataTransfer.files[0];
      return {
        handled: true,
        ok: true,
        text: "API_KEY=LeakGuardPasteApiKey1234567890",
        file: { name: file.name, type: file.type, sizeBytes: file.size }
      };
    }
  });
  const { event } = createClipboardEvent({
    target,
    clipboardData: {
      ...transfer,
      getData: () => ""
    }
  });

  await maybeHandlePaste(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.reads.length, 20);
  assert.strictEqual(dispatched.length, 1);
  assert.strictEqual(dispatched[0].clipboardData.files.length, 20);
  assert.deepStrictEqual(dispatched[0].clipboardData.files.map((file) => file.name), files.map((file) => file.name));
  dispatched[0].clipboardData.files.forEach((file) => {
    assert.strictEqual(String(file.text || "").includes("LeakGuardPasteApiKey1234567890"), false);
  });
}

async function testGeminiGrokMultiFilePasteQueuesSanitizedPendingAfterDirectHandoffFails() {
  for (const [hostname, siteLabel] of [
    ["gemini.google.com", "gemini"],
    ["grok.com", "grok"]
  ]) {
    const target = {
      tagName: "DIV",
      dispatchEvent: () => {
        throw new Error("synthetic paste rejected");
      }
    };
    const files = [
      { name: `${siteLabel}-one.env`, type: "text/plain", size: 18 },
      { name: `${siteLabel}-two.env`, type: "text/plain", size: 20 }
    ];
    const transfer = createDataTransfer({ files });
    const { maybeHandlePaste, calls } = createHarness({
      location: { hostname },
      findComposer: () => target,
      createSanitizedTextFile: (file, text) => {
        const sanitizedFile = {
          name: file.name,
          type: file.type,
          size: String(text || "").length,
          async text() {
            return text;
          }
        };
        calls.createdFiles.push({ file, text, sanitizedFile });
        return sanitizedFile;
      },
      readLocalTextFileFromDataTransfer: async (dataTransfer) => {
        calls.reads.push(dataTransfer);
        const file = dataTransfer.files[0];
        return {
          handled: true,
          ok: true,
          text: "API_KEY=LeakGuardPasteApiKey1234567890",
          file: { name: file.name, type: file.type, sizeBytes: file.size }
        };
      }
    });
    const { event } = createClipboardEvent({
      target,
      clipboardData: {
        ...transfer,
        getData: () => ""
      }
    });

    await maybeHandlePaste(event);

    assert.strictEqual(event.defaultPrevented, true);
    assert.ok(
      calls.debugEvents.some((entry) => entry.label === `file-handoff:${siteLabel}-pending-queued`),
      JSON.stringify({
        events: calls.debugEvents.map((entry) => ({ label: entry.label, details: entry.details })),
        modals: calls.modals.map(([title]) => title),
        reads: calls.reads.length
      })
    );
    assert.strictEqual(calls.modals.some(([title]) => title === "Raw file upload blocked"), false);
    const queued = calls.debugEvents.find((entry) => entry.label === `file-handoff:${siteLabel}-pending-queued`);
    assert.strictEqual(JSON.stringify(queued.details).includes(`${siteLabel}-one.env`), false);
    assert.strictEqual(JSON.stringify(queued.details).includes("LeakGuardPasteApiKey1234567890"), false);
  }
}

async function testGeminiMultiFilePasteQueuesPendingBeforeDirectHandoff() {
  const dispatched = [];
  const target = {
    tagName: "DIV",
    dispatchEvent: (event) => {
      dispatched.push(event);
      return true;
    }
  };
  const files = [
    { name: "gemini-one.env", type: "text/plain", size: 18 },
    { name: "gemini-two.env", type: "text/plain", size: 20 }
  ];
  const transfer = createDataTransfer({ files });
  const { maybeHandlePaste, calls } = createHarness({
    location: { hostname: "gemini.google.com" },
    findComposer: () => target,
    createSanitizedTextFile: (file, text) => {
      const sanitizedFile = {
        name: file.name,
        type: file.type,
        size: String(text || "").length,
        async text() {
          return text;
        }
      };
      calls.createdFiles.push({ file, text, sanitizedFile });
      return sanitizedFile;
    },
    readLocalTextFileFromDataTransfer: async (dataTransfer) => {
      calls.reads.push(dataTransfer);
      const file = dataTransfer.files[0];
      return {
        handled: true,
        ok: true,
        text: "API_KEY=LeakGuardPasteApiKey1234567890",
        file: { name: file.name, type: file.type, sizeBytes: file.size }
      };
    }
  });
  const { event } = createClipboardEvent({
    target,
    clipboardData: {
      ...transfer,
      getData: () => ""
    }
  });

  await maybeHandlePaste(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(dispatched.length, 0, "Gemini multi-file batches must not use direct synthetic paste first");
  assert.ok(calls.debugEvents.some((entry) => entry.label === "file-handoff:gemini-pending-queued"));
  assert.strictEqual(calls.modals.some(([title]) => title === "Raw file upload blocked"), false);
  const prompt = calls.debugEvents.find((entry) => entry.label === "file-ui:pending-prompt-shown");
  assert.ok(prompt, "Gemini pending prompt should be shown");
  assert.strictEqual(JSON.stringify(prompt.details).includes("gemini-one.env"), false);
  assert.strictEqual(JSON.stringify(calls.debugEvents).includes("LeakGuardPasteApiKey1234567890"), false);
}

async function testGrokMultiFilePasteKeepsDirectFirstHandoff() {
  const dispatched = [];
  const target = {
    tagName: "DIV",
    dispatchEvent: (event) => {
      dispatched.push(event);
      return true;
    }
  };
  const files = [
    { name: "grok-one.env", type: "text/plain", size: 18 },
    { name: "grok-two.env", type: "text/plain", size: 20 }
  ];
  const transfer = createDataTransfer({ files });
  const { maybeHandlePaste, calls } = createHarness({
    location: { hostname: "grok.com" },
    findComposer: () => target
  });
  const { event } = createClipboardEvent({
    target,
    clipboardData: {
      ...transfer,
      getData: () => ""
    }
  });

  await maybeHandlePaste(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(dispatched.length, 1, "Grok should keep direct sanitized multi-file handoff first");
  assert.strictEqual(calls.debugEvents.some((entry) => entry.label === "file-handoff:grok-pending-queued"), false);
}

async function testMultiFileDropPartialBlockShowsPerFileSafeSummary() {
  const dispatched = [];
  const target = { tagName: "DIV", dispatchEvent: (event) => { dispatched.push(event); return true; } };
  const rawSecret = "sk-proj-PartialFilenameSecret1234567890abcdef";
  const files = [
    { name: `safe-one-${rawSecret}.env`, type: "text/plain", size: 18 },
    { name: "blocked-one.svg", type: "image/svg+xml", size: 20 },
    { name: "safe-two.json", type: "application/json", size: 22 },
    { name: "blocked-two.bmp", type: "image/bmp", size: 24 },
    { name: "safe-three.md", type: "text/markdown", size: 26 }
  ];
  const { maybeHandleDrop, calls } = createHarness({
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      const file = transfer.files[0];
      if (/\.svg$/i.test(file.name)) {
        return { handled: false, ok: false, code: "unsupported_file_type", message: `raw unsupported ${file.name} ${rawSecret}` };
      }
      if (/\.bmp$/i.test(file.name)) {
        return { handled: false, ok: false, code: `sk-proj-${rawSecret}`, message: `raw exception ${file.name}` };
      }
      return {
        handled: true,
        ok: true,
        text: `API_KEY=LeakGuardDropApiKey1234567890\nfile=${file.name}`,
        file: { name: file.name, type: file.type, sizeBytes: file.size }
      };
    }
  });
  const { event } = createEvent({ dataTransfer: createDataTransfer({ files }), target });

  await maybeHandleDrop(event);

  assert.strictEqual(dispatched.length, 1);
  assert.strictEqual(dispatched[0].dataTransfer.files.length, 3);
  const modal = calls.modals.find(([title]) => title === "Some files were blocked");
  assert.ok(modal);
  const message = String(modal[1]);
  assert.match(message, /LeakGuard attached 3 sanitized file\(s\) and blocked 2 file\(s\)\./);
  assert.match(message, /No raw files were uploaded\./);
  assert.match(message, /Attached files:\n- file-1 \(\.env, text, 18 bytes\) - attached/);
  assert.match(message, /- file-3 \(\.json, application, 22 bytes\) - attached/);
  assert.match(message, /- file-5 \(\.md, text, 26 bytes\) - attached/);
  assert.match(message, /Blocked files:\n- file-2 \(\.svg, image, 20 bytes\) - blocked, reason: unsupported_file_type/);
  assert.match(message, /- file-4 \(\.bmp, image, 24 bytes\) - failed, reason: unknown_blocked/);
  assert.strictEqual(message.includes("safe-one-"), false);
  assert.strictEqual(message.includes("blocked-one.svg"), false);
  assert.strictEqual(message.includes(rawSecret), false);
  assert.strictEqual(message.includes("raw unsupported"), false);
  assert.strictEqual(message.includes("raw exception"), false);
}

async function testMixedMultiFileDropBlocksUnsupportedWithoutRawFallback() {
  const dispatched = [];
  const target = { tagName: "DIV", dispatchEvent: (event) => { dispatched.push(event); return true; } };
  const files = [
    { name: "good.env", type: "text/plain", size: 18 },
    { name: "bad.svg", type: "image/svg+xml", size: 20 },
    { name: "good.log", type: "text/plain", size: 22 }
  ];
  const { maybeHandleDrop, calls } = createHarness({
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      const file = transfer.files[0];
      if (/\.svg$/i.test(file.name)) {
        return { handled: false, ok: false, code: "unsupported_file_type", message: "unsupported" };
      }
      return {
        handled: true,
        ok: true,
        text: `API_KEY=LeakGuardDropApiKey1234567890\nfile=${file.name}`,
        file: { name: file.name, type: file.type, sizeBytes: file.size }
      };
    }
  });
  const { event } = createEvent({ dataTransfer: createDataTransfer({ files }), target });

  await maybeHandleDrop(event);

  assert.strictEqual(calls.reads.length, 3);
  assert.strictEqual(calls.createdFiles.length, 2);
  assert.strictEqual(dispatched.length, 1);
  assert.deepStrictEqual(dispatched[0].dataTransfer.files.map((file) => file.name), ["good.env", "good.log"]);
  assert.ok(calls.modals.some(([title, message]) => title === "Some files were blocked" && /blocked 1 file/.test(message)));
  const processed = calls.debugEvents.find((entry) => entry.label === "file-handoff:multi-file-processed");
  assert.ok(processed);
  assert.strictEqual(JSON.stringify(processed.details).includes("bad.svg"), false);
}

async function testMultiFileDropBlocksThrownReadPerFileWithoutRawFallback() {
  const dispatched = [];
  const target = { tagName: "DIV", dispatchEvent: (event) => { dispatched.push(event); return true; } };
  const rawSecret = "LeakGuardThrownReadApiKey1234567890";
  const files = [
    { name: "first.env", type: "text/plain", size: 18 },
    { name: "throwing.env", type: "text/plain", size: 20 },
    { name: "third.log", type: "text/plain", size: 22 }
  ];
  const { maybeHandleDrop, calls } = createHarness({
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      const file = transfer.files[0];
      if (file.name === "throwing.env") {
        throw new Error(`raw filename ${file.name} ${rawSecret}`);
      }
      return {
        handled: true,
        ok: true,
        text: `API_KEY=${rawSecret}\nfile=${file.name}`,
        file: { name: file.name, type: file.type, sizeBytes: file.size }
      };
    }
  });
  const { event } = createEvent({ dataTransfer: createDataTransfer({ files }), target });

  await maybeHandleDrop(event);

  assert.strictEqual(calls.reads.length, 3);
  assert.strictEqual(calls.createdFiles.length, 2);
  assert.strictEqual(dispatched.length, 1);
  assert.deepStrictEqual(dispatched[0].dataTransfer.files.map((file) => file.name), ["first.env", "third.log"]);
  assert.strictEqual(JSON.stringify(dispatched).includes(rawSecret), false);
  assert.ok(calls.modals.some(([title, message]) => title === "Some files were blocked" && /blocked 1 file/.test(message)));
  const processed = calls.debugEvents.find((entry) => entry.label === "file-handoff:multi-file-processed");
  assert.ok(processed);
  assert.strictEqual(JSON.stringify(processed.details).includes("throwing.env"), false);
  assert.strictEqual(JSON.stringify(processed.details).includes(rawSecret), false);
}

async function testMultiFileDropAllFilesFailedShowsSafeBlockedSummary() {
  const rawSecret = "LeakGuardAllFailedApiKey1234567890";
  const files = [
    { name: `C:\\tmp\\${rawSecret}.env`, type: "text/plain", size: 18 },
    { name: "second.env", type: "text/plain", size: 20 }
  ];
  const { maybeHandleDrop, calls } = createHarness({
    readLocalTextFileFromDataTransfer: async () => {
      throw new Error(`raw path C:\\tmp\\${rawSecret}.env stack trace`);
    }
  });
  const { event } = createEvent({ dataTransfer: createDataTransfer({ files }) });

  await maybeHandleDrop(event);

  assert.strictEqual(calls.createdFiles.length, 0);
  const modal = calls.modals.find(([title]) => title === "Raw file upload blocked");
  assert.ok(modal);
  const message = String(modal[1]);
  assert.match(message, /blocked 2 file\(s\)/);
  assert.match(message, /No raw files were uploaded\./);
  assert.match(message, /Blocked files:\n- file-1 \(\.env, text, 18 bytes\) - failed, reason: file_processing_exception/);
  assert.match(message, /- file-2 \(\.env, text, 20 bytes\) - failed, reason: file_processing_exception/);
  assert.strictEqual(message.includes(rawSecret), false);
  assert.strictEqual(message.includes("C:\\tmp"), false);
  assert.strictEqual(message.includes("stack trace"), false);
}

async function testGeminiGrokPartialBlockDoesNotEnterPendingQueueAndShowsSafeSummary() {
  for (const [hostname, siteLabel] of [
    ["gemini.google.com", "gemini"],
    ["grok.com", "grok"]
  ]) {
    const rawSecret = `sk-proj-${siteLabel}-PartialPendingSecret1234567890abcdef`;
    const target = { tagName: "DIV", dispatchEvent: () => false };
    const files = [
      { name: `${siteLabel}-safe.env`, type: "text/plain", size: 18 },
      { name: `${siteLabel}-${rawSecret}.svg`, type: "image/svg+xml", size: 20 }
    ];
    const { maybeHandleDrop, calls } = createHarness({
      location: { hostname },
      readLocalTextFileFromDataTransfer: async (transfer) => {
        calls.reads.push(transfer);
        const file = transfer.files[0];
        if (/\.svg$/i.test(file.name)) {
          return { handled: true, ok: false, code: "unsupported_file_type", message: `raw blocked ${file.name}` };
        }
        return {
          handled: true,
          ok: true,
          text: `API_KEY=LeakGuardDropApiKey1234567890\nfile=${file.name}`,
          file: { name: file.name, type: file.type, sizeBytes: file.size }
        };
      }
    });
    const { event } = createEvent({ dataTransfer: createDataTransfer({ files }), target });

    await maybeHandleDrop(event);

    assert.strictEqual(calls.debugEvents.some((entry) => entry.label === "file-handoff:pending-queued"), false);
    assert.strictEqual(calls.debugEvents.some((entry) => entry.label === `file-handoff:${siteLabel}-pending-queued`), false);
    const modal = calls.modals.find(([title]) => title === "Raw file upload blocked" || title === "Some files were blocked");
    assert.ok(modal, `${siteLabel} should show a partial-block modal`);
    const message = String(modal[1]);
    assert.match(message, /No raw files were uploaded\./);
    assert.match(message, /file-1 \(\.env, text, 18 bytes\) - (?:attached|failed)(?:, reason: sanitized_handoff_failed)?/);
    assert.match(message, /file-2 \(\.svg, image, 20 bytes\) - blocked, reason: unsupported_file_type/);
    assert.strictEqual(message.includes(rawSecret), false);
    assert.strictEqual(message.includes(`${siteLabel}-safe.env`), false);
    assert.strictEqual(message.includes("raw blocked"), false);
  }
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
  let event;
  let eventCalls;
  const { maybeHandleDrop, calls } = createHarness({
    readLocalTextFileFromDataTransfer: async (transfer) => {
      assert.strictEqual(event.defaultPrevented, true, "raw drop must be consumed before file read");
      assert.ok(
        eventCalls.stopImmediatePropagation >= 1,
        "raw drop must be stopped before asynchronous sanitization"
      );
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
    findComposer: (target) => {
      findComposerCalls.push(target);
      assert.strictEqual(event.defaultPrevented, true);
      return null;
    }
  });
  ({ event, calls: eventCalls } = createEvent({
    dataTransfer: createDataTransfer(),
    target: { tagName: "P" }
  }));

  await maybeHandleDrop(event);

  assert.strictEqual(findComposerCalls.length, 2);
  assert.strictEqual(calls.reads.length, 1);
  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(eventCalls.preventDefault, 2);
  assert.strictEqual(eventCalls.stopImmediatePropagation, 2);
}

function testProtectedRebuiltFileDropBlocksAtDragGuard() {
  const { resolveFileDragGuardPolicy } = createHarness({
    location: { hostname: "chatgpt.com" },
    canExtractForAdapterHandoff: (file) => file?.name === "contract.pdf",
    processFileForAdapterHandoff: async () => null
  });
  const policy = resolveFileDragGuardPolicy({
    types: ["Files"],
    files: [
      {
        name: "contract.pdf",
        type: "application/pdf",
        size: 512
      }
    ],
    items: []
  });

  assert.strictEqual(policy.action, "block");
  assert.strictEqual(policy.reason, "content_extraction_candidate");
}

function testDropRoutesContentExtractionCandidatesBeforeUnsupportedPassThrough() {
  const source = extractFunctionSource(fileDropOrchestrationSource, "maybeHandleDrop");
  const candidateIndex = source.indexOf("const contentExtractionFile");
  const allowPolicyIndex = source.indexOf('if (transferPolicy.action === "allow"');

  assert.notStrictEqual(candidateIndex, -1, "drop handler should identify extractable document candidates");
  assert.notStrictEqual(allowPolicyIndex, -1, "drop handler should keep unsupported pass-through branch");
  assert.ok(
    candidateIndex < allowPolicyIndex,
    "drop handler should identify extractable document candidates before unsupported pass-through"
  );
  assert.ok(
    source.includes('if (transferPolicy.action === "allow" && !contentExtractionFile)'),
    "drop handler should not show unsupported pass-through for extractable document candidates"
  );
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
  assert.strictEqual(calls.handoffs.length, 0);
  assert.strictEqual(calls.runtimeMessages.length, 0);
  assert.strictEqual(
    calls.debugEvents.filter(
      (entry) => entry.label === "file-handoff:generic-pending-queued" && entry.details.site === "chatgpt"
    ).length,
    1
  );
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
  assert.strictEqual(calls.handoffs.length, 0);
  assert.strictEqual(calls.runtimeMessages.length, 0);
  assert.ok(
    calls.debugEvents.some(
      (entry) => entry.label === "file-handoff:generic-pending-queued" && entry.details.site === "chatgpt"
    )
  );
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
  assert.strictEqual(calls.handoffs.length, 0);
  assert.strictEqual(calls.textFallbacks.length, 0);
  assert.ok(
    calls.debugEvents.some(
      (entry) => entry.label === "file-handoff:generic-pending-queued" && entry.details.site === "chatgpt"
    )
  );
}

function testProductionGeminiDropPathDoesNotUseLegacyEditorDropHandler() {
  const maybeHandleDropSource = extractFunctionSource(contentSource, "maybeHandleDrop");
  const bindEventsSource = extractFunctionSource(contentSource, "bindEvents");
  const bindFileDragEventsSource = extractFunctionSource(contentSource, "bindFileDragEvents");

  assert.strictEqual(
    maybeHandleDropSource.includes("maybeHandleGeminiEditorDrop"),
    false,
    "production drop handling should not depend on the legacy Gemini editor-drop helper"
  );
  assert.strictEqual(
    bindEventsSource.includes("maybeHandleGeminiEditorDrop"),
    false,
    "registered drop listeners should not route through the legacy Gemini editor-drop helper"
  );
  assert.ok(
    bindEventsSource.includes("maybeHandleDrop(event).catch(handleContentError)"),
    "drop listeners should route through the active file-handoff drop handler"
  );
  assert.ok(
    bindFileDragEventsSource.includes("ContentEventBindings.bindFileDragRoot") &&
      contentEventBindingsSource.includes('rootTarget.addEventListener("drop", options.onFileDrop'),
    "bound file drag roots should use the injected production drop callback"
  );
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

function createDiagnosticsElement({
  tagName = "button",
  ariaLabel = "",
  role = "",
  text = "",
  type = "",
  name = "",
  className = "",
  href = "",
  download = "",
  multiple = false,
  hidden = false,
  disabled = false,
  dataTestId = ""
} = {}) {
  return {
    nodeType: 1,
    tagName: String(tagName).toUpperCase(),
    ariaLabel,
    role,
    innerText: text,
    textContent: text,
    type,
    name,
    className,
    href,
    multiple,
    hidden,
    disabled,
    getAttribute(attributeName) {
      if (attributeName === "aria-label") return ariaLabel;
      if (attributeName === "role") return role;
      if (attributeName === "type") return type;
      if (attributeName === "name") return name;
      if (attributeName === "class") return className;
      if (attributeName === "contenteditable") return role === "textbox" ? "true" : "";
      if (attributeName === "href") return href;
      if (attributeName === "download") return download;
      if (attributeName === "data-test-id") return dataTestId;
      return "";
    },
    hasAttribute(attributeName) {
      if (attributeName === "download") return download !== "";
      if (attributeName === "data-test-id") return dataTestId !== "";
      return false;
    },
    matches(selector) {
      const lowerLabel = ariaLabel.toLowerCase();
      const lowerTestId = dataTestId.toLowerCase();
      if (selector === 'button[aria-label="Open upload file menu"]') {
        return this.tagName === "BUTTON" && ariaLabel === "Open upload file menu";
      }
      if (selector === 'button[aria-label*="upload" i]') {
        return this.tagName === "BUTTON" && lowerLabel.includes("upload");
      }
      if (selector === 'button[aria-label*="attach" i]') {
        return this.tagName === "BUTTON" && lowerLabel.includes("attach");
      }
      if (selector === 'button[aria-label*="add" i]') {
        return this.tagName === "BUTTON" && lowerLabel.includes("add");
      }
      if (selector === '[role="button"][aria-label*="upload" i]') {
        return role === "button" && lowerLabel.includes("upload");
      }
      if (selector === '[role="button"][aria-label*="attach" i]') {
        return role === "button" && lowerLabel.includes("attach");
      }
      if (selector === "button.upload-card-button") {
        return this.tagName === "BUTTON" && /\bupload-card-button\b/.test(className);
      }
      if (selector === "mat-icon.upload-icon") {
        return this.tagName === "MAT-ICON" && /\bupload-icon\b/.test(className);
      }
      if (selector === "[data-test-id*='upload' i]") return lowerTestId.includes("upload");
      if (selector === "[data-test-id*='attach' i]") return lowerTestId.includes("attach");
      if (selector === 'rich-textarea [contenteditable="true"]') return this.tagName === "RICH-TEXTAREA";
      if (selector === '[contenteditable="true"][role="textbox"]') {
        return this.getAttribute("contenteditable") === "true" && role === "textbox";
      }
      if (selector === '[role="textbox"][aria-label*="prompt" i]') {
        return role === "textbox" && lowerLabel.includes("prompt");
      }
      if (selector === '[role="textbox"][aria-label*="message" i]') {
        return role === "textbox" && lowerLabel.includes("message");
      }
      if (selector === "div.ql-editor") return this.tagName === "DIV" && /\bql-editor\b/.test(className);
      if (selector === "textarea") return this.tagName === "TEXTAREA";
      if (selector === '[role="menuitem"]') return role === "menuitem";
      if (selector === '[role="option"]') return role === "option";
      if (selector === ".cdk-overlay-pane button") return this.tagName === "BUTTON" && /\bcdk-overlay-pane\b/.test(className);
      if (selector === ".mat-mdc-menu-panel button") return this.tagName === "BUTTON" && /\bmat-mdc-menu-panel\b/.test(className);
      if (selector === "mat-bottom-sheet-container button") {
        return this.tagName === "BUTTON" && /\bmat-bottom-sheet-container\b/.test(className);
      }
      if (selector === '[aria-label*="file" i]') return lowerLabel.includes("file");
      if (selector === '[aria-label*="more uploads" i]') return lowerLabel.includes("more uploads");
      if (selector === 'input[type="file"][name="Filedata"]') return type === "file" && name === "Filedata";
      if (selector === 'input[type="file"][multiple]') return type === "file" && multiple;
      if (selector === 'input[type="file"]') return type === "file";
      if (selector === "[data-drop-target]") return dataTestId === "drop-target";
      if (selector === "[data-upload-drop-target]") return dataTestId === "upload-drop-target";
      if (selector === "[aria-label*='drop' i]") return lowerLabel.includes("drop");
      if (selector === "[aria-label*='upload' i]") return lowerLabel.includes("upload");
      if (selector === ".drop-zone") return /\bdrop-zone\b/.test(className);
      if (selector === ".upload-drop-zone") return /\bupload-drop-zone\b/.test(className);
      if (selector === "images-files-uploader") return this.tagName === "IMAGES-FILES-UPLOADER";
      if (selector === "a[download]") return this.tagName === "A" && download !== "";
      if (selector === 'a[href^="blob:"]') return this.tagName === "A" && href.startsWith("blob:");
      if (selector === 'a[href^="data:"][download]') return this.tagName === "A" && href.startsWith("data:") && download !== "";
      if (selector === 'button[aria-label*="download" i]') {
        return this.tagName === "BUTTON" && lowerLabel.includes("download");
      }
      if (selector === '[role="button"][aria-label*="download" i]') {
        return role === "button" && lowerLabel.includes("download");
      }
      if (selector === '[data-test-id*="download" i]') return lowerTestId.includes("download");
      if (selector === "*") return true;
      return false;
    },
    querySelectorAll() {
      return [];
    }
  };
}

function createDiagnosticsRoot(elements) {
  return {
    querySelectorAll(selector) {
      if (selector === "*") return elements;
      return elements.filter((element) => element.matches?.(selector));
    }
  };
}

function testGeminiDiagnosticsDetectsNewPillPrompt() {
  const diagnostics = globalThis.PWM.SiteAdapters.GeminiDiagnosticsAdapter;
  const prompt = createDiagnosticsElement({
    tagName: "div",
    role: "textbox",
    ariaLabel: "Enter a prompt here",
    className: "ql-editor gemini-pill-input"
  });

  const result = diagnostics.scanGeminiUi(createDiagnosticsRoot([prompt]));

  assert.strictEqual(result.summary.promptEditor, 1);
  assert.strictEqual(result.categories.promptEditor[0].tagName, "div");
  assert.strictEqual(result.categories.promptEditor[0].ariaLabel, "Enter a prompt here");
}

function testGeminiDiagnosticsDetectsPlusMenu() {
  const diagnostics = globalThis.PWM.SiteAdapters.GeminiDiagnosticsAdapter;
  const uploadButton = createDiagnosticsElement({
    tagName: "button",
    ariaLabel: "Add files",
    dataTestId: "gemini-upload-menu-button"
  });

  const result = diagnostics.scanGeminiUi(createDiagnosticsRoot([uploadButton]));

  assert.strictEqual(result.summary.plusUploadButton, 1);
  assert.strictEqual(result.categories.plusUploadButton[0].ariaLabel, "Add files");
}

function testGeminiDiagnosticsDetectsMoreUploadsMenuAndDropTarget() {
  const diagnostics = globalThis.PWM.SiteAdapters.GeminiDiagnosticsAdapter;
  const moreUploads = createDiagnosticsElement({
    tagName: "button",
    role: "menuitem",
    ariaLabel: "More Uploads",
    className: "mat-mdc-menu-panel"
  });
  const dropTarget = createDiagnosticsElement({
    tagName: "div",
    role: "button",
    ariaLabel: "Drop files to upload",
    className: "upload-drop-zone"
  });

  const result = diagnostics.scanGeminiUi(createDiagnosticsRoot([moreUploads, dropTarget]));

  assert.ok(result.summary.uploadOption >= 1);
  assert.ok(result.summary.dropTarget >= 1);
  assert.ok(result.categories.uploadOption.some((entry) => entry.ariaLabel === "More Uploads"));
  assert.ok(result.categories.dropTarget.some((entry) => entry.ariaLabel === "Drop files to upload"));
}

function testGeminiDiagnosticsDetectsHiddenFileInput() {
  const diagnostics = globalThis.PWM.SiteAdapters.GeminiDiagnosticsAdapter;
  const fileInput = createDiagnosticsElement({
    tagName: "input",
    type: "file",
    name: "Filedata",
    hidden: true,
    multiple: true
  });

  const result = diagnostics.scanGeminiUi(createDiagnosticsRoot([fileInput]));

  assert.strictEqual(result.summary.fileInput, 1);
  assert.strictEqual(result.categories.fileInput[0].input.multiple, true);
  assert.strictEqual(result.categories.fileInput[0].state.hidden, true);
}

function testGeminiDiagnosticsDetectsBlobDownloadWithoutRawMetadata() {
  const diagnostics = globalThis.PWM.SiteAdapters.GeminiDiagnosticsAdapter;
  const rawSecret = "GeminiGeneratedSecretDownload12345";
  const blobLink = createDiagnosticsElement({
    tagName: "a",
    href: `blob:https://gemini.google.com/${rawSecret}`,
    download: `${rawSecret}.env`,
    text: `Download ${rawSecret}`
  });
  const downloadButton = createDiagnosticsElement({
    tagName: "button",
    ariaLabel: "Download generated file",
    dataTestId: "download-generated-file"
  });

  const result = diagnostics.scanGeminiUi(createDiagnosticsRoot([blobLink, downloadButton]));
  const serialized = JSON.stringify(result);

  assert.strictEqual(result.summary.generatedDownload, 2);
  assert.ok(result.categories.generatedDownload.some((candidate) => candidate.hrefScheme === "blob"));
  assert.strictEqual(serialized.includes(rawSecret), false);
}

function testGeminiDiagnosticsRunnerIsDebugGated() {
  const debugEvents = [];
  const fakeWindow = {
    localStorage: {
      enabled: false,
      getItem(key) {
        return key === "pwm:debug" && this.enabled ? "1" : null;
      }
    },
    sessionStorage: { getItem: () => null }
  };
  const fakeGlobal = {
    PWM: {
      DebugLogger: globalThis.PWM.DebugLogger,
      HostMatching: globalThis.PWM.HostMatching,
      SiteAdapters: {
        GeminiDiagnosticsAdapter: {
          scanGeminiUi: () => ({
            summary: { promptEditor: 1 },
            categories: { promptEditor: [{ tagName: "div" }] }
          })
        }
      }
    }
  };
  const factory = new Function(
    "globalThis",
    "window",
    "document",
    "location",
    "debugReveal",
    [
      extractFunctionSource(contentSource, "isDebugEnabled"),
      extractFunctionSource(contentSource, "isGeminiHost"),
      extractFunctionSource(contentSource, "getGeminiDiagnosticsAdapter"),
      extractFunctionSource(contentSource, "runGeminiUiDiagnostics"),
      "return { runGeminiUiDiagnostics };"
    ].join("\n\n")
  );
  const { runGeminiUiDiagnostics } = factory(
    fakeGlobal,
    fakeWindow,
    {},
    { hostname: "gemini.google.com" },
    (label, payload) => debugEvents.push({ label, payload })
  );

  assert.strictEqual(runGeminiUiDiagnostics("disabled"), false);
  assert.strictEqual(debugEvents.length, 0);
  fakeWindow.localStorage.enabled = true;
  assert.strictEqual(runGeminiUiDiagnostics("enabled"), true);
  assert.strictEqual(debugEvents.length, 1);
  assert.strictEqual(debugEvents[0].label, "gemini-diagnostics:ui-map");
}

function testGeminiDiagnosticsRunnerDoesNotThrowWhenDebugHelperIsUnavailable() {
  const debugEvents = [];
  const fakeGlobal = {
    PWM: {
      DebugLogger: {},
      HostMatching: globalThis.PWM.HostMatching,
      SiteAdapters: {
        GeminiDiagnosticsAdapter: {
          scanGeminiUi: () => {
            throw new Error("diagnostics should stay disabled without debug gate");
          }
        }
      }
    }
  };
  const factory = new Function(
    "globalThis",
    "window",
    "document",
    "location",
    "debugReveal",
    [
      extractFunctionSource(contentSource, "isGeminiHost"),
      extractFunctionSource(contentSource, "getGeminiDiagnosticsAdapter"),
      extractFunctionSource(contentSource, "runGeminiUiDiagnostics"),
      "return { runGeminiUiDiagnostics };"
    ].join("\n\n")
  );
  const { runGeminiUiDiagnostics } = factory(
    fakeGlobal,
    {},
    {},
    { hostname: "gemini.google.com" },
    (label, payload) => debugEvents.push({ label, payload })
  );

  assert.doesNotThrow(() => {
    assert.strictEqual(runGeminiUiDiagnostics("boot"), false);
  });
  assert.strictEqual(debugEvents.length, 0);
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
    debugEvents,
    fallbackDrops,
    consoleErrors,
    runtimeMessages
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
  assert.strictEqual(runtimeMessages.length, 0);
  assert.strictEqual(sanitizedFile.text.includes(rawSecret), false);
  assert.ok(sanitizedFile.text.includes("[PWM_1]"));
  assert.ok(
    debugEvents.some((entry) => entry.label === "file-handoff:gemini-input-not-found"),
    "expected legacy Gemini drop handoff to fail closed without opening the upload picker"
  );
  assert.ok(
    debugEvents.some(
      (entry) =>
        entry.label === "sanitized-file-handoff:failed" &&
        entry.payload.failureReason === "no_file_input_without_opening_picker"
    )
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
    fallbackDrops,
    consoleErrors,
    debugEvents,
    runtimeMessages
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
  assert.strictEqual(runtimeMessages.length, 0);
  assert.ok(
    debugEvents.some(
      (entry) =>
        entry.label === "sanitized-file-handoff:failed" &&
        entry.payload.failureReason === "no_file_input_without_opening_picker"
    )
  );
}

async function testGeminiDropGhostIngressAttachesSanitizedFileAfterVisibleUploadFlow() {
  const rawSecret = "LeakGuardDropApiKey1234567890";
  const sanitizedFile = {
    name: "ghost-gemini.env",
    type: "text/plain",
    size: 24,
    text: "API_KEY=[PWM_1]"
  };
  const fileInputs = [];
  const overlayItems = [];
  const uploadTrigger = createUploadTrigger({
    ariaLabel: "Open upload file menu",
    className: "upload-card mat-mdc-button",
    onClick: () => {
      overlayItems.push(
        createOverlayItem({
          ariaLabel: "Upload files. Documents, data, code files",
          text: "Upload files",
          onClick: () => {
            fileInputs.push(createFileInput({ source: "light-dom", multiple: true, inGeminiUploader: true }));
          }
        })
      );
    }
  });
  const { handOffGeminiSanitizedFileUpload, fallbackDrops, runtimeMessages, consoleErrors } =
    createHandoffHarness({
      fileInputs,
      uploadTriggers: [uploadTrigger],
      overlayItems
    });
  const event = {
    type: "drop",
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer({
      files: [
        {
          name: "ghost-gemini.env",
          type: "text/plain",
          size: 64
        }
      ]
    })
  };

  const handedOff = await handOffGeminiSanitizedFileUpload(event, null, sanitizedFile, {
    allowUploadUiClick: true
  });

  assert.strictEqual(handedOff, true);
  assert.deepStrictEqual(uploadTrigger.events, ["click"]);
  assert.deepStrictEqual(overlayItems[0].events, ["click"]);
  assert.strictEqual(fileInputs[0].files[0], sanitizedFile);
  assert.strictEqual(JSON.stringify(fileInputs[0].files).includes(rawSecret), false);
  assert.deepStrictEqual(fileInputs[0].events, ["input", "change"]);
  assert.strictEqual(fallbackDrops.length, 0);
  assert.strictEqual(runtimeMessages.length, 0);
  assert.strictEqual(consoleErrors.length, 0);
}

async function testGeminiGhostIngressInterceptsEphemeralFileInputClick() {
  const rawSecret = "LeakGuardDropApiKey1234567890";
  const sanitizedFile = {
    name: "ghost-click.env",
    type: "text/plain",
    size: 24,
    text: "API_KEY=[PWM_1]"
  };
  let input = null;
  let clickEvent = null;
  let interceptorWasInstalledBeforeUploadClick = false;
  let harness = null;
  const uploadTrigger = createUploadTrigger({
    ariaLabel: "Open upload file menu",
    onClick: () => {
      interceptorWasInstalledBeforeUploadClick = harness.windowClickHandlers.length === 1;
    }
  });
  const overlayItem = createOverlayItem({
    onClick: () => {
      input = createFileInput({ name: "Filedata", multiple: true });
      clickEvent = createClickEvent(input);
      assert.strictEqual(harness.windowClickHandlers.length, 1);
      harness.windowClickHandlers[0](clickEvent.event);
    }
  });
  harness = createHandoffHarness({
    uploadTriggers: [uploadTrigger],
    overlayItems: [overlayItem]
  });
  const event = {
    type: "drop",
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer()
  };

  const handedOff = await harness.handOffGeminiSanitizedFileUpload(event, null, sanitizedFile, {
    allowUploadUiClick: true
  });

  assert.strictEqual(interceptorWasInstalledBeforeUploadClick, true);
  assert.strictEqual(handedOff, true);
  assert.strictEqual(clickEvent.calls.preventDefault, 1);
  assert.strictEqual(clickEvent.calls.stopPropagation, 1);
  assert.strictEqual(clickEvent.calls.stopImmediatePropagation, 1);
  assert.strictEqual(input.files[0], sanitizedFile);
  assert.strictEqual(JSON.stringify(input.files).includes(rawSecret), false);
  assert.deepStrictEqual(input.events, ["input", "change"]);
  assert.deepStrictEqual(
    input.eventObjects.map((dispatched) => ({
      type: dispatched.type,
      bubbles: dispatched.bubbles,
      cancelable: dispatched.cancelable,
      composed: dispatched.composed
    })),
    [
      { type: "input", bubbles: true, cancelable: true, composed: true },
      { type: "change", bubbles: true, cancelable: true, composed: true }
    ]
  );
  assert.strictEqual(harness.windowClickHandlers.length, 0);
  assert.ok(
    harness.listenerEvents.find(
      (entry) => entry.target === "window" && entry.action === "add" && entry.type === "click" && entry.capture
    )
  );
  assert.ok(
    harness.listenerEvents.find(
      (entry) => entry.target === "window" && entry.action === "remove" && entry.type === "click" && entry.capture
    )
  );
}

async function testFirefoxGeminiGhostIngressUsesHiddenSelectorFallback() {
  const rawSecret = "LeakGuardDropApiKey1234567890";
  const sanitizedFile = {
    name: "firefox-hidden-ghost.env",
    type: "text/plain",
    size: 24,
    text: "API_KEY=[PWM_1]"
  };
  let input = null;
  let inputClick = null;
  let interceptorWasInstalledBeforeUploadClick = false;
  let harness = null;
  const uploadTrigger = createUploadTrigger({
    ariaLabel: "Open upload file menu",
    onClick: () => {
      interceptorWasInstalledBeforeUploadClick = harness.windowClickHandlers.length === 1;
    }
  });
  const overlayItem = createOverlayItem({
    dataTestId: "local-images-files-uploader-button",
    onClick: () => {
      // Firefox/Gemini can ignore the visible item click; hidden selector fallback must finish the chain.
    }
  });
  const hiddenTrigger = createHiddenFileSelectorTrigger({
    onClick: () => {
      assert.strictEqual(harness.windowClickHandlers.length, 1);
      input = createFileInput({ name: "Filedata", multiple: true });
      input.click = () => {
        throw new Error("Firefox Gemini ghost ingress must not call input.click()");
      };
      input.showPicker = () => {
        throw new Error("Firefox Gemini ghost ingress must not call input.showPicker()");
      };
      inputClick = createClickEvent(input);
      harness.windowClickHandlers[0](inputClick.event);
    }
  });
  harness = createHandoffHarness({
    userAgent: "Firefox",
    uploadTriggers: [uploadTrigger],
    overlayItems: [overlayItem],
    hiddenTriggers: [hiddenTrigger]
  });
  const event = {
    type: "drop",
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer()
  };

  const handedOff = await harness.handOffGeminiSanitizedFileUpload(event, null, sanitizedFile, {
    allowUploadUiClick: true
  });

  assert.strictEqual(interceptorWasInstalledBeforeUploadClick, true);
  assert.strictEqual(handedOff, true);
  assert.deepStrictEqual(uploadTrigger.events, ["click"]);
  assert.deepStrictEqual(overlayItem.events, ["pointerdown", "mousedown", "mouseup", "click"]);
  assert.ok(hiddenTrigger.events.includes("click"));
  assert.strictEqual(inputClick.calls.preventDefault, 1);
  assert.strictEqual(inputClick.calls.stopImmediatePropagation, 1);
  assert.strictEqual(input.files[0], sanitizedFile);
  assert.strictEqual(JSON.stringify(input.files).includes(rawSecret), false);
  assert.deepStrictEqual(input.events, ["input", "change"]);
  assert.strictEqual(harness.windowClickHandlers.length, 0);
}

async function testFirefoxGeminiGhostIngressUsesDelayedHiddenSelectorFallback() {
  const rawSecret = "LeakGuardDropApiKey1234567890";
  const sanitizedFile = {
    name: "firefox-delayed-hidden-ghost.env",
    type: "text/plain",
    size: 24,
    text: "API_KEY=[PWM_1]"
  };
  const hiddenTriggers = [];
  let input = null;
  let inputClick = null;
  let hiddenTrigger = null;
  let harness = null;
  const uploadTrigger = createUploadTrigger({ ariaLabel: "Open upload file menu" });
  const overlayItem = createOverlayItem({
    dataTestId: "local-images-files-uploader-button",
    onClick: () => {
      hiddenTrigger = createHiddenFileSelectorTrigger({
        onClick: () => {
          assert.strictEqual(harness.windowClickHandlers.length, 1);
          input = createFileInput({ name: "Filedata", multiple: true });
          input.click = () => {
            throw new Error("Firefox Gemini ghost ingress must not call input.click()");
          };
          input.showPicker = () => {
            throw new Error("Firefox Gemini ghost ingress must not call input.showPicker()");
          };
          inputClick = createClickEvent(input);
          harness.windowClickHandlers[0](inputClick.event);
        }
      });
      hiddenTriggers.push(hiddenTrigger);
      const observer = harness.observers.find((candidate) => !candidate.disconnected);
      assert.ok(observer, "expected ghost-ingress observer to remain active after Upload files click");
      observer.trigger([{ target: hiddenTrigger, addedNodes: [hiddenTrigger] }]);
    }
  });
  harness = createHandoffHarness({
    userAgent: "Firefox",
    uploadTriggers: [uploadTrigger],
    overlayItems: [overlayItem],
    hiddenTriggers
  });
  const event = {
    type: "drop",
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer()
  };

  const handedOff = await harness.handOffGeminiSanitizedFileUpload(event, null, sanitizedFile, {
    allowUploadUiClick: true
  });

  assert.strictEqual(handedOff, true);
  assert.deepStrictEqual(uploadTrigger.events, ["click"]);
  assert.deepStrictEqual(overlayItem.events, ["pointerdown", "mousedown", "mouseup", "click"]);
  assert.ok(hiddenTrigger.events.includes("click"));
  assert.strictEqual(inputClick.calls.preventDefault, 1);
  assert.strictEqual(input.files[0], sanitizedFile);
  assert.strictEqual(JSON.stringify(input.files).includes(rawSecret), false);
  assert.deepStrictEqual(input.events, ["input", "change"]);
  assert.ok(
    harness.debugEvents.some((entry) => entry.label === "file-handoff:gemini-firefox-prime-hidden-trigger-clicked"),
    "expected delayed hidden selector activation diagnostics"
  );
  assert.strictEqual(harness.windowClickHandlers.length, 0);
}

async function testFirefoxGeminiDropLocalHandoffAllowsUploadUiAndCapturesHiddenInput() {
  const rawSecret = "LeakGuardDropApiKey1234567890";
  const rawFile = {
    name: "firefox-ghost.env",
    type: "text/plain",
    size: 64,
    text: `API_KEY=${rawSecret}`
  };
  const sanitizedFile = {
    name: "firefox-ghost.env",
    type: "text/plain",
    size: 24,
    text: "API_KEY=[PWM_1]"
  };
  let input = null;
  let hiddenSelectorClick = null;
  let inputClick = null;
  let interceptorWasInstalledBeforeUploadClick = false;
  let harness = null;
  const uploadTrigger = createUploadTrigger({
    ariaLabel: "Open upload file menu",
    onClick: () => {
      interceptorWasInstalledBeforeUploadClick = harness.windowClickHandlers.length === 1;
    }
  });
  const overlayItem = createOverlayItem({
    dataTestId: "local-images-files-uploader-button",
    onClick: () => {
      const hiddenSelectorTrigger = createHiddenFileSelectorTrigger();
      hiddenSelectorClick = createClickEvent(hiddenSelectorTrigger);
      assert.strictEqual(harness.windowClickHandlers.length, 1);
      harness.windowClickHandlers[0](hiddenSelectorClick.event);
      input = createFileInput({ name: "Filedata", multiple: true });
      input.click = () => {
        throw new Error("Firefox Gemini drop handoff must not call input.click()");
      };
      input.showPicker = () => {
        throw new Error("Firefox Gemini drop handoff must not call input.showPicker()");
      };
      inputClick = createClickEvent(input);
      assert.strictEqual(harness.windowClickHandlers.length, 1);
      harness.windowClickHandlers[0](inputClick.event);
    }
  });
  harness = createHandoffHarness({
    userAgent: "Firefox",
    uploadTriggers: [uploadTrigger],
    overlayItems: [overlayItem]
  });
  const event = {
    type: "drop",
    target: {
      nodeType: 1,
      tagName: "DIV",
      dispatchEvent() {
        throw new Error("Firefox Gemini drop handoff must not replay a synthetic drop");
      }
    },
    dataTransfer: createDataTransfer({ files: [rawFile] })
  };

  const handedOff = await harness.handOffSanitizedLocalFile(event, null, sanitizedFile, "drop");

  assert.strictEqual(interceptorWasInstalledBeforeUploadClick, true);
  assert.strictEqual(handedOff, true);
  assert.deepStrictEqual(uploadTrigger.events, ["click"]);
  assert.deepStrictEqual(overlayItem.events, ["pointerdown", "mousedown", "mouseup", "click"]);
  assert.strictEqual(hiddenSelectorClick.event.defaultPrevented, false);
  assert.strictEqual(hiddenSelectorClick.calls.stopImmediatePropagation, 0);
  assert.strictEqual(inputClick.event.defaultPrevented, true);
  assert.strictEqual(inputClick.calls.stopImmediatePropagation, 1);
  assert.strictEqual(input.files[0], sanitizedFile);
  assert.notStrictEqual(input.files[0], rawFile);
  assert.strictEqual(JSON.stringify(input.files).includes(rawSecret), false);
  assert.deepStrictEqual(input.events, ["input", "change"]);
  assert.strictEqual(harness.fallbackDrops.length, 0);
  assert.strictEqual(harness.consoleErrors.length, 0);
  assert.strictEqual(harness.windowClickHandlers.length, 0);
  assert.ok(
    !harness.debugEvents.some(
      (entry) =>
        entry.payload?.failureReason === "no_file_input_without_opening_picker" ||
        entry.details?.failureReason === "no_file_input_without_opening_picker"
    ),
    "Firefox Gemini drop should allow the guarded upload UI path"
  );
}

async function testGeminiGhostIngressClickInterceptorIgnoresUnrelatedFileInput() {
  const sanitizedFile = {
    name: "ignore.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  let unrelatedClick = null;
  let harness = null;
  const uploadTrigger = createUploadTrigger({
    ariaLabel: "Open upload file menu",
    onClick: () => {
      const unrelatedInput = createFileInput({ name: "avatar" });
      unrelatedClick = createClickEvent(unrelatedInput);
      harness.windowClickHandlers[0](unrelatedClick.event);
    }
  });
  harness = createHandoffHarness({
    uploadTriggers: [uploadTrigger]
  });
  const handoffPromise = harness.handOffGeminiSanitizedFileUpload(
    { type: "drop", target: { nodeType: 1, tagName: "DIV" }, dataTransfer: createDataTransfer() },
    null,
    sanitizedFile,
    { allowUploadUiClick: true }
  );
  triggerGhostIngressTimeout(harness);
  const handedOff = await handoffPromise;

  assert.strictEqual(handedOff, false);
  assert.strictEqual(unrelatedClick.calls.preventDefault, 0);
  assert.strictEqual(unrelatedClick.event.defaultPrevented, false);
  assert.strictEqual(harness.windowClickHandlers.length, 0);
}

async function testGeminiGhostIngressClickInterceptorRemovedAfterTimeout() {
  const sanitizedFile = {
    name: "timeout.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  const harness = createHandoffHarness({
    uploadTriggers: [createUploadTrigger({ ariaLabel: "Open upload file menu" })]
  });
  const handoffPromise = harness.handOffGeminiSanitizedFileUpload(
    { type: "drop", target: { nodeType: 1, tagName: "DIV" }, dataTransfer: createDataTransfer() },
    null,
    sanitizedFile,
    { allowUploadUiClick: true }
  );

  assert.strictEqual(harness.windowClickHandlers.length, 1);
  triggerGhostIngressTimeout(harness);
  const handedOff = await handoffPromise;

  assert.strictEqual(handedOff, false);
  assert.strictEqual(harness.windowClickHandlers.length, 0);
}

async function testGeminiGhostIngressClickInterceptorRemovedAfterAssignmentFailure() {
  const sanitizedFile = {
    name: "assignment-fails.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  let failingClick = null;
  let harness = null;
  const uploadTrigger = createUploadTrigger({
    ariaLabel: "Open upload file menu"
  });
  const overlayItem = createOverlayItem({
    onClick: () => {
      const input = createFileInput({ name: "Filedata" });
      input.dispatchEvent = () => {
        throw new Error("change dispatch failed");
      };
      failingClick = createClickEvent(input);
      harness.windowClickHandlers[0](failingClick.event);
    }
  });
  harness = createHandoffHarness({
    uploadTriggers: [uploadTrigger],
    overlayItems: [overlayItem]
  });
  const handedOff = await harness.handOffGeminiSanitizedFileUpload(
    { type: "drop", target: { nodeType: 1, tagName: "DIV" }, dataTransfer: createDataTransfer() },
    null,
    sanitizedFile,
    { allowUploadUiClick: true }
  );

  assert.strictEqual(handedOff, false);
  assert.strictEqual(failingClick.calls.preventDefault, 1);
  assert.strictEqual(harness.windowClickHandlers.length, 0);
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
  const harness = createHandoffHarness({
    userAgent: "Firefox",
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

  const handedOff = await queuePendingGeminiHandoffThroughGhostTimeout(harness, event, sanitizedFile);
  fileInputs.push(createFileInput({ source: "light-dom" }));
  const assigned = harness.attemptPendingGeminiSanitizedFileHandoff("test-input-added");

  assert.strictEqual(handedOff, false);
  assert.strictEqual(assigned, true);
  assert.strictEqual(harness.hasPendingGeminiSanitizedFileHandoff(sanitizedFile), false);
  assert.strictEqual(fileInputs[0].files.length, 1);
  assert.strictEqual(fileInputs[0].files[0], sanitizedFile);
  assert.deepStrictEqual(fileInputs[0].events, ["input", "change"]);
  assert.strictEqual(harness.fallbackDrops.length, 0);
  assert.strictEqual(harness.consoleErrors.length, 0);
  assert.strictEqual(JSON.stringify(harness.debugEvents).includes(rawSecret), false);
  assert.ok(
    harness.debugEvents.some((entry) => entry.label === "file-handoff:gemini-pending-assigned"),
    "expected pending Gemini sanitized file to attach when a real input appears"
  );
}

async function testGeminiPendingMutationObserverAssignsWhenInputAppears() {
  const sanitizedFile = {
    name: "observer-gemini.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  const fileInputs = [];
  const harness = createHandoffHarness({
    userAgent: "Firefox",
    fileInputs,
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

  await queuePendingGeminiHandoffThroughGhostTimeout(harness, event, sanitizedFile);
  assert.ok(harness.observers.length >= 1, "expected pending handoff MutationObserver");
  fileInputs.push(createFileInput({ source: "light-dom" }));
  const pendingObserver = harness.observers.find((observer) => !observer.disconnected);
  assert.ok(pendingObserver, "expected active pending handoff observer");
  pendingObserver.trigger();

  assert.strictEqual(harness.hasPendingGeminiSanitizedFileHandoff(sanitizedFile), false);
  assert.strictEqual(fileInputs[0].files[0], sanitizedFile);
  assert.deepStrictEqual(fileInputs[0].events, ["input", "change"]);
  assert.strictEqual(harness.fallbackDrops.length, 0);
  assert.strictEqual(harness.consoleErrors.length, 0);
  assert.ok(
    harness.debugEvents.some((entry) => entry.label === "file-handoff:gemini-pending-assigned"),
    "expected MutationObserver to complete pending sanitized handoff"
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
  const harness = createHandoffHarness({
    userAgent: "Firefox",
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

  await queuePendingGeminiHandoffThroughGhostTimeout(harness, event, sanitizedFile);
  const assigned = harness.attemptPendingGeminiSanitizedFileHandoff("manual-diagnostics");

  assert.strictEqual(assigned, false);
  assert.strictEqual(harness.fallbackDrops.length, 0);
  assert.strictEqual(harness.consoleErrors.length, 0);
  const diagnostic = harness.debugEvents.find(
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
  const harness = createHandoffHarness({
    userAgent: "Firefox",
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

  await queuePendingGeminiHandoffThroughGhostTimeout(harness, event, sanitizedFile);

  const pending = harness.getPendingGeminiSanitizedFileHandoffDebug();
  assert.ok(pending, "expected pending sanitized handoff");
  assert.deepStrictEqual(
    pending.keys.sort(),
    ["createdAt", "expiresAt", "sanitizedFile", "sessionHash"].sort()
  );
  assert.strictEqual(
    Object.prototype.hasOwnProperty.call(pending, "sanitizedFile"),
    false,
    "pending handoff debug must expose metadata, not the File object"
  );
  assert.deepStrictEqual(pending.sanitizedFileDebug, {
    name: sanitizedFile.name,
    type: sanitizedFile.type,
    size: sanitizedFile.size
  });
  assert.strictEqual(JSON.stringify(pending.sanitizedFileDebug).includes(rawSecret), false);
  assert.strictEqual(harness.fallbackDrops.length, 0);
  assert.strictEqual(harness.consoleErrors.length, 0);
}

async function testGeminiPendingHandoffExpiresAndCleansUp() {
  const sanitizedFile = {
    name: "expires-gemini.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  const harness = createHandoffHarness({
    userAgent: "Firefox",
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

  await queuePendingGeminiHandoffThroughGhostTimeout(harness, event, sanitizedFile);
  const expiryTimer = harness.timeoutCallbacks.find((entry) => entry.delay === 60000);
  assert.ok(expiryTimer, "expected pending handoff expiry timer");
  assert.strictEqual(harness.hasPendingGeminiSanitizedFileHandoff(sanitizedFile), true);
  assert.strictEqual(harness.clickHandlers.length, 1);
  assert.ok(harness.observers.length >= 1);
  assert.strictEqual(harness.promptNodes.length, 1);
  assert.strictEqual(harness.promptNodes[0].isConnected, true);

  expiryTimer.callback();

  assert.strictEqual(harness.hasPendingGeminiSanitizedFileHandoff(sanitizedFile), false);
  assert.strictEqual(harness.clickHandlers.length, 0);
  assert.ok(harness.clearedTimeouts.includes(expiryTimer.id));
  assert.ok(harness.observers.some((observer) => observer.disconnected));
  assert.strictEqual(harness.promptNodes[0].isConnected, false);
  assert.ok(
    harness.debugEvents.some(
      (entry) => entry.label === "file-handoff:gemini-pending-cleared" && entry.payload.reason === "expired"
    )
  );
  assert.ok(
    harness.debugEvents.some(
      (entry) =>
        entry.label === "file-ui:pending-prompt-cleared" &&
        entry.payload.site === "gemini" &&
        entry.payload.reason === "expired"
    )
  );
}

async function testGrokPendingHandoffExpiresAndCleansUp() {
  const sanitizedFile = {
    name: "expires-grok.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  const harness = createHandoffHarness({
    hostname: "grok.com",
    userAgent: "Firefox",
    uploadTriggers: [
      createUploadTrigger({
        ariaLabel: "Attach files"
      })
    ]
  });
  const event = {
    type: "drop",
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer()
  };

  assert.strictEqual(harness.queuePendingGrokSanitizedFileHandoff(event, null, sanitizedFile, {}), true);
  const expiryTimer = harness.timeoutCallbacks.find((entry) => entry.delay === 60000);
  assert.ok(expiryTimer, "expected Grok pending handoff expiry timer");
  assert.strictEqual(harness.hasPendingGrokSanitizedFileHandoff(sanitizedFile), true);
  assert.strictEqual(harness.clickHandlers.length, 1);
  assert.ok(harness.observers.length >= 1);
  assert.strictEqual(harness.promptNodes.length, 1);
  assert.strictEqual(harness.promptNodes[0].isConnected, true);

  expiryTimer.callback();

  assert.strictEqual(harness.hasPendingGrokSanitizedFileHandoff(sanitizedFile), false);
  assert.strictEqual(harness.clickHandlers.length, 0);
  assert.ok(harness.clearedTimeouts.includes(expiryTimer.id));
  assert.ok(harness.observers.some((observer) => observer.disconnected));
  assert.strictEqual(harness.promptNodes[0].isConnected, false);
  assert.ok(
    harness.debugEvents.some(
      (entry) => entry.label === "file-handoff:grok-pending-cleared" && entry.payload.reason === "expired"
    )
  );
  assert.ok(
    harness.debugEvents.some(
      (entry) =>
        entry.label === "file-ui:pending-prompt-cleared" &&
        entry.payload.site === "grok" &&
        entry.payload.reason === "expired"
    )
  );
  assert.strictEqual(JSON.stringify(harness.debugEvents).includes("API_KEY"), false);
  assert.strictEqual(JSON.stringify(harness.debugEvents).includes("[PWM_1]"), false);
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
  const harness = createHandoffHarness({
    userAgent: "Firefox",
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

  await queuePendingGeminiHandoffThroughGhostTimeout(harness, event, firstSanitizedFile);
  await queuePendingGeminiHandoffThroughGhostTimeout(harness, event, secondSanitizedFile);

  const pending = harness.getPendingGeminiSanitizedFileHandoffDebug();
  assert.strictEqual(harness.hasPendingGeminiSanitizedFileHandoff(firstSanitizedFile), false);
  assert.strictEqual(harness.hasPendingGeminiSanitizedFileHandoff(secondSanitizedFile), true);
  assert.strictEqual(
    Object.prototype.hasOwnProperty.call(pending, "sanitizedFile"),
    false,
    "replacement debug must not expose the pending File object"
  );
  assert.deepStrictEqual(pending.sanitizedFileDebug, {
    name: secondSanitizedFile.name,
    type: secondSanitizedFile.type,
    size: secondSanitizedFile.size
  });
  assert.strictEqual(harness.clickHandlers.length, 1);
  assert.ok(harness.observers.some((observer) => observer.disconnected));
  assert.ok(
    harness.debugEvents.some(
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
  const harness = createHandoffHarness({
    userAgent: "Firefox",
    uploadTriggers: [uploadTrigger]
  });
  const event = {
    type: "drop",
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer()
  };

  await queuePendingGeminiHandoffThroughGhostTimeout(harness, event, sanitizedFile);
  assert.strictEqual(harness.clickHandlers.length, 1);

  const clickEvent = {
    target: uploadTrigger,
    defaultPrevented: false,
    propagationStopped: false,
    immediatePropagationStopped: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {
      this.propagationStopped = true;
    },
    stopImmediatePropagation() {
      this.immediatePropagationStopped = true;
    }
  };

  harness.clickHandlers[0](clickEvent);

  assert.deepStrictEqual(uploadTrigger.events, []);
  assert.strictEqual(clickEvent.defaultPrevented, false);
  assert.strictEqual(clickEvent.propagationStopped, false);
  assert.strictEqual(clickEvent.immediatePropagationStopped, false);
  assert.strictEqual(harness.consoleErrors.length, 0);
  assert.ok(
    harness.debugEvents.some((entry) => entry.label === "file-handoff:gemini-upload-click-observed"),
    "expected click observation without programmatic upload click"
  );
}

async function testGeminiPendingUploadClickThenFiledataInputAssignsSanitizedFile() {
  const sanitizedFile = {
    name: "click-filedata-gemini.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  const fileInputs = [];
  const uploadTrigger = createUploadTrigger({
    ariaLabel: "Open upload file menu",
    className: "upload-card-button"
  });
  const menuItem = createOverlayItem({
    ariaLabel: "Upload files. Documents, data, code files",
    text: "Upload files"
  });
  const dataTestButton = createOverlayItem({
    ariaLabel: "",
    text: "",
    role: "",
    dataTestId: "local-images-files-uploader-button"
  });
  const hiddenTrigger = createHiddenFileSelectorTrigger();
  const harness = createHandoffHarness({
    userAgent: "Firefox",
    fileInputs,
    uploadTriggers: [uploadTrigger]
  });
  const event = {
    type: "drop",
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer()
  };

  await queuePendingGeminiHandoffThroughGhostTimeout(harness, event, sanitizedFile);
  assert.strictEqual(harness.clickHandlers.length, 1);

  for (const target of [uploadTrigger, dataTestButton, menuItem, hiddenTrigger]) {
    harness.clickHandlers[0](createClickEvent(target).event);
  }

  fileInputs.push(createFileInput({ source: "light-dom", name: "Filedata", multiple: true }));
  const pendingObserver = harness.observers.find((observer) => !observer.disconnected);
  assert.ok(pendingObserver, "expected pending observer to watch for Filedata input");
  pendingObserver.trigger();

  assert.strictEqual(fileInputs[0].files.length, 1);
  assert.strictEqual(fileInputs[0].files[0], sanitizedFile);
  assert.deepStrictEqual(fileInputs[0].events, ["input", "change"]);
  assert.strictEqual(harness.hasPendingGeminiSanitizedFileHandoff(sanitizedFile), false);
  assert.strictEqual(
    harness.debugEvents.filter((entry) => entry.label === "file-handoff:gemini-upload-click-observed").length,
    4
  );
}

async function testGeminiPendingAttachPromptButtonCompletesTrustedAttach() {
  const sanitizedFile = {
    name: "prompt-gemini.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  const fileInputs = [];
  const overlayItems = [];
  const uploadFilesMenuItem = createOverlayItem({
    dataTestId: "local-images-files-uploader-button",
    onClick: () => {
      if (!fileInputs.length) {
        fileInputs.push(createFileInput({ source: "light-dom", name: "Filedata", multiple: true }));
      }
    }
  });
  const uploadTrigger = createUploadTrigger({
    ariaLabel: "Open upload file menu",
    className: "upload-card-button",
    onClick: () => {
      if (!overlayItems.length) overlayItems.push(uploadFilesMenuItem);
    }
  });
  const harness = createHandoffHarness({
    userAgent: "Firefox",
    fileInputs,
    uploadTriggers: [uploadTrigger],
    overlayItems
  });
  const event = {
    type: "drop",
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer()
  };

  const queued = harness.queuePendingGeminiSanitizedFileHandoff(event, null, sanitizedFile, {
    handoffStage: "gemini:streaming-pending-user-upload-input"
  });

  assert.strictEqual(queued, true);
  assert.strictEqual(harness.promptNodes.length, 1);
  assert.ok(
    harness.debugEvents.some((entry) => entry.label === "pending-attach-prompt-shown"),
    "expected pending attach prompt"
  );

  const attachButton = findButtonByText(harness.promptNodes[0], "Attach sanitized file");
  assert.ok(attachButton, "expected attach sanitized file button");
  attachButton.dispatchEvent(createClickEvent(attachButton).event);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepStrictEqual(uploadTrigger.events, ["pointerdown", "mousedown", "mouseup", "click"]);
  assert.deepStrictEqual(uploadFilesMenuItem.events, ["pointerdown", "mousedown", "mouseup", "click"]);
  assert.strictEqual(fileInputs.length, 1);
  assert.strictEqual(fileInputs[0].files[0], sanitizedFile);
  assert.deepStrictEqual(fileInputs[0].events, ["input", "change"]);
  assert.strictEqual(harness.hasPendingGeminiSanitizedFileHandoff(sanitizedFile), false);
  assert.strictEqual(harness.promptNodes[0].isConnected, false);
  for (const label of [
    "pending-attach-prompt-attach-clicked",
    "file-handoff:pending-user-attach-clicked",
    "gemini-pending-user-attach-start",
    "gemini-pending-user-attach-menu-opened",
    "gemini-pending-user-attach-menu-item-clicked",
    "gemini-pending-user-attach-input-captured",
    "file-handoff:pending-input-captured",
    "gemini-pending-user-attach-assigned",
    "file-handoff:pending-assigned",
    "file-input:sanitized-handoff-marked"
  ]) {
    assert.ok(harness.debugEvents.some((entry) => entry.label === label), `expected ${label}`);
  }
  assert.ok(
    !harness.debugEvents.some((entry) => /hidden-trigger-clicked/.test(entry.label)),
    "pending attach prompt should not start hidden-trigger loops before user attach"
  );
}

async function testGeminiMultiFilePendingAttachPromptButtonCompletesTrustedAttach() {
  const sanitizedFiles = [
    {
      name: "file-1.env",
      type: "text/plain",
      size: 18,
      text: "API_KEY=[PWM_1]"
    },
    {
      name: "file-2.json",
      type: "application/json",
      size: 20,
      text: "{\"apiKey\":\"[PWM_2]\"}"
    }
  ];
  const fileInputs = [];
  const overlayItems = [];
  const uploadFilesMenuItem = createOverlayItem({
    dataTestId: "local-images-files-uploader-button",
    onClick: () => {
      if (!fileInputs.length) {
        fileInputs.push(createFileInput({ source: "light-dom", name: "Filedata", multiple: true }));
      }
    }
  });
  const uploadTrigger = createUploadTrigger({
    ariaLabel: "Open upload file menu",
    className: "upload-card-button",
    onClick: () => {
      if (!overlayItems.length) overlayItems.push(uploadFilesMenuItem);
    }
  });
  const harness = createHandoffHarness({
    userAgent: "Firefox",
    fileInputs,
    uploadTriggers: [uploadTrigger],
    overlayItems
  });
  const event = {
    type: "drop",
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer()
  };

  const queued = harness.queuePendingGeminiSanitizedFileHandoff(event, null, sanitizedFiles, {
    handoffStage: "gemini:multi-file-pending-user-upload-input"
  });

  assert.strictEqual(queued, true);
  assert.strictEqual(harness.promptNodes.length, 1);
  assert.strictEqual(findButtonByText(harness.promptNodes[0], "Insert sanitized text instead"), null);
  assert.strictEqual(findButtonByText(harness.promptNodes[0], "Download sanitized copy"), null);
  const attachButton = findButtonByText(harness.promptNodes[0], "Attach sanitized files");
  assert.ok(attachButton, "expected multi-file attach button");
  attachButton.dispatchEvent(createClickEvent(attachButton).event);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepStrictEqual(uploadTrigger.events, ["pointerdown", "mousedown", "mouseup", "click"]);
  assert.deepStrictEqual(uploadFilesMenuItem.events, ["pointerdown", "mousedown", "mouseup", "click"]);
  assert.strictEqual(fileInputs.length, 1);
  assert.strictEqual(fileInputs[0].files.length, 2);
  assert.deepStrictEqual(Array.from(fileInputs[0].files), sanitizedFiles);
  assert.deepStrictEqual(fileInputs[0].events, ["input", "change"]);
  assert.strictEqual(harness.hasPendingGeminiSanitizedFileHandoff(sanitizedFiles), false);
  assert.strictEqual(harness.promptNodes[0].isConnected, false);
}

async function testGrokPendingUploadClickThenFileInputAssignsSanitizedFile() {
  const sanitizedFile = {
    name: "click-grok.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  const fileInputs = [];
  const uploadTrigger = createUploadTrigger({
    ariaLabel: "Upload files",
    className: "attach-file-button"
  });
  const harness = createHandoffHarness({
    hostname: "grok.com",
    fileInputs,
    uploadTriggers: [uploadTrigger]
  });
  const event = {
    type: "drop",
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer()
  };

  const queued = harness.queuePendingGrokSanitizedFileHandoff(event, null, sanitizedFile, {});

  assert.strictEqual(queued, true);
  assert.strictEqual(harness.hasPendingGrokSanitizedFileHandoff(sanitizedFile), true);
  assert.strictEqual(harness.clickHandlers.length, 1);
  harness.clickHandlers[0](createClickEvent(uploadTrigger).event);
  assert.ok(
    harness.debugEvents.some((entry) => entry.label === "file-handoff:grok-upload-click-observed"),
    "expected Grok upload click observation"
  );

  fileInputs.push(createFileInput({ source: "light-dom", multiple: true }));
  const pendingObserver = harness.observers.find((observer) => !observer.disconnected);
  assert.ok(pendingObserver, "expected Grok pending observer to watch for file inputs");
  pendingObserver.trigger();

  assert.strictEqual(fileInputs[0].files.length, 1);
  assert.strictEqual(fileInputs[0].files[0], sanitizedFile);
  assert.deepStrictEqual(fileInputs[0].events, ["input", "change"]);
  assert.strictEqual(harness.hasPendingGrokSanitizedFileHandoff(sanitizedFile), false);
  assert.ok(
    harness.debugEvents.some((entry) => entry.label === "file-handoff:grok-pending-assigned"),
    "expected Grok pending sanitized file assignment"
  );
  assert.ok(
    harness.debugEvents.some(
      (entry) => entry.label === "file-handoff:grok-pending-cleared" && entry.payload.reason === "assigned"
    ),
    "expected Grok pending cleanup after assignment"
  );
}

async function testGrokPendingAttachPromptButtonAssignsSanitizedFile() {
  const sanitizedFile = {
    name: "prompt-grok.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  const fileInputs = [];
  const uploadTrigger = createUploadTrigger({
    ariaLabel: "Upload files",
    className: "attach-file-button",
    onClick: () => {
      if (!fileInputs.length) fileInputs.push(createFileInput({ source: "light-dom", multiple: true }));
    }
  });
  const harness = createHandoffHarness({
    hostname: "grok.com",
    fileInputs,
    uploadTriggers: [uploadTrigger]
  });
  const event = {
    type: "drop",
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer()
  };

  const queued = harness.queuePendingGrokSanitizedFileHandoff(event, null, sanitizedFile, {});

  assert.strictEqual(queued, true);
  assert.strictEqual(harness.promptNodes.length, 1);
  const attachButton = findButtonByText(harness.promptNodes[0], "Attach sanitized file");
  assert.ok(attachButton, "expected attach sanitized file button");
  attachButton.dispatchEvent(createClickEvent(attachButton).event);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepStrictEqual(uploadTrigger.events, ["pointerdown", "mousedown", "mouseup", "click"]);
  assert.strictEqual(fileInputs.length, 1);
  assert.strictEqual(fileInputs[0].files[0], sanitizedFile);
  assert.deepStrictEqual(fileInputs[0].events, ["input", "change"]);
  assert.strictEqual(harness.hasPendingGrokSanitizedFileHandoff(sanitizedFile), false);
  assert.strictEqual(harness.promptNodes[0].isConnected, false);
  for (const label of [
    "pending-attach-prompt-attach-clicked",
    "file-handoff:pending-user-attach-clicked",
    "grok-pending-user-attach-start",
    "grok-pending-user-attach-input-captured",
    "file-handoff:pending-input-captured",
    "grok-pending-user-attach-assigned",
    "file-handoff:pending-assigned",
    "file-input:sanitized-handoff-marked"
  ]) {
    assert.ok(harness.debugEvents.some((entry) => entry.label === label), `expected ${label}`);
  }
}

async function testPendingAttachGateBehaviorForAdapters() {
  const sanitizedFile = {
    name: "gated.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  const event = {
    type: "drop",
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer()
  };

  for (const [hostname, adapterId, expectedEnabled] of [
    ["gemini.google.com", "gemini", true],
    ["grok.com", "grok", true],
    ["chatgpt.com", "chatgpt", true],
    ["claude.ai", "claude", true],
    ["chat.openai.com", "openai", true],
    ["x.com", "x", true],
    ["web.whatsapp.com", "whatsapp", true]
  ]) {
    const harness = createHandoffHarness({ hostname });
    const adapter = harness.getFileHandoffAdapterForLocation({ hostname });

    assert.ok(adapter, `expected ${adapterId} adapter`);
    assert.strictEqual(adapter.id, adapterId);
    assert.strictEqual(harness.isFileHandoffAdapterPendingAttachEnabled(adapter), expectedEnabled);

    const queued = harness.queuePendingSanitizedFileHandoff(adapter, event, null, sanitizedFile, {
      handoffStage: `${adapterId}:pending-gate-test`
    });

    assert.strictEqual(queued, expectedEnabled, `${adapterId} pending queue gate changed`);
    if (adapterId === "gemini") {
      assert.strictEqual(harness.hasPendingGeminiSanitizedFileHandoff(sanitizedFile), true);
      harness.clearPendingSanitizedFileHandoff("gemini", "test-cleanup");
    } else if (adapterId === "grok") {
      assert.strictEqual(harness.hasPendingGrokSanitizedFileHandoff(sanitizedFile), true);
      harness.clearPendingSanitizedFileHandoff("grok", "test-cleanup");
    } else {
      assert.ok(
        harness.debugEvents.some(
          (entry) => entry.label === "file-handoff:generic-pending-queued" && entry.payload.site === adapterId
        ),
        `expected generic pending queue diagnostic for ${adapterId}`
      );
      assert.strictEqual(harness.promptNodes.length, 1, `${adapterId} should render pending prompt`);
      assert.strictEqual(harness.timeoutCallbacks.some((entry) => entry.delay === 60000), true);
      assert.ok(
        harness.debugEvents.some(
          (entry) => entry.label === "file-handoff:pending-prompt-shown" && entry.payload.site === adapterId
        ),
        `${adapterId} should show pending prompt diagnostics`
      );
      harness.clearPendingSanitizedFileHandoff(adapterId, "test-cleanup");
    }
  }

  const unsupportedHarness = createHandoffHarness({ hostname: "protected.example" });
  assert.strictEqual(
    unsupportedHarness.getFileHandoffAdapterForLocation({ hostname: "protected.example" }),
    null
  );
  assert.strictEqual(
    unsupportedHarness.queuePendingSanitizedFileHandoff(null, event, null, sanitizedFile, {}),
    false,
    "unsupported sites must not queue pending attach"
  );
  assert.strictEqual(unsupportedHarness.promptNodes.length, 0);
  assert.strictEqual(unsupportedHarness.timeoutCallbacks.length, 0);
  assert.strictEqual(unsupportedHarness.clickHandlers.length, 0);
}

async function testPendingAttachPromptCancelClearsGeminiAndGrokState() {
  for (const [hostname, site, queueName, hasName] of [
    [
      "gemini.google.com",
      "gemini",
      "queuePendingGeminiSanitizedFileHandoff",
      "hasPendingGeminiSanitizedFileHandoff"
    ],
    ["grok.com", "grok", "queuePendingGrokSanitizedFileHandoff", "hasPendingGrokSanitizedFileHandoff"]
  ]) {
    const sanitizedFile = {
      name: `${site}-cancel.env`,
      type: "text/plain",
      size: 18,
      text: "API_KEY=[PWM_1]"
    };
    const harness = createHandoffHarness({ hostname });
    const event = {
      type: "drop",
      target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
      dataTransfer: createDataTransfer()
    };

    assert.strictEqual(harness[queueName](event, null, sanitizedFile, {}), true);
    assert.strictEqual(harness[hasName](sanitizedFile), true);
    assert.strictEqual(harness.promptNodes.length, 1);

    const cancelButton = findButtonByText(harness.promptNodes[0], "Cancel");
    assert.ok(cancelButton, `expected ${site} cancel button`);
    cancelButton.dispatchEvent(createClickEvent(cancelButton).event);
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.strictEqual(harness[hasName](sanitizedFile), false);
    assert.strictEqual(harness.promptNodes[0].isConnected, false);
    assert.ok(
      harness.debugEvents.some(
        (entry) => entry.label === `file-handoff:${site}-pending-cleared` && entry.payload.reason === "cancelled"
      ),
      `expected ${site} pending cleanup after cancel`
    );
    assert.ok(
      harness.debugEvents.some(
        (entry) =>
          entry.label === "file-ui:pending-prompt-cleared" &&
          entry.payload.site === site &&
          entry.payload.reason === "cancelled"
      ),
      `expected ${site} prompt cleanup after cancel`
    );
  }
}

async function testPendingCleanupErrorsClearStateAndLogMetadataOnly() {
  const sanitizedFile = {
    name: "cleanup-error.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  const harness = createHandoffHarness({
    hostname: "gemini.google.com",
    documentRemoveEventListenerThrows: true
  });
  const event = {
    type: "drop",
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer()
  };

  assert.strictEqual(harness.queuePendingGeminiSanitizedFileHandoff(event, null, sanitizedFile, {}), true);
  const observer = harness.observers.find((entry) => !entry.disconnected);
  assert.ok(observer, "expected pending observer");
  observer.disconnect = () => {
    throw new Error("observer cleanup failed");
  };

  harness.cancelPendingSanitizedFileAttach("gemini");

  assert.strictEqual(harness.hasPendingGeminiSanitizedFileHandoff(sanitizedFile), false);
  const cleanupDiagnostics = harness.debugEvents.filter(
    (entry) => entry.label === "file-handoff:pending-cleanup-failed"
  );
  assert.ok(
    cleanupDiagnostics.some(
      (entry) => entry.payload.site === "gemini" && entry.payload.phase === "observer-disconnect"
    ),
    "expected metadata-only observer cleanup diagnostic"
  );
  assert.ok(
    cleanupDiagnostics.some(
      (entry) => entry.payload.site === "gemini" && entry.payload.phase === "click-listener-remove"
    ),
    "expected metadata-only listener cleanup diagnostic"
  );
  assert.strictEqual(JSON.stringify(cleanupDiagnostics).includes("[PWM_1]"), false);
  assert.strictEqual(JSON.stringify(cleanupDiagnostics).includes("API_KEY"), false);
}

function testFileHandoffAdapterRegistryCoversSupportedSites() {
  const adapters = createAdapterRegistryForTest();
  assert.ok(
    contentSource.includes("globalThis.PWM.SiteAdapters.createFileHandoffAdapters"),
    "content script should build file handoff adapters from adapter modules"
  );
  for (const [id, host] of [
    ["gemini", "gemini.google.com"],
    ["grok", "grok.com"],
    ["chatgpt", "chatgpt.com"],
    ["claude", "claude.ai"],
    ["openai", "chat.openai.com"],
    ["x", "x.com"],
    ["whatsapp", "web.whatsapp.com"]
  ]) {
    assert.ok(adapters[id], `expected ${id} adapter`);
    assert.strictEqual(adapters[id].id, id, `expected ${id} adapter id`);
    assert.ok(adapters[id].hosts.includes(host), `expected ${id} host ${host}`);
  }
  assert.ok(adapters.generic, "expected generic protected-site adapter");
  assert.strictEqual(adapters.generic.id, "generic");
  assert.deepStrictEqual(adapters.generic.hosts, []);
  assert.strictEqual(adapters.generic.supportsDirectFileInputAssignment, true);
  assert.strictEqual(adapters.generic.supportsMultiFileHandoff, true);
  assert.strictEqual(adapters.generic.pendingAttachEnabled, undefined);
  assert.strictEqual(adapters.gemini.pendingAttachEnabled, true);
  assert.strictEqual(adapters.grok.pendingAttachEnabled, true);
  assert.strictEqual(adapters.chatgpt.pendingAttachEnabled, true);
  assert.strictEqual(adapters.claude.pendingAttachEnabled, true);
  assert.strictEqual(adapters.openai.pendingAttachEnabled, true);
  assert.strictEqual(adapters.x.pendingAttachEnabled, true);
  assert.strictEqual(adapters.whatsapp.pendingAttachEnabled, false);
  for (const id of ["gemini", "grok", "chatgpt", "claude", "openai", "x"]) {
    assert.ok(
      adapterRegistrySource.includes(`pendingAttachEnabled: pendingAttachEnabled?.${id}`),
      `expected ${id} pending attach to stay wired to the content-script gate`
    );
  }
  assert.strictEqual(
    adapterRegistrySource.includes("pendingAttachEnabled: pendingAttachEnabled?.whatsapp"),
    false,
    "WhatsApp narrow adapter should not wire pending attach recovery"
  );
}

function testFileAttachDebugMetadataSchemaFiltersUnsafePayloads() {
  const debugEvents = [];
  const helpers = Function(
    "debugReveal",
    [
      ...fileAttachDebugMetadataHarnessSource(),
      "return { createSafeFileAttachDebugPayload, debugFileAttachMetadata };"
    ].join("\n")
  )((label, details) => debugEvents.push({ label, details }));

  const rawSecret = "LeakGuardFileApiKey1234567890";
  const payload = helpers.createSafeFileAttachDebugPayload({
    action: "redacted",
    bytesProcessed: 42,
    totalBytes: 84,
    rawText: `API_KEY=${rawSecret}`,
    redactedText: "API_KEY=[PWM_1]",
    text: `API_KEY=${rawSecret}`,
    file: {
      name: "C:\\Users\\person\\token-fixture.env",
      type: "text/plain",
      size: 42,
      supportedText: true
    },
    sanitizedFile: {
      name: "service.env",
      type: "text/plain",
      size: 24,
      sanitized: true
    },
    input: {
      tag: "INPUT",
      source: "pending-gemini-file-input",
      className: "raw-class-should-not-log",
      accept: ".env",
      filesLength: 1
    },
    event: { type: "drop" },
    dataTransfer: { files: ["raw-file-object"] },
    error: new Error(`full message ${rawSecret}`)
  });

  assert.deepStrictEqual(Object.keys(payload).sort(), [
    "action",
    "bytesProcessed",
    "errorName",
    "file",
    "input",
    "messageLength",
    "sanitizedFile",
    "totalBytes"
  ]);
  assert.strictEqual(payload.errorName, "Error");
  assert.ok(payload.messageLength > 0);
  assert.deepStrictEqual(payload.file, {
    sizeBytes: 42,
    extension: "",
    category: "text",
    mimeCategory: "text",
    supportedText: true,
    sanitized: false
  });
  assert.deepStrictEqual(payload.sanitizedFile, {
    sizeBytes: 24,
    extension: "env",
    category: "env",
    mimeCategory: "text",
    supportedText: false,
    sanitized: true
  });
  const serialized = JSON.stringify(payload);
  assert.strictEqual(serialized.includes(rawSecret), false);
  assert.strictEqual(serialized.includes("rawText"), false);
  assert.strictEqual(serialized.includes("redactedText"), false);
  assert.strictEqual(serialized.includes("token-fixture.env"), false);
  assert.strictEqual(serialized.includes("raw-class-should-not-log"), false);
  assert.strictEqual(serialized.includes("full message"), false);

  helpers.debugFileAttachMetadata("streaming-redaction:progress", {
    bytesProcessed: 12,
    totalBytes: 24,
    file: { name: "/tmp/token-fixture.txt", type: "text/plain", size: 24 }
  });
  assert.deepStrictEqual(debugEvents[0], {
    label: "streaming-redaction:progress",
    details: {
      bytesProcessed: 12,
      totalBytes: 24,
      file: {
        sizeBytes: 24,
        extension: "",
        category: "text",
        mimeCategory: "text",
        supportedText: false,
        sanitized: false
      }
    }
  });
}

function testSanitizedFileHandoffFailureLogsSafeErrorMetadataOnly() {
  const debugEvents = [];
  const consoleErrors = [];
  const helpers = Function(
    "debugReveal",
    "console",
    [
      ...fileAttachDebugMetadataHarnessSource(),
      extractFunctionSource(contentSource, "logSanitizedFileHandoffFailure"),
      "return { logSanitizedFileHandoffFailure };"
    ].join("\n")
  )(
    (label, payload) => debugEvents.push({ label, payload }),
    { error: (...args) => consoleErrors.push(args) }
  );

  const rawSecret = "LeakGuardFailureApiKey1234567890";
  const error = new Error(`failed reading C:\\Users\\person\\token-fixture.env with ${rawSecret}`);
  error.name = "NotAllowedError";
  error.code = "E_SAFE_CODE";
  error.stack = `STACK ${rawSecret}`;

  helpers.logSanitizedFileHandoffFailure(
    {
      stage: "failed",
      strategy: "sanitized-file-handoff",
      context: "drop",
      provider: "gemini",
      hostname: "gemini.google.com",
      failureReason: "sanitized_download_read_failed",
      rawText: `API_KEY=${rawSecret}`,
      redactedText: "API_KEY=[PWM_1]",
      sanitizedPayload: {
        rawText: `API_KEY=${rawSecret}`,
        redactedText: "API_KEY=[PWM_1]"
      },
      errorMessage: error.message,
      errorStack: error.stack,
      sanitizedFile: {
        name: "C:\\Users\\person\\token-fixture.env",
        type: "text/plain",
        size: 99
      }
    },
    error
  );

  assert.deepStrictEqual(consoleErrors, []);
  assert.strictEqual(debugEvents.length, 1);
  assert.strictEqual(debugEvents[0].label, "sanitized-file-handoff:failed");
  assert.deepStrictEqual(debugEvents[0].payload, {
    codeIfSafe: "e_safe_code",
    context: "drop",
    errorName: "notallowederror",
    failureReason: "sanitized_download_read_failed",
    hostname: "gemini.google.com",
    messageLength: error.message.length,
    provider: "gemini",
    sanitizedFile: {
      sizeBytes: 99,
      extension: "",
      category: "text",
      mimeCategory: "text",
      supportedText: false,
      sanitized: false
    },
    stage: "failed",
    strategy: "sanitized-file-handoff"
  });

  const serialized = JSON.stringify(debugEvents);
  assert.strictEqual(serialized.includes(rawSecret), false);
  assert.strictEqual(serialized.includes("token-fixture.env"), false);
  assert.strictEqual(serialized.includes("STACK"), false);
  assert.strictEqual(serialized.includes("rawText"), false);
  assert.strictEqual(serialized.includes("redactedText"), false);
  assert.strictEqual(serialized.includes(error.message), false);
}

async function testSanitizedPayloadFallbackOrderRemainsStable() {
  const order = [];
  const sanitizedFile = {
    name: "fallback-order.env",
    type: "text/plain",
    size: 16,
    async text() {
      order.push("read-sanitized-download-text");
      return "API_KEY=[PWM_1]";
    }
  };
  const adapter = {
    id: "chatgpt",
    pendingAttachEnabled: false
  };
  const flow = globalThis.PWM.createFileHandoffFlow({
    applySanitizedTextFallback: async () => {
      order.push("sanitized-text-fallback");
      return false;
    },
    buildSanitizedDownloadFileName: () => "fallback-order.env",
    createSanitizedDataTransferForHandoff: () => {
      order.push("direct-file-transfer");
      return { files: [sanitizedFile] };
    },
    createSanitizedFileHandoffDetails: () => ({}),
    describeFileForDebug: (file) => ({
      name: file?.name || "",
      type: file?.type || "",
      size: Number(file?.size || 0)
    }),
    formatSanitizedFileFallbackText: (payload) => payload.redactedText,
    getCurrentHandoffDriverId: () => "chatgpt",
    getFileHandoffAdapterForLocation: () => adapter,
    isFileHandoffAdapterPendingAttachEnabled: () => false,
    readSanitizedFileTextForFallback: (file) => file.text(),
    resolveFileInputForHandoff: () => {
      order.push("direct-file-input-lookup");
      return null;
    },
    sendRuntimeMessage: async (message) => {
      order.push("sanitized-download-fallback");
      assert.strictEqual(message.type, "PWM_DOWNLOAD_SANITIZED_FILE");
      assert.strictEqual(message.redactedText, "API_KEY=[PWM_1]");
      return { ok: true, downloadId: 7 };
    }
  });
  const driver = flow.getCurrentHandoffDriver();
  const result = await flow.handoffSanitizedPayload(
    {
      sanitizedFile,
      redactedText: "API_KEY=[PWM_1]",
      rawText: "API_KEY=raw-secret"
    },
    {
      event: { target: { tagName: "DIV" } },
      input: { tagName: "TEXTAREA" },
      context: "drop",
      driver,
      adapter,
      composerResolved: true
    }
  );

  assert.deepStrictEqual(order, [
    "direct-file-transfer",
    "direct-file-input-lookup",
    "sanitized-text-fallback",
    "read-sanitized-download-text",
    "sanitized-download-fallback"
  ]);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.stage, "download");
  assert.strictEqual(result.strategy, "chatgpt-sanitized-download-fallback");
}

async function testFileAttachPipelineDropUsesInjectedHandoffOnly() {
  const order = [];
  const expected = {
    ok: true,
    stage: "download",
    strategy: "chatgpt-sanitized-download-fallback"
  };
  const result = await globalThis.PWM.FileAttachPipeline.runSanitizedPayloadHandoffOrder({
    context: "drop",
    tryDropHandoff: async () => {
      order.push("drop-handoff");
      return expected;
    },
    trySanitizedHandoff: async () => {
      throw new Error("drop path must not use non-drop sanitized handoff callback");
    },
    shouldSkipFallback: () => {
      throw new Error("drop path must not check non-drop fallback gates");
    },
    insertFallbackText: async () => {
      throw new Error("drop path must not insert fallback text directly");
    }
  });

  assert.strictEqual(result, expected);
  assert.deepStrictEqual(order, ["drop-handoff"]);
}

async function testFileAttachPipelineNonDropAttemptsFileBeforeTextFallback() {
  const order = [];
  const result = await globalThis.PWM.FileAttachPipeline.runSanitizedPayloadHandoffOrder({
    context: "file-input",
    tryDropHandoff: async () => {
      throw new Error("non-drop path must not call drop handoff");
    },
    trySanitizedHandoff: async () => {
      order.push("sanitized-file-handoff");
      return false;
    },
    shouldSkipFallback: () => {
      order.push("fallback-gate");
      return false;
    },
    insertFallbackText: async () => {
      order.push("sanitized-text-fallback");
      return true;
    }
  });

  assert.deepStrictEqual(order, [
    "sanitized-file-handoff",
    "fallback-gate",
    "sanitized-text-fallback"
  ]);
  assert.deepStrictEqual(result, {
    ok: true,
    stage: "text",
    strategy: "sanitized-text-fallback"
  });
}

async function testFileAttachPipelineNonDropFileSuccessSkipsFallback() {
  const order = [];
  const result = await globalThis.PWM.FileAttachPipeline.runSanitizedPayloadHandoffOrder({
    context: "paste",
    trySanitizedHandoff: async () => {
      order.push("sanitized-file-handoff");
      return true;
    },
    shouldSkipFallback: () => {
      throw new Error("successful file handoff must not check fallback gates");
    },
    insertFallbackText: async () => {
      throw new Error("successful file handoff must not insert fallback text");
    },
    fileStrategy: "custom-file-strategy"
  });

  assert.deepStrictEqual(order, ["sanitized-file-handoff"]);
  assert.deepStrictEqual(result, {
    ok: true,
    stage: "file",
    strategy: "custom-file-strategy"
  });
}

async function testFileAttachPipelineSkipFallbackBranchPreservesReason() {
  const order = [];
  const result = await globalThis.PWM.FileAttachPipeline.runSanitizedPayloadHandoffOrder({
    context: "file-input",
    trySanitizedHandoff: async () => {
      order.push("sanitized-file-handoff");
      return false;
    },
    shouldSkipFallback: () => {
      order.push("fallback-gate");
      return true;
    },
    skipFallbackReason: "firefox_gemini_file_input_replacement_failed",
    insertFallbackText: async () => {
      throw new Error("skip fallback branch must not insert text");
    }
  });

  assert.deepStrictEqual(order, ["sanitized-file-handoff", "fallback-gate"]);
  assert.deepStrictEqual(result, {
    ok: false,
    stage: "failed",
    reason: "firefox_gemini_file_input_replacement_failed"
  });
}

async function testFileAttachPipelineCancelledFallbackPreservesReason() {
  const result = await globalThis.PWM.FileAttachPipeline.runSanitizedPayloadHandoffOrder({
    context: "file-input",
    trySanitizedHandoff: async () => false,
    insertFallbackText: async () => "cancelled"
  });

  assert.deepStrictEqual(result, {
    ok: false,
    stage: "failed",
    reason: "sanitized_text_cancelled"
  });
}

function testFileAttachPipelineClassifiesPostHandoffSuccessStages() {
  const fileResult = {
    ok: true,
    stage: "file",
    strategy: "chatgpt-sanitized-file-handoff"
  };
  const fileClassification = globalThis.PWM.FileAttachPipeline.classifyPostHandoffResult({
    handoffResult: fileResult,
    context: "drop"
  });
  assert.deepStrictEqual(fileClassification, {
    handled: true,
    ok: true,
    stage: "file",
    reason: "",
    handoffReason: "",
    strategy: "chatgpt-sanitized-file-handoff",
    shouldShowSuccess: true,
    shouldHideProcessing: false,
    hideProcessingReason: "",
    shouldFailProcessing: false,
    shouldContinueFallback: false,
    shouldShowAttachedBadge: true,
    successStatus: "Sanitized file attached.",
    successReason: "attached",
    handoffResult: fileResult
  });

  const textResult = {
    ok: true,
    stage: "text"
  };
  const textClassification = globalThis.PWM.FileAttachPipeline.classifyPostHandoffResult({
    handoffResult: textResult,
    context: "file-input",
    defaultSuccessStrategy: "sanitized-file-handoff"
  });
  assert.deepStrictEqual(textClassification, {
    handled: true,
    ok: true,
    stage: "text",
    reason: "",
    handoffReason: "",
    strategy: "sanitized-file-handoff",
    shouldShowSuccess: true,
    shouldHideProcessing: false,
    hideProcessingReason: "",
    shouldFailProcessing: false,
    shouldContinueFallback: false,
    shouldShowAttachedBadge: true,
    successStatus: "Sanitized content inserted.",
    successReason: "inserted",
    handoffResult: textResult
  });

  const downloadResult = {
    ok: true,
    stage: "download",
    strategy: "chatgpt-sanitized-download-fallback"
  };
  const downloadClassification = globalThis.PWM.FileAttachPipeline.classifyPostHandoffResult({
    handoffResult: downloadResult,
    context: "drop"
  });
  assert.strictEqual(downloadClassification.shouldShowSuccess, true);
  assert.strictEqual(downloadClassification.shouldShowAttachedBadge, false);
  assert.strictEqual(downloadClassification.successStatus, "Sanitized file ready.");
  assert.strictEqual(downloadClassification.successReason, "download");

  const pendingResult = {
    ok: true,
    stage: "pending",
    strategy: "gemini-pending-sanitized-file-handoff"
  };
  const pendingClassification = globalThis.PWM.FileAttachPipeline.classifyPostHandoffResult({
    handoffResult: pendingResult,
    context: "drop"
  });
  assert.strictEqual(pendingClassification.shouldShowSuccess, false);
  assert.strictEqual(pendingClassification.shouldHideProcessing, true);
  assert.strictEqual(pendingClassification.hideProcessingReason, "pending");
  assert.strictEqual(pendingClassification.shouldShowAttachedBadge, false);
  assert.strictEqual(pendingClassification.successStatus, "");
  assert.strictEqual(pendingClassification.successReason, "");
}

function testFileAttachPipelineBuildsPureAttachDisposition() {
  const fileClassification = globalThis.PWM.FileAttachPipeline.classifyPostHandoffResult({
    handoffResult: {
      ok: true,
      stage: "file",
      strategy: "chatgpt-sanitized-file-handoff"
    },
    context: "drop"
  });
  const fileDisposition = globalThis.PWM.FileAttachPipeline.classifyFileAttachDisposition({
    handoffClassification: fileClassification,
    context: "drop",
    usesDmzOverlay: true
  });

  assert.deepStrictEqual(fileDisposition, {
    status: "attached",
    reason: "attached",
    badgeMode: "attached",
    shouldSetDmzAttached: true,
    dmzStatus: "Attached sanitized file",
    dmzMode: "attached",
    shouldScheduleDmzCleanup: true,
    dmzCleanupDelay: 1400,
    shouldHideProcessing: false,
    hideProcessingReason: "",
    shouldShowSuccess: true,
    shouldShowOptimizedStatus: false,
    shouldFailProcessing: false,
    successStatus: "Sanitized file attached.",
    successReason: "attached",
    shouldShowAttachedBadge: true,
    attachedBadgeMessage: "LeakGuard attached a sanitized local file.",
    attachedBadgeHideDelay: 3200
  });

  const textClassification = globalThis.PWM.FileAttachPipeline.classifyPostHandoffResult({
    handoffResult: {
      ok: true,
      stage: "text"
    },
    context: "drop"
  });
  const textDisposition = globalThis.PWM.FileAttachPipeline.classifyFileAttachDisposition({
    handoffClassification: textClassification,
    context: "drop",
    usesDmzOverlay: true
  });

  assert.strictEqual(textDisposition.shouldSetDmzAttached, false);
  assert.strictEqual(textDisposition.shouldScheduleDmzCleanup, true);
  assert.strictEqual(textDisposition.dmzCleanupDelay, 1800);
  assert.strictEqual(textDisposition.badgeMode, "none");
  assert.strictEqual(textDisposition.successStatus, "Sanitized content inserted.");
  assert.strictEqual(textDisposition.successReason, "inserted");

  const badgeOnlyDisposition = globalThis.PWM.FileAttachPipeline.classifyFileAttachDisposition({
    handoffClassification: {
      ok: true,
      stage: "file",
      shouldShowAttachedBadge: true,
      shouldShowSuccess: true,
      successStatus: "Sanitized file attached.",
      successReason: "attached"
    },
    context: "file-input",
    usesDmzOverlay: false
  });
  assert.strictEqual(badgeOnlyDisposition.shouldSetDmzAttached, false);
  assert.strictEqual(badgeOnlyDisposition.shouldScheduleDmzCleanup, false);
  assert.strictEqual(badgeOnlyDisposition.badgeMode, "attached");
  assert.strictEqual(badgeOnlyDisposition.shouldShowAttachedBadge, true);
  assert.strictEqual(badgeOnlyDisposition.attachedBadgeMessage, "LeakGuard attached a sanitized local file.");
  assert.strictEqual(badgeOnlyDisposition.attachedBadgeHideDelay, 3200);

  const pendingClassification = globalThis.PWM.FileAttachPipeline.classifyPostHandoffResult({
    handoffResult: {
      ok: true,
      stage: "pending",
      strategy: "gemini-pending-sanitized-file-handoff"
    },
    context: "drop"
  });
  const pendingDisposition = globalThis.PWM.FileAttachPipeline.classifyFileAttachDisposition({
    handoffClassification: pendingClassification,
    context: "drop",
    usesDmzOverlay: true
  });

  assert.strictEqual(pendingDisposition.shouldHideProcessing, true);
  assert.strictEqual(pendingDisposition.hideProcessingReason, "pending");
  assert.strictEqual(pendingDisposition.shouldShowSuccess, false);
  assert.strictEqual(pendingDisposition.badgeMode, "none");

  const failureDisposition = globalThis.PWM.FileAttachPipeline.classifyFileAttachDisposition({
    handoffClassification: {
      ok: false,
      stage: "failed",
      reason: "sanitized_file_handoff_failed",
      shouldFailProcessing: true,
      shouldShowSuccess: false
    },
    context: "drop",
    usesDmzOverlay: true
  });
  assert.strictEqual(failureDisposition.status, "blocked");
  assert.strictEqual(failureDisposition.reason, "sanitized_file_handoff_failed");
  assert.strictEqual(failureDisposition.shouldFailProcessing, true);
  assert.strictEqual(failureDisposition.shouldSetDmzAttached, false);
  assert.strictEqual(failureDisposition.shouldScheduleDmzCleanup, false);
}

function testFileAttachPipelineForcedStreamingDispositionPreservesLegacyUiPlan() {
  const streamingClassification = globalThis.PWM.FileAttachPipeline.classifyPostHandoffResult({
    handoffResult: {
      ok: true,
      stage: "download",
      strategy: "streaming-sanitized-download-fallback"
    },
    context: "drop",
    defaultSuccessStrategy: "streaming-sanitized-file-handoff"
  });
  const disposition = globalThis.PWM.FileAttachPipeline.classifyFileAttachDisposition({
    handoffClassification: streamingClassification,
    context: "drop",
    forceDmzAttached: true,
    forceAttachedBadge: true
  });

  assert.strictEqual(disposition.shouldSetDmzAttached, true);
  assert.strictEqual(disposition.dmzStatus, "Attached sanitized file");
  assert.strictEqual(disposition.dmzMode, "attached");
  assert.strictEqual(disposition.shouldScheduleDmzCleanup, false);
  assert.strictEqual(disposition.badgeMode, "attached");
  assert.strictEqual(disposition.attachedBadgeMessage, "LeakGuard attached a sanitized local file.");
  assert.strictEqual(disposition.attachedBadgeHideDelay, 3200);
  assert.strictEqual(disposition.successStatus, "Sanitized file ready.");
  assert.strictEqual(disposition.successReason, "download");
}

function testFileAttachPipelineClassifiesPostHandoffFailures() {
  const failedResult = {
    ok: false,
    stage: "failed",
    reason: "unsafe_sanitized_payload",
    message: "raw failure message"
  };
  const failedClassification = globalThis.PWM.FileAttachPipeline.classifyPostHandoffResult({
    handoffResult: failedResult,
    context: "drop",
    allowPendingFallback: true,
    failureReason: "sanitized_file_handoff_failed"
  });
  assert.deepStrictEqual(failedClassification, {
    handled: true,
    ok: false,
    stage: "failed",
    reason: "sanitized_file_handoff_failed",
    handoffReason: "unsafe_sanitized_payload",
    strategy: "",
    shouldShowSuccess: false,
    shouldHideProcessing: false,
    hideProcessingReason: "",
    shouldFailProcessing: true,
    shouldContinueFallback: true,
    shouldShowAttachedBadge: false,
    successStatus: "",
    successReason: "",
    handoffResult: failedResult
  });

  const cancelledResult = {
    ok: false,
    stage: "text",
    reason: "sanitized_text_cancelled"
  };
  const cancelledClassification = globalThis.PWM.FileAttachPipeline.classifyPostHandoffResult({
    handoffResult: cancelledResult,
    context: "file-input",
    allowPendingFallback: true
  });
  assert.strictEqual(cancelledClassification.reason, "sanitized_text_cancelled");
  assert.strictEqual(cancelledClassification.shouldHideProcessing, true);
  assert.strictEqual(cancelledClassification.hideProcessingReason, "cancelled");
  assert.strictEqual(cancelledClassification.shouldFailProcessing, false);
  assert.strictEqual(cancelledClassification.shouldContinueFallback, false);

  const streamingCancelledClassification = globalThis.PWM.FileAttachPipeline.classifyPostHandoffResult({
    handoffResult: cancelledResult,
    context: "file-input",
    failureReason: "streaming_sanitized_handoff_failed",
    treatCancellation: false
  });
  assert.strictEqual(streamingCancelledClassification.reason, "streaming_sanitized_handoff_failed");
  assert.strictEqual(streamingCancelledClassification.shouldHideProcessing, false);
  assert.strictEqual(streamingCancelledClassification.shouldFailProcessing, true);
}

function testFileAttachPipelineClassifiesPendingAttachFallbackDecision() {
  const retryableFailure = globalThis.PWM.FileAttachPipeline.classifyPostHandoffResult({
    handoffResult: {
      ok: false,
      stage: "failed",
      reason: "sanitized_payload_handoff_failed"
    },
    context: "drop",
    allowPendingFallback: true,
    failureReason: "sanitized_file_handoff_failed"
  });
  assert.strictEqual(
    retryableFailure.shouldContinueFallback,
    true,
    "fallback should be allowed for retryable drop handoff failures"
  );
  assert.deepStrictEqual(
    globalThis.PWM.FileAttachPipeline.classifyPendingAttachFallbackDecision({
      handoffClassification: retryableFailure,
      pendingAttachEnabled: true,
      adapterId: "gemini"
    }),
    {
      shouldAttemptPendingFallback: true,
      strategy: "gemini-pending-sanitized-file-handoff",
      reason: "sanitized_file_handoff_failed"
    }
  );

  const blockedByClassification = {
    ...retryableFailure,
    shouldContinueFallback: false
  };
  assert.deepStrictEqual(
    globalThis.PWM.FileAttachPipeline.classifyPendingAttachFallbackDecision({
      handoffClassification: blockedByClassification,
      pendingAttachEnabled: true,
      adapterId: "gemini"
    }),
    {
      shouldAttemptPendingFallback: false,
      strategy: "",
      reason: "sanitized_file_handoff_failed"
    },
    "pending attach should be blocked when the handoff classification disallows fallback"
  );

  assert.deepStrictEqual(
    globalThis.PWM.FileAttachPipeline.classifyPendingAttachFallbackDecision({
      handoffClassification: retryableFailure,
      pendingAttachEnabled: false,
      adapterId: "gemini"
    }),
    {
      shouldAttemptPendingFallback: false,
      strategy: "",
      reason: "sanitized_file_handoff_failed"
    }
  );

  const fallbackSkipped = globalThis.PWM.FileAttachPipeline.classifyPostHandoffResult({
    handoffResult: {
      ok: false,
      stage: "failed",
      reason: "firefox_gemini_file_input_replacement_failed"
    },
    context: "file-input",
    allowPendingFallback: true,
    failureReason: "firefox_gemini_file_input_replacement_failed"
  });
  assert.strictEqual(
    fallbackSkipped.shouldContinueFallback,
    true,
    "fallback-skipped non-cancellation failures may still be eligible for a caller-owned pending decision"
  );
  assert.deepStrictEqual(
    globalThis.PWM.FileAttachPipeline.classifyPendingAttachFallbackDecision({
      handoffClassification: fallbackSkipped,
      pendingAttachEnabled: false,
      adapterId: "gemini"
    }),
    {
      shouldAttemptPendingFallback: false,
      strategy: "",
      reason: "firefox_gemini_file_input_replacement_failed"
    },
    "pending attach remains skipped when the content-script gate leaves pending attach disabled"
  );

  const cancelledFailure = globalThis.PWM.FileAttachPipeline.classifyPostHandoffResult({
    handoffResult: {
      ok: false,
      stage: "failed",
      reason: "sanitized_text_cancelled"
    },
    context: "drop",
    allowPendingFallback: true
  });
  assert.strictEqual(
    cancelledFailure.shouldContinueFallback,
    false,
    "cancelled sanitized text fallback should skip later pending fallback"
  );
  assert.deepStrictEqual(
    globalThis.PWM.FileAttachPipeline.classifyPendingAttachFallbackDecision({
      handoffClassification: cancelledFailure,
      pendingAttachEnabled: true,
      adapterId: "gemini"
    }),
    {
      shouldAttemptPendingFallback: false,
      strategy: "",
      reason: "sanitized_text_cancelled"
    }
  );
}

function testFileAttachPipelinePreflightPlanNormalSanitizedAttachStatus() {
  const plan = globalThis.PWM.FileAttachPipeline.classifyFileAttachPreflightPlan({
    context: "drop",
    sizeZone: "normal",
    usesDmzOverlay: true,
    allowPendingFallback: true
  });

  assert.deepStrictEqual(plan.sanitizationStatus, {
    shouldSetDmzRedacting: true,
    dmzStatus: "Redacting...",
    dmzMode: "redacting",
    processingStatus: "Sanitizing file locally...",
    processingProgress: "",
    processingBlocking: true
  });
  assert.deepStrictEqual(plan.handoffStatus, {
    shouldSetDmzReady: true,
    dmzStatus: "Sanitized file ready",
    dmzMode: "ready",
    processingStatus: "Preparing sanitized upload...",
    processingProgress: "Complete",
    processingBlocking: true
  });
  assert.deepStrictEqual(plan.attachFlowOptions, {
    allowPendingFallback: true,
    defaultSuccessStrategy: "sanitized-file-handoff",
    failureReason: "sanitized_file_handoff_failed",
    skipFallbackReason: "",
    fileStrategy: "sanitized-file-handoff",
    textStrategy: "sanitized-text-fallback"
  });
  assert.strictEqual(plan.shouldContinueSanitizedFlow, true);
  assert.strictEqual(plan.optimizedStatus.shouldShow, false);
}

function testFileAttachPipelinePreflightPlanSkipFallbackStatus() {
  const plan = globalThis.PWM.FileAttachPipeline.classifyFileAttachPreflightPlan({
    context: "file-input",
    sizeZone: "normal",
    usesDmzOverlay: true,
    skipTextFallback: true,
    allowPendingFallback: false
  });

  assert.strictEqual(plan.sanitizationStatus.shouldSetDmzRedacting, false);
  assert.strictEqual(plan.handoffStatus.shouldSetDmzReady, false);
  assert.deepStrictEqual(plan.attachFlowOptions, {
    allowPendingFallback: false,
    defaultSuccessStrategy: "sanitized-file-handoff",
    failureReason: "sanitized_file_handoff_failed",
    skipFallbackReason: "firefox_gemini_file_input_replacement_failed",
    fileStrategy: "sanitized-file-handoff",
    textStrategy: "sanitized-text-fallback"
  });
}

function testFileAttachPipelinePreflightPlanCleanupLabelsRemainStable() {
  const optimizedPlan = globalThis.PWM.FileAttachPipeline.classifyFileAttachPreflightPlan({
    context: "drop",
    sizeZone: "optimized"
  });
  const blockedPlan = globalThis.PWM.FileAttachPipeline.classifyFileAttachPreflightPlan({
    context: "drop",
    sizeZone: "blocked"
  });

  assert.deepStrictEqual(optimizedPlan.optimizedStatus, {
    shouldShow: true,
    cleanupOnSanitizationFailure: "failed",
    cleanupOnAttachFailure: "failed",
    cleanupOnAttachCancellation: "cancelled",
    cleanupOnAttachSuccess: "complete"
  });
  assert.strictEqual(blockedPlan.shouldContinueSanitizedFlow, false);
  assert.strictEqual(blockedPlan.optimizedStatus.shouldShow, false);
}

function testFileAttachPipelinePreflightPlanReturnsPlainDataOnly() {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const originalBrowser = Object.getOwnPropertyDescriptor(globalThis, "browser");
  const originalChrome = Object.getOwnPropertyDescriptor(globalThis, "chrome");
  const originalPwmKeys = Object.keys(globalThis.PWM).sort();

  try {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      get() {
        throw new Error("preflight plan must not access document");
      }
    });
    Object.defineProperty(globalThis, "browser", {
      configurable: true,
      get() {
        throw new Error("preflight plan must not access browser");
      }
    });
    Object.defineProperty(globalThis, "chrome", {
      configurable: true,
      get() {
        throw new Error("preflight plan must not access chrome");
      }
    });

    const plan = globalThis.PWM.FileAttachPipeline.classifyFileAttachPreflightPlan({
      context: "drop",
      sizeZone: "optimized",
      usesDmzOverlay: true,
      skipTextFallback: true,
      allowPendingFallback: true
    });
    const serialized = JSON.stringify(plan);

    assert.deepStrictEqual(JSON.parse(serialized), plan);
    assert.strictEqual(serialized.includes("function"), false);
    assert.deepStrictEqual(Object.keys(globalThis.PWM).sort(), originalPwmKeys);
  } finally {
    if (originalDocument) {
      Object.defineProperty(globalThis, "document", originalDocument);
    } else {
      delete globalThis.document;
    }
    if (originalBrowser) {
      Object.defineProperty(globalThis, "browser", originalBrowser);
    } else {
      delete globalThis.browser;
    }
    if (originalChrome) {
      Object.defineProperty(globalThis, "chrome", originalChrome);
    } else {
      delete globalThis.chrome;
    }
  }
}

async function testFileAttachPipelineOrchestratorPreservesCallbackOrder() {
  const order = [];
  const result = await globalThis.PWM.FileAttachPipeline.runSanitizedFileAttachFlow({
    context: "file-input",
    tryDropHandoff: async () => {
      throw new Error("non-drop orchestrator path must not call drop handoff");
    },
    trySanitizedHandoff: async () => {
      order.push("sanitized-file-handoff");
      return false;
    },
    shouldSkipFallback: () => {
      order.push("fallback-gate");
      return false;
    },
    insertFallbackText: async () => {
      order.push("sanitized-text-fallback");
      return true;
    },
    getPendingAttachFallbackOptions: () => {
      throw new Error("successful text fallback must not ask for pending attach options");
    }
  });

  assert.deepStrictEqual(order, [
    "sanitized-file-handoff",
    "fallback-gate",
    "sanitized-text-fallback"
  ]);
  assert.strictEqual(result.action, "success");
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.strategy, "sanitized-text-fallback");
  assert.strictEqual(result.handoffClassification.stage, "text");
  assert.strictEqual(result.disposition.successStatus, "Sanitized content inserted.");
}

async function testFileAttachPipelineOrchestratorClassifiesSuccessDisposition() {
  const result = await globalThis.PWM.FileAttachPipeline.runSanitizedFileAttachFlow({
    context: "drop",
    usesDmzOverlay: true,
    tryDropHandoff: async () => ({
      ok: true,
      stage: "file",
      strategy: "chatgpt-sanitized-file-handoff"
    }),
    getPendingAttachFallbackOptions: () => {
      throw new Error("successful file attach must not ask for pending attach options");
    }
  });

  assert.strictEqual(result.action, "success");
  assert.strictEqual(result.handled, true);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.strategy, "chatgpt-sanitized-file-handoff");
  assert.strictEqual(result.disposition.shouldSetDmzAttached, true);
  assert.strictEqual(result.disposition.shouldScheduleDmzCleanup, true);
  assert.strictEqual(result.disposition.shouldShowAttachedBadge, true);
}

async function testFileAttachPipelineOrchestratorClassifiesPendingEligiblePath() {
  const order = [];
  let pendingQueueMutated = false;
  const result = await globalThis.PWM.FileAttachPipeline.runSanitizedFileAttachFlow({
    context: "drop",
    allowPendingFallback: true,
    tryDropHandoff: async () => {
      order.push("drop-handoff");
      return {
        ok: false,
        stage: "failed",
        reason: "sanitized_payload_handoff_failed"
      };
    },
    getPendingAttachFallbackOptions: (handoffClassification) => {
      order.push("pending-options");
      assert.strictEqual(handoffClassification.shouldContinueFallback, true);
      return {
        pendingAttachEnabled: true,
        adapterId: "gemini",
        pendingAdapter: { id: "gemini" },
        mutatePendingQueue: () => {
          pendingQueueMutated = true;
        }
      };
    }
  });

  assert.deepStrictEqual(order, ["drop-handoff", "pending-options"]);
  assert.strictEqual(pendingQueueMutated, false);
  assert.strictEqual(result.action, "pending");
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.strategy, "gemini-pending-sanitized-file-handoff");
  assert.strictEqual(result.pendingAttachOptions.pendingAdapter.id, "gemini");
  assert.strictEqual(result.pendingFallbackDecision.shouldAttemptPendingFallback, true);
}

async function testFileAttachPipelineOrchestratorClassifiesFailClosedPath() {
  const result = await globalThis.PWM.FileAttachPipeline.runSanitizedFileAttachFlow({
    context: "drop",
    allowPendingFallback: true,
    tryDropHandoff: async () => ({
      ok: false,
      stage: "failed",
      reason: "sanitized_payload_handoff_failed",
      message: "handoff rejected"
    }),
    getPendingAttachFallbackOptions: () => ({
      pendingAttachEnabled: false,
      adapterId: "chatgpt"
    })
  });

  assert.strictEqual(result.action, "fail-closed");
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, "sanitized_file_handoff_failed");
  assert.strictEqual(result.pendingFallbackDecision.shouldAttemptPendingFallback, false);
  assert.strictEqual(result.handoffResult.message, "handoff rejected");
  assert.strictEqual(result.handoffClassification.shouldFailProcessing, true);
}

async function testFileAttachPipelineOrchestratorPreservesCancellationPath() {
  const result = await globalThis.PWM.FileAttachPipeline.runSanitizedFileAttachFlow({
    context: "file-input",
    allowPendingFallback: true,
    trySanitizedHandoff: async () => false,
    insertFallbackText: async () => "cancelled",
    getPendingAttachFallbackOptions: () => {
      throw new Error("cancelled sanitized text fallback must not ask for pending attach options");
    }
  });

  assert.strictEqual(result.action, "cancelled");
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, "sanitized_text_cancelled");
  assert.strictEqual(result.handoffClassification.shouldHideProcessing, true);
  assert.strictEqual(result.handoffClassification.shouldFailProcessing, false);
}

async function testFileAttachPipelineOrchestratorDoesNotTouchDomBrowserGlobalsOrPendingQueues() {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const originalBrowser = Object.getOwnPropertyDescriptor(globalThis, "browser");
  const originalChrome = Object.getOwnPropertyDescriptor(globalThis, "chrome");
  const originalPwmKeys = Object.keys(globalThis.PWM).sort();
  let pendingQueueMutated = false;

  try {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      get() {
        throw new Error("orchestrator must not access document");
      }
    });
    Object.defineProperty(globalThis, "browser", {
      configurable: true,
      get() {
        throw new Error("orchestrator must not access browser");
      }
    });
    Object.defineProperty(globalThis, "chrome", {
      configurable: true,
      get() {
        throw new Error("orchestrator must not access chrome");
      }
    });

    const result = await globalThis.PWM.FileAttachPipeline.runSanitizedFileAttachFlow({
      context: "drop",
      allowPendingFallback: true,
      tryDropHandoff: async () => ({
        ok: false,
        stage: "failed",
        reason: "sanitized_payload_handoff_failed"
      }),
      getPendingAttachFallbackOptions: () => ({
        pendingAttachEnabled: true,
        adapterId: "grok",
        mutatePendingQueue: () => {
          pendingQueueMutated = true;
        }
      })
    });

    assert.strictEqual(result.action, "pending");
    assert.strictEqual(pendingQueueMutated, false);
    assert.deepStrictEqual(Object.keys(globalThis.PWM).sort(), originalPwmKeys);
  } finally {
    if (originalDocument) {
      Object.defineProperty(globalThis, "document", originalDocument);
    } else {
      delete globalThis.document;
    }
    if (originalBrowser) {
      Object.defineProperty(globalThis, "browser", originalBrowser);
    } else {
      delete globalThis.browser;
    }
    if (originalChrome) {
      Object.defineProperty(globalThis, "chrome", originalChrome);
    } else {
      delete globalThis.chrome;
    }
  }
}

function testFileAttachPipelineProcessingStageControlsDelegateExactly() {
  const calls = [];
  const controls = globalThis.PWM.FileAttachPipeline.createProcessingStageControls({
    site: "gemini",
    showFileProcessingError: (status, options) => {
      calls.push(["error", status, options]);
    },
    hideFileProcessingOverlay: (reason) => {
      calls.push(["hide", reason]);
    },
    showFileProcessingSuccess: (status, options) => {
      calls.push(["success", status, options]);
    }
  });

  controls.failProcessing("scan_failed");
  controls.hideProcessing("sanitized");
  controls.showProcessingSuccess("Sanitized file attached.");

  assert.deepStrictEqual(calls, [
    ["error", "Raw file upload blocked", { site: "gemini", reason: "scan_failed" }],
    ["hide", "scan_failed"],
    ["hide", "sanitized"],
    ["success", "Sanitized file attached.", { site: "gemini", reason: "success" }]
  ]);
}

function testGenericFileHandoffHelpersAndDiagnosticsExist() {
  const contentBundleSource = `${contentSource}\n${fileProcessingUiSource}\n${fileHandoffStateSource}\n${fileHandoffPendingSource}\n${fileHandoffFlowSource}`;
  for (const functionName of [
    "getFileHandoffAdapterForLocation",
    "showFileProcessingOverlay",
    "updateFileProcessingOverlay",
    "hideFileProcessingOverlay",
    "queuePendingSanitizedFileHandoff",
    "attemptPendingSanitizedFileHandoff",
    "clearPendingSanitizedFileHandoff",
    "showPendingSanitizedAttachPrompt",
    "attachPendingSanitizedFileWithTrustedActivation",
    "markSanitizedFileHandoff",
    "shouldSuppressSanitizedFileReprocessing"
  ]) {
    assert.ok(contentBundleSource.includes(`function ${functionName}`), `expected ${functionName}`);
  }
  for (const label of [
    "file-handoff:adapter-selected",
    "file-handoff:direct-attempt-start",
    "file-handoff:direct-attempt-success",
    "file-handoff:direct-attempt-failed",
    "file-handoff:pending-queued",
    "file-handoff:pending-prompt-shown",
    "file-handoff:pending-user-attach-clicked",
    "file-handoff:pending-site-upload-click-observed",
    "file-handoff:pending-input-captured",
    "file-handoff:pending-assigned",
    "file-handoff:pending-cleared",
    "file-ui:processing-shown",
    "file-ui:processing-updated",
    "file-ui:processing-hidden",
    "file-ui:pending-prompt-shown",
    "file-ui:pending-prompt-cleared",
    "file-ui:success-shown",
    "file-ui:error-shown"
  ]) {
    assert.ok(contentBundleSource.includes(label), `expected debug label ${label}`);
  }
}

function testFileProcessingOverlayCssExists() {
  for (const className of [
    "pwm-file-processing-overlay",
    "pwm-file-processing-card",
    "pwm-file-processing-title",
    "pwm-file-processing-status",
    "pwm-file-processing-progress",
    "pwm-pending-attach-prompt",
    "pwm-pending-attach-card"
  ]) {
    assert.ok(overlayCssSource.includes(`.${className}`), `expected ${className} CSS`);
    assert.ok(fileProcessingUiSource.includes(className), `expected ${className} content usage`);
  }
  const overlayRule = /\.pwm-file-processing-overlay\s*\{[^}]+\}/.exec(overlayCssSource)?.[0] || "";
  assert.ok(overlayRule.includes("position: fixed"));
  assert.ok(overlayRule.includes("inset: 0"));
  assert.ok(overlayRule.includes("pointer-events: auto"));
  assert.ok(
    /\.pwm-file-processing-overlay\[data-pwm-blocking="false"\]\s*\{[^}]+pointer-events:\s*none;/.test(
      overlayCssSource
    ),
    "non-blocking processing success state should let page clicks pass through"
  );
}

function testPendingAttachPromptCssIsNonBlocking() {
  const promptRule = /\.pwm-pending-attach-prompt\s*\{[^}]+\}/.exec(overlayCssSource)?.[0] || "";
  const cardRule = /\.pwm-pending-attach-card\s*\{[^}]+\}/.exec(overlayCssSource)?.[0] || "";
  assert.ok(promptRule.includes("position: fixed"));
  assert.ok(promptRule.includes("pointer-events: none"));
  assert.ok(!/inset\s*:\s*0/.test(promptRule), "pending attach prompt must not be fullscreen");
  assert.ok(/(?:right|left|top|bottom)\s*:/.test(promptRule), "pending prompt should be edge-positioned");
  assert.ok(cardRule.includes("pointer-events: auto"));
}

function testBuiltInAdaptersEnablePendingAttachRecovery() {
  const adapters = createAdapterRegistryForTest();
  for (const id of ["chatgpt", "claude", "openai", "x"]) {
    assert.strictEqual(adapters[id].supportsPendingAttach, true, `${id} should keep its adapter capability shape`);
    assert.strictEqual(adapters[id].pendingAttachEnabled, true, `${id} pending attach should stay enabled`);
  }
  assert.strictEqual(adapters.whatsapp.supportsSanitizedImageAttachHandoff, true, "WhatsApp should expose only sanitized image attach handoff");
  assert.strictEqual(adapters.whatsapp.supportsSanitizedDocxAttachHandoff, true, "WhatsApp should expose only sanitized DOCX attach handoff");
  assert.strictEqual(adapters.whatsapp.supportsSanitizedXlsxAttachHandoff, true, "WhatsApp should expose only sanitized XLSX attach handoff");
  assert.strictEqual(adapters.whatsapp.supportsSanitizedDropHandoff, true, "WhatsApp should expose narrow sanitized drag/drop handoff");
  assert.strictEqual(adapters.whatsapp.supportsDirectFileInputAssignment, false, "WhatsApp must not enable generic raw/direct file assignment");
  assert.strictEqual(adapters.whatsapp.supportsMultiFileHandoff, false, "WhatsApp must not enable generic multi-file handoff");
  assert.strictEqual(adapters.whatsapp.supportsDirectDropReplay, false, "WhatsApp must not enable raw direct drop replay");
  assert.strictEqual(adapters.whatsapp.supportsPendingAttach, false, "WhatsApp should not recover pending file attach");
  assert.strictEqual(adapters.whatsapp.pendingAttachEnabled, false, "WhatsApp narrow adapter should keep pending attach disabled");
  assert.ok(
    contentSource.includes("if (id === \"chatgpt\" || id === \"claude\" || id === \"openai\" || id === \"x\" || id === \"generic\")"),
    "existing direct file-input path should stay available for ChatGPT/Claude/OpenAI/X"
  );
}

async function testSanitizedFileInputRedispatchDoesNotRescanSanitizedFile() {
  const sanitizedFile = {
    name: "already-sanitized.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  const fileInput = createFileInput();
  const { maybeHandleFileInputChange, handOffSanitizedFileInput, calls } = createHarness({
    findComposer: () => {
      throw new Error("sanitized redispatch must not reach composer discovery");
    },
    readLocalTextFileFromDataTransfer: () => {
      throw new Error("sanitized redispatch must not be scanned again");
    }
  });

  const assigned = handOffSanitizedFileInput(fileInput, { files: [sanitizedFile] }, { dispatchInput: true });
  const { event } = createEvent({
    type: "change",
    target: fileInput,
    dataTransfer: null
  });

  await maybeHandleFileInputChange(event);

  assert.strictEqual(assigned, true);
  assert.strictEqual(calls.reads.length, 0);
  assert.strictEqual(calls.redactions.length, 0);
  assert.strictEqual(calls.handoffs.length, 0);
  assert.ok(
    calls.debugEvents.some((entry) => entry.label === "file-input:sanitized-handoff-suppressed"),
    "expected sanitized file-input redispatch to be suppressed"
  );
}

async function testSanitizedHandoffSignatureSuppressesDifferentInputRedispatch() {
  const sanitizedFile = {
    name: "same-signature.env",
    type: "text/plain",
    size: 18,
    lastModified: 121,
    text: "API_KEY=[PWM_1]"
  };
  const sameSignatureFile = {
    name: sanitizedFile.name,
    type: sanitizedFile.type,
    size: sanitizedFile.size,
    lastModified: sanitizedFile.lastModified,
    text: sanitizedFile.text
  };
  const sourceInput = createFileInput();
  const redispatchInput = createFileInput();
  redispatchInput.files = [sameSignatureFile];
  const { maybeHandleFileInputChange, handOffSanitizedFileInput, calls } = createHarness({
    readLocalTextFileFromDataTransfer: () => {
      throw new Error("same-signature sanitized redispatch must not be scanned again");
    },
    findComposer: () => {
      throw new Error("same-signature sanitized redispatch must not reach composer discovery");
    }
  });

  assert.strictEqual(handOffSanitizedFileInput(sourceInput, { files: [sanitizedFile] }, { dispatchInput: true }), true);
  const result = await maybeHandleFileInputChange(createEvent({ type: "change", target: redispatchInput }).event);

  assert.strictEqual(result?.ok, true);
  assert.strictEqual(result?.strategy, "sanitized-file-handoff-suppressed");
  assert.strictEqual(calls.reads.length, 0);
  assert.strictEqual(calls.redactions.length, 0);
  assert.strictEqual(calls.handoffs.length, 0);
  assert.ok(
    calls.debugEvents.some((entry) => entry.label === "file-input:sanitized-handoff-signature-match"),
    "expected sanitized redispatch to be suppressed by file metadata signature"
  );
  assert.ok(calls.debugEvents.some((entry) => entry.label === "file-input:sanitized-handoff-suppressed"));
  assert.strictEqual(JSON.stringify(calls.debugEvents).includes("API_KEY"), false);
  assert.strictEqual(JSON.stringify(calls.debugEvents).includes("[PWM_1]"), false);
}

async function testSanitizedHandoffMixedRawFileDoesNotSuppressScan() {
  const rawSecret = "LeakGuardFileApiKey1234567890";
  const sanitizedFile = {
    name: "mixed-sanitized.env",
    type: "text/plain",
    size: 18,
    lastModified: 212,
    text: "API_KEY=[PWM_1]"
  };
  const rawFile = createTextFile({
    name: "mixed-raw.env",
    type: "text/plain",
    text: `API_KEY=${rawSecret}`
  });
  rawFile.lastModified = 213;
  const fileInput = createFileInput();
  const composer = { tagName: "TEXTAREA", text: "", selection: { start: 0, end: 0 } };
  const { maybeHandleFileInputChange, handOffSanitizedFileInput, calls } = createHarness({
    findComposer: () => composer,
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      return {
        handled: true,
        ok: true,
        text: `API_KEY=${rawSecret}`,
        file: {
          name: rawFile.name,
          type: rawFile.type,
          sizeBytes: rawFile.size,
          lastModified: rawFile.lastModified
        }
      };
    }
  });

  assert.strictEqual(handOffSanitizedFileInput(fileInput, { files: [sanitizedFile] }, { dispatchInput: true }), true);
  fileInput.files = [sanitizedFile, rawFile];

  await maybeHandleFileInputChange(createEvent({ type: "change", target: fileInput }).event);

  assert.strictEqual(calls.reads.length, 1);
  assert.strictEqual(calls.redactions.length, 1);
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.handoffs[0].sanitizedFile.text.includes(rawSecret), false);
  assert.ok(calls.handoffs[0].sanitizedFile.text.includes("[PWM_1]"));
  assert.ok(!calls.debugEvents.some((entry) => entry.label === "file-input:sanitized-handoff-suppressed"));
  assert.strictEqual(JSON.stringify(calls.debugEvents).includes(rawSecret), false);
}

async function testSmallFileInputShowsProcessingUiThenDirectAttachSuccess() {
  const rawSecret = "LeakGuardFileApiKey1234567890";
  const rawFile = createTextFile({
    name: "small-direct.env",
    text: `API_KEY=${rawSecret}`
  });
  const fileInput = createFileInput();
  fileInput.files = [rawFile];
  const composer = {
    tagName: "TEXTAREA",
    text: "",
    selection: { start: 0, end: 0 }
  };
  const { maybeHandleFileInputChange, calls } = createHarness({
    location: { hostname: "chatgpt.com" },
    findComposer: () => composer,
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      return {
        handled: true,
        ok: true,
        text: `API_KEY=${rawSecret}`,
        file: {
          name: rawFile.name,
          type: rawFile.type,
          sizeBytes: rawFile.size
        }
      };
    }
  });

  await maybeHandleFileInputChange(createEvent({ type: "change", target: fileInput }).event);
  await Promise.resolve();

  const labels = calls.debugEvents.map((entry) => entry.label);
  assert.ok(labels.includes("file-ui:processing-shown"), "expected processing UI to show");
  assert.ok(
    calls.debugEvents.some(
      (entry) => entry.label === "file-ui:processing-updated" && /Sanitizing file locally/.test(entry.details.status)
    ),
    "expected sanitizing status update"
  );
  assert.ok(
    calls.debugEvents.some(
      (entry) => entry.label === "file-ui:processing-updated" && /Preparing sanitized upload/.test(entry.details.status)
    ),
    "expected sanitized upload preparation status"
  );
  assert.ok(labels.includes("file-ui:success-shown"), "expected success UI");
  assert.ok(labels.includes("file-ui:processing-hidden"), "expected processing UI cleanup");
  assert.ok(fileInput.files[0]?.text?.includes("[PWM_1]"), "expected sanitized file assignment");
  assert.strictEqual(fileInput.files[0]?.text?.includes(rawSecret), false);
  assert.strictEqual(JSON.stringify(calls.debugEvents).includes(rawSecret), false);
}

async function testGenericProtectedFileInputWithoutComposerAttachesSanitizedFile() {
  const rawSecret = "LeakGuardFileApiKey1234567890";
  const rawFile = createTextFile({
    name: "generic.env",
    text: `API_KEY=${rawSecret}`
  });
  const fileInput = createFileInput();
  fileInput.files = [rawFile];
  const { event, calls: eventCalls } = createEvent({
    type: "change",
    target: fileInput
  });
  const { maybeHandleFileInputChange, calls } = createHarness({
    location: { hostname: "protected.example" },
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      return {
        handled: true,
        ok: true,
        text: `API_KEY=${rawSecret}`,
        file: {
          name: rawFile.name,
          type: rawFile.type,
          sizeBytes: rawFile.size
        }
      };
    }
  });

  const result = await maybeHandleFileInputChange(event);
  await Promise.resolve();

  assert.strictEqual(result?.ok, true);
  assert.strictEqual(eventCalls.preventDefault, 1, "expected raw file input event to be consumed");
  assert.ok(fileInput.events.includes("input"), "expected sanitized input redispatch");
  assert.ok(fileInput.events.includes("change"), "expected sanitized change redispatch");
  assert.ok(fileInput.files[0]?.text?.includes("[PWM_1]"), "expected sanitized file assignment");
  assert.strictEqual(fileInput.files[0]?.text?.includes(rawSecret), false);
  assert.strictEqual(calls.modals.length, 0, "expected no fail-closed modal for supported sanitized handoff");
  assert.strictEqual(JSON.stringify(calls.debugEvents).includes(rawSecret), false);
}

async function testDocumentAndImageFileInputUseContentExtractionPipelineForSanitizedHandoff() {
  const cases = [
    {
      fileName: "report.pdf",
      type: "application/pdf",
      rawText: "PDF bytes with raw secret",
      outputName: "report.redacted.pdf",
      outputKind: "redacted_pdf_file",
      outputType: "application/pdf",
      extractedKind: "pdf"
    },
    {
      fileName: "brief.docx",
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      rawText: "DOCX bytes with raw secret",
      outputName: "brief.redacted.txt",
      outputKind: "redacted_text_file",
      outputType: "text/plain",
      extractedKind: "docx"
    },
    {
      fileName: "sheet.xlsx",
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      rawText: "XLSX bytes with raw secret",
      outputName: "sheet.redacted.txt",
      outputKind: "redacted_text_file",
      outputType: "text/plain",
      extractedKind: "xlsx"
    },
    {
      fileName: "diagram-sk-proj-rawfilename.png",
      type: "image/png",
      rawText: "PNG bytes with raw filename secret",
      outputName: "diagram-sk-proj-rawfilename.redacted.png",
      outputKind: "redacted_image_file",
      outputType: "image/png",
      extractedKind: "image_ocr",
      fileOnlyUpload: true,
      skipTextFallback: true
    }
  ];

  for (const item of cases) {
    const rawFile = createTextFile({
      name: item.fileName,
      type: item.type,
      text: item.rawText
    });
    const sanitizedFile = {
      name: item.outputName,
      type: item.outputType,
      size: 18,
      text: item.fileOnlyUpload
        ? async () => {
            throw new Error("image sanitized file must not be read as text");
          }
        : "API_KEY=[PWM_1]"
    };
    const sanitizedText = "API_KEY=[PWM_1]";
    const fileInput = createFileInput();
    fileInput.files = [rawFile];
    const composer = {
      tagName: "TEXTAREA",
      text: "",
      selection: { start: 0, end: 0 }
    };
    const pipelineCalls = [];
    const { maybeHandleFileInputChange, calls } = createHarness({
      location: { hostname: "chatgpt.com" },
      findComposer: () => composer,
      canExtractForAdapterHandoff: (file) => file?.name === item.fileName,
      processFileForAdapterHandoff: async ({ file, context }) => {
        pipelineCalls.push({ file, context });
        return {
          status: "ready",
          originalName: item.fileName,
          outputName: item.outputName,
          outputKind: item.outputKind,
          extractedKind: item.extractedKind,
          sanitizedText,
          sanitizedFile,
          metadata: {
            scan: {
              findingsCount: 1
            }
          },
          warnings: [],
          safeForUpload: true,
          fileOnlyUpload: item.fileOnlyUpload === true,
          skipTextFallback: item.skipTextFallback === true,
          fallbackReason: ""
        };
      },
      readLocalTextFileFromDataTransfer: async () => {
        throw new Error(`${item.extractedKind} pipeline should bypass legacy text-file reader`);
      }
    });

    await maybeHandleFileInputChange(createEvent({ type: "change", target: fileInput }).event);

    assert.strictEqual(pipelineCalls.length, 1, `${item.extractedKind} should use content extraction pipeline`);
    assert.strictEqual(pipelineCalls[0].file, rawFile);
    assert.strictEqual(pipelineCalls[0].context, "file-input");
    assert.strictEqual(calls.redactions.length, 0, `${item.extractedKind} should not double-redact sanitized output`);
    assert.strictEqual(calls.createdFiles.length, 0, `${item.extractedKind} should reuse pipeline sanitized file`);
    assert.strictEqual(calls.handoffs.length, 1, `${item.extractedKind} should hand off sanitized file`);
    assert.strictEqual(calls.handoffs[0].sanitizedFile, sanitizedFile);
    assert.strictEqual(calls.handoffs[0].sanitizedFile.name, item.outputName);
    assert.strictEqual(calls.textFallbacks.length, 0, `${item.extractedKind} should not insert OCR text`);
    assert.strictEqual(JSON.stringify(calls.debugEvents).includes(item.rawText), false);
  }
}

async function testSupportedImageFileInputAttachesSanitizedImageAcrossAdapters() {
  const hosts = [
    "chatgpt.com",
    "chat.openai.com",
    "gemini.google.com",
    "grok.com",
    "claude.ai",
    "x.com",
    "local.example"
  ];

  for (const hostname of hosts) {
    const rawFile = createTextFile({
      name: `${hostname.replace(/\W+/g, "-")}.png`,
      type: "image/png",
      text: "raw image bytes with sk-proj-ShouldNotReachProvider1234567890"
    });
    const sanitizedImage = {
      name: `${hostname.replace(/\W+/g, "-")}.redacted.png`,
      type: "image/png",
      size: 256,
      async text() {
        throw new Error(`${hostname} image handoff must not read sanitized image as text`);
      }
    };
    const fileInput = createFileInput();
    fileInput.files = [rawFile];
    const composer = {
      tagName: "TEXTAREA",
      text: "",
      selection: { start: 0, end: 0 }
    };
    const { maybeHandleFileInputChange, calls } = createHarness({
      location: { hostname },
      findComposer: () => composer,
      canExtractForAdapterHandoff: (file) => file?.name === rawFile.name,
      processFileForAdapterHandoff: async () => ({
        status: "ready",
        originalName: rawFile.name,
        outputName: sanitizedImage.name,
        outputKind: "redacted_image_file",
        extractedKind: "image_ocr",
        sanitizedText: "API_KEY=[PWM_1]",
        sanitizedFile: sanitizedImage,
        sanitizedImageFile: sanitizedImage,
        metadata: {
          scan: {
            findingsCount: 1
          },
          visualRedaction: {
            output: "png",
            protectedSiteEligible: true
          }
        },
        warnings: [],
        safeForUpload: true,
        fileOnlyUpload: true,
        skipTextFallback: true,
        fallbackReason: ""
      })
    });

    const result = await maybeHandleFileInputChange(createEvent({ type: "change", target: fileInput }).event);

    assert.strictEqual(result.stage, "file", `${hostname} should complete as file handoff`);
    assert.strictEqual(calls.handoffs.length, 1, `${hostname} should hand off sanitized image`);
    assert.strictEqual(calls.handoffs[0].sanitizedFile, sanitizedImage, `${hostname} should receive sanitized image`);
    assert.strictEqual(calls.handoffs[0].sanitizedFile.name.includes(".redacted"), true, `${hostname} output name`);
    assert.match(calls.handoffs[0].sanitizedFile.type, /^image\/(?:png|jpeg|webp)$/);
    assert.notStrictEqual(calls.handoffs[0].sanitizedFile, rawFile, `${hostname} must not hand off raw image`);
    assert.strictEqual(calls.textFallbacks.length, 0, `${hostname} must not insert OCR text`);
    assert.ok(
      calls.debugEvents.some(
        (entry) => entry.label === "file-ui:success-shown" && entry.details.status === "Sanitized image attached."
      ),
      `${hostname} should show image attach success UI`
    );
  }
}

async function testUnnamedClipboardImagePasteUsesContentExtractionPipeline() {
  const rawFile = createReadableTextFile({
    name: "",
    type: "image/png",
    text: "raw clipboard image bytes with sk-proj-ShouldNotReachProvider1234567890"
  });
  const sanitizedImage = {
    name: "clipboard-image.redacted.png",
    type: "image/png",
    size: 256,
    async text() {
      throw new Error("pasted image handoff must not read sanitized image as text");
    }
  };
  const editor = {
    tagName: "DIV",
    text: "",
    selection: { start: 0, end: 0 },
    isContentEditable: true
  };
  const pipelineCalls = [];
  const { maybeHandlePaste, calls } = createHarness({
    location: { hostname: "chatgpt.com" },
    findComposer: () => editor,
    canExtractForAdapterHandoff: globalThis.PWM.ContentFileExtractionPipeline.canExtractForAdapterHandoff,
    processFileForAdapterHandoff: async ({ file, context }) => {
      pipelineCalls.push({ file, context });
      return {
        status: "ready",
        originalName: "",
        outputName: sanitizedImage.name,
        outputKind: "redacted_image_file",
        extractedKind: "image_ocr",
        sanitizedText: "API_KEY=[PWM_1]",
        sanitizedFile: sanitizedImage,
        sanitizedImageFile: sanitizedImage,
        metadata: {
          original: {
            name: "",
            type: "image/png",
            size: rawFile.size
          },
          scan: {
            findingsCount: 1
          },
          visualRedaction: {
            output: "png",
            protectedSiteEligible: true
          }
        },
        warnings: [],
        safeForUpload: true,
        fileOnlyUpload: true,
        skipTextFallback: true,
        fallbackReason: ""
      };
    },
    readLocalTextFileFromDataTransfer: async () => {
      throw new Error("clipboard image paste should bypass legacy text-file reader");
    }
  });
  const clipboardData = {
    types: ["Files"],
    files: [rawFile],
    items: [
      {
        kind: "file",
        type: "image/png",
        getAsFile: () => rawFile
      }
    ],
    getData: () => ""
  };
  const { event } = createClipboardEvent({
    clipboardData,
    target: editor
  });

  await maybeHandlePaste(event);

  assert.strictEqual(event.defaultPrevented, true, "raw clipboard image paste should be consumed");
  assert.strictEqual(pipelineCalls.length, 1, "clipboard image paste should use content extraction pipeline");
  assert.strictEqual(pipelineCalls[0].file, rawFile);
  assert.strictEqual(pipelineCalls[0].context, "paste");
  assert.strictEqual(calls.handoffs.length, 1, "pasted image should hand off sanitized image");
  assert.strictEqual(calls.handoffs[0].sanitizedFile, sanitizedImage);
  assert.strictEqual(calls.handoffs[0].sanitizedFile.name, "clipboard-image.redacted.png");
  assert.strictEqual(calls.handoffs[0].sanitizedFile.type, "image/png");
  assert.notStrictEqual(calls.handoffs[0].sanitizedFile, rawFile);
  assert.strictEqual(calls.textFallbacks.length, 0, "pasted image must not insert OCR text");
  assert.strictEqual(JSON.stringify(calls).includes("sk-proj-ShouldNotReachProvider"), false);
}

async function testClipboardImagePasteItemsOnlyRoutesSupportedImagesToPipeline() {
  const cases = [
    {
      mimeType: "image/png",
      expectedName: "clipboard-image.png",
      sanitizedName: "clipboard-image.redacted.png",
      target: createChatGptContentEditableComposer("")
    },
    {
      mimeType: "image/jpeg",
      expectedName: "clipboard-image.jpg",
      sanitizedName: "clipboard-image.redacted.png",
      target: { tagName: "TEXTAREA", text: "", selection: { start: 0, end: 0 } }
    },
    {
      mimeType: "image/webp",
      expectedName: "clipboard-image.webp",
      sanitizedName: "clipboard-image.redacted.png",
      target: { tagName: "TEXTAREA", text: "", selection: { start: 0, end: 0 } }
    }
  ];

  for (const item of cases) {
    const rawFile = createReadableTextFile({
      name: "",
      type: "",
      text: `LGQA fake ${item.mimeType} clipboard bytes with sk-proj-RawClipboardImageShouldNotUpload1234567890`
    });
    const sanitizedImage = {
      name: item.sanitizedName,
      type: "image/png",
      size: 256,
      async text() {
        throw new Error(`${item.mimeType} pasted image must not be inserted as OCR text`);
      }
    };
    const pipelineCalls = [];
    const { maybeHandlePaste, calls } = createHarness({
      location: { hostname: "chatgpt.com" },
      findComposer: () => item.target,
      canExtractForAdapterHandoff: globalThis.PWM.ContentFileExtractionPipeline.canExtractForAdapterHandoff,
      processFileForAdapterHandoff: async ({ file, context }) => {
        pipelineCalls.push({ file, context });
        assert.strictEqual(file.name, item.expectedName);
        assert.strictEqual(file.type, item.mimeType);
        return {
          status: "ready",
          originalName: item.expectedName,
          outputName: item.sanitizedName,
          outputKind: "redacted_image_file",
          extractedKind: "image_ocr",
          sanitizedText: "API_KEY=[PWM_1]",
          sanitizedFile: sanitizedImage,
          sanitizedImageFile: sanitizedImage,
          metadata: {
            original: {
              name: item.expectedName,
              type: item.mimeType,
              size: rawFile.size
            },
            scan: {
              findingsCount: 1
            }
          },
          warnings: [],
          safeForUpload: true,
          fileOnlyUpload: true,
          skipTextFallback: true,
          fallbackReason: ""
        };
      },
      readLocalTextFileFromDataTransfer: async () => {
        throw new Error("clipboard image paste should not use the text-file reader");
      }
    });
    const clipboardData = {
      types: ["text/html"],
      files: [],
      items: [
        {
          kind: "string",
          type: "text/html",
          getAsFile: () => null
        },
        {
          kind: "file",
          type: item.mimeType,
          getAsFile: () => rawFile
        }
      ],
      getData(type) {
        if (type === "text/html") return "<img alt=\"LGQA fake clipboard image\">";
        if (type === "text/plain") return "API_KEY=LeakGuardPasteApiKey1234567890";
        return "";
      }
    };
    const { event } = createClipboardEvent({
      clipboardData,
      target: item.target
    });

    await maybeHandlePaste(event);

    assert.strictEqual(event.defaultPrevented, true, `${item.mimeType} raw clipboard image paste should be consumed`);
    assert.strictEqual(pipelineCalls.length, 1, `${item.mimeType} should use content extraction pipeline`);
    assert.strictEqual(pipelineCalls[0].context, "paste");
    assert.strictEqual(calls.redactions.length, 0, `${item.mimeType} should not run text paste redaction`);
    assert.strictEqual(calls.handoffs.length, 1, `${item.mimeType} should hand off sanitized image`);
    assert.strictEqual(calls.handoffs[0].sanitizedFile, sanitizedImage);
    assert.notStrictEqual(calls.handoffs[0].sanitizedFile, rawFile);
    assert.strictEqual(calls.textFallbacks.length, 0, `${item.mimeType} must not insert OCR text`);
    assert.strictEqual(JSON.stringify(calls).includes("sk-proj-RawClipboardImageShouldNotUpload"), false);
  }
}

async function testClipboardImagePasteUnsafeOriginalFilenameStaysInternal() {
  const rawFileName = "sk-proj-ClipboardImageFileNameSecret1234567890abcdef.png";
  const rawFile = createReadableTextFile({
    name: rawFileName,
    type: "image/png",
    text: "LGQA fake clipboard image bytes"
  });
  const sanitizedImage = {
    name: "clipboard-image.redacted.png",
    type: "image/png",
    size: 256,
    async text() {
      throw new Error("pasted image handoff must not read sanitized image as text");
    }
  };
  const pipelineCalls = [];
  const { maybeHandlePaste, calls } = createHarness({
    location: { hostname: "chatgpt.com" },
    findComposer: () => ({ tagName: "TEXTAREA", text: "", selection: { start: 0, end: 0 } }),
    canExtractForAdapterHandoff: globalThis.PWM.ContentFileExtractionPipeline.canExtractForAdapterHandoff,
    processFileForAdapterHandoff: async ({ file, context }) => {
      pipelineCalls.push({ file, context });
      return {
        status: "ready",
        originalName: file.name,
        outputName: sanitizedImage.name,
        outputKind: "redacted_image_file",
        extractedKind: "image_ocr",
        sanitizedText: "",
        sanitizedFile: sanitizedImage,
        metadata: { scan: { findingsCount: 0 } },
        warnings: [],
        safeForUpload: true,
        fileOnlyUpload: true,
        skipTextFallback: true,
        fallbackReason: ""
      };
    }
  });
  const { event } = createClipboardEvent({
    clipboardData: {
      types: ["Files"],
      files: [rawFile],
      items: [
        {
          kind: "file",
          type: "image/png",
          getAsFile: () => rawFile
        }
      ],
      getData: () => ""
    }
  });

  await maybeHandlePaste(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(pipelineCalls.length, 1);
  assert.strictEqual(pipelineCalls[0].file.name, "clipboard-image.png");
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(JSON.stringify(calls).includes(rawFileName), false);
}

async function testClipboardImagePasteOcrFailureBlocksRawImage() {
  const rawFile = createReadableTextFile({
    name: "",
    type: "",
    text: "LGQA fake clipboard PNG bytes"
  });
  const { maybeHandlePaste, calls } = createHarness({
    location: { hostname: "chatgpt.com" },
    findComposer: () => ({ tagName: "TEXTAREA", text: "", selection: { start: 0, end: 0 } }),
    canExtractForAdapterHandoff: globalThis.PWM.ContentFileExtractionPipeline.canExtractForAdapterHandoff,
    processFileForAdapterHandoff: async () => ({
      status: "blocked",
      originalName: "",
      outputName: "",
      outputKind: "",
      extractedKind: "image_ocr",
      sanitizedText: "",
      sanitizedFile: null,
      metadata: {
        original: {
          name: "",
          type: "image/png",
          size: rawFile.size
        }
      },
      warnings: ["image-redaction:ocr_failed"],
      safeForUpload: false,
      fallbackReason: "ocr_failed"
    }),
    readLocalTextFileFromDataTransfer: async () => {
      throw new Error("failed clipboard image OCR must not fall back to text-file read");
    }
  });
  const { event } = createClipboardEvent({
    clipboardData: {
      types: ["Files"],
      files: [],
      items: [
        {
          kind: "file",
          type: "image/png",
          getAsFile: () => rawFile
        }
      ],
      getData: () => ""
    }
  });

  const result = await maybeHandlePaste(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(calls.handoffs.length, 0);
  assert.strictEqual(calls.textFallbacks.length, 0);
  assert.ok(
    calls.modals.some(
      ([title, message]) =>
        title === "Raw image upload blocked" &&
        String(message || "").includes("local OCR could not read it safely")
    )
  );
}

async function testWhatsAppClipboardImagePasteRoutesSupportedImagesToSanitizedPasteHandoff() {
  for (const mimeType of ["image/png", "image/jpeg", "image/webp"]) {
    const rawFile = createReadableTextFile({
      name: "raw-secret-name.png",
      type: "",
      text: `LGQA fake WhatsApp ${mimeType} clipboard image bytes with sk-proj-RawWhatsAppImageShouldNotUpload1234567890`
    });
    const sanitizedImage = {
      name: "clipboard-image.redacted.png",
      type: "image/png",
      size: 256,
      async text() {
        throw new Error("WhatsApp image handoff must not read sanitized image as OCR text");
      }
    };
    const editor = { tagName: "DIV", isContentEditable: true, text: "", selection: { start: 0, end: 0 } };
    const pipelineCalls = [];
    const { maybeHandlePaste, calls } = createHarness({
      location: { hostname: "web.whatsapp.com" },
      findComposer: () => editor,
      canExtractForAdapterHandoff: globalThis.PWM.ContentFileExtractionPipeline.canExtractForAdapterHandoff,
      processFileForAdapterHandoff: async ({ file, context }) => {
        assert.strictEqual(file.name, mimeType === "image/jpeg" ? "clipboard-image.jpg" : `clipboard-image.${mimeType.split("/")[1]}`);
        assert.strictEqual(file.type, mimeType);
        assert.strictEqual(context, "paste");
        pipelineCalls.push({ file, context });
        assert.strictEqual(calls.handoffs.length, 0, "raw image must be consumed before sanitized handoff");
        return {
          status: "ready",
          originalName: file.name,
          outputName: sanitizedImage.name,
          outputKind: "redacted_image_file",
          extractedKind: "image_ocr",
          sanitizedText: "API_KEY=[PWM_1]",
          sanitizedFile: sanitizedImage,
          sanitizedImageFile: sanitizedImage,
          metadata: { scan: { findingsCount: 1 }, visualRedaction: { output: "png", protectedSiteEligible: true } },
          warnings: [],
          safeForUpload: true,
          fileOnlyUpload: true,
          skipTextFallback: true,
          fallbackReason: ""
        };
      },
      readLocalTextFileFromDataTransfer: async () => {
        throw new Error("WhatsApp clipboard image paste must not read raw image as text");
      }
    });
    const { event } = createClipboardEvent({
      clipboardData: {
        types: ["Files"],
        files: [],
        items: [{ kind: "file", type: mimeType, getAsFile: () => rawFile }],
        getData: () => ""
      },
      target: editor
    });

    const result = await maybeHandlePaste(event);

    assert.strictEqual(event.defaultPrevented, true, `${mimeType} raw WhatsApp image paste should be consumed`);
    assert.strictEqual(result.ok, true, `${mimeType} should complete sanitized image handoff`);
    assert.strictEqual(result.stage, "file");
    assert.strictEqual(pipelineCalls.length, 1, `${mimeType} should route through OCR/redaction pipeline`);
    assert.strictEqual(calls.handoffs.length, 1, `${mimeType} should hand off only sanitized image`);
    assert.strictEqual(calls.handoffs[0].context, "paste");
    assert.strictEqual(calls.handoffs[0].sanitizedFile, sanitizedImage);
    assert.notStrictEqual(calls.handoffs[0].sanitizedFile, rawFile);
    assert.strictEqual(calls.textFallbacks.length, 0, `${mimeType} must not insert OCR text into WhatsApp`);
    assert.strictEqual(JSON.stringify(calls).includes("sk-proj-RawWhatsAppImageShouldNotUpload"), false);
  }
}

async function testWhatsAppClipboardImagePasteConsumesEventSynchronously() {
  const rawFile = createReadableTextFile({
    name: "raw-whatsapp-clipboard.png",
    type: "",
    text: "LGQA fake WhatsApp clipboard image bytes"
  });
  let resolvePipeline;
  const pipelineStarted = new Promise((resolve) => {
    resolvePipeline = resolve;
  });
  const sanitizedImage = {
    name: "clipboard-image.redacted.png",
    type: "image/png",
    size: 256
  };
  const editor = { tagName: "DIV", isContentEditable: true, text: "", selection: { start: 0, end: 0 } };
  const { maybeHandlePaste, calls } = createHarness({
    location: { hostname: "web.whatsapp.com" },
    findComposer: () => editor,
    canExtractForAdapterHandoff: globalThis.PWM.ContentFileExtractionPipeline.canExtractForAdapterHandoff,
    processFileForAdapterHandoff: async () => {
      resolvePipeline();
      await new Promise((resolve) => setTimeout(resolve, 0));
      return {
        status: "ready",
        originalName: "clipboard-image.png",
        outputName: sanitizedImage.name,
        outputKind: "redacted_image_file",
        extractedKind: "image_ocr",
        sanitizedText: "",
        sanitizedFile: sanitizedImage,
        metadata: { scan: { findingsCount: 0 } },
        warnings: [],
        safeForUpload: true,
        fileOnlyUpload: true,
        skipTextFallback: true,
        fallbackReason: ""
      };
    }
  });
  const { event } = createClipboardEvent({
    clipboardData: {
      types: ["Files"],
      files: [],
      items: [{ kind: "file", type: "image/png", getAsFile: () => rawFile }],
      getData: () => ""
    },
    target: editor
  });

  const handling = maybeHandlePaste(event);

  assert.strictEqual(
    event.defaultPrevented,
    true,
    "WhatsApp clipboard image paste must be consumed synchronously before WhatsApp can preview the raw image"
  );
  await pipelineStarted;
  await handling;
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.handoffs[0].sanitizedFile, sanitizedImage);
}

async function testWhatsAppClipboardImagePasteFailureBlocksRawImage() {
  const rawFile = createReadableTextFile({ name: "", type: "", text: "LGQA fake WhatsApp PNG bytes" });
  const { maybeHandlePaste, calls } = createHarness({
    location: { hostname: "web.whatsapp.com" },
    findComposer: () => ({ tagName: "DIV", isContentEditable: true, text: "", selection: { start: 0, end: 0 } }),
    canExtractForAdapterHandoff: globalThis.PWM.ContentFileExtractionPipeline.canExtractForAdapterHandoff,
    processFileForAdapterHandoff: async () => ({
      status: "blocked",
      extractedKind: "image_ocr",
      outputKind: "redacted_image_file",
      sanitizedFile: null,
      sanitizedText: "",
      safeForUpload: false,
      fileOnlyUpload: true,
      skipTextFallback: true,
      fallbackReason: "ocr_failed",
      metadata: { original: { type: "image/png", size: rawFile.size } }
    })
  });
  const { event } = createClipboardEvent({
    clipboardData: { types: ["Files"], files: [], items: [{ kind: "file", type: "image/png", getAsFile: () => rawFile }], getData: () => "" }
  });

  const result = await maybeHandlePaste(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(calls.handoffs.length, 0);
  assert.strictEqual(calls.textFallbacks.length, 0);
  assert.ok(calls.modals.some(([title]) => title === "Raw image upload blocked"));
}

async function testWhatsAppUnsupportedClipboardImagePasteRemainsBlocked() {
  for (const mimeType of ["image/gif", "image/bmp", "image/svg+xml"]) {
    const rawFile = createReadableTextFile({ name: "", type: mimeType, text: "unsupported image bytes" });
    const { maybeHandlePaste, calls } = createHarness({
      location: { hostname: "web.whatsapp.com" },
      findComposer: () => ({ tagName: "DIV", isContentEditable: true, text: "", selection: { start: 0, end: 0 } }),
      processFileForAdapterHandoff: async () => {
        throw new Error(`${mimeType} must remain unsupported for WhatsApp clipboard paste`);
      }
    });
    const { event } = createClipboardEvent({
      clipboardData: { types: ["Files"], files: [], items: [{ kind: "file", type: mimeType, getAsFile: () => rawFile }], getData: () => "" }
    });

    const result = await maybeHandlePaste(event);

    assert.strictEqual(event.defaultPrevented, true);
    assert.strictEqual(result.reason, "whatsapp_file_attachments_unsupported");
    assert.strictEqual(calls.handoffs.length, 0);
    assert.ok(calls.modals.some(([title]) => title === "WhatsApp file upload blocked"));
  }
}

async function testWhatsAppSingleImageAttachRoutesToSanitizedHandoff() {
  for (const [name, mimeType] of [
    ["attach-secret.png", "image/png"],
    ["attach-secret.jpg", "image/jpeg"],
    ["attach-secret.jpeg", "image/jpeg"],
    ["attach-secret.webp", "image/webp"]
  ]) {
    const rawSecret = "sk-proj-RawWhatsAppAttachShouldNotUpload1234567890";
    const rawFile = createReadableTextFile({ name, type: mimeType, text: `image bytes ${rawSecret}` });
    const sanitizedImage = {
      name: name.replace(/\.[^.]+$/, ".redacted.png"),
      type: "image/png",
      size: 256,
      async text() {
        throw new Error("sanitized WhatsApp image attach must remain file-only");
      }
    };
    const fileInput = createFileInput();
    fileInput.files = [rawFile];
    fileInput.value = `C:\\fakepath\\${name}`;
    let pipelineCalls = 0;
    const { maybeHandleFileInputChange, calls } = createHarness({
      location: { hostname: "web.whatsapp.com" },
      findComposer: () => null,
      canExtractForAdapterHandoff: (file) => file === rawFile,
      processFileForAdapterHandoff: async ({ file, context }) => {
        pipelineCalls += 1;
        assert.strictEqual(file, rawFile);
        assert.strictEqual(context, "file-input");
        assert.strictEqual(fileInput.files.length, 0, "raw WhatsApp attach input should be cleared before OCR");
        return {
          status: "ready",
          originalName: rawFile.name,
          outputName: sanitizedImage.name,
          outputKind: "redacted_image_file",
          extractedKind: "image_ocr",
          sanitizedText: "API_KEY=[PWM_1]",
          sanitizedFile: sanitizedImage,
          sanitizedImageFile: sanitizedImage,
          metadata: { original: { type: mimeType, size: rawFile.size }, scan: { findingsCount: 1 } },
          warnings: [],
          safeForUpload: true,
          fileOnlyUpload: true,
          skipTextFallback: true,
          fallbackReason: ""
        };
      },
      readLocalTextFileFromDataTransfer: async () => {
        throw new Error("WhatsApp attach image must not be read as text");
      },
      handOffSanitizedLocalFile: (event, input, sanitizedFile, context) => {
        calls.handoffs.push({ event, input, sanitizedFile, context });
        assert.strictEqual(event.target, fileInput);
        assert.strictEqual(context, "file-input");
        fileInput.files = [sanitizedFile];
        fileInput.dispatchEvent({ type: "input", bubbles: true, composed: true });
        fileInput.dispatchEvent({ type: "change", bubbles: true, composed: true });
        return true;
      }
    });
    const { event } = createEvent({
      type: "change",
      target: fileInput
    });

    const result = await maybeHandleFileInputChange(event);

    assert.strictEqual(event.defaultPrevented, true, `${name} raw attach event should be consumed`);
    assert.strictEqual(result.ok, true, `${name} should attach a sanitized image`);
    assert.strictEqual(result.stage, "file");
    assert.strictEqual(pipelineCalls, 1, `${name} should route through the OCR/redaction pipeline`);
    assert.strictEqual(fileInput.files.length, 1, `${name} should leave only the sanitized image on the input`);
    assert.strictEqual(fileInput.files[0], sanitizedImage);
    assert.notStrictEqual(fileInput.files[0], rawFile);
    assert.deepStrictEqual(fileInput.events, ["input", "change"]);
    assert.strictEqual(calls.textFallbacks.length, 0, `${name} must not insert OCR text into WhatsApp`);
    assert.strictEqual(JSON.stringify(calls).includes(rawSecret), false);
  }
}

async function testWhatsAppSingleTextDocumentAttachRoutesToSanitizedHandoff() {
  for (const { name, mimeType, extension } of [
    { name: "lgqa-wa-doc.txt", mimeType: "text/plain" },
    { name: "lgqa-wa-doc.env", mimeType: "text/plain" },
    { name: "lgqa-wa-doc.json", mimeType: "application/json" },
    { name: "lgqa-wa-doc.log", mimeType: "text/plain" },
    { name: "lgqa-wa-doc.md", mimeType: "text/markdown" },
    { name: "lgqa-wa-doc.csv", mimeType: "text/csv" },
    { name: "lgqa-wa-doc.yaml", mimeType: "text/yaml" },
    { name: "lgqa-wa-doc.pem", mimeType: "text/plain" },
    { name: "lgqa-wa-doc.ps1", mimeType: "text/plain" },
    { name: "lgqa-wa-doc.py", mimeType: "text/x-python" },
    { name: "lgqa-wa-doc.sql", mimeType: "application/sql" },
    { name: "Dockerfile", mimeType: "text/plain", extension: "" },
    { name: "Makefile", mimeType: "text/plain", extension: "" }
  ]) {
    const rawSecret = "LeakGuardFileApiKey1234567890";
    const rawText = [
      "LGQA_WA_DOC_TEXT_1=true",
      `OPENAI_API_KEY=${rawSecret}`
    ].join("\n");
    const sanitizedText = [
      "LGQA_WA_DOC_TEXT_1=true",
      "OPENAI_API_KEY=[PWM_1]"
    ].join("\n");
    const rawFile = createReadableTextFile({ name, type: mimeType, text: rawText });
    const fileInput = createFileInput();
    fileInput.files = [rawFile];
    fileInput.value = `C:\\fakepath\\${name}`;
    let readCalls = 0;
    const { maybeHandleFileInputChange, calls } = createHarness({
      location: { hostname: "web.whatsapp.com" },
      findComposer: () => null,
      readLocalTextFileFromDataTransfer: async (transfer) => {
        readCalls += 1;
        assert.strictEqual(fileInput.files.length, 0, `${name} raw input should be cleared before reading`);
        assert.strictEqual(Array.from(transfer.files || [])[0], rawFile);
        return {
          handled: true,
          ok: true,
          text: rawText,
          file: {
            name,
            extension: extension ?? name.slice(name.lastIndexOf(".")),
            type: mimeType,
            sizeBytes: rawFile.size
          }
        };
      },
      createSanitizedTextFile: (file, text) => {
        assert.strictEqual(file.name, name);
        assert.strictEqual(text, sanitizedText);
        const sanitizedFile = {
          name: file.name,
          type: file.type || "text/plain",
          size: text.length,
          async text() {
            return text;
          }
        };
        calls.createdFiles.push({ file, text, sanitizedFile });
        return sanitizedFile;
      },
      handOffSanitizedLocalFile: async (event, input, sanitizedFile, context) => {
        calls.handoffs.push({ event, input, sanitizedFile, context });
        fileInput.files = [sanitizedFile];
        fileInput.dispatchEvent({ type: "input", bubbles: true, composed: true });
        fileInput.dispatchEvent({ type: "change", bubbles: true, composed: true });
        return true;
      }
    });
    const { event } = createEvent({ type: "change", target: fileInput });

    const result = await maybeHandleFileInputChange(event);

    assert.strictEqual(event.defaultPrevented, true, `${name} raw attach event should be consumed`);
    assert.strictEqual(result.ok, true, `${name} should attach a sanitized document`);
    assert.strictEqual(result.stage, "file");
    assert.strictEqual(readCalls, 1);
    assert.strictEqual(calls.redactions.length, 1);
    assert.strictEqual(calls.createdFiles.length, 1);
    assert.strictEqual(calls.handoffs.length, 1);
    assert.strictEqual(calls.handoffs[0].context, "file-input");
    assert.strictEqual(fileInput.files.length, 1);
    assert.strictEqual(fileInput.files[0], calls.createdFiles[0].sanitizedFile);
    assert.notStrictEqual(fileInput.files[0], rawFile);
    assert.deepStrictEqual(fileInput.events, ["input", "change"]);
    assert.strictEqual(await fileInput.files[0].text(), sanitizedText);
    assert.strictEqual((await fileInput.files[0].text()).includes(rawSecret), false);
    assert.ok((await fileInput.files[0].text()).includes("[PWM_1]"));
    assert.strictEqual(calls.textFallbacks.length, 0, `${name} must not insert extracted text into WhatsApp`);
  }
}

async function testWhatsAppUnsupportedTextNamedAttachBlocksBeforeRead() {
  for (const file of [
    createReadableTextFile({
      name: "lgqa-wa-extensionless",
      type: "text/plain",
      text: "OPENAI_API_KEY=LeakGuardFileApiKey1234567890"
    }),
    createReadableTextFile({
      name: "lgqa-wa-mime-only",
      type: "text/yaml",
      text: "OPENAI_API_KEY=LeakGuardFileApiKey1234567890"
    }),
    createReadableTextFile({
      name: "lgqa-wa-unsafe-sk-proj-UnsafeName1234567890abcdef",
      type: "text/plain",
      text: "OPENAI_API_KEY=LeakGuardFileApiKey1234567890"
    })
  ]) {
    const fileInput = createFileInput();
    fileInput.files = [file];
    fileInput.value = `C:\\fakepath\\${file.name}`;
    const { maybeHandleFileInputChange, calls } = createHarness({
      location: { hostname: "web.whatsapp.com" },
      findComposer: () => null,
      readLocalTextFileFromDataTransfer: async () => {
        throw new Error(`${file.name} must be blocked before text read`);
      },
      processFileForAdapterHandoff: async () => {
        throw new Error(`${file.name} must be blocked before extraction`);
      },
      createSanitizedTextFile: () => {
        throw new Error(`${file.name} must not produce a sanitized file`);
      }
    });

    const result = await maybeHandleFileInputChange(createEvent({ type: "change", target: fileInput }).event);

    assert.strictEqual(result.ok, false, `${file.name} should be blocked`);
    assert.strictEqual(result.reason, "whatsapp_file_attachments_unsupported");
    assert.strictEqual(fileInput.files.length, 0, `${file.name} raw selection should be cleared`);
    assert.strictEqual(calls.reads.length, 0, `${file.name} should not be read`);
    assert.strictEqual(calls.createdFiles.length, 0, `${file.name} should not create output`);
    const modalText = calls.modals.flat().join("\n");
    assert.match(modalText, /No raw file was uploaded/i);
    assert.strictEqual(modalText.includes(file.name), false, `${file.name} must not leak into blocked UI`);
    assert.strictEqual(modalText.includes("UnsafeName"), false, `${file.name} unsafe segment must not leak`);
  }
}

async function testWhatsAppSinglePdfAttachRoutesToSanitizedHandoff() {
  const rawSecret = "LeakGuardFileApiKey1234567890";
  const sanitizedText = [
    "LGQA_WA_PDF_1",
    "OPENAI_API_KEY=[PWM_1]",
    "GITHUB_TOKEN=[PWM_2]",
    "DATABASE_URL=postgres://admin:[PWM_3]@db.example.com:5432/customerdb"
  ].join("\n");
  const rawFile = createReadableTextFile({
    name: "lgqa-wa-pdf-secret.pdf",
    type: "application/pdf",
    text: [
      "LGQA_WA_PDF_1",
      `OPENAI_API_KEY=${rawSecret}`,
      "GITHUB_TOKEN=ghp_LGQAFakeGithubToken1234567890",
      "DATABASE_URL=postgres://admin:FakePass123@db.example.com:5432/customerdb"
    ].join("\n")
  });
  const sanitizedPdf = {
    name: "lgqa-wa-pdf-secret.redacted.pdf",
    type: "application/pdf",
    size: 512,
    async text() {
      return `%PDF-1.4\n${sanitizedText}\n%%EOF`;
    }
  };
  const fileInput = createFileInput();
  fileInput.files = [rawFile];
  fileInput.value = "C:\\fakepath\\lgqa-wa-pdf-secret.pdf";
  let pipelineCalls = 0;
  const { maybeHandleFileInputChange, calls } = createHarness({
    location: { hostname: "web.whatsapp.com" },
    findComposer: () => null,
    canExtractForAdapterHandoff: (file) => file === rawFile,
    processFileForAdapterHandoff: async ({ file, context }) => {
      pipelineCalls += 1;
      assert.strictEqual(file, rawFile);
      assert.strictEqual(context, "file-input");
      assert.strictEqual(fileInput.files.length, 0, "raw WhatsApp PDF input should be cleared before extraction");
      return {
        status: "ready",
        originalName: rawFile.name,
        outputName: sanitizedPdf.name,
        outputKind: "redacted_pdf_file",
        extractedKind: "pdf",
        sanitizedText,
        sanitizedFile: sanitizedPdf,
        metadata: {
          original: { type: "application/pdf", size: rawFile.size },
          scan: { findingsCount: 3 }
        },
        warnings: [],
        safeForUpload: true,
        fallbackReason: ""
      };
    },
    readLocalTextFileFromDataTransfer: async () => {
      throw new Error("WhatsApp PDF attach must use the PDF extraction pipeline");
    },
    handOffSanitizedLocalFile: (event, input, sanitizedFile, context) => {
      calls.handoffs.push({ event, input, sanitizedFile, context });
      assert.strictEqual(event.target, fileInput);
      assert.strictEqual(context, "file-input");
      fileInput.files = [sanitizedFile];
      fileInput.dispatchEvent({ type: "input", bubbles: true, composed: true });
      fileInput.dispatchEvent({ type: "change", bubbles: true, composed: true });
      return true;
    }
  });

  const result = await maybeHandleFileInputChange(createEvent({ type: "change", target: fileInput }).event);

  assert.strictEqual(result.ok, true, "single WhatsApp PDF should attach a sanitized PDF");
  assert.strictEqual(result.stage, "file");
  assert.strictEqual(pipelineCalls, 1);
  assert.strictEqual(calls.redactions.length, 0, "PDF pipeline output should not be double-redacted");
  assert.strictEqual(calls.createdFiles.length, 0, "PDF pipeline output should not be rebuilt as text");
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(fileInput.files.length, 1);
  assert.strictEqual(fileInput.files[0], sanitizedPdf);
  assert.notStrictEqual(fileInput.files[0], rawFile);
  assert.deepStrictEqual(fileInput.events, ["input", "change"]);
  const assignedText = await fileInput.files[0].text();
  assert.strictEqual(assignedText.includes(rawSecret), false);
  assert.strictEqual(assignedText.includes("FakePass123"), false);
  assert.ok(assignedText.includes("[PWM_1]"));
  assert.ok(assignedText.includes("[PWM_2]"));
  assert.ok(assignedText.includes("[PWM_3]"));
  assert.strictEqual(calls.textFallbacks.length, 0, "WhatsApp must not insert extracted PDF text");
}

async function testWhatsAppSingleDocxAttachRoutesToSanitizedHandoff() {
  const rawSecrets = {
    openai: "sk-proj-LGQAFakeOpenAIKey1234567890",
    github: "ghp_LGQAFakeGithubToken1234567890",
    password: "FakePass123"
  };
  const rawText = [
    "LGQA_WA_DOCX_1",
    `OPENAI_API_KEY=${rawSecrets.openai}`,
    `GITHUB_TOKEN=${rawSecrets.github}`,
    `DATABASE_URL=postgres://admin:${rawSecrets.password}@db.example.com:5432/customerdb`
  ].join("\n");
  const sanitizedText = [
    "LGQA_WA_DOCX_1",
    "OPENAI_API_KEY=[PWM_1]",
    "GITHUB_TOKEN=[PWM_2]",
    "DATABASE_URL=postgres://admin:[PWM_3]@db.example.com:5432/customerdb"
  ].join("\n");
  const rawFile = createReadableTextFile({
    name: "lgqa-wa-docx-secret.docx",
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    text: rawText
  });
  const sanitizedDocx = {
    name: "lgqa-wa-docx-secret.redacted.docx",
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    size: 768,
    async text() {
      return `PK\x03\x04\n${sanitizedText}\n`;
    }
  };
  const fileInput = createFileInput();
  fileInput.files = [rawFile];
  fileInput.value = "C:\\fakepath\\lgqa-wa-docx-secret.docx";
  let pipelineCalls = 0;
  const { maybeHandleFileInputChange, calls } = createHarness({
    location: { hostname: "web.whatsapp.com" },
    findComposer: () => null,
    canExtractForAdapterHandoff: (file) => file === rawFile,
    processFileForAdapterHandoff: async ({ file, context }) => {
      pipelineCalls += 1;
      assert.strictEqual(file, rawFile);
      assert.strictEqual(context, "file-input");
      assert.strictEqual(fileInput.files.length, 0, "raw WhatsApp DOCX input should be cleared before extraction");
      return {
        status: "ready",
        originalName: rawFile.name,
        outputName: sanitizedDocx.name,
        outputKind: "redacted_docx_file",
        extractedKind: "docx",
        sanitizedText,
        sanitizedFile: sanitizedDocx,
        metadata: {
          original: {
            type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            size: rawFile.size
          },
          scan: { findingsCount: 3 }
        },
        warnings: [],
        safeForUpload: true,
        fallbackReason: ""
      };
    },
    readLocalTextFileFromDataTransfer: async () => {
      throw new Error("WhatsApp DOCX attach must use the DOCX extraction pipeline");
    },
    handOffSanitizedLocalFile: (event, input, sanitizedFile, context) => {
      calls.handoffs.push({ event, input, sanitizedFile, context });
      assert.strictEqual(event.target, fileInput);
      assert.strictEqual(context, "file-input");
      fileInput.files = [sanitizedFile];
      fileInput.dispatchEvent({ type: "input", bubbles: true, composed: true });
      fileInput.dispatchEvent({ type: "change", bubbles: true, composed: true });
      return true;
    }
  });

  const result = await maybeHandleFileInputChange(createEvent({ type: "change", target: fileInput }).event);

  assert.strictEqual(result.ok, true, "single WhatsApp DOCX should attach a sanitized DOCX");
  assert.strictEqual(result.stage, "file");
  assert.strictEqual(pipelineCalls, 1);
  assert.strictEqual(calls.redactions.length, 0, "DOCX pipeline output should not be double-redacted");
  assert.strictEqual(calls.createdFiles.length, 0, "DOCX pipeline output should not be rebuilt as text");
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(fileInput.files.length, 1);
  assert.strictEqual(fileInput.files[0], sanitizedDocx);
  assert.notStrictEqual(fileInput.files[0], rawFile);
  assert.deepStrictEqual(fileInput.events, ["input", "change"]);
  const assignedText = await fileInput.files[0].text();
  assert.strictEqual(assignedText.includes(rawSecrets.openai), false);
  assert.strictEqual(assignedText.includes(rawSecrets.github), false);
  assert.strictEqual(assignedText.includes(rawSecrets.password), false);
  assert.ok(assignedText.includes("[PWM_1]"));
  assert.ok(assignedText.includes("[PWM_2]"));
  assert.ok(assignedText.includes("[PWM_3]"));
  assert.strictEqual(calls.textFallbacks.length, 0, "WhatsApp must not insert extracted DOCX text");
}

async function testWhatsAppSingleXlsxAttachRoutesToSanitizedHandoff() {
  const rawSecrets = {
    openai: "sk-proj-LGQAFakeOpenAIKey1234567890",
    github: "ghp_LGQAFakeGithubToken1234567890",
    password: "FakePass123"
  };
  const rawText = [
    "LGQA_WA_XLSX_1",
    "OPENAI_API_KEY",
    rawSecrets.openai,
    "GITHUB_TOKEN",
    rawSecrets.github,
    "DATABASE_URL",
    `postgres://admin:${rawSecrets.password}@db.example.com:5432/customerdb`
  ].join("\n");
  const sanitizedText = [
    "LGQA_WA_XLSX_1",
    "OPENAI_API_KEY",
    "[PWM_1]",
    "GITHUB_TOKEN",
    "[PWM_2]",
    "DATABASE_URL",
    "postgres://admin:[PWM_3]@db.example.com:5432/customerdb"
  ].join("\n");
  const rawFile = createReadableTextFile({
    name: "lgqa-wa-xlsx-secret.xlsx",
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    text: rawText
  });
  const sanitizedXlsx = {
    name: "lgqa-wa-xlsx-secret.redacted.xlsx",
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    size: 896,
    async text() {
      return `PK\x03\x04\n${sanitizedText}\n`;
    }
  };
  const fileInput = createFileInput();
  fileInput.files = [rawFile];
  fileInput.value = "C:\\fakepath\\lgqa-wa-xlsx-secret.xlsx";
  let pipelineCalls = 0;
  const { maybeHandleFileInputChange, calls } = createHarness({
    location: { hostname: "web.whatsapp.com" },
    findComposer: () => null,
    canExtractForAdapterHandoff: (file) => file === rawFile,
    processFileForAdapterHandoff: async ({ file, context }) => {
      pipelineCalls += 1;
      assert.strictEqual(file, rawFile);
      assert.strictEqual(context, "file-input");
      assert.strictEqual(fileInput.files.length, 0, "raw WhatsApp XLSX input should be cleared before extraction");
      return {
        status: "ready",
        originalName: rawFile.name,
        outputName: sanitizedXlsx.name,
        outputKind: "redacted_xlsx_file",
        extractedKind: "xlsx",
        sanitizedText,
        sanitizedFile: sanitizedXlsx,
        metadata: {
          original: {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            size: rawFile.size
          },
          scan: { findingsCount: 3 }
        },
        warnings: [],
        safeForUpload: true,
        fallbackReason: ""
      };
    },
    readLocalTextFileFromDataTransfer: async () => {
      throw new Error("WhatsApp XLSX attach must use the XLSX extraction pipeline");
    },
    handOffSanitizedLocalFile: (event, input, sanitizedFile, context) => {
      calls.handoffs.push({ event, input, sanitizedFile, context });
      assert.strictEqual(event.target, fileInput);
      assert.strictEqual(context, "file-input");
      fileInput.files = [sanitizedFile];
      fileInput.dispatchEvent({ type: "input", bubbles: true, composed: true });
      fileInput.dispatchEvent({ type: "change", bubbles: true, composed: true });
      return true;
    }
  });

  const result = await maybeHandleFileInputChange(createEvent({ type: "change", target: fileInput }).event);

  assert.strictEqual(result.ok, true, "single WhatsApp XLSX should attach a sanitized XLSX");
  assert.strictEqual(result.stage, "file");
  assert.strictEqual(pipelineCalls, 1);
  assert.strictEqual(calls.redactions.length, 0, "XLSX pipeline output should not be double-redacted");
  assert.strictEqual(calls.createdFiles.length, 0, "XLSX pipeline output should not be rebuilt as text");
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(fileInput.files.length, 1);
  assert.strictEqual(fileInput.files[0], sanitizedXlsx);
  assert.notStrictEqual(fileInput.files[0], rawFile);
  assert.deepStrictEqual(fileInput.events, ["input", "change"]);
  const assignedText = await fileInput.files[0].text();
  assert.strictEqual(assignedText.includes(rawSecrets.openai), false);
  assert.strictEqual(assignedText.includes(rawSecrets.github), false);
  assert.strictEqual(assignedText.includes(rawSecrets.password), false);
  assert.ok(assignedText.includes("[PWM_1]"));
  assert.ok(assignedText.includes("[PWM_2]"));
  assert.ok(assignedText.includes("[PWM_3]"));
  assert.strictEqual(calls.textFallbacks.length, 0, "WhatsApp must not insert extracted XLSX text");
}

async function testWhatsAppTwoTextDocumentAttachRoutesToSanitizedBatch() {
  const rawSecret = "LeakGuardFileApiKey1234567890";
  const files = [
    createReadableTextFile({
      name: "lgqa-wa-batch-one.yaml",
      type: "text/yaml",
      text: `OPENAI_API_KEY=${rawSecret}\nBATCH=one`
    }),
    createReadableTextFile({
      name: "lgqa-wa-batch-two.pem",
      type: "text/plain",
      text: `GITHUB_TOKEN=${rawSecret}\nBATCH=two`
    }),
    createReadableTextFile({
      name: "lgqa-wa-batch-three.ps1",
      type: "text/plain",
      text: `$Env:LEAKGUARD_KEY="${rawSecret}"\nBATCH=three`
    }),
    createReadableTextFile({
      name: "lgqa-wa-batch-four.py",
      type: "text/x-python",
      text: `token = "${rawSecret}"\nBATCH = "four"`
    }),
    createReadableTextFile({
      name: "lgqa-wa-batch-five.sql",
      type: "application/sql",
      text: `SELECT '${rawSecret}' AS api_key;\n-- BATCH=five`
    })
  ];
  const fileInput = createFileInput({ multiple: true });
  fileInput.files = files;
  fileInput.value = "C:\\fakepath\\lgqa-wa-batch-one.env";
  const { maybeHandleFileInputChange, calls } = createHarness({
    location: { hostname: "web.whatsapp.com" },
    findComposer: () => null,
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      assert.strictEqual(fileInput.files.length, 0, "raw WhatsApp multi-file input should be cleared before reading");
      const file = transfer.files[0];
      return {
        handled: true,
        ok: true,
        text: await file.text(),
        file: {
          name: file.name,
          extension: file.name.slice(file.name.lastIndexOf(".")),
          type: file.type,
          sizeBytes: file.size
        }
      };
    },
    createSanitizedTextFile: (file, text) => {
      const sanitizedFile = {
        name: file.name,
        type: file.type || "text/plain",
        size: text.length,
        async text() {
          return text;
        }
      };
      calls.createdFiles.push({ file, text, sanitizedFile });
      return sanitizedFile;
    }
  });

  const result = await maybeHandleFileInputChange(createEvent({ type: "change", target: fileInput }).event);

  assert.strictEqual(result.ok, true, "mixed canonical WhatsApp text documents should attach as a sanitized batch");
  assert.strictEqual(result.stage, "file");
  assert.strictEqual(calls.reads.length, 5);
  assert.strictEqual(calls.redactions.length, 5);
  assert.strictEqual(calls.createdFiles.length, 5);
  assert.strictEqual(fileInput.files.length, 5);
  assert.deepStrictEqual(fileInput.files.map((file) => file.name), files.map((file) => file.name));
  assert.strictEqual(fileInput.files[0], calls.createdFiles[0].sanitizedFile);
  assert.strictEqual(fileInput.files[1], calls.createdFiles[1].sanitizedFile);
  assert.strictEqual(fileInput.files[2], calls.createdFiles[2].sanitizedFile);
  assert.strictEqual(fileInput.files[3], calls.createdFiles[3].sanitizedFile);
  assert.strictEqual(fileInput.files[4], calls.createdFiles[4].sanitizedFile);
  assert.notStrictEqual(fileInput.files[0], files[0]);
  assert.notStrictEqual(fileInput.files[1], files[1]);
  assert.notStrictEqual(fileInput.files[2], files[2]);
  assert.notStrictEqual(fileInput.files[3], files[3]);
  assert.notStrictEqual(fileInput.files[4], files[4]);
  assert.deepStrictEqual(fileInput.events, ["input", "change"]);
  for (const assigned of fileInput.files) {
    const text = await assigned.text();
    assert.strictEqual(text.includes(rawSecret), false);
    assert.ok(text.includes("[PWM_1]"));
  }
  assert.strictEqual(calls.textFallbacks.length, 0, "WhatsApp must not insert batch text into the composer");
  assert.strictEqual(JSON.stringify(calls.debugEvents).includes(rawSecret), false);
  assert.strictEqual(JSON.stringify(calls.modals).includes(rawSecret), false);
}

async function testWhatsAppBasenameTextDocumentAttachRoutesToSanitizedBatch() {
  const rawSecret = "LeakGuardFileApiKey1234567890";
  const files = [
    createReadableTextFile({
      name: "Dockerfile",
      type: "text/plain",
      text: `ENV OPENAI_API_KEY=${rawSecret}`
    }),
    createReadableTextFile({
      name: "Makefile",
      type: "text/plain",
      text: `deploy:\n\tTOKEN=${rawSecret}`
    })
  ];
  const fileInput = createFileInput({ multiple: true });
  fileInput.files = files;
  const { maybeHandleFileInputChange, calls } = createHarness({
    location: { hostname: "web.whatsapp.com" },
    findComposer: () => null,
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      assert.strictEqual(fileInput.files.length, 0, "raw WhatsApp basename batch should be cleared before reading");
      const file = transfer.files[0];
      return {
        handled: true,
        ok: true,
        text: await file.text(),
        file: {
          name: file.name,
          extension: "",
          type: file.type,
          sizeBytes: file.size
        }
      };
    },
    createSanitizedTextFile: (file, text) => {
      const sanitizedFile = {
        name: file.name,
        type: file.type || "text/plain",
        size: text.length,
        async text() {
          return text;
        }
      };
      calls.createdFiles.push({ file, text, sanitizedFile });
      return sanitizedFile;
    }
  });

  const result = await maybeHandleFileInputChange(createEvent({ type: "change", target: fileInput }).event);

  assert.strictEqual(result.ok, true, "Dockerfile and Makefile should attach as a sanitized batch");
  assert.strictEqual(result.stage, "file");
  assert.strictEqual(calls.reads.length, 2);
  assert.strictEqual(calls.createdFiles.length, 2);
  assert.deepStrictEqual(fileInput.files.map((file) => file.name), ["Dockerfile", "Makefile"]);
  assert.strictEqual(fileInput.files[0], calls.createdFiles[0].sanitizedFile);
  assert.strictEqual(fileInput.files[1], calls.createdFiles[1].sanitizedFile);
  assert.strictEqual(fileInput.files.some((file) => files.includes(file)), false);
  for (const assigned of fileInput.files) {
    const text = await assigned.text();
    assert.strictEqual(text.includes(rawSecret), false);
    assert.ok(text.includes("[PWM_1]"));
  }
  assert.strictEqual(calls.textFallbacks.length, 0, "WhatsApp must not insert basename batch text into the composer");
}

async function testWhatsAppTenTextDocumentAttachRoutesToSanitizedBatch() {
  const rawSecret = "LeakGuardTenFileApiKey1234567890";
  const files = Array.from({ length: 10 }, (_, index) =>
    createReadableTextFile({
      name: `lgqa-wa-ten-${index + 1}.env`,
      type: "text/plain",
      text: `OPENAI_API_KEY=${rawSecret}\nINDEX=${index + 1}`
    })
  );
  const fileInput = createFileInput({ multiple: true });
  fileInput.files = files;
  const { maybeHandleFileInputChange, calls } = createHarness({
    location: { hostname: "web.whatsapp.com" },
    findComposer: () => null,
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      assert.strictEqual(fileInput.files.length, 0, "raw WhatsApp 10-file input should be cleared before reading");
      const file = transfer.files[0];
      return {
        handled: true,
        ok: true,
        text: await file.text(),
        file: {
          name: file.name,
          extension: ".env",
          type: file.type,
          sizeBytes: file.size
        }
      };
    },
    createSanitizedTextFile: (file, text) => {
      const sanitizedFile = {
        name: file.name,
        type: file.type || "text/plain",
        size: text.length,
        async text() {
          return text;
        }
      };
      calls.createdFiles.push({ file, text, sanitizedFile });
      return sanitizedFile;
    }
  });

  const result = await maybeHandleFileInputChange(createEvent({ type: "change", target: fileInput }).event);

  assert.strictEqual(result.ok, true, "10 small WhatsApp text documents should attach as a sanitized batch");
  assert.strictEqual(calls.reads.length, 10);
  assert.strictEqual(calls.redactions.length, 10);
  assert.strictEqual(calls.createdFiles.length, 10);
  assert.deepStrictEqual(fileInput.files.map((file) => file.name), files.map((file) => file.name));
  assert.deepStrictEqual(fileInput.files, calls.createdFiles.map((entry) => entry.sanitizedFile));
  assert.strictEqual(fileInput.files.some((file) => files.includes(file)), false);
  assert.deepStrictEqual(fileInput.events, ["input", "change"]);
  for (const assigned of fileInput.files) {
    const text = await assigned.text();
    assert.strictEqual(text.includes(rawSecret), false);
    assert.ok(text.includes("[PWM_1]"));
  }
  assert.strictEqual(calls.textFallbacks.length, 0, "WhatsApp must not insert 10-file batch text into the composer");
  assert.strictEqual(JSON.stringify(calls.debugEvents).includes(rawSecret), false);
  assert.strictEqual(JSON.stringify(calls.modals).includes(rawSecret), false);
}

async function testWhatsAppFiveMixedSupportedAttachPreservesSanitizedOrder() {
  const rawSecrets = {
    openai: "sk-proj-LGQAFakeOpenAIKey1234567890",
    github: "ghp_LGQAFakeGithubToken1234567890",
    password: "FakePass123",
    text: "LeakGuardFileApiKey1234567890"
  };
  const textFile = createReadableTextFile({
    name: "lgqa-wa-mixed-one.csv",
    type: "text/csv",
    text: `name,key\none,${rawSecrets.text}`
  });
  const imageFile = createReadableTextFile({
    name: "lgqa-wa-mixed-two.jpg",
    type: "image/jpeg",
    text: `image bytes ${rawSecrets.openai}`
  });
  const pdfFile = createReadableTextFile({
    name: "lgqa-wa-mixed-three.pdf",
    type: "application/pdf",
    text: `OPENAI_API_KEY=${rawSecrets.openai}`
  });
  const docxFile = createReadableTextFile({
    name: "lgqa-wa-mixed-four.docx",
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    text: `GITHUB_TOKEN=${rawSecrets.github}`
  });
  const xlsxFile = createReadableTextFile({
    name: "lgqa-wa-mixed-five.xlsx",
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    text: `DATABASE_URL=postgres://admin:${rawSecrets.password}@db.example.com:5432/customerdb`
  });
  const files = [textFile, imageFile, pdfFile, docxFile, xlsxFile];
  const pipelineOutputs = {
    [imageFile.name]: { name: "lgqa-wa-mixed-two.redacted.png", type: "image/png", text: "OPENAI_API_KEY=[PWM_2]" },
    [pdfFile.name]: { name: "lgqa-wa-mixed-three.redacted.pdf", type: "application/pdf", text: "OPENAI_API_KEY=[PWM_3]" },
    [docxFile.name]: { name: "lgqa-wa-mixed-four.redacted.docx", type: docxFile.type, text: "GITHUB_TOKEN=[PWM_4]" },
    [xlsxFile.name]: { name: "lgqa-wa-mixed-five.redacted.xlsx", type: xlsxFile.type, text: "DATABASE_URL=postgres://admin:[PWM_5]@db.example.com:5432/customerdb" }
  };
  const sanitizedOutputs = {};
  const fileInput = createFileInput({ multiple: true });
  fileInput.files = files;
  let pipelineCalls = 0;
  const { maybeHandleFileInputChange, calls } = createHarness({
    location: { hostname: "web.whatsapp.com" },
    findComposer: () => null,
    canExtractForAdapterHandoff: (file) => file !== textFile,
    processFileForAdapterHandoff: async ({ file, context }) => {
      pipelineCalls += 1;
      assert.strictEqual(context, "file-input");
      assert.strictEqual(fileInput.files.length, 0, "raw WhatsApp multi-file input should be cleared before pipeline extraction");
      const output = pipelineOutputs[file.name];
      const sanitizedFile = {
        name: output.name,
        type: output.type,
        size: output.text.length,
        async text() {
          return output.text;
        }
      };
      sanitizedOutputs[file.name] = sanitizedFile;
      const isImage = output.type === "image/png";
      return {
        status: "ready",
        originalName: file.name,
        outputName: output.name,
        outputKind: isImage
          ? "redacted_image_file"
          : output.name.endsWith(".pdf")
            ? "redacted_pdf_file"
          : output.name.endsWith(".docx")
            ? "redacted_docx_file"
            : "redacted_xlsx_file",
        extractedKind: isImage
          ? "image_ocr"
          : output.name.endsWith(".pdf")
            ? "pdf"
          : output.name.endsWith(".docx")
            ? "docx"
            : "xlsx",
        sanitizedText: output.text,
        sanitizedFile,
        safeForUpload: true,
        fileOnlyUpload: isImage,
        skipTextFallback: true,
        metadata: { original: { type: file.type, size: file.size }, scan: { findingsCount: 1 } },
        fallbackReason: ""
      };
    },
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      assert.strictEqual(fileInput.files.length, 0, "raw WhatsApp multi-file input should be cleared before text extraction");
      const file = transfer.files[0];
      return {
        handled: true,
        ok: true,
        text: await file.text(),
        file: {
          name: file.name,
          extension: ".csv",
          type: file.type,
          sizeBytes: file.size
        }
      };
    },
    createSanitizedTextFile: (file, text) => {
      const sanitizedFile = {
        name: file.name,
        type: file.type,
        size: text.length,
        async text() {
          return text;
        }
      };
      calls.createdFiles.push({ file, text, sanitizedFile });
      sanitizedOutputs[file.name] = sanitizedFile;
      return sanitizedFile;
    }
  });

  const result = await maybeHandleFileInputChange(createEvent({ type: "change", target: fileInput }).event);

  assert.strictEqual(result.ok, true, "five mixed WhatsApp files should attach as a sanitized batch");
  assert.strictEqual(result.stage, "file");
  assert.strictEqual(calls.reads.length, 1);
  assert.strictEqual(pipelineCalls, 4);
  assert.strictEqual(fileInput.files.length, 5);
  assert.deepStrictEqual(fileInput.files, files.map((file) => sanitizedOutputs[file.name]));
  assert.deepStrictEqual(fileInput.files.map((file) => file.name), [
    "lgqa-wa-mixed-one.csv",
    "lgqa-wa-mixed-two.redacted.png",
    "lgqa-wa-mixed-three.redacted.pdf",
    "lgqa-wa-mixed-four.redacted.docx",
    "lgqa-wa-mixed-five.redacted.xlsx"
  ]);
  assert.deepStrictEqual(fileInput.events, ["input", "change"]);
  for (const assigned of fileInput.files) {
    const text = await assigned.text();
    assert.strictEqual(text.includes(rawSecrets.openai), false);
    assert.strictEqual(text.includes(rawSecrets.github), false);
    assert.strictEqual(text.includes(rawSecrets.password), false);
    assert.strictEqual(text.includes(rawSecrets.text), false);
  }
  assert.strictEqual(calls.textFallbacks.length, 0, "WhatsApp must not insert extracted batch text");
}

function createWhatsAppDropTarget() {
  return {
    nodeType: 1,
    tagName: "DIV",
    events: [],
    eventObjects: [],
    dispatchEvent(event) {
      this.events.push(event.type);
      this.eventObjects.push(event);
      return true;
    }
  };
}

async function testWhatsAppSingleContentFileDropRoutesToSanitizedHandoff() {
  const cases = [
    {
      raw: createReadableTextFile({
        name: "lgqa-wa-drop-image.jpg",
        type: "image/jpeg",
        text: "image bytes sk-proj-WADropImageShouldNotUpload1234567890"
      }),
      sanitized: {
        name: "lgqa-wa-drop-image.redacted.png",
        type: "image/png",
        text: "image bytes [PWM_1]"
      },
      outputKind: "redacted_image_file",
      extractedKind: "image_ocr",
      fileOnlyUpload: true
    },
    {
      raw: createReadableTextFile({
        name: "lgqa-wa-drop-pdf.pdf",
        type: "application/pdf",
        text: "PDF OPENAI_API_KEY=LeakGuardFileApiKey1234567890"
      }),
      sanitized: {
        name: "lgqa-wa-drop-pdf.redacted.pdf",
        type: "application/pdf",
        text: "PDF OPENAI_API_KEY=[PWM_1]"
      },
      outputKind: "redacted_pdf_file",
      extractedKind: "pdf"
    },
    {
      raw: createReadableTextFile({
        name: "lgqa-wa-drop-docx.docx",
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        text: "DOCX OPENAI_API_KEY=LeakGuardFileApiKey1234567890"
      }),
      sanitized: {
        name: "lgqa-wa-drop-docx.redacted.docx",
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        text: "DOCX OPENAI_API_KEY=[PWM_1]"
      },
      outputKind: "redacted_docx_file",
      extractedKind: "docx"
    },
    {
      raw: createReadableTextFile({
        name: "lgqa-wa-drop-xlsx.xlsx",
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        text: "XLSX OPENAI_API_KEY=LeakGuardFileApiKey1234567890"
      }),
      sanitized: {
        name: "lgqa-wa-drop-xlsx.redacted.xlsx",
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        text: "XLSX OPENAI_API_KEY=[PWM_1]"
      },
      outputKind: "redacted_xlsx_file",
      extractedKind: "xlsx"
    }
  ];

  for (const testCase of cases) {
    const target = createWhatsAppDropTarget();
    const resolvedInput = createFileInput({ multiple: true });
    const { raw } = testCase;
    const sanitizedFile = {
      name: testCase.sanitized.name,
      type: testCase.sanitized.type,
      size: testCase.sanitized.text.length,
      async text() {
        return testCase.sanitized.text;
      }
    };
    let pipelineCalls = 0;
    const { maybeHandleDrop, calls } = createHarness({
      location: { hostname: "web.whatsapp.com" },
      findComposer: () => null,
      canExtractForAdapterHandoff: (file) => file === raw,
      processFileForAdapterHandoff: async ({ file, context }) => {
        pipelineCalls += 1;
        assert.strictEqual(file, raw);
        assert.strictEqual(context, "drop");
        return {
          status: "ready",
          originalName: raw.name,
          outputName: sanitizedFile.name,
          outputKind: testCase.outputKind,
          extractedKind: testCase.extractedKind,
          sanitizedText: testCase.sanitized.text,
          sanitizedFile,
          sanitizedImageFile: testCase.fileOnlyUpload ? sanitizedFile : undefined,
          metadata: { scan: { findingsCount: 1 } },
          warnings: [],
          safeForUpload: true,
          fileOnlyUpload: testCase.fileOnlyUpload === true,
          skipTextFallback: true,
          fallbackReason: ""
        };
      },
      resolveFileInputForHandoff: () => resolvedInput,
      readLocalTextFileFromDataTransfer: async () => {
        throw new Error(`${raw.name} WhatsApp content drop must use the extraction pipeline`);
      }
    });
    const { event } = createEvent({
      dataTransfer: createDataTransfer({ files: [raw] }),
      target
    });

    await maybeHandleDrop(event);

    assert.strictEqual(event.defaultPrevented, true, `${raw.name} raw drop should be consumed`);
    assert.strictEqual(pipelineCalls, 1, `${raw.name} should use the extraction pipeline`);
    assert.strictEqual(calls.redactions.length, 0, `${raw.name} pipeline output should not be double-redacted`);
    assert.strictEqual(calls.createdFiles.length, 0, `${raw.name} pipeline output should not be rebuilt as text`);
    assert.deepStrictEqual(target.events, [], `${raw.name} should not rely on synthetic WhatsApp drop replay`);
    assert.deepStrictEqual(resolvedInput.events, ["input", "change"]);
    assert.strictEqual(resolvedInput.files.length, 1);
    assert.strictEqual(resolvedInput.files[0], sanitizedFile);
    assert.notStrictEqual(resolvedInput.files[0], raw);
    assert.strictEqual(calls.textFallbacks.length, 0, `${raw.name} must not insert extracted text into WhatsApp`);
    assert.strictEqual(calls.modals.some(([title]) => title === "WhatsApp file upload blocked"), false);
    const assignedText = await resolvedInput.files[0].text();
    assert.strictEqual(assignedText.includes("LeakGuardFileApiKey1234567890"), false);
    assert.strictEqual(assignedText.includes("sk-proj-WADropImageShouldNotUpload"), false);
  }
}

async function testWhatsAppSingleTextDocumentDropRoutesToSanitizedHandoff() {
  const rawSecret = "LeakGuardFileApiKey1234567890";
  const rawFile = createReadableTextFile({
    name: "lgqa-wa-drop-doc.yaml",
    type: "text/yaml",
    text: `OPENAI_API_KEY=${rawSecret}\nDROP=true`
  });
  const target = createWhatsAppDropTarget();
  const resolvedInput = createFileInput({ multiple: true });
  const { maybeHandleDrop, calls } = createHarness({
    location: { hostname: "web.whatsapp.com" },
    findComposer: () => null,
    resolveFileInputForHandoff: () => resolvedInput,
    createSanitizedTextFile: (file, text) => {
      const sanitizedFile = {
        name: file.name,
        type: file.type,
        size: text.length,
        async text() {
          return text;
        }
      };
      calls.createdFiles.push({ file, text, sanitizedFile });
      return sanitizedFile;
    }
  });
  const { event } = createEvent({
    dataTransfer: createDataTransfer({ files: [rawFile] }),
    target
  });

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.reads.length, 1);
  assert.strictEqual(calls.redactions.length, 1);
  assert.strictEqual(calls.createdFiles.length, 1);
  assert.deepStrictEqual(target.events, [], "WhatsApp single-file drops should not rely on synthetic drop replay");
  assert.deepStrictEqual(resolvedInput.events, ["input", "change"]);
  assert.strictEqual(resolvedInput.files[0], calls.createdFiles[0].sanitizedFile);
  assert.notStrictEqual(resolvedInput.files[0], rawFile);
  assert.strictEqual(calls.textFallbacks.length, 0, "WhatsApp must not insert dropped document text");
  assert.strictEqual(calls.modals.some(([title]) => title === "WhatsApp file upload blocked"), false);
  const assignedText = await resolvedInput.files[0].text();
  assert.strictEqual(assignedText.includes(rawSecret), false);
  assert.ok(assignedText.includes("[PWM_1]"));
  assert.strictEqual(calls.modals.flat().join("\n").includes(rawSecret), false);
}

async function testWhatsAppBasenameTextDocumentDropsRouteToSanitizedBatch() {
  const rawSecret = "LeakGuardFileApiKey1234567890";
  const files = [
    createReadableTextFile({ name: "Dockerfile", type: "text/plain", text: `ENV TOKEN=${rawSecret}` }),
    createReadableTextFile({ name: "Makefile", type: "text/plain", text: `deploy:\n\tTOKEN=${rawSecret}` })
  ];
  const target = createWhatsAppDropTarget();
  const resolvedInput = createFileInput({ multiple: true });
  const { maybeHandleDrop, calls } = createHarness({
    location: { hostname: "web.whatsapp.com" },
    findComposer: () => null,
    resolveFileInputForHandoff: () => resolvedInput,
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      const file = transfer.files[0];
      return {
        handled: true,
        ok: true,
        text: await file.text(),
        file: {
          name: file.name,
          extension: "",
          type: file.type,
          sizeBytes: file.size
        }
      };
    },
    createSanitizedTextFile: (file, text) => {
      const sanitizedFile = {
        name: file.name,
        type: file.type,
        size: text.length,
        async text() {
          return text;
        }
      };
      calls.createdFiles.push({ file, text, sanitizedFile });
      return sanitizedFile;
    }
  });

  const result = await maybeHandleDrop(
    createEvent({
      dataTransfer: createDataTransfer({ files }),
      target
    }).event
  );

  assert.strictEqual(result.ok, true, "Dockerfile and Makefile drops should attach as a sanitized batch");
  assert.strictEqual(calls.reads.length, 2);
  assert.strictEqual(calls.createdFiles.length, 2);
  assert.deepStrictEqual(target.events, [], "WhatsApp multi-file drops should not rely on synthetic drop replay");
  assert.deepStrictEqual(resolvedInput.files, calls.createdFiles.map((entry) => entry.sanitizedFile));
  assert.deepStrictEqual(resolvedInput.files.map((file) => file.name), ["Dockerfile", "Makefile"]);
  assert.deepStrictEqual(resolvedInput.events, ["input", "change"]);
  assert.strictEqual(resolvedInput.files.some((file) => files.includes(file)), false);
  assert.strictEqual(calls.textFallbacks.length, 0);
  assert.strictEqual(calls.modals.some(([title]) => title === "WhatsApp file upload blocked"), false);
  for (const assigned of resolvedInput.files) {
    const text = await assigned.text();
    assert.strictEqual(text.includes(rawSecret), false);
    assert.ok(text.includes("[PWM_1]"));
  }
  assert.strictEqual(calls.modals.flat().join("\n").includes(rawSecret), false);
}

async function testWhatsAppTenTextDocumentDropsRouteToSanitizedBatch() {
  const rawSecret = "LeakGuardTenDropApiKey1234567890";
  const files = Array.from({ length: 10 }, (_, index) =>
    createReadableTextFile({
      name: `lgqa-wa-drop-ten-${index + 1}.env`,
      type: "text/plain",
      text: `OPENAI_API_KEY=${rawSecret}\nINDEX=${index + 1}`
    })
  );
  const target = createWhatsAppDropTarget();
  const resolvedInput = createFileInput({ multiple: true });
  const { maybeHandleDrop, calls } = createHarness({
    location: { hostname: "web.whatsapp.com" },
    findComposer: () => null,
    resolveFileInputForHandoff: () => resolvedInput,
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      const file = transfer.files[0];
      return {
        handled: true,
        ok: true,
        text: await file.text(),
        file: {
          name: file.name,
          extension: ".env",
          type: file.type,
          sizeBytes: file.size
        }
      };
    },
    createSanitizedTextFile: (file, text) => {
      const sanitizedFile = {
        name: file.name,
        type: file.type,
        size: text.length,
        async text() {
          return text;
        }
      };
      calls.createdFiles.push({ file, text, sanitizedFile });
      return sanitizedFile;
    }
  });

  const result = await maybeHandleDrop(createEvent({ dataTransfer: createDataTransfer({ files }), target }).event);

  assert.strictEqual(result.ok, true, "10 small WhatsApp text document drops should attach as a sanitized batch");
  assert.strictEqual(calls.reads.length, 10);
  assert.strictEqual(calls.redactions.length, 10);
  assert.strictEqual(calls.createdFiles.length, 10);
  assert.deepStrictEqual(target.events, [], "WhatsApp 10-file drops should not rely on synthetic drop replay");
  assert.deepStrictEqual(resolvedInput.files, calls.createdFiles.map((entry) => entry.sanitizedFile));
  assert.deepStrictEqual(resolvedInput.files.map((file) => file.name), files.map((file) => file.name));
  assert.deepStrictEqual(resolvedInput.events, ["input", "change"]);
  assert.strictEqual(resolvedInput.files.some((file) => files.includes(file)), false);
  for (const assigned of resolvedInput.files) {
    const text = await assigned.text();
    assert.strictEqual(text.includes(rawSecret), false);
    assert.ok(text.includes("[PWM_1]"));
  }
  assert.strictEqual(calls.textFallbacks.length, 0, "WhatsApp must not insert 10 dropped documents as text");
  assert.strictEqual(calls.modals.flat().join("\n").includes(rawSecret), false);
}

async function testWhatsAppFiveMixedSupportedDropPreservesSanitizedOrder() {
  const rawSecrets = {
    openai: "sk-proj-LGQAFakeOpenAIKey1234567890",
    github: "ghp_LGQAFakeGithubToken1234567890",
    password: "FakePass123",
    text: "LeakGuardFileApiKey1234567890"
  };
  const files = [
    createReadableTextFile({ name: "lgqa-wa-drop-mixed-one.csv", type: "text/csv", text: `key,${rawSecrets.text}` }),
    createReadableTextFile({ name: "lgqa-wa-drop-mixed-two.png", type: "image/png", text: `image ${rawSecrets.openai}` }),
    createReadableTextFile({ name: "lgqa-wa-drop-mixed-three.pdf", type: "application/pdf", text: `PDF ${rawSecrets.github}` }),
    createReadableTextFile({
      name: "lgqa-wa-drop-mixed-four.docx",
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      text: `DOCX ${rawSecrets.openai}`
    }),
    createReadableTextFile({
      name: "lgqa-wa-drop-mixed-five.xlsx",
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      text: `DATABASE_URL=postgres://admin:${rawSecrets.password}@db.example.com:5432/customerdb`
    })
  ];
  const pipelineOutputs = {
    "lgqa-wa-drop-mixed-two.png": { name: "lgqa-wa-drop-mixed-two.redacted.png", type: "image/png", text: "image [PWM_2]" },
    "lgqa-wa-drop-mixed-three.pdf": { name: "lgqa-wa-drop-mixed-three.redacted.pdf", type: "application/pdf", text: "PDF [PWM_3]" },
    "lgqa-wa-drop-mixed-four.docx": {
      name: "lgqa-wa-drop-mixed-four.redacted.docx",
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      text: "DOCX [PWM_4]"
    },
    "lgqa-wa-drop-mixed-five.xlsx": {
      name: "lgqa-wa-drop-mixed-five.redacted.xlsx",
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      text: "DATABASE_URL=postgres://admin:[PWM_5]@db.example.com:5432/customerdb"
    }
  };
  const sanitizedOutputs = {};
  const target = createWhatsAppDropTarget();
  const resolvedInput = createFileInput({ multiple: true });
  let pipelineCalls = 0;
  const { maybeHandleDrop, calls } = createHarness({
    location: { hostname: "web.whatsapp.com" },
    findComposer: () => null,
    resolveFileInputForHandoff: () => resolvedInput,
    canExtractForAdapterHandoff: (file) => file !== files[0],
    processFileForAdapterHandoff: async ({ file, context }) => {
      pipelineCalls += 1;
      assert.strictEqual(context, "drop");
      const output = pipelineOutputs[file.name];
      const sanitizedFile = {
        name: output.name,
        type: output.type,
        size: output.text.length,
        async text() {
          return output.text;
        }
      };
      sanitizedOutputs[file.name] = sanitizedFile;
      return {
        status: "ready",
        originalName: file.name,
        outputName: output.name,
        outputKind: output.name.endsWith(".png")
          ? "redacted_image_file"
          : output.name.endsWith(".pdf")
            ? "redacted_pdf_file"
          : output.name.endsWith(".docx")
            ? "redacted_docx_file"
            : "redacted_xlsx_file",
        extractedKind: output.name.endsWith(".png")
          ? "image_ocr"
          : output.name.endsWith(".pdf")
            ? "pdf"
          : output.name.endsWith(".docx")
            ? "docx"
            : "xlsx",
        sanitizedText: output.text,
        sanitizedFile,
        safeForUpload: true,
        fileOnlyUpload: output.type === "image/png",
        skipTextFallback: true,
        metadata: { scan: { findingsCount: 1 } },
        fallbackReason: ""
      };
    },
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      const file = transfer.files[0];
      return {
        handled: true,
        ok: true,
        text: await file.text(),
        file: {
          name: file.name,
          extension: ".csv",
          type: file.type,
          sizeBytes: file.size
        }
      };
    },
    createSanitizedTextFile: (file, text) => {
      const sanitizedFile = {
        name: file.name,
        type: file.type,
        size: text.length,
        async text() {
          return text;
        }
      };
      calls.createdFiles.push({ file, text, sanitizedFile });
      sanitizedOutputs[file.name] = sanitizedFile;
      return sanitizedFile;
    }
  });

  const result = await maybeHandleDrop(
    createEvent({
      dataTransfer: createDataTransfer({ files }),
      target
    }).event
  );

  assert.strictEqual(result.ok, true, "five mixed WhatsApp drops should attach as a sanitized batch");
  assert.strictEqual(calls.reads.length, 1);
  assert.strictEqual(pipelineCalls, 4);
  assert.deepStrictEqual(target.events, [], "WhatsApp mixed drops should not rely on synthetic drop replay");
  assert.deepStrictEqual(resolvedInput.files, files.map((file) => sanitizedOutputs[file.name]));
  assert.deepStrictEqual(resolvedInput.files.map((file) => file.name), [
    "lgqa-wa-drop-mixed-one.csv",
    "lgqa-wa-drop-mixed-two.redacted.png",
    "lgqa-wa-drop-mixed-three.redacted.pdf",
    "lgqa-wa-drop-mixed-four.redacted.docx",
    "lgqa-wa-drop-mixed-five.redacted.xlsx"
  ]);
  assert.deepStrictEqual(resolvedInput.events, ["input", "change"]);
  for (const assigned of resolvedInput.files) {
    assert.strictEqual(files.includes(assigned), false);
    const text = await assigned.text();
    assert.strictEqual(Object.values(rawSecrets).some((raw) => text.includes(raw)), false);
  }
  assert.strictEqual(calls.textFallbacks.length, 0);
  assert.strictEqual(calls.modals.some(([title]) => title === "WhatsApp file upload blocked"), false);
}

async function testWhatsAppOverLimitSmallFileDropBlocksBeforeRead() {
  const files = Array.from({ length: 21 }, (_, index) =>
    createReadableTextFile({
      name: `lgqa-wa-drop-over-limit-${index + 1}.env`,
      type: "text/plain",
      text: "OPENAI_API_KEY=LeakGuardOverLimitFileApiKey1234567890"
    })
  );
  const target = createWhatsAppDropTarget();
  const { maybeHandleDrop, calls } = createHarness({
    location: { hostname: "web.whatsapp.com" },
    findComposer: () => null,
    readLocalTextFileFromDataTransfer: async () => {
      throw new Error("over-limit WhatsApp drops must be blocked before reading");
    },
    processFileForAdapterHandoff: async () => {
      throw new Error("over-limit WhatsApp drops must be blocked before pipeline processing");
    }
  });
  const { event } = createEvent({ dataTransfer: createDataTransfer({ files }), target });

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.reads.length, 0);
  assert.strictEqual(calls.createdFiles.length, 0);
  assert.deepStrictEqual(target.events, []);
  assert.ok(calls.modals.some(([title]) => title === "Raw file upload blocked"));
}

async function testWhatsAppSixLargeFileDropBlocksBeforeRead() {
  const files = Array.from({ length: 6 }, (_, index) =>
    createReadableTextFile({
      name: `lgqa-wa-drop-large-${index + 1}.env`,
      type: "text/plain",
      text: buildSizedText({ minBytes: (4 * 1024 * 1024) + 1024, rawSecret: "LeakGuardLargeDropApiKey1234567890" })
    })
  );
  const target = createWhatsAppDropTarget();
  const { maybeHandleDrop, calls } = createHarness({
    location: { hostname: "web.whatsapp.com" },
    findComposer: () => null,
    readLocalTextFileFromDataTransfer: async () => {
      throw new Error("6 large WhatsApp drops must be blocked before reading");
    },
    processFileForAdapterHandoff: async () => {
      throw new Error("6 large WhatsApp drops must be blocked before pipeline processing");
    }
  });
  const { event } = createEvent({ dataTransfer: createDataTransfer({ files }), target });

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.reads.length, 0);
  assert.strictEqual(calls.createdFiles.length, 0);
  assert.deepStrictEqual(target.events, []);
  assert.ok(calls.modals.some(([title]) => title === "Raw file upload blocked"));
}

async function testWhatsAppUnsupportedFileDropBatchBlocksWholeBatchBeforeRead() {
  const files = [
    createReadableTextFile({ name: "lgqa-wa-drop-supported.env", type: "text/plain", text: "A=LeakGuardFileApiKey1234567890" }),
    createReadableTextFile({ name: "lgqa-wa-drop-unsupported.gif", type: "image/gif", text: "raw image" })
  ];
  const target = createWhatsAppDropTarget();
  const { maybeHandleDrop, calls } = createHarness({
    location: { hostname: "web.whatsapp.com" },
    findComposer: () => null,
    readLocalTextFileFromDataTransfer: async () => {
      throw new Error("unsupported WhatsApp drops must be blocked before reading");
    },
    processFileForAdapterHandoff: async () => {
      throw new Error("unsupported WhatsApp drops must be blocked before pipeline processing");
    }
  });
  const { event } = createEvent({ dataTransfer: createDataTransfer({ files }), target });

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.reads.length, 0);
  assert.strictEqual(calls.createdFiles.length, 0);
  assert.deepStrictEqual(target.events, []);
  assert.ok(calls.modals.some(([title]) => title === "WhatsApp file upload blocked" || title === "Raw file upload blocked"));
}

async function testWhatsAppFailedFileDropBatchBlocksWholeBatchWithoutPartialDrop() {
  const files = [
    createReadableTextFile({ name: "lgqa-wa-drop-fail-one.env", type: "text/plain", text: "A=LeakGuardFileApiKey1234567890" }),
    createReadableTextFile({ name: "lgqa-wa-drop-fail-two.log", type: "text/plain", text: "B=LeakGuardFileApiKey1234567890" }),
    createReadableTextFile({ name: "lgqa-wa-drop-fail-three.csv", type: "text/csv", text: "C,LeakGuardFileApiKey1234567890" })
  ];
  const target = createWhatsAppDropTarget();
  const { maybeHandleDrop, calls } = createHarness({
    location: { hostname: "web.whatsapp.com" },
    findComposer: () => null,
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      const file = transfer.files[0];
      if (file.name.endsWith("two.log")) {
        return {
          handled: true,
          ok: false,
          code: "file_scan_failed",
          message: "LeakGuard blocked one raw file because local scanning failed.",
          file: { name: file.name, extension: ".log", type: file.type, sizeBytes: file.size }
        };
      }
      return {
        handled: true,
        ok: true,
        text: await file.text(),
        file: { name: file.name, extension: file.name.slice(file.name.lastIndexOf(".")), type: file.type, sizeBytes: file.size }
      };
    },
    createSanitizedTextFile: (file, text) => {
      const sanitizedFile = {
        name: file.name,
        type: file.type,
        size: text.length,
        async text() {
          return text;
        }
      };
      calls.createdFiles.push({ file, text, sanitizedFile });
      return sanitizedFile;
    }
  });
  const { event } = createEvent({ dataTransfer: createDataTransfer({ files }), target });

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.reads.length, 3);
  assert.strictEqual(calls.createdFiles.length, 2);
  assert.deepStrictEqual(target.events, [], "WhatsApp must not receive partial sanitized handoff");
  assert.ok(calls.modals.some(([title]) => title === "Raw file upload blocked"));
}

async function testWhatsAppOverLimitSmallFileAttachBlocksBeforeRead() {
  const rawSecret = "LeakGuardOverLimitFileApiKey1234567890";
  const fileInput = createFileInput({ multiple: true });
  fileInput.files = Array.from({ length: 21 }, (_, index) =>
    createReadableTextFile({
      name: `lgqa-wa-over-limit-${index + 1}-${rawSecret}.env`,
      type: "text/plain",
      text: `OPENAI_API_KEY=${rawSecret}`
    })
  );
  const { maybeHandleFileInputChange, calls } = createHarness({
    location: { hostname: "web.whatsapp.com" },
    findComposer: () => null,
    readLocalTextFileFromDataTransfer: async () => {
      throw new Error("over-limit WhatsApp file batches must be blocked before reading");
    },
    processFileForAdapterHandoff: async () => {
      throw new Error("over-limit WhatsApp file batches must be blocked before pipeline processing");
    }
  });

  const result = await maybeHandleFileInputChange(createEvent({ type: "change", target: fileInput }).event);

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, "small_file_count_exceeded");
  assert.strictEqual(calls.reads.length, 0);
  assert.strictEqual(calls.createdFiles.length, 0);
  assert.strictEqual(fileInput.files.length, 0);
  const modal = calls.modals.find(([title]) => title === "Raw file upload blocked");
  assert.ok(modal);
  const message = String(modal[1]);
  assert.match(message, /blocked before reading or processing/);
  assert.match(message, /No raw files were uploaded/);
  assert.strictEqual(message.includes(rawSecret), false);
  assert.strictEqual(message.includes("lgqa-wa-over-limit-1"), false);
}

async function testWhatsAppSixLargeFileAttachBlocksBeforeRead() {
  const rawSecret = "LeakGuardSixLargeFileApiKey1234567890";
  const fileInput = createFileInput({ multiple: true });
  fileInput.files = Array.from({ length: 6 }, (_, index) =>
    createReadableTextFile({
      name: `lgqa-wa-large-${index + 1}-${rawSecret}.env`,
      type: "text/plain",
      text: buildSizedText({ minBytes: (4 * 1024 * 1024) + 1024, rawSecret })
    })
  );
  const { maybeHandleFileInputChange, calls } = createHarness({
    location: { hostname: "web.whatsapp.com" },
    findComposer: () => null,
    readLocalTextFileFromDataTransfer: async () => {
      throw new Error("6 large WhatsApp file batches must be blocked before reading");
    },
    processFileForAdapterHandoff: async () => {
      throw new Error("6 large WhatsApp file batches must be blocked before pipeline processing");
    }
  });

  const result = await maybeHandleFileInputChange(createEvent({ type: "change", target: fileInput }).event);

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, "large_file_count_exceeded");
  assert.strictEqual(calls.reads.length, 0);
  assert.strictEqual(calls.createdFiles.length, 0);
  assert.strictEqual(fileInput.files.length, 0);
  const modal = calls.modals.find(([title]) => title === "Raw file upload blocked");
  assert.ok(modal);
  const message = String(modal[1]);
  assert.match(message, /blocked before reading or processing/);
  assert.match(message, /No raw files were uploaded/);
  assert.strictEqual(message.includes(rawSecret), false);
  assert.strictEqual(message.includes("lgqa-wa-large-1"), false);
}

async function testWhatsAppUnsupportedMultiFileAttachBlocksWholeBatchBeforeRead() {
  const rawSecret = "sk-proj-WhatsAppUnsupportedBatchSecret1234567890";
  const fileInput = createFileInput({ multiple: true });
  fileInput.files = [
    createReadableTextFile({ name: "lgqa-wa-supported.env", type: "text/plain", text: `OPENAI_API_KEY=${rawSecret}` }),
    createReadableTextFile({ name: `lgqa-wa-unsupported-${rawSecret}.gif`, type: "image/gif", text: rawSecret })
  ];
  const { maybeHandleFileInputChange, calls } = createHarness({
    location: { hostname: "web.whatsapp.com" },
    findComposer: () => null,
    readLocalTextFileFromDataTransfer: async () => {
      throw new Error("unsupported WhatsApp multi-file batches must be blocked before reading");
    },
    processFileForAdapterHandoff: async () => {
      throw new Error("unsupported WhatsApp multi-file batches must be blocked before pipeline processing");
    }
  });

  const result = await maybeHandleFileInputChange(createEvent({ type: "change", target: fileInput }).event);

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, "whatsapp_file_attachments_unsupported");
  assert.strictEqual(calls.reads.length, 0);
  assert.strictEqual(calls.createdFiles.length, 0);
  assert.strictEqual(fileInput.files.length, 0);
  const modal = calls.modals.find(([title]) => title === "WhatsApp file upload blocked" || title === "Raw file upload blocked");
  assert.ok(modal);
  assert.strictEqual(String(modal[1]).includes(rawSecret), false);
  assert.strictEqual(String(modal[1]).includes("lgqa-wa-unsupported"), false);
}

async function testWhatsAppMultiFileAttachFailureBlocksWholeBatchWithoutPartialAssignment() {
  const rawSecret = "LeakGuardFileApiKey1234567890";
  const fileInput = createFileInput({ multiple: true });
  const files = [
    createReadableTextFile({ name: "lgqa-wa-all-one.env", type: "text/plain", text: `A=${rawSecret}` }),
    createReadableTextFile({ name: "lgqa-wa-all-two.log", type: "text/plain", text: `B=${rawSecret}` }),
    createReadableTextFile({ name: "lgqa-wa-all-three.csv", type: "text/csv", text: `C,${rawSecret}` })
  ];
  fileInput.files = files;
  const { maybeHandleFileInputChange, calls } = createHarness({
    location: { hostname: "web.whatsapp.com" },
    findComposer: () => null,
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      assert.strictEqual(fileInput.files.length, 0, "raw WhatsApp multi-file input should be cleared before per-file read");
      const file = transfer.files[0];
      if (file.name.endsWith("two.log")) {
        return {
          handled: true,
          ok: false,
          code: "file_read_failed",
          message: `raw failure ${file.name} ${rawSecret}`
        };
      }
      return {
        handled: true,
        ok: true,
        text: await file.text(),
        file: {
          name: file.name,
          extension: file.name.slice(file.name.lastIndexOf(".")),
          type: file.type,
          sizeBytes: file.size
        }
      };
    },
    createSanitizedTextFile: (file, text) => {
      const sanitizedFile = {
        name: file.name,
        type: file.type,
        size: text.length,
        async text() {
          return text;
        }
      };
      calls.createdFiles.push({ file, text, sanitizedFile });
      return sanitizedFile;
    }
  });

  const result = await maybeHandleFileInputChange(createEvent({ type: "change", target: fileInput }).event);

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, "whatsapp_multi_file_batch_failed");
  assert.strictEqual(calls.reads.length, 3);
  assert.strictEqual(calls.createdFiles.length, 2);
  assert.strictEqual(fileInput.files.length, 0, "WhatsApp must not assign partial sanitized batches");
  assert.deepStrictEqual(fileInput.events, []);
  const modal = calls.modals.find(([title]) => title === "Raw file upload blocked");
  assert.ok(modal);
  const message = String(modal[1]);
  assert.match(message, /blocked 3 file\(s\)/);
  assert.match(message, /No raw files were uploaded/);
  assert.strictEqual(message.includes(rawSecret), false);
  assert.strictEqual(message.includes("lgqa-wa-all-two.log"), false);
}

async function testWhatsAppMultiFileAttachVerifierRejectsAssignmentMismatch() {
  const rawSecret = "LeakGuardFileApiKey1234567890";
  const fileInput = createFileInput({ multiple: true });
  let storedFiles = [];
  Object.defineProperty(fileInput, "files", {
    get() {
      return storedFiles;
    },
    set(value) {
      const next = Array.from(value || []);
      if (next.length === 2 && next.every((file) => !files.includes(file))) {
        storedFiles = [next[1], next[0]];
      } else {
        storedFiles = next;
      }
    },
    configurable: true
  });
  const files = [
    createReadableTextFile({ name: "lgqa-wa-mismatch-one.env", type: "text/plain", text: `A=${rawSecret}` }),
    createReadableTextFile({ name: "lgqa-wa-mismatch-two.env", type: "text/plain", text: `B=${rawSecret}` })
  ];
  fileInput.files = files;
  const { maybeHandleFileInputChange, calls } = createHarness({
    location: { hostname: "web.whatsapp.com" },
    findComposer: () => null,
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      const file = transfer.files[0];
      return {
        handled: true,
        ok: true,
        text: await file.text(),
        file: {
          name: file.name,
          extension: ".env",
          type: file.type,
          sizeBytes: file.size
        }
      };
    },
    createSanitizedTextFile: (file, text) => {
      const sanitizedFile = {
        name: file.name,
        type: file.type,
        size: text.length,
        async text() {
          return text;
        }
      };
      calls.createdFiles.push({ file, text, sanitizedFile });
      return sanitizedFile;
    }
  });

  const result = await maybeHandleFileInputChange(createEvent({ type: "change", target: fileInput }).event);

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, "multi_file_sanitized_handoff_failed");
  assert.strictEqual(fileInput.files.length, 0, "uncertain WhatsApp batch assignment must be cleared");
  assert.deepStrictEqual(fileInput.events, ["input", "change"]);
  const modal = calls.modals.find(([title]) => title === "Raw file upload blocked");
  assert.ok(modal);
  assert.strictEqual(String(modal[1]).includes(rawSecret), false);
}

async function testWhatsAppTextDocumentAttachFailuresBlockRawDocument() {
  const cases = [
    {
      label: "extraction failure",
      createOverrides: (fileInput) => ({
        readLocalTextFileFromDataTransfer: async () => {
          assert.strictEqual(fileInput.files.length, 0, "raw input should be cleared before extraction failure");
          return {
            handled: true,
            ok: false,
            code: "file_read_failed",
            title: "Raw file blocked",
            message: "LeakGuard blocked raw file upload because local scanning failed."
          };
        }
      }),
      expectedReason: "file_read_failed"
    },
    {
      label: "redaction failure",
      createOverrides: () => ({
        requestRedaction: async () => {
          throw new Error("redaction failed");
        }
      }),
      expectedReason: "local_file_sanitization_failed"
    },
    {
      label: "rebuild failure",
      createOverrides: () => ({
        createSanitizedTextFile: () => null
      }),
      expectedReason: "local_file_sanitization_failed"
    },
    {
      label: "handoff failure",
      createOverrides: () => ({
        handOffSanitizedLocalFile: () => false
      }),
      expectedReason: "sanitized_file_handoff_failed"
    }
  ];

  for (const testCase of cases) {
    const unsafeName = `lgqa-wa-doc-sk-proj-UnsafeFileName1234567890abcdef-${testCase.label.replace(/\s+/g, "-")}.env`;
    const rawFile = createReadableTextFile({
      name: unsafeName,
      type: "text/plain",
      text: "OPENAI_API_KEY=LeakGuardFileApiKey1234567890"
    });
    const fileInput = createFileInput();
    fileInput.files = [rawFile];
    fileInput.value = `C:\\fakepath\\${unsafeName}`;
    const { maybeHandleFileInputChange, calls } = createHarness({
      location: { hostname: "web.whatsapp.com" },
      findComposer: () => null,
      ...testCase.createOverrides(fileInput)
    });

    const result = await maybeHandleFileInputChange(createEvent({ type: "change", target: fileInput }).event);

    assert.strictEqual(result.ok, false, `${testCase.label} should block`);
    assert.strictEqual(result.reason, testCase.expectedReason);
    assert.strictEqual(fileInput.files.length, 0, `${testCase.label} must leave no raw file assigned`);
    assert.strictEqual(calls.textFallbacks.length, 0, `${testCase.label} must not insert extracted text`);
    assert.strictEqual(JSON.stringify(calls.modals).includes(unsafeName), false);
    if (testCase.label !== "handoff failure") {
      assert.strictEqual(calls.handoffs.length, 0, `${testCase.label} must not attempt sanitized handoff`);
    }
  }
}

async function testWhatsAppPdfAttachFailuresBlockRawPdf() {
  const cases = [
    ["extraction failure", "pdf_extraction_failed"],
    ["encrypted PDF", "pdf_encrypted"],
    ["malformed PDF", "pdf_malformed"],
    ["image-only PDF", "pdf_no_extractable_text"],
    ["PDF rebuild failure", "pdf_redaction_failed"]
  ];

  for (const [label, fallbackReason] of cases) {
    const unsafeName = `lgqa-wa-pdf-sk-proj-UnsafeFileName1234567890abcdef-${label.replace(/\W+/g, "-")}.pdf`;
    const rawFile = createReadableTextFile({
      name: unsafeName,
      type: "application/pdf",
      text: "OPENAI_API_KEY=LeakGuardFileApiKey1234567890"
    });
    const fileInput = createFileInput();
    fileInput.files = [rawFile];
    fileInput.value = `C:\\fakepath\\${unsafeName}`;
    let pipelineCalls = 0;
    const { maybeHandleFileInputChange, calls } = createHarness({
      location: { hostname: "web.whatsapp.com" },
      findComposer: () => null,
      canExtractForAdapterHandoff: (file) => file === rawFile,
      processFileForAdapterHandoff: async () => {
        pipelineCalls += 1;
        assert.strictEqual(fileInput.files.length, 0, `${label} should clear raw input before PDF failure`);
        return {
          status: "blocked",
          originalName: rawFile.name,
          outputName: "",
          outputKind: "redacted_pdf_file",
          extractedKind: "pdf",
          sanitizedText: "",
          sanitizedFile: null,
          metadata: { original: { type: "application/pdf", size: rawFile.size } },
          warnings: [],
          safeForUpload: false,
          fallbackReason
        };
      },
      readLocalTextFileFromDataTransfer: async () => {
        throw new Error(`${label} must not fall back to text-file reading`);
      }
    });

    const result = await maybeHandleFileInputChange(createEvent({ type: "change", target: fileInput }).event);

    assert.strictEqual(result.ok, false, `${label} should block`);
    assert.strictEqual(result.reason, fallbackReason);
    assert.strictEqual(pipelineCalls, 1);
    assert.strictEqual(fileInput.files.length, 0, `${label} must leave no raw PDF assigned`);
    assert.strictEqual(calls.handoffs.length, 0, `${label} must not attempt sanitized handoff`);
    assert.strictEqual(calls.textFallbacks.length, 0, `${label} must not insert extracted PDF text`);
    assert.strictEqual(JSON.stringify(calls.modals).includes(unsafeName), false);
  }

  const rawFile = createReadableTextFile({
    name: "lgqa-wa-pdf-handoff-failure.pdf",
    type: "application/pdf",
    text: "OPENAI_API_KEY=LeakGuardFileApiKey1234567890"
  });
  const sanitizedPdf = {
    name: "lgqa-wa-pdf-handoff-failure.redacted.pdf",
    type: "application/pdf",
    size: 128
  };
  const fileInput = createFileInput();
  fileInput.files = [rawFile];
  const { maybeHandleFileInputChange, calls } = createHarness({
    location: { hostname: "web.whatsapp.com" },
    findComposer: () => null,
    canExtractForAdapterHandoff: (file) => file === rawFile,
    processFileForAdapterHandoff: async () => ({
      status: "ready",
      originalName: rawFile.name,
      outputName: sanitizedPdf.name,
      outputKind: "redacted_pdf_file",
      extractedKind: "pdf",
      sanitizedText: "OPENAI_API_KEY=[PWM_1]",
      sanitizedFile: sanitizedPdf,
      metadata: { original: { type: "application/pdf", size: rawFile.size }, scan: { findingsCount: 1 } },
      warnings: [],
      safeForUpload: true,
      fallbackReason: ""
    }),
    handOffSanitizedLocalFile: () => false
  });

  const result = await maybeHandleFileInputChange(createEvent({ type: "change", target: fileInput }).event);

  assert.strictEqual(result.ok, false, "sanitized PDF handoff failure should block");
  assert.strictEqual(result.reason, "sanitized_file_handoff_failed");
  assert.strictEqual(fileInput.files.length, 0);
  assert.strictEqual(calls.textFallbacks.length, 0, "handoff failure must not insert PDF text");
}

async function testWhatsAppDocxAttachFailuresBlockRawDocx() {
  const cases = [
    ["extraction failure", "docx_extraction_failed"],
    ["encrypted DOCX", "docx_encrypted"],
    ["malformed DOCX", "docx_malformed_zip"],
    ["DOCX rebuild failure", "docx_redaction_failed"]
  ];

  for (const [label, fallbackReason] of cases) {
    const unsafeName = `lgqa-wa-docx-sk-proj-UnsafeFileName1234567890abcdef-${label.replace(/\W+/g, "-")}.docx`;
    const rawFile = createReadableTextFile({
      name: unsafeName,
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      text: "OPENAI_API_KEY=LeakGuardFileApiKey1234567890"
    });
    const fileInput = createFileInput();
    fileInput.files = [rawFile];
    fileInput.value = `C:\\fakepath\\${unsafeName}`;
    let pipelineCalls = 0;
    const { maybeHandleFileInputChange, calls } = createHarness({
      location: { hostname: "web.whatsapp.com" },
      findComposer: () => null,
      canExtractForAdapterHandoff: (file) => file === rawFile,
      processFileForAdapterHandoff: async () => {
        pipelineCalls += 1;
        assert.strictEqual(fileInput.files.length, 0, `${label} should clear raw input before DOCX failure`);
        return {
          status: "blocked",
          originalName: rawFile.name,
          outputName: "",
          outputKind: "redacted_docx_file",
          extractedKind: "docx",
          sanitizedText: "",
          sanitizedFile: null,
          metadata: {
            original: {
              type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              size: rawFile.size
            }
          },
          warnings: [],
          safeForUpload: false,
          fallbackReason
        };
      },
      readLocalTextFileFromDataTransfer: async () => {
        throw new Error(`${label} must not fall back to text-file reading`);
      }
    });

    const result = await maybeHandleFileInputChange(createEvent({ type: "change", target: fileInput }).event);

    assert.strictEqual(result.ok, false, `${label} should block`);
    assert.strictEqual(result.reason, fallbackReason);
    assert.strictEqual(pipelineCalls, 1);
    assert.strictEqual(fileInput.files.length, 0, `${label} must leave no raw DOCX assigned`);
    assert.strictEqual(calls.handoffs.length, 0, `${label} must not attempt sanitized handoff`);
    assert.strictEqual(calls.textFallbacks.length, 0, `${label} must not insert extracted DOCX text`);
    assert.strictEqual(JSON.stringify(calls.modals).includes(unsafeName), false);
  }

  const rawFile = createReadableTextFile({
    name: "lgqa-wa-docx-handoff-failure.docx",
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    text: "OPENAI_API_KEY=LeakGuardFileApiKey1234567890"
  });
  const sanitizedDocx = {
    name: "lgqa-wa-docx-handoff-failure.redacted.docx",
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    size: 128
  };
  const fileInput = createFileInput();
  fileInput.files = [rawFile];
  const { maybeHandleFileInputChange, calls } = createHarness({
    location: { hostname: "web.whatsapp.com" },
    findComposer: () => null,
    canExtractForAdapterHandoff: (file) => file === rawFile,
    processFileForAdapterHandoff: async () => ({
      status: "ready",
      originalName: rawFile.name,
      outputName: sanitizedDocx.name,
      outputKind: "redacted_docx_file",
      extractedKind: "docx",
      sanitizedText: "OPENAI_API_KEY=[PWM_1]",
      sanitizedFile: sanitizedDocx,
      metadata: { original: { type: rawFile.type, size: rawFile.size }, scan: { findingsCount: 1 } },
      warnings: [],
      safeForUpload: true,
      fallbackReason: ""
    }),
    handOffSanitizedLocalFile: () => false
  });

  const result = await maybeHandleFileInputChange(createEvent({ type: "change", target: fileInput }).event);

  assert.strictEqual(result.ok, false, "sanitized DOCX handoff failure should block");
  assert.strictEqual(result.reason, "sanitized_file_handoff_failed");
  assert.strictEqual(fileInput.files.length, 0);
  assert.strictEqual(calls.textFallbacks.length, 0, "handoff failure must not insert DOCX text");
}

async function testWhatsAppXlsxAttachFailuresBlockRawXlsx() {
  const cases = [
    ["extraction failure", "xlsx_extraction_failed"],
    ["encrypted XLSX", "xlsx_encrypted"],
    ["malformed XLSX", "xlsx_malformed_zip"],
    ["unsupported XLSX", "xlsx_unsupported_compression"],
    ["XLSX rebuild failure", "xlsx_redaction_failed"]
  ];

  for (const [label, fallbackReason] of cases) {
    const unsafeName = `lgqa-wa-xlsx-sk-proj-UnsafeFileName1234567890abcdef-${label.replace(/\W+/g, "-")}.xlsx`;
    const rawFile = createReadableTextFile({
      name: unsafeName,
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      text: "OPENAI_API_KEY=LeakGuardFileApiKey1234567890"
    });
    const fileInput = createFileInput();
    fileInput.files = [rawFile];
    fileInput.value = `C:\\fakepath\\${unsafeName}`;
    let pipelineCalls = 0;
    const { maybeHandleFileInputChange, calls } = createHarness({
      location: { hostname: "web.whatsapp.com" },
      findComposer: () => null,
      canExtractForAdapterHandoff: (file) => file === rawFile,
      processFileForAdapterHandoff: async () => {
        pipelineCalls += 1;
        assert.strictEqual(fileInput.files.length, 0, `${label} should clear raw input before XLSX failure`);
        return {
          status: "blocked",
          originalName: rawFile.name,
          outputName: "",
          outputKind: "redacted_xlsx_file",
          extractedKind: "xlsx",
          sanitizedText: "",
          sanitizedFile: null,
          metadata: {
            original: {
              type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              size: rawFile.size
            }
          },
          warnings: [],
          safeForUpload: false,
          fallbackReason
        };
      },
      readLocalTextFileFromDataTransfer: async () => {
        throw new Error(`${label} must not fall back to text-file reading`);
      }
    });

    const result = await maybeHandleFileInputChange(createEvent({ type: "change", target: fileInput }).event);

    assert.strictEqual(result.ok, false, `${label} should block`);
    assert.strictEqual(result.reason, fallbackReason);
    assert.strictEqual(pipelineCalls, 1);
    assert.strictEqual(fileInput.files.length, 0, `${label} must leave no raw XLSX assigned`);
    assert.strictEqual(calls.handoffs.length, 0, `${label} must not attempt sanitized handoff`);
    assert.strictEqual(calls.textFallbacks.length, 0, `${label} must not insert extracted XLSX text`);
    assert.strictEqual(JSON.stringify(calls.modals).includes(unsafeName), false);
  }

  const rawFile = createReadableTextFile({
    name: "lgqa-wa-xlsx-handoff-failure.xlsx",
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    text: "OPENAI_API_KEY=LeakGuardFileApiKey1234567890"
  });
  const sanitizedXlsx = {
    name: "lgqa-wa-xlsx-handoff-failure.redacted.xlsx",
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    size: 128
  };
  const fileInput = createFileInput();
  fileInput.files = [rawFile];
  const { maybeHandleFileInputChange, calls } = createHarness({
    location: { hostname: "web.whatsapp.com" },
    findComposer: () => null,
    canExtractForAdapterHandoff: (file) => file === rawFile,
    processFileForAdapterHandoff: async () => ({
      status: "ready",
      originalName: rawFile.name,
      outputName: sanitizedXlsx.name,
      outputKind: "redacted_xlsx_file",
      extractedKind: "xlsx",
      sanitizedText: "OPENAI_API_KEY\n[PWM_1]",
      sanitizedFile: sanitizedXlsx,
      metadata: { original: { type: rawFile.type, size: rawFile.size }, scan: { findingsCount: 1 } },
      warnings: [],
      safeForUpload: true,
      fallbackReason: ""
    }),
    handOffSanitizedLocalFile: () => false
  });

  const result = await maybeHandleFileInputChange(createEvent({ type: "change", target: fileInput }).event);

  assert.strictEqual(result.ok, false, "sanitized XLSX handoff failure should block");
  assert.strictEqual(result.reason, "sanitized_file_handoff_failed");
  assert.strictEqual(fileInput.files.length, 0);
  assert.strictEqual(calls.textFallbacks.length, 0, "handoff failure must not insert XLSX text");
}

async function testWhatsAppSanitizedImageHandoffBypassesSafePlaceholderCaptionOnly() {
  const rawSecret = "sk-proj-RawCaptionMustStillBlock1234567890abcdef";
  const editor = { tagName: "DIV", isContentEditable: true, text: "API_KEY=[PWM_1]", selection: { start: 0, end: 0 } };
  const findingFor = (text) => {
    const value = String(text || "");
    if (value.includes(rawSecret)) {
      return [{ raw: rawSecret, severity: "high", start: value.indexOf(rawSecret) }];
    }
    if (value.includes("API_KEY=[PWM_1]")) {
      return [{ raw: "API_KEY=[PWM_1]", severity: "high", start: value.indexOf("API_KEY=[PWM_1]") }];
    }
    return [];
  };
  const { markWhatsAppSanitizedImageHandoff, shouldBypassWhatsAppSanitizedImageSend } = createHarness({
    location: { hostname: "web.whatsapp.com" },
    findComposer: () => editor,
    analyzeText: (text) => {
      const findings = findingFor(text);
      return {
        normalizedText: String(text || ""),
        secretFindings: findings,
        networkFindings: [],
        findings,
        placeholderNormalized: false
      };
    }
  });

  markWhatsAppSanitizedImageHandoff(editor);

  assert.strictEqual(
    shouldBypassWhatsAppSanitizedImageSend(editor, "API_KEY=[PWM_1]"),
    true,
    "a sanitized WhatsApp image preview send should not show a rewrite failure for trusted placeholder captions"
  );
  assert.strictEqual(
    shouldBypassWhatsAppSanitizedImageSend(editor, `API_KEY=${rawSecret}`),
    false,
    "raw caption secrets must still use the normal WhatsApp text verifier"
  );
}

async function testWhatsAppImageAttachSuppressesRawInputClearEventDuringOcr() {
  const rawFile = createReadableTextFile({
    name: "attach-secret.png",
    type: "image/png",
    text: "image bytes sk-proj-RawWhatsAppAttachShouldNotUpload1234567890"
  });
  const sanitizedImage = {
    name: "attach-secret.redacted.png",
    type: "image/png",
    size: 256
  };
  const fileInput = createFileInput();
  fileInput.files = [rawFile];
  fileInput.value = "C:\\fakepath\\attach-secret.png";
  const composer = { tagName: "DIV", isContentEditable: true, text: "", selection: { start: 0, end: 0 } };
  let maybeHandleFileInputChange;
  let nestedResult;
  let pipelineCalls = 0;
  const harness = createHarness({
    location: { hostname: "web.whatsapp.com" },
    findComposer: () => composer,
    canExtractForAdapterHandoff: (file) => file === rawFile,
    processFileForAdapterHandoff: async () => {
      pipelineCalls += 1;
      assert.strictEqual(fileInput.files.length, 0, "raw WhatsApp attach input should be cleared before OCR");
      nestedResult = await maybeHandleFileInputChange(createEvent({ type: "change", target: fileInput }).event);
      return {
        status: "ready",
        originalName: rawFile.name,
        outputName: sanitizedImage.name,
        outputKind: "redacted_image_file",
        extractedKind: "image_ocr",
        sanitizedText: "API_KEY=[PWM_1]",
        sanitizedFile: sanitizedImage,
        sanitizedImageFile: sanitizedImage,
        metadata: { original: { type: "image/png", size: rawFile.size }, scan: { findingsCount: 1 } },
        warnings: [],
        safeForUpload: true,
        fileOnlyUpload: true,
        skipTextFallback: true,
        fallbackReason: ""
      };
    },
    readLocalTextFileFromDataTransfer: async (transfer) => {
      harness.calls.reads.push(transfer);
      return {
        handled: true,
        ok: false,
        code: "file_unavailable",
        file: null,
        message: "LeakGuard could not read this local file, so nothing was attached."
      };
    },
    handOffSanitizedLocalFile: (event, input, sanitizedFile, context) => {
      harness.calls.handoffs.push({ event, input, sanitizedFile, context });
      fileInput.files = [sanitizedFile];
      fileInput.dispatchEvent({ type: "input", bubbles: true, composed: true });
      fileInput.dispatchEvent({ type: "change", bubbles: true, composed: true });
      return true;
    }
  });
  maybeHandleFileInputChange = harness.maybeHandleFileInputChange;

  const result = await maybeHandleFileInputChange(createEvent({ type: "change", target: fileInput }).event);

  assert.strictEqual(result?.ok, true);
  assert.strictEqual(nestedResult?.ok, true);
  assert.strictEqual(pipelineCalls, 1);
  assert.strictEqual(harness.calls.reads.length, 0);
  assert.strictEqual(harness.calls.handoffs.length, 1);
  assert.strictEqual(harness.calls.modals.some(([title]) => title === "Raw file blocked"), false);
  assert.strictEqual(
    harness.calls.badges.some(([message]) => String(message || "").includes("Raw file blocked")),
    false
  );
  assert.ok(
    harness.calls.debugEvents.some((entry) => entry.label === "file-input:whatsapp-empty-processing-event-suppressed"),
    "expected raw-input clear event during WhatsApp OCR to be suppressed"
  );
}

async function testWhatsAppImageAttachOcrFailureBlocksRawImage() {
  const unsafeName = "whatsapp-attach-sk-proj-UnsafeFileName1234567890abcdef.png";
  const rawFile = createReadableTextFile({ name: unsafeName, type: "image/png", text: "not really an image" });
  const fileInput = createFileInput();
  fileInput.files = [rawFile];
  fileInput.value = `C:\\fakepath\\${unsafeName}`;
  let pipelineCalls = 0;
  const { maybeHandleFileInputChange, calls } = createHarness({
    location: { hostname: "web.whatsapp.com" },
    findComposer: () => null,
    canExtractForAdapterHandoff: (file) => file === rawFile,
    processFileForAdapterHandoff: async () => {
      pipelineCalls += 1;
      assert.strictEqual(fileInput.files.length, 0, "raw WhatsApp attach input should be cleared before OCR failure");
      return {
        status: "blocked",
        extractedKind: "image_ocr",
        outputKind: "redacted_image_file",
        sanitizedFile: null,
        sanitizedText: "",
        safeForUpload: false,
        fileOnlyUpload: true,
        skipTextFallback: true,
        fallbackReason: "ocr_failed",
        metadata: { original: { type: "image/png", size: rawFile.size } }
      };
    }
  });
  const { event } = createEvent({
    type: "change",
    target: fileInput
  });

  const result = await maybeHandleFileInputChange(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, "ocr_failed");
  assert.strictEqual(pipelineCalls, 1);
  assert.strictEqual(fileInput.files.length, 0);
  assert.strictEqual(calls.handoffs.length, 0);
  assert.strictEqual(calls.textFallbacks.length, 0);
  assert.ok(
    calls.modals.some(
      ([title, message]) =>
        title === "Raw image upload blocked" &&
        String(message || "").includes("local OCR could not read it safely")
    )
  );
  assert.strictEqual(JSON.stringify(calls.modals).includes(unsafeName), false);
}

async function testWhatsAppUnsupportedAttachRemainsBlocked() {
  const cases = [
    [createReadableTextFile({ name: "unsupported.gif", type: "image/gif", text: "gif bytes" })],
    [createReadableTextFile({ name: "unsupported.bmp", type: "image/bmp", text: "bmp bytes" })],
    [createReadableTextFile({ name: "unsupported.svg", type: "image/svg+xml", text: "<svg></svg>" })],
    [createReadableTextFile({ name: "unsupported.exe", type: "application/octet-stream", text: "exe bytes" })],
    [createReadableTextFile({ name: "unsupported.bin", type: "application/octet-stream", text: "bin bytes" })]
  ];

  for (const files of cases) {
    const fileInput = createFileInput();
    fileInput.files = files;
    const { maybeHandleFileInputChange, calls } = createHarness({
      location: { hostname: "web.whatsapp.com" },
      findComposer: () => null,
      processFileForAdapterHandoff: async () => {
        throw new Error("unsupported WhatsApp attach must not enter OCR/redaction");
      }
    });
    const { event } = createEvent({ type: "change", target: fileInput });

    const result = await maybeHandleFileInputChange(event);

    assert.strictEqual(event.defaultPrevented, true);
    assert.strictEqual(result.reason, "whatsapp_file_attachments_unsupported");
    assert.strictEqual(fileInput.files.length, 0);
    assert.strictEqual(calls.handoffs.length, 0);
    assert.strictEqual(calls.textFallbacks.length, 0);
    assert.ok(calls.modals.some(([title]) => title === "WhatsApp file upload blocked"));
  }
}

async function testProtectedSiteImageOcrFailureBlocksRawUpload() {
  const originalGate = globalThis.PWM.isProtectedSiteOcrEnabled;
  const originalRuntime = globalThis.PWM.OcrRuntime;
  globalThis.PWM.isProtectedSiteOcrEnabled = async () => true;
  globalThis.PWM.OcrRuntime = {
    async prepare() {
      return { ok: true };
    },
    async recognizeImageBytes() {
      return {
        ok: false,
        status: "ocr_failed",
        reason: "ocr_failed",
        warnings: ["ocr_failed"]
      };
    }
  };

  try {
    const file = createReadableTextFile({
      name: "fake_secrets_image.png",
      type: "image/png",
      text: "not real image bytes"
    });
    const result = await globalThis.PWM.ContentFileExtractionPipeline.processFileForAdapterHandoff({
      file,
      context: "file-input"
    });
    const serialized = JSON.stringify(result);

    assert.strictEqual(result.status, "blocked");
    assert.strictEqual(result.safeForUpload, false);
    assert.strictEqual(result.sanitizedFile, null);
    assert.strictEqual(result.fallbackReason, "ocr_failed");
    assert.strictEqual(serialized.includes("not real image bytes"), false);
  } finally {
    globalThis.PWM.isProtectedSiteOcrEnabled = originalGate;
    globalThis.PWM.OcrRuntime = originalRuntime;
  }
}

async function testProtectedSiteImageHandoffFailureDoesNotTextFallback() {
  const rawSecret = "sk-proj-ImageUploadSecret1234567890";
  const rawFile = createTextFile({
    name: "fake_secrets_image.png",
    type: "image/png",
    text: `visible image bytes ${rawSecret}`
  });
  const sanitizedImage = {
    name: "fake_secrets_image.redacted.png",
    type: "image/png",
    size: 256,
    async text() {
      throw new Error("sanitized image bytes must not be read as text fallback");
    }
  };
  const fileInput = createFileInput();
  fileInput.files = [rawFile];
  const composer = {
    tagName: "TEXTAREA",
    text: "",
    selection: { start: 0, end: 0 }
  };
  const { maybeHandleFileInputChange, calls } = createHarness({
    location: { hostname: "chatgpt.com" },
    findComposer: () => composer,
    canExtractForAdapterHandoff: (file) => file?.name === rawFile.name,
    processFileForAdapterHandoff: async () => ({
      status: "ready",
      originalName: rawFile.name,
      outputName: sanitizedImage.name,
      outputKind: "redacted_image_file",
      extractedKind: "image_ocr",
      sanitizedText: "API_KEY=[PWM_1]",
      sanitizedFile: sanitizedImage,
      metadata: {
        scan: {
          findingsCount: 1
        },
        visualRedaction: {
          output: "png",
          protectedSiteEligible: true
        }
      },
      warnings: [],
      safeForUpload: true,
      fileOnlyUpload: true,
      fallbackReason: ""
    }),
    handOffSanitizedLocalFile: (event, input, sanitizedFile, context) => {
      calls.handoffs.push({ event, input, sanitizedFile, context });
      return false;
    }
  });
  const { event } = createEvent({
    type: "change",
    target: fileInput
  });

  await maybeHandleFileInputChange(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.ok(calls.debugEvents.some(
    (entry) => entry.label === "file-ui:error-shown" && entry.details.status === "Raw image upload blocked"
  ));
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.handoffs[0].sanitizedFile, sanitizedImage);
  assert.strictEqual(calls.textFallbacks.length, 0, "image upload must not fall back to composer OCR text");
  assert.strictEqual(composer.text, "");
  assert.ok(calls.modals.some(([title]) => title === "Raw file upload blocked"));
  assert.strictEqual(JSON.stringify(calls.debugEvents).includes(rawSecret), false);
}

async function testSupportedDocumentDropUsesContentExtractionPipelineBeforeUnsupportedNotice() {
  const rawFile = createTextFile({
    name: "report.pdf",
    type: "application/pdf",
    text: "PDF bytes with raw secret"
  });
  const sanitizedFile = {
    name: "report.redacted.pdf",
    type: "application/pdf",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  const fileInput = createFileInput({ multiple: true });
  const composer = {
    tagName: "TEXTAREA",
    text: "",
    selection: { start: 0, end: 0 },
    closest: () => null
  };
  const pipelineCalls = [];
  const originalClassifyFileForTextScan = globalThis.PWM.FileScanner.classifyFileForTextScan;

  globalThis.PWM.FileScanner.classifyFileForTextScan = ({ fileName, mimeType }) => ({
    kind: "planned_unsupported",
    status: "planned_unsupported",
    family: "document",
    action: "allow",
    supported: false,
    extension: ".pdf",
    message:
      "LeakGuard did not scan or redact this unsupported file. Supported text, text PDF, DOCX, XLSX, and PNG/JPG/JPEG/WEBP image paths are protected where available. Unsupported archives, executables, legacy Office files, unsupported images, and binary files are blocked on protected sites when LeakGuard cannot safely replace them.",
    fileName,
    mimeType
  });

  try {
    const { maybeHandleDrop, calls } = createHarness({
      location: { hostname: "chatgpt.com" },
      findComposer: () => composer,
      canExtractForAdapterHandoff: (file) => file?.name === rawFile.name,
      processFileForAdapterHandoff: async ({ file, context }) => {
        pipelineCalls.push({ file, context });
        return {
          status: "ready",
          originalName: rawFile.name,
          outputName: sanitizedFile.name,
          outputKind: "redacted_pdf_file",
          extractedKind: "pdf",
          sanitizedText: sanitizedFile.text,
          sanitizedFile,
          metadata: {
            scan: {
              findingsCount: 1
            }
          },
          warnings: [],
          safeForUpload: true,
          fallbackReason: ""
        };
      },
      resolveFileInputForHandoff: () => fileInput,
      readLocalTextFileFromDataTransfer: async () => {
        throw new Error("supported document drop should bypass legacy unsupported text-file reader");
      }
    });
    const { event } = createEvent({
      dataTransfer: {
        types: ["Files"],
        files: [rawFile],
        items: [],
        dropEffect: "none"
      },
      target: composer
    });

    await maybeHandleDrop(event);

    assert.strictEqual(event.defaultPrevented, true, "supported document drop should be consumed before the page");
    assert.strictEqual(pipelineCalls.length, 1, "PDF drop should use content extraction pipeline");
    assert.strictEqual(pipelineCalls[0].file, rawFile);
    assert.strictEqual(pipelineCalls[0].context, "drop");
    assert.strictEqual(calls.redactions.length, 0, "sanitized extraction output should not be double-redacted");
    assert.strictEqual(calls.createdFiles.length, 0, "sanitized extraction output should not be recreated as text");
    assert.strictEqual(calls.originalFileInputHandoffs?.length || 0, 1, "sanitized PDF should be assigned to a safe file input");
    assert.strictEqual(fileInput.files[0], sanitizedFile);
    assert.strictEqual(calls.badges.some(([message]) => /Unsupported file/i.test(String(message || ""))), false);
    assert.strictEqual(calls.modals.some(([, message]) => /Unsupported file/i.test(String(message || ""))), false);
    assert.strictEqual(JSON.stringify(calls.debugEvents).includes(rawFile.text), false);
  } finally {
    globalThis.PWM.FileScanner.classifyFileForTextScan = originalClassifyFileForTextScan;
  }
}

async function testScannedPdfFileInputExplainsFailClosedReason() {
  const rawFile = createTextFile({
    name: "scanned-secrets.pdf",
    type: "application/pdf",
    text: "image-only bytes with possible raw secret"
  });
  const fileInput = createFileInput();
  fileInput.files = [rawFile];
  const { maybeHandleFileInputChange, calls } = createHarness({
    location: { hostname: "chatgpt.com" },
    findComposer: () => null,
    canExtractForAdapterHandoff: (file) => file?.name === rawFile.name,
    processFileForAdapterHandoff: async () => ({
      status: "blocked",
      originalName: rawFile.name,
      outputName: "",
      outputKind: "",
      extractedKind: "pdf",
      sanitizedText: "",
      sanitizedFile: null,
      metadata: {},
      warnings: [],
      safeForUpload: false,
      fallbackReason: "pdf_no_extractable_text"
    }),
    readLocalTextFileFromDataTransfer: async () => {
      throw new Error("blocked scanned PDF should bypass legacy text-file reader");
    }
  });

  await maybeHandleFileInputChange(createEvent({ type: "change", target: fileInput }).event);

  const modal = calls.modals.find(([title]) => title === "Raw file blocked");
  assert.ok(modal, "expected fail-closed modal for scanned PDF");
  assert.match(modal[1], /scanned or image-only PDF/i);
  assert.match(modal[1], /raw upload was blocked/i);
  assert.strictEqual(modal[1].includes("pdf_no_extractable_text"), false);
  assert.strictEqual(calls.handoffs.length, 0);
}

async function testProtectedLegacyOfficeFileInputBlocksRawUpload() {
  for (const testCase of [
    {
      label: "built-in provider",
      location: { hostname: "chatgpt.com" },
      currentPublicState: {
        currentSite: { protected: false },
        protection: { protectionEnforced: false }
      }
    },
    {
      label: "generic protected site",
      location: { hostname: "local.example" },
      currentPublicState: {
        protection: { paused: false }
      }
    }
  ]) {
    const rawSecret = `sk-proj-LegacyOfficeProtectedUnitQa${testCase.label.replace(/\W+/g, "")}1234567890abcdef`;
    const rawFile = createTextFile({
      name: "legacy-protected.doc",
      type: "application/msword",
      text: `DOC_API_KEY=${rawSecret}`
    });
    const fileInput = createFileInput();
    fileInput.files = [rawFile];
    fileInput.value = "C:\\fakepath\\legacy-protected.doc";
    const { maybeHandleFileInputChange, resolveFileDragGuardPolicy, calls } = createHarness({
      location: testCase.location,
      currentPublicState: testCase.currentPublicState,
      findComposer: () => null,
      readLocalTextFileFromDataTransfer: async () => {
        throw new Error(`${testCase.label} legacy Office file should be blocked before the raw reader`);
      },
      handOffSanitizedLocalFile() {
        throw new Error(`${testCase.label} legacy Office file must not hand off a raw file`);
      }
    });
    const dragPolicy = resolveFileDragGuardPolicy({
      types: ["Files"],
      files: [rawFile],
      items: []
    });
    const { event, calls: eventCalls } = createEvent({
      type: "change",
      target: fileInput
    });

    await maybeHandleFileInputChange(event);

    assert.strictEqual(dragPolicy.action, "block", `${testCase.label} drag policy`);
    assert.strictEqual(dragPolicy.reason, "unsupported_protected_file_blocked", `${testCase.label} drag reason`);
    assert.strictEqual(event.defaultPrevented, true, `${testCase.label} file input should be consumed`);
    assert.strictEqual(eventCalls.stopImmediatePropagation, 1, `${testCase.label} file input should stop propagation`);
    assert.strictEqual(fileInput.value, "", `${testCase.label} raw input value should clear`);
    assert.strictEqual(calls.reads.length, 0, `${testCase.label} should not read raw legacy Office file`);
    assert.strictEqual(calls.redactions.length, 0, `${testCase.label} should not redact raw legacy Office file`);
    assert.strictEqual(calls.createdFiles.length, 0, `${testCase.label} should not create sanitized output`);
    assert.strictEqual(calls.handoffs.length, 0, `${testCase.label} should not hand off raw file`);
    assert.ok(calls.modals.some(([title]) => title === "Raw file upload blocked"), `${testCase.label} should show block modal`);
    assert.strictEqual(JSON.stringify(calls).includes(rawSecret), false, `${testCase.label} debug state leaked raw marker`);
  }
}

async function testPausedBuiltInProviderFileInputLetsPageHandleRawFile() {
  const rawSecret = "sk-proj-PausedBuiltInFileInputUnitQa1234567890abcdef";
  const rawFile = createTextFile({
    name: "paused-legacy.doc",
    type: "application/msword",
    text: `DOC_API_KEY=${rawSecret}`
  });
  const fileInput = createFileInput();
  fileInput.files = [rawFile];
  fileInput.value = "C:\\fakepath\\paused-legacy.doc";
  const { maybeHandleFileInputChange, resolveFileDragGuardPolicy, calls } = createHarness({
    location: { hostname: "chatgpt.com" },
    currentPublicState: {
      currentSite: { protected: true },
      protection: {
        paused: true,
        allowProtectionPause: true,
        protectionEnforced: false
      }
    },
    findComposer: () => null,
    readLocalTextFileFromDataTransfer: async () => {
      throw new Error("paused built-in provider file input should not read raw files");
    },
    handOffSanitizedLocalFile() {
      throw new Error("paused built-in provider file input should not hand off sanitized files");
    }
  });
  const dragPolicy = resolveFileDragGuardPolicy({
    types: ["Files"],
    files: [rawFile],
    items: []
  });
  const { event, calls: eventCalls } = createEvent({
    type: "change",
    target: fileInput
  });

  const result = await maybeHandleFileInputChange(event);

  assert.strictEqual(dragPolicy.action, "allow");
  assert.strictEqual(result, undefined);
  assert.strictEqual(event.defaultPrevented, false);
  assert.strictEqual(eventCalls.stopImmediatePropagation, 0);
  assert.strictEqual(fileInput.value, "C:\\fakepath\\paused-legacy.doc");
  assert.strictEqual(calls.reads.length, 0);
  assert.strictEqual(calls.redactions.length, 0);
  assert.strictEqual(calls.createdFiles.length, 0);
  assert.strictEqual(calls.handoffs.length, 0);
  assert.strictEqual(calls.modals.length, 0);
}

async function testEnforcedPauseStillBlocksBuiltInProviderRawFileInput() {
  const rawFile = createTextFile({
    name: "enforced-legacy.doc",
    type: "application/msword",
    text: "DOC_API_KEY=sk-proj-EnforcedPausedFileInputUnitQa1234567890abcdef"
  });
  const fileInput = createFileInput();
  fileInput.files = [rawFile];
  fileInput.value = "C:\\fakepath\\enforced-legacy.doc";
  const { maybeHandleFileInputChange, resolveFileDragGuardPolicy, calls } = createHarness({
    location: { hostname: "chatgpt.com" },
    currentPublicState: {
      currentSite: { protected: true },
      protection: {
        paused: true,
        allowProtectionPause: true,
        protectionEnforced: true
      }
    },
    findComposer: () => null,
    readLocalTextFileFromDataTransfer: async () => {
      throw new Error("enforced file input should be blocked before the raw reader");
    }
  });
  const dragPolicy = resolveFileDragGuardPolicy({
    types: ["Files"],
    files: [rawFile],
    items: []
  });
  const { event, calls: eventCalls } = createEvent({
    type: "change",
    target: fileInput
  });

  await maybeHandleFileInputChange(event);

  assert.strictEqual(dragPolicy.action, "block");
  assert.strictEqual(dragPolicy.reason, "unsupported_protected_file_blocked");
  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(eventCalls.stopImmediatePropagation, 1);
  assert.strictEqual(fileInput.value, "");
  assert.strictEqual(calls.reads.length, 0);
  assert.ok(calls.modals.some(([title]) => title === "Raw file upload blocked"));
}

async function testProtectedUnknownBinaryFileInputBlocksRawUpload() {
  const rawSecret = "sk-proj-ProtectedUnknownBinaryUnitQa1234567890abcdef";
  const rawFile = createTextFile({
    name: "payload.bin",
    type: "application/octet-stream",
    text: `BIN_API_KEY=${rawSecret}`
  });
  const fileInput = createFileInput();
  fileInput.files = [rawFile];
  fileInput.value = "C:\\fakepath\\payload.bin";
  const { maybeHandleFileInputChange, resolveFileDragGuardPolicy, calls } = createHarness({
    location: { hostname: "local.example" },
    currentPublicState: {
      protection: { paused: false }
    },
    findComposer: () => null,
    readLocalTextFileFromDataTransfer: async () => {
      throw new Error("protected unknown binary should be blocked before the raw reader");
    },
    handOffSanitizedLocalFile() {
      throw new Error("protected unknown binary must not hand off a raw file");
    }
  });
  const dragPolicy = resolveFileDragGuardPolicy({
    types: ["Files"],
    files: [rawFile],
    items: []
  });
  const { event, calls: eventCalls } = createEvent({
    type: "change",
    target: fileInput
  });

  await maybeHandleFileInputChange(event);

  assert.strictEqual(dragPolicy.action, "block");
  assert.strictEqual(dragPolicy.reason, "unsupported_protected_file_blocked");
  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(eventCalls.stopImmediatePropagation, 1);
  assert.strictEqual(fileInput.value, "");
  assert.strictEqual(calls.reads.length, 0);
  assert.strictEqual(calls.redactions.length, 0);
  assert.strictEqual(calls.createdFiles.length, 0);
  assert.strictEqual(calls.handoffs.length, 0);
  assert.ok(calls.modals.some(([title]) => title === "Raw file upload blocked"));
  assert.strictEqual(JSON.stringify(calls).includes(rawSecret), false);
}

async function testUnsupportedFileReadFailureHidesProcessingUi() {
  const fileInput = createFileInput();
  fileInput.files = [{ name: "unsupported.pdf", type: "application/pdf", size: 128 }];
  const composer = {
    tagName: "TEXTAREA",
    text: "",
    selection: { start: 0, end: 0 }
  };
  const { maybeHandleFileInputChange, calls } = createHarness({
    location: { hostname: "chatgpt.com" },
    findComposer: () => composer,
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      return {
        handled: false,
        ok: false,
        code: "unsupported_file_type",
        message:
          "LeakGuard did not scan or redact this file. Unsupported file types are not protected in this release."
      };
    }
  });

  await maybeHandleFileInputChange(createEvent({ type: "change", target: fileInput }).event);

  const labels = calls.debugEvents.map((entry) => entry.label);
  assert.ok(labels.includes("file-ui:processing-shown"), "expected processing UI to show");
  assert.ok(labels.includes("file-ui:error-shown"), "expected processing error UI");
  assert.ok(labels.includes("file-ui:processing-hidden"), "expected processing UI cleanup");
  assert.ok(calls.modals.some(([title]) => title === "Raw file blocked"));
  assert.ok(
    calls.modals.some(([, message]) => String(message || "").includes("Unsupported file types")),
    "expected unsupported file message"
  );
}

async function testFileProcessingUiClearsAfterException() {
  const fileInput = createFileInput();
  fileInput.files = [{ name: "throws.env", type: "text/plain", size: 16 }];
  const composer = {
    tagName: "TEXTAREA",
    text: "",
    selection: { start: 0, end: 0 }
  };
  const { maybeHandleFileInputChange, calls } = createHarness({
    location: { hostname: "chatgpt.com" },
    findComposer: () => composer,
    readLocalTextFileFromDataTransfer: async () => {
      throw new Error("scan exploded");
    }
  });

  await assert.rejects(
    () => maybeHandleFileInputChange(createEvent({ type: "change", target: fileInput }).event),
    /scan exploded/
  );

  const labels = calls.debugEvents.map((entry) => entry.label);
  assert.ok(labels.includes("file-ui:processing-shown"), "expected processing UI to show");
  assert.ok(labels.includes("file-ui:error-shown"), "expected processing error UI");
  assert.ok(labels.includes("file-ui:processing-hidden"), "expected processing UI cleanup");
}

async function testLocalFileDropProcessingUiClearsAfterException() {
  const rawFile = createTextFile({
    name: "throws-drop.env",
    type: "text/plain",
    text: "API_KEY=LeakGuardDropApiKey1234567890"
  });
  const composer = {
    tagName: "TEXTAREA",
    text: "",
    selection: { start: 0, end: 0 }
  };
  const { maybeHandleDrop, calls } = createHarness({
    location: { hostname: "chatgpt.com" },
    findComposer: () => composer,
    readLocalTextFileFromDataTransfer: async () => {
      throw new Error("drop scan exploded");
    }
  });
  const { event } = createEvent({
    dataTransfer: {
      types: ["Files"],
      files: [rawFile],
      items: [],
      dropEffect: "none"
    },
    target: composer
  });

  await assert.rejects(() => maybeHandleDrop(event), /drop scan exploded/);

  const labels = calls.debugEvents.map((entry) => entry.label);
  assert.strictEqual(event.defaultPrevented, true);
  assert.ok(labels.includes("file-ui:processing-shown"), "expected drop processing UI to show");
  assert.ok(labels.includes("file-ui:error-shown"), "expected drop processing error UI");
  assert.ok(labels.includes("file-ui:processing-hidden"), "expected drop processing UI cleanup");
  assert.strictEqual(calls.handoffs.length, 0);
  assert.strictEqual(calls.textFallbacks.length, 0);
  assert.strictEqual(calls.clearedDragSessions, 1);
  assert.strictEqual(JSON.stringify(calls.debugEvents).includes("LeakGuardDropApiKey1234567890"), false);
}

async function testPendingAttachCompletedSuppressesLaterEmptyFileUnavailableEvent() {
  const sanitizedFile = {
    name: "pending-sanitized.env",
    type: "text/plain",
    size: 18,
    lastModified: 101,
    text: "API_KEY=[PWM_1]"
  };
  const assignedInput = createFileInput({ name: "Filedata" });
  const laterInput = createFileInput({ name: "Filedata" });
  const { maybeHandleFileInputChange, handOffSanitizedFileInput, calls } = createHarness({
    location: { hostname: "gemini.google.com" },
    findComposer: () => null,
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      return {
        handled: true,
        ok: false,
        code: "file_unavailable",
        file: null,
        message: "LeakGuard could not read this local file, so nothing was attached."
      };
    }
  });

  assert.strictEqual(
    handOffSanitizedFileInput(assignedInput, { files: [sanitizedFile] }, {
      dispatchInput: true,
      details: {
        handoffStage: "gemini:pending-file-input-assignment",
        sessionHash: "pending-session-1"
      }
    }),
    true
  );
  laterInput.files = [];

  const result = await maybeHandleFileInputChange(
    createEvent({ type: "change", target: laterInput }).event
  );

  assert.strictEqual(result?.ok, true);
  assert.strictEqual(calls.reads.length, 1);
  assert.strictEqual(calls.modals.some(([title]) => title === "Raw file blocked"), false);
  assert.strictEqual(calls.badges.some(([message]) => String(message || "").includes("Raw file blocked")), false);
  assert.ok(
    calls.debugEvents.some((entry) => entry.label === "file-input:file-unavailable-after-handoff-suppressed"),
    "expected file_unavailable suppression diagnostics"
  );
  assert.ok(
    calls.debugEvents.some((entry) => entry.label === "file-handoff:stale-error-suppressed-after-success"),
    "expected stale success suppression diagnostics"
  );
}

async function testChatGptUploadButtonAttachSuppressesLaterEmptyFileInputEvent() {
  const rawSecret = "LeakGuardUploadApiKey1234567890";
  const rawFile = {
    name: "chatgpt-large-upload.env",
    type: "text/plain",
    size: 6 * 1024 * 1024,
    async text() {
      throw new Error("large upload-button attach must stream instead of reading text()");
    },
    async arrayBuffer() {
      throw new Error("large upload-button attach must stream instead of buffering");
    }
  };
  const sanitizedFile = {
    name: rawFile.name,
    type: "text/plain",
    size: 18,
    lastModified: 202,
    text: "API_KEY=[PWM_1]"
  };
  const fileInput = createFileInput();
  fileInput.files = [rawFile];
  fileInput.value = "C:\\fakepath\\chatgpt-large-upload.env";
  const composer = { tagName: "TEXTAREA", text: "", selection: { start: 0, end: 0 } };
  let streamCalls = 0;
  const { maybeHandleFileInputChange, calls } = createHarness({
    location: { hostname: "chatgpt.com" },
    findComposer: () => composer,
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
          sizeBytes: rawFile.size,
          lastModified: rawFile.lastModified
        }
      };
    },
    StreamingFileRedactor: {
      LARGE_TEXT_STREAMING_MAX_BYTES: 50 * 1024 * 1024,
      redactTextFileStream: async (file, options) => {
        streamCalls += 1;
        assert.strictEqual(file, rawFile);
        await options.redactText(`API_KEY=${rawSecret}`);
        return {
          action: "redacted",
          sanitizedFile,
          findingsCount: 1,
          bytesProcessed: rawFile.size
        };
      }
    }
  });

  await maybeHandleFileInputChange(createEvent({ type: "change", target: fileInput }).event);
  fileInput.files = [];
  const result = await maybeHandleFileInputChange(createEvent({ type: "change", target: fileInput }).event);

  assert.strictEqual(result?.ok, true);
  assert.strictEqual(streamCalls, 1);
  assert.strictEqual(calls.reads.length, 1);
  assert.strictEqual(calls.modals.some(([title]) => title === "Raw file blocked"), false);
  assert.strictEqual(calls.badges.some(([message]) => String(message || "").includes("Raw file blocked")), false);
  assert.ok(
    calls.debugEvents.some((entry) => entry.label === "file-input:empty-event-after-handoff-suppressed"),
    "expected empty file-input suppression diagnostics"
  );
}

async function testChatGptFiftyMiBStreamingAttachSuppressesLaterEmptyEvent() {
  const rawFile = {
    name: "chatgpt-50mib-upload.env",
    type: "text/plain",
    size: 50 * 1024 * 1024,
    async text() {
      throw new Error("50 MiB upload-button attach must stream instead of reading text()");
    }
  };
  const sanitizedFile = {
    name: rawFile.name,
    type: "text/plain",
    size: 24,
    lastModified: 303,
    text: "TOKEN=[PWM_1]\nSAFE=true"
  };
  const fileInput = createFileInput();
  fileInput.files = [rawFile];
  const composer = { tagName: "TEXTAREA", text: "", selection: { start: 0, end: 0 } };
  let streamCalls = 0;
  const { maybeHandleFileInputChange, calls } = createHarness({
    location: { hostname: "chatgpt.com" },
    findComposer: () => composer,
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      if (calls.reads.length > 1) {
        return {
          handled: true,
          ok: false,
          code: "file_unavailable",
          file: null,
          message: "LeakGuard could not read this local file, so nothing was attached."
        };
      }
      return {
        handled: true,
        ok: false,
        code: "streaming_required",
        sourceFile: rawFile,
        file: {
          name: rawFile.name,
          type: rawFile.type,
          sizeBytes: rawFile.size,
          lastModified: rawFile.lastModified
        }
      };
    },
    StreamingFileRedactor: {
      LARGE_TEXT_STREAMING_MAX_BYTES: 50 * 1024 * 1024,
      redactTextFileStream: async (file, options) => {
        streamCalls += 1;
        assert.strictEqual(file, rawFile);
        await options.redactText("TOKEN=LeakGuardFiftyMiBApiKey1234567890");
        return {
          action: "redacted",
          sanitizedFile,
          findingsCount: 1,
          bytesProcessed: rawFile.size
        };
      }
    }
  });

  await maybeHandleFileInputChange(createEvent({ type: "change", target: fileInput }).event);
  fileInput.files = [];
  await maybeHandleFileInputChange(createEvent({ type: "change", target: fileInput }).event);

  assert.strictEqual(streamCalls, 1);
  assert.strictEqual(calls.reads.length, 1);
  assert.strictEqual(calls.modals.some(([title]) => title === "Raw file blocked"), false);
  assert.strictEqual(calls.badges.some(([message]) => String(message || "").includes("Raw file blocked")), false);
  assert.ok(
    calls.debugEvents.some((entry) => entry.label === "file-input:empty-event-after-handoff-suppressed"),
    "expected empty event after 50 MiB handoff to be suppressed"
  );
}

async function testWhatsAppSanitizedImageAttachSuppressesLaterUnavailableEvent() {
  const sanitizedImage = {
    name: "whatsapp-attach.redacted.png",
    type: "image/png",
    size: 128,
    lastModified: 515
  };
  const assignedInput = createFileInput({ name: "Filedata" });
  const laterInput = createFileInput({ name: "Filedata" });
  laterInput.files = [];
  const composer = { tagName: "DIV", isContentEditable: true, text: "", selection: { start: 0, end: 0 } };
  const { maybeHandleFileInputChange, handOffSanitizedFileInput, calls } = createHarness({
    location: { hostname: "web.whatsapp.com" },
    findComposer: () => composer,
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      return {
        handled: true,
        ok: false,
        code: "file_unavailable",
        file: null,
        message: "LeakGuard could not read this local file, so nothing was attached."
      };
    }
  });

  assert.strictEqual(
    handOffSanitizedFileInput(assignedInput, { files: [sanitizedImage] }, {
      dispatchInput: true,
      details: {
        handoffStage: "whatsapp:image-attach",
        sessionHash: "whatsapp-image-attach-1"
      }
    }),
    true
  );
  const result = await maybeHandleFileInputChange(createEvent({ type: "change", target: laterInput }).event);

  assert.strictEqual(result?.ok, true);
  assert.strictEqual(calls.reads.length, 1);
  assert.strictEqual(calls.modals.some(([title]) => title === "Raw file blocked"), false);
  assert.strictEqual(calls.badges.some(([message]) => String(message || "").includes("Raw file blocked")), false);
  assert.ok(
    calls.debugEvents.some((entry) => entry.label === "file-input:file-unavailable-after-handoff-suppressed"),
    "expected stale WhatsApp file_unavailable event to be suppressed after sanitized image attach"
  );
}

async function testFileUnavailableWithoutPriorHandoffStillShowsFailure() {
  const fileInput = createFileInput();
  fileInput.files = [];
  const composer = { tagName: "TEXTAREA", text: "", selection: { start: 0, end: 0 } };
  const { maybeHandleFileInputChange, calls } = createHarness({
    location: { hostname: "chatgpt.com" },
    findComposer: () => composer,
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      return {
        handled: true,
        ok: false,
        code: "file_unavailable",
        file: null,
        message: "LeakGuard could not read this local file, so nothing was attached."
      };
    }
  });

  await maybeHandleFileInputChange(createEvent({ type: "change", target: fileInput }).event);

  assert.strictEqual(calls.reads.length, 1);
  assert.ok(calls.modals.some(([title]) => title === "Raw file blocked"));
  assert.ok(
    calls.modals.some(([, message]) =>
      String(message || "").includes("LeakGuard could not read this local file")
    )
  );
}

async function testRawReadFailureWithSelectedFileStillBlocksAfterRecentHandoff() {
  const sanitizedFile = {
    name: "sanitized.env",
    type: "text/plain",
    size: 18,
    lastModified: 10,
    text: "API_KEY=[PWM_1]"
  };
  const rawFile = createTextFile({
    name: "bad-after-handoff.env",
    type: "text/plain",
    text: "not decoded"
  });
  rawFile.lastModified = 20;
  const fileInput = createFileInput();
  const composer = { tagName: "TEXTAREA", text: "", selection: { start: 0, end: 0 } };
  const { maybeHandleFileInputChange, handOffSanitizedFileInput, calls } = createHarness({
    location: { hostname: "chatgpt.com" },
    findComposer: () => composer,
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      return {
        handled: true,
        ok: false,
        code: "invalid_utf8",
        file: {
          name: rawFile.name,
          type: rawFile.type,
          sizeBytes: rawFile.size,
          lastModified: rawFile.lastModified
        },
        message: "This file is not valid UTF-8 text, so LeakGuard did not scan it."
      };
    }
  });

  assert.strictEqual(handOffSanitizedFileInput(fileInput, { files: [sanitizedFile] }, { dispatchInput: true }), true);
  fileInput.files = [rawFile];

  await maybeHandleFileInputChange(createEvent({ type: "change", target: fileInput }).event);

  assert.strictEqual(calls.reads.length, 1);
  assert.ok(calls.modals.some(([title]) => title === "Raw file blocked"));
  assert.strictEqual(
    calls.debugEvents.some((entry) => entry.label === "file-input:file-unavailable-after-handoff-suppressed"),
    false
  );
}

async function assertStreamingPendingAttachRedispatchIsSuppressed({
  hostname,
  sourceName,
  sourceSize,
  queuedLabel
}) {
  const rawSecret = "LeakGuardDropApiKey1234567890";
  const sanitizedText = "API_KEY=[PWM_1]\ntoken_limit=4096";
  const sourceFile = {
    name: sourceName,
    type: "text/plain",
    size: sourceSize,
    lastModified: 101,
    async text() {
      throw new Error("streaming pending attach must not read raw file text");
    },
    async arrayBuffer() {
      throw new Error("streaming pending attach must not buffer raw file");
    }
  };
  const sanitizedFile = {
    name: sourceName,
    type: "text/plain",
    size: sanitizedText.length,
    lastModified: 202,
    text: sanitizedText
  };
  const composer = {
    tagName: "TEXTAREA",
    text: "",
    selection: { start: 0, end: 0 }
  };
  const fileInput = createFileInput({ multiple: true, name: "Filedata" });
  let streamCalls = 0;
  const { maybeHandleDrop, maybeHandleFileInputChange, handOffSanitizedFileInput, calls } = createHarness({
    navigator: { userAgent: "Firefox" },
    location: { hostname },
    findComposer: () => composer,
    readLocalTextFileFromDataTransfer: async (transfer) => {
      const firstFile = Array.from(transfer.files || [])[0] || null;
      if (!firstFile) {
        calls.reads.push(transfer);
        return {
          handled: true,
          ok: false,
          code: "file_unavailable",
          file: null,
          message: "LeakGuard could not read this local file, so nothing was attached."
        };
      }
      if (firstFile === sanitizedFile) {
        throw new Error("sanitized pending attach must not be scanned again");
      }
      calls.reads.push(transfer);
      return {
        handled: true,
        ok: false,
        code: "streaming_required",
        sourceFile,
        file: {
          name: sourceFile.name,
          type: sourceFile.type,
          sizeBytes: sourceFile.size,
          lastModified: sourceFile.lastModified
        }
      };
    },
    StreamingFileRedactor: {
      LARGE_TEXT_STREAMING_MAX_BYTES: 50 * 1024 * 1024,
      STREAMING_BLOCK_TITLE: "File too large for local redaction",
      STREAMING_BLOCK_MESSAGE:
        "This file is over 50 MB. LeakGuard blocked the upload because it cannot safely sanitize it yet.",
      redactTextFileStream: async (file, options) => {
        streamCalls += 1;
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
    },
    document: {
      activeElement: composer,
      execCommand: () => false,
      createRange: () => null,
      createElement: (tagName) => ({
        tagName: String(tagName || "").toUpperCase(),
        type: "",
        files: []
      }),
      querySelectorAll(selector) {
        const value = String(selector || "");
        return value.includes('input[type="file"]') || value.includes("input[type='file']")
          ? [fileInput]
          : [];
      }
    }
  });
  const drop = createEvent({
    dataTransfer: {
      types: ["Files"],
      files: [sourceFile],
      items: [],
      dropEffect: "none"
    },
    target: composer
  });

  await maybeHandleDrop(drop.event);

  assert.strictEqual(drop.event.defaultPrevented, true);
  assert.strictEqual(calls.reads.length, 1);
  assert.strictEqual(streamCalls, 1);
  assert.ok(calls.debugEvents.some((entry) => entry.label === queuedLabel), `expected ${queuedLabel}`);

  const assigned = handOffSanitizedFileInput(fileInput, { files: [sanitizedFile] }, {
    dispatchInput: true,
    details: {
      handoffStage: hostname.includes("grok")
        ? "grok:pending-file-input-assignment"
        : "gemini:pending-file-input-assignment",
      sessionHash: `${hostname}:${sourceName}`
    }
  });
  const redispatch = createEvent({
    type: "change",
    target: fileInput,
    dataTransfer: null
  });

  const result = await maybeHandleFileInputChange(redispatch.event);

  assert.strictEqual(assigned, true);
  assert.strictEqual(result?.ok, true);
  assert.strictEqual(calls.reads.length, 1);
  assert.strictEqual(streamCalls, 1);
  assert.strictEqual(fileInput.files.length, 1);
  assert.strictEqual(fileInput.files[0], sanitizedFile);
  assert.deepStrictEqual(fileInput.events, ["input", "change"]);
  assert.strictEqual(
    calls.debugEvents.filter((entry) => entry.label === "streaming-redaction:started").length,
    1
  );
  for (const label of [
    "file-input:sanitized-handoff-marked",
    "file-input:sanitized-handoff-input-match",
    "file-input:sanitized-handoff-signature-match",
    "file-input:sanitized-handoff-suppressed"
  ]) {
    assert.ok(calls.debugEvents.some((entry) => entry.label === label), `expected ${label}`);
  }

  const laterEmptyInput = createFileInput({ multiple: true, name: "Filedata" });
  laterEmptyInput.files = [];
  const unavailableResult = await maybeHandleFileInputChange(
    createEvent({ type: "change", target: laterEmptyInput }).event
  );

  assert.strictEqual(unavailableResult?.ok, true);
  assert.strictEqual(calls.reads.length, 2);
  assert.strictEqual(calls.modals.some(([title]) => title === "Raw file blocked"), false);
  assert.ok(
    calls.debugEvents.some((entry) => entry.label === "file-input:file-unavailable-after-handoff-suppressed"),
    "expected pending attach file_unavailable suppression"
  );
  assert.strictEqual(JSON.stringify(calls.debugEvents).includes(rawSecret), false);
}

async function testGeminiStreamingPendingAttachRedispatchDoesNotRestream() {
  await assertStreamingPendingAttachRedispatchIsSuppressed({
    hostname: "gemini.google.com",
    sourceName: "large-stream-gemini-50mb.env",
    sourceSize: 50 * 1024 * 1024,
    queuedLabel: "file-handoff:gemini-streaming-pending-queued"
  });
}

async function testGeminiFiftyMiBPendingAttachRedispatchDoesNotRestream() {
  await assertStreamingPendingAttachRedispatchIsSuppressed({
    hostname: "gemini.google.com",
    sourceName: "fifty-mib-gemini.env",
    sourceSize: 50 * 1024 * 1024,
    queuedLabel: "file-handoff:gemini-streaming-pending-queued"
  });
}

async function testGrokStreamingPendingAttachRedispatchDoesNotRestream() {
  await assertStreamingPendingAttachRedispatchIsSuppressed({
    hostname: "grok.com",
    sourceName: "large-stream-grok.env",
    sourceSize: 5 * 1024 * 1024,
    queuedLabel: "file-handoff:grok-streaming-pending-queued"
  });
}

async function testSanitizedHandoffInputDoesNotSuppressDifferentUserFile() {
  const sanitizedFile = {
    name: "sanitized.env",
    type: "text/plain",
    size: 18,
    lastModified: 10,
    text: "API_KEY=[PWM_1]"
  };
  const rawFile = createTextFile({
    name: "later-raw.env",
    type: "text/plain",
    text: "API_KEY=LeakGuardFileApiKey1234567890"
  });
  const rawText = "API_KEY=LeakGuardFileApiKey1234567890";
  rawFile.lastModified = 20;
  const fileInput = createFileInput();
  const composer = { tagName: "TEXTAREA", text: "", selection: { start: 0, end: 0 } };
  const { maybeHandleFileInputChange, handOffSanitizedFileInput, calls } = createHarness({
    findComposer: () => composer,
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      return {
        handled: true,
        ok: true,
        text: rawText,
        file: {
          name: rawFile.name,
          type: rawFile.type,
          sizeBytes: rawFile.size,
          lastModified: rawFile.lastModified
        }
      };
    }
  });

  assert.strictEqual(handOffSanitizedFileInput(fileInput, { files: [sanitizedFile] }, { dispatchInput: true }), true);
  fileInput.files = [rawFile];

  await maybeHandleFileInputChange(createEvent({ type: "change", target: fileInput }).event);

  assert.strictEqual(calls.reads.length, 1);
  assert.strictEqual(calls.redactions.length, 1);
  assert.strictEqual(calls.handoffs.length, 1);
  assert.ok(!calls.debugEvents.some((entry) => entry.label === "file-input:sanitized-handoff-suppressed"));
}

async function testSanitizedHandoffSignatureExpiresBeforeSameMetadataUserFile() {
  const originalNow = Date.now;
  const baseNow = 100000;
  const timeoutCallbacks = [];
  Date.now = () => baseNow;
  try {
    const sanitizedFile = {
      name: "same-metadata.env",
      type: "text/plain",
      size: 18,
      lastModified: 30,
      text: "API_KEY=[PWM_1]"
    };
    const laterRawFile = {
      name: sanitizedFile.name,
      type: sanitizedFile.type,
      size: sanitizedFile.size,
      lastModified: sanitizedFile.lastModified,
      text: "API_KEY=LeakGuardFileApiKey1234567890"
    };
    const fileInput = createFileInput();
    const composer = { tagName: "TEXTAREA", text: "", selection: { start: 0, end: 0 } };
    const { maybeHandleFileInputChange, handOffSanitizedFileInput, calls } = createHarness({
      setTimeout: (callback, delay = 0) => {
        timeoutCallbacks.push({ callback, delay });
        return timeoutCallbacks.length;
      },
      findComposer: () => composer,
      readLocalTextFileFromDataTransfer: async (transfer) => {
        calls.reads.push(transfer);
        return {
          handled: true,
          ok: true,
          text: laterRawFile.text,
          file: {
            name: laterRawFile.name,
            type: laterRawFile.type,
            sizeBytes: laterRawFile.size,
            lastModified: laterRawFile.lastModified
          }
        };
      }
    });

    assert.strictEqual(handOffSanitizedFileInput(fileInput, { files: [sanitizedFile] }, { dispatchInput: true }), true);
    const expiry = timeoutCallbacks.find((entry) => entry.delay === 30000);
    assert.ok(expiry, "expected sanitized handoff expiry timer");

    Date.now = () => baseNow + 31000;
    expiry.callback();
    fileInput.files = [laterRawFile];

    await maybeHandleFileInputChange(createEvent({ type: "change", target: fileInput }).event);

    assert.strictEqual(calls.reads.length, 1);
    assert.strictEqual(calls.redactions.length, 1);
    assert.ok(calls.debugEvents.some((entry) => entry.label === "file-input:sanitized-handoff-expired"));
    assert.ok(!calls.debugEvents.some((entry) => entry.label === "file-input:sanitized-handoff-suppressed"));
  } finally {
    Date.now = originalNow;
  }
}

async function testGeminiSanitizedDownloadFailureFailsClosed() {
  const sanitizedFile = {
    name: "download-fails.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  const {
    handOffGeminiSanitizedFileUpload,
    fallbackDrops,
    consoleErrors,
    debugEvents
  } = createHandoffHarness({
    uploadTriggers: [
      createUploadTrigger({
        ariaLabel: "Open upload file menu"
      })
    ],
    sendRuntimeMessage: async () => ({ ok: false, error: "download denied" })
  });
  const event = {
    type: "drop",
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer()
  };

  const handedOff = await handOffGeminiSanitizedFileUpload(event, null, sanitizedFile);

  assert.strictEqual(handedOff, false);
  assert.strictEqual(fallbackDrops.length, 0);
  assert.strictEqual(consoleErrors.length, 0);
  assert.ok(
    debugEvents.some(
      (entry) =>
        entry.label === "sanitized-file-handoff:failed" &&
        entry.payload.failureReason === "no_file_input_without_opening_picker"
    )
  );
  assert.strictEqual(JSON.stringify(debugEvents).includes("API_KEY=[PWM_1]"), false);
}

async function testFirefoxGeminiNoPickerMissIsSoftBeforeFallback() {
  const sanitizedFile = {
    name: "01-basic-secrets.env",
    type: "text/plain",
    size: 194,
    text: "OPENAI_API_KEY=[PWM_1]"
  };
  const {
    handOffGeminiSanitizedFileUpload,
    fallbackDrops,
    consoleErrors,
    debugEvents
  } = createHandoffHarness({
    userAgent: "Firefox",
    uploadTriggers: [
      createUploadTrigger({
        ariaLabel: "Open upload file menu",
        className: "upload-card-button open"
      })
    ]
  });
  const event = {
    type: "drop",
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer({
      files: [
        {
          name: "01-basic-secrets.env",
          type: "",
          size: 522
        }
      ]
    })
  };

  const handedOff = await handOffGeminiSanitizedFileUpload(event, null, sanitizedFile);

  assert.strictEqual(handedOff, false);
  assert.strictEqual(fallbackDrops.length, 0);
  assert.strictEqual(consoleErrors.length, 0);
  assert.ok(
    debugEvents.some(
      (entry) =>
        entry.label === "file-handoff:gemini-firefox-native-input-unavailable" &&
        entry.payload.handoffStage === "gemini:no-file-input-without-picker" &&
        entry.payload.failureReason === "no_file_input_without_opening_picker"
    ),
    "expected Firefox no-picker native input miss to be logged as a soft fallback stage"
  );
  assert.strictEqual(JSON.stringify(debugEvents).includes("OPENAI_API_KEY=[PWM_1]"), false);
}

function testGeminiUploadHandoffDoesNotRedispatchSyntheticDrop() {
  const source = extractFunctionSource(contentSource, "handOffGeminiSanitizedFileUpload");
  assert.strictEqual(
    source.includes("dispatchSanitizedFileEvent"),
    false,
    "Gemini upload handoff must not redispatch synthetic drop events"
  );
}

function testSanitizedDownloadBackgroundHookExists() {
  const baseManifest = JSON.parse(fs.readFileSync(path.join(repoRoot, "manifests/base.json"), "utf8"));
  assert.ok(
    baseManifest.permissions.includes("downloads"),
    "sanitized Gemini download fallback requires downloads permission"
  );
  assert.ok(
    backgroundSource.includes("PWM_DOWNLOAD_SANITIZED_FILE") &&
      backgroundSource.includes("downloadSanitizedFile") &&
      backgroundSource.includes("ext.downloads.download"),
    "background should handle sanitized file download requests"
  );
  assert.ok(
    contentSource.includes("PWM_DOWNLOAD_SANITIZED_FILE") &&
      contentSource.includes("downloadGeminiSanitizedFileFallback"),
    "content script should request sanitized downloads through runtime messaging"
  );
}

function testUrlChangeClearsPendingGeminiHandoff() {
  const source = extractFunctionSource(contentSource, "handleUrlChange");
  assert.ok(
    source.includes('clearPendingGeminiSanitizedFileHandoff("navigation")'),
    "route changes should clear pending Gemini sanitized file handoff"
  );
}

function testExtensionInvalidationClearsPendingGeminiHandoff() {
  const source = extractFunctionSource(contentSource, "markExtensionContextInvalidated");
  assert.ok(
    source.includes('clearPendingGeminiSanitizedFileHandoff("extension-context-invalidated")'),
    "extension context invalidation should clear pending Gemini sanitized file handoff"
  );
}

function testGeminiUploadDiscoveryDoesNotRequireMaterialClassSelectors() {
  const source = extractFunctionSource(contentSource, "collectFileHandoffElementsFromRoot");
  const overlaySource = extractFunctionSource(contentSource, "discoverGeminiUploadOverlayItem");
  assert.strictEqual(source.includes("mat-mdc-button"), false);
  assert.strictEqual(source.includes("ng-star-inserted"), false);
  assert.strictEqual(source.includes("upload-card-button"), false);
  assert.strictEqual(overlaySource.includes(".mat-mdc-menu-panel"), false);
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

async function testGeminiUploadAcceptsChipIncreaseWhenInputFilesClear() {
  const rawSecret = "LeakGuardUploadApiKey1234567890";
  const attachmentIndicators = [];
  const sanitizedFile = {
    name: "cleared-after-accept.env",
    type: "text/plain",
    size: 28,
    text: "API_KEY=[PWM_1]"
  };
  const fileInput = createFileInput({ source: "light-dom", name: "Filedata", multiple: true });
  const originalDispatchEvent = fileInput.dispatchEvent.bind(fileInput);
  fileInput.dispatchEvent = (event) => {
    const result = originalDispatchEvent(event);
    if (event.type === "change") {
      attachmentIndicators.push({ nodeType: 1, tagName: "MAT-CHIP" });
      fileInput.files = [];
    }
    return result;
  };
  const { handOffGeminiSanitizedFileUpload, debugEvents, fallbackDrops, runtimeMessages } =
    createHandoffHarness({
      fileInputs: [fileInput],
      attachmentIndicators
    });
  const event = {
    type: "file-input",
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer({
      files: [
        {
          name: "raw-local-name.env",
          type: "text/plain",
          size: 64,
          text: `API_KEY=${rawSecret}`
        }
      ]
    })
  };

  const handedOff = await handOffGeminiSanitizedFileUpload(event, null, sanitizedFile);

  assert.strictEqual(handedOff, true);
  assert.deepStrictEqual(fileInput.events, ["input", "change"]);
  assert.deepStrictEqual(Array.from(fileInput.files || []), []);
  assert.strictEqual(fallbackDrops.length, 0);
  assert.strictEqual(runtimeMessages.length, 0);
  assert.ok(debugEvents.some((entry) => entry.label === "gemini:attachment-chip-detected"));
  assert.ok(debugEvents.some((entry) => entry.label === "gemini:handoff-accepted-input-cleared"));
  assert.ok(debugEvents.some((entry) => entry.label === "gemini:handoff-events-dispatched"));

  const serializedDebug = JSON.stringify(debugEvents);
  assert.strictEqual(serializedDebug.includes(rawSecret), false);
  assert.strictEqual(serializedDebug.includes("raw-local-name.env"), false);
  assert.strictEqual(serializedDebug.includes("cleared-after-accept.env"), false);
  assert.strictEqual(serializedDebug.includes("MAT-CHIP"), false);
  assert.strictEqual(serializedDebug.includes("ariaLabel"), false);
  assert.strictEqual(serializedDebug.includes("className"), false);
  assert.strictEqual(serializedDebug.includes("selector"), false);
  assert.strictEqual(serializedDebug.includes("errorStack"), false);
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
  assert.strictEqual(hasPendingGeminiSanitizedFileHandoff(sanitizedFile), false);
  const failed = debugEvents.find((entry) => entry.label === "sanitized-file-handoff:failed");
  assert.ok(failed, "expected metadata-only failure breadcrumb");
  assert.strictEqual(failed.payload.sanitizedFile.sizeBytes, 26213285);
  const serialized = JSON.stringify(failed.payload);
  assert.strictEqual(serialized.includes(rawSecret), false);
  assert.ok(
    debugEvents.some((entry) => entry.label === "file-handoff:gemini-input-not-found"),
    "expected Gemini drop to fail closed without raw file replay"
  );
}

async function testGeminiUploadToolsOverlayMissDoesNotReportUnsafeTrigger() {
  const rawSecret = "OPENAI_API_KEY=sk-live-should-not-log";
  const sanitizedFile = {
    name: "01-basic-secrets.env",
    type: "text/plain",
    size: 194,
    text: "OPENAI_API_KEY=[PWM_1]"
  };
  const uploadTrigger = createUploadTrigger({
    ariaLabel: "Upload & tools",
    className:
      "mdc-icon-button mat-mdc-icon-button mat-mdc-button-base mat-badge mat-unthemed _mat-animation-noopable",
    onClick: () => {}
  });
  const harness = createHandoffHarness({
    userAgent: "Firefox",
    fileInputs: [],
    uploadTriggers: [uploadTrigger],
    overlayItems: []
  });
  const event = {
    type: "drop",
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer({
      files: [
        {
          name: "01-basic-secrets.env",
          type: "",
          size: 522,
          text: rawSecret
        }
      ]
    })
  };

  const handoff = harness.handOffGeminiSanitizedFileUpload(event, null, sanitizedFile, {
    allowUploadUiClick: true
  });
  await Promise.resolve();
  triggerGhostIngressTimeout(harness);
  const handedOff = await handoff;

  assert.strictEqual(handedOff, false);
  assert.deepStrictEqual(uploadTrigger.events, ["click"]);
  assert.strictEqual(harness.hasPendingGeminiSanitizedFileHandoff(sanitizedFile), true);
  const queued = harness.debugEvents.find(
    (entry) => entry.label === "file-handoff:gemini-firefox-pending-queued-after-native-miss"
  );
  assert.ok(queued, "expected Firefox Gemini overlay miss to queue sanitized pending handoff");
  assert.strictEqual(queued.payload.failureReason, "ghost_ingress_timeout");
  assert.notStrictEqual(queued.payload.failureReason, "unsafe_upload_trigger");
  assert.strictEqual(JSON.stringify(harness.debugEvents).includes(rawSecret), false);
}

function testGeminiHiddenUploadToolsRejectedAsNormalMenuOpener() {
  const uploadTrigger = createUploadTrigger({
    ariaLabel: "Upload & tools",
    className: "mdc-icon-button mat-mdc-icon-button mat-mdc-button-base mat-badge",
    onClick: () => {
      throw new Error("hidden Upload & tools must not be clicked as a normal menu opener");
    }
  });
  uploadTrigger.hidden = true;
  const harness = createHandoffHarness({
    userAgent: "Firefox",
    uploadTriggers: [uploadTrigger]
  });

  assert.strictEqual(harness.isAllowedGeminiUploadMenuOpener(uploadTrigger), false);
  assert.strictEqual(harness.findGeminiUploadMenuButton(), null);
  assert.strictEqual(harness.openGeminiUploadMenuSafely(uploadTrigger), false);
  assert.strictEqual(harness.clickElementSafely(uploadTrigger), false);
  assert.deepStrictEqual(uploadTrigger.events, []);
}

function testGeminiHiddenSelectorOnlyUsesDedicatedActivator() {
  const hiddenTrigger = createHiddenFileSelectorTrigger();
  const harness = createHandoffHarness({
    userAgent: "Firefox",
    hiddenTriggers: [hiddenTrigger]
  });

  assert.strictEqual(harness.isAllowedGeminiUploadMenuOpener(hiddenTrigger), false);
  assert.strictEqual(harness.clickElementSafely(hiddenTrigger), false);
  assert.deepStrictEqual(hiddenTrigger.events, []);
  assert.strictEqual(harness.activateGeminiHiddenFileSelectorTriggerSafely(hiddenTrigger), true);
  assert.deepStrictEqual(hiddenTrigger.events, ["pointerdown", "mousedown", "mouseup", "click"]);
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

function testPasteListenerUsesWindowCaptureBeforePageHandlers() {
  const documentPasteBindingIndex = contentSource.indexOf('document.addEventListener(\n      "paste"');
  const startupPasteBindings = contentSource.slice(
    Math.max(0, documentPasteBindingIndex - 500),
    documentPasteBindingIndex + 500
  );
  assert.ok(
    /const onPaste = \(event\) => \{[\s\S]*maybeHandlePaste\(event\)\.catch\(handleContentError\);[\s\S]*\};/.test(
      startupPasteBindings
    ) &&
      /window\.addEventListener\("paste", onPaste, true\);/.test(startupPasteBindings) &&
      /document\.addEventListener\("paste", onPaste, true\);/.test(startupPasteBindings),
    "paste interception should start at window capture so protected sites cannot preview raw clipboard images first"
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
  assert.strictEqual(calls.handoffs[0].context, "grok-file-input");
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

async function testFirefoxGeminiPasteRawAlreadyLandedIsReplaced() {
  const rawSecret = "LeakGuardPasteApiKey1234567890";
  const rawText = `API_KEY=${rawSecret}`;
  const { editor, child } = createGeminiEditor(rawText);
  const { maybeHandlePaste, calls } = createHarness({
    location: { hostname: "gemini.google.com" },
    setInputText: (input, text) => {
      calls.primaryTextWrites = calls.primaryTextWrites || [];
      calls.primaryTextWrites.push({ input, text });
      input.text = `${input.text}\n${text}`;
    },
    forceRewriteInputText: (input, text) => {
      calls.forceTextWrites = calls.forceTextWrites || [];
      calls.forceTextWrites.push({ input, text });
      input.text = `${input.text}\n${text}`;
    },
    document: {
      activeElement: editor,
      execCommand(command, _showUi, value) {
        assert.strictEqual(command, "insertText");
        editor.text += `\n${value}`;
        return true;
      },
      createRange: () => null
    }
  });
  const { event, calls: eventCalls } = createClipboardEvent({
    text: rawText,
    target: child
  });

  await maybeHandlePaste(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(eventCalls.stopImmediatePropagation, 1);
  assert.strictEqual(editor.text, "API_KEY=[PWM_1]");
  assert.strictEqual(editor.text.includes(rawSecret), false);
  assert.ok(calls.directTextWrites?.length >= 1, "Firefox fallback should force a direct redacted rewrite");
  assert.strictEqual(calls.redactions.length, 1);
}

async function testFirefoxGeminiPasteDuplicateRegressionIsCollapsed() {
  const rawSecret = "LeakGuardPasteApiKey1234567890";
  const rawText = `API_KEY=${rawSecret}`;
  const { editor, child } = createGeminiEditor("");
  const { maybeHandlePaste, calls } = createHarness({
    location: { hostname: "gemini.google.com" },
    document: {
      activeElement: editor,
      execCommand(command, _showUi, value) {
        assert.strictEqual(command, "insertText");
        editor.text = `${rawText}\n${value}`;
        return true;
      },
      createRange: () => null
    }
  });
  const { event } = createClipboardEvent({
    text: rawText,
    target: child
  });

  await maybeHandlePaste(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(editor.text, "API_KEY=[PWM_1]");
  assert.strictEqual(editor.text.includes(rawSecret), false);
  assert.ok(calls.directTextWrites?.length >= 1, "duplicate raw+redacted state should be force-rewritten");
}

async function testFirefoxGeminiMultilinePasteUsesVerifiedTextInsertion() {
  const rawSecret = "LeakGuardPasteApiKey1234567890";
  const rawText = [
    `OPENAI_API_KEY=${rawSecret}`,
    `ANTHROPIC_API_KEY=${rawSecret}`,
    `GITHUB_TOKEN=${rawSecret}`
  ].join("\n");
  const sanitizedText = [
    "OPENAI_API_KEY=[PWM_1]",
    "ANTHROPIC_API_KEY=[PWM_2]",
    "GITHUB_TOKEN=[PWM_3]"
  ].join("\n");
  const { editor, child } = createGeminiEditor("");
  const { maybeHandlePaste, calls } = createHarness({
    navigator: { userAgent: "Firefox" },
    location: { hostname: "gemini.google.com" },
    document: {
      activeElement: editor,
      execCommand(command, _showUi, value) {
        assert.strictEqual(command, "insertText");
        editor.text = String(value || "").replace(/\n/g, "");
        return true;
      }
    },
    requestRedaction: async () => ({
      redactedText: sanitizedText
    })
  });
  const { event, calls: eventCalls } = createClipboardEvent({
    text: rawText,
    target: child
  });

  await maybeHandlePaste(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(eventCalls.stopImmediatePropagation, 1);
  assert.strictEqual(editor.text, sanitizedText);
  assert.strictEqual(editor.text.includes(rawSecret), false);
  assert.strictEqual(calls.textFallbacks.length, 0);
  assert.ok(editor.textContentWrites >= 1, "collapsed Firefox insert should be repaired with the newline-preserving writer");
  assert.ok(
    calls.debugEvents.some(
      (entry) =>
        entry.label === "gemini-text:firefox-insert-text" &&
        entry.details?.verified === false
    ),
    "expected Firefox Gemini multiline paste to reject the collapsed native insert"
  );
  assert.ok(
    calls.debugEvents.some(
      (entry) =>
        entry.label === "gemini-text:firefox-multiline-preserving-retry" &&
        entry.details?.verified === true
    ),
    "expected Firefox Gemini multiline paste to repair line breaks with verified DOM insertion"
  );
}

async function testGeminiQlEditorPastePauseInsertsRawText() {
  const rawSecret = "LeakGuardPasteApiKey1234567890";
  const rawText = `API_KEY=${rawSecret}`;
  const { editor, child } = createGeminiEditor("");
  const { maybeHandlePaste, calls } = createHarness({
    location: { hostname: "gemini.google.com" },
    isProtectionPauseActiveAfterPolicy: () => true,
    promptForSensitiveContentDecision: async (_findings, _mode, _policy, _input, _normalizedText) => {
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
  assert.strictEqual(calls.handoffs[0].context, "gemini-file-input");
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
  assert.strictEqual(calls.handoffs.length, 0);
  assert.strictEqual(calls.textFallbacks.length, 1);
  assert.strictEqual(calls.textFallbacks[0].insertedText.includes(rawSecret), false);
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
  assert.strictEqual(calls.handoffs.length, 0);
  assert.strictEqual(calls.textFallbacks.length, 0);
  assert.strictEqual(calls.runtimeMessages.length, 1);
  assert.strictEqual(calls.runtimeMessages[0].redactedText.includes(rawSecret), false);
  assert.ok(calls.runtimeMessages[0].redactedText.includes("[PWM_1]"));
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
    selection: { start: 0, end: 0 },
    closest: () => null
  };
  const fileInput = createFileInput({ multiple: true });
  const sanitizedFile = {
    name: "large-stream.env",
    type: "text/plain",
    size: 15,
    async text() {
      throw new Error("streaming ChatGPT handoff must not read sanitized fallback text");
    }
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
  assert.strictEqual(calls.handoffs.length, 0);
  assert.strictEqual(calls.originalFileInputHandoffs.length, 1);
  assert.strictEqual(calls.originalFileInputHandoffs[0].fileInput, fileInput);
  assert.strictEqual(fileInput.files[0], sanitizedFile);
  assert.deepStrictEqual(fileInput.events, ["input", "change"]);
  assert.strictEqual(calls.runtimeMessages.length, 0);
  assert.strictEqual(calls.modals.some(([title]) => title === "Raw file upload blocked"), false);
  assert.ok(calls.badges.some(([message]) => String(message || "").includes("Streaming redaction")));
  assert.ok(calls.badges.some(([message]) => message === "LeakGuard attached a sanitized local file."));
  assert.ok(calls.debugEvents.some((entry) => entry.label === "file-handoff:direct-attempt-success"));
  assert.ok(calls.debugEvents.some((entry) => entry.label === "file-ui:processing-shown"));
  assert.ok(
    calls.debugEvents.some(
      (entry) =>
        entry.label === "file-ui:processing-updated" &&
        String(entry.details.status || "").includes("Stream-redacting locally... 100%") &&
        entry.details.progress?.text === "100%"
    ),
    "expected streaming progress percentage UI"
  );
  assert.ok(calls.debugEvents.some((entry) => entry.label === "file-ui:success-shown"));
  assert.ok(calls.debugEvents.some((entry) => entry.label === "file-ui:processing-hidden"));
}

async function testGenericStreamingDropWithoutFileInputQueuesPendingWithoutReadingSanitizedText() {
  const adapterHosts = [
    ["chatgpt", "chatgpt.com"],
    ["claude", "claude.ai"],
    ["openai", "chat.openai.com"],
    ["x", "x.com"],
    ["whatsapp", "web.whatsapp.com"]
  ];

  for (const [adapterId, hostname] of adapterHosts) {
    const rawSecret = "LeakGuardDropApiKey1234567890";
    const sanitizedText = "API_KEY=[PWM_1]\ntoken_limit=4096";
    const sourceFile = {
      name: `${adapterId}-large-stream-no-input.env`,
      type: "text/plain",
      size: 5 * 1024 * 1024,
      async text() {
        throw new Error(`${adapterId} streaming drop must not call file.text()`);
      }
    };
    const composer = {
      tagName: "TEXTAREA",
      text: "",
      selection: { start: 0, end: 0 }
    };
    const sanitizedFile = {
      name: `${adapterId}-large-stream-no-input.env`,
      type: "text/plain",
      size: sanitizedText.length,
      async text() {
        throw new Error(`${adapterId} streamed handoff must not read sanitized text fallback`);
      }
    };
    const { maybeHandleDrop, calls } = createHarness({
      location: { hostname },
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
      target: composer
    });

    await maybeHandleDrop(event);

    assert.strictEqual(event.defaultPrevented, true, `${adapterId} raw drop should be blocked`);
    assert.strictEqual(calls.reads.length, 1, `${adapterId} should read once`);
    assert.strictEqual(calls.redactions.length, 1, `${adapterId} should stream-redact once`);
    assert.strictEqual(calls.handoffs.length, 0, `${adapterId} should not use legacy direct handoff`);
    assert.strictEqual(calls.originalFileInputHandoffs?.length || 0, 0, `${adapterId} should not assign a missing input`);
    assert.strictEqual(calls.textFallbacks.length, 0, `${adapterId} should not read sanitized text fallback`);
    assert.strictEqual(calls.runtimeMessages.length, 0, `${adapterId} should not download fallback`);
    assert.strictEqual(composer.text, "", `${adapterId} should not auto-insert streaming text`);
    assert.strictEqual(
      calls.modals.some(([title]) => title === "Raw file upload blocked"),
      false,
      `${adapterId} should queue pending instead of block`
    );
    assert.ok(
      calls.debugEvents.some(
        (entry) => entry.label === "file-handoff:generic-pending-queued" && entry.details?.site === adapterId
      ),
      `expected ${adapterId} generic pending queue`
    );
    assert.ok(
      calls.debugEvents.some(
        (entry) => entry.label === "file-handoff:pending-queued" && entry.details?.site === adapterId
      ),
      `expected ${adapterId} pending queue`
    );
    assert.ok(
      calls.debugEvents.some(
        (entry) => entry.label === "pending-attach-prompt-shown" && entry.details?.site === adapterId
      ),
      `expected ${adapterId} pending prompt`
    );
    assert.strictEqual(JSON.stringify(calls.debugEvents).includes(rawSecret), false);
  }
}

async function testGeminiStreamingDropQueuesPendingAfterStreamingWithoutTextFallback() {
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
      throw new Error("streaming Gemini pending handoff must not read sanitized fallback text");
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
  assert.strictEqual(calls.handoffs.length, 0);
  assert.strictEqual(calls.textFallbacks.length, 0);
  assert.strictEqual(calls.runtimeMessages.length, 0);
  assert.strictEqual(editor.text, "");
  assert.strictEqual(calls.modals.some(([title]) => title === "Raw file upload blocked"), false);
  assert.strictEqual(calls.modals.flat().join("\n").includes(rawSecret), false);
  assert.ok(
    calls.badges.some(([message]) =>
      String(message || "").includes("Click Attach sanitized file or Gemini Upload files")
    ),
    "expected user-click pending attach prompt"
  );
  const labels = calls.debugEvents.map((entry) => entry.label);
  const finishedIndex = labels.indexOf("streaming-redaction:finished");
  const queuedIndex = labels.indexOf("file-handoff:gemini-streaming-pending-queued");
  const processingHiddenIndex = labels.indexOf("file-ui:processing-hidden");
  const pendingUiIndex = labels.indexOf("file-ui:pending-prompt-shown");
  assert.ok(finishedIndex !== -1, "expected streaming finish log");
  assert.ok(queuedIndex > finishedIndex, "expected Gemini pending queue after streaming finishes");
  assert.ok(processingHiddenIndex > finishedIndex, "expected processing UI to hide after streaming finishes");
  assert.ok(pendingUiIndex > processingHiddenIndex, "expected pending attach prompt after processing UI hides");
  assert.ok(labels.includes("pending-attach-prompt-shown"), "expected pending attach prompt");
  assert.ok(labels.includes("pending-attach-synthetic-loop-suppressed"), "expected synthetic loop suppression");
  assert.ok(!labels.some((label) => /hidden-trigger-clicked/.test(label)), "expected no hidden trigger loop after queue");
}

async function testGeminiStreamingDropAtFiftyMiBQueuesPendingHandoff() {
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
  assert.strictEqual(calls.handoffs.length, 0);
  assert.strictEqual(calls.textFallbacks.length, 0);
  assert.strictEqual(editor.text, "");
  assert.strictEqual(calls.modals.some(([title]) => title === "Raw file upload blocked"), false);
  assert.ok(
    calls.debugEvents.some((entry) => entry.label === "file-handoff:gemini-streaming-pending-queued"),
    "expected Gemini streaming pending handoff"
  );
  assert.ok(
    calls.debugEvents.some((entry) => entry.label === "pending-attach-prompt-shown"),
    "expected pending attach prompt"
  );
  assert.strictEqual(JSON.stringify(calls.debugEvents).includes(rawSecret), false);
}

async function testGrokStreamingDropQueuesPendingAfterStreamingWithoutTextFallback() {
  const rawSecret = "LeakGuardDropApiKey1234567890";
  const sanitizedText = "API_KEY=[PWM_1]\ntoken_limit=4096";
  const sourceFile = {
    name: "large-grok.env",
    type: "text/plain",
    size: 5 * 1024 * 1024,
    async text() {
      throw new Error("streaming Grok drop must not read raw file text");
    }
  };
  const sanitizedFile = {
    name: "large-grok.env",
    type: "text/plain",
    size: sanitizedText.length,
    async text() {
      throw new Error("streaming Grok pending handoff must not read sanitized fallback text");
    }
  };
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
    target: composer
  });

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.reads.length, 1);
  assert.strictEqual(calls.redactions.length, 1);
  assert.strictEqual(calls.handoffs.length, 0);
  assert.strictEqual(calls.textFallbacks.length, 0);
  assert.strictEqual(calls.runtimeMessages.length, 0);
  assert.strictEqual(composer.text, "");
  assert.ok(
    calls.badges.some(([message]) =>
      String(message || "").includes("Click Attach sanitized file or Grok Upload/Attach")
    ),
    "expected Grok pending attach prompt"
  );
  const labels = calls.debugEvents.map((entry) => entry.label);
  const finishedIndex = labels.indexOf("streaming-redaction:finished");
  const queuedIndex = labels.indexOf("file-handoff:grok-streaming-pending-queued");
  const processingHiddenIndex = labels.indexOf("file-ui:processing-hidden");
  const pendingUiIndex = labels.indexOf("file-ui:pending-prompt-shown");
  assert.ok(finishedIndex !== -1, "expected streaming finish log");
  assert.ok(queuedIndex > finishedIndex, "expected Grok pending queue after streaming finishes");
  assert.ok(processingHiddenIndex > finishedIndex, "expected processing UI to hide after streaming finishes");
  assert.ok(pendingUiIndex > processingHiddenIndex, "expected pending attach prompt after processing UI hides");
  assert.ok(labels.includes("pending-attach-prompt-shown"), "expected pending attach prompt");
  assert.strictEqual(JSON.stringify(calls.debugEvents).includes(rawSecret), false);
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
  assert.ok(calls.debugEvents.some((entry) => entry.label === "file-ui:error-shown"));
  assert.ok(calls.debugEvents.some((entry) => entry.label === "file-ui:processing-hidden"));
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

function testProtectedUnsupportedImageDropBranchBlocksBeforeOriginalReplay() {
  const helperSource = extractFunctionSource(contentSource, "isUnsupportedImageFileForProtectedUpload");
  for (const extension of ['".gif"', '".bmp"', '".ico"', '".svg"']) {
    assert.ok(contentSource.includes(extension), `unsupported image helper should cover ${extension}`);
  }
  assert.ok(
    helperSource.includes("UNSUPPORTED_PROTECTED_IMAGE_EXTENSIONS"),
    "unsupported image helper should use the protected image denylist"
  );
  assert.ok(helperSource.includes("image/"), "unsupported image helper should cover unsupported image/* MIME types");

  const failClosedSource = extractFunctionSource(contentSource, "shouldFailClosedProtectedUnsupportedFileTransfer");
  assert.ok(
    failClosedSource.includes("isUnsupportedImageFileForProtectedUpload"),
    "protected unsupported fail-closed helper should include unsupported image files"
  );
  assert.ok(
    failClosedSource.includes("isUnsupportedBinaryFileForProtectedUpload"),
    "protected unsupported fail-closed helper should include unknown binary files"
  );

  const dropSource = extractFunctionSource(fileDropOrchestrationSource, "maybeHandleDrop");
  const protectedBlockIndex = dropSource.indexOf("shouldFailClosedProtectedUnsupportedFileTransfer(transferPolicy)");
  const replayIndex = dropSource.indexOf('handOffOriginalLocalFile(event, snapshotDataTransfer, "drop")');
  assert.notStrictEqual(protectedBlockIndex, -1, "drop handler should check protected unsupported fail-closed policy");
  if (replayIndex !== -1) {
    assert.ok(
      protectedBlockIndex < replayIndex,
      "protected unsupported image blocking must run before the Gemini raw original replay branch"
    );
  }
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
  assert.strictEqual(calls.handoffs.length, 0);
  assert.strictEqual(calls.textFallbacks.length, 1, "supported text fallback should use redacted content");
  assert.strictEqual(calls.textFallbacks[0].insertedText.includes(rawSecret), false);
  assert.ok(calls.textFallbacks[0].insertedText.includes("API_KEY=[PWM_1]"));
  assert.strictEqual(composer.text.includes(rawSecret), false);
  assert.ok(composer.text.includes("API_KEY=[PWM_1]"));
  assert.strictEqual(calls.modals.some(([title]) => title === "Raw file upload blocked"), false);
  assert.strictEqual(calls.modals.flat().join("\n").includes(rawSecret), false);
}

async function testWhatsAppFileHandoffFailsClosedWithoutTextFallback() {
  const calls = {
    textFallbacks: 0,
    downloads: 0,
    pending: 0,
    dmzStates: []
  };
  const flow = globalThis.PWM.createFileHandoffFlow({
    applySanitizedTextFallback: async () => {
      calls.textFallbacks += 1;
      return true;
    },
    createSanitizedDataTransfer: () => ({ files: [{ name: "sanitized.env" }] }),
    createSanitizedDataTransferForHandoff: () => ({ files: [{ name: "sanitized.env" }] }),
    createSanitizedFileHandoffDetails: () => ({}),
    createSanitizedPayload: (sanitizedFile, redactedText) => ({ sanitizedFile, redactedText }),
    describeFileForDebug: () => ({ extension: ".env", sizeBytes: 10 }),
    describeFileHandoffAdapter: (adapter) => ({ id: adapter?.id || "" }),
    downloadGeminiSanitizedFileFallback: async () => false,
    getCurrentHandoffDriverId: () => "whatsapp",
    getFileHandoffAdapterForLocation: () => ({ id: "whatsapp", supportsPendingAttach: false }),
    handOffSanitizedFileInput: () => {
      throw new Error("WhatsApp must not attempt sanitized file input assignment");
    },
    isFileHandoffAdapterPendingAttachEnabled: () => false,
    isProtectedFileDropDriver: () => true,
    queuePendingSanitizedFileHandoff: () => {
      calls.pending += 1;
      return true;
    },
    readSanitizedFileTextForFallback: async () => {
      calls.downloads += 1;
      return "API_KEY=[PWM_1]";
    },
    sendRuntimeMessage: async () => ({ ok: true }),
    setDmzOverlayState: (message, state) => calls.dmzStates.push({ message, state })
  });
  const driver = flow.getCurrentHandoffDriver();
  const result = await driver.handoff(
    {
      sanitizedFile: { name: "sanitized.env" },
      redactedText: "API_KEY=[PWM_1]"
    },
    {
      event: { type: "drop" },
      input: { tagName: "TEXTAREA", text: "" },
      context: "drop",
      driver,
      composerResolved: true
    }
  );

  assert.strictEqual(result.ok, false, "WhatsApp file handoff should fail closed");
  assert.strictEqual(result.reason, "whatsapp_file_attachments_unsupported");
  assert.strictEqual(calls.textFallbacks, 0, "WhatsApp should not insert sanitized file text into a message");
  assert.strictEqual(calls.downloads, 0, "WhatsApp should not offer file download fallback from composer handoff");
  assert.strictEqual(calls.pending, 0, "WhatsApp should not queue pending sanitized attachment replay");
  assert.deepStrictEqual(calls.dmzStates.at(-1), { message: "Raw file blocked", state: "failed" });
}

async function testWhatsAppSanitizedImageAttachVerifierRequiresRedactedPng() {
  const fileInput = createFileInput();
  const sanitizedImage = {
    name: "whatsapp-image.redacted.png",
    type: "image/png",
    size: 128
  };
  const flow = globalThis.PWM.createFileHandoffFlow({
    createSanitizedDataTransfer: (file) => ({ files: [file] }),
    describeFileForDebug: (file) => ({ name: file?.name || "", type: file?.type || "", size: file?.size || 0 }),
    getCurrentHandoffDriverId: () => "whatsapp",
    getFileHandoffAdapterById: () => ({ id: "whatsapp", supportsSanitizedImageAttachHandoff: true }),
    getFileHandoffAdapterForLocation: () => ({ id: "whatsapp", supportsSanitizedImageAttachHandoff: true }),
    handOffSanitizedFileInput: (targetInput, transfer) => {
      targetInput.files = transfer.files;
      targetInput.dispatchEvent({ type: "input", bubbles: true, composed: true });
      targetInput.dispatchEvent({ type: "change", bubbles: true, composed: true });
      return true;
    }
  });

  const ok = await flow.handOffSanitizedLocalFile({ type: "change", target: fileInput }, null, sanitizedImage, "file-input");

  assert.strictEqual(ok, true);
  assert.strictEqual(fileInput.files.length, 1);
  assert.strictEqual(fileInput.files[0], sanitizedImage);
  assert.deepStrictEqual(fileInput.events, ["input", "change"]);

  const invalidFileInput = createFileInput();
  const invalid = await flow.handOffSanitizedLocalFile(
    { type: "change", target: invalidFileInput },
    null,
    { name: "whatsapp-image.txt", type: "text/plain", size: 32 },
    "file-input"
  );

  assert.strictEqual(invalid, false);
  assert.strictEqual(invalidFileInput.files.length, 0);
  assert.deepStrictEqual(invalidFileInput.events, []);
}

async function testWhatsAppSanitizedTextDocumentAttachVerifierRequiresCanonicalTextType() {
  for (const [name, type] of [
    ["lgqa-wa-doc.txt", "text/plain"],
    ["lgqa-wa-doc.env", "text/plain"],
    ["lgqa-wa-doc.json", "application/json"],
    ["lgqa-wa-doc.log", "text/plain"],
    ["lgqa-wa-doc.md", "text/markdown"],
    ["lgqa-wa-doc.csv", "text/csv"],
    ["lgqa-wa-doc.yaml", "text/yaml"],
    ["lgqa-wa-doc.pem", "text/plain"],
    ["lgqa-wa-doc.ps1", "text/plain"],
    ["lgqa-wa-doc.py", "text/x-python"],
    ["lgqa-wa-doc.sql", "application/sql"],
    ["Dockerfile", "text/plain"],
    ["Makefile", "text/plain"]
  ]) {
    const fileInput = createFileInput();
    const sanitizedDocument = {
      name,
      type,
      size: 64,
      async text() {
        return "OPENAI_API_KEY=[PWM_1]";
      }
    };
    const flow = globalThis.PWM.createFileHandoffFlow({
      createSanitizedDataTransfer: (file) => ({ files: [file] }),
      describeFileForDebug: (file) => ({ name: file?.name || "", type: file?.type || "", size: file?.size || 0 }),
      getCurrentHandoffDriverId: () => "whatsapp",
      getFileHandoffAdapterById: () => ({
        id: "whatsapp",
        supportsSanitizedTextDocumentAttachHandoff: true
      }),
      getFileHandoffAdapterForLocation: () => ({
        id: "whatsapp",
        supportsSanitizedTextDocumentAttachHandoff: true
      }),
      handOffSanitizedFileInput: (targetInput, transfer) => {
        targetInput.files = transfer.files;
        targetInput.dispatchEvent({ type: "input", bubbles: true, composed: true });
        targetInput.dispatchEvent({ type: "change", bubbles: true, composed: true });
        return true;
      }
    });

    const ok = await flow.handOffSanitizedLocalFile(
      { type: "change", target: fileInput },
      null,
      sanitizedDocument,
      "file-input"
    );

    assert.strictEqual(ok, true, `${name} should be accepted as a sanitized WhatsApp text document`);
    assert.strictEqual(fileInput.files.length, 1);
    assert.strictEqual(fileInput.files[0], sanitizedDocument);
    assert.deepStrictEqual(fileInput.events, ["input", "change"]);
  }

  for (const invalid of [
    { name: "lgqa-wa-doc.pdf", type: "application/pdf", size: 64 },
    { name: "lgqa-wa-doc.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 64 },
    { name: "lgqa-wa-doc.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 64 },
    { name: "lgqa-wa-extensionless", type: "text/plain", size: 64 },
    { name: "lgqa-wa-mime-only", type: "text/yaml", size: 64 },
    { name: "lgqa-wa-doc.exe", type: "text/plain", size: 64 }
  ]) {
    const invalidFileInput = createFileInput();
    const flow = globalThis.PWM.createFileHandoffFlow({
      createSanitizedDataTransfer: (file) => ({ files: [file] }),
      describeFileForDebug: (file) => ({ name: file?.name || "", type: file?.type || "", size: file?.size || 0 }),
      getCurrentHandoffDriverId: () => "whatsapp",
      getFileHandoffAdapterById: () => ({
        id: "whatsapp",
        supportsSanitizedTextDocumentAttachHandoff: true
      }),
      getFileHandoffAdapterForLocation: () => ({
        id: "whatsapp",
        supportsSanitizedTextDocumentAttachHandoff: true
      }),
      handOffSanitizedFileInput: () => {
        throw new Error(`${invalid.name} must be rejected before assignment`);
      }
    });

    const ok = await flow.handOffSanitizedLocalFile(
      { type: "change", target: invalidFileInput },
      null,
      invalid,
      "file-input"
    );

    assert.strictEqual(ok, false, `${invalid.name} should be rejected for WhatsApp canonical text attach`);
    assert.strictEqual(invalidFileInput.files.length, 0);
    assert.deepStrictEqual(invalidFileInput.events, []);
  }
}

async function testWhatsAppSanitizedPdfAttachVerifierRequiresRedactedPdf() {
  const fileInput = createFileInput();
  const sanitizedPdf = {
    name: "lgqa-wa-doc.redacted.pdf",
    type: "application/pdf",
    size: 256
  };
  const flow = globalThis.PWM.createFileHandoffFlow({
    createSanitizedDataTransfer: (file) => ({ files: [file] }),
    describeFileForDebug: (file) => ({ name: file?.name || "", type: file?.type || "", size: file?.size || 0 }),
    getCurrentHandoffDriverId: () => "whatsapp",
    getFileHandoffAdapterById: () => ({
      id: "whatsapp",
      supportsSanitizedPdfAttachHandoff: true
    }),
    getFileHandoffAdapterForLocation: () => ({
      id: "whatsapp",
      supportsSanitizedPdfAttachHandoff: true
    }),
    handOffSanitizedFileInput: (targetInput, transfer) => {
      targetInput.files = transfer.files;
      targetInput.dispatchEvent({ type: "input", bubbles: true, composed: true });
      targetInput.dispatchEvent({ type: "change", bubbles: true, composed: true });
      return true;
    }
  });

  const ok = await flow.handOffSanitizedLocalFile(
    { type: "change", target: fileInput },
    null,
    sanitizedPdf,
    "file-input"
  );

  assert.strictEqual(ok, true, "WhatsApp should accept a sanitized rebuilt PDF");
  assert.strictEqual(fileInput.files.length, 1);
  assert.strictEqual(fileInput.files[0], sanitizedPdf);
  assert.deepStrictEqual(fileInput.events, ["input", "change"]);

  for (const invalid of [
    { name: "lgqa-wa-doc.pdf", type: "application/pdf", size: 64 },
    { name: "lgqa-wa-doc.redacted.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 64 },
    { name: "lgqa-wa-doc.redacted.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 64 },
    { name: "lgqa-wa-doc.redacted.pdf", type: "application/octet-stream", size: 64 }
  ]) {
    const invalidFileInput = createFileInput();
    const invalidFlow = globalThis.PWM.createFileHandoffFlow({
      createSanitizedDataTransfer: (file) => ({ files: [file] }),
      describeFileForDebug: (file) => ({ name: file?.name || "", type: file?.type || "", size: file?.size || 0 }),
      getCurrentHandoffDriverId: () => "whatsapp",
      getFileHandoffAdapterById: () => ({
        id: "whatsapp",
        supportsSanitizedPdfAttachHandoff: true
      }),
      getFileHandoffAdapterForLocation: () => ({
        id: "whatsapp",
        supportsSanitizedPdfAttachHandoff: true
      }),
      handOffSanitizedFileInput: () => {
        throw new Error(`${invalid.name} must be rejected before PDF assignment`);
      }
    });

    const invalidOk = await invalidFlow.handOffSanitizedLocalFile(
      { type: "change", target: invalidFileInput },
      null,
      invalid,
      "file-input"
    );

    assert.strictEqual(invalidOk, false, `${invalid.name} should be rejected for WhatsApp Phase 3B`);
    assert.strictEqual(invalidFileInput.files.length, 0);
    assert.deepStrictEqual(invalidFileInput.events, []);
  }
}

async function testWhatsAppSanitizedDocxAttachVerifierRequiresRedactedDocx() {
  const fileInput = createFileInput();
  const sanitizedDocx = {
    name: "lgqa-wa-doc.redacted.docx",
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    size: 256
  };
  const flow = globalThis.PWM.createFileHandoffFlow({
    createSanitizedDataTransfer: (file) => ({ files: [file] }),
    describeFileForDebug: (file) => ({ name: file?.name || "", type: file?.type || "", size: file?.size || 0 }),
    getCurrentHandoffDriverId: () => "whatsapp",
    getFileHandoffAdapterById: () => ({
      id: "whatsapp",
      supportsSanitizedDocxAttachHandoff: true
    }),
    getFileHandoffAdapterForLocation: () => ({
      id: "whatsapp",
      supportsSanitizedDocxAttachHandoff: true
    }),
    handOffSanitizedFileInput: (targetInput, transfer) => {
      targetInput.files = transfer.files;
      targetInput.dispatchEvent({ type: "input", bubbles: true, composed: true });
      targetInput.dispatchEvent({ type: "change", bubbles: true, composed: true });
      return true;
    }
  });

  const ok = await flow.handOffSanitizedLocalFile(
    { type: "change", target: fileInput },
    null,
    sanitizedDocx,
    "file-input"
  );

  assert.strictEqual(ok, true, "WhatsApp should accept a sanitized rebuilt DOCX");
  assert.strictEqual(fileInput.files.length, 1);
  assert.strictEqual(fileInput.files[0], sanitizedDocx);
  assert.deepStrictEqual(fileInput.events, ["input", "change"]);

  for (const invalid of [
    { name: "lgqa-wa-doc.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 64 },
    { name: "lgqa-wa-doc.redacted.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 64 },
    { name: "lgqa-wa-doc.redacted.docx", type: "application/octet-stream", size: 64 },
    { name: "lgqa-wa-doc.redacted.pdf", type: "application/pdf", size: 64 }
  ]) {
    const invalidFileInput = createFileInput();
    const invalidFlow = globalThis.PWM.createFileHandoffFlow({
      createSanitizedDataTransfer: (file) => ({ files: [file] }),
      describeFileForDebug: (file) => ({ name: file?.name || "", type: file?.type || "", size: file?.size || 0 }),
      getCurrentHandoffDriverId: () => "whatsapp",
      getFileHandoffAdapterById: () => ({
        id: "whatsapp",
        supportsSanitizedDocxAttachHandoff: true
      }),
      getFileHandoffAdapterForLocation: () => ({
        id: "whatsapp",
        supportsSanitizedDocxAttachHandoff: true
      }),
      handOffSanitizedFileInput: () => {
        throw new Error(`${invalid.name} must be rejected before DOCX assignment`);
      }
    });

    const invalidOk = await invalidFlow.handOffSanitizedLocalFile(
      { type: "change", target: invalidFileInput },
      null,
      invalid,
      "file-input"
    );

    assert.strictEqual(invalidOk, false, `${invalid.name} should be rejected for WhatsApp Phase 3C`);
    assert.strictEqual(invalidFileInput.files.length, 0);
    assert.deepStrictEqual(invalidFileInput.events, []);
  }
}

async function testWhatsAppSanitizedImageAttachVerifierRejectsAssignedMismatch() {
  const fileInput = createFileInput();
  const rawFile = { name: "raw.png", type: "image/png", size: 128 };
  const sanitizedImage = {
    name: "raw.redacted.png",
    type: "image/png",
    size: 128
  };
  const flow = globalThis.PWM.createFileHandoffFlow({
    createSanitizedDataTransfer: (file) => ({ files: [file] }),
    describeFileForDebug: (file) => ({ name: file?.name || "", type: file?.type || "", size: file?.size || 0 }),
    getCurrentHandoffDriverId: () => "whatsapp",
    getFileHandoffAdapterById: () => ({ id: "whatsapp", supportsSanitizedImageAttachHandoff: true }),
    getFileHandoffAdapterForLocation: () => ({ id: "whatsapp", supportsSanitizedImageAttachHandoff: true }),
    handOffSanitizedFileInput: (targetInput) => {
      targetInput.files = [rawFile];
      return true;
    }
  });

  const ok = await flow.handOffSanitizedLocalFile({ type: "change", target: fileInput }, null, sanitizedImage, "file-input");

  assert.strictEqual(ok, false);
  assert.strictEqual(fileInput.files.length, 0);
}

async function testWhatsAppSanitizedPdfDropUsesDocumentInputWhenNoCompatibleInput() {
  const sanitizedPdf = {
    name: "lgqa-wa-doc.redacted.pdf",
    type: "application/pdf",
    size: 256
  };
  const mediaInput = createFileInput({ accept: "image/*", multiple: false });
  const documentInput = createFileInput({ accept: "*", multiple: true });
  const target = { tagName: "DIV" };
  const prepared = [];
  let documentInputResolved = false;
  const flow = globalThis.PWM.createFileHandoffFlow({
    createSanitizedDataTransfer: (file) => {
      assert.strictEqual(file, sanitizedPdf);
      return { files: [file], dropEffect: "none" };
    },
    describeFileForDebug: (file) => ({ name: file?.name || "", type: file?.type || "", size: file?.size || 0 }),
    getCurrentHandoffDriverId: () => "whatsapp",
    getFileHandoffAdapterById: () => ({
      id: "whatsapp",
      supportsSanitizedDropHandoff: true,
      supportsSanitizedPdfAttachHandoff: true
    }),
    getFileHandoffAdapterForLocation: () => ({
      id: "whatsapp",
      supportsSanitizedDropHandoff: true,
      supportsSanitizedPdfAttachHandoff: true
    }),
    handOffSanitizedFileInput: (targetInput, transfer, options) => {
      const restore = options.prepareInput?.(targetInput, Array.from(transfer.files || []));
      targetInput.files = transfer.files;
      targetInput.dispatchEvent({ type: "input", bubbles: true, composed: true });
      targetInput.dispatchEvent({ type: "change", bubbles: true, composed: true });
      restore?.();
      return true;
    },
    prepareFileInputForHandoff: (targetInput, files) => {
      prepared.push({ targetInput, files: Array.from(files || []) });
      return () => {};
    },
    resolveFileInputForHandoff: (_event, _input, options = {}) => (options.allowIncompatible ? mediaInput : null),
    resolveWhatsAppDocumentDropInputForHandoff: async (_event, _input, files) => {
      documentInputResolved = true;
      assert.strictEqual(files[0], sanitizedPdf);
      return documentInput;
    }
  });

  const ok = await flow.handOffSanitizedLocalFile({ type: "drop", target }, null, sanitizedPdf, "drop");

  assert.strictEqual(ok, true, "WhatsApp document drops should use the document input path when no compatible input exists");
  assert.strictEqual(documentInputResolved, true);
  assert.strictEqual(documentInput.files.length, 1);
  assert.strictEqual(documentInput.files[0], sanitizedPdf);
  assert.deepStrictEqual(documentInput.events, ["input", "change"]);
  assert.strictEqual(mediaInput.files.length, 0, "WhatsApp document drops must not be assigned to the media-only input");
  assert.strictEqual(prepared.length, 0, "WhatsApp document drops should not mutate a media-only input accept list");
}

async function testWhatsAppPreparedDropInputFailsOnAssignedIdentityMismatch() {
  const sanitizedPdf = {
    name: "lgqa-wa-doc.redacted.pdf",
    type: "application/pdf",
    size: 256
  };
  const mismatchedPdf = {
    name: "lgqa-wa-doc.redacted.pdf",
    type: "application/pdf",
    size: 256
  };
  const fileInput = createFileInput({ accept: "image/*", multiple: false });
  const flow = globalThis.PWM.createFileHandoffFlow({
    createSanitizedDataTransfer: () => ({ files: [sanitizedPdf], dropEffect: "none" }),
    describeFileForDebug: (file) => ({ name: file?.name || "", type: file?.type || "", size: file?.size || 0 }),
    handOffSanitizedFileInput: (targetInput) => {
      targetInput.files = [mismatchedPdf];
      return true;
    },
    getCurrentHandoffDriverId: () => "whatsapp",
    getFileHandoffAdapterById: () => ({
      id: "whatsapp",
      supportsSanitizedDropHandoff: true,
      supportsSanitizedPdfAttachHandoff: true
    }),
    getFileHandoffAdapterForLocation: () => ({
      id: "whatsapp",
      supportsSanitizedDropHandoff: true,
      supportsSanitizedPdfAttachHandoff: true
    }),
    prepareFileInputForHandoff: () => () => {},
    resolveFileInputForHandoff: (_event, _input, options = {}) => (options.allowIncompatible ? fileInput : null)
  });

  const ok = await flow.handOffSanitizedLocalFile({ type: "drop", target: { tagName: "DIV" } }, null, sanitizedPdf, "drop");

  assert.strictEqual(ok, false, "WhatsApp prepared drop input must fail closed if assigned identity is uncertain");
  assert.strictEqual(fileInput.files.length, 0);
}

function testWhatsAppDropResolverRechecksCachedInputAgainstSanitizedFileAccept() {
  const mediaInput = createFileInput({
    accept: "image/*,video/mp4",
    multiple: true
  });
  const documentInput = createFileInput({
    accept: "image/png,image/jpeg,image/webp,.txt,.env,.pdf,.docx,.xlsx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    multiple: true
  });
  const target = {
    nodeType: 1,
    tagName: "DIV",
    parentElement: null,
    closest: () => null
  };
  const harness = createHandoffHarness({
    hostname: "web.whatsapp.com",
    fileInputs: [mediaInput, documentInput]
  });

  const cached = harness.resolveFileInputForHandoff({ target }, null);
  assert.strictEqual(cached, mediaInput, "dragenter discovery should initially cache the first available input");

  const resolved = harness.resolveFileInputForHandoff({ target }, null, {
    expectedFiles: [
      {
        name: "lgqa-wa-pdf-secret.redacted.pdf",
        type: "application/pdf",
        size: 128
      }
    ]
  });
  assert.strictEqual(
    resolved,
    documentInput,
    "WhatsApp sanitized document drops must not reuse a cached media-only input"
  );
}

function testWhatsAppDropResolverKeepsCompatibleMediaInputForSanitizedImage() {
  const mediaInput = createFileInput({
    accept: "image/*,video/mp4",
    multiple: true
  });
  const documentInput = createFileInput({
    accept: ".txt,.env,.pdf,.docx,.xlsx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    multiple: true
  });
  const target = {
    nodeType: 1,
    tagName: "DIV",
    parentElement: null,
    closest: () => null
  };
  const harness = createHandoffHarness({
    hostname: "web.whatsapp.com",
    fileInputs: [mediaInput, documentInput]
  });

  harness.resolveFileInputForHandoff({ target }, null);
  const resolved = harness.resolveFileInputForHandoff({ target }, null, {
    expectedFiles: [
      {
        name: "lgqa-wa-image-secret.redacted.png",
        type: "image/png",
        size: 128
      }
    ]
  });
  assert.strictEqual(resolved, mediaInput, "WhatsApp sanitized image drops should keep the media-compatible input");
}

function testProtectedDriversShowDmzOverlayOnFileDrag() {
  for (const [hostname, protectedSite] of [
    ["chatgpt.com", true],
    ["claude.ai", true],
    ["grok.com", true],
    ["example.internal", true]
  ]) {
    const harness = createDmzOverlayHarness({ hostname, currentSiteProtected: protectedSite });
    const dataTransfer = createDataTransfer({ exposeFiles: false });
    const { event } = createEvent({ dataTransfer });

    harness.maybeHandleFileDrag(event);

    assert.strictEqual(harness.appended.length, 1, `expected ${hostname} DMZ overlay`);
    assert.strictEqual(harness.getOverlay().className.includes("pwm-dmz"), true);
    assert.strictEqual(harness.getStatus().textContent, "Drop file to sanitize with LeakGuard");
    assert.strictEqual(harness.getOverlay().dataset.pwmState, "ready");
  }
}

function testNonProtectedGenericSiteDoesNotShowDmzOverlayOnFileDrag() {
  const harness = createDmzOverlayHarness({
    hostname: "random.example",
    currentSiteProtected: false
  });
  const dataTransfer = createDataTransfer({ exposeFiles: false });
  const { event } = createEvent({ dataTransfer });

  harness.maybeHandleFileDrag(event);

  assert.strictEqual(harness.appended.length, 0);
  assert.strictEqual(harness.getOverlay(), null);
}

async function testDmzOverlayStatesDuringSanitizedTextFallback() {
  const rawSecret = "LeakGuardDropApiKey1234567890";
  const composer = {
    tagName: "TEXTAREA",
    text: "",
    selection: { start: 0, end: 0 }
  };
  const { maybeHandleDrop, calls } = createHarness({
    location: { hostname: "claude.ai" },
    findComposer: () => composer
  });
  const { event } = createEvent({
    dataTransfer: {
      types: ["Files"],
      files: [
        createTextFile({
          name: "claude.env",
          text: `API_KEY=${rawSecret}`
        })
      ],
      items: [],
      dropEffect: "none"
    },
    target: composer
  });

  await maybeHandleDrop(event);

  assert.deepStrictEqual(
    calls.dmzStates.map((entry) => [entry.message, entry.state]),
    [
      ["Drop file to sanitize with LeakGuard", "ready"],
      ["Redacting...", "redacting"],
      ["Sanitized file ready", "ready"],
      ["Inserted sanitized content", "inserted"]
    ]
  );
  assert.ok(calls.dmzCleanups.includes(1800));
}

async function testDmzOverlayStatesDuringSanitizedFileAttach() {
  const rawSecret = "LeakGuardDropApiKey1234567890";
  const composer = {
    tagName: "TEXTAREA",
    text: "",
    selection: { start: 0, end: 0 }
  };
  const fileInput = createFileInput();
  const { maybeHandleDrop, calls } = createHarness({
    location: { hostname: "chatgpt.com" },
    findComposer: () => composer,
    resolveFileInputForHandoff: () => fileInput
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

  assert.deepStrictEqual(
    calls.dmzStates.map((entry) => [entry.message, entry.state]),
    [
      ["Drop file to sanitize with LeakGuard", "ready"],
      ["Redacting...", "redacting"],
      ["Sanitized file ready", "ready"],
      ["Attached sanitized file", "attached"]
    ]
  );
  assert.ok(calls.dmzCleanups.includes(1400));
}

async function testDmzOverlayFailedStateWhenLocalRedactionFails() {
  const composer = {
    tagName: "TEXTAREA",
    text: "",
    selection: { start: 0, end: 0 }
  };
  const { maybeHandleDrop, calls } = createHarness({
    location: { hostname: "grok.com" },
    findComposer: () => composer,
    requestRedaction: async () => {
      throw new Error("redaction unavailable");
    }
  });
  const { event } = createEvent({
    dataTransfer: {
      types: ["Files"],
      files: [
        createTextFile({
          name: "grok.env",
          text: "API_KEY=LeakGuardDropApiKey1234567890"
        })
      ],
      items: [],
      dropEffect: "none"
    },
    target: composer
  });

  await maybeHandleDrop(event);

  assert.ok(calls.dmzStates.some((entry) => entry.message === "Redacting..." && entry.state === "redacting"));
  assert.ok(calls.dmzStates.some((entry) => entry.message === "Raw file blocked" && entry.state === "failed"));
  assert.ok(calls.dmzCleanups.includes(3600));
}

async function testProtectedUnsupportedImageDropsFailClosedWithoutOriginalReplay() {
  for (const [extension, mimeType] of [
    [".gif", "image/gif"],
    [".bmp", "image/bmp"],
    [".ico", "image/x-icon"],
    [".svg", "image/svg+xml"],
    [".tiff", "image/tiff"]
  ]) {
    const rawSecret = `sk-proj-UnsupportedImageReplay${extension.replace(".", "")}1234567890abcdef`;
    const rawFile = createTextFile({
      name: `raw-image${extension}`,
      type: mimeType,
      text: `RAW_IMAGE_SECRET=${rawSecret}`
    });
    const target = {
      nodeType: 1,
      tagName: "DIV",
      dispatchedEvents: [],
      closest: () => null,
      dispatchEvent(event) {
        this.dispatchedEvents.push(event);
        return true;
      }
    };
    const { maybeHandleDrop, resolveFileDragGuardPolicy, calls } = createHarness({
      location: { hostname: "gemini.google.com" },
      document: {
        activeElement: target
      }
    });
    const transfer = {
      types: ["Files"],
      files: [rawFile],
      items: [],
      dropEffect: "none"
    };
    const dragPolicy = resolveFileDragGuardPolicy(transfer);
    const { event, calls: eventCalls } = createEvent({
      dataTransfer: transfer,
      target
    });

    await maybeHandleDrop(event);

    assert.strictEqual(dragPolicy.action, "block", `${extension} drag policy should fail closed`);
    assert.strictEqual(dragPolicy.reason, "unsupported_protected_file_blocked", `${extension} block reason`);
    assert.strictEqual(event.defaultPrevented, true, `${extension} drop should be consumed`);
    assert.strictEqual(eventCalls.stopImmediatePropagation, 1, `${extension} drop should stop page handlers`);
    assert.strictEqual(target.dispatchedEvents.length, 0, `${extension} must not replay the raw original drop`);
    assert.strictEqual(calls.reads.length, 0, `${extension} should not read unsupported image bytes as text`);
    assert.strictEqual(calls.redactions.length, 0, `${extension} should not run text redaction`);
    assert.strictEqual(calls.createdFiles.length, 0, `${extension} should not create a sanitized output`);
    assert.strictEqual(calls.handoffs.length, 0, `${extension} should not hand off a local file`);
    assert.strictEqual(calls.textFallbacks.length, 0, `${extension} should not insert OCR/text fallback`);
    assert.strictEqual(calls.runtimeMessages.length, 0, `${extension} should not start protected-site OCR`);
    assert.ok(
      calls.modals.some(
        ([title, message]) =>
          title === "Raw image upload blocked" &&
          String(message || "").includes("This image type is not supported for safe redaction")
      ),
      `${extension} should explain unsupported image blocking`
    );
    assert.strictEqual(
      calls.badges.some(([message]) => String(message || "").includes("normal upload may continue")),
      false,
      `${extension} should not show pass-through upload copy`
    );
    assert.strictEqual(JSON.stringify(calls).includes(rawSecret), false, `${extension} debug/UI state leaked raw marker`);
  }
}

async function testUnsupportedDocumentAndImageFilesPassThroughByDefault() {
  for (const name of [
    "archive.zip",
    "installer.exe"
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
  assert.strictEqual(
    calls.badges.some(([message]) => String(message || "").includes("normal upload may continue")),
    false
  );
  assert.ok(calls.badges.some(([message]) => String(message || "").includes("Raw file upload blocked")));
  assert.ok(calls.modals.some(([title]) => title === "Raw file upload blocked"));
}

async function testInvalidUtf8DropBlocksWithoutOriginalHandoff() {
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
        handled: true,
        ok: false,
        code: "invalid_utf8",
        message: "This file is not valid UTF-8 text, so LeakGuard did not scan it."
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
  assert.strictEqual(handedBackEvents.length, 0, "invalid UTF-8 drops must not be replayed to the site");
  assert.ok(calls.badges.some(([message]) => String(message || "").includes("Raw file blocked")));
  assert.ok(calls.modals.some(([title]) => title === "Raw file blocked"));
  assert.strictEqual(calls.modals.flat().join("\n").includes("not valid UTF-8"), true);
}

async function testFailedScanCannotReachOriginalOrSanitizedHandoff() {
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
        message: "This file is not valid UTF-8 text, so LeakGuard did not scan it."
      };
    },
    handOffSanitizedLocalFile() {
      throw new Error("failed scan must not reach sanitized handoff");
    },
    handOffSanitizedFileInput() {
      throw new Error("failed scan must not assign input.files");
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
  assert.strictEqual(calls.originalFileInputHandoffs?.length || 0, 0);
  assert.strictEqual(fileInput.files.length, 0);
  assert.deepStrictEqual(fileInput.events, []);
  assert.strictEqual(calls.redactions.length, 0);
  assert.strictEqual(calls.createdFiles.length, 0);
  assert.strictEqual(calls.handoffs.length, 0);
  assert.ok(calls.modals.some(([title]) => title === "Raw file blocked"));
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
    calls.debugEvents.some((entry) => entry.label === "chatgpt-large-paste:file-handoff-attempt"),
    "expected ChatGPT file handoff attempt diagnostics"
  );
  assert.ok(
    calls.debugEvents.some((entry) => entry.label === "chatgpt-large-paste:file-handoff-success"),
    "expected ChatGPT file handoff success diagnostics"
  );
  assert.ok(
    !calls.debugEvents.some((entry) => entry.label === "chatgpt-large-paste:text-fallback-start"),
    "text fallback must not run after ChatGPT file handoff succeeds"
  );
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
  assert.ok(
    calls.debugEvents.some((entry) => entry.label === "chatgpt-large-paste:file-handoff-failed"),
    "expected ChatGPT file handoff failed diagnostics"
  );
  assert.ok(
    calls.debugEvents.some((entry) => entry.label === "chatgpt-large-paste:text-fallback-start"),
    "expected ChatGPT text fallback start diagnostics"
  );
  assert.ok(
    calls.debugEvents.some((entry) => entry.label === "chatgpt-large-paste:text-fallback-success"),
    "expected ChatGPT verified text fallback diagnostics"
  );
  assert.ok(
    calls.debugEvents.some((entry) => entry.label === "chatgpt-sync:verification-pass"),
    "expected ChatGPT sync verification to pass"
  );
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

async function testChatGptContenteditableComposerRewriteSync() {
  const { text, repeatedKey, dbPassword, awsSecret } = buildLargeChatGptPastePayload();
  const redactedText = redactChatGptPasteFixture(text, repeatedKey, dbPassword, awsSecret);
  const composer = createChatGptContentEditableComposer("");
  let selected = false;
  const { maybeHandlePaste, calls } = createHarness({
    location: { hostname: "chatgpt.com" },
    getInputText: (input) => input?.text || "",
    getSelectionOffsets: (input) => input?.selection || { start: 0, end: 0 },
    analyzeText: (input) => ({
      normalizedText: input,
      secretFindings: input.includes(repeatedKey) ? [{ raw: repeatedKey }] : [],
      findings: input.includes(repeatedKey) ? [{ raw: repeatedKey }] : [],
      placeholderNormalized: false
    }),
    requestRedaction: async (input, findings) => {
      calls.redactions.push({ text: input, findings });
      return { redactedText };
    },
    handOffSanitizedLocalFile: (event, input, sanitizedFile, context) => {
      calls.handoffs.push({ event, input, sanitizedFile, context });
      return false;
    },
    document: {
      activeElement: composer,
      createRange: () => null,
      dispatchEvent: (event) => {
        calls.documentEvents = calls.documentEvents || [];
        calls.documentEvents.push(event.type);
        return true;
      },
      execCommand(command, _showUi, value) {
        calls.execCommands = calls.execCommands || [];
        calls.execCommands.push({ command, valueLength: typeof value === "string" ? value.length : null });
        if (command === "selectAll") {
          selected = true;
          return true;
        }
        if (command === "insertText" && selected) {
          composer.text = String(value || "");
          composer.selection = { start: composer.text.length, end: composer.text.length };
          selected = false;
          return true;
        }
        return false;
      },
      createElement: (tagName) => ({
        tagName: String(tagName || "").toUpperCase(),
        type: "",
        files: []
      })
    }
  });
  const { event } = createClipboardEvent({
    text,
    target: composer
  });

  await maybeHandlePaste(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.textFallbacks.length, 0);
  assert.strictEqual(composer.text, redactedText);
  assert.strictEqual(composer.innerText, redactedText);
  assert.strictEqual(composer.textContent, redactedText);
  assert.strictEqual(composer.text.includes(repeatedKey), false);
  assert.strictEqual(composer.text.includes(dbPassword), false);
  assert.strictEqual(composer.text.includes(awsSecret), false);
  assert.ok(calls.execCommands.some((entry) => entry.command === "selectAll"));
  assert.ok(calls.execCommands.some((entry) => entry.command === "insertText"));
  assert.ok(composer.events.some((entry) => entry.type === "beforeinput"));
  assert.ok(composer.events.some((entry) => entry.type === "input"));
  assert.ok(composer.events.some((entry) => entry.type === "change"));
  for (const label of [
    "chatgpt-sync:before-write",
    "chatgpt-sync:write-plan",
    "chatgpt-sync:after-write",
    "chatgpt-sync:react-state-nudge",
    "chatgpt-sync:verification-pass"
  ]) {
    assert.ok(calls.debugEvents.some((entry) => entry.label === label), `expected ${label}`);
  }
}

async function testChatGptOutOfSyncFallbackRetriesAndVerifies() {
  const { text, repeatedKey, dbPassword, awsSecret } = buildLargeChatGptPastePayload();
  const redactedText = redactChatGptPasteFixture(text, repeatedKey, dbPassword, awsSecret);
  const composer = {
    tagName: "TEXTAREA",
    text: "",
    selection: { start: 0, end: 0 }
  };
  let directWrites = 0;
  const { maybeHandlePaste, calls } = createHarness({
    location: { hostname: "chatgpt.com" },
    getInputText: (input) => {
      if (directWrites === 1 && !(calls.primaryTextWrites?.length)) {
        return "STALE_RAW_DOM_STATE";
      }
      return input?.text || "";
    },
    analyzeText: (input) => ({
      normalizedText: input,
      secretFindings: input.includes(repeatedKey) ? [{ raw: repeatedKey }] : [],
      findings: input.includes(repeatedKey) ? [{ raw: repeatedKey }] : [],
      placeholderNormalized: false
    }),
    requestRedaction: async (input, findings) => {
      calls.redactions.push({ text: input, findings });
      return { redactedText };
    },
    handOffSanitizedLocalFile: (event, input, sanitizedFile, context) => {
      calls.handoffs.push({ event, input, sanitizedFile, context });
      return false;
    },
    setInputTextDirect: (input, value, options = {}) => {
      directWrites += 1;
      calls.directTextWrites = calls.directTextWrites || [];
      calls.directTextWrites.push({ input, text: String(value || ""), options });
      input.text = String(value || "");
      return true;
    }
  });
  const { event } = createClipboardEvent({
    text,
    target: composer
  });

  await maybeHandlePaste(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.directTextWrites.length, 1);
  assert.strictEqual(calls.primaryTextWrites.length, 1);
  assert.strictEqual(composer.text.includes(repeatedKey), false);
  assert.strictEqual(composer.text.includes(dbPassword), false);
  assert.strictEqual(composer.text.includes(awsSecret), false);
  assert.ok(calls.debugEvents.some((entry) => entry.label === "chatgpt-sync:verification-failed"));
  assert.ok(calls.debugEvents.some((entry) => entry.label === "chatgpt-sync:react-state-nudge"));
  assert.ok(calls.debugEvents.some((entry) => entry.label === "chatgpt-sync:verification-pass"));
  assert.strictEqual(calls.modals.length, 0);
}

function testChatGptPendingAttachUsesGenericQueue() {
  const queueSource = extractFunctionSource(fileHandoffPendingSource, "queuePendingSanitizedFileHandoff");
  const adapters = createAdapterRegistryForTest();
  assert.ok(
    contentSource.includes("chatgpt: true") && adapters.chatgpt.pendingAttachEnabled === true,
    "ChatGPT pending attach should be enabled for sanitized provider handoff recovery"
  );
  assert.ok(
    queueSource.includes("queuePendingGenericSanitizedFileHandoff"),
    "ChatGPT should queue through the shared generic pending attach path"
  );
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
    handOffGeminiSanitizedFileUpload: (event, input, sanitizedFile) => {
      calls.handoffs.push({ event, input, sanitizedFile, context: "gemini-file-input" });
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

async function testFirefoxGeminiDropUsesPendingAttachHookAfterRedaction() {
  const rawSecret = "LeakGuardDropApiKey1234567890";
  const rawFile = createTextFile({
    name: "firefox-chrome-style.env",
    type: "text/plain",
    text: `API_KEY=${rawSecret}`
  });
  const { maybeHandleDrop, calls } = createHarness({
    navigator: { userAgent: "Firefox" },
    location: { hostname: "gemini.google.com" },
    readLocalTextFileFromDataTransfer: async () => ({
      handled: true,
      ok: true,
      text: `API_KEY=${rawSecret}`,
      file: rawFile
    }),
    requestRedaction: async (text, findings, options) => {
      calls.redactions.push({ text, findings, options });
      return { redactedText: "API_KEY=[PWM_1]" };
    },
    handOffGeminiSanitizedFileUpload: (event, input, sanitizedFile, _options) => {
      calls.handoffs.push({ event, input, sanitizedFile, context: "gemini-file-input" });
      throw new Error("Firefox Gemini drop should use pending attach hooks instead of automatic handoff");
    }
  });
  const { event } = createEvent({
    dataTransfer: {
      types: ["Files"],
      files: [rawFile],
      items: [],
      dropEffect: "none"
    },
    target: { tagName: "P", closest: () => null }
  });

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.handoffs.length, 0);
  assert.ok(calls.debugEvents.some((entry) => entry.label === "file-handoff:sanitized-file-created"));
  assert.ok(calls.debugEvents.some((entry) => entry.label === "file-handoff:firefox-gemini-drop-pending-queued"));
  assert.strictEqual(calls.debugEvents.some((entry) => entry.label === "file-handoff:direct-attempt-start"), false);
  assert.strictEqual(calls.debugEvents.some((entry) => entry.label === "file-handoff:fail-closed"), false);
  assert.deepStrictEqual(calls.badges.at(-1), [
    "Large file sanitized. Click Attach sanitized file or Gemini Upload files."
  ]);
  assert.strictEqual(JSON.stringify(calls.debugEvents).includes(rawSecret), false);
  assert.strictEqual(calls.textFallbacks.length, 0);
  assert.strictEqual(
    calls.debugEvents.some((entry) => entry.label === "file-handoff:gemini-firefox-prime-start"),
    false
  );
}

async function testFirefoxGeminiFileInputBridgeAssignsSanitizedFileOnly() {
  const rawSecret = "LeakGuardDropApiKey1234567890";
  const composer = createGeminiEditor("").editor;
  const fileInput = createFileInput({ source: "light-dom", name: "Filedata", multiple: true });
  const documentRoot = {
    activeElement: composer,
    body: {
      textContent: "",
      querySelectorAll(selector) {
        return selector === "input[type='file']" ? [fileInput] : [];
      }
    },
    querySelectorAll(selector) {
      if (selector === "input[type='file']") return [fileInput];
      if (selector === "*") return [];
      return [];
    },
    querySelector: () => null,
    createElement: (tagName) => ({
      tagName: String(tagName || "").toUpperCase(),
      type: "",
      files: []
    })
  };
  const rawFile = createTextFile({
    name: "firefox-gemini.env",
    text: `API_KEY=${rawSecret}`
  });
  const { maybeHandleDrop, calls } = createHarness({
    navigator: { userAgent: "Firefox" },
    location: { hostname: "gemini.google.com" },
    document: documentRoot,
    findComposer: () => composer,
    handOffGeminiSanitizedFileUpload: (event, input, sanitizedFile) => {
      calls.handoffs.push({ event, input, sanitizedFile, context: "gemini-file-input" });
      return false;
    }
  });
  const { event } = createEvent({
    dataTransfer: {
      types: ["Files"],
      files: [rawFile],
      items: [],
      dropEffect: "none"
    },
    target: composer
  });

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.redactions.length, 1);
  assert.strictEqual(fileInput.files.length, 1);
  assert.notStrictEqual(fileInput.files[0], rawFile);
  assert.strictEqual(fileInput.files[0].text.includes(rawSecret), false);
  assert.ok(fileInput.files[0].text.includes("[PWM_1]"));
  assert.deepStrictEqual(fileInput.events, ["input", "change"]);
  assert.strictEqual(calls.textFallbacks.length, 0);
  assert.ok(
    calls.dmzStates.some(({ message, state }) => message === "Attached sanitized file" && state === "attached")
  );
  assert.ok(
    calls.debugEvents.some(
      (entry) =>
        entry.label === "file-handoff:gemini-firefox-file-input-bridge-assigned" &&
        entry.details?.mode === "file-input-bridge" &&
        entry.details?.inputFound === true
    ),
    "expected Firefox Gemini file-input bridge diagnostics"
  );
  assert.strictEqual(JSON.stringify(calls.debugEvents).includes(rawSecret), false);
}

async function testFirefoxGeminiFileInputBridgeOpensExactAriaMenuButton() {
  const rawSecret = "LeakGuardDropApiKey1234567890";
  const sanitizedFile = {
    name: "exact-menu.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  const rawFile = {
    name: "exact-menu.env",
    type: "text/plain",
    size: 42,
    text: `API_KEY=${rawSecret}`
  };
  const fileInputs = [];
  const overlayItems = [];
  let harness;
  let pickerClick;
  const uploadFilesMenuItem = createOverlayItem({
    dataTestId: "local-images-files-uploader-button",
    onClick: () => {
      if (!fileInputs.length) {
        const input = createFileInput({ source: "light-dom", name: "Filedata", multiple: true });
        input.click = () => {
          throw new Error("Firefox Gemini bridge must not click input[type=file]");
        };
        input.showPicker = () => {
          throw new Error("Firefox Gemini bridge must not call showPicker");
        };
        fileInputs.push(input);
        pickerClick = createClickEvent(input);
        for (const handler of [...harness.windowClickHandlers, ...harness.clickHandlers]) {
          handler(pickerClick.event);
        }
      }
    }
  });
  const uploadTrigger = createUploadTrigger({
    ariaLabel: "Open upload file menu",
    className: "upload-card-button open",
    onClick: () => {
      if (!overlayItems.length) overlayItems.push(uploadFilesMenuItem);
    }
  });
  harness = createHandoffHarness({
    userAgent: "Firefox",
    fileInputs,
    uploadTriggers: [uploadTrigger],
    overlayItems
  });
  const event = {
    type: "drop",
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer({ files: [rawFile] })
  };

  const result = await harness.tryFirefoxGeminiFileInputBridge(
    { sanitizedFile, redactedText: sanitizedFile.text },
    { event, input: null }
  );

  assert.strictEqual(harness.findGeminiUploadMenuButton(), uploadTrigger);
  assert.strictEqual(harness.findGeminiUploadFilesMenuItem(), uploadFilesMenuItem);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.strategy, "gemini-firefox-file-input-bridge");
  assert.deepStrictEqual(uploadTrigger.events, ["pointerdown", "mousedown", "mouseup", "click"]);
  assert.deepStrictEqual(uploadFilesMenuItem.events, ["pointerdown", "mousedown", "mouseup", "click"]);
  assert.strictEqual(fileInputs.length, 1);
  assert.strictEqual(pickerClick.event.defaultPrevented, true);
  assert.strictEqual(pickerClick.event.immediatePropagationStopped, true);
  assert.strictEqual(fileInputs[0].files[0], sanitizedFile);
  assert.notStrictEqual(fileInputs[0].files[0], rawFile);
  assert.strictEqual(JSON.stringify(fileInputs[0].files).includes(rawSecret), false);
  assert.deepStrictEqual(fileInputs[0].events, ["input", "change"]);
  assert.strictEqual(harness.windowClickHandlers.length, 0);
  assert.strictEqual(harness.clickHandlers.length, 0);
  assert.strictEqual(harness.windowPointerHandlers.length, 0);
  assert.strictEqual(harness.documentPointerHandlers.length, 0);
}

async function testFirefoxGeminiFileInputBridgeOpensUploadToolsMenuButton() {
  const rawSecret = "LeakGuardDropApiKey1234567890";
  const sanitizedFile = {
    name: "upload-tools.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  const rawFile = {
    name: "upload-tools.env",
    type: "text/plain",
    size: 42,
    text: `API_KEY=${rawSecret}`
  };
  const fileInputs = [];
  const overlayItems = [];
  const uploadFilesMenuItem = createOverlayItem({
    ariaLabel: "Upload files. Documents, data, code files",
    text: "Upload files",
    onClick: () => {
      fileInputs.push(createFileInput({ source: "light-dom", name: "Filedata", multiple: true }));
    }
  });
  const uploadTrigger = createUploadTrigger({
    ariaLabel: "Upload & tools",
    className: "mdc-icon-button mat-mdc-icon-button mat-mdc-button-base mat-badge",
    onClick: () => {
      if (!overlayItems.length) overlayItems.push(uploadFilesMenuItem);
    }
  });
  const harness = createHandoffHarness({
    userAgent: "Firefox",
    fileInputs,
    uploadTriggers: [uploadTrigger],
    overlayItems
  });
  const event = {
    type: "drop",
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer({ files: [rawFile] })
  };

  const result = await harness.tryFirefoxGeminiFileInputBridge(
    { sanitizedFile, redactedText: sanitizedFile.text },
    { event, input: null }
  );

  assert.strictEqual(harness.findGeminiUploadMenuButton(), uploadTrigger);
  assert.strictEqual(harness.findGeminiUploadFilesMenuItem(), uploadFilesMenuItem);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.strategy, "gemini-firefox-file-input-bridge");
  assert.deepStrictEqual(uploadTrigger.events, ["pointerdown", "mousedown", "mouseup", "click"]);
  assert.deepStrictEqual(uploadFilesMenuItem.events, ["pointerdown", "mousedown", "mouseup", "click"]);
  assert.strictEqual(fileInputs[0].files[0], sanitizedFile);
  assert.notStrictEqual(fileInputs[0].files[0], rawFile);
  assert.strictEqual(JSON.stringify(harness.debugEvents).includes(rawSecret), false);
}

async function testFirefoxGeminiFileInputBridgeUsesUploadCardButtonFallback() {
  const sanitizedFile = {
    name: "class-menu.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  const fileInputs = [];
  const overlayItems = [];
  const uploadFilesMenuItem = createOverlayItem({
    dataTestId: "local-images-files-uploader-button",
    onClick: () => {
      fileInputs.push(createFileInput({ source: "light-dom", name: "Filedata", multiple: true }));
    }
  });
  const uploadTrigger = createUploadTrigger({
    ariaLabel: "Attach files",
    className: "upload-card-button open",
    onClick: () => {
      overlayItems.push(uploadFilesMenuItem);
    }
  });
  const harness = createHandoffHarness({
    userAgent: "Firefox",
    fileInputs,
    uploadTriggers: [uploadTrigger],
    overlayItems
  });
  const event = {
    type: "drop",
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer()
  };

  const result = await harness.tryFirefoxGeminiFileInputBridge(
    { sanitizedFile, redactedText: sanitizedFile.text },
    { event, input: null }
  );

  assert.strictEqual(harness.findGeminiUploadMenuButton(), uploadTrigger);
  assert.strictEqual(harness.findGeminiUploadFilesMenuItem(), uploadFilesMenuItem);
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(uploadTrigger.events, ["pointerdown", "mousedown", "mouseup", "click"]);
  assert.deepStrictEqual(uploadFilesMenuItem.events, ["pointerdown", "mousedown", "mouseup", "click"]);
  assert.strictEqual(fileInputs[0].files[0], sanitizedFile);
}

async function testFirefoxGeminiFileInputBridgeUsesSourceUploadIconFallback() {
  const sanitizedFile = {
    name: "source-icon.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  const fileInputs = [];
  const overlayItems = [];
  const uploadFilesMenuItem = createOverlayItem({
    dataTestId: "local-images-files-uploader-button",
    onClick: () => {
      fileInputs.push(createFileInput({ source: "light-dom", name: "Filedata", multiple: true }));
    }
  });
  const uploadTrigger = createGeminiSourceUploadIcon({
    onClick: () => {
      overlayItems.push(uploadFilesMenuItem);
    }
  });
  const harness = createHandoffHarness({
    userAgent: "Firefox",
    fileInputs,
    uploadTriggers: [uploadTrigger],
    overlayItems
  });
  const event = {
    type: "drop",
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer()
  };

  const result = await harness.tryFirefoxGeminiFileInputBridge(
    { sanitizedFile, redactedText: sanitizedFile.text },
    { event, input: null }
  );

  assert.strictEqual(harness.findGeminiUploadMenuButton(), uploadTrigger);
  assert.strictEqual(harness.findGeminiUploadFilesMenuItem(), uploadFilesMenuItem);
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(uploadTrigger.events, ["pointerdown", "mousedown", "mouseup", "click"]);
  assert.deepStrictEqual(uploadFilesMenuItem.events, ["pointerdown", "mousedown", "mouseup", "click"]);
  assert.strictEqual(fileInputs[0].files[0], sanitizedFile);
}

async function testFirefoxGeminiFileInputBridgeUsesAlreadyOpenUploadMenu() {
  const sanitizedFile = {
    name: "open-menu.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  const fileInputs = [];
  let harness;
  let pickerClick;
  const uploadFilesMenuItem = createOverlayItem({
    dataTestId: "local-images-files-uploader-button",
    onClick: () => {
      const input = createFileInput({ source: "light-dom", name: "Filedata", multiple: true });
      input.click = () => {
        throw new Error("already-open menu flow must not call input.click()");
      };
      input.showPicker = () => {
        throw new Error("already-open menu flow must not call input.showPicker()");
      };
      fileInputs.push(input);
      pickerClick = createClickEvent(input);
      for (const handler of [...harness.windowClickHandlers, ...harness.clickHandlers]) {
        handler(pickerClick.event);
      }
    }
  });
  const closeMenuButton = createUploadTrigger({
    ariaLabel: "Close upload file menu",
    className: "upload-card-button close",
    onClick: () => {
      throw new Error("already-open menu flow must not click the close button");
    }
  });
  harness = createHandoffHarness({
    userAgent: "Firefox",
    fileInputs,
    uploadTriggers: [closeMenuButton],
    overlayItems: [uploadFilesMenuItem]
  });
  const event = {
    type: "drop",
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer()
  };

  const result = await harness.tryFirefoxGeminiFileInputBridge(
    { sanitizedFile, redactedText: sanitizedFile.text },
    { event, input: null }
  );

  assert.strictEqual(harness.findGeminiUploadMenuButton(), null);
  assert.strictEqual(harness.findGeminiUploadFilesMenuItem(), uploadFilesMenuItem);
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(closeMenuButton.events, []);
  assert.deepStrictEqual(uploadFilesMenuItem.events, ["pointerdown", "mousedown", "mouseup", "click"]);
  assert.strictEqual(pickerClick.event.defaultPrevented, true);
  assert.strictEqual(pickerClick.event.immediatePropagationStopped, true);
  assert.strictEqual(fileInputs[0].name, "Filedata");
  assert.strictEqual(fileInputs[0].files[0], sanitizedFile);
  assert.ok(
    harness.debugEvents.some(
      (entry) =>
        entry.label === "file-handoff:gemini-firefox-file-input-bridge-menu-item-opened" &&
        entry.payload?.menuOpened === false
    ),
    "expected already-open upload menu diagnostics"
  );
}

async function testFirefoxGeminiFileInputBridgeCapturesDelayedFiledataAfterOpeningMenu() {
  const rawSecret = "LeakGuardDropApiKey1234567890";
  const sanitizedFile = {
    name: "delayed-closed-menu.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  const rawFile = {
    name: "delayed-closed-menu.env",
    type: "text/plain",
    size: 42,
    text: `API_KEY=${rawSecret}`
  };
  const fileInputs = [];
  const overlayItems = [];
  let harness;
  let pickerClick;
  let delayedInput;
  const uploadFilesMenuItem = createOverlayItem({
    dataTestId: "local-images-files-uploader-button",
    onClick: () => {
      const input = createFileInput({ source: "light-dom", name: "Filedata", multiple: true });
      input.click = () => {
        throw new Error("Firefox Gemini bridge must not call input.click()");
      };
      input.showPicker = () => {
        throw new Error("Firefox Gemini bridge must not call input.showPicker()");
      };
      delayedInput = input;
      const retarget = { nodeType: 1, tagName: "DIV" };
      pickerClick = createClickEvent(retarget, [retarget, input]);
      Promise.resolve().then(() => {
        for (const handler of [...harness.windowClickHandlers, ...harness.clickHandlers]) {
          handler(pickerClick.event);
        }
      });
    }
  });
  const uploadTrigger = createUploadTrigger({
    ariaLabel: "Open upload file menu",
    className: "upload-card-button open",
    onClick: () => {
      if (!overlayItems.length) overlayItems.push(uploadFilesMenuItem);
    }
  });
  harness = createHandoffHarness({
    userAgent: "Firefox",
    fileInputs,
    uploadTriggers: [uploadTrigger],
    overlayItems
  });
  const event = {
    type: "drop",
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer({ files: [rawFile] })
  };

  const result = await harness.tryFirefoxGeminiFileInputBridge(
    { sanitizedFile, redactedText: sanitizedFile.text },
    { event, input: null }
  );

  assert.strictEqual(result.ok, true);
  assert.strictEqual(pickerClick.event.defaultPrevented, true);
  assert.strictEqual(pickerClick.event.immediatePropagationStopped, true);
  assert.strictEqual(delayedInput.name, "Filedata");
  assert.strictEqual(delayedInput.files[0], sanitizedFile);
  assert.notStrictEqual(delayedInput.files[0], rawFile);
  assert.strictEqual(JSON.stringify(delayedInput.files).includes(rawSecret), false);
  assert.ok(
    harness.debugEvents.some(
      (entry) =>
        entry.label === "file-handoff:gemini-firefox-file-input-bridge-assigned" &&
        entry.payload?.inputFound === true
    ),
    "expected delayed Filedata capture to assign sanitized file"
  );
}

async function testFirefoxGeminiFileInputBridgeCapturesDelayedFiledataFromAlreadyOpenMenu() {
  const sanitizedFile = {
    name: "delayed-open-menu.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  const fileInputs = [];
  let harness;
  let pickerClick;
  let delayedInput;
  const uploadFilesMenuItem = createOverlayItem({
    dataTestId: "local-images-files-uploader-button",
    onClick: () => {
      const input = createFileInput({ source: "light-dom", name: "Filedata", multiple: true });
      delayedInput = input;
      const retarget = { nodeType: 1, tagName: "DIV" };
      pickerClick = createClickEvent(retarget, [retarget, input]);
      Promise.resolve().then(() => {
        for (const handler of [...harness.windowClickHandlers, ...harness.clickHandlers]) {
          handler(pickerClick.event);
        }
      });
    }
  });
  const closeMenuButton = createUploadTrigger({
    ariaLabel: "Close upload file menu",
    className: "upload-card-button close",
    onClick: () => {
      throw new Error("already-open delayed flow must not click the close button");
    }
  });
  harness = createHandoffHarness({
    userAgent: "Firefox",
    fileInputs,
    uploadTriggers: [closeMenuButton],
    overlayItems: [uploadFilesMenuItem]
  });
  const event = {
    type: "drop",
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer()
  };

  const result = await harness.tryFirefoxGeminiFileInputBridge(
    { sanitizedFile, redactedText: sanitizedFile.text },
    { event, input: null }
  );

  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(closeMenuButton.events, []);
  assert.strictEqual(pickerClick.event.defaultPrevented, true);
  assert.strictEqual(pickerClick.event.immediatePropagationStopped, true);
  assert.strictEqual(delayedInput.files[0], sanitizedFile);
  assert.ok(
    harness.listenerEvents.some((entry) => entry.action === "add" && entry.type === "click" && entry.capture),
    "expected capture-phase click guard to remain active for delayed input"
  );
}

async function testFirefoxGeminiPrimeCapturesDelayedFiledataBeforeSanitizedAssignment() {
  const rawFile = {
    name: "prime-delayed.env",
    type: "text/plain",
    size: 38,
    text: "API_KEY=LeakGuardDropApiKey1234567890"
  };
  const sanitizedFile = {
    name: "prime-delayed.env",
    type: "text/plain",
    size: 15,
    text: "API_KEY=[PWM_1]"
  };
  const fileInputs = [];
  let harness;
  let pickerClick;
  let delayedInput;
  const uploadFilesMenuItem = createOverlayItem({
    dataTestId: "local-images-files-uploader-button",
    onClick: () => {
      const input = createFileInput({ source: "light-dom", name: "Filedata", multiple: true });
      delayedInput = input;
      const retarget = { nodeType: 1, tagName: "DIV" };
      pickerClick = createClickEvent(retarget, [retarget, input]);
      Promise.resolve().then(() => {
        for (const handler of [...harness.windowClickHandlers, ...harness.clickHandlers]) {
          handler(pickerClick.event);
        }
      });
    }
  });
  const closeMenuButton = createUploadTrigger({
    ariaLabel: "Close upload file menu",
    className: "upload-card-button close",
    onClick: () => {
      throw new Error("priming must not click the close upload menu button");
    }
  });
  harness = createHandoffHarness({
    userAgent: "Firefox",
    fileInputs,
    uploadTriggers: [closeMenuButton],
    overlayItems: [uploadFilesMenuItem]
  });
  const event = {
    type: "drop",
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer({ files: [rawFile] })
  };

  const prime = harness.primeGeminiFirefoxUploadTarget(event, null);
  const capturedInput = await prime.inputPromise;

  assert.strictEqual(capturedInput, delayedInput);
  assert.strictEqual(pickerClick.event.defaultPrevented, true);
  assert.strictEqual(pickerClick.event.immediatePropagationStopped, true);
  assert.deepStrictEqual(closeMenuButton.events, []);
  assert.deepStrictEqual(Array.from(delayedInput.files || []), []);

  const result = await harness.handOffPrimedGeminiFirefoxUploadTarget(prime, sanitizedFile);

  assert.strictEqual(result.ok, true);
  assert.strictEqual(delayedInput.files[0], sanitizedFile);
  assert.notStrictEqual(delayedInput.files[0], rawFile);
  assert.deepStrictEqual(delayedInput.events, ["input", "change"]);
}

async function testFirefoxGeminiPrimeCapturesTransientMutationFiledataInput() {
  const sanitizedFile = {
    name: "prime-mutation.env",
    type: "text/plain",
    size: 15,
    text: "API_KEY=[PWM_1]"
  };
  const fileInputs = [];
  let harness;
  let transientInput;
  const uploadFilesMenuItem = createOverlayItem({
    dataTestId: "local-images-files-uploader-button",
    onClick: () => {
      transientInput = createFileInput({ source: "hidden", name: "Filedata", multiple: true });
      Promise.resolve().then(() => {
        const observer = harness.observers.find((candidate) => !candidate.disconnected);
        assert.ok(observer, "expected priming MutationObserver to remain active after Upload files click");
        observer.trigger([{ addedNodes: [transientInput], target: { nodeType: 1, tagName: "DIV" } }]);
      });
    }
  });
  const closeMenuButton = createUploadTrigger({
    ariaLabel: "Close upload file menu",
    className: "upload-card-button close",
    onClick: () => {
      throw new Error("priming must not click close while menu is already open");
    }
  });
  harness = createHandoffHarness({
    userAgent: "Firefox",
    fileInputs,
    uploadTriggers: [closeMenuButton],
    overlayItems: [uploadFilesMenuItem]
  });
  const event = {
    type: "drop",
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer()
  };

  const prime = harness.primeGeminiFirefoxUploadTarget(event, null);
  const capturedInput = await prime.inputPromise;

  assert.strictEqual(capturedInput, transientInput);
  assert.deepStrictEqual(Array.from(transientInput.files || []), []);

  const result = await harness.handOffPrimedGeminiFirefoxUploadTarget(prime, sanitizedFile);

  assert.strictEqual(result.ok, true);
  assert.strictEqual(transientInput.files[0], sanitizedFile);
  assert.deepStrictEqual(transientInput.events, ["input", "change"]);
}

async function testFirefoxGeminiPrimeActivatesHiddenSelectorFallbackAndCapturesFiledataClick() {
  const rawFile = { name: "prime-hidden.env", type: "text/plain", size: 20 };
  const sanitizedFile = {
    name: "prime-hidden.env",
    type: "text/plain",
    size: 15,
    text: "API_KEY=[PWM_1]"
  };
  let harness;
  let fileInput = null;
  const uploadFilesMenuItem = createOverlayItem({
    dataTestId: "local-images-files-uploader-button",
    onClick: () => {
      // Gemini's visible menu item does not expose Filedata by itself in Firefox.
    }
  });
  const hiddenTrigger = createHiddenFileSelectorTrigger({
    onClick: () => {
      assert.ok(
        harness.windowClickHandlers.length > 0 || harness.clickHandlers.length > 0,
        "file-input guard must still be active while hidden selector trigger is clicked"
      );
      fileInput = createFileInput({ source: "light-dom", name: "Filedata", multiple: true });
      fileInput.click = () => {
        throw new Error("LeakGuard must not call input.click()");
      };
      fileInput.showPicker = () => {
        throw new Error("LeakGuard must not call input.showPicker()");
      };
      const inputClick = createClickEvent(fileInput);
      for (const handler of [...harness.windowClickHandlers, ...harness.clickHandlers]) {
        handler(inputClick.event);
      }
      assert.strictEqual(inputClick.calls.preventDefault, 2);
      assert.strictEqual(inputClick.calls.stopImmediatePropagation, 2);
    }
  });
  harness = createHandoffHarness({
    userAgent: "Firefox",
    uploadTriggers: [
      createUploadTrigger({
        ariaLabel: "Close upload file menu",
        className: "upload-card-button close",
        onClick: () => {
          throw new Error("priming must not click close while menu is already open");
        }
      })
    ],
    hiddenTriggers: [hiddenTrigger],
    overlayItems: [uploadFilesMenuItem]
  });
  const event = {
    type: "drop",
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer([rawFile])
  };

  const prime = harness.primeGeminiFirefoxUploadTarget(event, null);
  const capturedInput = await prime.inputPromise;

  assert.strictEqual(capturedInput, fileInput);
  assert.ok(hiddenTrigger.events.includes("click"), "expected hidden selector trigger click");
  assert.ok(harness.debugEvents.some((entry) => entry.label === "file-handoff:gemini-firefox-prime-hidden-trigger-found"));
  assert.ok(harness.debugEvents.some((entry) => entry.label === "file-handoff:gemini-firefox-prime-hidden-trigger-clicked"));
  assert.ok(harness.debugEvents.some((entry) => entry.label === "file-handoff:gemini-firefox-prime-filedata-input-captured"));

  const result = await harness.handOffPrimedGeminiFirefoxUploadTarget(prime, sanitizedFile);

  assert.strictEqual(result.ok, true);
  assert.strictEqual(fileInput.files[0], sanitizedFile);
  assert.notStrictEqual(fileInput.files[0], rawFile);
  assert.deepStrictEqual(fileInput.events, ["input", "change"]);
  assert.ok(
    harness.debugEvents.some((entry) => entry.label === "file-handoff:gemini-firefox-prime-sanitized-file-assigned")
  );
}

async function testFirefoxGeminiPrimeClicksHiddenSelectorBeforeSanitizedFileExists() {
  let harness;
  const uploadFilesMenuItem = createOverlayItem({
    dataTestId: "local-images-files-uploader-button"
  });
  const hiddenTrigger = createHiddenFileSelectorTrigger();
  harness = createHandoffHarness({
    userAgent: "Firefox",
    uploadTriggers: [
      createUploadTrigger({
        ariaLabel: "Close upload file menu",
        className: "upload-card-button close",
        onClick: () => {
          throw new Error("priming must not click close while menu is already open");
        }
      })
    ],
    hiddenTriggers: [hiddenTrigger],
    overlayItems: [uploadFilesMenuItem]
  });
  const event = {
    type: "drop",
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer()
  };

  const prime = harness.primeGeminiFirefoxUploadTarget(event, null);
  harness.debugEvents.push({ label: "file-handoff:sanitized-file-created", payload: {} });
  await prime.inputPromise;

  const labels = harness.debugEvents.map((entry) => entry.label);
  const menuItemIndex = labels.indexOf("file-handoff:gemini-firefox-prime-menu-item-opened");
  const hiddenClickIndex = labels.indexOf("file-handoff:gemini-firefox-prime-hidden-trigger-clicked");
  const sanitizedIndex = labels.indexOf("file-handoff:sanitized-file-created");

  assert.ok(menuItemIndex !== -1, "expected Upload files menu item to open during prime");
  assert.ok(hiddenClickIndex !== -1, "expected hidden selector fallback to run during prime");
  assert.ok(sanitizedIndex !== -1, "expected synthetic sanitized-file-created marker");
  assert.ok(menuItemIndex < hiddenClickIndex, "hidden trigger must run after Upload files menu item click");
  assert.ok(hiddenClickIndex < sanitizedIndex, "hidden trigger must run before sanitized file creation");
  assert.deepStrictEqual(Array.from(hiddenTrigger.events), ["pointerdown", "mousedown", "mouseup", "click"]);
}

async function testFirefoxGeminiPrimeHiddenSelectorFallbackAcceptsObservedFiledataInput() {
  const sanitizedFile = {
    name: "prime-hidden-observed.env",
    type: "text/plain",
    size: 15,
    text: "API_KEY=[PWM_1]"
  };
  let harness;
  let observedInput = null;
  const uploadFilesMenuItem = createOverlayItem({
    dataTestId: "local-images-files-uploader-button"
  });
  const hiddenTrigger = createHiddenFileSelectorTrigger({
    onClick: () => {
      observedInput = createFileInput({ source: "light-dom", name: "Filedata", multiple: true });
      Promise.resolve().then(() => {
        const observer = harness.observers.find((candidate) => !candidate.disconnected);
        assert.ok(observer, "expected MutationObserver to remain active after hidden selector trigger click");
        observer.trigger([{ addedNodes: [observedInput], target: { nodeType: 1, tagName: "DIV" } }]);
      });
    }
  });
  harness = createHandoffHarness({
    userAgent: "Firefox",
    uploadTriggers: [
      createUploadTrigger({
        ariaLabel: "Open upload file menu",
        className: "upload-card-button open",
        onClick: () => {}
      })
    ],
    hiddenTriggers: [hiddenTrigger],
    overlayItems: [uploadFilesMenuItem]
  });
  const event = {
    type: "drop",
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer()
  };

  const prime = harness.primeGeminiFirefoxUploadTarget(event, null);
  const capturedInput = await prime.inputPromise;

  assert.strictEqual(capturedInput, observedInput);
  assert.ok(harness.debugEvents.some((entry) => entry.label === "file-handoff:gemini-firefox-prime-filedata-input-observed"));

  const result = await harness.handOffPrimedGeminiFirefoxUploadTarget(prime, sanitizedFile);

  assert.strictEqual(result.ok, true);
  assert.strictEqual(observedInput.files[0], sanitizedFile);
  assert.deepStrictEqual(observedInput.events, ["input", "change"]);
}

async function testFirefoxGeminiFileInputBridgeUsesUploadFilesTextOverlayItem() {
  const sanitizedFile = {
    name: "text-overlay.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  const fileInputs = [];
  const overlayItems = [];
  const uploadFilesMenuItem = createOverlayItem({
    ariaLabel: "",
    text: "Upload files",
    role: "menuitem",
    onClick: () => {
      fileInputs.push(createFileInput({ source: "light-dom", name: "Filedata", multiple: true }));
    }
  });
  const uploadTrigger = createUploadTrigger({
    ariaLabel: "Open upload file menu",
    className: "upload-card-button open",
    onClick: () => {
      overlayItems.push(uploadFilesMenuItem);
    }
  });
  const harness = createHandoffHarness({
    userAgent: "Firefox",
    fileInputs,
    uploadTriggers: [uploadTrigger],
    overlayItems
  });
  const event = {
    type: "drop",
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer()
  };

  const result = await harness.tryFirefoxGeminiFileInputBridge(
    { sanitizedFile, redactedText: sanitizedFile.text },
    { event, input: null }
  );

  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(uploadTrigger.events, ["pointerdown", "mousedown", "mouseup", "click"]);
  assert.deepStrictEqual(uploadFilesMenuItem.events, ["pointerdown", "mousedown", "mouseup", "click"]);
  assert.strictEqual(fileInputs[0].files[0], sanitizedFile);
}

async function testFirefoxGeminiFileInputBridgeRejectsNonUploadOverlayItems() {
  const sanitizedFile = {
    name: "non-upload-menu.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  const closeMenuButton = createUploadTrigger({
    ariaLabel: "Close upload file menu",
    className: "upload-card-button close",
    onClick: () => {
      throw new Error("close button must not be clicked when only non-upload menu items exist");
    }
  });
  const overlayItems = [
    createOverlayItem({
      ariaLabel: "Add from Drive. Sheets, Docs, Slides",
      text: "Add from Drive",
      onClick: () => {
        throw new Error("Drive menu item must not be clicked");
      }
    }),
    createOverlayItem({
      ariaLabel: "Google Photos",
      text: "Photos",
      onClick: () => {
        throw new Error("Photos menu item must not be clicked");
      }
    }),
    createOverlayItem({
      ariaLabel: "NotebookLM",
      text: "NotebookLM",
      onClick: () => {
        throw new Error("NotebookLM menu item must not be clicked");
      }
    })
  ];
  const harness = createHandoffHarness({
    userAgent: "Firefox",
    uploadTriggers: [closeMenuButton],
    overlayItems
  });
  const event = {
    type: "drop",
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer()
  };

  const result = await harness.tryFirefoxGeminiFileInputBridge(
    { sanitizedFile, redactedText: sanitizedFile.text },
    { event, input: null }
  );

  assert.strictEqual(result.ok, false);
  assert.strictEqual(harness.findGeminiUploadMenuButton(), null);
  assert.strictEqual(harness.findGeminiUploadFilesMenuItem(), null);
  assert.deepStrictEqual(closeMenuButton.events, []);
  overlayItems.forEach((item) => assert.deepStrictEqual(item.events, []));
}

async function testFirefoxGeminiFileInputBridgeAllowsHiddenSelectorAndCapturesFiledataInput() {
  const rawSecret = "LeakGuardDropApiKey1234567890";
  const sanitizedFile = {
    name: "hidden-selector.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  const rawFile = {
    name: "hidden-selector.env",
    type: "text/plain",
    size: 42,
    text: `API_KEY=${rawSecret}`
  };
  const fileInputs = [];
  const overlayItems = [];
  let hiddenSelectorClick = null;
  let inputClick = null;
  let harness;
  const uploadFilesMenuItem = createOverlayItem({
    dataTestId: "local-images-files-uploader-button",
    onClick: () => {
      const hiddenSelectorTrigger = createHiddenFileSelectorTrigger();
      hiddenSelectorClick = createClickEvent(hiddenSelectorTrigger);
      for (const handler of [...harness.windowClickHandlers, ...harness.clickHandlers]) {
        handler(hiddenSelectorClick.event);
      }
      const input = createFileInput({ source: "light-dom", name: "Filedata", multiple: true });
      fileInputs.push(input);
      inputClick = createClickEvent(input);
      for (const handler of [...harness.windowClickHandlers, ...harness.clickHandlers]) {
        handler(inputClick.event);
      }
    }
  });
  const uploadTrigger = createUploadTrigger({
    ariaLabel: "Open upload file menu",
    className: "upload-card-button open",
    onClick: () => {
      if (!overlayItems.length) overlayItems.push(uploadFilesMenuItem);
    }
  });
  harness = createHandoffHarness({
    userAgent: "Firefox",
    fileInputs,
    uploadTriggers: [uploadTrigger],
    overlayItems
  });
  const event = {
    type: "drop",
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer({ files: [rawFile] })
  };

  const result = await harness.tryFirefoxGeminiFileInputBridge(
    { sanitizedFile, redactedText: sanitizedFile.text },
    { event, input: null }
  );

  assert.strictEqual(result.ok, true);
  assert.strictEqual(hiddenSelectorClick.event.defaultPrevented, false);
  assert.strictEqual(hiddenSelectorClick.calls.stopImmediatePropagation, 0);
  assert.strictEqual(inputClick.event.defaultPrevented, true);
  assert.ok(inputClick.calls.stopImmediatePropagation >= 1);
  assert.strictEqual(fileInputs[0].name, "Filedata");
  assert.strictEqual(fileInputs[0].files[0], sanitizedFile);
  assert.notStrictEqual(fileInputs[0].files[0], rawFile);
  assert.strictEqual(JSON.stringify(fileInputs[0].files).includes(rawSecret), false);
  assert.deepStrictEqual(fileInputs[0].events, ["input", "change"]);
}

async function testFirefoxGeminiFileInputBridgeRejectsUnsafeUploadButtons() {
  const sanitizedFile = {
    name: "unsafe-menu.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  for (const label of ["Send", "Remove file", "Mic", "Microphone", "Settings", "Model", "Close", "Tools"]) {
    const uploadTrigger = createUploadTrigger({
      ariaLabel: label,
      className: "upload-card-button open",
      onClick: () => {
        throw new Error(`${label} must not be clicked`);
      }
    });
    const harness = createHandoffHarness({
      userAgent: "Firefox",
      uploadTriggers: [uploadTrigger]
    });
    const event = {
      type: "drop",
      target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
      dataTransfer: createDataTransfer()
    };

    const result = await harness.tryFirefoxGeminiFileInputBridge(
      { sanitizedFile, redactedText: sanitizedFile.text },
      { event, input: null }
    );

    assert.strictEqual(harness.findGeminiUploadMenuButton(), null, `${label} should be rejected`);
    assert.strictEqual(result.ok, false);
    assert.deepStrictEqual(uploadTrigger.events, []);
  }
}

async function testFirefoxGeminiFileInputBridgeDoesNotClickHiddenLocalUploadButtons() {
  const sanitizedFile = {
    name: "hidden-menu.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  const hiddenUpload = createUploadTrigger({
    ariaLabel: "Upload files",
    className: "hidden-local-upload-button",
    onClick: () => {
      throw new Error("hidden local upload button must not be clicked");
    }
  });
  const hiddenFileUpload = createUploadTrigger({
    ariaLabel: "Upload files",
    className: "hidden-local-file-upload-button",
    onClick: () => {
      throw new Error("hidden local file upload button must not be clicked");
    }
  });
  const harness = createHandoffHarness({
    userAgent: "Firefox",
    uploadTriggers: [hiddenUpload, hiddenFileUpload]
  });
  const event = {
    type: "drop",
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer()
  };

  const result = await harness.tryFirefoxGeminiFileInputBridge(
    { sanitizedFile, redactedText: sanitizedFile.text },
    { event, input: null }
  );

  assert.strictEqual(harness.findGeminiUploadMenuButton(), null);
  assert.strictEqual(result.ok, false);
  assert.deepStrictEqual(hiddenUpload.events, []);
  assert.deepStrictEqual(hiddenFileUpload.events, []);
}

async function testFirefoxGeminiFileInputBridgeFailsClosedWhenMenuOpensWithoutInput() {
  const sanitizedFile = {
    name: "missing-input.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  const overlayItems = [];
  const uploadFilesMenuItem = createOverlayItem({
    dataTestId: "local-images-files-uploader-button"
  });
  const uploadTrigger = createUploadTrigger({
    ariaLabel: "Open upload file menu",
    className: "upload-card-button open",
    onClick: () => {
      if (!overlayItems.length) overlayItems.push(uploadFilesMenuItem);
    }
  });
  const harness = createHandoffHarness({
    userAgent: "Firefox",
    uploadTriggers: [uploadTrigger],
    overlayItems
  });
  const event = {
    type: "drop",
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer()
  };

  const result = await harness.tryFirefoxGeminiFileInputBridge(
    { sanitizedFile, redactedText: sanitizedFile.text },
    { event, input: null }
  );

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.stage, "pending");
  assert.strictEqual(result.strategy, "gemini-firefox-pending-sanitized-file-handoff");
  assert.strictEqual(harness.hasPendingGeminiSanitizedFileHandoff(sanitizedFile), true);
  assert.deepStrictEqual(uploadTrigger.events, ["pointerdown", "mousedown", "mouseup", "click"]);
  assert.deepStrictEqual(uploadFilesMenuItem.events, ["pointerdown", "mousedown", "mouseup", "click"]);
  assert.deepStrictEqual(harness.badges.at(-1), [
    "Large file sanitized. Click Attach sanitized file or Gemini Upload files."
  ]);
}

async function testChromeGeminiFileInputBridgeRemainsInactive() {
  const sanitizedFile = {
    name: "chrome.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  const uploadTrigger = createUploadTrigger({
    ariaLabel: "Open upload file menu",
    className: "upload-card-button open",
    onClick: () => {
      throw new Error("Firefox-only bridge must not open Gemini menu in Chrome");
    }
  });
  const harness = createHandoffHarness({
    userAgent: "Chrome",
    uploadTriggers: [uploadTrigger]
  });
  const result = await harness.tryFirefoxGeminiFileInputBridge(
    { sanitizedFile, redactedText: sanitizedFile.text },
    {
      event: {
        type: "drop",
        target: { nodeType: 1, tagName: "DIV" },
        dataTransfer: createDataTransfer()
      },
      input: null
    }
  );

  assert.deepStrictEqual(result, { handled: false, ok: false });
  assert.deepStrictEqual(uploadTrigger.events, []);
}

async function testFirefoxGeminiFileInputBridgeMissingInputQueuesPendingHandoff() {
  const rawSecret = "LeakGuardDropApiKey1234567890";
  const composer = {
    tagName: "TEXTAREA",
    text: "",
    selection: { start: 0, end: 0 },
    dispatched: [],
    dispatchEvent(event) {
      this.dispatched.push(event);
      return true;
    }
  };
  const overlayItems = [];
  const uploadFilesMenuItem = createOverlayItem({
    dataTestId: "local-images-files-uploader-button"
  });
  const uploadTrigger = createUploadTrigger({
    ariaLabel: "Open upload file menu",
    className: "upload-card-button",
    onClick: () => {
      if (!overlayItems.length) overlayItems.push(uploadFilesMenuItem);
    }
  });
  const queryGeminiUploadDom = (selector) => {
    if (
      selector === 'button[data-test-id="local-images-files-uploader-button"]' ||
      selector === 'button[role="menuitem"][aria-label*="Upload files"]' ||
      selector === '[role="menuitem"]'
    ) {
      return overlayItems;
    }
    if (
      selector === 'button[aria-label="Open upload file menu"]' ||
      selector === "button.upload-card-button" ||
      selector === "button"
    ) {
      return [uploadTrigger, ...overlayItems];
    }
    if (selector === "*") return [];
    return [];
  };
  const documentRoot = {
    activeElement: composer,
    body: {
      textContent: "",
      querySelectorAll: queryGeminiUploadDom
    },
    querySelector: () => null,
    querySelectorAll: queryGeminiUploadDom,
    createElement: (tagName) => ({
      tagName: String(tagName || "").toUpperCase(),
      type: "",
      files: []
    })
  };
  const rawFile = createTextFile({
    name: "firefox-gemini-fallback.env",
    text: `API_KEY=${rawSecret}`
  });
  const { maybeHandleDrop, calls } = createHarness({
    navigator: { userAgent: "Firefox" },
    location: { hostname: "gemini.google.com" },
    document: documentRoot,
    findComposer: () => composer,
    handOffGeminiSanitizedFileUpload: (event, input, sanitizedFile) => {
      calls.handoffs.push({ event, input, sanitizedFile, context: "gemini-file-input" });
      return false;
    }
  });
  const { event } = createEvent({
    dataTransfer: {
      types: ["Files"],
      files: [rawFile],
      items: [],
      dropEffect: "none"
    },
    target: composer
  });

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.deepStrictEqual(composer.dispatched, []);
  assert.strictEqual(calls.handoffs.length, 0);
  assert.strictEqual(calls.textFallbacks.length, 0);
  assert.strictEqual(composer.text, "");
  assert.strictEqual(composer.text.includes(rawSecret), false);
  assert.ok(
    !calls.modals.some(
      ([title, message]) =>
        title === "Raw file upload blocked" &&
        message === "LeakGuard blocked the raw file drop. Could not locate Gemini upload input. Please use the upload button or retry."
    )
  );
  assert.ok(
    calls.debugEvents.some(
      (entry) => entry.label === "file-handoff:firefox-gemini-drop-pending-queued"
    ),
    "expected Firefox Gemini drop to queue pending sanitized file handoff through the attach hook"
  );
  assert.strictEqual(calls.debugEvents.some((entry) => entry.label === "file-handoff:direct-attempt-start"), false);
  assert.deepStrictEqual(calls.badges.at(-1), [
    "Large file sanitized. Click Attach sanitized file or Gemini Upload files."
  ]);
  assert.strictEqual(JSON.stringify(calls.debugEvents).includes(rawSecret), false);
}

async function testFirefoxGeminiFileInputBridgeUploadToolsMissQueuesPendingHandoff() {
  const rawSecret = "LeakGuardDropApiKey1234567890";
  const sanitizedFile = {
    name: "upload-tools-missing-input.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  const rawFile = {
    name: "upload-tools-missing-input.env",
    type: "",
    size: 522,
    text: `API_KEY=${rawSecret}`
  };
  const uploadTrigger = createUploadTrigger({
    ariaLabel: "Upload & tools",
    className: "mdc-icon-button mat-mdc-icon-button mat-mdc-button-base mat-badge",
    onClick: () => {}
  });
  const harness = createHandoffHarness({
    userAgent: "Firefox",
    uploadTriggers: [uploadTrigger],
    overlayItems: []
  });
  const event = {
    type: "drop",
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer({ files: [rawFile] })
  };

  const result = await harness.tryFirefoxGeminiFileInputBridge(
    { sanitizedFile, redactedText: sanitizedFile.text },
    { event, input: null }
  );

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.stage, "pending");
  assert.strictEqual(result.strategy, "gemini-firefox-pending-sanitized-file-handoff");
  assert.strictEqual(harness.hasPendingGeminiSanitizedFileHandoff(sanitizedFile), true);
  const miss = harness.debugEvents.find(
    (entry) => entry.label === "file-handoff:gemini-firefox-file-input-bridge-input-not-found"
  );
  assert.ok(miss, "expected missing input diagnostics");
  assert.strictEqual(miss.payload.safeUploadOpenerDiscovered, true);
  assert.strictEqual(miss.payload.uploadFlowWasReached, true);
  assert.strictEqual(miss.payload.queuedPending, true);
  assert.notStrictEqual(miss.payload?.overlay?.failureReason, "unsafe_upload_trigger");
  assert.strictEqual(JSON.stringify(harness.debugEvents).includes(rawSecret), false);
}

async function testFirefoxGeminiDropQueuesPendingBeforeFailClosedWhenBridgeHandledMiss() {
  const rawSecret = "LeakGuardDropApiKey1234567890";
  const composer = {
    tagName: "TEXTAREA",
    text: "",
    dispatchEvent: () => true
  };
  const rawFile = createTextFile({
    name: "firefox-gemini-terminal-miss.env",
    text: `API_KEY=${rawSecret}`
  });
  const { maybeHandleDrop, calls } = createHarness({
    navigator: { userAgent: "Firefox" },
    location: { hostname: "gemini.google.com" },
    findComposer: () => composer,
    document: {
      activeElement: composer,
      body: { textContent: "", querySelectorAll: () => [] },
      documentElement: { appendChild: () => {} },
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: (tagName) => ({
        tagName: String(tagName || "").toUpperCase(),
        type: "",
        files: [],
        dataset: {},
        style: {},
        className: "",
        textContent: "",
        setAttribute() {},
        append() {},
        appendChild() {},
        addEventListener() {},
        removeEventListener() {}
      }),
      addEventListener() {},
      removeEventListener() {}
    },
    handOffGeminiSanitizedFileUpload: () => false
  });
  const { event } = createEvent({
    dataTransfer: {
      types: ["Files"],
      files: [rawFile],
      items: [],
      dropEffect: "none"
    },
    target: composer
  });

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.debugEvents.some((entry) => entry.label === "file-handoff:fail-closed"), false);
  assert.strictEqual(calls.modals.some(([title]) => title === "Raw file upload blocked"), false);
  assert.ok(
    calls.debugEvents.some((entry) => entry.label === "file-handoff:pending-queued"),
    "expected terminal Firefox Gemini bridge miss to queue sanitized pending attach"
  );
  assert.deepStrictEqual(calls.badges.at(-1), [
    "Large file sanitized. Click Attach sanitized file or Gemini Upload files."
  ]);
  assert.strictEqual(JSON.stringify(calls.debugEvents).includes(rawSecret), false);
}

function testFirefoxGeminiFileInputBridgeDoesNotReplayOrOpenPicker() {
  const source = [
    extractFunctionSource(geminiFileHandoffSource, "tryFirefoxGeminiFileInputBridge"),
    extractFunctionSource(geminiFileHandoffSource, "waitForGeminiFileInput"),
    extractFunctionSource(contentSource, "openGeminiUploadMenuSafely"),
    extractFunctionSource(contentSource, "openGeminiUploadFilesMenuItemSafely"),
    extractFunctionSource(geminiFileHandoffSource, "createGeminiFirefoxFilePickerGuard")
  ].join("\n");
  assert.strictEqual(source.includes("new DragEvent"), false);
  assert.strictEqual(source.includes("dispatchSanitizedFileEvent"), false);
  assert.strictEqual(source.includes(".click("), false);
  assert.strictEqual(source.includes("showPicker"), false);
  assert.ok(
    source.includes("handOffSanitizedFileInput(fileInput, transfer"),
    "Firefox Gemini bridge should inject sanitized files through the real upload input"
  );
}

async function testFirefoxGeminiTextFallbackPreservesMultilineBlocks() {
  const rawSecret = "LeakGuardDropApiKey1234567890";
  const sanitizedText = [
    "OPENAI_API_KEY=[PWM_1]",
    "ANTHROPIC_API_KEY=[PWM_2]",
    "GITHUB_TOKEN=[PWM_3]",
    "STRIPE_SECRET_KEY=[PWM_4]",
    "DATABASE_URL=postgres://admin:[PWM_5]@db.example.com:5432/customerdb"
  ].join("\n");
  const rawText = sanitizedText.replace(/\[PWM_\d+\]/g, rawSecret);
  const { editor } = createGeminiEditor("stale raw editor text");
  const selection = {
    selectedEditor: null,
    removeAllRangesCalled: 0,
    addRangeCalled: 0,
    removeAllRanges() {
      this.removeAllRangesCalled += 1;
      this.selectedEditor = null;
    },
    addRange(range) {
      this.addRangeCalled += 1;
      this.selectedEditor = range.selectedEditor;
    }
  };
  const rawFile = createTextFile({
    name: "01-basic-secrets.env",
    type: "",
    text: rawText
  });
  const { maybeHandleDrop, calls } = createHarness({
    navigator: { userAgent: "Firefox" },
    location: { hostname: "gemini.google.com" },
    document: {
      activeElement: editor,
      body: {
        textContent: "",
        querySelectorAll: () => []
      },
      querySelector: () => null,
      querySelectorAll: () => [],
      createRange: () => ({
        selectedEditor: null,
        selectNodeContents(target) {
          this.selectedEditor = target;
        }
      }),
      execCommand(command, _showUi, value) {
        if (command === "insertText") {
          editor.text =
            selection.selectedEditor === editor
              ? String(value || "")
              : `${editor.text}${String(value || "")}`;
          return true;
        }
        return false;
      }
    },
    window: {
      getSelection: () => selection,
      setTimeout: (callback) => {
        callback();
        return 0;
      },
      requestAnimationFrame: (callback) => {
        callback();
        return 0;
      }
    },
    findComposer: () => editor,
    readLocalTextFileFromDataTransfer: async () => ({
      handled: true,
      ok: true,
      text: rawText,
      file: {
        name: "01-basic-secrets.env",
        type: "",
        sizeBytes: rawFile.size
      }
    }),
    requestRedaction: async () => ({
      redactedText: sanitizedText
    }),
    handOffGeminiSanitizedFileUpload: (event, input, sanitizedFile) => {
      calls.handoffs.push({ event, input, sanitizedFile, context: "gemini-file-input" });
      return false;
    }
  });
  const { event } = createEvent({
    dataTransfer: {
      types: ["Files"],
      files: [rawFile],
      items: [],
      dropEffect: "none"
    },
    target: editor
  });

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.textFallbacks.length, 0);
  assert.strictEqual(selection.removeAllRangesCalled, 1);
  assert.strictEqual(selection.addRangeCalled, 1);
  assert.ok(editor.text.includes(`LeakGuard sanitized file: 01-basic-secrets.env\n\n\`\`\`env\n${sanitizedText}\n\`\`\``));
  assert.strictEqual(editor.text.includes("stale raw editor text"), false);
  assert.strictEqual(editor.text.includes(rawSecret), false);
  assert.ok(
    calls.debugEvents.some(
      (entry) =>
        entry.label === "gemini-text:firefox-insert-text" &&
        entry.details?.verified === true
    ),
    "expected Firefox Gemini fallback to use verified text insertion for multiline text"
  );
}

async function testFirefoxGeminiTextFallbackFindsEditorFromParagraphContainer() {
  const rawSecret = "LeakGuardDropApiKey1234567890";
  const sanitizedText = "OPENAI_API_KEY=[PWM_1]\nANTHROPIC_API_KEY=[PWM_2]";
  const rawText = sanitizedText.replace(/\[PWM_\d+\]/g, rawSecret);
  const editor = {
    nodeType: 1,
    tagName: "DIV",
    className: "ql-editor",
    text: "",
    focusCalls: 0,
    inputEvents: [],
    attributes: {
      contenteditable: "true"
    },
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
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
    }
  };
  Object.defineProperty(editor, "textContent", {
    get() {
      return this.text;
    },
    set(value) {
      this.text = String(value || "");
    }
  });
  const promptContainer = {
    nodeType: 1,
    tagName: "RICH-TEXTAREA",
    querySelector(selector) {
      return /contenteditable|ql-editor|textarea/.test(selector) ? editor : null;
    }
  };
  const paragraphTarget = {
    nodeType: 1,
    tagName: "P",
    closest(selector) {
      return /rich-textarea|ql-container|text-input-field|input-area/.test(selector) ? promptContainer : null;
    }
  };
  const rawFile = createTextFile({
    name: "paragraph-container.env",
    type: "",
    text: rawText
  });
  const { maybeHandleDrop, calls } = createHarness({
    navigator: { userAgent: "Firefox" },
    location: { hostname: "gemini.google.com" },
    document: {
      activeElement: { tagName: "BUTTON", closest: () => null },
      body: {
        textContent: "",
        querySelectorAll: () => []
      },
      querySelector: () => null,
      querySelectorAll: () => [],
      execCommand(command, _showUi, value) {
        if (command === "insertText") {
          editor.text = String(value || "");
          return true;
        }
        return false;
      }
    },
    findComposer: () => null,
    readLocalTextFileFromDataTransfer: async () => ({
      handled: true,
      ok: true,
      text: rawText,
      file: {
        name: "paragraph-container.env",
        type: "",
        sizeBytes: rawFile.size
      }
    }),
    requestRedaction: async () => ({
      redactedText: sanitizedText
    }),
    handOffGeminiSanitizedFileUpload: (event, input, sanitizedFile) => {
      calls.handoffs.push({ event, input, sanitizedFile, context: "gemini-file-input" });
      return false;
    }
  });
  const { event } = createEvent({
    dataTransfer: {
      types: ["Files"],
      files: [rawFile],
      items: [],
      dropEffect: "none"
    },
    target: paragraphTarget
  });

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.textFallbacks.length, 0);
  assert.ok(editor.text.includes("LeakGuard sanitized file: paragraph-container.env"));
  assert.ok(editor.text.includes("OPENAI_API_KEY=[PWM_1]"));
  assert.strictEqual(editor.text.includes(rawSecret), false);
  assert.ok(editor.focusCalls > 0);
}

async function testFirefoxGeminiBlankTextInsertFallsBackToVerifiedRewrite() {
  const rawSecret = "LeakGuardDropApiKey1234567890";
  const sanitizedText = [
    "OPENAI_API_KEY=[PWM_1]",
    "ANTHROPIC_API_KEY=[PWM_2]",
    "GITHUB_TOKEN=[PWM_3]"
  ].join("\n");
  const rawText = sanitizedText.replace(/\[PWM_\d+\]/g, rawSecret);
  const { editor } = createGeminiEditor("");
  const rawFile = createTextFile({
    name: "blank-firefox-gemini.env",
    type: "",
    text: rawText
  });
  const { maybeHandleDrop, calls } = createHarness({
    navigator: { userAgent: "Firefox" },
    location: { hostname: "gemini.google.com" },
    document: {
      activeElement: editor,
      body: {
        textContent: "",
        querySelectorAll: () => []
      },
      querySelector: () => null,
      querySelectorAll: () => [],
      execCommand(command) {
        if (command === "insertText") {
          editor.text = "\n\n\n";
          return true;
        }
        return false;
      }
    },
    findComposer: () => editor,
    readLocalTextFileFromDataTransfer: async () => ({
      handled: true,
      ok: true,
      text: rawText,
      file: {
        name: "blank-firefox-gemini.env",
        type: "",
        sizeBytes: rawFile.size
      }
    }),
    requestRedaction: async () => ({
      redactedText: sanitizedText
    }),
    handOffGeminiSanitizedFileUpload: (event, input, sanitizedFile) => {
      calls.handoffs.push({ event, input, sanitizedFile, context: "gemini-file-input" });
      return false;
    }
  });
  const { event } = createEvent({
    dataTransfer: {
      types: ["Files"],
      files: [rawFile],
      items: [],
      dropEffect: "none"
    },
    target: editor
  });

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.textFallbacks.length, 1);
  assert.ok(editor.text.includes("LeakGuard sanitized file: blank-firefox-gemini.env"));
  assert.ok(editor.text.includes("OPENAI_API_KEY=[PWM_1]"));
  assert.strictEqual(editor.text.includes(rawSecret), false);
  assert.ok(
    calls.debugEvents.some(
      (entry) =>
        entry.label === "gemini-text:firefox-insert-text" &&
        entry.details?.verified === false
    ),
    "expected blank Firefox Gemini text insertion to be rejected before text fallback"
  );
}

async function testFirefoxGeminiEmptySanitizedTextDoesNotInsertBlankFallback() {
  const rawSecret = "LeakGuardDropApiKey1234567890";
  const { editor } = createGeminiEditor("");
  const rawFile = createTextFile({
    name: "empty-fallback.env",
    type: "text/plain",
    text: `API_KEY=${rawSecret}`
  });
  const { maybeHandleDrop, calls } = createHarness({
    navigator: { userAgent: "Firefox" },
    location: { hostname: "gemini.google.com" },
    document: {
      activeElement: editor,
      body: {
        textContent: "",
        querySelectorAll: () => []
      },
      querySelector: () => editor,
      querySelectorAll: () => []
    },
    findComposer: () => editor,
    requestRedaction: async () => ({
      redactedText: ""
    }),
    handOffGeminiSanitizedFileUpload: (event, input, sanitizedFile) => {
      calls.handoffs.push({ event, input, sanitizedFile, context: "gemini-file-input" });
      return false;
    }
  });
  const { event } = createEvent({
    dataTransfer: {
      types: ["Files"],
      files: [rawFile],
      items: [],
      dropEffect: "copy"
    },
    target: editor
  });

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(editor.text, "");
  assert.strictEqual(calls.textFallbacks.length, 0);
  assert.ok(calls.modals.some(([title]) => title === "Raw file upload blocked"));
  assert.strictEqual(JSON.stringify(calls.modals).includes(rawSecret), false);
}

async function testFirefoxGeminiItemsOnlyDropExtractsFileAndUsesFileInputBridge() {
  const rawSecret = "LeakGuardDropApiKey1234567890";
  const rawText = `OPENAI_API_KEY=${rawSecret}\nSAFE=value`;
  const rawFile = createReadableTextFile({
    name: "items-only-gemini.env",
    type: "text/plain",
    text: rawText
  });
  const { editor } = createGeminiEditor("");
  const fileInput = createFileInput({ source: "light-dom", name: "Filedata" });
  const dmzTarget = {
    nodeType: 1,
    tagName: "DIV",
    className: "pwm-dmz-box pwm-gemini-dmz-box",
    closest: () => null,
    dispatchEvent() {
      throw new Error("Firefox Gemini replay should not target the DMZ overlay");
    }
  };
  const documentRoot = {
    activeElement: dmzTarget,
    body: {
      textContent: "",
      querySelectorAll(selector) {
        return selector === "input[type='file']" ? [fileInput] : [];
      }
    },
    querySelector(selector) {
      return selector === ".ql-editor[contenteditable]" ? editor : null;
    },
    querySelectorAll(selector) {
      if (selector === "input[type='file']") return [fileInput];
      if (selector === "*") return [];
      return [];
    },
    createElement: (tagName) => ({
      tagName: String(tagName || "").toUpperCase(),
      type: "",
      files: []
    }),
    execCommand(command, _showUi, value) {
      assert.strictEqual(command, "insertText");
      editor.text = String(value || "");
      return true;
    }
  };
  const { maybeHandleDrop, calls } = createHarness({
    navigator: { userAgent: "Firefox" },
    location: { hostname: "gemini.google.com" },
    document: documentRoot,
    findComposer: () => null,
    readLocalTextFileFromDataTransfer: globalThis.PWM.FilePasteHelpers.readLocalTextFileFromDataTransfer,
    handOffGeminiSanitizedFileUpload: (event, input, sanitizedFile) => {
      calls.handoffs.push({ event, input, sanitizedFile, context: "gemini-file-input" });
      return false;
    }
  });
  const { event } = createEvent({
    dataTransfer: {
      types: ["Files"],
      files: [],
      items: [
        {
          kind: "file",
          type: "text/plain",
          getAsFile: () => rawFile
        }
      ],
      dropEffect: "copy",
      effectAllowed: "none"
    },
    target: dmzTarget
  });
  event.clientX = 0;
  event.clientY = 0;

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.textFallbacks.length, 0);
  assert.strictEqual(editor.text, "");
  assert.strictEqual(fileInput.files.length, 1);
  assert.notStrictEqual(fileInput.files[0], rawFile);
  assert.strictEqual(fileInput.files[0].text.includes(rawSecret), false);
  assert.ok(fileInput.files[0].text.includes("OPENAI_API_KEY=[PWM_1]"));
  assert.deepStrictEqual(fileInput.events, ["input", "change"]);
  assert.ok(
    calls.debugEvents.some(
      (entry) =>
        entry.label === "file-drop:firefox-items-snapshot" &&
        entry.details?.firefoxDataTransferFilesEmpty === true &&
        entry.details?.itemsFileCount === 1 &&
        entry.details?.itemsGetAsFileSucceeded === true &&
        entry.details?.snapshottedFileCount === 1
    ),
    "expected metadata-only Firefox DataTransfer.items snapshot diagnostics"
  );
  assert.ok(
    calls.debugEvents.some(
      (entry) =>
        entry.label === "file-handoff:gemini-firefox-file-input-bridge-assigned" &&
        entry.details?.mode === "file-input-bridge" &&
        entry.details?.inputFound === true
    ),
    "expected Firefox Gemini file-input bridge diagnostics"
  );
  assert.strictEqual(JSON.stringify(calls.debugEvents).includes(rawSecret), false);
}

async function testFirefoxGeminiItemsOnlyNullFileFailsClosed() {
  const dmzTarget = {
    nodeType: 1,
    tagName: "DIV",
    className: "pwm-dmz-box pwm-gemini-dmz-box",
    closest: () => null
  };
  const { maybeHandleDrop, calls } = createHarness({
    navigator: { userAgent: "Firefox" },
    location: { hostname: "gemini.google.com" },
    document: {
      activeElement: dmzTarget,
      body: {
        textContent: "",
        querySelectorAll: () => []
      },
      querySelector: () => null,
      querySelectorAll: () => []
    },
    findComposer: () => null,
    readLocalTextFileFromDataTransfer: () => {
      throw new Error("unavailable Firefox Gemini drop must not try to read a file");
    },
    handOffGeminiSanitizedFileUpload: () => {
      throw new Error("unavailable Firefox DataTransfer item must not reach sanitized file handoff");
    }
  });
  const { event } = createEvent({
    dataTransfer: {
      types: ["Files"],
      files: [],
      items: [
        {
          kind: "file",
          type: "text/plain",
          getAsFile: () => null
        }
      ],
      dropEffect: "copy",
      effectAllowed: "none"
    },
    target: dmzTarget
  });

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.handoffs.length, 0);
  assert.strictEqual(calls.textFallbacks.length, 0);
  assert.strictEqual(calls.redactions.length, 0);
  assert.strictEqual(calls.createdFiles.length, 0);
  assert.ok(calls.badges.some(([message]) => message === "Firefox drag/drop file unavailable"));
  assert.ok(calls.modals.some(([title]) => title === "Raw file blocked"));
  assert.ok(
    calls.modals.some(([, message]) =>
      String(message || "").includes("Use Gemini's upload button")
    )
  );
  assert.ok(
    calls.debugEvents.some(
      (entry) =>
        entry.label === "file-drop:firefox-items-snapshot" &&
        entry.details?.firefoxDataTransferFilesEmpty === true &&
        entry.details?.itemsFileCount === 1 &&
        entry.details?.itemsGetAsFileSucceeded === false &&
        entry.details?.snapshottedFileCount === 0
    ),
    "expected failed Firefox DataTransfer.items snapshot diagnostics"
  );
  assert.ok(
    calls.debugEvents.some(
      (entry) =>
        entry.label === "file-drop:firefox-gemini-file-unavailable" &&
        entry.details?.reason === "firefox_gemini_drop_file_unavailable"
    ),
    "expected fail-closed Firefox DataTransfer unavailable reason"
  );
}

async function testGeminiHiddenFileDropUsesSnapshotThenSanitizedTextFallback() {
  const rawSecret = "LeakGuardDropApiKey1234567890";
  const { editor, child } = createGeminiEditor("");
  const { maybeHandleDrop, calls } = createHarness({
    location: { hostname: "gemini.google.com" },
    findComposer: () => editor,
    handOffGeminiSanitizedFileUpload: (event, input, sanitizedFile) => {
      calls.handoffs.push({ event, input, sanitizedFile, context: "gemini-file-input" });
      return false;
    },
    document: {
      activeElement: editor,
      execCommand(_command, _showUi, _value) {
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
  assert.strictEqual(calls.handoffs[0].context, "gemini-file-input");
  assert.strictEqual(calls.textFallbacks.length, 1);
  assert.ok(editor.focusCalls >= 1);
  assert.ok(editor.text.includes("LeakGuard sanitized file: secrets.env"));
  assert.ok(editor.text.includes("API_KEY=[PWM_1]"));
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
    handOffGeminiSanitizedFileUpload: (event, input, sanitizedFile) => {
      calls.handoffs.push({ event, input, sanitizedFile, context: "gemini-file-input" });
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

async function testChatGptAndClaudeUseStructuredSanitizedTextWhenFileAttachUnavailable() {
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

    assert.strictEqual(calls.handoffs.length, 0, `expected ${hostname} no unsafe synthetic handoff`);
    assert.strictEqual(calls.textFallbacks.length, 1, `expected structured text fallback for ${hostname}`);
    assert.ok(calls.textFallbacks[0].insertedText.includes("LeakGuard sanitized file: secrets.env"));
    assert.ok(calls.textFallbacks[0].insertedText.includes("API_KEY=[PWM_1]"));
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
  assert.strictEqual(calls.handoffs.length, 0);
  assert.strictEqual(calls.textFallbacks.length, 1);
  assert.strictEqual(calls.textFallbacks[0].insertedText.includes(rawSecret), false);
  assert.ok(calls.textFallbacks[0].insertedText.includes("API_KEY=[PWM_1]"));
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
  assert.strictEqual(calls.handoffs.length, 0);
  assert.strictEqual(calls.textFallbacks.length, 1);
  assert.strictEqual(calls.textFallbacks[0].context, "file-text-fallback");
  assert.strictEqual(calls.textFallbacks[0].insertedText.includes(rawSecret), false);
  assert.strictEqual(composer.text.includes(rawSecret), false);
  assert.ok(composer.text.includes("API_KEY=[PWM_1]"));
  assert.strictEqual(calls.modals.some(([title]) => title === "Raw file upload blocked"), false);
}

async function testFirefoxChatGptFileInputReplacesSelectedFile() {
  const rawSecret = "LeakGuardFileApiKey1234567890";
  const fileInput = createFileInput();
  fileInput.files = [
    createTextFile({
      name: "chatgpt.env",
      text: `API_KEY=${rawSecret}`
    })
  ];
  const { maybeHandleFileInputChange, calls } = createHarness({
    location: { hostname: "chatgpt.com" },
    navigator: { userAgent: "Firefox" },
    findComposer: () => null,
    handOffSanitizedLocalFile: (event, input, sanitizedFile, context) => {
      calls.handoffs.push({ event, input, sanitizedFile, context });
      assert.strictEqual(event.target, fileInput);
      assert.strictEqual(context, "file-input");
      fileInput.files = [sanitizedFile];
      fileInput.dispatchEvent({ type: "input", bubbles: true, composed: true });
      fileInput.dispatchEvent({ type: "change", bubbles: true, composed: true });
      return true;
    }
  });
  const { event } = createEvent({
    type: "change",
    target: fileInput
  });

  await maybeHandleFileInputChange(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.handoffs[0].context, "file-input");
  assert.strictEqual(calls.textFallbacks.length, 0);
  assert.strictEqual(fileInput.files.length, 1);
  assert.strictEqual(fileInput.files[0].text, "API_KEY=[PWM_1]");
  assert.strictEqual(fileInput.files[0].text.includes(rawSecret), false);
  assert.deepStrictEqual(fileInput.events, ["input", "change"]);
}

async function testFirefoxChatGptFileInputReplacesBasicSecretsFixture() {
  const rawContent = fs.readFileSync(
    path.join(repoRoot, "tests/fixtures/01-basic-secrets.env"),
    "utf8"
  ).trim();
  const sanitizedContent = [
    "OPENAI_API_KEY=[PWM_1]",
    "ANTHROPIC_API_KEY=[PWM_2]",
    "GITHUB_TOKEN=[PWM_3]",
    "STRIPE_SECRET=[PWM_4]",
    "DB_PASSWORD=[PWM_5]"
  ].join("\n");
  const fileInput = createFileInput();
  fileInput.files = [
    createTextFile({
      name: "01-basic-secrets.env",
      type: "",
      text: rawContent
    })
  ];
  const { maybeHandleFileInputChange, calls } = createHarness({
    location: { hostname: "chatgpt.com" },
    navigator: { userAgent: "Firefox" },
    findComposer: () => null,
    analyzeText: (text) => ({
      normalizedText: text,
      secretFindings: [
        { raw: "sk-proj-" },
        { raw: "sk-ant-" },
        { raw: "ghp_" },
        { raw: "sk_live_" },
        { raw: "raw DB password" }
      ],
      findings: [
        { raw: "sk-proj-" },
        { raw: "sk-ant-" },
        { raw: "ghp_" },
        { raw: "sk_live_" },
        { raw: "raw DB password" }
      ],
      placeholderNormalized: false
    }),
    requestRedaction: async (text, findings, options) => {
      calls.redactions.push({ text, findings, options });
      return { redactedText: sanitizedContent };
    },
    handOffSanitizedLocalFile: (event, input, sanitizedFile, context) => {
      calls.handoffs.push({ event, input, sanitizedFile, context });
      assert.strictEqual(event.target, fileInput);
      assert.strictEqual(input, null);
      assert.strictEqual(context, "file-input");
      fileInput.files = [sanitizedFile];
      fileInput.dispatchEvent({ type: "input", bubbles: true, composed: true });
      fileInput.dispatchEvent({ type: "change", bubbles: true, composed: true });
      return true;
    }
  });
  const { event } = createEvent({
    type: "change",
    target: fileInput
  });

  await maybeHandleFileInputChange(event);

  const finalContent = fileInput.files[0]?.text || "";
  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.handoffs[0].context, "file-input");
  assert.strictEqual(calls.textFallbacks.length, 0);
  assert.strictEqual(finalContent.includes("sk-proj-"), false);
  assert.strictEqual(finalContent.includes("sk-ant-"), false);
  assert.strictEqual(finalContent.includes("ghp_"), false);
  assert.strictEqual(finalContent.includes("sk_live_"), false);
  assert.strictEqual(finalContent.includes("raw DB password"), false);
  ["[PWM_1]", "[PWM_2]", "[PWM_3]", "[PWM_4]", "[PWM_5]"].forEach((placeholder) => {
    assert.ok(finalContent.includes(placeholder), `expected ${placeholder} in final content`);
  });
  assert.strictEqual(finalContent.indexOf("[PWM_1]"), finalContent.lastIndexOf("[PWM_1]"));
  assert.deepStrictEqual(fileInput.events, ["input", "change"]);
}

async function testChromeFileInputDuplicateEventsShareOneProcessingRun() {
  const rawSecret = "LeakGuardFileApiKey1234567890";
  const rawFile = createTextFile({
    name: "duplicate-chrome.env",
    type: "text/plain",
    text: `API_KEY=${rawSecret}`
  });
  const fileInput = createFileInput();
  fileInput.files = [rawFile];
  const composer = {
    tagName: "TEXTAREA",
    text: "",
    selection: { start: 0, end: 0 }
  };
  let releaseRead;
  const readStarted = [];
  const readGate = new Promise((resolve) => {
    releaseRead = resolve;
  });
  const { maybeHandleFileInputChange, calls } = createHarness({
    location: { hostname: "chatgpt.com" },
    findComposer: () => composer,
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      readStarted.push(true);
      await readGate;
      return {
        handled: true,
        ok: true,
        text: `API_KEY=${rawSecret}`,
        file: {
          name: rawFile.name,
          type: rawFile.type,
          sizeBytes: rawFile.size,
          lastModified: rawFile.lastModified
        }
      };
    },
    handOffSanitizedLocalFile: (event, input, sanitizedFile, context) => {
      calls.handoffs.push({ event, input, sanitizedFile, context });
      fileInput.files = [sanitizedFile];
      fileInput.dispatchEvent({ type: "input", bubbles: true, composed: true });
      fileInput.dispatchEvent({ type: "change", bubbles: true, composed: true });
      return true;
    }
  });
  const first = createEvent({ type: "input", target: fileInput });
  const second = createEvent({ type: "change", target: fileInput });

  const firstPromise = maybeHandleFileInputChange(first.event);
  await Promise.resolve();
  assert.strictEqual(readStarted.length, 1);
  const secondResult = await maybeHandleFileInputChange(second.event);
  releaseRead();
  await firstPromise;

  assert.strictEqual(first.event.defaultPrevented, true);
  assert.strictEqual(second.event.defaultPrevented, true);
  assert.strictEqual(secondResult?.strategy, "duplicate-file-input-event-suppressed");
  assert.strictEqual(calls.reads.length, 1);
  assert.strictEqual(calls.redactions.length, 1);
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.handoffs[0].sanitizedFile.text.includes(rawSecret), false);
  assert.deepStrictEqual(fileInput.events, ["input", "change"]);
  assert.ok(calls.debugEvents.some((entry) => entry.label === "file-input:duplicate-raw-event-suppressed"));
}

async function testFirefoxFileInputDuplicateEventsShareOneTransaction() {
  const rawSecret = "LeakGuardFileApiKey1234567890";
  const rawFile = createTextFile({
    name: "duplicate-firefox.env",
    type: "",
    text: `API_KEY=${rawSecret}`
  });
  const fileInput = createFileInput();
  fileInput.files = [rawFile];
  let releaseRead;
  const readStarted = [];
  const readGate = new Promise((resolve) => {
    releaseRead = resolve;
  });
  const { maybeHandleFileInputChange, calls } = createHarness({
    location: { hostname: "gemini.google.com" },
    navigator: { userAgent: "Firefox" },
    findComposer: () => null,
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      readStarted.push(true);
      await readGate;
      return {
        handled: true,
        ok: true,
        text: `API_KEY=${rawSecret}`,
        file: {
          name: rawFile.name,
          type: rawFile.type,
          sizeBytes: rawFile.size,
          lastModified: rawFile.lastModified
        }
      };
    },
    handOffSanitizedLocalFile: (event, input, sanitizedFile, context) => {
      calls.handoffs.push({ event, input, sanitizedFile, context });
      fileInput.files = [sanitizedFile];
      fileInput.dispatchEvent({ type: "input", bubbles: true, composed: true });
      fileInput.dispatchEvent({ type: "change", bubbles: true, composed: true });
      return true;
    }
  });
  const first = createEvent({ type: "input", target: fileInput });
  const second = createEvent({ type: "change", target: fileInput });

  const firstPromise = maybeHandleFileInputChange(first.event);
  await Promise.resolve();
  assert.strictEqual(readStarted.length, 1);
  await maybeHandleFileInputChange(second.event);
  releaseRead();
  await firstPromise;

  assert.strictEqual(first.event.defaultPrevented, true);
  assert.strictEqual(second.event.defaultPrevented, true);
  assert.strictEqual(calls.reads.length, 1);
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.handoffs[0].sanitizedFile.text.includes(rawSecret), false);
  assert.deepStrictEqual(fileInput.events, ["input", "change"]);
  assert.strictEqual(calls.modals.some(([title]) => title === "Raw file blocked"), false);
  assert.ok(calls.badges.some(([message]) => message === "LeakGuard replaced the selected file with a sanitized copy."));
}

async function testFirefoxGeminiUploadInputReplacesSelectedFile() {
  const rawSecret = "LeakGuardFileApiKey1234567890";
  const rawFile = createTextFile({
    name: "gemini-upload.env",
    type: "text/plain",
    text: `API_KEY=${rawSecret}`
  });
  const fileInput = createFileInput();
  fileInput.files = [rawFile];
  const { maybeHandleFileInputChange, calls } = createHarness({
    location: { hostname: "gemini.google.com" },
    navigator: { userAgent: "Firefox" },
    findComposer: () => null,
    handOffSanitizedLocalFile: (event, input, sanitizedFile, context) => {
      calls.handoffs.push({ event, input, sanitizedFile, context });
      assert.strictEqual(event.target, fileInput);
      assert.strictEqual(context, "file-input");
      fileInput.files = [sanitizedFile];
      fileInput.dispatchEvent({ type: "input", bubbles: true, cancelable: true, composed: true });
      fileInput.dispatchEvent({ type: "change", bubbles: true, cancelable: true, composed: true });
      return true;
    }
  });
  const { event, calls: eventCalls } = createEvent({
    type: "input",
    target: fileInput
  });

  await maybeHandleFileInputChange(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(eventCalls.stopImmediatePropagation, 1);
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.handoffs[0].context, "file-input");
  assert.strictEqual(calls.redactions.length, 1);
  assert.strictEqual(fileInput.files.length, 1);
  assert.notStrictEqual(fileInput.files[0], rawFile);
  assert.strictEqual(fileInput.files[0].text, "API_KEY=[PWM_1]");
  assert.strictEqual(fileInput.files[0].text.includes(rawSecret), false);
  assert.deepStrictEqual(fileInput.events, ["input", "change"]);
  assert.strictEqual(calls.textFallbacks.length, 0);
  assert.strictEqual(calls.modals.some(([title]) => title === "Raw file blocked"), false);
  assert.ok(calls.badges.some(([message]) => message === "LeakGuard replaced the selected file with a sanitized copy."));
}

async function testFirefoxGeminiUploadReplacementFailureDoesNotTextFallback() {
  const rawSecret = "LeakGuardFileApiKey1234567890";
  const rawFile = createTextFile({
    name: "gemini-upload-fails.env",
    type: "text/plain",
    text: `API_KEY=${rawSecret}`
  });
  const fileInput = createFileInput();
  fileInput.files = [rawFile];
  const { maybeHandleFileInputChange, calls } = createHarness({
    location: { hostname: "gemini.google.com" },
    navigator: { userAgent: "Firefox" },
    findComposer: () => null,
    handOffSanitizedLocalFile: (event, input, sanitizedFile, context) => {
      calls.handoffs.push({ event, input, sanitizedFile, context });
      return false;
    }
  });
  const { event } = createEvent({
    type: "change",
    target: fileInput
  });

  await maybeHandleFileInputChange(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.textFallbacks.length, 0);
  assert.ok(calls.modals.some(([title]) => title === "Raw file upload blocked"));
  assert.strictEqual(JSON.stringify(calls.modals).includes(rawSecret), false);
}

async function testFirefoxGeminiUploadScanFailureBlocksRawFile() {
  const rawFile = createTextFile({
    name: "gemini-bad.env",
    type: "text/plain",
    text: "not decoded"
  });
  const fileInput = createFileInput();
  fileInput.files = [rawFile];
  fileInput.value = "C:\\fakepath\\gemini-bad.env";
  const { maybeHandleFileInputChange, calls } = createHarness({
    location: { hostname: "gemini.google.com" },
    navigator: { userAgent: "Firefox" },
    findComposer: () => null,
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      return {
        handled: false,
        ok: false,
        code: "invalid_utf8",
        message: "raw scan failure details must not be shown"
      };
    },
    handOffSanitizedLocalFile() {
      throw new Error("failed Firefox Gemini input scan must not hand off a file");
    }
  });
  const { event, calls: eventCalls } = createEvent({
    type: "input",
    target: fileInput
  });

  await maybeHandleFileInputChange(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(eventCalls.stopImmediatePropagation, 1);
  assert.strictEqual(fileInput.value, "");
  assert.strictEqual(calls.reads.length, 1);
  assert.strictEqual(calls.redactions.length, 0);
  assert.strictEqual(calls.createdFiles.length, 0);
  assert.strictEqual(calls.handoffs.length, 0);
  assert.strictEqual(fileInput.events.length, 0);
  assert.ok(calls.modals.some(([title]) => title === "Raw file blocked"));
  assert.ok(calls.modals.some(([, message]) => String(message || "").includes("Use Gemini's upload button again")));
  assert.strictEqual(calls.modals.flat().join("\n").includes("raw scan failure details"), false);
}

async function testFirefoxFileUnavailableDuplicateAfterReplacementIsIgnored() {
  const rawSecret = "LeakGuardFileApiKey1234567890";
  const rawFile = createTextFile({
    name: "duplicate-unavailable.env",
    type: "",
    text: `API_KEY=${rawSecret}`
  });
  const fileInput = createFileInput();
  fileInput.files = [rawFile];
  const { maybeHandleFileInputChange, calls } = createHarness({
    location: { hostname: "gemini.google.com" },
    navigator: { userAgent: "Firefox" },
    findComposer: () => null,
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      if (calls.reads.length > 1) {
        return {
          handled: true,
          ok: false,
          code: "file_unavailable",
          file: null,
          message: "The selected file is unavailable."
        };
      }
      return {
        handled: true,
        ok: true,
        text: `API_KEY=${rawSecret}`,
        file: {
          name: rawFile.name,
          type: rawFile.type,
          sizeBytes: rawFile.size,
          lastModified: rawFile.lastModified
        }
      };
    },
    handOffSanitizedLocalFile: (event, input, sanitizedFile, context) => {
      calls.handoffs.push({ event, input, sanitizedFile, context });
      fileInput.files = [sanitizedFile];
      fileInput.dispatchEvent({ type: "input", bubbles: true, composed: true });
      fileInput.dispatchEvent({ type: "change", bubbles: true, composed: true });
      return true;
    }
  });

  await maybeHandleFileInputChange(createEvent({ type: "input", target: fileInput }).event);
  fileInput.files = [];
  await maybeHandleFileInputChange(createEvent({ type: "change", target: fileInput }).event);

  assert.strictEqual(calls.reads.length, 1);
  assert.strictEqual(calls.handoffs.length, 1);
  assert.strictEqual(calls.modals.some(([title]) => title === "Raw file blocked"), false);
  assert.strictEqual(JSON.stringify(calls.modals).includes("file_unavailable"), false);
}

async function testFirefoxFileInputScanFailureBlocksRawUpload() {
  const rawFile = createTextFile({
    name: "bad.env",
    text: "not decoded"
  });
  const fileInput = createFileInput();
  fileInput.files = [rawFile];
  fileInput.value = "C:\\fakepath\\bad.env";
  const { maybeHandleFileInputChange, calls } = createHarness({
    location: { hostname: "chatgpt.com" },
    navigator: { userAgent: "Firefox" },
    findComposer: () => null,
    readLocalTextFileFromDataTransfer: async (transfer) => {
      calls.reads.push(transfer);
      return {
        handled: false,
        ok: false,
        code: "invalid_utf8",
        message: "This raw message should not be shown for Firefox file inputs."
      };
    },
    handOffSanitizedLocalFile() {
      throw new Error("failed Firefox file input scan must not hand off a file");
    }
  });
  const { event, calls: eventCalls } = createEvent({
    type: "input",
    target: fileInput
  });

  await maybeHandleFileInputChange(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(eventCalls.stopImmediatePropagation, 1);
  assert.strictEqual(fileInput.value, "");
  assert.strictEqual(calls.reads.length, 1);
  assert.deepStrictEqual(calls.reads[0].files, [rawFile]);
  assert.strictEqual(calls.redactions.length, 0);
  assert.strictEqual(calls.createdFiles.length, 0);
  assert.strictEqual(calls.handoffs.length, 0);
  assert.ok(calls.modals.some(([title]) => title === "Raw file blocked"));
  assert.ok(
    calls.modals.some(([, message]) =>
      String(message || "").includes("LeakGuard blocked raw file upload in Firefox")
    )
  );
  assert.strictEqual(calls.modals.flat().join("\n").includes("This raw message should not be shown"), false);
}

async function testFirefoxEmptyMimeEnvDropUsesTextDecodeAndSanitizedHandoff() {
  const rawSecret = "LeakGuardDropApiKey1234567890";
  const rawText = `API_KEY=${rawSecret}\r\nSAFE=value`;
  const fileInput = createFileInput();
  const { maybeHandleDrop, calls } = createHarness({
    location: { hostname: "chatgpt.com" },
    navigator: { userAgent: "Firefox" },
    resolveFileInputForHandoff: () => fileInput,
    readLocalTextFileFromDataTransfer: globalThis.PWM.FilePasteHelpers.readLocalTextFileFromDataTransfer,
    findComposer: () => ({ tagName: "TEXTAREA", text: "", selection: { start: 0, end: 0 } }),
    handOffSanitizedFileInput: (targetInput, transfer) => {
      calls.sanitizedInputAssignments = calls.sanitizedInputAssignments || [];
      calls.sanitizedInputAssignments.push({ targetInput, transfer });
      targetInput.files = transfer.files;
      targetInput.dispatchEvent({ type: "input" });
      targetInput.dispatchEvent({ type: "change" });
      return true;
    }
  });
  const rawFile = createTextFile({
    name: "01-basic-secrets.env",
    type: "",
    text: rawText
  });
  const { event } = createEvent({
    dataTransfer: {
      types: ["Files"],
      files: [rawFile],
      items: [],
      dropEffect: "none"
    },
    target: { tagName: "DIV" }
  });

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.redactions.length, 1);
  assert.strictEqual(calls.createdFiles.length, 1);
  assert.strictEqual(calls.createdFiles[0].text.includes(rawSecret), false);
  assert.ok(calls.createdFiles[0].text.includes("API_KEY=[PWM_1]\nSAFE=value"));
  assert.strictEqual(calls.sanitizedInputAssignments.length, 1);
  assert.notStrictEqual(calls.sanitizedInputAssignments[0].transfer.files[0], rawFile);
  assert.strictEqual(fileInput.files[0].text.includes(rawSecret), false);
  assert.deepStrictEqual(fileInput.events, ["input", "change"]);
}

async function testGenericTextFallbackFailureUsesSanitizedDownload() {
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
  assert.strictEqual(calls.handoffs.length, 0);
  assert.strictEqual(calls.textFallbacks.length, 1);
  assert.strictEqual(calls.textFallbacks[0].insertedText.includes(rawSecret), false);
  assert.strictEqual(composer.text.includes(rawSecret), false);
  assert.strictEqual(composer.text, "");
  assert.strictEqual(calls.runtimeMessages.length, 1);
  assert.strictEqual(calls.runtimeMessages[0].redactedText.includes(rawSecret), false);
  assert.strictEqual(calls.modals.some(([title]) => title === "Raw file upload blocked"), false);
  assert.strictEqual(calls.modals.flat().join("\n").includes(rawSecret), false);
}

function createUnsupportedFileTransfer() {
  const file = {
    name: "secrets.png",
    type: "image/png",
    size: 128
  };
  return {
    types: ["Files"],
    files: [file],
    items: [
      {
        kind: "file",
        getAsFile: () => file
      }
    ],
    dropEffect: "none"
  };
}

async function testFirefoxProtectedDropBlocksUnsupportedFiles() {
  for (const hostname of ["gemini.google.com", "chatgpt.com", "protected.example"]) {
    const { maybeHandleDrop, calls } = createHarness({
      navigator: { userAgent: "Firefox" },
      location: { hostname },
      findComposer: () => null
    });
    const { event, calls: eventCalls } = createEvent({
      dataTransfer: createUnsupportedFileTransfer(),
      target: { tagName: "DIV" }
    });

    await maybeHandleDrop(event);

    assert.strictEqual(event.defaultPrevented, true, `${hostname} should block unsupported Firefox file drops`);
    assert.strictEqual(eventCalls.stopImmediatePropagation, 1);
    assert.strictEqual(calls.reads.length, 0);
    assert.strictEqual(calls.handoffs.length, 0);
    assert.strictEqual(calls.runtimeMessages.length, 0);
    assert.ok(calls.modals.some(([title]) => title === "Raw file upload blocked"));
  }
}

async function testFirefoxFileHandoffFallsBackToTextWhenAssignmentCapabilityFails() {
  class NoSyntheticFilesDataTransfer {
    constructor() {
      this.files = [];
      this.items = {
        add: () => {}
      };
      this.dropEffect = "none";
    }
  }
  const composer = {
    tagName: "TEXTAREA",
    text: "",
    selection: { start: 0, end: 0 }
  };
  const { maybeHandleDrop, calls } = createHarness({
    navigator: { userAgent: "Firefox" },
    location: { hostname: "chatgpt.com" },
    DataTransfer: NoSyntheticFilesDataTransfer,
    findComposer: () => composer
  });
  const { event } = createEvent({
    dataTransfer: createDataTransfer(),
    target: composer
  });

  await maybeHandleDrop(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(calls.handoffs.length, 0);
  assert.strictEqual(calls.textFallbacks.length, 1);
  assert.strictEqual(calls.textFallbacks[0].insertedText.includes("LeakGuardDropApiKey1234567890"), false);
}

async function testFirefoxGeminiFileHandoffUsesSanitizedAttachWhenCapabilityPasses() {
  const sanitizedFile = {
    name: "firefox-gemini.env",
    type: "text/plain",
    size: 18,
    text: "API_KEY=[PWM_1]"
  };
  const fileInput = createFileInput({ source: "light-dom", name: "Filedata" });
  const { handOffGeminiSanitizedFileUpload, fallbackDrops } = createHandoffHarness({
    userAgent: "Firefox",
    fileInputs: [fileInput]
  });
  const event = {
    type: "drop",
    target: { nodeType: 1, tagName: "DIV", dispatchEvent: () => true },
    dataTransfer: createDataTransfer()
  };

  const handedOff = await handOffGeminiSanitizedFileUpload(event, null, sanitizedFile);

  assert.strictEqual(handedOff, true);
  assert.strictEqual(fileInput.files[0], sanitizedFile);
  assert.deepStrictEqual(fileInput.events, ["input", "change"]);
  assert.strictEqual(fallbackDrops.length, 0);
}

async function testFirefoxTextareaPasteBlocksBeforeAsyncAndWritesOnlyPlaceholder() {
  const rawSecret = "LeakGuardPasteApiKey1234567890";
  const rawText = `api_key=${rawSecret}`;
  const textarea = {
    tagName: "TEXTAREA",
    text: "",
    selection: { start: 0, end: 0 }
  };
  let clipboardEvent = null;
  const { maybeHandlePaste, calls } = createHarness({
    navigator: { userAgent: "Firefox" },
    location: { hostname: "chatgpt.com" },
    findComposer: () => textarea,
    analyzeTextWithAiAssist: async (text) => {
      assert.strictEqual(clipboardEvent.defaultPrevented, true, "Firefox paste must be blocked before async analysis");
      return {
        normalizedText: text,
        secretFindings: text.includes(rawSecret) ? [{ raw: rawSecret }] : [],
        findings: text.includes(rawSecret) ? [{ raw: rawSecret }] : [],
        placeholderNormalized: false
      };
    }
  });
  const { event, calls: eventCalls } = createClipboardEvent({
    text: rawText,
    target: textarea
  });
  clipboardEvent = event;

  await maybeHandlePaste(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(eventCalls.preventDefault, 1);
  assert.strictEqual(eventCalls.stopImmediatePropagation, 1);
  assert.strictEqual(textarea.text, "api_key=[PWM_1]");
  assert.strictEqual(textarea.text.includes(rawSecret), false);
  assert.strictEqual(calls.textFallbacks.length, 1);
}

async function testFirefoxContenteditablePasteBlocksBeforeAsyncAndWritesOnlyPlaceholder() {
  const rawSecret = "LeakGuardPasteApiKey1234567890";
  const rawText = `api_key=${rawSecret}`;
  const editor = {
    tagName: "DIV",
    text: "",
    selection: { start: 0, end: 0 },
    isContentEditable: true,
    closest(selector) {
      return selector === "[contenteditable]:not([contenteditable='false'])" ? this : null;
    }
  };
  let clipboardEvent = null;
  const { maybeHandlePaste, calls } = createHarness({
    navigator: { userAgent: "Firefox" },
    location: { hostname: "grok.com" },
    findComposer: () => editor,
    analyzeTextWithAiAssist: async (text) => {
      assert.strictEqual(clipboardEvent.defaultPrevented, true, "Firefox contenteditable paste must be blocked before async analysis");
      return {
        normalizedText: text,
        secretFindings: text.includes(rawSecret) ? [{ raw: rawSecret }] : [],
        findings: text.includes(rawSecret) ? [{ raw: rawSecret }] : [],
        placeholderNormalized: false
      };
    }
  });
  const { event, calls: eventCalls } = createClipboardEvent({
    text: rawText,
    target: editor
  });
  clipboardEvent = event;

  await maybeHandlePaste(event);

  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(eventCalls.preventDefault, 1);
  assert.strictEqual(eventCalls.stopImmediatePropagation, 1);
  assert.strictEqual(editor.text, "api_key=[PWM_1]");
  assert.strictEqual(editor.text.includes(rawSecret), false);
  assert.strictEqual(calls.textFallbacks.length, 1);
}

function testMultiFileProtectedUploadStaticGuards() {
  assert.ok(contentSource.includes("MAX_MULTI_FILE_SMALL_ATTACHMENTS"), "content should define a small-file multi-file cap");
  assert.ok(contentSource.includes("MAX_MULTI_FILE_LARGE_ATTACHMENTS"), "content should define a large-file multi-file cap");
  assert.ok(contentSource.includes("createMultiFileAttachPlan"), "content should use the multi-file planning guard");
  assert.ok(contentSource.includes("maybeHandleMultiFileInsert"), "content should route multi-file uploads through a dedicated guard");
  assert.ok(contentSource.includes("processLocalFileForSanitizedBatch"), "content should process each file independently");
  assert.ok(contentSource.includes("Promise.all("), "multi-file processing should process accepted files concurrently");
  assert.ok(contentSource.includes("handOffSanitizedFileBatch"), "sanitized batch handoff should be explicit");
  assert.ok(contentSource.includes("No raw files were uploaded."), "user-facing multi-file failures must state no raw upload occurred");
  assert.ok(contentSource.includes("multi_file_sanitized_handoff_failed"), "sanitized handoff failure should fail closed with a stable reason");
  assert.ok(contentSource.includes("multi_file_all_blocked"), "all-blocked batches should have a stable fail-closed reason");
  assert.ok(contentSource.includes("verifyWhatsAppSanitizedMultiFileAttach"), "WhatsApp multi-file attach should verify sanitized batch assignment");
  assert.ok(contentSource.includes("whatsapp-multi-file-drop-input-verified"), "WhatsApp multi-file drops should prefer verified sanitized file-input assignment");
  assert.ok(contentSource.includes("resolveWhatsAppDocumentDropInputForHandoff"), "WhatsApp document-like drops should resolve the document input path instead of media preview input");
  assert.ok(contentSource.includes("whatsapp-multi-file-drop-document-input-verified"), "WhatsApp multi-file document drops should verify document input assignment");
  assert.ok(contentSource.includes("whatsapp-multi-file-drop-prepared-input-verified"), "WhatsApp multi-file drops should verify prepared sanitized input assignment when no compatible input exists");
  assert.strictEqual(contentSource.includes("maxSmallFiles: isWhatsAppBatch ? 5 : MAX_MULTI_FILE_SMALL_ATTACHMENTS"), false, "WhatsApp should share the canonical small-file batch cap instead of hard-coding 5");
  assert.strictEqual(contentSource.includes("files.length <= 5 && files.every(isSupportedWhatsAppMultiFileAttachFile)"), false, "WhatsApp supported-batch detection should not hard-code a five-file cap");
  assert.ok(contentSource.includes('const shouldUseWhatsAppDropInputHandoff = context === "drop" && verifyWhatsAppBatch'), "WhatsApp multi-file drops should use sanitized file-input assignment");
  assert.ok(contentSource.includes("prepareFileInputForSanitizedHandoff"), "WhatsApp fallback input assignment should prepare accept/multiple only for sanitized files");
  assert.ok(contentSource.includes("whatsapp_multi_file_batch_failed"), "WhatsApp multi-file partial failures should block the whole batch");
  assert.ok(contentSource.includes("multi-file-sanitized-file-handoff"), "successful batches should report a deterministic sanitized strategy");
  assert.strictEqual(/queuePendingSanitizedFileHandoff[\s\S]{0,240}sanitizedItems/.test(contentSource), false, "multi-file batches must not queue pending attach with raw or ambiguous file state");
}

(async () => {
  testSanitizedFileFallbackTextPrefersRedactedSanitizedFileName();
  await testWhatsAppSanitizedTextDocumentAttachVerifierRequiresCanonicalTextType();
  await testWhatsAppSanitizedPdfAttachVerifierRequiresRedactedPdf();
  await testWhatsAppSanitizedDocxAttachVerifierRequiresRedactedDocx();
  await testWhatsAppSanitizedPdfDropUsesDocumentInputWhenNoCompatibleInput();
  await testWhatsAppPreparedDropInputFailsOnAssignedIdentityMismatch();
  await testFileDragoverIsAcceptedWithoutComposerTarget();
  await testFileDragoverIsAcceptedWithoutHelperLoaded();
  await testFileDropIsHandledWithoutComposerTarget();
  await testMultiFileDropSanitizesTwoFilesAsBatch();
  await testMultiFileDropSanitizesFiveFilesInOrder();
  await testMultiFileDropSanitizesFiveLargeFilesByStreamingAsBatch();
  await testMultiFileDropSanitizesTwentySmallFilesInOrder();
  await testMultiFileDropBlocksTwentyOneSmallFilesBeforeReading();
  await testMultiFileDropBlocksSixLargeFilesBeforeReading();
  await testMultiFileDropSanitizesMixedSmallAndLargeBatch();
  await testMultiFileDropBlocksMixedBatchWithTooManyLargeFilesBeforeReading();
  await testMultiFileDropBlocksFileExceedingSupportedSize();
  await testMultiFileInputSanitizesMixedSmallAndLargeBatch();
  await testMultiFileInputBlocksTooManyLargeFilesBeforeReading();
  await testMultiFileInputKeepsUnsupportedOutOfSanitizedAssignment();
  await testMultiFilePasteSanitizesTwentySmallFiles();
  await testGeminiGrokMultiFilePasteQueuesSanitizedPendingAfterDirectHandoffFails();
  await testGeminiMultiFilePasteQueuesPendingBeforeDirectHandoff();
  await testGrokMultiFilePasteKeepsDirectFirstHandoff();
  await testMultiFileDropPartialBlockShowsPerFileSafeSummary();
  await testMixedMultiFileDropBlocksUnsupportedWithoutRawFallback();
  await testMultiFileDropBlocksThrownReadPerFileWithoutRawFallback();
  await testMultiFileDropAllFilesFailedShowsSafeBlockedSummary();
  await testGeminiGrokPartialBlockDoesNotEnterPendingQueueAndShowsSafeSummary();
  await testFileDropIsBlockedWithoutHelperLoaded();
  await testFileDropIsConsumedBeforeComposerLookup();
  testProtectedRebuiltFileDropBlocksAtDragGuard();
  testDropRoutesContentExtractionCandidatesBeforeUnsupportedPassThrough();
  testProtectedUnsupportedImageDropBranchBlocksBeforeOriginalReplay();
  await testProtectedUnsupportedImageDropsFailClosedWithoutOriginalReplay();
  await testDuplicateDropListenerDoesNotDoubleHandleSameEvent();
  await testFileDropHandlesEarlierPreventDefaultWithoutComposerTarget();
  await testNonFileDragoverIsIgnored();
  await testSanitizedFileHandoffDropIsIgnored();
  await testComposerTargetDropStillPassesComposer();
  testProductionGeminiDropPathDoesNotUseLegacyEditorDropHandler();
  await testGeminiDropUsesDiscoveredFileInputHandoff();
  testGeminiDiagnosticsDetectsNewPillPrompt();
  testGeminiDiagnosticsDetectsPlusMenu();
  testGeminiDiagnosticsDetectsMoreUploadsMenuAndDropTarget();
  testGeminiDiagnosticsDetectsHiddenFileInput();
  testGeminiDiagnosticsDetectsBlobDownloadWithoutRawMetadata();
  testGeminiDiagnosticsRunnerIsDebugGated();
  testGeminiDiagnosticsRunnerDoesNotThrowWhenDebugHelperIsUnavailable();
  await testGeminiStreamingHandoffUsesDiscoveredFileInput();
  await testGeminiDropNeverClicksUploadFlowWhenInputAppearsAfterClick();
  await testGeminiDropNeverClicksExistingOverlayMenuItem();
  await testFirefoxGeminiDropUsesPendingAttachHookAfterRedaction();
  await testFirefoxGeminiFileInputBridgeAssignsSanitizedFileOnly();
  await testFirefoxGeminiFileInputBridgeOpensExactAriaMenuButton();
  await testFirefoxGeminiFileInputBridgeOpensUploadToolsMenuButton();
  await testFirefoxGeminiFileInputBridgeUsesUploadCardButtonFallback();
  await testFirefoxGeminiFileInputBridgeUsesSourceUploadIconFallback();
  await testFirefoxGeminiFileInputBridgeUsesAlreadyOpenUploadMenu();
  await testFirefoxGeminiFileInputBridgeCapturesDelayedFiledataAfterOpeningMenu();
  await testFirefoxGeminiFileInputBridgeCapturesDelayedFiledataFromAlreadyOpenMenu();
  await testFirefoxGeminiPrimeCapturesDelayedFiledataBeforeSanitizedAssignment();
  await testFirefoxGeminiPrimeCapturesTransientMutationFiledataInput();
  await testFirefoxGeminiPrimeActivatesHiddenSelectorFallbackAndCapturesFiledataClick();
  await testFirefoxGeminiPrimeClicksHiddenSelectorBeforeSanitizedFileExists();
  await testFirefoxGeminiPrimeHiddenSelectorFallbackAcceptsObservedFiledataInput();
  await testFirefoxGeminiFileInputBridgeUsesUploadFilesTextOverlayItem();
  await testFirefoxGeminiFileInputBridgeRejectsNonUploadOverlayItems();
  await testFirefoxGeminiFileInputBridgeAllowsHiddenSelectorAndCapturesFiledataInput();
  await testFirefoxGeminiFileInputBridgeRejectsUnsafeUploadButtons();
  await testFirefoxGeminiFileInputBridgeDoesNotClickHiddenLocalUploadButtons();
  await testFirefoxGeminiFileInputBridgeFailsClosedWhenMenuOpensWithoutInput();
  await testChromeGeminiFileInputBridgeRemainsInactive();
  await testFirefoxGeminiFileInputBridgeMissingInputQueuesPendingHandoff();
  await testFirefoxGeminiFileInputBridgeUploadToolsMissQueuesPendingHandoff();
  await testFirefoxGeminiDropQueuesPendingBeforeFailClosedWhenBridgeHandledMiss();
  testFirefoxGeminiFileInputBridgeDoesNotReplayOrOpenPicker();
  await testFirefoxGeminiItemsOnlyDropExtractsFileAndUsesFileInputBridge();
  await testGeminiDropGhostIngressAttachesSanitizedFileAfterVisibleUploadFlow();
  await testGeminiGhostIngressInterceptsEphemeralFileInputClick();
  await testFirefoxGeminiGhostIngressUsesHiddenSelectorFallback();
  await testFirefoxGeminiGhostIngressUsesDelayedHiddenSelectorFallback();
  await testFirefoxGeminiDropLocalHandoffAllowsUploadUiAndCapturesHiddenInput();
  await testGeminiGhostIngressClickInterceptorIgnoresUnrelatedFileInput();
  await testGeminiGhostIngressClickInterceptorRemovedAfterTimeout();
  await testGeminiGhostIngressClickInterceptorRemovedAfterAssignmentFailure();
  await testGeminiSanitizedDownloadFailureFailsClosed();
  await testFirefoxGeminiNoPickerMissIsSoftBeforeFallback();
  await testGeminiPendingDropAssignsSanitizedFileWhenInputLaterAppears();
  await testGeminiPendingMutationObserverAssignsWhenInputAppears();
  await testGeminiPendingDropLogsExposureDiagnosticsWithoutRawContent();
  await testGeminiPendingHandoffStoresSanitizedFileOnly();
  await testGeminiPendingHandoffExpiresAndCleansUp();
  await testGrokPendingHandoffExpiresAndCleansUp();
  await testGeminiPendingHandoffReplacementClearsOldState();
  await testGeminiPendingClickObserverDoesNotClickUploadUi();
  await testGeminiPendingUploadClickThenFiledataInputAssignsSanitizedFile();
  await testGeminiPendingAttachPromptButtonCompletesTrustedAttach();
  await testGeminiMultiFilePendingAttachPromptButtonCompletesTrustedAttach();
  await testGrokPendingUploadClickThenFileInputAssignsSanitizedFile();
  await testGrokPendingAttachPromptButtonAssignsSanitizedFile();
  await testPendingAttachGateBehaviorForAdapters();
  await testPendingAttachPromptCancelClearsGeminiAndGrokState();
  await testPendingCleanupErrorsClearStateAndLogMetadataOnly();
  testFileHandoffAdapterRegistryCoversSupportedSites();
  testFileAttachDebugMetadataSchemaFiltersUnsafePayloads();
  testSanitizedFileHandoffFailureLogsSafeErrorMetadataOnly();
  await testSanitizedPayloadFallbackOrderRemainsStable();
  await testFileAttachPipelineDropUsesInjectedHandoffOnly();
  await testFileAttachPipelineNonDropAttemptsFileBeforeTextFallback();
  await testFileAttachPipelineNonDropFileSuccessSkipsFallback();
  await testFileAttachPipelineSkipFallbackBranchPreservesReason();
  await testFileAttachPipelineCancelledFallbackPreservesReason();
  testFileAttachPipelineClassifiesPostHandoffSuccessStages();
  testFileAttachPipelineBuildsPureAttachDisposition();
  testFileAttachPipelineForcedStreamingDispositionPreservesLegacyUiPlan();
  testFileAttachPipelineClassifiesPostHandoffFailures();
  testFileAttachPipelineClassifiesPendingAttachFallbackDecision();
  testFileAttachPipelinePreflightPlanNormalSanitizedAttachStatus();
  testFileAttachPipelinePreflightPlanSkipFallbackStatus();
  testFileAttachPipelinePreflightPlanCleanupLabelsRemainStable();
  testFileAttachPipelinePreflightPlanReturnsPlainDataOnly();
  await testFileAttachPipelineOrchestratorPreservesCallbackOrder();
  await testFileAttachPipelineOrchestratorClassifiesSuccessDisposition();
  await testFileAttachPipelineOrchestratorClassifiesPendingEligiblePath();
  await testFileAttachPipelineOrchestratorClassifiesFailClosedPath();
  await testFileAttachPipelineOrchestratorPreservesCancellationPath();
  await testFileAttachPipelineOrchestratorDoesNotTouchDomBrowserGlobalsOrPendingQueues();
  testFileAttachPipelineProcessingStageControlsDelegateExactly();
  testGenericFileHandoffHelpersAndDiagnosticsExist();
  testFileProcessingOverlayCssExists();
  testPendingAttachPromptCssIsNonBlocking();
  testBuiltInAdaptersEnablePendingAttachRecovery();
  await testSanitizedFileInputRedispatchDoesNotRescanSanitizedFile();
  await testSanitizedHandoffSignatureSuppressesDifferentInputRedispatch();
  await testSanitizedHandoffMixedRawFileDoesNotSuppressScan();
  await testSmallFileInputShowsProcessingUiThenDirectAttachSuccess();
  await testGenericProtectedFileInputWithoutComposerAttachesSanitizedFile();
  await testDocumentAndImageFileInputUseContentExtractionPipelineForSanitizedHandoff();
  await testSupportedImageFileInputAttachesSanitizedImageAcrossAdapters();
  await testUnnamedClipboardImagePasteUsesContentExtractionPipeline();
  await testClipboardImagePasteItemsOnlyRoutesSupportedImagesToPipeline();
  await testClipboardImagePasteUnsafeOriginalFilenameStaysInternal();
  await testClipboardImagePasteOcrFailureBlocksRawImage();
  await testWhatsAppClipboardImagePasteRoutesSupportedImagesToSanitizedPasteHandoff();
  await testWhatsAppClipboardImagePasteConsumesEventSynchronously();
  await testWhatsAppClipboardImagePasteFailureBlocksRawImage();
  await testWhatsAppUnsupportedClipboardImagePasteRemainsBlocked();
  await testWhatsAppSingleImageAttachRoutesToSanitizedHandoff();
  await testWhatsAppSingleTextDocumentAttachRoutesToSanitizedHandoff();
  await testWhatsAppUnsupportedTextNamedAttachBlocksBeforeRead();
  await testWhatsAppSinglePdfAttachRoutesToSanitizedHandoff();
  await testWhatsAppSingleDocxAttachRoutesToSanitizedHandoff();
  await testWhatsAppSingleXlsxAttachRoutesToSanitizedHandoff();
  await testWhatsAppTwoTextDocumentAttachRoutesToSanitizedBatch();
  await testWhatsAppBasenameTextDocumentAttachRoutesToSanitizedBatch();
  await testWhatsAppTenTextDocumentAttachRoutesToSanitizedBatch();
  await testWhatsAppFiveMixedSupportedAttachPreservesSanitizedOrder();
  await testWhatsAppSingleContentFileDropRoutesToSanitizedHandoff();
  await testWhatsAppSingleTextDocumentDropRoutesToSanitizedHandoff();
  await testWhatsAppBasenameTextDocumentDropsRouteToSanitizedBatch();
  await testWhatsAppTenTextDocumentDropsRouteToSanitizedBatch();
  await testWhatsAppFiveMixedSupportedDropPreservesSanitizedOrder();
  await testWhatsAppOverLimitSmallFileDropBlocksBeforeRead();
  await testWhatsAppSixLargeFileDropBlocksBeforeRead();
  await testWhatsAppUnsupportedFileDropBatchBlocksWholeBatchBeforeRead();
  await testWhatsAppFailedFileDropBatchBlocksWholeBatchWithoutPartialDrop();
  await testWhatsAppOverLimitSmallFileAttachBlocksBeforeRead();
  await testWhatsAppSixLargeFileAttachBlocksBeforeRead();
  await testWhatsAppUnsupportedMultiFileAttachBlocksWholeBatchBeforeRead();
  await testWhatsAppMultiFileAttachFailureBlocksWholeBatchWithoutPartialAssignment();
  await testWhatsAppMultiFileAttachVerifierRejectsAssignmentMismatch();
  await testWhatsAppTextDocumentAttachFailuresBlockRawDocument();
  await testWhatsAppPdfAttachFailuresBlockRawPdf();
  await testWhatsAppDocxAttachFailuresBlockRawDocx();
  await testWhatsAppXlsxAttachFailuresBlockRawXlsx();
  await testWhatsAppSanitizedImageHandoffBypassesSafePlaceholderCaptionOnly();
  await testWhatsAppImageAttachSuppressesRawInputClearEventDuringOcr();
  await testWhatsAppImageAttachOcrFailureBlocksRawImage();
  await testWhatsAppUnsupportedAttachRemainsBlocked();
  await testProtectedSiteImageOcrFailureBlocksRawUpload();
  await testProtectedSiteImageHandoffFailureDoesNotTextFallback();
  await testSupportedDocumentDropUsesContentExtractionPipelineBeforeUnsupportedNotice();
  await testScannedPdfFileInputExplainsFailClosedReason();
  await testProtectedLegacyOfficeFileInputBlocksRawUpload();
  await testPausedBuiltInProviderFileInputLetsPageHandleRawFile();
  await testEnforcedPauseStillBlocksBuiltInProviderRawFileInput();
  await testProtectedUnknownBinaryFileInputBlocksRawUpload();
  await testUnsupportedFileReadFailureHidesProcessingUi();
  await testFileProcessingUiClearsAfterException();
  await testLocalFileDropProcessingUiClearsAfterException();
  await testPendingAttachCompletedSuppressesLaterEmptyFileUnavailableEvent();
  await testChatGptUploadButtonAttachSuppressesLaterEmptyFileInputEvent();
  await testChatGptFiftyMiBStreamingAttachSuppressesLaterEmptyEvent();
  await testWhatsAppSanitizedImageAttachSuppressesLaterUnavailableEvent();
  await testFileUnavailableWithoutPriorHandoffStillShowsFailure();
  await testRawReadFailureWithSelectedFileStillBlocksAfterRecentHandoff();
  await testGeminiStreamingPendingAttachRedispatchDoesNotRestream();
  await testGeminiFiftyMiBPendingAttachRedispatchDoesNotRestream();
  await testGrokStreamingPendingAttachRedispatchDoesNotRestream();
  await testSanitizedHandoffInputDoesNotSuppressDifferentUserFile();
  await testSanitizedHandoffSignatureExpiresBeforeSameMetadataUserFile();
  testGeminiUploadHandoffDoesNotRedispatchSyntheticDrop();
  testSanitizedDownloadBackgroundHookExists();
  testUrlChangeClearsPendingGeminiHandoff();
  testExtensionInvalidationClearsPendingGeminiHandoff();
  testGeminiUploadDiscoveryDoesNotRequireMaterialClassSelectors();
  await testGeminiNonDropUploadFlowMayClickWhenInputAppearsAfterClick();
  await testGeminiUploadOverlayFailureLogsMetadataOnly();
  await testGeminiUploadToolsOverlayMissDoesNotReportUnsafeTrigger();
  testGeminiHiddenUploadToolsRejectedAsNormalMenuOpener();
  testGeminiHiddenSelectorOnlyUsesDedicatedActivator();
  await testGeminiUploadMenuDirectInputStillWorks();
  await testGeminiUploadAcceptsChipIncreaseWhenInputFilesClear();
  await testGeminiUploadButtonHandoffDispatchesInputAndChange();
  await testGeminiLargeFileInputWithoutComposerUsesStreamingSanitizedHandoff();
  await testNonGeminiFileInputWithoutComposerStillIgnored();
  await testChangeListenerUsesCapturePhaseForFileInputInterception();
  testPasteListenerUsesWindowCaptureBeforePageHandlers();
  await testGeminiDropDiscoversEnabledInput();
  await testGeminiDropPrefersImagesFilesUploaderMultipleInput();
  await testGeminiDropCopiesFileSnapshotBeforeAsyncHandoff();
  await testGeminiDropCachesDiscoveryPerDragSession();
  await testGeminiDropWithoutInputSkipsUploadHandoff();
  await testGrokDropUsesDiscoveredFileInputHandoff();
  await testGrokDropCreatesSanitizedFileWithoutComposerTextFallback();
  await testGeminiQlEditorPasteIsSanitizedBeforePageHandlers();
  await testFirefoxGeminiPasteRawAlreadyLandedIsReplaced();
  await testFirefoxGeminiPasteDuplicateRegressionIsCollapsed();
  await testFirefoxGeminiMultilinePasteUsesVerifiedTextInsertion();
  await testGeminiQlEditorPastePauseInsertsRawText();
  await testChatGptLargePasteCreatesSanitizedPlainTextFileHandoff();
  await testChatGptLargePasteFallsBackToSanitizedTextOnlyWhenFileHandoffFails();
  await testChatGptContenteditableComposerRewriteSync();
  await testChatGptOutOfSyncFallbackRetriesAndVerifies();
  testChatGptPendingAttachUsesGenericQueue();
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
  await testGenericStreamingDropWithoutFileInputQueuesPendingWithoutReadingSanitizedText();
  await testGeminiStreamingDropQueuesPendingAfterStreamingWithoutTextFallback();
  await testGeminiStreamingDropAtFiftyMiBQueuesPendingHandoff();
  await testGrokStreamingDropQueuesPendingAfterStreamingWithoutTextFallback();
  await testGeminiStreamingFileInputFallsBackToSanitizedTextWhenUploadRejected();
  await testDropOverFiftyMiBBlocksBeforeStreaming();
  testBackgroundSkipsDuplicateDetectorScanForStreamingChunks();
  await testGeminiTextLikeFileExtensionsAreSanitized();
  await testGeminiTextLikeSanitizerFailureBlocksRawFile();
  await testSupportedTextFileHandoffFailureFallsBackToSanitizedText();
  await testWhatsAppFileHandoffFailsClosedWithoutTextFallback();
  await testWhatsAppSanitizedImageAttachVerifierRequiresRedactedPng();
  await testWhatsAppSanitizedImageAttachVerifierRejectsAssignedMismatch();
  testWhatsAppDropResolverRechecksCachedInputAgainstSanitizedFileAccept();
  testWhatsAppDropResolverKeepsCompatibleMediaInputForSanitizedImage();
  testProtectedDriversShowDmzOverlayOnFileDrag();
  testNonProtectedGenericSiteDoesNotShowDmzOverlayOnFileDrag();
  await testDmzOverlayStatesDuringSanitizedTextFallback();
  await testDmzOverlayStatesDuringSanitizedFileAttach();
  await testDmzOverlayFailedStateWhenLocalRedactionFails();
  await testUnsupportedDocumentAndImageFilesPassThroughByDefault();
  await testUnsupportedFileInputWarnsAndKeepsComposerUsable();
  await testUnsupportedBinaryIsBlockedBeforeGeminiPolicyPassThrough();
  await testInvalidUtf8DropBlocksWithoutOriginalHandoff();
  await testFailedScanCannotReachOriginalOrSanitizedHandoff();
  await testGeminiEditorResolvesContenteditableFallback();
  await testGeminiNonEditorPasteAndDropAreIgnoredByEditorHandler();
  await testGeminiSanitizerFailureBlocksRawPasteAndDrop();
  await testGeminiDropFallsBackToSanitizedComposerTextWhenNativeUploadUnavailable();
  await testFirefoxGeminiTextFallbackPreservesMultilineBlocks();
  await testFirefoxGeminiTextFallbackFindsEditorFromParagraphContainer();
  await testFirefoxGeminiBlankTextInsertFallsBackToVerifiedRewrite();
  await testFirefoxGeminiEmptySanitizedTextDoesNotInsertBlankFallback();
  await testFirefoxGeminiItemsOnlyNullFileFailsClosed();
  await testGeminiHiddenFileDropUsesSnapshotThenSanitizedTextFallback();
  await testGeminiTextFallbackFailureNeverLeaksRawContent();
  await testChatGptAndClaudeUseStructuredSanitizedTextWhenFileAttachUnavailable();
  await testUserManagedProtectedSiteDropUsesGenericSanitizedHandoff();
  await testUserManagedProtectedSiteDropFallsBackToSanitizedTextWhenHandoffRejected();
  await testFirefoxChatGptFileInputReplacesSelectedFile();
  await testFirefoxChatGptFileInputReplacesBasicSecretsFixture();
  await testChromeFileInputDuplicateEventsShareOneProcessingRun();
  await testFirefoxFileInputDuplicateEventsShareOneTransaction();
  await testFirefoxGeminiUploadInputReplacesSelectedFile();
  await testFirefoxGeminiUploadReplacementFailureDoesNotTextFallback();
  await testFirefoxGeminiUploadScanFailureBlocksRawFile();
  await testFirefoxFileUnavailableDuplicateAfterReplacementIsIgnored();
  await testFirefoxFileInputScanFailureBlocksRawUpload();
  await testFirefoxEmptyMimeEnvDropUsesTextDecodeAndSanitizedHandoff();
  await testGenericTextFallbackFailureUsesSanitizedDownload();
  await testFirefoxProtectedDropBlocksUnsupportedFiles();
  await testFirefoxFileHandoffFallsBackToTextWhenAssignmentCapabilityFails();
  await testFirefoxGeminiFileHandoffUsesSanitizedAttachWhenCapabilityPasses();
  await testFirefoxTextareaPasteBlocksBeforeAsyncAndWritesOnlyPlaceholder();
  await testFirefoxContenteditablePasteBlocksBeforeAsyncAndWritesOnlyPlaceholder();
  testMultiFileProtectedUploadStaticGuards();
  console.log("PASS content file drop interception regressions");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
