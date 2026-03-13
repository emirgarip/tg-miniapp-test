document.addEventListener("DOMContentLoaded", () => {
  const tg = window.Telegram?.WebApp;
  const helloBtn = document.getElementById("hello-btn");
  const output = document.getElementById("output");

  if (tg) {
    tg.ready();
    tg.expand();
  }

  helloBtn.addEventListener("click", async () => {
    output.textContent = "";
    try {
      const response = await fetch("/api/hello");
      const data = await response.json();
      const message = data?.message ?? "No message received";
      output.textContent = message;
      if (tg) {
        tg.showAlert(message);
      } else {
        alert(message);
      }
    } catch (err) {
      output.textContent = "Failed to fetch: " + err.message;
      if (tg) {
        tg.showAlert("Error: " + err.message);
      } else {
        alert("Error: " + err.message);
      }
    }
  });
});
