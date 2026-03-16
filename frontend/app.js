document.addEventListener("DOMContentLoaded", () => {
  const tg = window.Telegram?.WebApp;
  const helloBtn = document.getElementById("hello-btn");
  const imageInput = document.getElementById("image-input");
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
    const file = imageInput?.files?.[0];
    if (!file) {
      output.innerHTML = "";
      const p = document.createElement("p");
      p.textContent = "Please select an image first.";
      output.appendChild(p);
      return;
    }

    const formData = new FormData();
    formData.append("image", file);

    const uploadUrl = `${window.location.origin}/api/upload`;

    try {
      const response = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      let message = data?.message;
      const isError = !!data?.error;
      if (!message && isError) {
        message = data.error;
      }
      if (!message) {
        message = "No message received";
      }

      output.innerHTML = "";

      const p = document.createElement("p");
      p.textContent = message;
      output.appendChild(p);

      // Only show image preview on successful upload
      if (!isError && response.ok) {
        const img = document.createElement("img");
        img.src = URL.createObjectURL(file);
        img.style.width = "250px";
        img.style.borderRadius = "12px";
        img.style.marginTop = "20px";
        img.style.display = "block";
        img.style.marginLeft = "auto";
        img.style.marginRight = "auto";
        output.appendChild(img);
      }
    } catch (err) {
      output.innerHTML = "";
      const p = document.createElement("p");
      p.textContent = "Failed to upload: " + err.message;
      output.appendChild(p);
    }
  });
});
