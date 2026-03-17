const { downloadFromR2 } = require("../backend/storage/r2_download");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const key = String(req.query?.key || "");
  if (!key) {
    return res.status(400).json({ error: "key is required" });
  }

  // Basic safety: only allow reading our expected prefixes
  if (!key.startsWith("canonical/") && !key.startsWith("original/")) {
    return res.status(400).json({ error: "Invalid key" });
  }

  try {
    const buf = await downloadFromR2(key);
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return res.status(200).send(buf);
  } catch (err) {
    console.error("File proxy error:", err);
    return res.status(404).json({ error: "Not found" });
  }
};

