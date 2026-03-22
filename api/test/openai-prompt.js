// Base Model Creator — single extraction call.
//
// Extract → apply user values → fill required fields with defaults → rest null.
// No inference, no second call.

const { getDb } = require("../../backend/db/mongo");
const { extractBaseModelExplicit } = require("../../backend/pipeline/baseModelExtractor");
const { buildPartialFlat, buildNestedModel } = require("../../backend/pipeline/baseModelNormalizer");
const { buildFinalImagePrompt } = require("../../backend/pipeline/promptBuilder");

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

  const t0 = Date.now();

  try {
    // ── Extract explicit physical traits ──────────────────────────────────────
    const extraction = await extractBaseModelExplicit(inputText, process.env.OPENAI_API_KEY, MODEL);

    // Age safety: hard reject if subject is under 20
    if (extraction.age_rejected) {
      return res.status(400).json({
        error: "The model can only be more than 20 years old.",
        age_rejected: true,
      });
    }

    // ── Build model: user values + required defaults + optional nulls ─────────
    const flat = buildPartialFlat(extraction.explicit);
    const { model, userCount, defaultsOnly } = buildNestedModel(flat);

    // ── Build deterministic final image prompt from model JSON ────────────────
    const finalPrompt = buildFinalImagePrompt(model);

    const latencyMs = Date.now() - t0;

    // ── Informational note ────────────────────────────────────────────────────
    let note = null;
    if (defaultsOnly) {
      note = "No clear physical traits were detected. A base model was created using default values.";
    } else if (userCount < 4) {
      note = `Only ${userCount} physical trait(s) were detected. The remaining fields were filled with defaults or left empty.`;
    }

    // ── Persist log (non-fatal) ───────────────────────────────────────────────
    try {
      const db = await getDb();
      await db.collection("ai_logs").insertOne({
        provider: "openai",
        model: MODEL,
        type: "base_model_v3",
        user_traits_found: userCount,
        latency_ms: latencyMs,
        created_at: new Date(),
      });
    } catch (_) {}

    return res.status(200).json({
      base_model: model,
      final_prompt: finalPrompt,
      user_traits_found: userCount,
      defaults_only: defaultsOnly,
      note,
      model: MODEL,
      latency_ms: latencyMs,
    });

  } catch (err) {
    console.error("Base model extraction error:", err);
    return res.status(500).json({ error: "Failed to build base model: " + err.message });
  }
};
