const formidable = require("formidable");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { uploadToR2 } = require("../backend/storage/r2");
const { getDb } = require("../backend/db/mongo");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const form = formidable({ multiples: false, keepExtensions: true });

  try {
    const { files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve({ fields, files });
      });
    });

    const uploaded = files.image;
    if (!uploaded) {
      return res.status(400).json({ error: "No image file provided" });
    }

    const fileObj = Array.isArray(uploaded) ? uploaded[0] : uploaded;
    const filepath = fileObj.filepath || fileObj.path;

    if (!filepath) {
      return res.status(400).json({ error: "Uploaded file path not found" });
    }

    const modelId = crypto.randomUUID();
    const key = `original/${modelId}.png`;

    const stream = fs.createReadStream(filepath);

    await uploadToR2(key, stream, "image/png");

    const db = await getDb();
    const models = db.collection("models");

    await models.insertOne({
      id: modelId,
      original_image: key,
      canonical_image: null,
      hotel_image: null,
      created_at: new Date(),
    });

    return res.status(200).json({
      message: "Image stored successfully",
      model_id: modelId,
      image_path: key,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return res.status(500).json({ error: "Failed to process upload" });
  }
};


