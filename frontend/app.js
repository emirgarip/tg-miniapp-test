document.addEventListener("DOMContentLoaded", () => {
  const tg = window.Telegram?.WebApp;
  const helloBtn = document.getElementById("hello-btn");
  const output = document.getElementById("output");
  const providerGemini = document.getElementById("provider-gemini");
  const providerOpenAI = document.getElementById("provider-openai");

  if (tg) {
    try {
      tg.ready();
      tg.expand();
    } catch (e) {
      // Not in Telegram WebView, ignore
    }
  }

  helloBtn.addEventListener("click", async () => {
    const provider =
      providerGemini?.checked ? "gemini" : providerOpenAI?.checked ? "openai" : "openai";

    const endpoint =
      provider === "gemini" ? "/api/test/gemini-prompt" : "/api/test/openai-prompt";
    const url = `${window.location.origin}${endpoint}`;

    try {
      output.textContent = "Generating prompt...";

      const response = await fetch(url, {
        method: "POST",
      });
      const data = await response.json();
      let message = data?.message;
      const isError = !!data?.error;
      if (!message && isError) {
        message = data.error;
      }
      const prompt = data?.prompt;

      output.innerHTML = "";

      if (!response.ok || isError) {
        const p = document.createElement("p");
        p.textContent = message || "Failed to generate prompt.";
        output.appendChild(p);
        return;
      }

      const pre = document.createElement("pre");
      pre.textContent = prompt || "No prompt returned.";
      pre.style.whiteSpace = "pre-wrap";
      pre.style.wordBreak = "break-word";
      pre.style.marginTop = "12px";
      pre.style.textAlign = "left";
      pre.style.color = "#0f172a";
      pre.style.background = "#ffffff";
      pre.style.borderRadius = "12px";
      pre.style.padding = "12px";
      pre.style.boxShadow = "0 6px 18px rgba(0, 0, 0, 0.06)";
      output.appendChild(pre);
    } catch (err) {
      output.innerHTML = "";
      const p = document.createElement("p");
      p.textContent = "Failed to generate prompt: " + err.message;
      output.appendChild(p);
    }
  });
});
