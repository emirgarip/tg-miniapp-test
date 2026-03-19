// STEP D — Prompt Block Generation
// Builds 13 named prompt blocks from the normalized spec, visual plan, and interpretation.
// Each block uses spec values as anchors with tone-aware descriptive expansion.
// No LLM calls — structured template logic only.

const { NEGATIVE_PROMPT } = require("./prompt-config");
const { tonesAtConfidence, primaryTone } = require("./interpreter");

function v(tagged) {
  return tagged?.value ?? "";
}

// ─── tone helpers ────────────────────────────────────────────────────────────

// Returns a tone modifier set (high + medium confidence tones only).
function getTones(interpretation) {
  return tonesAtConfidence(interpretation || {}, "medium");
}

// Per-block tone-specific language modifiers.
const SUBJECT_TONE_DESC = {
  elegant: "refined editorial presence with deliberate visual elegance",
  sensual: "compelling editorial presence with controlled sensual confidence",
  glamorous: "high-fashion glamorous presence with striking visual impact",
  luxurious: "luxurious editorial presence with rich atmospheric depth",
  confident: "strong, grounded confident presence",
  soft: "gentle, approachable presence with natural warmth",
  editorial: "strong editorial presence with controlled visual authority",
  natural: "natural, grounded presence with authentic visual identity",
};

const CLOTHING_TONE_MODIFIERS = {
  elegant: "Styling shows intentional refinement — clean lines, precise fit, and deliberate detail.",
  sensual:
    "Clothing fits with tasteful, form-conscious styling — fabric drapes naturally against the body, suggesting shape without explicit emphasis.",
  glamorous:
    "Outfit reads as high-impact fashion — bold, polished, and visually commanding.",
  luxurious:
    "Fabric quality reads as premium — rich texture, deliberate drape, and material depth.",
  natural:
    "Clothing is worn in a natural, lived-in way — not overly styled or artificially posed.",
};

const ENVIRONMENT_TONE_MODIFIERS = {
  luxurious:
    "Environmental details reinforce a premium atmosphere — rich material surfaces, deliberate lighting, and curated spatial composition.",
  glamorous:
    "Scene atmosphere is elevated and polished — the environment frames the subject as the compositional centerpiece.",
  soft:
    "Ambient scene elements are gentle and non-distracting — soft tonal variation, minimal clutter, and a supportive background.",
  natural:
    "Environment feels authentic and unprepared — organic textures, natural light spill, and real environmental context.",
};

// ─── main buildBlocks function ───────────────────────────────────────────────

