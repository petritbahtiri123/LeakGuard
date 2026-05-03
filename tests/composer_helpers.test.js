const assert = require("assert");
const fs = require("fs");
const path = require("path");

require(path.join(__dirname, "../src/content/composer_helpers.js"));

const {
  normalizeEditorInnerText,
  serializeContentEditableRoot
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

function run() {
  testPreservesSingleIntentionalBlankLine();
  testCollapsesExcessBlankRunsToOneEmptyLine();
  testSerializesBlockTreeWithBlankLines();
  testTrimsEditorGeneratedTrailingBlankLines();
  testSerializesTopLevelBreakRunsAsBlankLines();
  testContentEditableRewritePathsSyncHostState();
  testLocalFileFallbackHelpersUsePlainEvents();
  console.log("PASS composer helper multiline normalization regressions");
}

run();
