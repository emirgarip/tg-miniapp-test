// STEP B — Normalization & Default Filling
// Rules:
//   1. User-provided values are preserved exactly in meaning.
//   2. Missing fields are completed with sensible defaults.
//   3. Values carry a source tag ("user" | "auto") for UI transparency.
//   4. Age is always normalized to numeric range strings.
//   5. Body emphasis is controlled and never extreme by default.

const { DEFAULTS } = require("./prompt-config");

// ─── helpers ────────────────────────────────────────────────────────────────

function tagged(value, source) {
  return { value, source };
}

function pick(extracted, fallback, source = "auto") {
  return extracted != null
    ? tagged(extracted, "user")
    : tagged(fallback, source);
}

function pickNested(extractedObj = {}, key, fallback) {
  const v = extractedObj[key];
  return v != null ? tagged(v, "user") : tagged(fallback, "auto");
}

// ─── age ────────────────────────────────────────────────────────────────────

function normalizeAgeRange(raw) {
  if (!raw) return null;
  const s = String(raw).trim();

  const explicitRange = s.match(/(\d{2})\s*[-–]\s*(\d{2})/);
  if (explicitRange) return `${explicitRange[1]}-${explicitRange[2]}`;

  const single = s.match(/\b(\d{2})\b/);
  if (single) {
    const n = parseInt(single[1], 10);
    const lo = Math.max(18, n - 4);
    const hi = lo + 8;
    return `${lo}-${hi}`;
  }
  return null;
}

// ─── body emphasis ──────────────────────────────────────────────────────────

const BODY_MAPS = {
  low: "natural body lines with subtle silhouette definition and realistic anatomy",
  medium:
    "balanced proportions with moderate emphasis on silhouette, controlled curves, and believable anatomy",
  high:
    "well-proportioned figure with defined hips and legs, graceful body lines, and believable realistic anatomy",
};

function resolveBodyEmphasisStrength(raw) {
  if (!raw) return "medium";
  const s = String(raw).toLowerCase();
  if (s.includes("very") || s.includes("strong") || s.includes("extreme")) return "high";
  if (s.includes("subtle") || s.includes("light") || s.includes("low")) return "low";
  return "medium";
}

// Detect which specific body areas the user explicitly mentioned.
// Returns a Set of named targets. Drives framing decisions in the planner.
function detectEmphasisTargets(rawEmphasis, rawBodyType) {
  const targets = new Set();
  const combined = `${rawEmphasis || ""} ${rawBodyType || ""}`.toLowerCase();

  if (/\bhip(s)?\b/.test(combined)) targets.add("hips");
  if (/\bleg(s)?\b|\bthigh(s)?\b/.test(combined)) targets.add("legs");
  if (/\bbutt(ocks)?\b|\bass\b|\bbehind\b|\bbottom\b/.test(combined)) targets.add("hips"); // normalize to hips
  if (/\bwaist\b/.test(combined)) targets.add("waist");
  if (/\bphysique\b|\bfigure\b|\bbody shape\b|\bfull.?body\b/.test(combined)) targets.add("physique");
  if (/\bchest\b|\bbust\b|\bbreasts?\b/.test(combined)) targets.add("chest");
  if (/\bshoulder(s)?\b/.test(combined)) targets.add("shoulders");
  if (/\bface\b|\beyes?\b|\blook(s)?\b/.test(combined)) targets.add("face");

  return targets;
}

// Detect whether clothing type requires the full outfit to be visible.
function clothingNeedsFullVisibility(clothingVal) {
  const s = String(clothingVal || "").toLowerCase();
  return (
    s.includes("bikini") ||
    s.includes("swimsuit") ||
    s.includes("one-piece") ||
    s.includes("dress") ||
    s.includes("gown") ||
    s.includes("skirt") ||
    s.includes("shorts") ||
    s.includes("lingerie")
  );
}

// ─── lighting from environment ───────────────────────────────────────────────

function defaultLightingForEnv(envType) {
  const t = String(envType || "").toLowerCase();
  if (t.includes("beach") || t.includes("outdoor") || t.includes("city"))
    return "soft natural daylight with gentle outdoor fill and visible horizon glow";
  if (t.includes("hotel") || t.includes("room") || t.includes("bedroom") || t.includes("interior"))
    return "soft warm interior ambient light with directional practical highlights";
  if (t.includes("night") || t.includes("club") || t.includes("bar"))
    return "soft cinematic night lighting with warm accent tones and atmospheric glow";
  return DEFAULTS.lighting || "soft natural daylight from one side with gentle fill and realistic shadow falloff";
}

// ─── camera from subject emphasis ────────────────────────────────────────────

