// STEP D — Prompt Block Generation
// Builds 13 named prompt blocks from the normalized spec, visual plan, and interpretation.
// Uses spec values as anchors with tone-aware, realism-aware, detail-focus-aware expansion.
// No LLM calls — structured template logic only.

const { NEGATIVE_PROMPT } = require("./prompt-config");
const { tonesAtConfidence, primaryTone, detailFociAtConfidence } = require("./interpreter");

function v(tagged) {
  return tagged?.value ?? "";
}

// ─── tone helpers ─────────────────────────────────────────────────────────────

function getTones(interpretation) {
  return tonesAtConfidence(interpretation || {}, "medium");
}

// ─── environment default by aesthetic tone ────────────────────────────────────
// Used when environment was auto-filled (not user-specified).
// Returns { type, details } or null if no tone-specific override is needed.

function envDefaultForTone(tone) {
  switch (tone) {
    case "elegant":
    case "editorial":
      return {
        type: "soft editorial interior",
        details:
          "minimalist premium interior with clean tonal surfaces, deliberate negative space, and subtle architectural depth",
      };
    case "luxurious":
      return {
        type: "elevated interior",
        details:
          "premium hospitality-like environment with warm ambient light, rich material surfaces, refined spatial depth, and curated atmospheric detail",
      };
    case "glamorous":
      return {
        type: "polished interior",
        details:
          "elevated atmospheric setting with dynamic background depth, subtle environmental warmth, and strong subject-centered framing",
      };
    case "natural":
    case "soft":
      return {
        type: "lived-in interior",
        details:
          "warm, softly lit neutral interior with organic textures, gentle light spill, natural environmental context, and minimal stylization",
      };
    case "sensual":
    case "confident":
      return {
        type: "softly lit interior",
        details:
          "warm atmospheric interior setting with deliberate depth, subtle practical light sources, and a naturally toned background that supports the subject",
      };
    default:
      return null;
  }
}

// ─── tone-specific block language ─────────────────────────────────────────────

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
  elegant:
    "Styling shows intentional refinement — clean lines, precise fit, and deliberate detail.",
  sensual:
    "Clothing fits with tasteful, form-conscious styling — fabric drapes naturally against the body, suggesting shape without explicit emphasis.",
  glamorous:
    "Outfit reads as high-impact fashion — bold, polished, and visually commanding.",
  luxurious:
    "Fabric quality reads as premium — rich texture, deliberate drape, and material depth that communicates care and quality.",
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
  editorial:
    "Environment is spare and controlled — deliberate negative space that keeps visual focus entirely on the subject.",
};

// ─── main buildBlocks function ────────────────────────────────────────────────

