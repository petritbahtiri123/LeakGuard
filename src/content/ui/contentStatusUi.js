(function () {
  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.PWM = root.PWM || {};

  function createContentStatusUi(options = {}) {
    const documentRef = options.documentRef || (typeof document !== "undefined" ? document : null);
    const windowRef = options.windowRef || (typeof window !== "undefined" ? window : {});
    const locationRef = options.locationRef || (typeof location !== "undefined" ? location : {});
    const getActiveProtection =
      typeof options.getActiveProtection === "function" ? options.getActiveProtection : () => ({});
    const getPlaceholderCount =
      typeof options.getPlaceholderCount === "function" ? options.getPlaceholderCount : () => 0;
    const openProtectedSitesUi =
      typeof options.openProtectedSitesUi === "function" ? options.openProtectedSitesUi : async () => ({});
    const openOptionsPage =
      typeof options.openOptionsPage === "function" ? options.openOptionsPage : async () => ({});
    const setProtectionPaused =
      typeof options.setProtectionPaused === "function" ? options.setProtectionPaused : async () => {};

    let badgeEl = null;
    let lastBadgeText = "";
    let badgeHideTimer = 0;
    let statusPanelEl = null;
    let statusPanelCollapsed = false;
    let statusPanelProtectionValueEl = null;
    let statusPanelSiteValueEl = null;
    let statusPanelComposerValueEl = null;
    let statusPanelSessionValueEl = null;
    let statusPanelPauseBtn = null;

    function ensureBadge() {
      if (badgeEl) return badgeEl;
      if (typeof documentRef?.createElement !== "function" || !documentRef.documentElement?.appendChild) return null;

      badgeEl = documentRef.createElement("div");
      badgeEl.className = "pwm-badge";
      badgeEl.setAttribute("aria-live", "polite");
      documentRef.documentElement.appendChild(badgeEl);

      return badgeEl;
    }

    function setBadge(text) {
      const el = ensureBadge();
      if (!el) return null;

      if (!text) {
        el.textContent = "";
        el.classList.remove("is-visible");
        lastBadgeText = "";
        return el;
      }

      if (text !== lastBadgeText) {
        el.textContent = text;
        lastBadgeText = text;
      }

      el.classList.add("is-visible");
      return el;
    }

    function hideBadgeSoon(delay = 1800) {
      windowRef.clearTimeout?.(badgeHideTimer);
      badgeHideTimer = windowRef.setTimeout?.(() => {
        if (badgeEl) {
          badgeEl.classList.remove("is-visible");
        }
      }, delay) || 0;
      return badgeHideTimer;
    }

    function setStatusPanelCollapsed(collapsed) {
      const panel = ensureStatusPanel();
      if (!panel) return null;
      const toggle = panel.querySelector(".pwm-panel-toggle");
      const body = panel.querySelector(".pwm-panel-body");

      statusPanelCollapsed = Boolean(collapsed);
      panel.classList.toggle("is-collapsed", statusPanelCollapsed);
      if (body) body.hidden = statusPanelCollapsed;
      toggle?.setAttribute("aria-expanded", String(!statusPanelCollapsed));
      if (toggle) toggle.textContent = statusPanelCollapsed ? "Expand" : "Collapse";
      return panel;
    }

    function ensureStatusPanel() {
      if (statusPanelEl?.isConnected) {
        return statusPanelEl;
      }
      if (typeof documentRef?.createElement !== "function" || !documentRef.documentElement?.appendChild) return null;

      statusPanelEl = documentRef.createElement("aside");
      statusPanelEl.className = "pwm-panel";
      statusPanelEl.setAttribute("aria-live", "polite");

      const header = documentRef.createElement("div");
      header.className = "pwm-panel-header";

      const brandWrap = documentRef.createElement("div");
      brandWrap.className = "pwm-panel-brand";

      const eyebrow = documentRef.createElement("p");
      eyebrow.className = "pwm-panel-eyebrow";
      eyebrow.textContent = "Local-only protection";

      const title = documentRef.createElement("h2");
      title.className = "pwm-panel-title";
      title.textContent = "LeakGuard";

      const toggle = documentRef.createElement("button");
      toggle.className = "pwm-panel-toggle";
      toggle.type = "button";
      toggle.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        setStatusPanelCollapsed(!statusPanelCollapsed);
      });

      brandWrap.append(eyebrow, title);
      header.append(brandWrap, toggle);

      const body = documentRef.createElement("div");
      body.className = "pwm-panel-body";

      const makeRow = (labelText) => {
        const row = documentRef.createElement("div");
        row.className = "pwm-panel-row";

        const label = documentRef.createElement("span");
        label.className = "pwm-panel-label";
        label.textContent = labelText;

        const value = documentRef.createElement("strong");
        value.className = "pwm-panel-value";

        row.append(label, value);
        body.appendChild(row);
        return value;
      };

      statusPanelProtectionValueEl = makeRow("Protection");
      statusPanelSiteValueEl = makeRow("Site");
      statusPanelComposerValueEl = makeRow("Composer");
      statusPanelSessionValueEl = makeRow("Session");

      const actions = documentRef.createElement("div");
      actions.className = "pwm-panel-actions";

      const manageBtn = documentRef.createElement("button");
      manageBtn.className = "pwm-btn pwm-panel-manage";
      manageBtn.type = "button";
      manageBtn.textContent = "Manage Sites";
      manageBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        openProtectedSitesUi()
          .then((response) => {
            if (!response?.opened) {
              setBadge("Open LeakGuard from the toolbar to manage sites");
              hideBadgeSoon(2800);
            }
          })
          .catch(() => {
            openOptionsPage().catch(() => {
              setBadge("LeakGuard settings unavailable");
              hideBadgeSoon(2200);
            });
          });
      });

      statusPanelPauseBtn = documentRef.createElement("button");
      statusPanelPauseBtn.className = "pwm-btn pwm-panel-pause";
      statusPanelPauseBtn.type = "button";
      statusPanelPauseBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        const protection = getActiveProtection();
        setProtectionPaused(!protection.paused).catch((error) => {
          setBadge(error?.message || "Protection pause unavailable");
          hideBadgeSoon(2800);
        });
      });

      actions.append(statusPanelPauseBtn, manageBtn);
      body.appendChild(actions);

      statusPanelEl.append(header, body);
      documentRef.documentElement.appendChild(statusPanelEl);
      setStatusPanelCollapsed(statusPanelCollapsed);

      return statusPanelEl;
    }

    function updateStatusPanel(snapshot = {}) {
      const panel = ensureStatusPanel();
      if (!panel) return null;

      const protection = getActiveProtection();
      if (protection.protectionEnforced) {
        statusPanelProtectionValueEl.textContent = "Enforced by policy";
      } else if (protection.paused) {
        statusPanelProtectionValueEl.textContent = "Paused";
      } else {
        statusPanelProtectionValueEl.textContent = "Active";
      }

      if (statusPanelPauseBtn) {
        statusPanelPauseBtn.hidden = !protection.allowProtectionPause;
        statusPanelPauseBtn.textContent = protection.paused ? "Resume Protection" : "Pause Protection";
      }

      statusPanelSiteValueEl.textContent = locationRef.host || "Protected site";

      if (!snapshot.hasComposer) {
        statusPanelComposerValueEl.textContent = "Waiting for composer";
      } else if (snapshot.detectedCount > 0) {
        statusPanelComposerValueEl.textContent = `${snapshot.detectedCount} sensitive item${
          snapshot.detectedCount === 1 ? "" : "s"
        } detected`;
      } else if (snapshot.placeholderNormalized) {
        statusPanelComposerValueEl.textContent = "Canonical placeholders ready";
      } else {
        statusPanelComposerValueEl.textContent = "No sensitive items detected";
      }

      const placeholderCount = Number(getPlaceholderCount() || 0);
      statusPanelSessionValueEl.textContent = `${placeholderCount} placeholder${
        placeholderCount === 1 ? "" : "s"
      } active`;
      return panel;
    }

    return Object.freeze({
      ensureBadge,
      setBadge,
      hideBadgeSoon,
      ensureStatusPanel,
      setStatusPanelCollapsed,
      updateStatusPanel
    });
  }

  root.PWM.ContentStatusUi = Object.freeze({
    createContentStatusUi
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.PWM.ContentStatusUi;
  }
})();
