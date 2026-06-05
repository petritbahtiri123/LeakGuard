(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};
  const adapters = (root.PWM.SiteAdapters = root.PWM.SiteAdapters || {});

  const SECRET_TEXT_PATTERN =
    /(?:bearer\s+[a-z0-9._~+/=-]+|api[_-]?key|authorization|cookie|password|secret|token|sk-[a-z0-9_-]{12,}|AKIA[0-9A-Z]{16})/i;
  const HIGH_ENTROPY_PATTERN = /[A-Za-z0-9+/=_-]{24,}/;
  const PATH_OR_FILE_PATTERN = /(?:[A-Za-z]:[\\/]|[\\/][^\\/]+[\\/]|[A-Za-z0-9_.-]+\.[A-Za-z0-9]{1,12}(?:$|[\s?#]))/;

  const SELECTORS = {
    promptEditor: [
      'rich-textarea [contenteditable="true"]',
      '[contenteditable="true"][role="textbox"]',
      '[role="textbox"][aria-label*="prompt" i]',
      '[role="textbox"][aria-label*="message" i]',
      "div.ql-editor",
      "textarea"
    ],
    plusUploadButton: [
      'button[aria-label="Open upload file menu"]',
      'button[aria-label*="upload" i]',
      'button[aria-label*="attach" i]',
      'button[aria-label*="add" i]',
      '[role="button"][aria-label*="upload" i]',
      '[role="button"][aria-label*="attach" i]',
      "button.upload-card-button",
      "mat-icon.upload-icon",
      "[data-test-id*='upload' i]",
      "[data-test-id*='attach' i]"
    ],
    uploadOption: [
      '[role="menuitem"]',
      '[role="option"]',
      ".cdk-overlay-pane button",
      ".mat-mdc-menu-panel button",
      "mat-bottom-sheet-container button",
      '[aria-label*="upload" i]',
      '[aria-label*="file" i]',
      '[aria-label*="more uploads" i]'
    ],
    fileInput: [
      'input[type="file"][name="Filedata"]',
      'input[type="file"][multiple]',
      'input[type="file"]'
    ],
    dropTarget: [
      "[data-drop-target]",
      "[data-upload-drop-target]",
      "[aria-label*='drop' i]",
      "[aria-label*='upload' i]",
      ".drop-zone",
      ".upload-drop-zone",
      "images-files-uploader"
    ],
    generatedDownload: [
      'a[download]',
      'a[href^="blob:"]',
      'a[href^="data:"][download]',
      'button[aria-label*="download" i]',
      '[role="button"][aria-label*="download" i]',
      '[data-test-id*="download" i]'
    ]
  };

  function toArray(value) {
    try {
      return Array.from(value || []);
    } catch {
      return [];
    }
  }

  function getAttr(element, name) {
    try {
      return element?.getAttribute?.(name) || "";
    } catch {
      return "";
    }
  }

  function hasAttr(element, name) {
    try {
      return Boolean(element?.hasAttribute?.(name));
    } catch {
      return false;
    }
  }

  function safeText(value) {
    const text = String(value || "").replace(/\s+/g, " ").trim().slice(0, 120);
    if (!text) return "";
    if (SECRET_TEXT_PATTERN.test(text) || HIGH_ENTROPY_PATTERN.test(text) || PATH_OR_FILE_PATTERN.test(text)) {
      return { redacted: true, length: text.length };
    }
    return text;
  }

  function classNames(element) {
    const raw = String(element?.className || getAttr(element, "class") || "");
    return raw
      .split(/\s+/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 12)
      .map(safeText);
  }

  function hrefScheme(element) {
    const href = String(getAttr(element, "href") || element?.href || "");
    const match = /^([a-z][a-z0-9+.-]*):/i.exec(href);
    return match ? match[1].toLowerCase() : "none";
  }

  function displayState(element) {
    let display = "";
    let visibility = "";
    try {
      const style = typeof root.getComputedStyle === "function" ? root.getComputedStyle(element) : null;
      display = style?.display || "";
      visibility = style?.visibility || "";
    } catch {
      display = "";
      visibility = "";
    }
    return {
      hidden: Boolean(element?.hidden) || getAttr(element, "aria-hidden") === "true",
      display: display || "unknown",
      visibility: visibility || "unknown"
    };
  }

  function metadataFor(element, kind, selector, source) {
    const tagName = String(element?.tagName || "").toLowerCase();
    return {
      kind,
      selector,
      source,
      tagName,
      role: safeText(getAttr(element, "role") || element?.role || ""),
      ariaLabel: safeText(getAttr(element, "aria-label") || element?.ariaLabel || ""),
      classNames: classNames(element),
      input: tagName === "input"
        ? {
            accept: safeText(element?.accept || getAttr(element, "accept") || ""),
            multiple: Boolean(element?.multiple)
          }
        : null,
      state: displayState(element),
      hrefScheme: hrefScheme(element)
    };
  }

  function collectRoots(startRoot, roots, visited) {
    if (!startRoot || visited.has(startRoot)) return;
    visited.add(startRoot);
    roots.push(startRoot);
    for (const element of toArray(startRoot.querySelectorAll?.("*"))) {
      if (element?.shadowRoot) {
        collectRoots(element.shadowRoot, roots, visited);
      }
    }
  }

  function queryCategory(scanRoot, selectors, kind, output, source) {
    const seen = output.seen;
    for (const selector of selectors) {
      try {
        scanRoot.querySelectorAll?.(selector).forEach((element) => {
          if (!element || seen.has(element)) return;
          seen.add(element);
          output.items.push(metadataFor(element, kind, selector, source));
        });
      } catch {
        // Keep diagnostics best-effort across selector support.
      }
    }
  }

  function scanGeminiUi(scanRoot) {
    const roots = [];
    collectRoots(scanRoot || root.document, roots, new WeakSet());
    const categories = {};

    for (const [kind, selectors] of Object.entries(SELECTORS)) {
      const output = { items: [], seen: new WeakSet() };
      for (const scan of roots) {
        queryCategory(scan, selectors, kind, output, scan === root.document ? "document" : "shadow-root");
      }
      categories[kind] = output.items.slice(0, 40);
    }

    return {
      summary: Object.fromEntries(Object.entries(categories).map(([kind, items]) => [kind, items.length])),
      categories
    };
  }

  adapters.GeminiDiagnosticsAdapter = {
    scanGeminiUi
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = adapters.GeminiDiagnosticsAdapter;
  }
})();
