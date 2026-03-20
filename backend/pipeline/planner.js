// STEP C — Visual Planning
// Deterministic logic only. No LLM calls.
//
// Inputs:
//   spec           — normalized attribute spec from normalizer
//   interpretation — semantic intent categories + confidence from interpreter
//
// Framing priority order (highest wins):
//   1. High/medium-confidence focus regions that require lower-body visibility
//   2. Interpretation composition_need = body_first
//   3. Clothing visibility need (bikini, dress → show outfit)
//   4. Normalizer emphasis targets (regex-derived, always applied)
//   5. Body emphasis strength (high → three-quarter minimum)
//   6. Pose intent from interpretation (if high/medium confidence)
//   7. Default: portrait framing

const { regionsAtConfidence } = require("./interpreter");

// ─── framing presets ─────────────────────────────────────────────────────────

const FRAMING = {
  portrait: {
    label: "face-and-upper-body",
    strategy:
      "mid-torso portrait framing emphasizing face, expression, and upper-body details",
    camera:
      "mid-torso portrait framing, 85mm portrait lens feel, shallow cinematic depth of field, sharp subject focus with smoothly blurred background",
  },
  threeQuarter: {
    label: "three-quarter-body",
    strategy:
      "three-quarter body framing to show posture, hips, waist line, and upper legs alongside scene context",
    camera:
      "three-quarter body framing, 70mm-equivalent lens feel, shallow depth of field, sharp subject with naturally receding background",
  },
  fullBody: {
    label: "full-body",
    strategy:
      "full-body framing to show the complete silhouette, leg line, proportions, and environmental context",
    camera:
      "full-body vertical framing, 50mm-equivalent natural perspective, moderate depth of field, sharp subject clarity with soft environmental separation",
  },
};

// ─── pose templates keyed by emphasis / region ───────────────────────────────

const POSE_TEMPLATES = {
  // ── body-area driven ────────────────────────────────────────────────────────
  hips:
    "slight three-quarter body turn with one hip angled toward the camera, weight shifted to one leg, relaxed shoulder line — reveals hip line and waist definition clearly",
  legs:
    "full standing pose with clean leg separation, one knee slightly forward, relaxed arms — shows leg length, structure, and natural stance",
  physique:
    "confident upright full-body stance with shoulders relaxed and natural weight distribution — presents complete silhouette and proportions",
  waist:
    "three-quarter turn with torso slightly angled, arms relaxed at sides or one hand near hip — emphasizes waist definition and body line",
  chest:
    "upright forward-facing pose with natural shoulder relaxation and slight chest openness — shows upper body clearly",
  shoulders:
    "upright posture with open shoulder line, slight turn away from camera — emphasizes shoulder width and upper body frame",
  full_body:
    "confident full-body stance with natural weight distribution and clean vertical posture — presents complete silhouette clearly",

  // ── interpretation pose_intent values ────────────────────────────────────────
  standing:
    "natural upright standing pose, weight balanced, shoulder line relaxed, and light directional posture — composed but not stiff",
  seated:
    "seated pose with upright posture, weight evenly supported, natural hand placement, and relaxed shoulder line",
  reclining:
    "reclining pose with body supported at a gentle angle, natural limb arrangement, and relaxed overall posture — body reads with ease and visual coherence",
  leaning:
    "leaning pose with weight transferred to one side, natural shoulder tilt, and relaxed body language — dynamic but composed",
  walking:
    "mid-stride walking pose with natural arm swing, weight in motion, and confident forward momentum — body reads as dynamic and fluid",
  cross_legged_floor:
    "seated cross-legged on the floor with both legs folded symmetrically in front, upright back, relaxed shoulders, and natural hand placement on knees or lap — grounded, composed floor pose",
  legs_crossed_knee:
    "seated with one leg elegantly crossed over the other at the knee, upright posture, slightly angled torso, relaxed hands — refined seated pose with visible leg line",
  seated_side_angle:
    "seated at a slight side angle to the camera, one hip slightly raised, relaxed posture, and natural arm placement — shows profile and body line without full frontal framing",
  one_leg_weight_shift:
    "relaxed standing pose with weight on one leg, hip naturally offset, shoulder line slightly angled — casual but composed stance",
  hip_accentuating:
    "three-quarter turn with weight shifted to one hip, natural lean and relaxed arms — emphasizes hip and waist line",
  portrait_pose:
    "composed upper-body portrait pose with natural shoulder angle, deliberate gaze, and relaxed facial muscles — clean and editorial",
};

// ─── composition goal builder ─────────────────────────────────────────────────

