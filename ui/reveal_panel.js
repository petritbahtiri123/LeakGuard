(function () {
  const statusEl = document.getElementById("status");
  const placeholderEl = document.getElementById("placeholder");
  const hiddenCopyEl = document.getElementById("hidden-copy");
  const secretValueEl = document.getElementById("secret-value");
  const showBtn = document.getElementById("show-btn");
  const hideBtn = document.getElementById("hide-btn");

  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  const requestId = params.get("request");

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function hideSecret() {
    secretValueEl.hidden = true;
    secretValueEl.textContent = "";
    hiddenCopyEl.hidden = false;
    showBtn.disabled = false;
    hideBtn.disabled = true;
  }

  async function releaseRequest() {
    if (!requestId) return;

    try {
      await chrome.runtime.sendMessage({
        type: "PWM_EXTENSION_RELEASE_REVEAL_REQUEST",
        requestId
      });
    } catch {
      // Ignore teardown failures.
    }
  }

  async function loadContext() {
    hideSecret();

    if (!requestId) {
      placeholderEl.textContent = "[PWM]";
      setStatus("Secure reveal is unavailable because the request id is missing.");
      showBtn.disabled = true;
      return;
    }

    const response = await chrome.runtime.sendMessage({
      type: "PWM_EXTENSION_GET_REVEAL_CONTEXT",
      requestId
    });

    if (!response?.ok || !response?.context) {
      placeholderEl.textContent = "[PWM]";
      setStatus(response?.error || "Secure reveal is unavailable for this item.");
      showBtn.disabled = true;
      return;
    }

    const context = response.context;
    placeholderEl.textContent = context.placeholder || "[PWM]";

    if (!context.available) {
      setStatus("This placeholder is not available in the current tab session.");
      showBtn.disabled = true;
      return;
    }

    setStatus("Hidden until you choose Show.");
  }

  async function showSecret() {
    if (!requestId) {
      showBtn.disabled = true;
      return;
    }

    showBtn.disabled = true;
    setStatus("Revealing in secure extension UI…");

    const response = await chrome.runtime.sendMessage({
      type: "PWM_EXTENSION_REVEAL_SECRET",
      requestId
    });

    if (!response?.ok || typeof response?.raw !== "string") {
      hideSecret();
      showBtn.disabled = true;
      setStatus(response?.error || "Secure reveal is unavailable for this item.");
      return;
    }

    hiddenCopyEl.hidden = true;
    secretValueEl.hidden = false;
    secretValueEl.textContent = response.raw;
    hideBtn.disabled = false;
    setStatus("Visible only inside this secure extension panel.");
  }

  showBtn.addEventListener("click", () => {
    showSecret().catch((error) => {
      hideSecret();
      showBtn.disabled = true;
      setStatus(error?.message || "Secure reveal failed.");
    });
  });

  hideBtn.addEventListener("click", () => {
    hideSecret();
    setStatus("Hidden until you choose Show.");
  });

  window.addEventListener("pagehide", () => {
    releaseRequest().catch(() => {});
  });

  loadContext().catch((error) => {
    placeholderEl.textContent = "[PWM]";
    showBtn.disabled = true;
    setStatus(error?.message || "Secure reveal could not initialize.");
  });
})();
