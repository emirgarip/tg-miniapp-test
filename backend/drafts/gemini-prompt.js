// ============================================================
// DRAFT — Gemini version of the prompt generation endpoint
// ============================================================
//
// STATUS: Not active. Stored here to avoid counting as a
//         Vercel serverless function.
//
// TO ACTIVATE:
//   1. npm install @google/genai
//   2. Add GEMINI_API_KEY to Vercel environment variables
//   3. Copy this file to: api/test/gemini-prompt.js
//   4. Done — it shares all pipeline modules with openai-prompt.js
//
// DIFFERENCES vs openai-prompt.js:
//   - Uses @google/genai (GoogleGenAI) instead of openai SDK
//   - Model: gemini-2.5-flash for both extraction and interpretation
//   - System prompt is prepended to user message (Gemini doesn't have
//     a separate "instructions" field like OpenAI responses.create)
//   - ai_logs.type = "prompt_generation_gemini"
// ============================================================

const { getDb } = require("../db/mongo");
const { normalize } = require("../pipeline/normalizer");
const { plan } = require("../pipeline/planner");
const { buildBlocks } = require("../pipeline/blockBuilder");
const { assemble, buildStructuredAnalysis, buildInterpretationSummary } = require("../pipeline/assembler");
const {
  EXTRACTION_SYSTEM_PROMPT,
  INTERPRETATION_SYSTEM_PROMPT,
} = require("../pipeline/prompt-config");

// Change these paths when moving to api/test/gemini-prompt.js:
//   require("../db/mongo")          → require("../../backend/db/mongo")
//   require("../pipeline/...")      → require("../../backend/pipeline/...")

const MODEL = "gemini-2.5-flash";

const REFUSAL_MESSAGE =
  "Request refused for safety reasons: the input implies a minor, ambiguous underage subject, " +
  "or illegal/exploitative content. Please provide a clearly adult, policy-safe description.";

// ─── Gemini helper ───────────────────────────────────────────────────────────

function firstJson(text) {
  const s = String(text || "");
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch (_) {
    return null;
  }
}

// Gemini doesn't have a separate system-instruction field in the
// Developer API (without Vertex). Prepend system prompt to user input.
async function geminiGenerate(ai, systemPrompt, userInput) {
  const resp = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [{ text: `${systemPrompt}\n\n${userInput}` }],
      },
    ],
  });
  return (resp.text || "").trim();
}

// ─── Extraction (STEP A) ──────────────────────────────────────────────────────

async function geminiExtract(ai, inputText) {
  const raw = await geminiGenerate(ai, EXTRACTION_SYSTEM_PROMPT, inputText);
  const parsed = firstJson(raw);

  if (!parsed) {
    throw new Error(
      `Gemini extraction failed: model did not return valid JSON. Raw: ${raw.slice(0, 200)}`
    );
  }

  const refusal =
    !!parsed.refusal ||
    !!parsed?.safety_flags?.minor_or_ambiguous_underage ||
    !!parsed?.safety_flags?.illegal_or_exploitative;

  return {
    input_language: parsed.input_language || "unknown",
    subject_type: parsed.subject_type || "portrait subject",
    refusal,
    safety_reason: parsed.safety_reason || null,
    safety_flags: parsed.safety_flags || {},
    extracted: parsed.extracted || {},
  };
}

// ─── Interpretation (STEP B) ──────────────────────────────────────────────────

const VALID_REGIONS = new Set([
  "face","eyes","lips","hair","shoulders","upper_body","waist","hips","legs","feet","full_body",
]);
const VALID_POSES = new Set([
  "standing","seated","reclining","leaning","walking","crossed_legs_seated",
  "one_leg_weight_shift","hip_accentuating","portrait_pose","unclear",
]);
const VALID_TONES = new Set([
  "elegant","sensual","confident","glamorous","natural","luxurious","soft","editorial",
]);
const VALID_COMP = new Set(["face_first","body_first","environment_first","balanced"]);
const VALID_CLOTHING = new Set(["partial","full_outfit","styling_detail","not_specified"]);
const VALID_CONF = new Set(["high","medium","low"]);

