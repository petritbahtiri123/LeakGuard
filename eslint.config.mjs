import { defineConfig } from "eslint/config";
import globals from "globals";

function exactNames(names) {
  return `^(?:${names.join("|")})$`;
}

function unusedVars(options = {}) {
  const ruleOptions = {
    args: "after-used",
    argsIgnorePattern: options.argsIgnorePattern || "^_",
    caughtErrors: "all",
    caughtErrorsIgnorePattern: "^_",
    ignoreRestSiblings: true,
    vars: "all"
  };

  if (options.varsIgnorePattern) {
    ruleOptions.varsIgnorePattern = options.varsIgnorePattern;
  }

  return ["error", ruleOptions];
}

const contentScriptBaseline = exactNames([
  "LOCAL_FILE_STREAMING_REQUIRED_MESSAGE",
  "attemptPendingSanitizedFileHandoff",
  "blockGeminiEditorRawContent",
  "candidateHasHighConfidenceSecret",
  "collectOriginalRawSecretValues",
  "countVerificationLineBreaks",
  "firefoxEarlyRelevantSecretFindings",
  "formatGeminiSanitizedFileFallbackText",
  "geminiFallbackLanguageFromFileName",
  "getFileMetadataSignature",
  "getPendingGeminiSanitizedFileHandoffDebug",
  "getPendingGrokSanitizedFileHandoffDebug",
  "handOffPrimedGeminiFirefoxUploadTarget",
  "handoffSanitizedPayload",
  "hasGeminiSanitizedDownloadFallback",
  "hasPendingGrokSanitizedFileHandoff",
  "hostMatchesFileHandoffAdapter",
  "insertGeminiLocalFileText",
  "insertSanitizedPayloadText",
  "isClaudeHost",
  "isFileOnlySanitizedPayload",
  "isFileUnavailableLocalFileResult",
  "isHighConfidenceRewriteFinding",
  "isOpenAiChatHost",
  "isReasonablyCloseRewriteLength",
  "isSafeSanitizedPayload",
  "isXHost",
  "lineCollapseTokens",
  "pendingFallbackDecision",
  "primeGeminiFirefoxUploadTarget",
  "samePlaceholderTokenSet",
  "shouldSuppressSanitizedFileReprocessing",
  "summarizeVerificationCandidate",
  "tryRealFileInputSanitizedFileAttach",
  "waitForGeminiUploadMenuInput"
]);

const narrowSourceBaseline = {
  "src/background/core.js": exactNames(["supportsStorageSession"]),
  "src/content/files/fileAttachPipeline.js": exactNames(["context"]),
  "src/shared/detector.js": exactNames(["lineEnd"]),
  "src/shared/transformOutboundPrompt.js": exactNames(["overlapsAnyRange"])
};

const contentDropHarnessBaseline = exactNames([
  "badges",
  "testExtensionInvalidationClearsPendingGeminiHandoff",
  "testUrlChangeClearsPendingGeminiHandoff"
]);

export default defineConfig([
  {
    ignores: [
      "ai/models/**",
      "artifacts/**",
      "dist/**",
      "node_modules/**",
      "release/**",
      "sandbox/**"
    ]
  },
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        module: "readonly",
        require: "readonly"
      }
    },
    rules: {
      "no-unused-vars": unusedVars()
    }
  },
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.webextensions
      }
    },
    rules: {
      "no-unused-vars": unusedVars()
    }
  },
  {
    files: ["scripts/**/*.mjs", "tests/**/*.mjs", "*.config.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.webextensions
      }
    },
    rules: {
      "no-unused-vars": unusedVars()
    }
  },
  {
    files: ["src/content/content.js"],
    rules: {
      // Baseline for the first unused-code report. Most of these helpers are
      // pulled into Node harnesses by source extraction, and the rest should be
      // triaged separately instead of being deleted in the gating PR.
      "no-unused-vars": unusedVars({
        argsIgnorePattern: "^(?:_|policy$|options$)",
        varsIgnorePattern: contentScriptBaseline
      })
    }
  },
  ...Object.entries(narrowSourceBaseline).map(([file, varsIgnorePattern]) => ({
    files: [file],
    rules: {
      // Baseline for focused first-report findings. Keep names exact so new
      // unused symbols in these files are still reported.
      "no-unused-vars": unusedVars({ varsIgnorePattern })
    }
  })),
  {
    files: ["tests/browser/chrome_smoke.test.mjs"],
    rules: {
      "no-unused-vars": unusedVars({ argsIgnorePattern: "^(?:_|tempDir$)" })
    }
  },
  {
    files: ["tests/content_file_drop_interception.test.js"],
    rules: {
      // The content-file harness intentionally accepts browser callback shapes
      // even when an individual test does not inspect every argument.
      "no-unused-vars": unusedVars({
        argsIgnorePattern:
          "^(?:_|command$|findings$|input$|message$|mode$|normalizedText$|options$|value$)",
        varsIgnorePattern: contentDropHarnessBaseline
      })
    }
  }
]);