function buildBlocks(spec, plan, interpretation = {}) {
  const blocks = {};
  const tones = getTones(interpretation);
  const primary = primaryTone(interpretation) || "natural";
  const emphasisTargets = plan.emphasis_targets || [];
  const interpRegions = plan.interpretation_regions || [];
  const detailFoci = detailFociAtConfidence(interpretation, "medium");
  const poseConfidence = interpretation.pose_intent?.confidence;
  const poseIntentValue = interpretation.pose_intent?.value || "unclear";

  // ── 1. subject ───────────────────────────────────────────────────────────────
  const toneDesc =
    SUBJECT_TONE_DESC[primary] || "editorial-quality presence and realistic proportions";
  blocks.subject =
    `${v(spec.gender)}, positioned in a ${plan.framing_strategy}. ` +
    `The subject presents a coherent visual identity with ${toneDesc}.`;

  // ── 2. age ───────────────────────────────────────────────────────────────────
  blocks.age =
    `Adult subject in the ${v(spec.age_range)} age range. ` +
    `Age is reflected naturally through subtle facial maturity cues — ` +
    `defined features, relaxed skin texture, and a grounded presence, without exaggeration in either direction.`;

  // ── 3. face ──────────────────────────────────────────────────────────────────
  const faceVal = v(spec.face);
  const faceIsPrimary =
    interpretation.composition_need?.value === "face_first" &&
    (interpretation.composition_need?.confidence === "high" ||
      interpretation.composition_need?.confidence === "medium");
  const lipsAreFocus = detailFoci.has("lips");
  const neckAreFocus = detailFoci.has("neck");

  blocks.face =
    `${faceVal}. ` +
    // Realism: avoid synthetic perfection by adding natural micro-variation
    `Skin exhibits natural pore visibility, soft tonal micro-variation, and realistic surface texture — ` +
    `subtle natural irregularity in skin tone and fine surface detail that prevents the synthetic uniformity typical of AI-generated images. ` +
    `Facial features carry slight natural asymmetry — one side reads marginally different from the other in a realistic, human way. ` +
    `Feature harmony: defined jawline, sculpted cheekbones, natural lip fullness, and a nose with realistic bridge shape and slight tonal variation. ` +
    `Skin tone transitions are gradual and believable — no sharp tonal edges or unnaturally even coverage.` +
    (lipsAreFocus
      ? " Lips are a detail focus — lip line is well-defined with natural fullness, slight tonal differentiation between upper and lower lip, and realistic surface texture."
      : "") +
    (neckAreFocus
      ? " Neck line is a secondary focus — graceful neck length and natural muscle definition with realistic skin detail."
      : "") +
    (faceIsPrimary
      ? " Face is the primary compositional anchor — eyes, expression, and facial geometry are the main visual focus."
      : "");

  // ── 4. hair ──────────────────────────────────────────────────────────────────
  const hairColor = v(spec.hair.color);
  const hairStyle = v(spec.hair.style);
  const hairIsFocus =
    detailFoci.has("hair") ||
    interpRegions.includes("hair") ||
    [...(interpretation.focus_regions || [])].some(
      (r) => r.region === "hair" && (r.confidence === "high" || r.confidence === "medium")
    );

  blocks.hair =
    `${hairColor} hair, ${hairStyle}. ` +
    `Individual strands are visible with natural weight, movement, and slight directional variation. ` +
    `Hair texture includes realistic flyaways at the crown and temples, strand-level light interaction with subtle specular highlights, ` +
    `and a natural finish with visible irregularities — not overly treated, smoothed, or digitally perfected.` +
    (hairIsFocus
      ? " Hair is a key visual element — color depth, strand definition, light response, and texture detail are all prioritized."
      : "");

  // ── 5. eyes and expression ────────────────────────────────────────────────────
  const eyeColor = v(spec.eyes.color);
  const eyeDetails = v(spec.eyes.details);
  const eyeDetailsIsUser = spec.eyes.details?.source === "user";
  const expression = v(spec.expression);
  const eyeIsFocus =
    detailFoci.has("eyes") ||
    [...(interpretation.focus_regions || [])].some(
      (r) => r.region === "eyes" && (r.confidence === "high" || r.confidence === "medium")
    );

  // Preserve specific eye shape language precisely — do not flatten into generic "almond-shaped".
  const eyeShapeNote = eyeDetailsIsUser
    ? `Eye shape: ${eyeDetails} — preserve this specific geometry precisely without flattening into a generic eye shape.`
    : `${eyeDetails}.`;

  blocks.eyes_expression =
    `${eyeColor} eyes. ${eyeShapeNote} ` +
    // Realism: natural iris detail, not artificially enhanced
    `The iris exhibits fine realistic detail with natural radial patterning, subtle limbal ring definition, and slight color variation within the iris itself. ` +
    `Catchlights are soft, small, and placed naturally — reflecting the ambient light source without looking artificial. ` +
    (eyeIsFocus
      ? "Eyes are a primary visual focus — gaze direction, iris texture, and natural reflective depth are all prioritized. "
      : "") +
    `Expression: ${expression}. ` +
    `The expression is carried through subtle muscle engagement in the brow, periorbital area, lips, and jaw — ` +
    `reading as natural and unforced rather than stiff or artificially posed.`;

  // ── 6. body ──────────────────────────────────────────────────────────────────
  const bodyType = v(spec.body.type);
  const bodyEmphasis = v(spec.body.emphasis);

  let bodyVisibilityNote = "";
  if (emphasisTargets.includes("hips") || interpRegions.includes("hips")) {
    bodyVisibilityNote =
      "Hips and waist are the primary visual anchor — they must be clearly visible and centrally composed. " +
      "Hip-to-waist transition is rendered with natural curve and realistic weight distribution. " +
      "Avoid exaggerated proportions — keep the emphasis believable and anatomically coherent.";
  } else if (emphasisTargets.includes("legs") || interpRegions.includes("legs")) {
    bodyVisibilityNote =
      "Leg line is the primary visual element — full leg length is visible from hip to foot. " +
      "Leg shape shows natural muscle definition, realistic skin texture with visible micro-detail, and anatomically correct proportions.";
  } else if (emphasisTargets.includes("physique") || interpRegions.includes("full_body")) {
    bodyVisibilityNote =
      "The full body silhouette is the primary subject — proportions read clearly from head to toe. " +
      "Figure presents balanced natural anatomy with controlled visual weight and realistic stance.";
  } else if (emphasisTargets.includes("waist") || interpRegions.includes("waist")) {
    bodyVisibilityNote =
      "Waist definition is the compositional focus — midsection is clearly in frame with natural narrowing and realistic torso line.";
  }

  let bodyToneNote = "";
  if (tones.has("sensual")) {
    bodyToneNote =
      "Body reads with controlled sensual confidence — silhouette is clearly defined, anatomy is believable, and emphasis stays within tasteful editorial limits.";
  } else if (tones.has("confident")) {
    bodyToneNote =
      "Posture and body language project quiet confidence — weight is balanced and stance is deliberately composed.";
  }

  // detail_focus: shoulders or neck secondary notes
  const shoulderNote = detailFoci.has("shoulders")
    ? " Shoulders are a secondary detail focus — shoulder line is visible, open, and naturally defined."
    : "";

  blocks.body =
    `${bodyType}. ${bodyEmphasis}. ` +
    (bodyVisibilityNote ? `${bodyVisibilityNote} ` : "") +
    (bodyToneNote ? `${bodyToneNote} ` : "") +
    `Anatomy is believable and consistent — gravity-appropriate weight distribution, realistic joint positions, and natural silhouette. ` +
    `Silhouette reads clearly against the background without exaggeration.` +
    shoulderNote;

  // ── 7. clothing ───────────────────────────────────────────────────────────────
  const clothingVal = v(spec.clothing);
  const clothingToneNote = CLOTHING_TONE_MODIFIERS[primary] || "";

  blocks.clothing =
    `${clothingVal}. ` +
    `Fabric shows realistic material response — visible weave texture or surface structure, natural drape and fold behavior under gravity, ` +
    `and appropriate fit for the body shape. ` +
    (clothingToneNote ? `${clothingToneNote} ` : "") +
    `Clothing is styled with intentional composition, supporting the overall visual impression of the subject.`;

  // ── 8. pose ───────────────────────────────────────────────────────────────────
  const poseIsUserDriven = spec.pose?.source === "user";
  const poseVal = poseIsUserDriven ? v(spec.pose) : plan.pose_suggestion || v(spec.pose);

  // Broaden language only for low-confidence poses; preserve exactly for high-confidence.
  const poseBroadenNote =
    !poseIsUserDriven && poseConfidence === "low"
      ? " Exact stance geometry is flexible — pose should feel natural, unscripted, and unstaged."
      : "";

  // detail_focus: feet/hands secondary notes in pose block
  const feetNote = detailFoci.has("feet")
    ? " Feet are a secondary aesthetic focus — foot line, natural arch, and toe placement should be visible and aesthetically presented. Pose supports natural foot visibility without forced or unnatural positioning."
    : "";
  const handsNote = detailFoci.has("hands")
    ? " Hands are a secondary detail focus — hand placement is deliberate and natural, with realistic finger position, natural relaxation, and visible hand detail."
    : "";

  blocks.pose =
    `${poseVal}.${poseBroadenNote} ` +
    `Body language reads as natural and unforced — weight balanced, shoulder line relaxed, ` +
    `and overall posture supporting the composition goal: ${plan.composition_goal}` +
    feetNote +
    handsNote;

  // ── 9. environment ────────────────────────────────────────────────────────────
  const envTypeIsAuto = spec.environment.type?.source === "auto";
  const envDetailsIsAuto = spec.environment.details?.source === "auto";

  let envType = v(spec.environment.type);
  let envDetails = v(spec.environment.details);

  // If environment was entirely auto-filled, use tone-aware defaults instead of generic studio.
  if (envTypeIsAuto && envDetailsIsAuto) {
    const toneEnv = envDefaultForTone(primary);
    if (toneEnv) {
      envType = toneEnv.type;
      envDetails = toneEnv.details;
    }
  }

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
    `Background elements are coherent with the lighting conditions and overall mood. ` +
    `Scene-to-subject transition uses natural depth layering with deliberate foreground/background separation.`;

  // ── 10. lighting ──────────────────────────────────────────────────────────────
  const lightingVal = v(spec.lighting);
  blocks.lighting =
    `${lightingVal}. ` +
    `Light wraps the subject naturally — visible directionality with clear key-side and shadow-side contrast. ` +
    `Highlights retain surface detail without blowout; shadows have soft, rolling falloff with believable fill light. ` +
    // Realism: micro-shadow variation and three-dimensionality
    `Light creates subtle shadow micro-variation across the skin surface — slight depth beneath the nose, soft under-eye shadow, ` +
    `gentle contour shading that adds three-dimensional realism without harsh contrast. ` +
    `Skin, hair, and fabric each respond to the light source individually, creating visual depth and material differentiation.`;

  // ── 11. camera and composition ────────────────────────────────────────────────
  const feetNeedVisibility = detailFoci.has("feet") || interpRegions.includes("feet");
  blocks.camera =
    `${plan.camera_preset}. ` +
    `Subject is in sharp focus with clean edge definition. ` +
    `Background separation is achieved through natural depth of field, not artificial masking. ` +
    `Composition supports ${plan.subject_emphasis} visibility as the primary visual priority.` +
    (feetNeedVisibility
      ? " Frame includes feet in the composition — foot and lower leg area is visible and aesthetically presented."
      : "");

  // ── 12. quality and realism ───────────────────────────────────────────────────
  const styleCues = v(spec.style_cues) || "photorealistic";
  blocks.quality =
    `${styleCues} rendering with high fidelity to physical realism. ` +
    `Image exhibits: photorealistic skin texture with visible pores and natural micro-contrast, ` +
    `individual hair strand definition with natural irregularities, fabric material accuracy with realistic drape, ` +
    `natural color grading with tonal nuance and high dynamic range, ` +
    `controlled cinematic clarity with no synthetic uniformity or artificial digital smoothing. ` +
    // Realism layer: global anti-AI guidance
    `Realism markers: subtle natural asymmetry in facial features, slight micro-variation in skin tone and surface texture, ` +
    `natural imperfection in lip line and skin surface detail, realistic hair movement irregularities, ` +
    `and believable material response across all surfaces. ` +
    `Avoid plastic skin, AI over-smoothing, or any synthetic perfection that breaks photographic believability.`;

  // ── 13. negative ──────────────────────────────────────────────────────────────
  blocks.negative = NEGATIVE_PROMPT;

  return blocks;
}

module.exports = { buildBlocks };
