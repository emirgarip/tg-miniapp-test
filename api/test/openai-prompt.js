// Orchestrates the full block-based prompt generation pipeline.
//
// Steps:
//   A. extract()    — LLM #1: extract explicit attributes from user input
//   B. interpret()  — LLM #2: map extraction to visual intent categories + confidence
//      normalize()  — sync: fill defaults, track source (runs while interpret awaits)
//   C. plan()       — sync: choose framing, pose, composition from spec + interpretation
//   D. buildBlocks()— sync: generate 13 named prompt blocks
//   E. assemble()   — sync: join blocks in fixed order

const { getDb } = require("../../backend/db/mongo");
const { extract } = require("../../backend/pipeline/extractor");
const { interpret } = require("../../backend/pipeline/interpreter");
const { normalize } = require("../../backend/pipeline/normalizer");
const { plan } = require("../../backend/pipeline/planner");
const { buildBlocks } = require("../../backend/pipeline/blockBuilder");
const { assemble, buildStructuredAnalysis, buildInterpretationSummary } = require("../../backend/pipeline/assembler");

const MODEL = "gpt-4.1-mini";

const REFUSAL_MESSAGE =
  "Request refused for safety reasons: the input implies a minor, ambiguous underage subject, " +
  "or illegal/exploitative content. Please provide a clearly adult, policy-safe description.";

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
    // ─── STEP A: Extract ─────────────────────────────────────────────────────
    const extraction = await extract(inputText, process.env.OPENAI_API_KEY, MODEL);

    if (extraction.refusal) {
      return res.status(200).json({
        provider: "openai",
        model: MODEL,
        refusal: true,
        final_prompt: REFUSAL_MESSAGE,
        structured_analysis: `Request refused.\nReason: ${extraction.safety_reason || "safety policy"}`,
        semantic_interpretation: null,
        extracted_attributes: [],
        auto_filled_attributes: [],
        visual_planning: null,
        character_spec: null,
        prompt_blocks: null,
        latency_ms: Date.now() - startedAt,
      });
    }

    // ─── STEP B: Interpret + Normalize in parallel ────────────────────────────
    // normalize() is synchronous (instant). interpret() is an async LLM call.
    // Start interpret first, then normalize while awaiting the API response.
    const interpretPromise = interpret(extraction, process.env.OPENAI_API_KEY, MODEL);
    const { spec, extractedAttrs, autoFilledAttrs } = normalize(extraction.extracted);
    const interpretation = await interpretPromise;

    // ─── STEP C: Plan ────────────────────────────────────────────────────────
    const visualPlan = plan(spec, interpretation);

    // Inject camera from plan into spec so blocks can reference it
    spec.camera = { value: visualPlan.camera_preset, source: "auto" };

    // ─── STEP D: Build blocks ─────────────────────────────────────────────────
    const blocks = buildBlocks(spec, visualPlan, interpretation);

    // ─── STEP E: Assemble ─────────────────────────────────────────────────────
    const finalPrompt = assemble(blocks);
    const structuredAnalysis = buildStructuredAnalysis(extraction, spec, visualPlan);
    const interpretationSummary = buildInterpretationSummary(interpretation);

    const latencyMs = Date.now() - startedAt;

    // ─── Persist log (non-fatal) ──────────────────────────────────────────────
    try {
      const db = await getDb();
      await db.collection("ai_logs").insertOne({
        provider: "openai",
        model: MODEL,
        type: "prompt_generation_v3",
        latency_ms: latencyMs,
        estimated_cost: 0.00004, // two LLM calls
        created_at: new Date(),
      });
    } catch (_) {}

    // Strip internal planner signals before sending spec to frontend
    const specForDisplay = Object.fromEntries(
      Object.entries(spec).filter(([k]) => !k.startsWith("_"))
    );

    return res.status(200).json({
      provider: "openai",
      model: MODEL,
      refusal: false,
      structured_analysis: structuredAnalysis,
      semantic_interpretation: interpretationSummary,
      semantic_interpretation_raw: interpretation,
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
