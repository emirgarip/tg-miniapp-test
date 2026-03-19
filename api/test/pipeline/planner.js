// STEP C — Visual Planning
// Deterministic logic only. No LLM calls.
//
// Priority order for framing decisions:
//   1. User-specified body area emphasis (hips, legs, physique) — HIGHEST PRIORITY
//   2. Clothing that requires full visibility (bikini, dress, etc.)
//   3. Body emphasis strength (high = full-body)
//   4. Pose signals (standing, full-body)
//   5. Default: face-and-upper-body
//
// This ensures user intent drives framing, not model defaults.

// ─── framing presets ─────────────────────────────────────────────────────────

const FRAMING = {
  portrait: {
    label: "face-and-upper-body",
    strategy: "mid-torso portrait framing emphasizing face, expression, and upper-body details",
    camera:
      "mid-torso portrait framing, 85mm portrait lens feel, shallow cinematic depth of field, sharp subject focus with smoothly blurred background",
  },
  threeQuarter: {
    label: "three-quarter-body",
    strategy: "three-quarter body framing to show posture, hips, waist line, and upper legs alongside scene context",
    camera:
      "three-quarter body framing, 70mm-equivalent lens feel, shallow depth of field, sharp subject with naturally receding background",
  },
  fullBody: {
    label: "full-body",
    strategy: "full-body framing to show the complete silhouette, leg line, proportions, and environmental context",
    camera:
      "full-body vertical framing, 50mm-equivalent natural perspective, moderate depth of field, sharp subject clarity with soft environmental separation",
  },
};

// ─── pose suggestions keyed by emphasis target ───────────────────────────────

const POSE_BY_TARGET = {
  hips:
    "slight three-quarter body turn with one hip angled toward the camera, weight shifted to one leg, relaxed shoulder line — reveals hip line and waist definition clearly",
  legs:
    "full standing pose with clean leg separation, one knee slightly forward, relaxed arms — shows leg length, structure, and natural stance",
  physique:
    "confident upright full-body stance with shoulders relaxed and natural weight distribution — presents complete silhouette and proportions",
  waist:
    "three-quarter turn with torso slightly angled, arms relaxed at sides or one hand near hip — emphasizes waist definition and body line",
  chest:
    "upright forward-facing pose with natural shoulder relaxation and slight chest openness — shows upper body clearly without forced stance",
  shoulders:
    "upright posture with open shoulder line, slight turn away from camera — emphasizes shoulder width and upper body frame",
};

// ─── composition goal builders ───────────────────────────────────────────────

function buildCompositionGoal(framing, targets, envType, needsClothing) {
  const t = String(envType || "").toLowerCase();
  const isInterior = t.includes("hotel") || t.includes("room") || t.includes("interior") || t.includes("bedroom");
  const isOutdoor = t.includes("beach") || t.includes("outdoor") || t.includes("city") || t.includes("street");
  const isStudio = t.includes("studio") || t === "";

  const visibilityReqs = [];
  if (targets.has("hips")) visibilityReqs.push("hips and waist line clearly visible and not cropped");
  if (targets.has("legs")) visibilityReqs.push("full leg length visible from hip to foot without cropping");
  if (targets.has("physique")) visibilityReqs.push("complete body silhouette visible");
  if (targets.has("waist")) visibilityReqs.push("waist and midsection clearly visible");
  if (targets.has("chest")) visibilityReqs.push("upper body and chest area clearly in frame");
  if (needsClothing) visibilityReqs.push("full clothing item visible without cropping");

  let envContext;
  if (isInterior) {
    envContext = "integrate warm interior depth and room context as background atmosphere";
  } else if (isOutdoor) {
    envContext = "integrate natural outdoor environment with horizon depth as scene context";
  } else {
    envContext = "clean editorial presentation with neutral background depth and deliberate negative space";
  }

  if (visibilityReqs.length > 0) {
    return `Ensure ${visibilityReqs.join("; ")}. ${envContext}.`;
  }

  if (isStudio) {
    return "Clean editorial studio presentation with strong subject clarity, neutral background depth, and deliberate negative space.";
  }
  return `Maintain clear subject-environment balance with coherent scene depth. ${envContext}.`;
}

