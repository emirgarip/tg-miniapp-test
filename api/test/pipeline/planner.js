// STEP C — Visual Planning
// Deterministic logic only. No LLM calls.
// Decides: subject_emphasis, framing_strategy, composition_goal.
// These drive camera, framing, and composition block generation later.

function plan(spec) {
  const envType = String(spec._envType || "").toLowerCase();
  const bodyEmphasisStrength = String(spec._bodyEmphasisStrength || "medium").toLowerCase();
  const clothingVal = String(spec.clothing?.value || "").toLowerCase();
  const poseVal = String(spec.pose?.value || "").toLowerCase();

  // ─── subject emphasis ─────────────────────────────────────────────────────
  let subject_emphasis = "face-and-upper-body";

  if (bodyEmphasisStrength === "high") {
    subject_emphasis = "full-body-silhouette";
  } else if (
    poseVal.includes("standing") ||
    poseVal.includes("full") ||
    clothingVal.includes("dress") ||
    clothingVal.includes("gown")
  ) {
    subject_emphasis = "three-quarter-to-full-body";
  } else if (bodyEmphasisStrength === "low") {
    subject_emphasis = "face-and-upper-body";
  }

  // ─── framing strategy ─────────────────────────────────────────────────────
  let framing_strategy;
  let camera_preset;

  if (subject_emphasis === "full-body-silhouette") {
    framing_strategy = "full-body framing to show silhouette, proportions, and environment context";
    camera_preset =
      "full-body vertical framing, 50mm-equivalent natural perspective, moderate depth of field, sharp subject clarity with soft environmental separation";
  } else if (subject_emphasis === "three-quarter-to-full-body") {
    framing_strategy = "three-quarter body framing showing clothing, posture, and scene context";
    camera_preset =
      "three-quarter body framing, 70mm-equivalent lens feel, shallow depth of field, sharp subject with naturally receding background";
  } else {
    framing_strategy = "mid-torso portrait framing emphasizing face, expression, and upper-body details";
    camera_preset =
      "mid-torso portrait framing, 85mm portrait lens feel, shallow cinematic depth of field, sharp subject focus with smoothly blurred background";
  }

  // ─── composition goal ─────────────────────────────────────────────────────
  let composition_goal;

  const isInterior =
    envType.includes("hotel") ||
    envType.includes("room") ||
    envType.includes("interior") ||
    envType.includes("bedroom");
  const isOutdoor =
    envType.includes("beach") ||
    envType.includes("outdoor") ||
    envType.includes("city") ||
    envType.includes("street");
  const isStudio = envType.includes("studio") || envType === "";

  if (isInterior && bodyEmphasisStrength === "high") {
    composition_goal =
      "balance subject silhouette clarity with environmental room context, warm interior depth, and clear foreground/background separation";
  } else if (isOutdoor) {
    composition_goal =
      "integrate subject naturally with the outdoor environment, use horizon depth for scene context, and maintain subject clarity against the open setting";
  } else if (isStudio) {
    composition_goal =
      "clean editorial studio presentation with strong subject clarity, neutral background depth, and deliberate negative space";
  } else {
    composition_goal =
      "maintain clear subject-environment balance with coherent scene depth and natural contextual atmosphere";
  }

  return {
    subject_emphasis,
    framing_strategy,
    composition_goal,
    camera_preset,
  };
}

module.exports = { plan };
