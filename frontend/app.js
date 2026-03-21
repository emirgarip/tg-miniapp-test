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

  // Source badge: color depends on where the value came from.
  function sourceBadge(source) {
    const badge = document.createElement("span");
    badge.className = `source-badge source-badge--${source}`;
    badge.textContent = source;
    return badge;
  }

  // Render one leaf field: key + value + source badge.
  function renderField(key, tagged, container) {
    const row = document.createElement("div");
    row.className = "field-row";

    const keyEl = document.createElement("span");
    keyEl.className = "field-key";
    keyEl.textContent = key;
    row.appendChild(keyEl);

    const valEl = document.createElement("span");
    valEl.className = "field-value";
    valEl.textContent = tagged.value ?? "null";
    row.appendChild(valEl);

    row.appendChild(sourceBadge(tagged.source || "default"));
    container.appendChild(row);
  }

  // Render a section group (e.g. "hair", "face", "body").
  function renderGroup(groupName, groupObj, container) {
    const section = document.createElement("div");
    section.className = "json-group";

    const title = document.createElement("div");
    title.className = "json-group__title";
    title.textContent = groupName;
    section.appendChild(title);

    for (const [key, tagged] of Object.entries(groupObj)) {
      renderField(key, tagged, section);
    }

    container.appendChild(section);
  }

  // Render the full base_model JSON in a structured, human-readable view.
  function renderBaseModel(model, container) {
    const TOP_LEVEL_FIELDS = ["gender_presentation", "age_range", "heritage_look", "skin_tone"];
    const GROUP_FIELDS = ["hair", "eyes", "face", "body", "style", "accessories", "reference"];

    // Top-level scalar fields
    const topSection = document.createElement("div");
    topSection.className = "json-group";

    const topTitle = document.createElement("div");
    topTitle.className = "json-group__title";
    topTitle.textContent = "identity";
    topSection.appendChild(topTitle);

    for (const key of TOP_LEVEL_FIELDS) {
      if (model[key] !== undefined) {
        renderField(key, model[key], topSection);
      }
    }
    container.appendChild(topSection);

    // Nested groups
    for (const group of GROUP_FIELDS) {
      if (model[group]) {
        renderGroup(group, model[group], container);
      }
    }
  }

  // ─── stats bar ────────────────────────────────────────────────────────────
  function renderStats(userCount, inferredCount, latencyMs) {
    const bar = document.createElement("div");
    bar.className = "stats-bar";
    bar.innerHTML =
      `<span class="stat"><span class="source-badge source-badge--user">user</span> ${userCount} fields</span>` +
      `<span class="stat"><span class="source-badge source-badge--inferred">inferred</span> ${inferredCount} fields</span>` +
      `<span class="stat stat--muted">${latencyMs} ms · gpt-4.1-mini</span>`;
    output.appendChild(bar);
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

      // Loading messages — cycle through them to feel responsive
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

      // Hard error
      if (data?.error) {
        renderError(data.error);
        return;
      }

      // Soft note (defaults-only or sparse input)
      if (data.note) {
        renderNote(data.note);
      }

      // Stats bar
      renderStats(data.user_traits_found ?? 0, data.inferred_traits ?? 0, data.latency_ms ?? 0);

      // Base model JSON viewer
      const modelWrap = document.createElement("div");
      modelWrap.className = "model-viewer";

      const viewerTitle = document.createElement("div");
      viewerTitle.className = "viewer-title";
      viewerTitle.textContent = "Base Model Profile";
      modelWrap.appendChild(viewerTitle);

      if (data.base_model) {
        renderBaseModel(data.base_model, modelWrap);
      }

      output.appendChild(modelWrap);

    } catch (err) {
      renderError("Request failed: " + err.message);
    } finally {
      btn.disabled = false;
    }
  });
});
