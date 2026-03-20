// STEP B — Semantic Interpretation
//
// A focused second LLM call that reads the extraction JSON and maps user intent
// into reusable visual categories with per-item confidence levels.
//
// Why a second LLM call instead of hardcoded rules?
//   - Free-text requests are open-ended and language-agnostic
//   - Meaning cannot be reliably mapped to categories with phrase dictionaries
//   - The model already understands semantic implication across any language
//   - The extraction is already in English, so this step is language-independent
//
// Input:  extraction result from STEP A (English JSON)
// Output: visual intent categories with confidence — used by planner and blockBuilder

const OpenAI = require("openai");
const { INTERPRETATION_SYSTEM_PROMPT } = require("./prompt-config");

// ─── allowed category values ────────────────────────────────────────────────

const VALID = {
  regions: new Set([
    "face", "eyes", "lips", "hair", "shoulders",
    "upper_body", "waist", "hips", "legs", "feet", "full_body",
  ]),
  poses: new Set([
    "standing", "seated", "reclining", "leaning", "walking",
    "cross_legged_floor", "legs_crossed_knee", "seated_side_angle",
    "one_leg_weight_shift", "hip_accentuating", "portrait_pose", "unclear",
  ]),
  tones: new Set([
    "elegant", "sensual", "confident", "glamorous",
    "natural", "luxurious", "soft", "editorial",
  ]),
  compositions: new Set([
    "face_first", "body_first", "environment_first", "balanced",
  ]),
  clothingNeeds: new Set([
    "partial", "full_outfit", "styling_detail", "not_specified",
  ]),
  detailAreas: new Set([
    "eyes", "lips", "feet", "hands", "hair", "shoulders", "neck", "waist", "legs",
  ]),
  confidences: new Set(["high", "medium", "low"]),
};

function safeConf(c) {
  return VALID.confidences.has(c) ? c : "low";
}

// ─── JSON extraction ─────────────────────────────────────────────────────────

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

// ─── validation / normalization of model output ──────────────────────────────

function validateAndNormalize(parsed) {
  const focus_regions = (parsed.focus_regions || [])
    .filter((r) => r && VALID.regions.has(r.region))
    .map((r) => ({ region: r.region, confidence: safeConf(r.confidence) }));

  const pi = parsed.pose_intent || {};
  const pose_intent = {
    value: VALID.poses.has(pi.value) ? pi.value : "unclear",
    confidence: safeConf(pi.confidence),
  };

  const aesthetic_tone = (parsed.aesthetic_tone || [])
    .filter((t) => t && VALID.tones.has(t.tone))
    .map((t) => ({ tone: t.tone, confidence: safeConf(t.confidence) }));

  const cn = parsed.composition_need || {};
  const composition_need = {
    value: VALID.compositions.has(cn.value) ? cn.value : "balanced",
    confidence: safeConf(cn.confidence),
  };

  const cv = parsed.clothing_visibility_need || {};
  const clothing_visibility_need = {
    value: VALID.clothingNeeds.has(cv.value) ? cv.value : "not_specified",
    confidence: safeConf(cv.confidence),
  };

  const detail_focus = (parsed.detail_focus || [])
    .filter((d) => d && VALID.detailAreas.has(d.area))
    .map((d) => ({ area: d.area, confidence: safeConf(d.confidence) }));

  return {
    focus_regions: focus_regions.length > 0
      ? focus_regions
      : [{ region: "upper_body", confidence: "low" }],
    pose_intent,
    aesthetic_tone,
    composition_need,
    clothing_visibility_need,
    detail_focus,
  };
}

// ─── fallback for parse failure ──────────────────────────────────────────────

function buildFallback() {
  return {
    focus_regions: [{ region: "upper_body", confidence: "low" }],
    pose_intent: { value: "unclear", confidence: "low" },
    aesthetic_tone: [],
    composition_need: { value: "balanced", confidence: "low" },
    clothing_visibility_need: { value: "not_specified", confidence: "low" },
    detail_focus: [],
    _fallback: true,
  };
}

// ─── main interpret function ─────────────────────────────────────────────────

async function interpret(extraction, apiKey, model = "gpt-4.1-mini") {
  const client = new OpenAI({ apiKey });

  // Feed only the English extraction content — keeps this step language-agnostic.
  // The extraction already translated and structured the user's meaning.
  const inputPayload = JSON.stringify(
    {
      subject_type: extraction.subject_type,
      extracted: extraction.extracted,
    },
    null,
    2
  );

  try {
    const response = await client.responses.create({
      model,
      instructions: INTERPRETATION_SYSTEM_PROMPT,
      input: inputPayload,
    });

    const raw = (response.output_text || "").trim();
    const parsed = firstJson(raw);

    if (!parsed) {
      console.warn("[interpreter] Model did not return valid JSON — using fallback.");
      return buildFallback();
    }

    return validateAndNormalize(parsed);
  } catch (err) {
    console.warn("[interpreter] API call failed — using fallback.", err.message);
    return buildFallback();
  }
}

// ─── helper for downstream consumers ─────────────────────────────────────────

// Returns a Set of region names at or above the given minimum confidence.
function regionsAtConfidence(interpretation, minConfidence = "medium") {
  const order = { high: 2, medium: 1, low: 0 };
  const threshold = order[minConfidence] ?? 1;
  return new Set(
    (interpretation.focus_regions || [])
      .filter((r) => (order[r.confidence] ?? 0) >= threshold)
      .map((r) => r.region)
  );
}

// Returns the primary tone (highest confidence), or null.
function primaryTone(interpretation) {
  const order = { high: 2, medium: 1, low: 0 };
  const tones = [...(interpretation.aesthetic_tone || [])].sort(
    (a, b) => (order[b.confidence] ?? 0) - (order[a.confidence] ?? 0)
  );
  return tones[0]?.tone ?? null;
}

// Returns all tones at or above minConfidence.
function tonesAtConfidence(interpretation, minConfidence = "medium") {
  const order = { high: 2, medium: 1, low: 0 };
  const threshold = order[minConfidence] ?? 1;
  return new Set(
    (interpretation.aesthetic_tone || [])
      .filter((t) => (order[t.confidence] ?? 0) >= threshold)
      .map((t) => t.tone)
  );
}

// Returns a Set of detail_focus area names at or above the given minimum confidence.
function detailFociAtConfidence(interpretation, minConfidence = "medium") {
  const order = { high: 2, medium: 1, low: 0 };
  const threshold = order[minConfidence] ?? 1;
  return new Set(
    (interpretation.detail_focus || [])
      .filter((d) => (order[d.confidence] ?? 0) >= threshold)
      .map((d) => d.area)
  );
}

module.exports = {
  interpret,
  regionsAtConfidence,
  primaryTone,
  tonesAtConfidence,
  detailFociAtConfidence,
};
