document.addEventListener("DOMContentLoaded", () => {
  const tg = window.Telegram?.WebApp;
  const helloBtn = document.getElementById("hello-btn");
  const output = document.getElementById("output");

  if (tg) {
    try {
      tg.ready();
      tg.expand();
    } catch (e) {
      // Not in Telegram WebView, ignore
    }
  }

  helloBtn.addEventListener("click", async () => {
    try {
      const response = await fetch("/api/hello");
      const data = await response.json();
      const message = data?.message ?? "No message received";

      output.innerHTML = "";

      const p = document.createElement("p");
      p.textContent = message;
      output.appendChild(p);

      const img = document.createElement("img");
      img.src = "/frontend/images/sydney.PNG";
      img.style.width = "250px";
      img.style.borderRadius = "12px";
      img.style.marginTop = "20px";
      img.style.display = "block";
      img.style.marginLeft = "auto";
      img.style.marginRight = "auto";
      output.appendChild(img);
    } catch (err) {
      output.innerHTML = "";
      const p = document.createElement("p");
      p.textContent = "Failed to fetch: " + err.message;
      output.appendChild(p);
    }
  });
});
