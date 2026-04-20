(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function normalizeComposerText(value) {
    return String(value || "")
      .replace(/\r\n?/g, "\n")
      .replace(/\u00a0/g, " ")
      .replace(/[\u200B-\u200D\uFEFF]/g, "");
  }

  function normalizeEditorInnerText(value) {
    // Preserve intentional blank lines from contenteditable composers while
    // still collapsing DOM-generated runs longer than one empty line.
    return normalizeComposerText(value).replace(/\n{3,}/g, "\n\n");
  }

  function isTextArea(el) {
    return !!el && el.tagName === "TEXTAREA";
  }

  function isContentEditable(el) {
    return !!el && !isTextArea(el) && !!el.isContentEditable;
  }

  function isTextNode(node) {
    return !!node && node.nodeType === 3;
  }

  function isElementNode(node) {
    return !!node && node.nodeType === 1;
  }

  function isBreakElement(node) {
    return isElementNode(node) && node.tagName === "BR";
  }

  function isBlockElement(node) {
    if (!isElementNode(node)) return false;
    return /^(DIV|P|LI|PRE|BLOCKQUOTE)$/.test(node.tagName || "");
  }

  function readEditableNodeText(node) {
    if (!node) return "";
    if (isTextNode(node)) return normalizeComposerText(node.nodeValue || "");
    if (isBreakElement(node)) return "\n";
    if (!node.childNodes?.length) {
      return normalizeComposerText(node.textContent || "");
    }

    let output = "";
    for (const child of Array.from(node.childNodes || [])) {
      output += readEditableNodeText(child);
    }
    return output;
  }

  function trimTrailingEmptyLines(lines) {
    const next = [...lines];

    while (next.length > 1 && next[next.length - 1] === "") {
      next.pop();
    }

    if (next.length === 1 && next[0] === "") {
      return [];
    }

    return next;
  }

  function normalizeBlockText(value) {
    const normalized = normalizeComposerText(value);

    if (/^\n+$/.test(normalized)) {
      return "";
    }

    return normalized.replace(/\n+$/g, "");
  }

  function serializeContentEditableRoot(root) {
    if (!root?.childNodes?.length) {
      return normalizeEditorInnerText(root?.innerText || "");
    }

    const lines = [];
    let inlineBuffer = "";

    const flushInlineBuffer = () => {
      if (!inlineBuffer && lines.length === 0) return;
      lines.push(inlineBuffer);
      inlineBuffer = "";
    };

    for (const child of Array.from(root.childNodes || [])) {
      if (isTextNode(child)) {
        inlineBuffer += normalizeComposerText(child.nodeValue || "");
        continue;
      }

      if (isBreakElement(child)) {
        flushInlineBuffer();
        continue;
      }

      if (isBlockElement(child)) {
        if (inlineBuffer) {
          flushInlineBuffer();
        }
        lines.push(normalizeBlockText(readEditableNodeText(child)));
        continue;
      }

      inlineBuffer += readEditableNodeText(child);
    }

    if (inlineBuffer || !lines.length) {
      flushInlineBuffer();
    }

    return normalizeEditorInnerText(trimTrailingEmptyLines(lines).join("\n"));
  }

  function readContentEditableText(el) {
    return serializeContentEditableRoot(el);
  }

  function getInputText(el) {
    if (!el) return "";
    if (isTextArea(el)) return normalizeComposerText(el.value);
    if (isContentEditable(el)) return readContentEditableText(el);
    return "";
  }

  function lookupValueSetter(el) {
    let proto = el;

    while (proto) {
      const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
      if (descriptor && typeof descriptor.set === "function") {
        return descriptor.set;
      }
      proto = Object.getPrototypeOf(proto);
    }

    return null;
  }

  function dispatchInput(el, data, inputType) {
    let event;

    try {
      event = new InputEvent("input", {
        bubbles: true,
        composed: true,
        data: data == null ? null : String(data),
        inputType: inputType || "insertText"
      });
    } catch {
      event = new Event("input", { bubbles: true, composed: true });
    }

    el.dispatchEvent(event);
  }

  function setTextareaValue(el, value, options = {}) {
    const nextValue = normalizeComposerText(value);
    const setter = lookupValueSetter(el);

    if (setter) {
      setter.call(el, nextValue);
    } else {
      el.value = nextValue;
    }

    if (Number.isFinite(options.caretOffset)) {
      const caret = Math.max(0, Math.min(options.caretOffset, nextValue.length));
      el.setSelectionRange(caret, caret);
    }

    dispatchInput(el, nextValue, "insertReplacementText");
    el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  }

  function textToBlockFragment(text) {
    const fragment = document.createDocumentFragment();
    const normalized = normalizeComposerText(text);
    const lines = normalized.split("\n");

    lines.forEach((line) => {
      const block = document.createElement("div");

      if (line) {
        block.appendChild(document.createTextNode(line));
      } else {
        block.appendChild(document.createElement("br"));
      }

      fragment.appendChild(block);
    });

    if (!fragment.childNodes.length) {
      const block = document.createElement("div");
      block.appendChild(document.createElement("br"));
      fragment.appendChild(block);
    }

    return fragment;
  }

  function placeCaretAtEnd(el) {
    if (!isContentEditable(el)) return;

    const selection = window.getSelection();
    if (!selection) return;

    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function placeCaretAtOffset(el, offset) {
    if (!isContentEditable(el)) return;

    const selection = window.getSelection();
    if (!selection) return;

    const targetOffset = Math.max(0, Math.min(Number(offset) || 0, getInputText(el).length));
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_ALL, {
      acceptNode(node) {
        if (node.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
        if (node.nodeType === Node.ELEMENT_NODE && node.tagName === "BR") {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      }
    });

    const range = document.createRange();
    let seen = 0;
    let current;

    while ((current = walker.nextNode())) {
      if (current.nodeType === Node.TEXT_NODE) {
        const length = normalizeComposerText(current.nodeValue).length;

        if (seen + length >= targetOffset) {
          range.setStart(current, targetOffset - seen);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          return;
        }

        seen += length;
        continue;
      }

      if (current.nodeType === Node.ELEMENT_NODE && current.tagName === "BR") {
        if (seen >= targetOffset) {
          const parent = current.parentNode;
          const index = Array.prototype.indexOf.call(parent.childNodes, current);
          range.setStart(parent, index);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          return;
        }

        seen += 1;

        if (seen >= targetOffset) {
          const parent = current.parentNode;
          const index = Array.prototype.indexOf.call(parent.childNodes, current);
          range.setStart(parent, index + 1);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          return;
        }
      }
    }

    placeCaretAtEnd(el);
  }

  function rewriteContentEditable(el, value, options = {}) {
    const normalized = normalizeComposerText(value);
    const fragment = textToBlockFragment(normalized);

    el.focus();
    el.replaceChildren();
    el.appendChild(fragment);

    if (Number.isFinite(options.caretOffset)) {
      placeCaretAtOffset(el, options.caretOffset);
    } else {
      placeCaretAtEnd(el);
    }

    dispatchInput(el, normalized, "insertReplacementText");
  }

  function setInputText(el, value, options = {}) {
    if (!el) return;

    if (isTextArea(el)) {
      setTextareaValue(el, value, options);
      return;
    }

    if (isContentEditable(el)) {
      rewriteContentEditable(el, value, options);
    }
  }

  function forceRewriteInputText(el, value, options = {}) {
    if (!el) return;

    if (isTextArea(el)) {
      setTextareaValue(el, value, options);
      return;
    }

    if (isContentEditable(el)) {
      rewriteContentEditable(el, value, options);
    }
  }

  function rangeTextLength(fragment) {
    const wrapper = document.createElement("div");
    wrapper.appendChild(fragment);
    return readContentEditableText(wrapper).length;
  }

  function getSelectionOffsets(el) {
    const text = getInputText(el);

    if (isTextArea(el)) {
      return {
        start: el.selectionStart ?? text.length,
        end: el.selectionEnd ?? text.length
      };
    }

    if (!isContentEditable(el)) {
      return {
        start: text.length,
        end: text.length
      };
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return {
        start: text.length,
        end: text.length
      };
    }

    const range = selection.getRangeAt(0);
    if (!el.contains(range.startContainer) || !el.contains(range.endContainer)) {
      return {
        start: text.length,
        end: text.length
      };
    }

    const startRange = document.createRange();
    startRange.selectNodeContents(el);
    startRange.setEnd(range.startContainer, range.startOffset);

    const endRange = document.createRange();
    endRange.selectNodeContents(el);
    endRange.setEnd(range.endContainer, range.endOffset);

    return {
      start: rangeTextLength(startRange.cloneContents()),
      end: rangeTextLength(endRange.cloneContents())
    };
  }

  function spliceSelectionText(currentText, selection, insertedText) {
    const current = normalizeComposerText(currentText);
    const next = normalizeComposerText(insertedText);
    const start = Math.max(0, Math.min(selection?.start ?? current.length, current.length));
    const end = Math.max(start, Math.min(selection?.end ?? current.length, current.length));

    return {
      text: current.slice(0, start) + next + current.slice(end),
      caretOffset: start + next.length
    };
  }

  root.PWM.ComposerHelpers = {
    normalizeComposerText,
    normalizeEditorInnerText,
    serializeContentEditableRoot,
    isTextArea,
    isContentEditable,
    getInputText,
    getSelectionOffsets,
    spliceSelectionText,
    textToBlockFragment,
    setInputText,
    forceRewriteInputText
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.ComposerHelpers;
  }
})();
