(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function fallbackNormalizeComposerText(value) {
    return String(value || "")
      .replace(/\r\n?/g, "\n")
      .replace(/\u00a0/g, " ")
      .replace(/[\u200B-\u200D\uFEFF]/g, "");
  }

  function getNormalizeComposerText(options = {}) {
    return (
      options.normalizeComposerText ||
      root.PWM?.ComposerHelpers?.normalizeComposerText ||
      fallbackNormalizeComposerText
    );
  }

  function getNormalizeEditorInnerText(options = {}) {
    return (
      options.normalizeEditorInnerText ||
      root.PWM?.ComposerHelpers?.normalizeEditorInnerText ||
      ((value) => getNormalizeComposerText(options)(value).replace(/\n{3,}/g, "\n\n"))
    );
  }

  function getNormalizeVisiblePlaceholders(options = {}) {
    return options.normalizeVisiblePlaceholders || root.PWM?.normalizeVisiblePlaceholders || ((value) => String(value || ""));
  }

  function getPlaceholderTokenRegex(options = {}) {
    return options.placeholderTokenRegex || root.PWM?.PLACEHOLDER_TOKEN_REGEX || /\[(?:PWM|NET|PUB_HOST)_\d+\]/g;
  }

  function normalizeVerificationText(text, options = {}) {
    const normalizeComposerText = getNormalizeComposerText(options);
    const normalizeEditorInnerText = getNormalizeEditorInnerText(options);
    const normalizeVisiblePlaceholders = getNormalizeVisiblePlaceholders(options);
    return normalizeEditorInnerText(normalizeComposerText(normalizeVisiblePlaceholders(text)))
      .replace(/[^\S\n]+$/gm, "")
      .replace(/\n{3,}$/g, "\n\n")
      .replace(/\n+$/g, "");
  }

  function normalizeLooseVerificationText(text, options = {}) {
    return normalizeVerificationText(text, options)
      .replace(/[^\S\n]*\n+[^\S\n]*(?=\[(?:PWM|NET|PUB_HOST)_\d+\])/g, " ")
      .replace(/(\[(?:PWM|NET|PUB_HOST)_\d+\])[^\S\n]*\n+[^\S\n]*/g, "$1 ")
      .replace(/\n{2,}/g, "\n")
      .trim();
  }

  function listExpectedPlaceholders(text, options = {}) {
    const normalizeVisiblePlaceholders = getNormalizeVisiblePlaceholders(options);
    const placeholderTokenRegex = getPlaceholderTokenRegex(options);
    const normalized = normalizeVisiblePlaceholders(text);
    const matches = normalized.match(new RegExp(placeholderTokenRegex.source, "g")) || [];
    return [...new Set(matches)];
  }

  function listPlaceholderTokens(text, options = {}) {
    const normalizeVisiblePlaceholders = getNormalizeVisiblePlaceholders(options);
    const placeholderTokenRegex = getPlaceholderTokenRegex(options);
    const normalized = normalizeVisiblePlaceholders(text);
    return normalized.match(new RegExp(placeholderTokenRegex.source, "g")) || [];
  }

  function samePlaceholderTokenSet(expectedText, actualText, options = {}) {
    const expected = listExpectedPlaceholders(expectedText, options);
    const actual = listExpectedPlaceholders(actualText, options);
    if (expected.length !== actual.length) return false;
    return expected.every((placeholder) => actual.includes(placeholder));
  }

  function actualContainsExpectedPlaceholders(expectedText, actualText, options = {}) {
    const placeholders = listExpectedPlaceholders(expectedText, options);
    if (!placeholders.length) return true;

    const normalizeVisiblePlaceholders = getNormalizeVisiblePlaceholders(options);
    const actual = normalizeVisiblePlaceholders(actualText);
    return placeholders.every((placeholder) => actual.includes(placeholder));
  }

  function countVerificationLineBreaks(text, options = {}) {
    const matches = normalizeVerificationText(text, options).match(/\n/g);
    return matches ? matches.length : 0;
  }

  function countVerificationLines(text, options = {}) {
    const normalized = normalizeVerificationText(text, options);
    return normalized ? normalized.split("\n").length : 0;
  }

  function lineCollapseTokens(text, options = {}) {
    return normalizeVerificationText(text, options)
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length >= 2)
      .slice(0, 12);
  }

  function detectMultilineCollapse(expected, actual, options = {}) {
    const expectedBreaks = countVerificationLineBreaks(expected, options);
    if (expectedBreaks < 2) return false;

    const actualBreaks = countVerificationLineBreaks(actual, options);
    if (actualBreaks >= Math.max(1, Math.floor(expectedBreaks / 2))) {
      return false;
    }

    const tokens = lineCollapseTokens(expected, options);
    if (tokens.length < 2) return false;

    const normalizedActual = normalizeVerificationText(actual, options);
    const compactActual = normalizedActual.replace(/\s+/g, "");
    const spaceJoinedActual = normalizedActual.replace(/\s+/g, " ").trim();
    const compactExpected = tokens.join("").replace(/\s+/g, "");
    const spaceJoinedExpected = tokens.join(" ").replace(/\s+/g, " ").trim();

    if (compactExpected && compactActual.includes(compactExpected)) return true;
    if (spaceJoinedExpected && spaceJoinedActual.includes(spaceJoinedExpected)) return true;

    let searchOffset = 0;
    return tokens.every((token) => {
      const compactToken = token.replace(/\s+/g, "");
      const index = compactActual.indexOf(compactToken, searchOffset);
      if (index < 0) return false;
      searchOffset = index + compactToken.length;
      return true;
    });
  }

  function isReasonablyCloseRewriteLength(expectedText, actualText, options = {}) {
    const expectedLength = normalizeVerificationText(expectedText, options).length;
    const actualLength = normalizeVerificationText(actualText, options).length;
    if (!actualLength && expectedLength) return false;
    const difference = Math.abs(expectedLength - actualLength);
    return difference <= Math.max(80, Math.ceil(expectedLength * 0.35));
  }

  function isHighConfidenceRewriteFinding(finding) {
    if (!finding || typeof finding["raw"] !== "string") return false;
    if (finding.severity === "high") return true;
    if (Number(finding.score) >= 80) return true;
    if (finding.confidence === "high") return true;
    if (Number(finding.confidence) >= 0.85) return true;
    return false;
  }

  function collectOriginalRawSecretValues(originalText, findings, options = {}) {
    const normalizeComposerText = getNormalizeComposerText(options);
    const placeholderTokenRegex = getPlaceholderTokenRegex(options);
    const analyzeText = options.analyzeText;
    const rawValues = new Set();
    const addRawValue = (raw) => {
      const normalized = normalizeComposerText(raw);
      if (!normalized || placeholderTokenRegex.test(normalized)) {
        placeholderTokenRegex.lastIndex = 0;
        return;
      }
      placeholderTokenRegex.lastIndex = 0;
      rawValues.add(normalized);
    };

    for (const finding of Array.isArray(findings) ? findings : []) {
      if (isHighConfidenceRewriteFinding(finding)) {
        addRawValue(finding["raw"]);
      }
    }

    if (typeof analyzeText === "function" && typeof originalText === "string" && originalText.trim()) {
      try {
        const analysis = analyzeText(originalText);
        for (const finding of analysis.findings || analysis.secretFindings || []) {
          if (isHighConfidenceRewriteFinding(finding)) {
            addRawValue(finding["raw"]);
          }
        }
      } catch {
        // Analysis is fail-closed later if visible candidates still look sensitive.
      }
    }

    return [...rawValues];
  }

  function candidateHasHighConfidenceSecret(candidateText, rawSecretValues, options = {}) {
    const normalizeComposerText = getNormalizeComposerText(options);
    const analyzeText = options.analyzeText;
    const normalized = normalizeComposerText(candidateText);
    if (!normalized.trim()) return false;

    if (rawSecretValues.some((raw) => raw && normalized.includes(raw))) {
      return true;
    }

    if (typeof analyzeText !== "function") return false;

    try {
      const analysis = analyzeText(normalized);
      return (analysis.secretFindings || []).some(isHighConfidenceRewriteFinding);
    } catch {
      return false;
    }
  }

  function summarizeVerificationCandidate(source, text, expectedText, options = {}) {
    const normalizeComposerText = getNormalizeComposerText(options);
    return {
      source,
      length: normalizeComposerText(text).length,
      lineCount: countVerificationLines(text, options),
      placeholderCount: listPlaceholderTokens(text, options).length,
      expectedLength: normalizeComposerText(expectedText).length,
      expectedLineCount: countVerificationLines(expectedText, options),
      expectedPlaceholderCount: listPlaceholderTokens(expectedText, options).length,
      multilineCollapsed: detectMultilineCollapse(expectedText, text, options)
    };
  }

  function emitDebug(options, label, payload) {
    if (typeof options.debug === "function") {
      options.debug(label, payload || {});
    }
  }

  function evaluateComposerVerificationCandidates(
    { candidates, expectedText, originalText, findings, context },
    options = {}
  ) {
    const normalizeComposerText = getNormalizeComposerText(options);
    const expected = normalizeComposerText(expectedText);
    const normalizedExpected = normalizeVerificationText(expected, options);
    const looseExpected = normalizeLooseVerificationText(expected, options);
    const expectedPlaceholders = listExpectedPlaceholders(expected, options);
    const rawSecretValues = collectOriginalRawSecretValues(originalText, findings, options);
    let firstNonEmptyActual = "";
    let firstCandidate = null;
    let collapseDetected = false;
    let placeholderMissing = expectedPlaceholders.length > 0;
    let rawSecretPresent = false;

    for (const candidate of candidates) {
      const actual = normalizeComposerText(candidate.text);
      const summary = summarizeVerificationCandidate(candidate.source, actual, expected, options);
      emitDebug(options, "rewrite:verification-candidate", {
        context,
        ...summary,
        hasRawSecretValues: rawSecretValues.length > 0
      });

      if (!firstCandidate) {
        firstCandidate = candidate;
      }
      if (!firstNonEmptyActual && actual.trim()) {
        firstNonEmptyActual = actual;
      }

      if (candidateHasHighConfidenceSecret(actual, rawSecretValues, options)) {
        rawSecretPresent = true;
        emitDebug(options, "rewrite:verification-failed-raw-secret-present", {
          context,
          source: candidate.source,
          length: summary.length,
          lineCount: summary.lineCount,
          placeholderCount: summary.placeholderCount
        });
      }
    }

    if (rawSecretPresent) {
      return {
        ok: false,
        actual: firstNonEmptyActual || normalizeComposerText(firstCandidate?.text || ""),
        reason: "raw-secret-present",
        collapseDetected: false,
        rawSecretPresent: true,
        placeholderMissing: false
      };
    }

    for (const candidate of candidates) {
      const actual = normalizeComposerText(candidate.text);
      const summary = summarizeVerificationCandidate(candidate.source, actual, expected, options);

      if (!firstCandidate) {
        firstCandidate = candidate;
      }
      if (!firstNonEmptyActual && actual.trim()) {
        firstNonEmptyActual = actual;
      }

      if (expectedPlaceholders.length && !actualContainsExpectedPlaceholders(expected, actual, options)) {
        emitDebug(options, "rewrite:verification-failed-placeholder-missing", {
          context,
          source: candidate.source,
          length: summary.length,
          lineCount: summary.lineCount,
          expectedPlaceholderCount: expectedPlaceholders.length,
          actualPlaceholderCount: listExpectedPlaceholders(actual, options).length
        });
        continue;
      }
      placeholderMissing = false;

      if (detectMultilineCollapse(expected, actual, options)) {
        collapseDetected = true;
        emitDebug(options, "rewrite:multiline-collapse-detected", {
          context,
          source: candidate.source,
          expectedLineCount: countVerificationLines(expected, options),
          actualLineCount: countVerificationLines(actual, options),
          expectedLength: expected.length,
          actualLength: actual.length
        });
        continue;
      }

      if (actual === expected) {
        emitDebug(options, "rewrite:verification-pass-exact", {
          context,
          source: candidate.source,
          length: summary.length,
          lineCount: summary.lineCount,
          placeholderCount: summary.placeholderCount
        });
        return { ok: true, actual, strategy: "exact", source: candidate.source };
      }

      const normalizedActual = normalizeVerificationText(actual, options);
      if (normalizedActual === normalizedExpected) {
        emitDebug(options, "rewrite:verification-pass-normalized", {
          context,
          source: candidate.source,
          length: summary.length,
          lineCount: summary.lineCount,
          placeholderCount: summary.placeholderCount
        });
        return { ok: true, actual, strategy: "normalized", source: candidate.source };
      }

      const looseActual = normalizeLooseVerificationText(actual, options);
      if (
        looseActual === looseExpected &&
        actualContainsExpectedPlaceholders(expected, actual, options)
      ) {
        emitDebug(options, "rewrite:verification-pass-normalized", {
          context,
          source: candidate.source,
          length: summary.length,
          lineCount: summary.lineCount,
          placeholderCount: summary.placeholderCount,
          wrapperAdjusted: true
        });
        return { ok: true, actual, strategy: "normalized-wrapper", source: candidate.source };
      }

      if (
        expectedPlaceholders.length &&
        samePlaceholderTokenSet(expected, actual, options) &&
        actual.trim() &&
        isReasonablyCloseRewriteLength(expected, actual, options)
      ) {
        emitDebug(options, "rewrite:verification-pass-placeholder-safe", {
          context,
          source: candidate.source,
          length: summary.length,
          lineCount: summary.lineCount,
          placeholderCount: summary.placeholderCount
        });
        return { ok: true, actual, strategy: "placeholder-safe", source: candidate.source };
      }
    }

    return {
      ok: false,
      actual: firstNonEmptyActual || normalizeComposerText(firstCandidate?.text || ""),
      reason: rawSecretPresent
        ? "raw-secret-present"
        : placeholderMissing
          ? "placeholder-missing"
          : collapseDetected
            ? "multiline-collapse"
            : "mismatch",
      collapseDetected,
      rawSecretPresent,
      placeholderMissing
    };
  }

  root.PWM.RewriteVerificationText = {
    normalizeVerificationText,
    normalizeLooseVerificationText,
    listExpectedPlaceholders,
    listPlaceholderTokens,
    samePlaceholderTokenSet,
    actualContainsExpectedPlaceholders,
    countVerificationLineBreaks,
    countVerificationLines,
    lineCollapseTokens,
    detectMultilineCollapse,
    isReasonablyCloseRewriteLength,
    isHighConfidenceRewriteFinding,
    collectOriginalRawSecretValues,
    candidateHasHighConfidenceSecret,
    summarizeVerificationCandidate,
    evaluateComposerVerificationCandidates
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.RewriteVerificationText;
  }
})();
