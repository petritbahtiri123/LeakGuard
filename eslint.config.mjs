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

const contentScriptHarnessBaseline = exactNames([
  // Static browser/file-safety marker asserted by content-file regressions.
  "LOCAL_FILE_STREAMING_REQUIRED_MESSAGE",

  // Source-extracted content.js helpers used by Node harnesses to validate
  // browser upload, adapter, and rewrite-verification behavior.
  "blockGeminiEditorRawContent",
  "candidateHasHighConfidenceSecret",
  "collectOriginalRawSecretValues",
  "countVerificationLineBreaks",
  "formatGeminiSanitizedFileFallbackText",
  "geminiFallbackLanguageFromFileName",
  "getPendingGeminiSanitizedFileHandoffDebug",
  "getPendingGrokSanitizedFileHandoffDebug",
  "handOffPrimedGeminiFirefoxUploadTarget",
  "hasGeminiSanitizedDownloadFallback",
  "hasPendingGrokSanitizedFileHandoff",
  "hostMatchesFileHandoffAdapter",
  "isClaudeHost",
  "isExpectedWhatsAppSanitizedMultiFileAttachFile",
  "isHighConfidenceRewriteFinding",
  "isOpenAiChatHost",
  "isReasonablyCloseRewriteLength",
  "isSupportedWhatsAppDocxAttachFile",
  "isSupportedWhatsAppMultiFileAttachFile",
  "isSupportedWhatsAppPdfAttachFile",
  "isSupportedWhatsAppXlsxAttachFile",
  "isWhatsAppSanitizedDropHandoffEnabled",
  "isXHost",
  "lineCollapseTokens",
  "normalizeLooseVerificationText",
  "normalizeVerificationText",
  "primeGeminiFirefoxUploadTarget",
  "processLocalFileForSanitizedBatch",
  "samePlaceholderTokenSet",
  "summarizeMultiFileItem",
  "summarizeVerificationCandidate",
  "waitForGeminiUploadMenuInput"
]);

export default defineConfig([
  {
    ignores: [
      "ai/models/**",
      "artifacts/**",
      "dist/**",
      "node_modules/**",
      "release/**",
      "sandbox/**",
      "src/shared/ocr/tesseract-core/tesseract-core.js"
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
      // Intentional content.js test hooks: these names are source-extracted by
      // Node harnesses or asserted as static browser/file safety markers.
      "no-unused-vars": unusedVars({
        varsIgnorePattern: contentScriptHarnessBaseline
      })
    }
  }
]);
