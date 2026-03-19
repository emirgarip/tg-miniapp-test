// STEP D — Prompt Block Generation
// Builds named blocks from the normalized spec and visual planning outputs.
// Each block uses spec values as anchors with strong descriptive expansion.
// No free-form LLM call here — everything is structured template logic.

const { NEGATIVE_PROMPT } = require("../prompt-config");

function v(tagged) {
  return tagged?.value ?? "";
}

function buildBlocks(spec, plan) {
  const blocks = {};

  // ── 1. subject ─────────────────────────────────────────────────────────────
  blocks.subject =
    `${v(spec.gender)}, positioned in a ${plan.framing_strategy}. ` +
    `The subject presents a coherent visual identity with editorial-quality presence and realistic proportions.`;

  // ── 2. age ─────────────────────────────────────────────────────────────────
  blocks.age =
    `Adult subject in the ${v(spec.age_range)} age range. ` +
    `Age is reflected naturally through subtle facial maturity cues — ` +
    `defined features, relaxed skin texture, and a grounded presence, without exaggeration in either direction.`;

  // ── 3. face ─────────────────────────────────────────────────────────────────
  const faceVal = v(spec.face);
  blocks.face =
    `${faceVal}. ` +
    `Skin exhibits natural pore visibility, soft tonal variation, and realistic micro-texture. ` +
    `Facial features are in harmonious proportion — defined jawline, sculpted cheekbones, ` +
    `natural lip fullness, and a nose with realistic bridge shape. ` +
    `Skin tone transitions are smooth with no synthetic uniformity.`;

  // ── 4. hair ─────────────────────────────────────────────────────────────────
  const hairColor = v(spec.hair.color);
  const hairStyle = v(spec.hair.style);
  blocks.hair =
    `${hairColor} hair, ${hairStyle}. ` +
    `Individual strands are visible with natural weight and movement. ` +
    `Hair texture includes realistic flyaways at the crown, strand-level light interaction with subtle specular highlights, ` +
    `and a natural finish that does not appear overly treated or digitally smoothed.`;

  // ── 5. eyes and expression ──────────────────────────────────────────────────
  const eyeColor = v(spec.eyes.color);
  const eyeDetails = v(spec.eyes.details);
  const expression = v(spec.expression);
  blocks.eyes_expression =
    `${eyeColor} eyes — ${eyeDetails}. ` +
    `The iris exhibits fine detail with natural radial patterning and subtle limbal ring definition. ` +
    `Catchlights are soft and placed naturally, reflecting the ambient light source. ` +
    `Expression: ${expression}. ` +
    `The expression is carried naturally through slight muscle tension in the brow, ` +
    `lips, and jaw — not stiff or artificially posed.`;

  // ── 6. body ─────────────────────────────────────────────────────────────────
  const bodyType = v(spec.body.type);
  const bodyEmphasis = v(spec.body.emphasis);
  blocks.body =
    `${bodyType}. ${bodyEmphasis}. ` +
    `Anatomy is believable and consistent — no exaggerated proportions unless explicitly intended. ` +
    `Silhouette reads clearly against the background with natural weight distribution and gravity-appropriate posture.`;

  // ── 7. clothing ─────────────────────────────────────────────────────────────
  const clothingVal = v(spec.clothing);
  blocks.clothing =
    `${clothingVal}. ` +
    `Fabric shows realistic material response — visible weave texture, natural drape and fold behavior, ` +
    `and appropriate fit for the body shape. ` +
    `Clothing is styled with intentional composition, supporting the overall visual impression of the subject.`;

  // ── 8. pose ─────────────────────────────────────────────────────────────────
  const poseVal = v(spec.pose);
  blocks.pose =
    `${poseVal}. ` +
    `Body language reads as natural and unforced — weight balanced, ` +
    `shoulder line relaxed, and overall posture contributing to the visual composition goal: ${plan.composition_goal}.`;

  // ── 9. environment ──────────────────────────────────────────────────────────
  const envType = v(spec.environment.type);
  const envDetails = v(spec.environment.details);
  blocks.environment =
    `${envType} setting. ${envDetails}. ` +
    `The environment contributes contextual depth and atmospheric credibility. ` +
    `Background elements are coherent with the lighting conditions and time-of-day mood. ` +
    `Scene-to-subject transition uses natural depth layering with deliberate foreground/background separation.`;

  // ── 10. lighting ───────────────────────────────────────────────────────────
  const lightingVal = v(spec.lighting);
  blocks.lighting =
    `${lightingVal}. ` +
    `Light wraps the subject naturally — visible directionality with clear key-side and shadow-side contrast. ` +
    `Highlights retain detail without blowout; shadows have soft, rolling falloff with believable fill. ` +
    `Skin, hair, and fabric each respond to the light source individually, creating visual depth and material differentiation.`;

  // ── 11. camera and composition ──────────────────────────────────────────────
  blocks.camera =
    `${plan.camera_preset}. ` +
    `Subject is in sharp focus with clean edge definition. ` +
    `Background separation is achieved through natural depth of field, not artificial masking. ` +
    `Composition supports ${plan.subject_emphasis} visibility as the primary visual priority.`;

  // ── 12. quality and realism ─────────────────────────────────────────────────
  const styleCues = v(spec.style_cues) || "photorealistic";
  blocks.quality =
    `${styleCues} rendering with high fidelity to physical realism. ` +
    `Image exhibits: photorealistic skin texture with visible pores and natural micro-contrast, ` +
    `individual hair strand definition, fabric material accuracy, ` +
    `natural color grading with tonal nuance and high dynamic range, ` +
    `controlled cinematic clarity, and no synthetic uniformity or artificial digital smoothing.`;

  // ── 13. negative ───────────────────────────────────────────────────────────
  blocks.negative = NEGATIVE_PROMPT;

  return blocks;
}

module.exports = { buildBlocks };