function defaultCamera(subjectEmphasis) {
  const s = String(subjectEmphasis || "").toLowerCase();
  if (s.includes("full") || s.includes("body") || s.includes("legs"))
    return "full-body framing, 50mm-equivalent perspective, moderate depth of field";
  if (s.includes("three") || s.includes("quarter") || s.includes("waist"))
    return "three-quarter framing, 70mm-equivalent lens feel, shallow depth of field";
  return "mid-torso portrait framing, 85mm portrait lens feel, shallow cinematic depth of field, sharp subject with naturally blurred background";
}

// ─── main normalize function ─────────────────────────────────────────────────

function normalize(extracted = {}) {
  const extractedAttrs = [];
  const autoFilledAttrs = [];

  function track(label, tagged) {
    if (tagged.source === "user") extractedAttrs.push(`${label}: ${tagged.value}`);
    else autoFilledAttrs.push(`${label}: ${tagged.value}`);
    return tagged;
  }

  const gender = track("gender", pick(extracted.gender, DEFAULTS.gender));

  const rawAge = normalizeAgeRange(extracted.age_range);
  const age_range = track(
    "age_range",
    rawAge ? tagged(rawAge, "user") : tagged(DEFAULTS.age_range, "auto")
  );

  const face = track("face", pick(extracted.face, DEFAULTS.face));

  const hairColor = track(
    "hair.color",
    pickNested(extracted.hair || {}, "color", DEFAULTS.hair.color)
  );
  const hairStyle = track(
    "hair.style",
    pickNested(extracted.hair || {}, "style", DEFAULTS.hair.style)
  );

  const eyeColor = track(
    "eyes.color",
    pickNested(extracted.eyes || {}, "color", DEFAULTS.eyes.color)
  );
  const eyeDetails = track(
    "eyes.details",
    pickNested(extracted.eyes || {}, "details", DEFAULTS.eyes.details)
  );

  const expression = track("expression", pick(extracted.expression, DEFAULTS.expression));

  const bodyType = track(
    "body.type",
    pickNested(extracted.body || {}, "type", DEFAULTS.body.type)
  );

  const rawBodyEmphasis = extracted.body?.emphasis || null;
  const emphasisStrength = resolveBodyEmphasisStrength(
    extracted.body?.emphasis_strength || rawBodyEmphasis
  );
  const bodyEmphasis = track(
    "body.emphasis",
    rawBodyEmphasis
      ? tagged(rawBodyEmphasis, "user")
      : tagged(BODY_MAPS[emphasisStrength], "auto")
  );
  const bodyEmphasisStrength = track(
    "body.emphasis_strength",
    extracted.body?.emphasis_strength
      ? tagged(emphasisStrength, "user")
      : tagged(emphasisStrength, "auto")
  );

  const pose = track("pose", pick(extracted.pose, DEFAULTS.pose));
  const clothing = track("clothing", pick(extracted.clothing, DEFAULTS.clothing));

  const envType = track(
    "environment.type",
    pickNested(extracted.environment || {}, "type", DEFAULTS.environment.type)
  );
  const envDetails = track(
    "environment.details",
    pickNested(extracted.environment || {}, "details", DEFAULTS.environment.details)
  );

  const lightingRaw = extracted.lighting || null;
  const lighting = track(
    "lighting",
    lightingRaw
      ? tagged(lightingRaw, "user")
      : tagged(defaultLightingForEnv(envType.value), "auto")
  );

  const safetyAdjustments = track(
    "safety_adjustments",
    pick(extracted.safety_adjustments, DEFAULTS.safety_adjustments)
  );

  // Detect specific emphasis targets from raw user body text (before normalization).
  const rawBodyEmphasisText = extracted.body?.emphasis || null;
  const rawBodyTypeText = extracted.body?.type || null;
  const emphasisTargets = rawBodyEmphasis
    ? detectEmphasisTargets(rawBodyEmphasisText, rawBodyTypeText)
    : new Set();

  const needsFullClothingVisibility = clothingNeedsFullVisibility(
    extracted.clothing || ""
  );

  const spec = {
    gender,
    age_range,
    face,
    hair: { color: hairColor, style: hairStyle },
    eyes: { color: eyeColor, details: eyeDetails },
    expression,
    body: { type: bodyType, emphasis: bodyEmphasis, emphasis_strength: bodyEmphasisStrength },
    pose,
    clothing,
    environment: { type: envType, details: envDetails },
    lighting,
    camera: null, // will be filled by planner
    style_cues: pick(extracted.style_cues, DEFAULTS.style_cues),
    safety_adjustments: safetyAdjustments,
    // Internal planner signals — not sent to frontend display
    _bodyEmphasisStrength: emphasisStrength,
    _bodyEmphasisIsUserDriven: rawBodyEmphasis !== null,
    _emphasisTargets: emphasisTargets,          // Set<string>
    _needsFullClothingVisibility: needsFullClothingVisibility,
    _envType: envType.value,
  };

  return { spec, extractedAttrs, autoFilledAttrs };
}

module.exports = { normalize };