function buildCompositionGoal(chosenFraming, targets, interp, envType) {
  const t = String(envType || "").toLowerCase();
  const isInterior =
    t.includes("hotel") || t.includes("room") || t.includes("interior") || t.includes("bedroom");
  const isOutdoor =
    t.includes("beach") || t.includes("outdoor") || t.includes("city") || t.includes("street");

  const visReqs = [];
  if (targets.has("hips")) visReqs.push("hips and waist line clearly visible and not cropped");
  if (targets.has("legs")) visReqs.push("full leg length visible from hip to foot");
  if (targets.has("physique")) visReqs.push("complete body silhouette visible");
  if (targets.has("waist")) visReqs.push("waist and midsection clearly visible");
  if (targets.has("chest")) visReqs.push("upper body and chest area clearly in frame");

  // Supplement from interpretation regions
  const interpRegions = regionsAtConfidence(interp, "medium");
  if (interpRegions.has("hips") && !targets.has("hips"))
    visReqs.push("hips visible and not cropped");
  if (interpRegions.has("legs") && !targets.has("legs"))
    visReqs.push("leg line clearly in frame");
  if (interpRegions.has("full_body") && !targets.has("physique"))
    visReqs.push("complete body silhouette visible");

  const clothingNeed = interp?.clothing_visibility_need?.value;
  if (clothingNeed === "full_outfit") visReqs.push("full clothing item visible without cropping");
  else if (clothingNeed === "styling_detail") visReqs.push("clothing styling details clearly visible");

  const envContextPart = isInterior
    ? "integrate warm interior depth and room context as background atmosphere"
    : isOutdoor
    ? "integrate natural outdoor environment with horizon depth as scene context"
    : "clean editorial background with neutral depth and deliberate negative space";

  if (visReqs.length > 0) {
    return `Ensure ${visReqs.join("; ")}. ${envContextPart}.`;
  }

  const compNeed = interp?.composition_need;
  if (compNeed?.confidence === "high" || compNeed?.confidence === "medium") {
    if (compNeed.value === "environment_first") {
      return `Environment provides significant contextual atmosphere — allow visible scene depth and subject integration. ${envContextPart}.`;
    }
    if (compNeed.value === "face_first") {
      return `Face and expression are the primary visual focus — composition centers on the subject's face with strong eye contact and natural framing. ${envContextPart}.`;
    }
  }

  return `Maintain clear subject-environment balance with coherent scene depth. ${envContextPart}.`;
}

// ─── main plan function ──────────────────────────────────────────────────────

