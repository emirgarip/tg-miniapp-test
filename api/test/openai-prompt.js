// Base Model Creator endpoint.
//
// Accepts free-text physical descriptions in any language.
// Returns a normalized base-model JSON with source tags for every field.
// No prompt generation, no image generation — physical attributes only.

const { getDb } = require("../../backend/db/mongo");
const { extractBaseModel } = require("../../backend/pipeline/baseModelExtractor");
const { normalizeBaseModel } = require("../../backend/pipeline/baseModelNormalizer");

const MODEL = "gpt-4.1-mini";

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "OPENAI_API_KEY is not configured." });
  }

  const inputText = String(req.body?.input || "").trim();
  if (inputText.length < 20) {
    return res.status(400).json({ error: "Please enter at least 20 characters." });
  }

  const startedAt = Date.now();

  try {
    // ─── Extract physical attributes via LLM ─────────────────────────────────
    const extraction = await extractBaseModel(inputText, process.env.OPENAI_API_KEY, MODEL);

    // Age safety: hard reject if the model is under 20
    if (extraction.age_rejected) {
      return res.status(400).json({
        error: "The model can only be more than 20 years old.",
        age_rejected: true,
      });
    }

    // ─── Normalize: merge explicit + inferred + defaults ──────────────────────
    const { model, userCount, inferredCount, defaultsOnly } = normalizeBaseModel(
      extraction.explicit,
      extraction.inferred
    );

    const latencyMs = Date.now() - startedAt;

    // ─── Build informational notes ────────────────────────────────────────────
    let note = null;
    if (defaultsOnly) {
      note = "No clear physical traits were detected in your input. The base model was built entirely from default values.";
    } else if (userCount + inferredCount < 4) {
      note = `Only ${userCount + inferredCount} physical trait(s) were detected. The remaining fields were completed with default values.`;
    }

    // ─── Persist log (non-fatal) ──────────────────────────────────────────────
    try {
      const db = await getDb();
      await db.collection("ai_logs").insertOne({
        provider: "openai",
        model: MODEL,
        type: "base_model_extraction",
        user_traits_found: userCount,
        inferred_traits: inferredCount,
        latency_ms: latencyMs,
        created_at: new Date(),
      });
    } catch (_) {}

    return res.status(200).json({
      base_model: model,
      user_traits_found: userCount,
      inferred_traits: inferredCount,
      defaults_only: defaultsOnly,
      note,
      latency_ms: latencyMs,
      model: MODEL,
    });

  } catch (err) {
    console.error("Base model extraction error:", err);
    return res.status(500).json({ error: "Failed to extract base model: " + err.message });
  }
};