// ─── main plan function ──────────────────────────────────────────────────────

function plan(spec) {
  const targets = spec._emphasisTargets || new Set();
  const isUserEmphasis = !!spec._bodyEmphasisIsUserDriven;
  const emphasisStrength = String(spec._bodyEmphasisStrength || "medium").toLowerCase();
  const needsClothing = !!spec._needsFullClothingVisibility;
  const clothingVal = String(spec.clothing?.value || "").toLowerCase();
  const poseVal = String(spec.pose?.value || "").toLowerCase();
  const envType = spec._envType || "";

  // ─── STEP 1: Pick framing (priority order) ─────────────────────────────────

  let chosenFraming;
  let framingReason;

  const hasLowerBodyTarget = targets.has("hips") || targets.has("legs") || targets.has("physique") || targets.has("waist");

  if (isUserEmphasis && (targets.has("legs") || targets.has("physique"))) {
    // Legs or full physique requested by user → full body required
    chosenFraming = FRAMING.fullBody;
    framingReason = `user emphasized ${[...targets].filter(t => ["legs","physique"].includes(t)).join(", ")}`;
  } else if (isUserEmphasis && targets.has("hips")) {
    // Hips requested by user → three-quarter minimum; full if also legs
    chosenFraming = FRAMING.threeQuarter;
    framingReason = "user emphasized hips";
  } else if (isUserEmphasis && targets.has("waist")) {
    chosenFraming = FRAMING.threeQuarter;
    framingReason = "user emphasized waist";
  } else if (needsClothing) {
    // Clothing type requires full visibility (dress, bikini, etc.)
    chosenFraming = clothingVal.includes("bikini") || clothingVal.includes("swimsuit")
      ? FRAMING.fullBody
      : FRAMING.threeQuarter;
    framingReason = `clothing type (${spec.clothing?.value}) requires full outfit visibility`;
  } else if (isUserEmphasis && emphasisStrength === "high") {
    // High body emphasis from user, no specific target → three-quarter
    chosenFraming = FRAMING.threeQuarter;
    framingReason = "high body emphasis strength from user";
  } else if (
    poseVal.includes("standing") ||
    poseVal.includes("full") ||
    clothingVal.includes("dress") ||
    clothingVal.includes("gown")
  ) {
    chosenFraming = FRAMING.threeQuarter;
    framingReason = "standing pose or full-length clothing";
  } else {
    // Default: portrait
    chosenFraming = FRAMING.portrait;
    framingReason = "no specific body area emphasis detected";
  }

  // ─── STEP 2: Pose suggestion ───────────────────────────────────────────────
  // Build a pose suggestion that supports the emphasized area.
  // Only used by blockBuilder if user did NOT specify a pose.
  let pose_suggestion = null;
  for (const target of ["hips", "legs", "physique", "waist", "chest", "shoulders"]) {
    if (targets.has(target)) {
      pose_suggestion = POSE_BY_TARGET[target];
      break;
    }
  }
  if (!pose_suggestion && needsClothing) {
    pose_suggestion = "confident full-body stance that shows the complete outfit naturally";
  }

  // ─── STEP 3: Composition goal ─────────────────────────────────────────────
  const composition_goal = buildCompositionGoal(chosenFraming, targets, envType, needsClothing);

  return {
    subject_emphasis: chosenFraming.label,
    framing_strategy: chosenFraming.strategy,
    framing_reason: framingReason,
    composition_goal,
    camera_preset: chosenFraming.camera,
    pose_suggestion,
    emphasis_targets: [...targets],
  };
}

module.exports = { plan };