function plan(spec, interpretation = {}) {
  // Signals from normalizer
  const normTargets = spec._emphasisTargets || new Set();
  const isUserBodyEmphasis = !!spec._bodyEmphasisIsUserDriven;
  const normStrength = String(spec._bodyEmphasisStrength || "medium").toLowerCase();
  const needsFullClothing = !!spec._needsFullClothingVisibility;
  const clothingVal = String(spec.clothing?.value || "").toLowerCase();
  const poseIsUser = spec.pose?.source === "user";
  const poseVal = String(spec.pose?.value || "").toLowerCase();
  const envType = spec._envType || "";

  // Signals from interpreter
  const interpRegionsHigh = regionsAtConfidence(interpretation, "high");
  const interpRegionsMed = regionsAtConfidence(interpretation, "medium");
  const poseIntent = interpretation.pose_intent || { value: "unclear", confidence: "low" };
  const compNeed = interpretation.composition_need || { value: "balanced", confidence: "low" };
  const clothingVisibility = interpretation.clothing_visibility_need || {
    value: "not_specified",
    confidence: "low",
  };

  // Merged lower-body target set (normalizer + high/medium interpretation)
  const lowerBodyFromInterp = [...interpRegionsMed].filter((r) =>
    ["hips", "legs", "waist", "full_body"].includes(r)
  );
  const allLowerBodyTargets = new Set([
    ...[...normTargets].filter((t) =>
      ["hips", "legs", "physique", "waist"].includes(t)
    ),
    ...lowerBodyFromInterp,
  ]);

  // ─── STEP 1: Choose framing ───────────────────────────────────────────────

  let chosenFraming;
  let framingReason;

  const hasInterpFullBody = interpRegionsHigh.has("full_body") || interpRegionsMed.has("full_body");
  const hasInterpLegs = interpRegionsHigh.has("legs") || interpRegionsMed.has("legs");
  const hasInterpHips = interpRegionsHigh.has("hips") || interpRegionsMed.has("hips");

  if (
    (isUserBodyEmphasis && (normTargets.has("legs") || normTargets.has("physique"))) ||
    hasInterpFullBody ||
    hasInterpLegs
  ) {
    chosenFraming = FRAMING.fullBody;
    const reasons = [];
    if (isUserBodyEmphasis && normTargets.has("legs")) reasons.push("user emphasized legs");
    if (isUserBodyEmphasis && normTargets.has("physique")) reasons.push("user emphasized physique");
    if (hasInterpFullBody) reasons.push("interpretation: full_body region");
    if (hasInterpLegs) reasons.push("interpretation: legs region");
    framingReason = reasons.join(", ");
  } else if (
    (isUserBodyEmphasis && normTargets.has("hips")) ||
    hasInterpHips ||
    (isUserBodyEmphasis && normTargets.has("waist")) ||
    interpRegionsMed.has("waist")
  ) {
    chosenFraming = FRAMING.threeQuarter;
    const reasons = [];
    if (isUserBodyEmphasis && normTargets.has("hips")) reasons.push("user emphasized hips");
    if (hasInterpHips) reasons.push("interpretation: hips region");
    if (isUserBodyEmphasis && normTargets.has("waist")) reasons.push("user emphasized waist");
    if (interpRegionsMed.has("waist")) reasons.push("interpretation: waist region");
    framingReason = reasons.join(", ");
  } else if (
    clothingVisibility.value === "full_outfit" &&
    (clothingVisibility.confidence === "high" || clothingVisibility.confidence === "medium")
  ) {
    chosenFraming = clothingVal.includes("bikini") || clothingVal.includes("swimsuit")
      ? FRAMING.fullBody
      : FRAMING.threeQuarter;
    framingReason = `clothing visibility need: ${clothingVisibility.value} (${clothingVisibility.confidence} confidence)`;
  } else if (needsFullClothing) {
    chosenFraming = clothingVal.includes("bikini") || clothingVal.includes("swimsuit")
      ? FRAMING.fullBody
      : FRAMING.threeQuarter;
    framingReason = "clothing type requires full outfit visibility";
  } else if (
    compNeed.value === "body_first" &&
    (compNeed.confidence === "high" || compNeed.confidence === "medium")
  ) {
    chosenFraming = FRAMING.threeQuarter;
    framingReason = `interpretation: composition_need = body_first (${compNeed.confidence})`;
  } else if (isUserBodyEmphasis && normStrength === "high") {
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
  } else if (
    poseIntent.value === "standing" &&
    poseIntent.confidence === "high"
  ) {
    chosenFraming = FRAMING.threeQuarter;
    framingReason = "interpretation: pose_intent = standing (high confidence)";
  } else {
    chosenFraming = FRAMING.portrait;
    framingReason = "no lower-body or body-first signal detected";
  }

  // ─── STEP 2: Pose suggestion ──────────────────────────────────────────────
  // Build a pose that supports the user's emphasis.
  // Priority: normalizer targets > interpretation pose_intent > default.
  // Only used when user did not provide a pose.
  let pose_suggestion = null;
  let poseReason = "default";

  if (!poseIsUser) {
    // Priority 1: HIGH-confidence specific pose from interpreter (most precise signal).
    // e.g. user clearly described "sitting cross-legged on the floor" → preserve exactly.
    if (
      poseIntent.value !== "unclear" &&
      poseIntent.confidence === "high" &&
      POSE_TEMPLATES[poseIntent.value]
    ) {
      pose_suggestion = POSE_TEMPLATES[poseIntent.value];
      poseReason = `interpretation: pose_intent = ${poseIntent.value} (HIGH — used as primary)`;
    }

    // Priority 2: Normalizer body-area targets (user explicitly mentioned a body area).
    // Only applies when no high-confidence pose intent was found.
    if (!pose_suggestion) {
      for (const target of ["hips", "legs", "physique", "waist", "chest", "shoulders"]) {
        if (normTargets.has(target) && POSE_TEMPLATES[target]) {
          pose_suggestion = POSE_TEMPLATES[target];
          poseReason = `normalizer target: ${target}`;
          break;
        }
      }
    }

    // Priority 3: MEDIUM-confidence pose from interpreter.
    if (
      !pose_suggestion &&
      poseIntent.value !== "unclear" &&
      poseIntent.confidence === "medium" &&
      POSE_TEMPLATES[poseIntent.value]
    ) {
      pose_suggestion = POSE_TEMPLATES[poseIntent.value];
      poseReason = `interpretation: pose_intent = ${poseIntent.value} (medium)`;
    }

    // Priority 4: Interpretation focus regions.
    if (!pose_suggestion) {
      if (interpRegionsMed.has("full_body")) {
        pose_suggestion = POSE_TEMPLATES["full_body"];
        poseReason = "interpretation: full_body region";
      } else if (interpRegionsMed.has("hips")) {
        pose_suggestion = POSE_TEMPLATES["hips"];
        poseReason = "interpretation: hips region";
      } else if (interpRegionsMed.has("legs")) {
        pose_suggestion = POSE_TEMPLATES["legs"];
        poseReason = "interpretation: legs region";
      }
    }

    // Priority 5: Clothing fallback.
    if (!pose_suggestion && needsFullClothing) {
      pose_suggestion = "confident full-body stance that shows the complete outfit naturally";
      poseReason = "clothing needs full visibility";
    }
  }

  // ─── STEP 3: Composition goal ─────────────────────────────────────────────

  const composition_goal = buildCompositionGoal(
    chosenFraming,
    allLowerBodyTargets,
    interpretation,
    envType
  );

  return {
    subject_emphasis: chosenFraming.label,
    framing_strategy: chosenFraming.strategy,
    framing_reason: framingReason,
    composition_goal,
    camera_preset: chosenFraming.camera,
    pose_suggestion,
    pose_reason: poseReason,
    emphasis_targets: [...normTargets],
    interpretation_regions: [...interpRegionsMed].map((r) => r),
    // surfaced for assembler display
    _poseIntentValue: poseIntent.value,
    _poseIntentConfidence: poseIntent.confidence,
  };
}

module.exports = { plan };
