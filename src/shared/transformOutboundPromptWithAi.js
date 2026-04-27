(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  const { Detector, transformOutboundPrompt, extractAiCandidates } = root.PWM;

  function isEnterpriseLike(policyMode) {
    return policyMode === "enterprise" || policyMode === "strict";
  }

  function findingFromCandidate(candidate, result, index, policyMode) {
    const risk = String(result?.risk || "");
    const confidence = Number(result?.confidence || 0);
    const unsure = risk === "UNSURE" && isEnterpriseLike(policyMode) && candidate.score >= 60;
    const secret = risk === "SECRET" && confidence >= 0.8;

    if (!secret && !unsure) return null;

    return {
      id: `ai_${String(index).padStart(4, "0")}`,
      type: "SECRET",
      placeholderType: "SECRET",
      category: "credential",
      raw: candidate.value,
      start: candidate.start,
      end: candidate.end,
      source: "local_ai",
      detector: "ai_candidate_gate",
      confidence,
      score: candidate.score,
      severity: secret ? "high" : "medium",
      method: ["local-ai", "ai-candidate-gate", candidate.kind].filter(Boolean)
    };
  }

  async function transformOutboundPromptWithAi(text, options = {}) {
    const input = String(text || "");
    const policyMode = options.policyMode || "consumer";
    const detector = options.detector || (Detector ? new Detector() : null);
    const deterministicFindings = Array.isArray(options.findings)
      ? [...options.findings]
      : detector?.scan
        ? detector.scan(input)
        : [];
    const ranges = deterministicFindings.map((finding) => ({
      start: finding.start,
      end: finding.end
    }));
    const candidates = extractAiCandidates(input, {
      ...options,
      findings: deterministicFindings,
      deterministicRanges: ranges,
      policyMode
    });
    const classifier = options.classifier || root.PWM.LeakGuardAiClassifier;
    const aiFindings = [];

    if (classifier?.classify) {
      for (const candidate of candidates) {
        const result = await classifier.classify(candidate.contextText);
        const finding = findingFromCandidate(candidate, result, aiFindings.length + 1, policyMode);
        if (finding) aiFindings.push(finding);
      }
    }

    return transformOutboundPrompt(input, {
      ...options,
      findings: [...deterministicFindings, ...aiFindings]
    });
  }

  root.PWM.transformOutboundPromptWithAi = transformOutboundPromptWithAi;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { transformOutboundPromptWithAi };
  }
})();
