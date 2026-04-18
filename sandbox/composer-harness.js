(function () {
  const { Detector, PlaceholderManager, Redactor, ComposerHelpers } = globalThis.PWM;
  const {
    getInputText,
    setInputText,
    forceRewriteInputText
  } = ComposerHelpers;

  const detector = new Detector();

  const scenarios = {
    multiline: 'db_password = "AlphaPass_111!!"\nbackup_password = "BetaPass_222!!"',
    "same-value": 'db_password = "RepeatPass_111!!"\nbackup_password = "RepeatPass_111!!"',
    "different-values": 'db_password = "AlphaPass_111!!"\nbackup_password = "BetaPass_222!!"',
    "safe-text": "Write a short project update about the browser rewrite harness."
  };

  const textarea = document.getElementById("harness-textarea");
  const editable = document.getElementById("harness-editable");
  const expectedOutput = document.getElementById("expected-output");
  const statusTextArea = document.getElementById("status-textarea");
  const statusEditable = document.getElementById("status-editable");

  function makeRedaction(text) {
    const manager = new PlaceholderManager();
    const redactor = new Redactor(manager);
    const findings = detector.scan(text).filter((finding) => finding.severity !== "low");

    if (!findings.length) {
      return {
        findings,
        redactedText: text
      };
    }

    return redactor.redact(text, findings);
  }

  function setScenario(text) {
    setInputText(textarea, text, { caretOffset: text.length });
    setInputText(editable, text, { caretOffset: text.length });
    expectedOutput.textContent = makeRedaction(text).redactedText;
    statusTextArea.textContent = "Scenario loaded.";
    statusEditable.textContent = "Scenario loaded.";
  }

  function renderStatus(node, result) {
    node.className = result.ok ? "status-ok" : "status-fail";
    node.textContent = [
      result.ok ? "PASS" : "FAIL",
      `Expected: ${JSON.stringify(result.expected)}`,
      `Actual:   ${JSON.stringify(result.actual)}`,
      `Findings: ${result.findings.length}`
    ].join("\n");
  }

  function redactTarget(target) {
    const el = target === "textarea" ? textarea : editable;
    const text = getInputText(el);
    const result = makeRedaction(text);
    const expected = result.redactedText;

    setInputText(el, expected, { caretOffset: expected.length });

    const actual = getInputText(el);
    const payload = {
      ok: actual === expected,
      expected,
      actual,
      findings: result.findings || []
    };

    renderStatus(target === "textarea" ? statusTextArea : statusEditable, payload);
    expectedOutput.textContent = expected;
  }

  function forceRewriteTarget(target) {
    const el = target === "textarea" ? textarea : editable;
    const expected = expectedOutput.textContent === "No scenario loaded."
      ? getInputText(el)
      : expectedOutput.textContent;

    forceRewriteInputText(el, expected, { caretOffset: expected.length });

    const actual = getInputText(el);
    const payload = {
      ok: actual === expected,
      expected,
      actual,
      findings: detector.scan(expected).filter((finding) => finding.severity !== "low")
    };

    renderStatus(target === "textarea" ? statusTextArea : statusEditable, payload);
  }

  document.querySelectorAll("[data-scenario]").forEach((button) => {
    button.addEventListener("click", () => {
      setScenario(scenarios[button.dataset.scenario] || "");
    });
  });

  document.querySelectorAll("[data-redact-target]").forEach((button) => {
    button.addEventListener("click", () => {
      redactTarget(button.dataset.redactTarget);
    });
  });

  document.querySelectorAll("[data-force-target]").forEach((button) => {
    button.addEventListener("click", () => {
      forceRewriteTarget(button.dataset.forceTarget);
    });
  });

  document.getElementById("redact-both").addEventListener("click", () => {
    redactTarget("textarea");
    redactTarget("editable");
  });

  document.getElementById("rewrite-both").addEventListener("click", () => {
    forceRewriteTarget("textarea");
    forceRewriteTarget("editable");
  });

  document.getElementById("clear-all").addEventListener("click", () => {
    setInputText(textarea, "", { caretOffset: 0 });
    setInputText(editable, "", { caretOffset: 0 });
    expectedOutput.textContent = "No scenario loaded.";
    statusTextArea.className = "";
    statusEditable.className = "";
    statusTextArea.textContent = "Idle.";
    statusEditable.textContent = "Idle.";
  });

  setScenario(scenarios.multiline);
})();
