(function () {
  const {
    BUILTIN_PROTECTED_SITES,
    isBuiltinProtectedSiteRule,
    normalizeProtectedSiteInput
  } = globalThis.PWM;

  const formEl = document.getElementById("add-site-form");
  const inputEl = document.getElementById("site-input");
  const feedbackEl = document.getElementById("form-feedback");
  const userSiteListEl = document.getElementById("user-site-list");
  const builtinSiteListEl = document.getElementById("builtin-site-list");

  function setFeedback(text) {
    feedbackEl.textContent = text || "";
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

      const toggleButton = createButton(
        rule.enabled ? "Disable" : "Enable",
        async () => {
          if (!rule.enabled) {
            const granted = await chrome.permissions.request({
              origins: [rule.matchPattern]
            });

            if (!granted) {
              setFeedback("Site access was not granted.");
              return;
            }
          }

          const response = await chrome.runtime.sendMessage({
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

      const removeButton = createButton("Remove", async () => {
        const response = await chrome.runtime.sendMessage({
          type: "PWM_DELETE_PROTECTED_SITE",
          siteId: rule.id,
          url: rule.origin
        });

        if (!response?.ok) {
          throw new Error(response?.error || "LeakGuard could not remove this site.");
        }

        await refresh();
      });

      userSiteListEl.appendChild(
        createSiteCard(rule, {
          pills,
          actions: [toggleButton, removeButton]
        })
      );
    });
  }

  async function refresh() {
    const response = await chrome.runtime.sendMessage({
      type: "PWM_GET_PROTECTED_SITE_OVERVIEW"
    });

    if (!response?.ok) {
      throw new Error(response?.error || "LeakGuard could not load site settings.");
    }

    renderUserSites(response.userSites || []);
    renderBuiltinSites();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFeedback("");

    const normalized = normalizeProtectedSiteInput(inputEl.value);
    if (!normalized.ok) {
      setFeedback(normalized.error);
      return;
    }

    if (isBuiltinProtectedSiteRule(normalized.rule)) {
      setFeedback("That site is already covered by LeakGuard’s built-in protection.");
      return;
    }

    const granted = await chrome.permissions.request({
      origins: [normalized.rule.matchPattern]
    });

    if (!granted) {
      setFeedback("Site access was not granted.");
      return;
    }

    const response = await chrome.runtime.sendMessage({
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

  refresh().catch((error) => {
    renderBuiltinSites();
    setFeedback(error?.message || "LeakGuard could not load site settings.");
  });
})();
