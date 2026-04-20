const assert = require("assert");
const path = require("path");

require(path.join(__dirname, "../content/composer_helpers.js"));

const { normalizeEditorInnerText, serializeContentEditableRoot } = globalThis.PWM.ComposerHelpers;

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

function run() {
  testPreservesSingleIntentionalBlankLine();
  testCollapsesExcessBlankRunsToOneEmptyLine();
  testSerializesBlockTreeWithBlankLines();
  testTrimsEditorGeneratedTrailingBlankLines();
  console.log("PASS composer helper multiline normalization regressions");
}

run();
