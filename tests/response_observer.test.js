const assert = require("assert");
const path = require("path");

require(path.join(__dirname, "../src/content/rehydration/placeholderRehydrator.js"));
require(path.join(__dirname, "../src/content/rehydration/responseObserver.js"));

const ResponseObserver = globalThis.PWM.ResponseObserver;
const PlaceholderRehydrator = globalThis.PWM.PlaceholderRehydrator;

const NodeConstants = {
  ELEMENT_NODE: 1,
  TEXT_NODE: 3,
  DOCUMENT_FRAGMENT_NODE: 11
};
const NodeFilterConstants = {
  SHOW_TEXT: 4
};
const placeholderTokenRegex = /\[(?:PWM|NET|PUB_HOST)_\d+(?:_SUB_\d+)*(?:_(?:HOST_\d+|GW|VIP|DNS))?\]/g;

class FakeTextNode {
  constructor(value) {
    this.nodeType = NodeConstants.TEXT_NODE;
    this.nodeValue = value;
    this.parentElement = null;
  }

  get textContent() {
    return this.nodeValue;
  }
}

class FakeFragment {
  constructor() {
    this.nodeType = NodeConstants.DOCUMENT_FRAGMENT_NODE;
    this.childNodes = [];
  }

  appendChild(child) {
    this.childNodes.push(child);
    return child;
  }
}

class FakeElement {
  constructor(tagName, attrs = {}, children = []) {
    this.nodeType = NodeConstants.ELEMENT_NODE;
    this.tagName = tagName.toUpperCase();
    this.attrs = { ...attrs };
    this.className = attrs.class || "";
    this.childNodes = [];
    this.parentElement = null;
    this.replaceCount = 0;
    children.forEach((child) => this.appendChild(child));
  }

  appendChild(child) {
    child.parentElement = this;
    this.childNodes.push(child);
    return child;
  }

  replaceChild(newChild, oldChild) {
    const index = this.childNodes.indexOf(oldChild);
    assert.notStrictEqual(index, -1, "old child should be attached before replacement");
    this.replaceCount += 1;

    if (newChild.nodeType === NodeConstants.DOCUMENT_FRAGMENT_NODE) {
      newChild.childNodes.forEach((child) => {
        child.parentElement = this;
      });
      this.childNodes.splice(index, 1, ...newChild.childNodes);
    } else {
      newChild.parentElement = this;
      this.childNodes.splice(index, 1, newChild);
    }
  }