function buildBlocks(spec, plan, interpretation = {}) {
  const blocks = {};
  const tones = getTones(interpretation);
  const primary = primaryTone(interpretation) || "natural";
  const emphasisTargets = plan.emphasis_targets || [];
  const interpRegions = plan.interpretation_regions || [];

  // ── 1. subject ──────────────────────────────────────────────────────────────
  const toneDesc = SUBJECT_TONE_DESC[primary] || "editorial-quality presence and realistic proportions";
  blocks.subject =
    `${v(spec.gender)}, positioned in a ${plan.framing_strategy}. ` +
    `The subject presents a coherent visual identity with ${toneDesc}.`;

  // ── 2. age ──────────────────────────────────────────────────────────────────
  blocks.age =
    `Adult subject in the ${v(spec.age_range)} age range. ` +
    `Age is reflected naturally through subtle facial maturity cues — ` +
    `defined features, relaxed skin texture, and a grounded presence, without exaggeration in either direction.`;

  // ── 3. face ─────────────────────────────────────────────────────────────────
  const faceVal = v(spec.face);
  // Face emphasis from interpretation
  const faceIsPrimary =
    interpretation.composition_need?.value === "face_first" &&
    (interpretation.composition_need?.confidence === "high" ||
      interpretation.composition_need?.confidence === "medium");

  blocks.face =
    `${faceVal}. ` +
    `Skin exhibits natural pore visibility, soft tonal variation, and realistic micro-texture. ` +
    `Facial features are in harmonious proportion — defined jawline, sculpted cheekbones, ` +
    `natural lip fullness, and a nose with realistic bridge shape. ` +
    `Skin tone transitions are smooth with no synthetic uniformity.` +
    (faceIsPrimary
      ? " Face is the primary compositional anchor — eyes, expression, and facial geometry are the main visual focus."
      : "");

  // ── 4. hair ─────────────────────────────────────────────────────────────────
  const hairColor = v(spec.hair.color);
  const hairStyle = v(spec.hair.style);
  const hairIsFocus =
    interpRegions.includes("hair") ||
    [...(interpretation.focus_regions || [])].some(
      (r) => r.region === "hair" && (r.confidence === "high" || r.confidence === "medium")
    );

  blocks.hair =
    `${hairColor} hair, ${hairStyle}. ` +
    `Individual strands are visible with natural weight and movement. ` +
    `Hair texture includes realistic flyaways at the crown, strand-level light interaction with subtle specular highlights, ` +
    `and a natural finish that does not appear overly treated or digitally smoothed.` +
    (hairIsFocus ? " Hair is a key visual element — texture, color depth, and strand definition are prioritized." : "");

  // ── 5. eyes and expression ───────────────────────────────────────────────────
  const eyeColor = v(spec.eyes.color);
  const eyeDetails = v(spec.eyes.details);
  const expression = v(spec.expression);
  const eyeIsFocus = [...(interpretation.focus_regions || [])].some(
    (r) => r.region === "eyes" && (r.confidence === "high" || r.confidence === "medium")
  );

  blocks.eyes_expression =
    `${eyeColor} eyes — ${eyeDetails}. ` +
    `The iris exhibits fine detail with natural radial patterning and subtle limbal ring definition. ` +
    `Catchlights are soft and placed naturally, reflecting the ambient light source. ` +
    (eyeIsFocus ? "Eyes are a primary visual focus — gaze is sharp, iris texture is detailed, and catchlights are clearly defined. " : "") +
    `Expression: ${expression}. ` +
    `The expression is carried naturally through slight muscle tension in the brow, lips, and jaw — not stiff or artificially posed.`;

  // ── 6. body ─────────────────────────────────────────────────────────────────
  const bodyType = v(spec.body.type);
  const bodyEmphasis = v(spec.body.emphasis);

  let bodyVisibilityNote = "";
  if (emphasisTargets.includes("hips") || interpRegions.includes("hips")) {
    bodyVisibilityNote =
      "Hips and waist are the primary visual anchor — they must be clearly visible and centrally composed. " +
      "Hip-to-waist transition is rendered with natural curve and realistic weight distribution.";
  } else if (emphasisTargets.includes("legs") || interpRegions.includes("legs")) {
    bodyVisibilityNote =
      "Leg line is the primary visual element — full leg length is visible from hip to foot. " +
      "Leg shape shows natural muscle definition, realistic skin texture, and anatomically correct proportions.";
  } else if (emphasisTargets.includes("physique") || interpRegions.includes("full_body")) {
    bodyVisibilityNote =
      "The full body silhouette is the primary subject — proportions read clearly from head to toe. " +
      "Figure presents balanced natural anatomy with controlled visual weight and realistic stance.";
  } else if (emphasisTargets.includes("waist") || interpRegions.includes("waist")) {
    bodyVisibilityNote =
      "Waist definition is the compositional focus — midsection is clearly in frame with natural narrowing and realistic torso line.";
  }

  // Tone-aware body language
  let bodyToneNote = "";
  if (tones.has("sensual")) {
    bodyToneNote =
      "Body reads with controlled sensual confidence — silhouette is clearly defined, anatomy is believable, and emphasis stays within tasteful editorial limits.";
  } else if (tones.has("confident")) {
    bodyToneNote = "Posture and body language project quiet confidence — weight is balanced and stance is deliberately composed.";
  }

  blocks.body =
    `${bodyType}. ${bodyEmphasis}. ` +
    (bodyVisibilityNote ? `${bodyVisibilityNote} ` : "") +
    (bodyToneNote ? `${bodyToneNote} ` : "") +
    `Anatomy is believable and consistent. ` +
    `Silhouette reads clearly against the background with natural weight distribution and gravity-appropriate posture.`;

  // ── 7. clothing ─────────────────────────────────────────────────────────────
  const clothingVal = v(spec.clothing);
  const clothingToneNote = CLOTHING_TONE_MODIFIERS[primary] || "";

  blocks.clothing =
    `${clothingVal}. ` +
    `Fabric shows realistic material response — visible weave texture, natural drape and fold behavior, ` +
    `and appropriate fit for the body shape. ` +
    (clothingToneNote ? `${clothingToneNote} ` : "") +
    `Clothing is styled with intentional composition, supporting the overall visual impression of the subject.`;

  // ── 8. pose ─────────────────────────────────────────────────────────────────
  const poseIsUserDriven = spec.pose?.source === "user";
  const poseVal = poseIsUserDriven
    ? v(spec.pose)
    : plan.pose_suggestion || v(spec.pose);

  // Confidence note: if pose came from low-confidence interpretation, keep language broader
  const poseConfidence = interpretation.pose_intent?.confidence;
  const poseBroadenNote =
    !poseIsUserDriven && poseConfidence === "low"
      ? " Exact stance geometry is flexible — pose should feel natural and unscripted."
      : "";

  blocks.pose =
    `${poseVal}.${poseBroadenNote} ` +
    `Body language reads as natural and unforced — weight balanced, shoulder line relaxed, ` +
    `and overall posture supporting the composition goal: ${plan.composition_goal}`;

  // ── 9. environment ───────────────────────────────────────────────────────────
  const envType = v(spec.environment.type);
  const envDetails = v(spec.environment.details);
  const envToneNote = ENVIRONMENT_TONE_MODIFIERS[primary] || "";
  const envIsPrimary =
    interpretation.composition_need?.value === "environment_first" &&
    (interpretation.composition_need?.confidence === "high" ||
      interpretation.composition_need?.confidence === "medium");

  blocks.environment =
    `${envType} setting. ${envDetails}. ` +
    `The environment contributes contextual depth and atmospheric credibility. ` +
    (envIsPrimary
      ? "Environment is a primary compositional element — scene context is clearly visible and meaningfully frames the subject. "
      : "") +
    (envToneNote ? `${envToneNote} ` : "") +
    `Background elements are coherent with the lighting conditions and time-of-day mood. ` +
    `Scene-to-subject transition uses natural depth layering with deliberate foreground/background separation.`;

  // ── 10. lighting ─────────────────────────────────────────────────────────────
  const lightingVal = v(spec.lighting);
  blocks.lighting =
    `${lightingVal}. ` +
    `Light wraps the subject naturally — visible directionality with clear key-side and shadow-side contrast. ` +
    `Highlights retain detail without blowout; shadows have soft, rolling falloff with believable fill. ` +
    `Skin, hair, and fabric each respond to the light source individually, ` +
    `creating visual depth and material differentiation.`;

  // ── 11. camera and composition ───────────────────────────────────────────────
  blocks.camera =
    `${plan.camera_preset}. ` +
    `Subject is in sharp focus with clean edge definition. ` +
    `Background separation is achieved through natural depth of field, not artificial masking. ` +
    `Composition supports ${plan.subject_emphasis} visibility as the primary visual priority.`;

  // ── 12. quality and realism ──────────────────────────────────────────────────
  const styleCues = v(spec.style_cues) || "photorealistic";
  blocks.quality =
    `${styleCues} rendering with high fidelity to physical realism. ` +
    `Image exhibits: photorealistic skin texture with visible pores and natural micro-contrast, ` +
    `individual hair strand definition, fabric material accuracy, ` +
    `natural color grading with tonal nuance and high dynamic range, ` +
    `controlled cinematic clarity, and no synthetic uniformity or artificial digital smoothing.`;

  // ── 13. negative ─────────────────────────────────────────────────────────────
  blocks.negative = NEGATIVE_PROMPT;

  return blocks;
}

module.exports = { buildBlocks };
