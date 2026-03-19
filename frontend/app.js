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
    } catch (e) {
      // Not in Telegram WebView, ignore
    }
  }

  function renderError(message) {
    output.innerHTML = "";
    const p = document.createElement("p");
    p.textContent = message;
    output.appendChild(p);
    copyBtn.hidden = true;
  }

  function updateHint() {
    const len = userInput.value.trim().length;
    hint.textContent = `Minimum 20 characters (${len}/20)`;
    hint.style.color = len >= 20 ? "#16a34a" : "#64748b";
  }

  updateHint();
  userInput.addEventListener("input", updateHint);

  helloBtn.addEventListener("click", async () => {
    const input = userInput.value.trim();
    if (input.length < 20) {
      renderError("Please enter at least 20 characters.");
      return;
    }

    const url = `${window.location.origin}/api/test/openai-prompt`;

    try {
      helloBtn.disabled = true;
      copyBtn.hidden = true;
      output.textContent = "Generating prompt...";

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input }),
      });
      const data = await response.json();
      const isError = !!data?.error || !response.ok;

      output.innerHTML = "";

      if (isError) {
        renderError(data?.error || "Failed to generate prompt.");
        return;
      }

      const analysisBlock = document.createElement("div");
      analysisBlock.className = "result-block";
      analysisBlock.textContent = data.structured_analysis || "Structured Analysis\n- Not available";
      output.appendChild(analysisBlock);

      const extractedBlock = document.createElement("div");
      extractedBlock.className = "result-block";
      extractedBlock.textContent = `Extracted Attributes (User)\n${
        (data.extracted_attributes || []).join("\n") || "None"
      }`;
      output.appendChild(extractedBlock);

      const autoBlock = document.createElement("div");
      autoBlock.className = "result-block";
      autoBlock.textContent = `Auto-filled Attributes\n${
        (data.auto_filled_attributes || []).join("\n") || "None"
      }`;
      output.appendChild(autoBlock);

      const specBlock = document.createElement("div");
      specBlock.className = "result-block";
      specBlock.textContent = `Character Spec\n${JSON.stringify(
        data.character_spec || {},
        null,
        2
      )}`;
      output.appendChild(specBlock);

      const promptBlock = document.createElement("div");
      promptBlock.className = "result-block";
      promptBlock.textContent = `Final Prompt\n${data.final_prompt || "Not available"}`;
      output.appendChild(promptBlock);

      copyBtn.hidden = false;
      copyBtn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(data.final_prompt || "");
          copyBtn.textContent = "Copied!";
          setTimeout(() => {
            copyBtn.textContent = "Copy Final Prompt";
          }, 1200);
        } catch (_) {
          copyBtn.textContent = "Copy failed";
          setTimeout(() => {
            copyBtn.textContent = "Copy Final Prompt";
          }, 1200);
        }
      };
    } catch (err) {
      renderError("Failed to generate prompt: " + err.message);
    } finally {
      helloBtn.disabled = false;
    }
  });
});