  closest(selector) {
    let current = this;
    while (current) {
      if (matchesSkipSelector(current, selector)) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  get textContent() {
    return this.childNodes.map((child) => child.textContent || "").join("");
  }
}

class FakeDocument {
  constructor(body = new FakeElement("body")) {
    this.body = body;
    this.walkCount = 0;
  }

  createDocumentFragment() {
    return new FakeFragment();
  }

  createTextNode(value) {
    return new FakeTextNode(value);
  }

  createTreeWalker(root) {
    this.walkCount += 1;
    const nodes = [];
    collectTextNodes(root, nodes);
    let index = -1;
    return {
      currentNode: null,
      nextNode() {
        index += 1;
        this.currentNode = nodes[index] || null;
        return Boolean(this.currentNode);
      }
    };
  }
}

class FakeMutationObserver {
  constructor(callback) {
    FakeMutationObserver.lastCallback = callback;
    this.observed = null;
  }

  observe(target, options) {
    this.observed = { target, options };
  }
}

function matchesSkipSelector(element) {
  const classes = String(element.className || "").split(/\s+/);
  return (
    classes.includes("pwm-modal-backdrop") ||
    classes.includes("pwm-secret") ||
    element.tagName === "FORM" ||
    element.tagName === "TEXTAREA" ||
    element.attrs.role === "textbox" ||
    element.attrs.contenteditable === "true"
  );
}

function collectTextNodes(node, nodes) {
  if (node.nodeType === NodeConstants.TEXT_NODE) {
    nodes.push(node);
    return;
  }
  for (const child of node.childNodes || []) {
    collectTextNodes(child, nodes);
  }
}

function text(value) {
  return new FakeTextNode(value);
}

function element(tagName, attrs, children) {
  return new FakeElement(tagName, attrs, children);
}

function createOptions({ document, placeholderCount = 1, createdSpans = [] } = {}) {
  return {
    document,
    Node: NodeConstants,
    NodeFilter: NodeFilterConstants,
    MutationObserver: FakeMutationObserver,
    normalizeVisiblePlaceholders: (value) => String(value || ""),
    placeholderTokenRegex,
    placeholderCount,
    tokenizePlaceholderText: PlaceholderRehydrator.tokenizePlaceholderText,
    createSecretSpan: (placeholder) => {
      const span = element("span", { class: "pwm-secret" }, [text(placeholder)]);
      createdSpans.push(span);
      return span;
    }
  };
}

function assertDebugPayloadsAreMetadataOnly(events, rawText) {
  const serialized = JSON.stringify(events);
  assert.strictEqual(serialized.includes(rawText), false, "debug payloads must not include raw text");
  for (const event of events) {
    assert.ok(event.label.startsWith("rehydrate:"), "rehydration debug labels should be stable");
    for (const value of Object.values(event.payload)) {
      assert.ok(
        value == null || ["boolean", "number", "string"].includes(typeof value),
        "rehydration debug payload values should stay scalar metadata"
      );
    }
  }
}

function testShouldSkipHydration() {
  for (const [label, parent] of [
    ["modal", element("div", { class: "pwm-modal-backdrop" }, [])],
    ["secret", element("span", { class: "pwm-secret" }, [])],
    ["form", element("form", {}, [])],
    ["textarea", element("textarea", {}, [])],
    ["textbox", element("div", { role: "textbox" }, [])],
    ["contenteditable", element("div", { contenteditable: "true" }, [])]
  ]) {
    const node = text("[PWM_1]");
    parent.appendChild(node);
    assert.strictEqual(ResponseObserver.shouldSkipHydration(node), true, `${label} should be skipped`);
  }

  const eligibleParent = element("p", {}, []);
  const eligibleText = text("[PWM_1]");
  eligibleParent.appendChild(eligibleText);
  assert.strictEqual(ResponseObserver.shouldSkipHydration(eligibleText), false);
}

function testHydrateTextNodeCreatesInjectedSpansForTrustedPlaceholders() {
  const node = text("before [PWM_1] after");
  const parent = element("p", {}, [node]);
  const doc = new FakeDocument(parent);
  const createdSpans = [];

  ResponseObserver.hydrateTextNode(node, createOptions({ document: doc, placeholderCount: 1, createdSpans }));

  assert.strictEqual(createdSpans.length, 1);
  assert.strictEqual(createdSpans[0].textContent, "[PWM_1]");
  assert.deepStrictEqual(
    parent.childNodes.map((child) => child.textContent),
    ["before ", "[PWM_1]", " after"]
  );
}

function testHydrateTextNodeLeavesUnknownPlaceholdersPlain() {
  const node = text("before [PWM_3] after");
  const parent = element("p", {}, [node]);
  const doc = new FakeDocument(parent);
  const createdSpans = [];

  ResponseObserver.hydrateTextNode(node, createOptions({ document: doc, placeholderCount: 2, createdSpans }));

  assert.strictEqual(createdSpans.length, 0);
  assert.strictEqual(parent.textContent, "before [PWM_3] after");
}

function testRehydrateTreeDoesNothingWithoutPlaceholders() {
  const node = text("plain text");
  const root = element("div", {}, [element("p", {}, [node])]);
  const doc = new FakeDocument(root);

  ResponseObserver.rehydrateTree(root, createOptions({ document: doc, placeholderCount: 1 }));

  assert.strictEqual(root.childNodes[0].replaceCount, 0);
  assert.strictEqual(root.textContent, "plain text");
}

function testRehydrateTreeHydratesOnlyEligibleTextNodes() {
  const eligibleText = text("[PWM_1]");
  const skippedText = text("[PWM_1]");
  const eligible = element("p", {}, [eligibleText]);
  const skipped = element("form", {}, [skippedText]);
  const root = element("div", {}, [eligible, skipped]);
  const doc = new FakeDocument(root);
  const createdSpans = [];

  ResponseObserver.rehydrateTree(root, createOptions({ document: doc, placeholderCount: 1, createdSpans }));

  assert.strictEqual(createdSpans.length, 1);
  assert.strictEqual(eligible.childNodes[0].tagName, "SPAN");
  assert.strictEqual(skipped.childNodes[0], skippedText);
}

function testStartRehydrationObserverKeepsBoundedAddedElementScan() {
  FakeMutationObserver.lastCallback = null;
  let observerState = null;
  const body = element("body", {}, []);
  const doc = new FakeDocument(body);
  const options = {
    ...createOptions({ document: doc, placeholderCount: 1 }),
    getObserver: () => observerState,
    setObserver: (observer) => {
      observerState = observer;
    }
  };

  ResponseObserver.startRehydrationObserver(options);
  assert.ok(observerState, "observer should be stored through injected setter");
  assert.deepStrictEqual(observerState.observed.options, {
    childList: true,
    characterData: true,
    subtree: true
  });

  const walksAfterInitialHydration = doc.walkCount;
  FakeMutationObserver.lastCallback([
    {
      type: "childList",
      addedNodes: [element("div", {}, [text("plain added text")])]
    }
  ]);
  assert.strictEqual(doc.walkCount, walksAfterInitialHydration, "plain added elements should not be tree-walked");

  FakeMutationObserver.lastCallback([
    {
      type: "childList",
      addedNodes: [element("div", {}, [text("[PWM_1]")])]
    }
  ]);
  assert.strictEqual(doc.walkCount, walksAfterInitialHydration + 1, "placeholder-like added elements should be tree-walked");
}

function testRehydrationDebugPayloadsStayMetadataOnly() {
  FakeMutationObserver.lastCallback = null;
  const events = [];
  let observerState = null;
  const rawText = "raw response text [PWM_1] RawSecretABCDE12345";
  const body = element("body", {}, []);
  const doc = new FakeDocument(body);
  const options = {
    ...createOptions({ document: doc, placeholderCount: 1 }),
    debug: (label, payload) => events.push({ label, payload }),
    getObserver: () => observerState,
    setObserver: (observer) => {
      observerState = observer;
    }
  };

  ResponseObserver.startRehydrationObserver(options);
  FakeMutationObserver.lastCallback([
    {
      type: "childList",
      addedNodes: [element("div", {}, [text(rawText)])]
    }
  ]);

  assert.ok(events.some((event) => event.label === "rehydrate:element-added"));
  assert.ok(events.some((event) => event.label === "rehydrate:text-node"));
  assertDebugPayloadsAreMetadataOnly(events, rawText);
}

testShouldSkipHydration();
testHydrateTextNodeCreatesInjectedSpansForTrustedPlaceholders();
testHydrateTextNodeLeavesUnknownPlaceholdersPlain();
testRehydrateTreeDoesNothingWithoutPlaceholders();
testRehydrateTreeHydratesOnlyEligibleTextNodes();
testStartRehydrationObserverKeepsBoundedAddedElementScan();
testRehydrationDebugPayloadsStayMetadataOnly();

console.log("PASS response observer DOM hydration regressions");
