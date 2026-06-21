(function () {
  const ext = globalThis.PWM?.ext || globalThis.browser || globalThis.chrome;
  const {
    BUILTIN_PROTECTED_SITES,
    isBuiltinProtectedSiteRule,
    normalizeProtectedSiteInput
  } = globalThis.PWM;

  const formEl = document.getElementById("add-site-form");
  const inputEl = document.getElementById("site-input");
  const feedbackEl = document.getElementById("form-feedback");
  const protectedSiteOcrToggleEl = document.getElementById("protected-site-ocr-toggle");
  const protectedSiteOcrFeedbackEl = document.getElementById("protected-site-ocr-feedback");
  const feedbackSectionEl = document.getElementById("feedback-section");
  const feedbackEntryButtonEl = document.getElementById("feedback-entry");
  const feedbackReviewEl = document.getElementById("feedback-review");
  const feedbackDescriptionEl = document.getElementById("feedback-description");
  const feedbackReportPreviewEl = document.getElementById("feedback-report-preview");
  const copyFeedbackReportButtonEl = document.getElementById("copy-feedback-report");
  const openFeedbackLinkButtonEl = document.getElementById("open-feedback-link");
  const feedbackActionStatusEl = document.getElementById("feedback-action-status");
  const managedSiteListEl = document.getElementById("managed-site-list");
  const userSiteListEl = document.getElementById("user-site-list");
  const builtinSiteListEl = document.getElementById("builtin-site-list");
  const FeedbackReport = globalThis.PWM?.FeedbackReport;
  let currentPolicy = {
    allowUserAddedSites: true,
    allowSiteRemoval: true,
    allowFeedback: false
  };
  let currentFeedbackReport = "";

  function setFeedback(text) {
    feedbackEl.textContent = text || "";
  }

  function setProtectedSiteOcrFeedback(text) {
    protectedSiteOcrFeedbackEl.textContent = text || "";
  }

  function setFeedbackActionStatus(text) {
    feedbackActionStatusEl.textContent = text || "";
  }

  function isFeedbackAvailable(policy) {
    return policy?.allowFeedback === true && policy?.strictFailure !== true;
  }

  function updatePolicy(policy) {
    currentPolicy = {
      ...currentPolicy,
      ...(policy || {}),
      allowFeedback: isFeedbackAvailable(policy)
    };

    inputEl.disabled = !currentPolicy.allowUserAddedSites;
    formEl.querySelector('button[type="submit"]').disabled = !currentPolicy.allowUserAddedSites;
    feedbackSectionEl.hidden = !currentPolicy.allowFeedback;
    feedbackEntryButtonEl.disabled = !currentPolicy.allowFeedback;
    if (!currentPolicy.allowFeedback) {
      resetFeedbackReport();
    }
  }

  function createPill(text) {
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = text;
    return pill;
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

  function createButton(text, onClick, primary = false) {
    const button = document.createElement("button");
    button.className = primary ? "btn btn-primary" : "btn";
    button.type = "button";
    button.textContent = text;
    button.addEventListener("click", () => {
      onClick().catch((error) => {
        setFeedback(error?.message || "LeakGuard could not update this site.");
      });
    });
    return button;
  }

  function renderBuiltinSites() {
    builtinSiteListEl.textContent = "";

    BUILTIN_PROTECTED_SITES.forEach((rule) => {
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
            setFeedback("Managed policy disables user-added sites.");
            return;
          }

          if (!rule.enabled) {
            const granted = await ext.permissions.request({
              origins: [rule.matchPattern]
            });

            if (!granted) {
              setFeedback("Site access was not granted.");
              return;
            }
          }

          const response = await ext.runtime.sendMessage({
            type: "PWM_SET_PROTECTED_SITE_ENABLED",
            siteId: rule.id,
            enabled: !rule.enabled,
            url: rule.origin
          });

          if (!response?.ok) {
            throw new Error(response?.error || "LeakGuard could not update this site.");
          }

          await refresh();
        },
        !rule.enabled
      );
      toggleButton.disabled = !currentPolicy.allowUserAddedSites;

      const removeButton = createButton("Remove", async () => {
        const response = await ext.runtime.sendMessage({
          type: "PWM_DELETE_PROTECTED_SITE",
          siteId: rule.id,
          url: rule.origin
        });

        if (!response?.ok) {
          throw new Error(response?.error || "LeakGuard could not remove this site.");
        }

        await refresh();
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

  async function refresh() {
    const response = await ext.runtime.sendMessage({
      type: "PWM_GET_PROTECTED_SITE_OVERVIEW"
    });

    if (!response?.ok) {
      throw new Error(response?.error || "LeakGuard could not load site settings.");
    }

    updatePolicy(response.policy);
    await refreshProtectedSiteOcrSetting();
    renderManagedSites(response.managedSites || []);
    renderUserSites(response.userSites || []);
    renderBuiltinSites();
  }

  async function refreshProtectedSiteOcrSetting() {
    const response = await ext.runtime.sendMessage({
      type: "PWM_GET_PROTECTED_SITE_OCR_SETTING"
    });

    if (!response?.ok) {
      throw new Error(response?.error || "LeakGuard could not load protected-site OCR settings.");
    }

    protectedSiteOcrToggleEl.checked = response.enabled === true;
  }

  async function updateProtectedSiteOcrSetting(enabled) {
    protectedSiteOcrToggleEl.disabled = true;
    setProtectedSiteOcrFeedback("");
    try {
      const response = await ext.runtime.sendMessage({
        type: "PWM_SET_PROTECTED_SITE_OCR_SETTING",
        enabled: enabled === true
      });

      if (!response?.ok) {
        throw new Error(response?.error || "LeakGuard could not save protected-site OCR settings.");
      }

      protectedSiteOcrToggleEl.checked = response.enabled === true;
      setProtectedSiteOcrFeedback(response.enabled ? "Protected-site image OCR is on." : "Protected-site image OCR is off.");
    } finally {
      protectedSiteOcrToggleEl.disabled = false;
    }
  }

  function getBrowserNameAndVersion() {
    const userAgent = String(navigator.userAgent || "");
    const firefox = /Firefox\/([0-9.]+)/.exec(userAgent);
    const edge = /Edg\/([0-9.]+)/.exec(userAgent);
    const chrome = /Chrome\/([0-9.]+)/.exec(userAgent);

    if (firefox) return { name: "Firefox", version: firefox[1] };
    if (edge) return { name: "Edge", version: edge[1] };
    if (chrome) return { name: "Chrome", version: chrome[1] };
    return { name: "Browser", version: "unspecified" };
  }

  function buildOptionsFeedbackReportInput() {
    const browser = getBrowserNameAndVersion();
    const manifest = ext.runtime.getManifest ? ext.runtime.getManifest() : {};
    const buildInfo = globalThis.PWM_BUILD_INFO || {};

    return {
      leakGuardVersion: manifest.version || "unspecified",
      browserName: browser.name,
      browserVersion: browser.version,
      extensionBuild: buildInfo.mode || "consumer",
      extensionChannel: buildInfo.channel || "local",
      providerCategory: "options-page",
      featureArea: "feedback",
      safeReasonCodes: ["manual_feedback"],
      fileCount: 0,
      blockedCount: 0,
      adapterName: "none",
      description: feedbackDescriptionEl.value
    };
  }

  function isFeedbackGithubTargetConfigured() {
    return FeedbackReport.DEFAULT_FEEDBACK_GITHUB_REPOSITORY !== "TODO-OWNER/TODO-REPO";
  }

  function updateFeedbackReportPreview() {
    if (!currentPolicy.allowFeedback || !FeedbackReport) {
      currentFeedbackReport = "";
      feedbackReportPreviewEl.value = "";
      copyFeedbackReportButtonEl.disabled = true;
      openFeedbackLinkButtonEl.disabled = true;
      return;
    }

    const report = FeedbackReport.buildFeedbackReport(buildOptionsFeedbackReportInput());
    currentFeedbackReport = FeedbackReport.formatFeedbackReport(report);
    feedbackReportPreviewEl.value = currentFeedbackReport;
    copyFeedbackReportButtonEl.disabled = currentFeedbackReport.length === 0;
    openFeedbackLinkButtonEl.disabled = !isFeedbackGithubTargetConfigured();
    openFeedbackLinkButtonEl.title = isFeedbackGithubTargetConfigured()
      ? ""
      : "GitHub feedback target is not configured yet.";
  }

  function resetFeedbackReport() {
    currentFeedbackReport = "";
    feedbackReviewEl.hidden = true;
    feedbackDescriptionEl.value = "";
    feedbackReportPreviewEl.value = "";
    copyFeedbackReportButtonEl.disabled = true;
    openFeedbackLinkButtonEl.disabled = true;
    setFeedbackActionStatus("");
  }

  function showFeedbackReview() {
    if (!currentPolicy.allowFeedback) return;
    feedbackReviewEl.hidden = false;
    setFeedbackActionStatus("");
    updateFeedbackReportPreview();
  }

  async function handleCopyFeedbackReport() {
    updateFeedbackReportPreview();
    if (!currentFeedbackReport) return;

    await navigator.clipboard.writeText(currentFeedbackReport);
    setFeedbackActionStatus("Safe feedback report copied.");
  }

  function handleOpenFeedbackLink() {
    updateFeedbackReportPreview();
    if (!isFeedbackGithubTargetConfigured()) {
      setFeedbackActionStatus("GitHub feedback target is not configured yet. Copy the safe report instead.");
      return;
    }

    const url = FeedbackReport.buildGitHubFeedbackIssueUrl(buildOptionsFeedbackReportInput(), {
      title: "LeakGuard feedback"
    });
    if (!url) {
      setFeedbackActionStatus("LeakGuard could not build a safe feedback link.");
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFeedback("");

    if (!currentPolicy.allowUserAddedSites) {
      setFeedback("Managed policy disables user-added sites.");
      return;
    }

    const normalized = normalizeProtectedSiteInput(inputEl.value);
    if (!normalized.ok) {
      setFeedback(normalized.error);
      return;
    }

    if (isBuiltinProtectedSiteRule(normalized.rule)) {
      setFeedback("That site is already covered by LeakGuard’s built-in protection.");
      return;
    }

    const granted = await ext.permissions.request({
      origins: [normalized.rule.matchPattern]
    });

    if (!granted) {
      setFeedback("Site access was not granted.");
      return;
    }

    const response = await ext.runtime.sendMessage({
      type: "PWM_ADD_PROTECTED_SITE",
      input: normalized.rule.origin,
      url: normalized.rule.origin
    });

    if (!response?.ok) {
      throw new Error(response?.error || "LeakGuard could not save this site.");
    }

    inputEl.value = "";
    setFeedback("LeakGuard will now protect that site.");
    await refresh();
  }

  formEl.addEventListener("submit", (event) => {
    handleSubmit(event).catch((error) => {
      setFeedback(error?.message || "LeakGuard could not save this site.");
    });
  });

  protectedSiteOcrToggleEl.addEventListener("change", (event) => {
    updateProtectedSiteOcrSetting(event.target.checked).catch((error) => {
      protectedSiteOcrToggleEl.checked = !event.target.checked;
      setProtectedSiteOcrFeedback(error?.message || "LeakGuard could not save protected-site OCR settings.");
    });
  });

  feedbackEntryButtonEl.addEventListener("click", () => {
    showFeedbackReview();
  });

  feedbackDescriptionEl.addEventListener("input", () => {
    updateFeedbackReportPreview();
  });

  copyFeedbackReportButtonEl.addEventListener("click", () => {
    handleCopyFeedbackReport().catch((error) => {
      setFeedbackActionStatus(error?.message || "LeakGuard could not copy the feedback report.");
    });
  });

  openFeedbackLinkButtonEl.addEventListener("click", () => {
    handleOpenFeedbackLink();
  });

  refresh().catch((error) => {
    renderBuiltinSites();
    setFeedback(error?.message || "LeakGuard could not load site settings.");
  });
})();
