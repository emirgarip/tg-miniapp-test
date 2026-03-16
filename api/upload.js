const formidable = require("formidable");

module.exports = (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const form = formidable({ multiples: false });

  form.parse(req, (err, fields, files) => {
    if (err) {
      return res.status(400).json({ error: "Failed to parse form data" });
    }

    const uploaded = files.image;
    if (!uploaded) {
      return res.status(400).json({ error: "No image file provided" });
    }

    const fileObj = Array.isArray(uploaded) ? uploaded[0] : uploaded;
    const filename = fileObj.originalFilename || fileObj.newFilename || "unknown";

    return res.status(200).json({
      message: "A surprise for you from backend API!",
      received: true,
      filename,
    });
  });
};

