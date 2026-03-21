// Base Model Normalizer — three pure functions, no LLM calls.
//
// buildPartialFlat(explicit)
//   → applies user values, fills REQUIRED fields with defaults, leaves everything else null
//
// mergeInferred(partialFlat, inferred)
//   → fills INFERRABLE fields from AI Call #2 results (only if user didn't already provide them)
//
// buildNestedModel(flat)
//   → converts the flat structure into the nested JSON the frontend expects

const { DEFAULTS, REQUIRED_FIELDS, INFERRABLE_FIELDS, ALL_FIELDS, sanitize } = require("./baseModelDefaults");

// ── Step 1: Apply explicit values + required defaults ────────────────────────
// Priority: user > required default > null
// Optional and inferrable fields stay null here — they are not touched.
function buildPartialFlat(explicit = {}) {
  const flat = {};
  for (const key of ALL_FIELDS) {
    const userVal = sanitize(key, explicit[key]);
    if (userVal !== null) {
      flat[key] = { value: userVal, source: "user" };
    } else if (REQUIRED_FIELDS.has(key)) {
      flat[key] = { value: DEFAULTS[key], source: "default" };
    } else {
      flat[key] = { value: null, source: "default" };
    }
  }
  return flat;
}

// ── Step 2: Apply inference results ─────────────────────────────────────────
// Only touches INFERRABLE fields that the user did not already provide.
// User values are never overwritten.
function mergeInferred(partialFlat, inferred = {}) {
  const merged = { ...partialFlat };
  for (const key of INFERRABLE_FIELDS) {
    if (merged[key]?.source !== "user") {
      const val = inferred[key];
      if (val != null) {
        merged[key] = { value: val, source: "inferred" };
      }
    }
  }
  return merged;
}

// ── Step 3: Build nested output + compute stats ──────────────────────────────
function buildNestedModel(flat) {
  const userCount     = ALL_FIELDS.filter((k) => flat[k]?.source === "user").length;
  const inferredCount = ALL_FIELDS.filter((k) => flat[k]?.source === "inferred").length;
  const defaultsOnly  = userCount === 0 && inferredCount === 0;

  const model = {
    gender_presentation: flat.gender_presentation,
    age_range:           flat.age_range,
    heritage_look:       flat.heritage_look,
    skin_tone:           flat.skin_tone,

    hair: {
      color:   flat.hair_color,
      texture: flat.hair_texture,
      length:  flat.hair_length,
    },

    eyes: {
      color: flat.eyes_color,
      shape: flat.eyes_shape,
    },

    face: {
      shape:        flat.face_shape,
      jawline:      flat.face_jawline,
      nose:         flat.face_nose,
      lips:         flat.face_lips,
      cheekbones:   flat.face_cheekbones,
      skin_details: flat.face_skin_details,
    },

    body: {
      type:              flat.body_type,
      height_impression: flat.body_height_impression,
      bust:              flat.body_bust,
      waist:             flat.body_waist,
      hips:              flat.body_hips,
      legs:              flat.body_legs,
      feet_focus:        flat.body_feet_focus,
    },

    style: {
      vibe:   flat.style_vibe,
      makeup: flat.style_makeup,
    },

    accessories: {
      glasses: flat.accessories_glasses,
      jewelry: flat.accessories_jewelry,
    },

    reference: {
      celebrity_inspiration: { value: null, source: "default" },
    },
  };

  return { model, userCount, inferredCount, defaultsOnly };
}

module.exports = { buildPartialFlat, mergeInferred, buildNestedModel };
