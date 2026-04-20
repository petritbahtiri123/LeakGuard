const assert = require("assert");
const path = require("path");

require(path.join(__dirname, "../content/composer_helpers.js"));

const {
  normalizeEditorInnerText,
  serializeContentEditableRoot
} = globalThis.PWM.ComposerHelpers;

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
      textNode("API_KEY=[API_KEY_1]"),
      brNode(),
      textNode("DB_PASSWORD=[PASSWORD_1]"),
      brNode(),
      brNode(),
      textNode("AUTHORIZATION=Bearer mF_9.B5f-4.1JqM")
    ],
    innerText:
      "FINAL REGRESSION TEST\nAPI_KEY=[API_KEY_1]\nDB_PASSWORD=[PASSWORD_1]\nAUTHORIZATION=Bearer mF_9.B5f-4.1JqM"
  };

  const actual = serializeContentEditableRoot(root);

  assert.strictEqual(
    actual,
    "FINAL REGRESSION TEST\n\nAPI_KEY=[API_KEY_1]\nDB_PASSWORD=[PASSWORD_1]\n\nAUTHORIZATION=Bearer mF_9.B5f-4.1JqM",
    "contenteditable tree serialization should preserve blank lines from top-level BR runs"
  );
}

function run() {
  testPreservesSingleIntentionalBlankLine();
  testCollapsesExcessBlankRunsToOneEmptyLine();
  testSerializesBlockTreeWithBlankLines();
  testTrimsEditorGeneratedTrailingBlankLines();
  testSerializesTopLevelBreakRunsAsBlankLines();
  console.log("PASS composer helper multiline normalization regressions");
}

run();
