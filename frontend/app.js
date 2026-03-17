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
        const originalLabel = document.createElement("p");
        originalLabel.textContent = "Original image:";
        output.appendChild(originalLabel);

        const img = document.createElement("img");
        img.src = URL.createObjectURL(file);
        img.style.width = "250px";
        img.style.borderRadius = "12px";
        img.style.marginTop = "20px";
        img.style.display = "block";
        img.style.marginLeft = "auto";
        img.style.marginRight = "auto";
        output.appendChild(img);

        // If backend returned a model_id, request canonical generation and show it.
        const modelId = data?.model_id;
        if (modelId) {
          const canonicalStatus = document.createElement("p");
          canonicalStatus.textContent = "Generating canonical image...";
          output.appendChild(canonicalStatus);

          const canonicalForm = new FormData();
          canonicalForm.append("model_id", modelId);
          canonicalForm.append("image", file);

          const canonicalUrl = `${window.location.origin}/api/canonical`;
          const canonicalResp = await fetch(canonicalUrl, {
            method: "POST",
            body: canonicalForm,
          });
          const canonicalData = await canonicalResp.json();
          if (!canonicalResp.ok) {
            canonicalStatus.textContent =
              canonicalData?.error || "Failed to generate canonical image.";
            return;
          }

          if (canonicalData?.canonical_image) {
            canonicalStatus.textContent = "Canonical image:";
            const canonicalImg = document.createElement("img");
            canonicalImg.src = `/api/file?key=${encodeURIComponent(
              canonicalData.canonical_image
            )}`;
            canonicalImg.style.width = "250px";
            canonicalImg.style.borderRadius = "12px";
            canonicalImg.style.marginTop = "20px";
            canonicalImg.style.display = "block";
            canonicalImg.style.marginLeft = "auto";
            canonicalImg.style.marginRight = "auto";
            canonicalImg.addEventListener("error", () => {
              canonicalStatus.textContent =
                "Canonical generated, but failed to load image.";
            });
            output.appendChild(canonicalImg);
          } else {
            canonicalStatus.textContent =
              "Canonical generated, but no image path returned.";
          }
        }
      }
    } catch (err) {
      output.innerHTML = "";
      const p = document.createElement("p");
      p.textContent = "Failed to upload: " + err.message;
      output.appendChild(p);
    }
  });
});
