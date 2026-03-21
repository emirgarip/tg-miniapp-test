// Base Model Creator — 2-call pipeline.
//
// Call #1 (Extraction): extract only what the user explicitly stated
// System step:          apply user values + required defaults → partial model
// Call #2 (Inference):  infer body proportions from the partial model
// System step:          merge inferred values → final model
// Return final JSON with source tags per field.

const { getDb } = require("../../backend/db/mongo");
const { extractBaseModelExplicit } = require("../../backend/pipeline/baseModelExtractor");
const { inferBaseModelFields }     = require("../../backend/pipeline/baseModelInferrer");
const { buildPartialFlat, mergeInferred, buildNestedModel } = require("../../backend/pipeline/baseModelNormalizer");

const EXTRACTOR_MODEL = "gpt-4.1-mini";
const INFERRER_MODEL  = "gpt-4.1-mini";

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
    // ── AI Call #1: Extract explicit physical traits ───────────────────────────
    const extraction = await extractBaseModelExplicit(inputText, process.env.OPENAI_API_KEY, EXTRACTOR_MODEL);
    const t1 = Date.now();
    const latencyExtraction = t1 - t0;

    // Age safety: hard reject if subject is under 20
    if (extraction.age_rejected) {
      return res.status(400).json({
        error: "The model can only be more than 20 years old.",
        age_rejected: true,
      });
    }

    // ── System step: build partial model (user + required defaults) ───────────
    const partialFlat = buildPartialFlat(extraction.explicit);

    // ── AI Call #2: Infer body proportions from the partial model ─────────────
    const inferred = await inferBaseModelFields(partialFlat, process.env.OPENAI_API_KEY, INFERRER_MODEL);
    const t2 = Date.now();
    const latencyInference = t2 - t1;

    // ── System step: merge inferred → final flat → nested model ──────────────
    const finalFlat = mergeInferred(partialFlat, inferred);
    const { model, userCount, inferredCount, defaultsOnly } = buildNestedModel(finalFlat);

    const totalLatency = t2 - t0;

    // ── Informational note ────────────────────────────────────────────────────
    let note = null;
    if (defaultsOnly) {
      note = "No clear physical traits were detected. A base model was created using default values.";
    } else if (userCount + inferredCount < 4) {
      note = `Only ${userCount + inferredCount} physical trait(s) were detected. Some fields were completed with defaults or limited inference.`;
    }

    // ── Persist log (non-fatal) ───────────────────────────────────────────────
    try {
      const db = await getDb();
      await db.collection("ai_logs").insertOne({
        provider: "openai",
        extractor_model: EXTRACTOR_MODEL,
        inferrer_model: INFERRER_MODEL,
        type: "base_model_v2",
        user_traits_found: userCount,
        inferred_traits: inferredCount,
        latency_extraction_ms: latencyExtraction,
        latency_inference_ms: latencyInference,
        total_latency_ms: totalLatency,
        created_at: new Date(),
      });
    } catch (_) {}

    return res.status(200).json({
      base_model: model,
      user_traits_found: userCount,
      inferred_traits: inferredCount,
      defaults_only: defaultsOnly,
      note,
      extractor_model: EXTRACTOR_MODEL,
      inferrer_model: INFERRER_MODEL,
      latency_extraction_ms: latencyExtraction,
      latency_inference_ms: latencyInference,
      total_latency_ms: totalLatency,
    });

  } catch (err) {
    console.error("Base model pipeline error:", err);
    return res.status(500).json({ error: "Failed to build base model: " + err.message });
  }
};
