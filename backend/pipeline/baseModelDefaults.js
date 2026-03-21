// Base Model — Field classification, allowed values, and required defaults.
//
// Field policy:
//   REQUIRED   — must always have a value; filled with defaults when user omits them
//   INFERRABLE — may be filled by AI Call #2 if useful context exists; stay null otherwise
//   OPTIONAL   — null unless user explicitly provided them; never auto-filled

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

// ── Field classification ──────────────────────────────────────────────────────

// Always present in the final JSON. Filled with defaults if user didn't provide them.
const REQUIRED_FIELDS = new Set([
  "gender_presentation", "age_range", "heritage_look", "skin_tone",
  "hair_color", "hair_texture", "hair_length",
  "eyes_color", "eyes_shape",
  "body_type", "style_vibe",
]);

// May be filled by AI Call #2 if useful context exists. Null otherwise.
const INFERRABLE_FIELDS = new Set([
  "body_height_impression", "body_waist", "body_hips", "body_legs",
]);

// Null unless user explicitly provided them. Never auto-filled.
// face.*, body.bust, body.feet_focus, style.makeup, accessories.*, reference.*

// All flat field keys in schema order (used to iterate the full model).
const ALL_FIELDS = [
  "gender_presentation", "age_range", "heritage_look", "skin_tone",
  "hair_color", "hair_texture", "hair_length",
  "eyes_color", "eyes_shape",
  "face_shape", "face_jawline", "face_nose", "face_lips", "face_cheekbones", "face_skin_details",
  "body_type", "body_height_impression", "body_bust", "body_waist", "body_hips", "body_legs", "body_feet_focus",
  "style_vibe", "style_makeup",
  "accessories_glasses", "accessories_jewelry",
];

// Defaults for REQUIRED fields only.
const DEFAULTS = {
  gender_presentation: "female",
  age_range:           "25-29",
  heritage_look:       "mixed_ambiguous",
  skin_tone:           "light_olive",
  hair_color:          "dark_brown",
  hair_texture:        "slightly_wavy",
  hair_length:         "long",
  eyes_color:          "brown",
  eyes_shape:          "almond",
  body_type:           "slim_curvy",
  style_vibe:          "natural",
};

// Validate a raw value against the allowed list for a field.
// Returns the normalized value if valid, null otherwise.
function sanitize(field, value) {
  if (value == null) return null;
  const allowed = ALLOWED[field];
  if (!allowed) return null;
  const v = String(value).trim().toLowerCase();
  return allowed.includes(v) ? v : null;
}

module.exports = { ALLOWED, DEFAULTS, REQUIRED_FIELDS, INFERRABLE_FIELDS, ALL_FIELDS, sanitize };
