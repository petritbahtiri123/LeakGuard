const assert = require("assert");
const fs = require("fs");
const path = require("path");

require(path.join(__dirname, "../src/content/composer_helpers.js"));

const {
  normalizeEditorInnerText,
  serializeContentEditableRoot,
  buildRiskFingerprint
} = globalThis.PWM.ComposerHelpers;

const composerHelperSource = fs.readFileSync(
  path.join(__dirname, "../src/content/composer_helpers.js"),
  "utf8"
);

function textNode(value) {
  return {
    nodeType: 3,
    nodeValue: value
  };
}

function brNode() {
  return {
    nodeType: 1,
    tagName: "BR",
    childNodes: [],
    textContent: ""
  };
}

function elementNode(tagName, childNodes = []) {
  return {
    nodeType: 1,
    tagName,
    childNodes,
    textContent: childNodes.map((child) => child.textContent || child.nodeValue || "").join("")
  };
}

function testPreservesSingleIntentionalBlankLine() {
  const input = "Heading\n\nBody";
  const actual = normalizeEditorInnerText(input);

  assert.strictEqual(
    actual,
    "Heading\n\nBody",
    "contenteditable normalization should preserve intentional blank lines"
  );
}

function testCollapsesExcessBlankRunsToOneEmptyLine() {
  const input = "Heading\n\n\nBody";
  const actual = normalizeEditorInnerText(input);

  assert.strictEqual(
    actual,
    "Heading\n\nBody",
    "contenteditable normalization should collapse runs longer than one empty line"
  );
}

function testSerializesBlockTreeWithBlankLines() {
  const root = {
    childNodes: [
      elementNode("DIV", [textNode("Heading")]),
      elementNode("DIV", [brNode()]),
      elementNode("DIV", [textNode("Body")])
    ],
    innerText: "Heading\nBody"
  };

  const actual = serializeContentEditableRoot(root);

  assert.strictEqual(
    actual,
    "Heading\n\nBody",
    "contenteditable tree serialization should preserve empty block lines"
  );
}

function testTrimsEditorGeneratedTrailingBlankLines() {
  const root = {
    childNodes: [
      elementNode("DIV", [textNode("Heading")]),
      elementNode("DIV", [brNode()]),
      elementNode("DIV", [textNode("Body")]),
      elementNode("DIV", [brNode()]),
      elementNode("DIV", [brNode()])
    ],
    innerText: "Heading\nBody\n\n"
  };

  const actual = serializeContentEditableRoot(root);

  assert.strictEqual(
    actual,
    "Heading\n\nBody",
    "contenteditable tree serialization should ignore trailing empty editor blocks"
  );
}

function testSerializesTopLevelBreakRunsAsBlankLines() {
  const root = {
    childNodes: [
      textNode("FINAL REGRESSION TEST"),
      brNode(),
      brNode(),
      textNode("API_KEY=[PWM_1]"),
      brNode(),
      textNode("DB_PASSWORD=[PWM_2]"),
      brNode(),
      brNode(),
      textNode("AUTHORIZATION=Bearer mF_9.B5f-4.1JqM")
    ],
    innerText:
      "FINAL REGRESSION TEST\nAPI_KEY=[PWM_1]\nDB_PASSWORD=[PWM_2]\nAUTHORIZATION=Bearer mF_9.B5f-4.1JqM"
  };

  const actual = serializeContentEditableRoot(root);

  assert.strictEqual(
    actual,
    "FINAL REGRESSION TEST\n\nAPI_KEY=[PWM_1]\nDB_PASSWORD=[PWM_2]\n\nAUTHORIZATION=Bearer mF_9.B5f-4.1JqM",
    "contenteditable tree serialization should preserve blank lines from top-level BR runs"
  );
}

function testContentEditableRewritePathsSyncHostState() {
  const nativeSource = composerHelperSource.match(
    /function rewriteContentEditableNative\([^)]*\) \{[\s\S]*?\n  \}/
  )?.[0];
  const htmlSource = composerHelperSource.match(
    /function rewriteContentEditableHtml\([^)]*\) \{[\s\S]*?\n  \}/
  )?.[0];
  const setInputSource = composerHelperSource.match(
    /function setInputText\([^)]*\) \{[\s\S]*?\n  \}/
  )?.[0];

  assert.ok(
    nativeSource?.includes('dispatchInput(el, normalized, "insertReplacementText");'),
    "native contenteditable rewrites should dispatch input so controlled editors sync their model"
  );
  assert.ok(
    htmlSource?.includes('dispatchInput(el, normalized, "insertReplacementText");'),
    "HTML contenteditable rewrites should dispatch input so controlled editors sync their model"
  );
  assert.ok(
    setInputSource?.includes("rewriteMatchesExpected"),
    "contenteditable rewrite orchestration should fall through when a strategy reports success but leaves mismatched text"
  );
}

function testLocalFileFallbackHelpersUsePlainEvents() {
  const commandSource = composerHelperSource.match(
    /function insertContentEditableTextCommand\([^)]*\) \{[\s\S]*?\n  \}/
  )?.[0];
  const directSource = composerHelperSource.match(
    /function setInputTextDirect\([^)]*\) \{[\s\S]*?\n  \}/
  )?.[0];

  assert.ok(
    commandSource?.includes('runEditableCommand("insertText", normalized)'),
    "local file fallback should use execCommand insertText after verified rewrite failure"
  );
  assert.ok(
    commandSource?.includes("dispatchPlainInput(el);"),
    "execCommand fallback should dispatch plain input/change events"
  );
  assert.ok(
    directSource?.includes("el.textContent = normalized"),
    "direct contenteditable fallback should use textContent for redacted text only"
  );
  assert.ok(
    directSource?.includes("dispatchPlainInput(el);"),
    "direct fallback should notify host editors without synthetic raw file payloads"
  );
}

