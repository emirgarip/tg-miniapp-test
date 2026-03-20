document.addEventListener("DOMContentLoaded", () => {
  const tg = window.Telegram?.WebApp;
  const helloBtn = document.getElementById("hello-btn");
  const userInput = document.getElementById("user-input");
  const hint = document.getElementById("hint");
  const output = document.getElementById("output");
  const copyBtn = document.getElementById("copy-btn");

  if (tg) {
    try {
      tg.ready();
      tg.expand();
    } catch (_) {}
  }

  // ─── hint ────────────────────────────────────────────────────────────────
  function updateHint() {
    const len = userInput.value.trim().length;
    hint.textContent = `Minimum 20 characters (${len}/20)`;
    hint.style.color = len >= 20 ? "#16a34a" : "#64748b";
  }
  updateHint();
  userInput.addEventListener("input", updateHint);

  // ─── helpers ─────────────────────────────────────────────────────────────
  function renderError(message) {
    output.innerHTML = "";
    const p = document.createElement("p");
    p.className = "error-message";
    p.textContent = message;
    output.appendChild(p);
    copyBtn.hidden = true;
  }

  // variant: undefined | "accent" | "interp"
  function makeSection(title, content, accent, variant) {
    const wrap = document.createElement("div");
    let cls = "result-block";
    if (accent) cls += " result-block--accent";
    if (variant === "interp") cls += " result-block--interp";
    wrap.className = cls;

    const h = document.createElement("div");
    h.className = "result-block__title";
    h.textContent = title;
    wrap.appendChild(h);

    const body = document.createElement("div");
    body.className = "result-block__body";
    body.textContent = content;
    wrap.appendChild(body);

    return wrap;
  }

  function makeBlocksSection(blocks) {
    const LABELS = {
      subject: "Subject",
      age: "Age",
      face: "Face",
      hair: "Hair",
      eyes_expression: "Eyes & Expression",
      body: "Body",
      clothing: "Clothing",
      pose: "Pose",
      environment: "Environment",
      lighting: "Lighting",
      camera: "Camera & Composition",
      quality: "Quality & Realism",
      negative: "Negative Prompt",
    };

    const wrap = document.createElement("div");
    wrap.className = "result-block";

    const h = document.createElement("div");
    h.className = "result-block__title";
    h.textContent = "Prompt Blocks";
    wrap.appendChild(h);

    for (const [key, text] of Object.entries(blocks)) {
      const label = LABELS[key] || key;

      const row = document.createElement("div");
      row.className = "block-row";

      const badge = document.createElement("span");
      badge.className = "block-badge";
      badge.textContent = label;
      row.appendChild(badge);

      const val = document.createElement("div");
      val.className = "block-value";
      val.textContent = text;
      row.appendChild(val);

      wrap.appendChild(row);
    }
    return wrap;
  }

  function formatPlanning(vp) {
    if (!vp) return "Not available";
    const lines = [
      `Subject emphasis    : ${vp.subject_emphasis}`,
      `Framing strategy    : ${vp.framing_strategy}`,
      `Framing reason      : ${vp.framing_reason || "—"}`,
      `Emphasis targets    : ${(vp.emphasis_targets || []).join(", ") || "none"}`,
      `Interp. regions     : ${(vp.interpretation_regions || []).join(", ") || "none"}`,
      `Pose source         : ${vp.pose_reason || "default"}`,
      `Pose suggestion     : ${vp.pose_suggestion || "default"}`,
      `Composition goal    : ${vp.composition_goal}`,
    ];
    return lines.join("\n");
  }

  function formatSpec(spec) {
    if (!spec) return "Not available";
    const lines = [];
    function walk(obj, prefix) {
      for (const [k, v] of Object.entries(obj)) {
        const key = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === "object" && "value" in v) {
          lines.push(`${key} [${v.source}]: ${v.value}`);
        } else if (v && typeof v === "object") {
          walk(v, key);
        }
      }
    }
    walk(spec, "");
    return lines.join("\n");
  }

  // ─── main click ──────────────────────────────────────────────────────────
  helloBtn.addEventListener("click", async () => {
    const input = userInput.value.trim();
    if (input.length < 20) {
      renderError("Please enter at least 20 characters.");
      return;
    }

    try {
      helloBtn.disabled = true;
      copyBtn.hidden = true;
      output.innerHTML = "";

      const loading = document.createElement("p");
      loading.className = "loading-msg";
      loading.textContent = "Running pipeline… this may take a few seconds.";
      output.appendChild(loading);

      const response = await fetch(`${window.location.origin}/api/test/openai-prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const data = await response.json();

      output.innerHTML = "";

      if (data?.error) {
        renderError(data.error);
        return;
      }

      if (data.refusal) {
        renderError(data.final_prompt);
        return;
      }

      // Non-blocking notice when content was sanitized (SOFT_EXPLICIT path).
      if (data.content_adjusted && data.adjustment_message) {
        const notice = document.createElement("p");
        notice.className = "adjustment-notice";
        notice.textContent = data.adjustment_message;
        output.appendChild(notice);
      }

      // A. Structured Analysis
      output.appendChild(
        makeSection("Structured Analysis", data.structured_analysis || "Not available")
      );

      // B. Semantic Interpretation (new)
      if (data.semantic_interpretation) {
        output.appendChild(
          makeSection("Semantic Interpretation", data.semantic_interpretation, false, "interp")
        );
      }

      // C. Extracted Attributes (user-provided)
      const extracted = data.extracted_attributes || [];
      output.appendChild(
        makeSection(
          `Extracted Attributes (${extracted.length})`,
          extracted.length ? extracted.join("\n") : "None — no explicit attributes detected"
        )
      );

      // D. Auto-filled / Normalized Attributes
      const auto = data.auto_filled_attributes || [];
      output.appendChild(
        makeSection(
          `Auto-filled Attributes (${auto.length})`,
          auto.length ? auto.join("\n") : "None"
        )
      );

      // E. Visual Planning
      output.appendChild(
        makeSection("Visual Planning", formatPlanning(data.visual_planning))
      );

      // F. Character Spec
      output.appendChild(
        makeSection("Character Spec", formatSpec(data.character_spec))
      );

      // G. Prompt Blocks
      if (data.prompt_blocks) {
        output.appendChild(makeBlocksSection(data.prompt_blocks));
      }

      // H. Final Prompt
      output.appendChild(
        makeSection("Final Prompt", data.final_prompt || "Not available", true)
      );

      // H. Latency note
      if (data.latency_ms) {
        const meta = document.createElement("p");
        meta.className = "meta-note";
        meta.textContent = `Model: ${data.model} · Latency: ${data.latency_ms} ms`;
        output.appendChild(meta);
      }

      // Copy button
      copyBtn.hidden = false;
      copyBtn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(data.final_prompt || "");
          copyBtn.textContent = "Copied!";
        } catch (_) {
          copyBtn.textContent = "Copy failed";
        }
        setTimeout(() => {
          copyBtn.textContent = "Copy Final Prompt";
        }, 1400);
      };
    } catch (err) {
      renderError("Failed to generate prompt: " + err.message);
    } finally {
      helloBtn.disabled = false;
    }
  });
});
