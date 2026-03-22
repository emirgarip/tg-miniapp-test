document.addEventListener("DOMContentLoaded", () => {
  const tg = window.Telegram?.WebApp;
  const btn = document.getElementById("hello-btn");
  const userInput = document.getElementById("user-input");
  const hint = document.getElementById("hint");
  const output = document.getElementById("output");

  if (tg) {
    try { tg.ready(); tg.expand(); } catch (_) {}
  }

  // ─── character hint ───────────────────────────────────────────────────────
  function updateHint() {
    const len = userInput.value.trim().length;
    hint.textContent = `Minimum 20 characters (${len}/20)`;
    hint.style.color = len >= 20 ? "#16a34a" : "#64748b";
  }
  updateHint();
  userInput.addEventListener("input", updateHint);

  // ─── helpers ──────────────────────────────────────────────────────────────

  function renderError(message) {
    output.innerHTML = "";
    const p = document.createElement("p");
    p.className = "error-message";
    p.textContent = message;
    output.appendChild(p);
  }

  function renderNote(message) {
    const p = document.createElement("p");
    p.className = "info-note";
    p.textContent = message;
    output.appendChild(p);
  }

  // ─── stats bar ────────────────────────────────────────────────────────────
  function renderStats(data) {
    const userCount = data.user_traits_found ?? 0;
    const latencyMs = data.latency_ms ?? 0;
    const model     = data.model || "gpt-4.1-mini";

    const bar = document.createElement("div");
    bar.className = "stats-bar";
    bar.innerHTML =
      `<span class="stat"><span class="source-badge source-badge--user">user</span> ${userCount} fields</span>` +
      `<span class="stat stat--muted">${model} · ${latencyMs} ms</span>`;
    output.appendChild(bar);
  }

  // ─── sanitize warnings ───────────────────────────────────────────────────
  function renderSanitizeWarnings(warnings) {
    if (!warnings || warnings.length === 0) return;

    const box = document.createElement("div");
    box.className = "sanitize-warning";

    const title = document.createElement("p");
    title.className = "sanitize-warning-title";
    title.textContent = `⚠ AI mapping warning — ${warnings.length} value(s) returned by the AI were not recognized and were dropped:`;
    box.appendChild(title);

    const list = document.createElement("ul");
    list.className = "sanitize-warning-list";
    warnings.forEach(({ field, received }) => {
      const item = document.createElement("li");
      item.textContent = `${field}: AI returned "${received}" — not in allowed list, dropped`;
      list.appendChild(item);
    });
    box.appendChild(list);

    output.appendChild(box);
  }

  // ─── result tabs ─────────────────────────────────────────────────────────
  function renderResultTabs(data) {
    // ── Tab bar ──────────────────────────────────────────────────────────────
    const tabBar = document.createElement("div");
    tabBar.className = "result-tabs";

    const jsonTabBtn = document.createElement("button");
    jsonTabBtn.className = "tab-btn tab-btn--active";
    jsonTabBtn.textContent = "JSON";

    const promptTabBtn = document.createElement("button");
    promptTabBtn.className = "tab-btn";
    promptTabBtn.textContent = "Final Prompt";

    tabBar.appendChild(jsonTabBtn);
    tabBar.appendChild(promptTabBtn);

    // ── JSON panel (existing behavior, untouched) ────────────────────────────
    const jsonPanel = document.createElement("div");
    jsonPanel.className = "tab-panel tab-panel--active";

    const jsonStr = JSON.stringify(data.base_model, null, 2);
    const jsonWrap = document.createElement("div");
    jsonWrap.className = "json-output-wrap";

    const copyJsonBtn = document.createElement("button");
    copyJsonBtn.className = "copy-btn";
    copyJsonBtn.textContent = "Copy JSON";
    copyJsonBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(jsonStr);
        copyJsonBtn.textContent = "Copied!";
      } catch (_) {
        copyJsonBtn.textContent = "Copy failed";
      }
      setTimeout(() => { copyJsonBtn.textContent = "Copy JSON"; }, 1600);
    });
    jsonWrap.appendChild(copyJsonBtn);

    const pre = document.createElement("pre");
    pre.className = "json-output";
    pre.textContent = jsonStr;
    jsonWrap.appendChild(pre);
    jsonPanel.appendChild(jsonWrap);

    // ── Final Prompt panel ───────────────────────────────────────────────────
    const promptPanel = document.createElement("div");
    promptPanel.className = "tab-panel";

    if (data.final_prompt) {
      const promptWrap = document.createElement("div");
      promptWrap.className = "prompt-output-wrap";

      const copyPromptBtn = document.createElement("button");
      copyPromptBtn.className = "copy-btn";
      copyPromptBtn.textContent = "Copy Final Prompt";
      copyPromptBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(data.final_prompt);
          copyPromptBtn.textContent = "Copied!";
        } catch (_) {
          copyPromptBtn.textContent = "Copy failed";
        }
        setTimeout(() => { copyPromptBtn.textContent = "Copy Final Prompt"; }, 1600);
      });
      promptWrap.appendChild(copyPromptBtn);

      const promptText = document.createElement("div");
      promptText.className = "prompt-output";
      promptText.textContent = data.final_prompt;
      promptWrap.appendChild(promptText);
      promptPanel.appendChild(promptWrap);
    } else {
      const empty = document.createElement("p");
      empty.className = "info-note";
      empty.textContent = "Final prompt could not be generated.";
      promptPanel.appendChild(empty);
    }

    // ── Tab switching ────────────────────────────────────────────────────────
    function switchTab(name) {
      jsonTabBtn.classList.toggle("tab-btn--active", name === "json");
      promptTabBtn.classList.toggle("tab-btn--active", name === "prompt");
      jsonPanel.classList.toggle("tab-panel--active", name === "json");
      promptPanel.classList.toggle("tab-panel--active", name === "prompt");
    }

    jsonTabBtn.addEventListener("click", () => switchTab("json"));
    promptTabBtn.addEventListener("click", () => switchTab("prompt"));

    output.appendChild(tabBar);
    output.appendChild(jsonPanel);
    output.appendChild(promptPanel);
  }

  // ─── main click ───────────────────────────────────────────────────────────
  btn.addEventListener("click", async () => {
    const input = userInput.value.trim();
    if (input.length < 20) {
      renderError("Please enter at least 20 characters.");
      return;
    }

    try {
      btn.disabled = true;
      output.innerHTML = "";

      const loadingMsgs = [
        "Analyzing physical traits…",
        "Building your base model profile…",
        "Filling missing details with default values…",
      ];
      let msgIdx = 0;
      const loading = document.createElement("p");
      loading.className = "loading-msg";
      loading.textContent = loadingMsgs[msgIdx];
      output.appendChild(loading);
      const loadingTimer = setInterval(() => {
        msgIdx = (msgIdx + 1) % loadingMsgs.length;
        loading.textContent = loadingMsgs[msgIdx];
      }, 1800);

      const response = await fetch(`${window.location.origin}/api/test/openai-prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const data = await response.json();

      clearInterval(loadingTimer);
      output.innerHTML = "";

      if (data?.error) {
        renderError(data.error);
        return;
      }

      if (data.note) {
        renderNote(data.note);
      }

      renderStats(data);
      renderSanitizeWarnings(data.sanitize_warnings);
      renderResultTabs(data);

    } catch (err) {
      renderError("Request failed: " + err.message);
    } finally {
      btn.disabled = false;
    }
  });
});
