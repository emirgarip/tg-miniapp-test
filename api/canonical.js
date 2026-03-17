const formidable = require("formidable");
const OpenAI = require("openai");
const { toFile } = require("openai");
const { GoogleGenAI } = require("@google/genai");
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

  const useGemini = process.env.USE_GEMINI === "true";
  if (useGemini) {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured." });
    }
  } else {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY is not configured." });
    }
  }

  const form = formidable({ multiples: false });
  let modelId = "";

  try {
    const startedAt = Date.now();
    const { fields } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve({ fields, files });
      });
    });

    modelId = String(fields.model_id || "").trim();
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

    let canonicalBuffer;
    let apiProvider = useGemini ? "gemini" : "openai";
    // User-provided fixed estimates:
    // - Gemini free tier: $0
    // - OpenAI: 0.45 cent = $0.0045 per canonical generation
    let estimatedCost = useGemini ? 0 : 0.0045;

    if (useGemini) {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      // Gemini image generation: use the supported preview image model.
      // Provide reference image + prompt, request Image modality.
      const resp = await ai.models.generateContent({
        model: "gemini-2.0-flash-preview-image-generation",
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  data: referenceBuffer.toString("base64"),
                  mimeType: "image/png",
                },
              },
              { text: PROMPT },
            ],
          },
        ],
      });

      const part =
        resp?.candidates?.[0]?.content?.parts?.find(
          (p) => p.inlineData && p.inlineData.data
        ) || null;

      if (!part?.inlineData?.data) {
        throw new Error("Gemini did not return inline image data.");
      }

      canonicalBuffer = Buffer.from(part.inlineData.data, "base64");
    } else {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      // Use the reference image as input; generate a canonical portrait.
      // Use toFile() so this works in Node/Vercel (no global File required).
      const file = await toFile(referenceBuffer, "reference.png", { type: "image/png" });

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

      canonicalBuffer = Buffer.from(b64, "base64");
    }

    const canonicalKey = `canonical/${modelId}.png`;

    await uploadToR2(canonicalKey, canonicalBuffer, "image/png");

    const generationTime = Date.now() - startedAt;
    const imageSize = canonicalBuffer.length;

    await models.updateOne(
      { id: modelId },
      {
        $set: {
          canonical_image: canonicalKey,
          status: "completed",
          generation_time: generationTime,
          image_size: imageSize,
          api_provider: apiProvider,
          estimated_cost: estimatedCost,
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

