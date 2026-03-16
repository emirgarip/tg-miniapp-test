const formidable = require("formidable");
const fs = require("fs");
const crypto = require("crypto");
const sharp = require("sharp");
const { uploadToR2 } = require("../backend/storage/r2");
const { getDb } = require("../backend/db/mongo");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
  const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

  const form = formidable({
    multiples: false,
    keepExtensions: true,
    maxFileSize: MAX_SIZE_BYTES,
  });

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
    const mimeType = fileObj.mimetype || fileObj.type;
    const fileSize = fileObj.size;

    if (fileSize && fileSize > MAX_SIZE_BYTES) {
      return res
        .status(400)
        .json({ error: "File too large. Maximum allowed size is 5MB." });
    }

    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return res.status(400).json({
        error: "Invalid file type. Only JPEG, PNG, and WEBP images are allowed.",
      });
    }

    if (!filepath) {
      return res.status(400).json({ error: "Uploaded file path not found" });
    }

    // Read and process image with sharp
    const image = sharp(filepath);
    const resized = image.resize({
      width: 1024,
      height: 1024,
      fit: "inside",
      withoutEnlargement: true,
    }).png({ quality: 80 });

    const buffer = await resized.toBuffer();
    const { width, height } = await sharp(buffer).metadata();

    const finalFileSize = buffer.length;
    const finalMimeType = "image/png";

    const modelId = crypto.randomUUID();
    const key = `original/${modelId}.png`;

    await uploadToR2(key, buffer, finalMimeType);

    const db = await getDb();
    const models = db.collection("models");

    await models.insertOne({
      id: modelId,
      original_image: key,
      canonical_image: null,
      hotel_image: null,
      status: "uploaded",
      file_size: finalFileSize,
      mime_type: finalMimeType,
      width,
      height,
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


