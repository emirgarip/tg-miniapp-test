// Orchestrates the 5-step block-based prompt generation pipeline.
// Steps: extract → normalize → plan → build blocks → assemble

const { getDb } = require("../../backend/db/mongo");
const { extract } = require("./pipeline/extractor");
const { normalize } = require("./pipeline/normalizer");
const { plan } = require("./pipeline/planner");
const { buildBlocks } = require("./pipeline/blockBuilder");
const { assemble, buildStructuredAnalysis } = require("./pipeline/assembler");

const MODEL = "gpt-4.1-mini";

const REFUSAL_MESSAGE =
  "Request refused for safety reasons: the input implies a minor, ambiguous underage subject, or illegal/exploitative content. " +
  "Please provide a clearly adult, policy-safe description.";

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
    // ─── STEP A: Extract ───────────────────────────────────────────────────
    const extraction = await extract(inputText, process.env.OPENAI_API_KEY, MODEL);

    const latencyMs = Date.now() - startedAt;

    // ─── Safety refusal ───────────────────────────────────────────────────
    if (extraction.refusal) {
      return res.status(200).json({
        provider: "openai",
        model: MODEL,
        refusal: true,
        final_prompt: REFUSAL_MESSAGE,
        structured_analysis: `Request refused.\nReason: ${extraction.safety_reason || "safety policy"}`,
        extracted_attributes: [],
        auto_filled_attributes: [],
        visual_planning: null,
        character_spec: null,
        prompt_blocks: null,
        latency_ms: latencyMs,
      });
    }

    // ─── STEP B: Normalize ─────────────────────────────────────────────────
    const { spec, extractedAttrs, autoFilledAttrs } = normalize(extraction.extracted);

    // ─── STEP C: Plan ──────────────────────────────────────────────────────
    const visualPlan = plan(spec);

    // Inject camera from plan into spec so blocks can reference it
    spec.camera = { value: visualPlan.camera_preset, source: "auto" };

    // ─── STEP D: Build blocks ──────────────────────────────────────────────
    const blocks = buildBlocks(spec, visualPlan);

    // ─── STEP E: Assemble ─────────────────────────────────────────────────
    const finalPrompt = assemble(blocks);
    const structuredAnalysis = buildStructuredAnalysis(extraction, spec, visualPlan);

    // ─── Persist log ──────────────────────────────────────────────────────
    try {
      const db = await getDb();
      await db.collection("ai_logs").insertOne({
        provider: "openai",
        model: MODEL,
        type: "prompt_generation_v2",
        latency_ms: latencyMs,
        estimated_cost: 0.00002,
        created_at: new Date(),
      });
    } catch (_) {
      // Non-fatal — logging failure does not break the response
    }

    // ─── Serialize spec for display ───────────────────────────────────────
    // Remove internal fields before sending to frontend
    const specForDisplay = Object.fromEntries(
      Object.entries(spec).filter(([k]) => !k.startsWith("_"))
    );

    return res.status(200).json({
      provider: "openai",
      model: MODEL,
      refusal: false,
      structured_analysis: structuredAnalysis,
      extracted_attributes: extractedAttrs,
      auto_filled_attributes: autoFilledAttrs,
      visual_planning: visualPlan,
      character_spec: specForDisplay,
      prompt_blocks: blocks,
      final_prompt: finalPrompt,
      latency_ms: latencyMs,
    });
  } catch (err) {
    console.error("OpenAI prompt error:", err);
    return res.status(500).json({ error: "Failed to generate prompt: " + err.message });
  }
};
