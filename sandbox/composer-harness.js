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
    "aws-multiline": [
      'AWS_ACCESS_KEY_ID="AKIAZQ1X2C3V4B5N6M7P"',
      'AWS_SECRET_ACCESS_KEY="qY7bN2pL8rT4mV1xC6dF9gH3jK5sW0zA2uD7eL4p"',
      'AWS_SESSION_TOKEN="IQoJb3JpZ2luX2VjEMv//////////wEaCXVzLWVhc3QtMSJGMEQCIBxY2FzZVN0dWR5VG9rZW4wMTIz"'
    ].join("\n"),
    "jwt-bearer":
      "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50IjoiZGV2In0.c2lnbmF0dXJlX3ZhbHVlXzEyMzQ1",
    "pem-block":
      "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAA=\n-----END OPENSSH PRIVATE KEY-----",
    webhook:
      "alerts:\nhttps://hooks.slack.com/services/T12345678/B12345678/abcdefghijklmnopqrstuvwxyzABCD\nhttps://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyzABCDEFGHijklmnopQRSTUVWX",
    "same-value": 'db_password = "RepeatPass_111!!"\nbackup_password = "RepeatPass_111!!"',
    "different-values": 'db_password = "AlphaPass_111!!"\nbackup_password = "BetaPass_222!!"',
    "natural-language-password": 'my password is "ForestLock!2026!PS"',
    "final-regression": [
      "FINAL REGRESSION TEST",
      "",
      "API_KEY=sk_live_7Qm2Lp9Xv4Nc8Tr6Yh1Zw5Kd3Bj0Pf",
      "DB_PASSWORD=VaultHorse!2026!Test",
      "TOKEN=eyJhbGciOiJIUzI1NiJ9.UExBQ0VIT0xERVJfUEFZTE9BRA.U2lnbmF0dXJlVGVzdDEyMw",
      "AWS_SECRET_ACCESS_KEY=Qm9Wc3RrL1pXcDcrTjVxUXIvV2hKc1l4cG9DdzJm",
      "",
      "API_KEY=[PWM_1]",
      "DB_PASSWORD=[PWM_2]",
      "TOKEN=[PWM_3]",
      "AWS_SECRET_ACCESS_KEY=[PWM_4]",
      "",
      "AUTHORIZATION=Bearer mF_9.B5f-4.1JqM",
      "Authorization: Bearer HeaderToken123456",
      "",
      '{"password":"PrinterCable!2026!Demo","token":"eyJhbGciOiJIUzI1NiJ9.TESTPAYLOAD.TESTSIG"}',
      "",
      'export API_KEY="sk_proj_9Zx2Lm7Qp4Vc8Rt5Yn1Kd6Hs3Bw0Tf"',
      '$env:DB_PASSWORD="ForestLock!2026!PS"',
      "",
      "[PWM_5]suffix",
      "prefix_[PWM_1]",
      "",
      "my api key is sk_live_7Qm2Lp9Xv4Nc8Tr6Yh1Zw5Kd3Bj0Pf",
      "my password is VaultHorse!2026!Test"
    ].join("\n"),
    "mixed-multiline": [
      'SESSION_SECRET="ProdSessionSecretValue_Alpha987654321"',
      "Authorization: Basic ZGVwbG95OlN1cGVyU2VjcmV0IQ==",
      '{"auths":{"https://index.docker.io/v1/":{"auth":"dXNlcjpTdXBlclNlY3JldDEyMw=="}}}'
    ].join("\n"),
    "safe-text": "Write a short project update about the browser rewrite harness."
  };

  const textarea = document.getElementById("harness-textarea");
  const editable = document.getElementById("harness-editable");
  const expectedOutput = document.getElementById("expected-output");
  const statusTextArea = document.getElementById("status-textarea");
  const statusEditable = document.getElementById("status-editable");
  const revealOutput = document.getElementById("reveal-output");
  const revealStatus = document.getElementById("reveal-status");
  const revealManager = new PlaceholderManager();

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

  function renderRevealStatus(message, ok) {
    revealStatus.className = ok ? "status-ok" : "status-fail";
    revealStatus.textContent = message;
  }

  function buildRevealSpan(segment) {
    const span = document.createElement("span");
    span.className = "pwm-secret";
    span.textContent = segment.placeholder;
    span.title = "Secure reveal is extension-only";
    span.addEventListener("click", () => {
      const known = Boolean(revealManager.getRaw(segment.placeholder));
      renderRevealStatus(
        known
          ? `Known placeholder: ${segment.placeholder}. Secure reveal stays inside the extension UI.`
          : `Unknown placeholder: ${segment.placeholder}. Secure reveal would be unavailable.`,
        known
      );
    });
    return span;
  }

  function renderRevealText(text) {
    revealOutput.replaceChildren();
    const segments = revealManager.segmentText(text);
    for (const segment of segments) {
      if (segment.type === "text") {
        revealOutput.append(document.createTextNode(segment.value));
      } else {
        revealOutput.append(buildRevealSpan(segment));
      }
    }
  }

  function loadKnownReveal() {
    revealManager.reset();
    const placeholder = revealManager.getPlaceholder("known-local-secret-value-12345", "TOKEN");
    renderRevealText(`Assistant echoed ${placeholder} after route change.`);
    renderRevealStatus(`Loaded known placeholder: ${placeholder}`, true);
  }

  function loadUnknownReveal() {
    revealManager.reset();
    renderRevealText("Assistant echoed [PWM_404] without local state.");
    renderRevealStatus("Loaded unknown placeholder fixture", false);
  }

  function rerenderKnownReveal() {
    const state = revealManager.exportPrivateState();
    const placeholder = Object.keys(state.placeholderToFingerprint || {})[0];
    if (!placeholder) {
      renderRevealStatus("Load a known placeholder first.", false);
      return;
    }

    const nextManager = new PlaceholderManager();
    nextManager.setPrivateState(state);
    revealManager.setPrivateState(nextManager.exportPrivateState());
    renderRevealText(`Assistant echoed ${placeholder} again after navigation.`);
    renderRevealStatus(`Re-rendered placeholder from saved state: ${placeholder}`, true);
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
    revealManager.reset();
    revealOutput.textContent = "";
    revealStatus.className = "";
    revealStatus.textContent = "Idle.";
  });

  document.getElementById("load-known-reveal").addEventListener("click", loadKnownReveal);
  document.getElementById("load-unknown-reveal").addEventListener("click", loadUnknownReveal);
  document.getElementById("rerender-known-reveal").addEventListener("click", rerenderKnownReveal);

  setScenario(scenarios.multiline);
  loadKnownReveal();
})();
