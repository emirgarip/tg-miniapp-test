const formidable = require("formidable");
const crypto = require("crypto");
const OpenAI = require("openai");
const { uploadToR2 } = require("../backend/storage/r2");
const { downloadFromR2 } = require("../backend/storage/r2_download");
const { getDb } = require("../backend/db/mongo");

const PROMPT = `The subject is a fictional AI character created for a digital identity project.

Using the reference image as a structural guide for facial identity, bone structure, and proportions, generate a stable photorealistic portrait of the same individual.

Preserve the facial structure, head shape, eye spacing, nose shape, and jawline from the reference image.

The subject is photographed in a neutral studio environment with soft lighting and a clean background.

Framing: upper body portrait (mid‑torso and above).

Clothing: simple white cotton t‑shirt with no logos.

Expression: calm and neutral with natural eye contact.

Do not significantly beautify or alter identity.

Maintain realistic skin texture and natural details.

High‑quality photorealistic studio portrait.`;

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "OPENAI_API_KEY is not configured." });
  }

  const form = formidable({ multiples: false });

  try {
    const { fields } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve({ fields, files });
      });
    });

    const modelId = String(fields.model_id || "").trim();
    if (!modelId) {
      return res.status(400).json({ error: "model_id is required" });
    }

    const db = await getDb();
    const models = db.collection("models");

    const model = await models.findOne({ id: modelId });
    if (!model) {
      return res.status(404).json({ error: "Model not found" });
    }

    if (!model.original_image) {
      return res.status(400).json({ error: "Model has no original_image" });
    }

    // Mark as processing (best-effort)
    await models.updateOne(
      { id: modelId },
      { $set: { status: "processing", updated_at: new Date() } }
    );

    const referenceBuffer = await downloadFromR2(model.original_image);

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Use the reference image as input; generate a canonical portrait.
    // openai SDK accepts Web/File inputs in Node; construct a File from the buffer.
    const file = new File([referenceBuffer], `reference-${crypto.randomUUID()}.png`, {
      type: "image/png",
    });

    const result = await openai.images.edit({
      model: "gpt-image-1",
      prompt: PROMPT,
      image: file,
      size: "1024x1024",
    });

    const b64 = result?.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error("OpenAI did not return b64_json image data.");
    }

    const canonicalBuffer = Buffer.from(b64, "base64");
    const canonicalKey = `canonical/${modelId}.png`;

    await uploadToR2(canonicalKey, canonicalBuffer, "image/png");

    await models.updateOne(
      { id: modelId },
      {
        $set: {
          canonical_image: canonicalKey,
          status: "completed",
          updated_at: new Date(),
        },
      }
    );

    return res.status(200).json({
      message: "Canonical image generated",
      model_id: modelId,
      canonical_image: canonicalKey,
    });
  } catch (err) {
    console.error("Canonical error:", err);
    try {
      const db = await getDb();
      const models = db.collection("models");
      const modelId = String(req?.query?.model_id || "");
      if (modelId) {
        await models.updateOne(
          { id: modelId },
          { $set: { status: "failed", updated_at: new Date() } }
        );
      }
    } catch (_) {
      // ignore
    }
    return res.status(500).json({ error: "Failed to generate canonical image" });
  }
};

