(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function createReplayVerification(options = {}) {
    const rewriteVerificationText = options.rewriteVerificationText || root.PWM.RewriteVerificationText || {};
    const normalizeComposerText =
      typeof options.normalizeComposerText === "function" ? options.normalizeComposerText : (text) => String(text || "");
    const normalizeEditorInnerText =
      typeof options.normalizeEditorInnerText === "function"
        ? options.normalizeEditorInnerText
        : (text) => String(text || "");
    const getInputText = typeof options.getInputText === "function" ? options.getInputText : () => "";
    const analyzeText =
      typeof options.analyzeText === "function"
        ? options.analyzeText
        : () => ({ findings: [], secretFindings: [] });
    const debug = typeof options.debug === "function" ? options.debug : () => {};

    function normalizeVerificationText(text) {
      return rewriteVerificationText.normalizeVerificationText(text);
    }

    function normalizeLooseVerificationText(text) {
      return rewriteVerificationText.normalizeLooseVerificationText(text);
    }

    function listExpectedPlaceholders(text) {
      return rewriteVerificationText.listExpectedPlaceholders(text);
    }

    function listPlaceholderTokens(text) {
      return rewriteVerificationText.listPlaceholderTokens(text);
    }

    function samePlaceholderTokenSet(expectedText, actualText) {
      return rewriteVerificationText.samePlaceholderTokenSet(expectedText, actualText);
    }

    function actualContainsExpectedPlaceholders(expectedText, actualText) {
      return rewriteVerificationText.actualContainsExpectedPlaceholders(expectedText, actualText);
    }

    function countVerificationLineBreaks(text) {
      return rewriteVerificationText.countVerificationLineBreaks(text);
    }

    function countVerificationLines(text) {
      return rewriteVerificationText.countVerificationLines(text);
    }

    function lineCollapseTokens(text) {
      return rewriteVerificationText.lineCollapseTokens(text);
    }

    function detectMultilineCollapse(expected, actual) {
      return rewriteVerificationText.detectMultilineCollapse(expected, actual);
    }

    function isReasonablyCloseRewriteLength(expectedText, actualText) {
      return rewriteVerificationText.isReasonablyCloseRewriteLength(expectedText, actualText);
    }

    function collectComposerVerificationCandidates(input, initialActualText) {
      const candidates = [];
      const seen = new Set();
      const addCandidate = (source, value) => {
        if (typeof value !== "string") return;
        const normalized = normalizeComposerText(value);
        const key = `${source}:${normalized}`;
        if (seen.has(key)) return;
        seen.add(key);
        candidates.push({ source, text: normalized });
      };

      if (typeof initialActualText === "string") {
        addCandidate("stable", initialActualText);
      }
      addCandidate("getInputText", getInputText(input));
      addCandidate("innerText", input?.innerText || "");
      addCandidate("textContent", input?.textContent || "");
      addCandidate("normalizedInnerText", normalizeEditorInnerText(input?.innerText || ""));

      const baseCandidates = [...candidates];
      for (const candidate of baseCandidates) {
        addCandidate(`${candidate.source}:normalized`, normalizeComposerText(candidate.text));
      }

      return candidates;
    }

    function isHighConfidenceRewriteFinding(finding) {
      return rewriteVerificationText.isHighConfidenceRewriteFinding(finding);
    }

    function collectOriginalRawSecretValues(originalText, findings) {
      return rewriteVerificationText.collectOriginalRawSecretValues(originalText, findings, {
        analyzeText
      });
    }

    function candidateHasHighConfidenceSecret(candidateText, rawSecretValues) {
      return rewriteVerificationText.candidateHasHighConfidenceSecret(candidateText, rawSecretValues, {
        analyzeText
      });
    }

    function summarizeVerificationCandidate(source, text, expectedText) {
      return rewriteVerificationText.summarizeVerificationCandidate(source, text, expectedText);
    }

    function evaluateComposerVerificationCandidates({ candidates, expectedText, originalText, findings, context }) {
      return rewriteVerificationText.evaluateComposerVerificationCandidates(
        { candidates, expectedText, originalText, findings, context },
        {
          analyzeText,
          debug
        }
      );
    }

    function matchesComposerPlan(plan, actualText) {
      const acceptableTexts = Array.isArray(plan.acceptableTexts) ? plan.acceptableTexts : [plan.canonical];
      if (acceptableTexts.includes(actualText)) {
        return true;
      }

      const normalizedActual = normalizeVerificationText(actualText);
      if (
        acceptableTexts.some(
          (candidate) =>
            normalizeVerificationText(candidate) === normalizedActual &&
            actualContainsExpectedPlaceholders(candidate, actualText)
        )
      ) {
        return true;
      }

      const looseActual = normalizeLooseVerificationText(actualText);
      return acceptableTexts.some(
        (candidate) =>
          normalizeLooseVerificationText(candidate) === looseActual &&
          actualContainsExpectedPlaceholders(candidate, actualText)
      );
    }

    return Object.freeze({
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
      collectComposerVerificationCandidates,
      isHighConfidenceRewriteFinding,
      collectOriginalRawSecretValues,
      candidateHasHighConfidenceSecret,
      summarizeVerificationCandidate,
      evaluateComposerVerificationCandidates,
      matchesComposerPlan
    });
  }

  root.PWM.ReplayVerification = Object.freeze({
    createReplayVerification
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.ReplayVerification;
  }
})();
