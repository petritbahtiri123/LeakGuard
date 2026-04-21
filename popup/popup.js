(function () {
  const { normalizeProtectedSiteInput } = globalThis.PWM;

  const siteLabelEl = document.getElementById("site-label");
  const statusCopyEl = document.getElementById("status-copy");
  const feedbackEl = document.getElementById("feedback");
  const protectBtn = document.getElementById("protect-btn");
  const manageBtn = document.getElementById("manage-btn");

  let activeTab = null;
  let currentOverview = null;

  function setFeedback(text) {
    feedbackEl.textContent = text || "";
  }

  function renderOverview(overview) {
    currentOverview = overview || null;
    const site = overview?.currentSite || null;

    if (!site) {
      siteLabelEl.textContent = "No active site";
      statusCopyEl.textContent = "LeakGuard could not read the current tab.";
      protectBtn.disabled = true;
      return;
    }

    siteLabelEl.textContent = site.rule?.origin || activeTab?.url || "Unsupported tab";
    statusCopyEl.textContent = site.message || "LeakGuard protection status is unavailable.";
    protectBtn.disabled = !site.eligible || !site.canProtect;
    protectBtn.textContent =
      site.eligible && site.canProtect ? "Protect This Site" : "Protection Active";
  }

  async function loadOverview() {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });
    activeTab = tab || null;

    if (!activeTab?.url) {
      renderOverview({
        currentSite: {
          eligible: false,
          canProtect: false,
          rule: null,
          message: "LeakGuard can only protect normal web tabs."
        }
      });
      return;
    }

    const response = await chrome.runtime.sendMessage({
      type: "PWM_GET_PROTECTED_SITE_OVERVIEW",
      url: activeTab.url
    });

    if (!response?.ok) {
      throw new Error(response?.error || "LeakGuard could not read the current tab state.");
    }

    renderOverview(response);
  }

  async function protectCurrentSite() {
    const site = currentOverview?.currentSite;
    if (!site?.eligible || !site?.rule || !activeTab?.id || !activeTab?.url) {
      return;
    }

    setFeedback("");
    protectBtn.disabled = true;

    const granted = await chrome.permissions.request({
      origins: [site.rule.matchPattern]
    });

    if (!granted) {
      protectBtn.disabled = false;
      setFeedback("Site access was not granted.");
      return;
    }

    const response = await chrome.runtime.sendMessage({
      type: "PWM_ADD_PROTECTED_SITE",
      input: site.rule.origin,
      url: activeTab.url,
      tabId: activeTab.id
    });

    if (!response?.ok) {
      protectBtn.disabled = false;
      throw new Error(response?.error || "LeakGuard could not protect this site.");
    }

    renderOverview(response.overview);
    setFeedback("LeakGuard is now active on this site.");
  }

  protectBtn.addEventListener("click", () => {
    protectCurrentSite().catch((error) => {
      protectBtn.disabled = false;
      setFeedback(error?.message || "LeakGuard could not protect this site.");
    });
  });

  manageBtn.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  loadOverview().catch((error) => {
    const fallback = normalizeProtectedSiteInput(activeTab?.url || "");
    siteLabelEl.textContent = fallback.ok ? fallback.rule.origin : "Unsupported tab";
    statusCopyEl.textContent = "LeakGuard could not load the current tab state.";
    protectBtn.disabled = true;
    setFeedback(error?.message || "LeakGuard could not load the popup.");
  });
})();