function safeConf(c) {
  return VALID_CONF.has(c) ? c : "low";
}

async function geminiInterpret(ai, extraction) {
  const inputPayload = JSON.stringify(
    { subject_type: extraction.subject_type, extracted: extraction.extracted },
    null,
    2
  );

  const raw = await geminiGenerate(ai, INTERPRETATION_SYSTEM_PROMPT, inputPayload);
  const parsed = firstJson(raw);

  if (!parsed) {
    return {
      focus_regions: [{ region: "upper_body", confidence: "low" }],
      pose_intent: { value: "unclear", confidence: "low" },
      aesthetic_tone: [],
      composition_need: { value: "balanced", confidence: "low" },
      clothing_visibility_need: { value: "not_specified", confidence: "low" },
      _fallback: true,
    };
  }

  const focus_regions = (parsed.focus_regions || [])
    .filter((r) => r && VALID_REGIONS.has(r.region))
    .map((r) => ({ region: r.region, confidence: safeConf(r.confidence) }));

  const pi = parsed.pose_intent || {};
  const aesthetic_tone = (parsed.aesthetic_tone || [])
    .filter((t) => t && VALID_TONES.has(t.tone))
    .map((t) => ({ tone: t.tone, confidence: safeConf(t.confidence) }));
  const cn = parsed.composition_need || {};
  const cv = parsed.clothing_visibility_need || {};

  return {
    focus_regions: focus_regions.length > 0 ? focus_regions : [{ region: "upper_body", confidence: "low" }],
    pose_intent: { value: VALID_POSES.has(pi.value) ? pi.value : "unclear", confidence: safeConf(pi.confidence) },
    aesthetic_tone,
    composition_need: { value: VALID_COMP.has(cn.value) ? cn.value : "balanced", confidence: safeConf(cn.confidence) },
    clothing_visibility_need: { value: VALID_CLOTHING.has(cv.value) ? cv.value : "not_specified", confidence: safeConf(cv.confidence) },
  };
}

// ─── Route handler ────────────────────────────────────────────────────────────

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not configured." });
  }

  const inputText = String(req.body?.input || "").trim();
  if (inputText.length < 20) {
    return res.status(400).json({ error: "Please enter at least 20 characters." });
  }

  const startedAt = Date.now();

  try {
    // Lazy require — package must be installed first
    const { GoogleGenAI } = require("@google/genai");
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // STEP A: Extract
    const extraction = await geminiExtract(ai, inputText);

    if (extraction.refusal) {
      return res.status(200).json({
        provider: "gemini",
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

    // STEP B: Interpret + Normalize (normalize is sync, runs while interpret awaits)
    const interpretPromise = geminiInterpret(ai, extraction);
    const { spec, extractedAttrs, autoFilledAttrs } = normalize(extraction.extracted);
    const interpretation = await interpretPromise;

    // STEP C: Plan
    const visualPlan = plan(spec, interpretation);
    spec.camera = { value: visualPlan.camera_preset, source: "auto" };

    // STEP D: Build blocks
    const blocks = buildBlocks(spec, visualPlan, interpretation);

    // STEP E: Assemble
    const finalPrompt = assemble(blocks);
    const structuredAnalysis = buildStructuredAnalysis(extraction, spec, visualPlan);
    const interpretationSummary = buildInterpretationSummary(interpretation);

    const latencyMs = Date.now() - startedAt;

    try {
      const db = await getDb();
      await db.collection("ai_logs").insertOne({
        provider: "gemini",
        model: MODEL,
        type: "prompt_generation_gemini",
        latency_ms: latencyMs,
        estimated_cost: 0,
        created_at: new Date(),
      });
    } catch (_) {}

    const specForDisplay = Object.fromEntries(
      Object.entries(spec).filter(([k]) => !k.startsWith("_"))
    );

    return res.status(200).json({
      provider: "gemini",
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
    console.error("Gemini prompt error:", err);
    return res.status(500).json({ error: "Failed to generate prompt: " + err.message });
  }
};
