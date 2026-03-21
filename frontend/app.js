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

      renderStats(data.user_traits_found ?? 0, data.inferred_traits ?? 0, data.latency_ms ?? 0);

      // ── JSON block + copy button ─────────────────────────────────────────
      const jsonStr = JSON.stringify(data.base_model, null, 2);

      const wrap = document.createElement("div");
      wrap.className = "json-output-wrap";

      const copyBtn = document.createElement("button");
      copyBtn.className = "copy-btn";
      copyBtn.textContent = "Copy JSON";
      copyBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(jsonStr);
          copyBtn.textContent = "Copied!";
        } catch (_) {
          copyBtn.textContent = "Copy failed";
        }
        setTimeout(() => { copyBtn.textContent = "Copy JSON"; }, 1600);
      });
      wrap.appendChild(copyBtn);

      const pre = document.createElement("pre");
      pre.className = "json-output";
      pre.textContent = jsonStr;
      wrap.appendChild(pre);

      output.appendChild(wrap);

    } catch (err) {
      renderError("Request failed: " + err.message);
    } finally {
      btn.disabled = false;
    }
  });
});