function testRiskFingerprintIgnoresNormalComposerTextChanges() {
  const text = "username=wayland.dev";
  const continued = `${text} is the account name, not a password.`;
  const finding = {
    type: "USERNAME",
    severity: "medium",
    raw: "wayland.dev",
    start: 9,
    end: 20
  };

  assert.strictEqual(
    buildRiskFingerprint([finding], text),
    buildRiskFingerprint([finding], continued),
    "normal text appended after a finding should not change the allow-once fingerprint"
  );
}

function testRiskFingerprintChangesWhenFindingsChange() {
  const text = "username=wayland.dev public resolver 8.8.8.8";
  const original = buildRiskFingerprint([
    {
      type: "USERNAME",
      severity: "medium",
      raw: "wayland.dev",
      start: 9,
      end: 20
    }
  ], text);
  const added = buildRiskFingerprint([
    {
      type: "USERNAME",
      severity: "medium",
      raw: "wayland.dev",
      start: 9,
      end: 20
    },
    {
      type: "PUBLIC_IP",
      severity: "medium",
      raw: "8.8.8.8",
      start: 37,
      end: 44
    }
  ], text);
  const replaced = buildRiskFingerprint([
    {
      type: "USERNAME",
      severity: "medium",
      raw: "other.dev",
      start: 9,
      end: 18
    }
  ], "username=other.dev");

  assert.notStrictEqual(added, original, "adding a new sensitive finding should change the fingerprint");
  assert.notStrictEqual(replaced, original, "changing a sensitive value should change the fingerprint");
}

function testRiskFingerprintDoesNotStoreRawFindingValues() {
  const rawSecret = "AllowOnceRawSecret12345";
  const fingerprint = buildRiskFingerprint([
    {
      type: "SECRET",
      severity: "medium",
      raw: rawSecret
    }
  ]);

  assert.strictEqual(
    fingerprint.includes(rawSecret),
    false,
    "risk fingerprints should not contain raw finding values"
  );
}

function testRiskFingerprintUsesRangeWhenFindingHasNoRawValue() {
  const text = "explain token FutureToken12345 safely";
  const continued = `${text} with ordinary context`;
  const finding = {
    type: "SECRET",
    severity: "medium",
    method: "future-detector",
    start: 14,
    end: 30
  };
  const fingerprint = buildRiskFingerprint([finding], text);

  assert.ok(fingerprint, "range-only findings should still produce an allow-once fingerprint");
  assert.strictEqual(
    fingerprint,
    buildRiskFingerprint([finding], continued),
    "range-only findings should stay stable when normal text is appended after allow once"
  );
  assert.strictEqual(
    fingerprint.includes("FutureToken12345"),
    false,
    "range-derived fingerprints should not store the sliced raw value"
  );
}

function testRiskFingerprintChangesForNewRangeOnlyFinding() {
  const text = "explain token FutureToken12345 safely and ip 8.8.8.8";
  const original = buildRiskFingerprint([
    {
      type: "SECRET",
      severity: "medium",
      method: "future-detector",
      start: 14,
      end: 30
    }
  ], text);
  const added = buildRiskFingerprint([
    {
      type: "SECRET",
      severity: "medium",
      method: "future-detector",
      start: 14,
      end: 30
    },
    {
      type: "PUBLIC_IP",
      severity: "medium",
      method: "future-network",
      start: 45,
      end: 52
    }
  ], text);

  assert.notStrictEqual(
    added,
    original,
    "adding a new range-only finding should reopen the modal"
  );
}

function testAnonymousRiskFingerprintIsConservativelyUnstable() {
  const first = buildRiskFingerprint([
    {
      type: "FUTURE_SECRET",
      severity: "medium",
      method: "anonymous-detector"
    }
  ], "normal text");
  const second = buildRiskFingerprint([
    {
      type: "FUTURE_SECRET",
      severity: "medium",
      method: "anonymous-detector"
    }
  ], "different normal text");

  assert.notStrictEqual(
    first,
    second,
    "findings without safe identity, raw value, or range should not suppress unrelated future findings"
  );
}

function run() {
  testPreservesSingleIntentionalBlankLine();
  testCollapsesExcessBlankRunsToOneEmptyLine();
  testSerializesBlockTreeWithBlankLines();
  testTrimsEditorGeneratedTrailingBlankLines();
  testSerializesTopLevelBreakRunsAsBlankLines();
  testContentEditableRewritePathsSyncHostState();
  testLocalFileFallbackHelpersUsePlainEvents();
  testRiskFingerprintIgnoresNormalComposerTextChanges();
  testRiskFingerprintChangesWhenFindingsChange();
  testRiskFingerprintDoesNotStoreRawFindingValues();
  testRiskFingerprintUsesRangeWhenFindingHasNoRawValue();
  testRiskFingerprintChangesForNewRangeOnlyFinding();
  testAnonymousRiskFingerprintIsConservativelyUnstable();
  console.log("PASS composer helper multiline normalization regressions");
}

run();
