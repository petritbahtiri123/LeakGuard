(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function createContentModalUi(options = {}) {
    const documentRef = options.documentRef || (typeof document !== "undefined" ? document : null);
    const windowRef = options.windowRef || (typeof window !== "undefined" ? window : {});
    const getModalOpen = typeof options.getModalOpen === "function" ? options.getModalOpen : () => false;
    const setModalOpen = typeof options.setModalOpen === "function" ? options.setModalOpen : () => {};

    function closeModal(backdrop, onClose) {
      if (backdrop?.parentNode) {
        backdrop.parentNode.removeChild(backdrop);
      }

      setModalOpen(false);

      if (typeof onClose === "function") {
        onClose();
      }
    }

    function appendFindingRow(container) {
      const row = documentRef.createElement("div");
      row.className = "pwm-finding";
      row.textContent = "Sensitive item detected";
      container.appendChild(row);
    }

    function consumeModalEvent(event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }
    }

    function showDecisionModal(findings, mode, _modalOptions = {}) {
      if (getModalOpen()) {
        return Promise.resolve({ action: "cancel" });
      }

      setModalOpen(true);
      return new Promise((resolve) => {
        const backdrop = documentRef.createElement("div");
        backdrop.className = "pwm-modal-backdrop";

        const modal = documentRef.createElement("div");
        modal.className = "pwm-modal";
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");
        modal.tabIndex = -1;

        const title = documentRef.createElement("h2");
        title.textContent = "LeakGuard detected sensitive content";

        const desc = documentRef.createElement("p");
        desc.textContent =
          mode === "paste"
            ? "This pasted content appears to contain sensitive material. Redact it before it reaches the chat input, or cancel the paste."
            : mode === "input"
              ? "This typed content may contain sensitive material. Redact it before it stays in the chat input, or cancel the edit."
            : "This message appears to contain sensitive material. Redact it before sending, or cancel the send.";

        const findingsWrap = documentRef.createElement("div");
        findingsWrap.className = "pwm-findings";
        findings.slice(0, 8).forEach(() => appendFindingRow(findingsWrap));

        const actions = documentRef.createElement("div");
        actions.className = "pwm-actions";

        const cancelBtn = documentRef.createElement("button");
        cancelBtn.className = "pwm-btn";
        cancelBtn.type = "button";
        cancelBtn.textContent = "Cancel";

        const redactBtn = documentRef.createElement("button");
        redactBtn.className = "pwm-btn pwm-btn-primary";
        redactBtn.type = "button";
        redactBtn.textContent = "Redact";

        const finish = (result) => {
          windowRef.removeEventListener?.("keydown", onKeyDown, true);
          windowRef.removeEventListener?.("keypress", onKeyPassthrough, true);
          windowRef.removeEventListener?.("keyup", onKeyPassthrough, true);
          closeModal(backdrop);
          resolve(result);
        };

        const getFocusedAction = () => {
          const active = documentRef.activeElement;
          if (active === redactBtn) return "redact";
          if (active === cancelBtn) return "cancel";
          if (modal.contains(active)) return "redact";
          return null;
        };

        const onKeyDown = (event) => {
          if (event.key === "Escape") {
            consumeModalEvent(event);
            finish({ action: "cancel" });
            return;
          }

          if (event.key === "Enter" || event.key === " ") {
            consumeModalEvent(event);
            finish({ action: getFocusedAction() || "redact" });
          }
        };

        const onKeyPassthrough = (event) => {
          if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
            consumeModalEvent(event);
          }
        };

        cancelBtn.addEventListener("click", (event) => {
          consumeModalEvent(event);
          finish({ action: "cancel" });
        });
        redactBtn.addEventListener("click", (event) => {
          consumeModalEvent(event);
          finish({ action: "redact" });
        });

        backdrop.addEventListener("click", (event) => {
          if (event.target === backdrop) {
            consumeModalEvent(event);
            finish({ action: "cancel" });
          }
        });

        actions.append(cancelBtn);
        actions.appendChild(redactBtn);
        modal.append(title, desc, findingsWrap, actions);
        backdrop.appendChild(modal);
        documentRef.documentElement.appendChild(backdrop);

        windowRef.addEventListener?.("keydown", onKeyDown, true);
        windowRef.addEventListener?.("keypress", onKeyPassthrough, true);
        windowRef.addEventListener?.("keyup", onKeyPassthrough, true);
        redactBtn.focus();
      });
    }

    function showMessageModal(titleText, bodyText) {
      if (getModalOpen()) {
        return Promise.resolve();
      }

      setModalOpen(true);

      return new Promise((resolve) => {
        const backdrop = documentRef.createElement("div");
        backdrop.className = "pwm-modal-backdrop";

        const modal = documentRef.createElement("div");
        modal.className = "pwm-modal";
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");
        modal.tabIndex = -1;

        const title = documentRef.createElement("h2");
        title.textContent = titleText;

        const desc = documentRef.createElement("p");
        desc.textContent = bodyText;

        const actions = documentRef.createElement("div");
        actions.className = "pwm-actions";

        const closeBtn = documentRef.createElement("button");
        closeBtn.className = "pwm-btn pwm-btn-primary";
        closeBtn.type = "button";
        closeBtn.textContent = "Close";

        const finish = () => {
          windowRef.removeEventListener?.("keydown", onKeyDown, true);
          windowRef.removeEventListener?.("keypress", onModalPassthrough, true);
          windowRef.removeEventListener?.("keyup", onModalPassthrough, true);
          windowRef.removeEventListener?.("beforeinput", onModalPassthrough, true);
          windowRef.removeEventListener?.("input", onModalPassthrough, true);
          windowRef.removeEventListener?.("paste", onModalPassthrough, true);
          closeModal(backdrop);
          resolve();
        };

        const onKeyDown = (event) => {
          if (event.key === "Escape" || event.key === "Enter") {
            consumeModalEvent(event);
            finish();
            return;
          }

          consumeModalEvent(event);
        };

        const onModalPassthrough = (event) => {
          consumeModalEvent(event);
        };

        closeBtn.addEventListener("click", (event) => {
          consumeModalEvent(event);
          finish();
        });
        backdrop.addEventListener("click", (event) => {
          if (event.target === backdrop) {
            consumeModalEvent(event);
            finish();
          }
        });

        actions.append(closeBtn);
        modal.append(title, desc, actions);
        backdrop.appendChild(modal);
        documentRef.documentElement.appendChild(backdrop);

        windowRef.addEventListener?.("keydown", onKeyDown, true);
        windowRef.addEventListener?.("keypress", onModalPassthrough, true);
        windowRef.addEventListener?.("keyup", onModalPassthrough, true);
        windowRef.addEventListener?.("beforeinput", onModalPassthrough, true);
        windowRef.addEventListener?.("input", onModalPassthrough, true);
        windowRef.addEventListener?.("paste", onModalPassthrough, true);
        closeBtn.focus();
      });
    }

    function showGeminiLargeTextConfirmationModal(redactedLength) {
      if (getModalOpen()) {
        return Promise.resolve({ action: "cancel" });
      }

      setModalOpen(true);

      return new Promise((resolve) => {
        const backdrop = documentRef.createElement("div");
        backdrop.className = "pwm-modal-backdrop";

        const modal = documentRef.createElement("div");
        modal.className = "pwm-modal";
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");
        modal.tabIndex = -1;

        const title = documentRef.createElement("h2");
        title.textContent = "Large sanitized text fallback";

        const desc = documentRef.createElement("p");
        const sizeKb = Math.max(1, Math.round(Number(redactedLength || 0) / 1024));
        desc.textContent =
          `Gemini rejected the sanitized file upload. This sanitized text is about ${sizeKb} KiB, and inserting it into Gemini may freeze the page temporarily.`;

        const actions = documentRef.createElement("div");
        actions.className = "pwm-actions";

        const cancelBtn = documentRef.createElement("button");
        cancelBtn.className = "pwm-btn";
        cancelBtn.type = "button";
        cancelBtn.textContent = "Cancel";

        const insertBtn = documentRef.createElement("button");
        insertBtn.className = "pwm-btn pwm-btn-primary";
        insertBtn.type = "button";
        insertBtn.textContent = "Insert anyway";

        const finish = (action) => {
          windowRef.removeEventListener?.("keydown", onKeyDown, true);
          windowRef.removeEventListener?.("keypress", onModalPassthrough, true);
          windowRef.removeEventListener?.("keyup", onModalPassthrough, true);
          windowRef.removeEventListener?.("beforeinput", onModalPassthrough, true);
          windowRef.removeEventListener?.("input", onModalPassthrough, true);
          windowRef.removeEventListener?.("paste", onModalPassthrough, true);
          closeModal(backdrop);
          resolve({ action });
        };

        const onKeyDown = (event) => {
          if (event.key === "Escape") {
            consumeModalEvent(event);
            finish("cancel");
            return;
          }

          if (event.key === "Enter" || event.key === " ") {
            consumeModalEvent(event);
            finish(documentRef.activeElement === cancelBtn ? "cancel" : "insert");
            return;
          }

          consumeModalEvent(event);
        };

        const onModalPassthrough = (event) => {
          consumeModalEvent(event);
        };

        cancelBtn.addEventListener("click", (event) => {
          consumeModalEvent(event);
          finish("cancel");
        });
        insertBtn.addEventListener("click", (event) => {
          consumeModalEvent(event);
          finish("insert");
        });
        backdrop.addEventListener("click", (event) => {
          if (event.target === backdrop) {
            consumeModalEvent(event);
            finish("cancel");
          }
        });

        actions.append(cancelBtn, insertBtn);
        modal.append(title, desc, actions);
        backdrop.appendChild(modal);
        documentRef.documentElement.appendChild(backdrop);

        windowRef.addEventListener?.("keydown", onKeyDown, true);
        windowRef.addEventListener?.("keypress", onModalPassthrough, true);
        windowRef.addEventListener?.("keyup", onModalPassthrough, true);
        windowRef.addEventListener?.("beforeinput", onModalPassthrough, true);
        windowRef.addEventListener?.("input", onModalPassthrough, true);
        windowRef.addEventListener?.("paste", onModalPassthrough, true);
        insertBtn.focus();
      });
    }

    return Object.freeze({
      closeModal,
      appendFindingRow,
      showDecisionModal,
      showMessageModal,
      showGeminiLargeTextConfirmationModal
    });
  }

  root.PWM.ContentModalUi = Object.freeze({
    createContentModalUi
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.ContentModalUi;
  }
})();
