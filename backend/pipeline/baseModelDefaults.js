// Base Model — Allowed values and defaults.
// Every field uses a stable enum-like value (snake_case).
// Defaults produce a coherent adult female base model when no traits are provided.

const ALLOWED = {
  gender_presentation:    ["female", "male", "androgynous", "non_binary"],
  age_range:              ["20-24", "25-29", "30-34", "35-39", "40-44", "45-50", "50+"],
  heritage_look:          [
    "east_asian", "south_asian", "southeast_asian", "middle_eastern",
    "black_african", "latin_hispanic", "eastern_european", "western_european",
    "scandinavian", "mediterranean", "mixed_ambiguous",
  ],
  skin_tone:              ["fair", "light", "light_olive", "olive", "warm_beige", "tan", "medium_brown", "brown", "deep_brown", "ebony"],
  hair_color:             ["black", "dark_brown", "medium_brown", "light_brown", "auburn", "red", "strawberry_blonde", "dark_blonde", "blonde", "platinum_blonde", "silver", "white", "dyed_unusual"],
  hair_texture:           ["straight", "slightly_wavy", "wavy", "curly", "coily", "kinky"],
  hair_length:            ["very_short", "short", "chin_length", "shoulder_length", "long", "very_long"],
  eyes_color:             ["brown", "dark_brown", "hazel", "green", "blue", "gray", "amber"],
  eyes_shape:             ["almond", "round", "monolid", "hooded", "upturned", "downturned", "wide_set", "close_set"],
  face_shape:             ["oval", "round", "square", "heart", "oblong", "diamond", "triangle"],
  face_jawline:           ["sharp", "defined", "softly_defined", "rounded", "soft"],
  face_nose:              ["straight", "button", "upturned", "roman", "wide", "narrow", "snub"],
  face_lips:              ["full", "balanced", "thin", "wide", "cupids_bow", "pouty"],
  face_cheekbones:        ["high", "prominent", "balanced", "soft", "flat"],
  face_skin_details:      ["none", "freckles", "moles", "scars", "dimples"],
  body_type:              ["petite", "slim", "slim_curvy", "athletic", "curvy", "full_figured", "plus_size"],
  body_height_impression: ["petite", "average", "tall"],
  body_bust:              ["small", "balanced", "full", "large"],
  body_waist:             ["narrow", "defined", "average", "full"],
  body_hips:              ["narrow", "balanced", "wide", "full"],
  body_legs:              ["slim", "balanced", "athletic", "full"],
  body_feet_focus:        ["none", "visible", "emphasized"],
  style_vibe:             ["natural", "elegant", "edgy", "sporty", "glamorous", "bohemian", "minimalist"],
  style_makeup:           ["none", "minimal", "natural", "bold", "dramatic", "artistic"],
  accessories_glasses:    ["none", "thin_frame", "thick_frame", "sunglasses", "cat_eye", "round"],
  accessories_jewelry:    ["none", "minimal", "statement", "earrings_only", "layered"],
};

const DEFAULTS = {
  gender_presentation:    "female",
  age_range:              "25-29",
  heritage_look:          "mixed_ambiguous",
  skin_tone:              "light_olive",
  hair_color:             "dark_brown",
  hair_texture:           "slightly_wavy",
  hair_length:            "long",
  eyes_color:             "brown",
  eyes_shape:             "almond",
  face_shape:             "oval",
  face_jawline:           "softly_defined",
  face_nose:              "straight",
  face_lips:              "balanced",
  face_cheekbones:        "balanced",
  face_skin_details:      "none",
  body_type:              "slim_curvy",
  body_height_impression: "average",
  body_bust:              "balanced",
  body_waist:             "defined",
  body_hips:              "balanced",
  body_legs:              "balanced",
  body_feet_focus:        "none",
  style_vibe:             "natural",
  style_makeup:           "minimal",
  accessories_glasses:    "none",
  accessories_jewelry:    "none",
  // celebrity_inspiration is always null in this phase (disabled)
};

// Flat list of all field keys in the order they appear in the schema.
const FIELD_KEYS = Object.keys(DEFAULTS);

// Validate a raw value against the allowed list for a field.
// Returns the value if valid, null otherwise.
function sanitize(field, value) {
  if (value == null) return null;
  const allowed = ALLOWED[field];
  if (!allowed) return null;
  const v = String(value).trim().toLowerCase();
  return allowed.includes(v) ? v : null;
}

module.exports = { ALLOWED, DEFAULTS, FIELD_KEYS, sanitize };
