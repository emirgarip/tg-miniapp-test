// Base Model Normalizer.
//
// Merges the LLM extraction (explicit + inferred) with defaults.
// Tags every field with source: "user" | "inferred" | "default".
// Returns the nested JSON structure expected by the frontend.

const { DEFAULTS, FIELD_KEYS, sanitize } = require("./baseModelDefaults");

// Resolve a single field value + source from explicit, inferred, and defaults.
function resolveField(field, explicit, inferred) {
  const explicitVal = sanitize(field, explicit[field]);
  if (explicitVal !== null) return { value: explicitVal, source: "user" };

  const inferredVal = sanitize(field, inferred[field]);
  if (inferredVal !== null) return { value: inferredVal, source: "inferred" };

  const def = DEFAULTS[field];
  return { value: def ?? null, source: "default" };
}

function normalizeBaseModel(explicit = {}, inferred = {}) {
  const flat = {};
  for (const key of FIELD_KEYS) {
    flat[key] = resolveField(key, explicit, inferred);
  }

  // Count user-provided and inferred fields (excluding defaults).
  const userCount    = FIELD_KEYS.filter((k) => flat[k].source === "user").length;
  const inferredCount = FIELD_KEYS.filter((k) => flat[k].source === "inferred").length;
  const defaultsOnly = userCount === 0 && inferredCount === 0;

  // Build the nested output structure.
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

module.exports = { normalizeBaseModel };
