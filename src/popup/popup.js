(function () {
  const ext = globalThis.PWM?.ext || globalThis.browser || globalThis.chrome;
  const {
    BUILTIN_PROTECTED_SITES,
    isBuiltinProtectedSiteRule,
    normalizeProtectedSiteInput
  } = globalThis.PWM;

  const homeViewEl = document.getElementById("home-view");
  const sitesViewEl = document.getElementById("sites-view");
  const revealViewEl = document.getElementById("reveal-view");

  const siteLabelEl = document.getElementById("site-label");
  const statusCopyEl = document.getElementById("status-copy");
  const policyWarningEl = document.getElementById("policy-warning");
  const feedbackEl = document.getElementById("feedback");
  const protectBtn = document.getElementById("protect-btn");
  const manageBtn = document.getElementById("manage-btn");
  const fileScannerBtn = document.getElementById("file-scanner-btn");

  const sitesBackBtn = document.getElementById("sites-back-btn");
  const formEl = document.getElementById("add-site-form");
  const inputEl = document.getElementById("site-input");
  const formFeedbackEl = document.getElementById("form-feedback");
  const managedSiteListEl = document.getElementById("managed-site-list");
  const userSiteListEl = document.getElementById("user-site-list");
  const builtinSiteListEl = document.getElementById("builtin-site-list");

  const revealBackBtn = document.getElementById("reveal-back-btn");
  const revealStatusEl = document.getElementById("reveal-status");
  const revealPlaceholderEl = document.getElementById("reveal-placeholder");
  const hiddenCopyEl = document.getElementById("hidden-copy");
  const secretValueEl = document.getElementById("secret-value");
  const showBtn = document.getElementById("show-btn");
  const hideBtn = document.getElementById("hide-btn");

  let activeTab = null;
  let currentOverview = null;
  let currentView = "home";
  let activeRevealRequestId = null;
  let currentPolicy = {
    allowReveal: true,
    allowUserAddedSites: true,
    allowSiteRemoval: true,
    enterpriseMode: false,
    managedAvailable: false,
    managedApplied: false,
    strictFailure: false
  };

  function setFeedback(text) {
    feedbackEl.textContent = text || "";
  }

  function setPolicyWarning(text) {
    policyWarningEl.hidden = !text;
    policyWarningEl.textContent = text || "";
  }

  function setFormFeedback(text) {
    formFeedbackEl.textContent = text || "";
  }

  function setRevealStatus(text) {
    revealStatusEl.textContent = text || "";
  }

  function renderPolicyWarning() {
    const warnings = [];
    const tabIncognito = Boolean(activeTab?.incognito || ext.extension?.inIncognitoContext);

    if (currentPolicy.enterpriseMode && !currentPolicy.managedApplied) {
      warnings.push(
        "Managed enterprise policy is not active. Browser policy is still required to force install LeakGuard, control removal, and keep protection aligned with enterprise settings."
      );
    }

    if (currentPolicy.strictFailure) {
      warnings.push(
        "LeakGuard is currently failing closed for sensitive actions because strict enterprise policy could not be loaded safely."
      );
    }

    if (tabIncognito && (!currentPolicy.enterpriseMode || !currentPolicy.managedApplied)) {
      warnings.push(
        "Incognito detected. LeakGuard cannot force incognito coverage from extension code alone. Use browser policy to disable incognito or explicitly allow the extension there."
      );
    }

    setPolicyWarning(warnings.join(" "));
  }

  function updatePolicy(policy) {
    currentPolicy = {
      ...currentPolicy,
      ...(policy || {})
    };

    inputEl.disabled = !currentPolicy.allowUserAddedSites;
    formEl.querySelector('button[type="submit"]').disabled = !currentPolicy.allowUserAddedSites;
    renderPolicyWarning();
  }

  function setView(view) {
    currentView = view;
    homeViewEl.hidden = view !== "home";
    sitesViewEl.hidden = view !== "sites";
    revealViewEl.hidden = view !== "reveal";
  }

  function createPill(text) {
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = text;
    return pill;
  }

  function createButton(text, onClick, primary = false) {
    const button = document.createElement("button");
    button.className = primary ? "btn btn-primary" : "btn";
    button.type = "button";
    button.textContent = text;
    button.addEventListener("click", () => {
      onClick().catch((error) => {
        setFormFeedback(error?.message || "LeakGuard could not update this site.");
      });
    });
    return button;
  }

  function createSiteCard(rule, options = {}) {
    const card = document.createElement("article");
    card.className = "site-card";

    const head = document.createElement("div");
    head.className = "site-card-head";

    const origin = document.createElement("p");
    origin.className = "site-origin";
    origin.textContent = rule.origin;

    const meta = document.createElement("div");
    meta.className = "site-meta";
    (options.pills || []).forEach((text) => meta.appendChild(createPill(text)));

    head.append(origin, meta);
    card.appendChild(head);

    if (options.actions?.length) {
      const actions = document.createElement("div");
      actions.className = "site-actions";
      options.actions.forEach((action) => actions.appendChild(action));
      card.appendChild(actions);
    }

    return card;
  }

  function renderOverview(overview) {
    currentOverview = overview || null;
    updatePolicy(overview?.policy);
    const site = overview?.currentSite || null;

    if (!site) {
      siteLabelEl.textContent = "No active site";
      statusCopyEl.textContent = "LeakGuard could not read the current tab.";
      protectBtn.disabled = true;
      protectBtn.textContent = "Protect This Site";
      return;
    }

    siteLabelEl.textContent = site.rule?.origin || activeTab?.url || "Unsupported tab";
    statusCopyEl.textContent = site.message || "LeakGuard protection status is unavailable.";
    protectBtn.disabled = !site.eligible || !site.canProtect;
    protectBtn.textContent = site.eligible && site.canProtect
      ? "Protect This Site"
      : site.protected
        ? "Protection Active"
        : currentPolicy.allowUserAddedSites
          ? "Protection Unavailable"
          : "Managed by Policy";
  }

  async function resolveActiveTab() {
    const [tab] = await ext.tabs.query({
      active: true,
      currentWindow: true
    });
    activeTab = tab || null;
    renderPolicyWarning();
    return activeTab;
  }

  async function loadOverview() {
    await resolveActiveTab();

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

    const response = await ext.runtime.sendMessage({
      type: "PWM_GET_PROTECTED_SITE_OVERVIEW",
      url: activeTab.url
    });

    if (!response?.ok) {
      throw new Error(response?.error || "LeakGuard could not read the current tab state.");
    }

    renderOverview(response);
  }

  async function refreshSiteData() {
    const response = await ext.runtime.sendMessage({
      type: "PWM_GET_PROTECTED_SITE_OVERVIEW"
    });

    if (!response?.ok) {
      throw new Error(response?.error || "LeakGuard could not load site settings.");
    }

    updatePolicy(response.policy);
    renderManagedSites(response.managedSites || []);
    renderUserSites(response.userSites || []);
    renderBuiltinSites(response.builtInSites || BUILTIN_PROTECTED_SITES);
  }

  async function refreshAllState() {
    await Promise.all([
      refreshSiteData(),
      loadOverview().catch(() => {})
    ]);
  }

  async function openSitesView() {
    setFeedback("");
    setFormFeedback("");
    await refreshSiteData();
    setView("sites");
  }

  async function openFileScanner() {
    await ext.tabs.create({
      url: ext.runtime.getURL("scanner/scanner.html")
    });
  }

  function activeTabContext() {
    return {
      tabId: activeTab?.id,
      tabUrl: activeTab?.url
    };
  }

  async function protectCurrentSite() {
    const site = currentOverview?.currentSite;
    if (!site?.eligible || !site?.rule || !activeTab?.id || !activeTab?.url) {
      return;
    }

    if (!currentPolicy.allowUserAddedSites) {
      setFeedback("Managed policy disables user-added sites.");
      protectBtn.disabled = true;
      return;
    }

    setFeedback("");
    protectBtn.disabled = true;

    const granted = await ext.permissions.request({
      origins: [site.rule.matchPattern]
    });

    if (!granted) {
      protectBtn.disabled = false;
      setFeedback("Site access was not granted.");
      return;
    }

    const response = await ext.runtime.sendMessage({
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

  function renderBuiltinSites(builtinSites) {
    builtinSiteListEl.textContent = "";

    (builtinSites || BUILTIN_PROTECTED_SITES).forEach((rule) => {
      builtinSiteListEl.appendChild(
        createSiteCard(rule, {
          pills: ["Built in", "Always enabled"]
        })
      );
    });
  }

  function renderManagedSites(managedSites) {
    managedSiteListEl.textContent = "";

    if (!managedSites.length) {
      const empty = document.createElement("p");
      empty.textContent = "No policy-managed sites are active.";
      managedSiteListEl.appendChild(empty);
      return;
    }

    managedSites.forEach((rule) => {
      const pills = [];
      pills.push(rule.active ? "Active" : rule.hasPermission ? "Ready" : "Access missing");
      pills.push("Managed");
      pills.push(rule.protocol === "http:" ? "HTTP" : "HTTPS");

      managedSiteListEl.appendChild(
        createSiteCard(rule, {
          pills
        })
      );
    });
  }

  function renderUserSites(userSites) {
    userSiteListEl.textContent = "";

    if (!userSites.length) {
      const empty = document.createElement("p");
      empty.textContent = "No extra sites protected yet.";
      userSiteListEl.appendChild(empty);
      return;
    }

    userSites.forEach((rule) => {
      const pills = [];
      pills.push(rule.active ? "Active" : rule.enabled ? "Access missing" : "Disabled");
      pills.push(rule.protocol === "http:" ? "HTTP" : "HTTPS");
      if (!currentPolicy.allowSiteRemoval) {
        pills.push("Removal locked");
      }

      const toggleButton = createButton(
        rule.enabled ? "Disable" : "Enable",
        async () => {
          if (!currentPolicy.allowUserAddedSites) {
            setFormFeedback("Managed policy disables user-added sites.");
            return;
          }

          if (!rule.enabled) {
            const granted = await ext.permissions.request({
              origins: [rule.matchPattern]
            });

            if (!granted) {
              setFormFeedback("Site access was not granted.");
              return;
            }
          }

          const response = await ext.runtime.sendMessage({
            type: "PWM_SET_PROTECTED_SITE_ENABLED",
            siteId: rule.id,
            enabled: !rule.enabled,
            url: rule.origin,
            ...activeTabContext()
          });

          if (!response?.ok) {
            throw new Error(response?.error || "LeakGuard could not update this site.");
          }

          setFormFeedback("");
          await refreshAllState();
        },
        !rule.enabled
      );
      toggleButton.disabled = !currentPolicy.allowUserAddedSites;

      const removeButton = createButton("Remove", async () => {
        const response = await ext.runtime.sendMessage({
          type: "PWM_DELETE_PROTECTED_SITE",
          siteId: rule.id,
          url: rule.origin,
          ...activeTabContext()
        });

        if (!response?.ok) {
          throw new Error(response?.error || "LeakGuard could not remove this site.");
        }

        setFormFeedback("");
        await refreshAllState();
      });
      removeButton.disabled = !currentPolicy.allowSiteRemoval;
      if (!currentPolicy.allowSiteRemoval) {
        removeButton.title = "Managed policy blocks removing protected sites.";
      }

      userSiteListEl.appendChild(
        createSiteCard(rule, {
          pills,
          actions: [toggleButton, removeButton]
        })
      );
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormFeedback("");

    if (!currentPolicy.allowUserAddedSites) {
      setFormFeedback("Managed policy disables user-added sites.");
      return;
    }

    const normalized = normalizeProtectedSiteInput(inputEl.value);
    if (!normalized.ok) {
      setFormFeedback(normalized.error);
      return;
    }

    if (isBuiltinProtectedSiteRule(normalized.rule)) {
      setFormFeedback("That site is already covered by LeakGuard's built-in protection.");
      return;
    }

    const granted = await ext.permissions.request({
      origins: [normalized.rule.matchPattern]
    });

    if (!granted) {
      setFormFeedback("Site access was not granted.");
      return;
    }

    const response = await ext.runtime.sendMessage({
      type: "PWM_ADD_PROTECTED_SITE",
      input: normalized.rule.origin,
      url: normalized.rule.origin,
      ...activeTabContext()
    });

    if (!response?.ok) {
      throw new Error(response?.error || "LeakGuard could not save this site.");
    }

    inputEl.value = "";
    setFormFeedback("LeakGuard will now protect that site.");
    await refreshAllState();
  }

  function hideSecret() {
    secretValueEl.hidden = true;
    secretValueEl.textContent = "";
    hiddenCopyEl.hidden = false;
    showBtn.disabled = false;
    hideBtn.disabled = true;
  }

  function renderRevealContext(context, requestId) {
    activeRevealRequestId = requestId || null;
    hideSecret();
    updatePolicy(context?.policy);
    revealPlaceholderEl.textContent = context?.placeholder || "[PWM]";

    if (!activeRevealRequestId) {
      showBtn.disabled = true;
      setRevealStatus(context?.message || "LeakGuard secure reveal is unavailable for this item.");
      return;
    }

    if (!currentPolicy.allowReveal || !context?.available) {
      showBtn.disabled = true;
      setRevealStatus(context?.message || "This placeholder is not available in the current tab session.");
      return;
    }

    setRevealStatus("Hidden until you choose Show.");
  }

  async function clearPopupState(requestId) {
    try {
      await ext.runtime.sendMessage({
        type: "PWM_CLEAR_POPUP_STATE",
        requestId
      });
    } catch {
      // Ignore popup state cleanup failures during teardown.
    }
  }

  async function releaseRevealRequest() {
    if (!activeRevealRequestId) return;

    const requestId = activeRevealRequestId;
    activeRevealRequestId = null;

    try {
      await ext.runtime.sendMessage({
        type: "PWM_EXTENSION_RELEASE_REVEAL_REQUEST",
        requestId
      });
    } catch {
      // Ignore cleanup failures during popup teardown.
    }
  }

  async function closeRevealView() {
    const requestId = activeRevealRequestId;
    await releaseRevealRequest();
    await clearPopupState(requestId);
    hideSecret();
    setView("home");
    await loadOverview().catch(() => {});
  }

  async function showSecret() {
    if (!currentPolicy.allowReveal) {
      showBtn.disabled = true;
      setRevealStatus("Secure reveal is disabled by policy.");
      return;
    }

    if (!activeRevealRequestId) {
      showBtn.disabled = true;
      return;
    }

    showBtn.disabled = true;
    setRevealStatus("Revealing inside LeakGuard...");

    const response = await ext.runtime.sendMessage({
      type: "PWM_EXTENSION_REVEAL_SECRET",
      requestId: activeRevealRequestId
    });

    if (!response?.ok || typeof response?.raw !== "string") {
      hideSecret();
      showBtn.disabled = true;
      setRevealStatus(response?.error || "LeakGuard secure reveal is unavailable for this item.");
      return;
    }

    hiddenCopyEl.hidden = true;
    secretValueEl.hidden = false;
    secretValueEl.textContent = response.raw;
    hideBtn.disabled = false;
    setRevealStatus("Visible only inside this LeakGuard popup.");
  }

  async function loadPopupState() {
    const response = await ext.runtime.sendMessage({
      type: "PWM_GET_POPUP_STATE"
    });

    if (!response?.ok) {
      throw new Error(response?.error || "LeakGuard could not load popup state.");
    }

    return response;
  }

  async function initialize() {
    try {
      await loadOverview();
    } catch (error) {
      const fallback = normalizeProtectedSiteInput(activeTab?.url || "");
      siteLabelEl.textContent = fallback.ok ? fallback.rule.origin : "Unsupported tab";
      statusCopyEl.textContent = "LeakGuard could not load the current tab state.";
      protectBtn.disabled = true;
      setFeedback(error?.message || "LeakGuard could not load the popup.");
    }

    try {
      const bootstrap = await loadPopupState();

      if (bootstrap?.popupState?.view === "reveal") {
        setView("reveal");
        renderRevealContext(bootstrap.revealContext, bootstrap.popupState.requestId);
        return;
      }

      if (bootstrap?.popupState?.view === "sites") {
        try {
          await openSitesView();
        } catch (error) {
          setView("sites");
          renderBuiltinSites(BUILTIN_PROTECTED_SITES);
          setFormFeedback(error?.message || "LeakGuard could not load site settings.");
        }
        return;
      }
    } catch (error) {
      setFeedback(error?.message || "LeakGuard could not load popup state.");
    }

    setView("home");
  }

  protectBtn.addEventListener("click", () => {
    protectCurrentSite().catch((error) => {
      protectBtn.disabled = false;
      setFeedback(error?.message || "LeakGuard could not protect this site.");
    });
  });

  manageBtn.addEventListener("click", () => {
    openSitesView().catch((error) => {
      setView("sites");
      renderBuiltinSites(BUILTIN_PROTECTED_SITES);
      setFormFeedback(error?.message || "LeakGuard could not load site settings.");
    });
  });

  fileScannerBtn.addEventListener("click", () => {
    openFileScanner().catch((error) => {
      setFeedback(error?.message || "LeakGuard could not open the file scanner.");
    });
  });

  sitesBackBtn.addEventListener("click", () => {
    clearPopupState().catch(() => {});
    setView("home");
    loadOverview().catch(() => {});
  });

  formEl.addEventListener("submit", (event) => {
    handleSubmit(event).catch((error) => {
      setFormFeedback(error?.message || "LeakGuard could not save this site.");
    });
  });

  revealBackBtn.addEventListener("click", () => {
    closeRevealView().catch(() => {
      setView("home");
    });
  });

  showBtn.addEventListener("click", () => {
    showSecret().catch((error) => {
      hideSecret();
      showBtn.disabled = true;
      setRevealStatus(error?.message || "LeakGuard secure reveal failed.");
    });
  });

  hideBtn.addEventListener("click", () => {
    hideSecret();
    setRevealStatus("Hidden until you choose Show.");
  });

  window.addEventListener("pagehide", () => {
    const requestId = activeRevealRequestId;
    releaseRevealRequest().catch(() => {});
    clearPopupState(requestId).catch(() => {});
  });

  initialize().catch((error) => {
    setView(currentView || "home");
    setFeedback(error?.message || "LeakGuard could not initialize the popup.");
  });
})();
