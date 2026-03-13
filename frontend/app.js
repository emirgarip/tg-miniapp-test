document.addEventListener("DOMContentLoaded", () => {
  const tg = window.Telegram?.WebApp;
  const helloBtn = document.getElementById("hello-btn");
  const output = document.getElementById("output");

  if (tg) {
    tg.ready();
    tg.expand();
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
      img.src = "./images/sydney.PNG";
      img.style.width = "250px";
      img.style.borderRadius = "12px";
      img.style.marginTop = "20px";
      img.style.display = "block";
      img.style.marginLeft = "auto";
      img.style.marginRight = "auto";
      output.appendChild(img);

      if (tg) {
        tg.showAlert(message);
      } else {
        alert(message);
      }
    } catch (err) {
      output.innerHTML = "";
      const p = document.createElement("p");
      p.textContent = "Failed to fetch: " + err.message;
      output.appendChild(p);
      if (tg) {
        tg.showAlert("Error: " + err.message);
      } else {
        alert("Error: " + err.message);
      }
    }
  });
});
