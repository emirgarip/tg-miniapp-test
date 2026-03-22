// Deterministic image prompt builder from base model JSON.
//
// No inference. No null values used. No guessing.
// Null/missing fields are silently skipped.
// Only explicit non-null values affect the MODEL IDENTITY block.
// All fixed blocks are immutable strings — identical every run.

// ── Value accessor ────────────────────────────────────────────────────────────

// Read the `.value` from a field object, or return null.
function val(field) {
  return field?.value ?? null;
}

// Map `v` through a lookup table. Returns null if `v` is null or not in map.
function phrase(map, v) {
  if (!v) return null;
  return map[v] ?? null;
}

// Like phrase() but also treats "none" as absent (returns null for "none").
function phraseNoNone(map, v) {
  if (!v || v === "none") return null;
  return map[v] ?? null;
}

// Join array items with commas and "and" before the last.
function joinAnd(arr) {
  if (arr.length === 0) return "";
  if (arr.length === 1) return arr[0];
  if (arr.length === 2) return `${arr[0]} and ${arr[1]}`;
  return arr.slice(0, -1).join(", ") + ", and " + arr[arr.length - 1];
}

// ── Enum mappings ─────────────────────────────────────────────────────────────

const AGE_MAP = {
  "20-24": "in her early to mid-20s",
  "25-29": "in her mid-to-late 20s",
  "30-34": "in her early 30s",
  "35-39": "in her late 30s",
  "40-44": "in her early 40s",
  "45-50": "in her late 40s",
  "50+":   "in her 50s or older",
};

const HERITAGE_MAP = {
  east_asian:       "an East Asian appearance",
  south_asian:      "a South Asian appearance",
  southeast_asian:  "a Southeast Asian appearance",
  middle_eastern:   "a Middle Eastern appearance",
  black_african:    "a black African appearance",
  latin_hispanic:   "a Latin/Hispanic appearance",
  eastern_european: "an Eastern European appearance",
  western_european: "a Western European appearance",
  scandinavian:     "a Scandinavian appearance",
  mediterranean:    "a Mediterranean appearance",
  mixed_ambiguous:  "a naturally balanced, ambiguous heritage appearance",
};

const SKIN_TONE_MAP = {
  fair:         "a fair skin tone",
  light:        "a light skin tone",
  light_olive:  "a light olive skin tone",
  olive:        "an olive skin tone",
  warm_beige:   "a warm beige skin tone",
  tan:          "a tan skin tone",
  medium_brown: "a medium brown skin tone",
  brown:        "a brown skin tone",
  deep_brown:   "a deep brown skin tone",
  ebony:        "an ebony skin tone",
};

const HAIR_COLOR_MAP = {
  black:             "black",
  dark_brown:        "dark brown",
  medium_brown:      "medium brown",
  light_brown:       "light brown",
  auburn:            "auburn",
  red:               "red",
  strawberry_blonde: "strawberry blonde",
  dark_blonde:       "dark blonde",
  blonde:            "blonde",
  platinum_blonde:   "platinum blonde",
  silver:            "silver",
  white:             "white",
  dyed_unusual:      "unusually dyed",
};

const HAIR_TEXTURE_MAP = {
  straight:      "straight",
  slightly_wavy: "slightly wavy",
  wavy:          "wavy",
  curly:         "curly",
  coily:         "coily",
  kinky:         "kinky",
};

const HAIR_LENGTH_MAP = {
  very_short:      "very short",
  short:           "short",
  chin_length:     "chin-length",
  shoulder_length: "shoulder-length",
  long:            "long",
  very_long:       "very long",
};

const EYES_COLOR_MAP = {
  brown:      "brown",
  dark_brown: "dark brown",
  hazel:      "hazel",
  green:      "green",
  blue:       "blue",
  gray:       "gray",
  amber:      "amber",
};

const EYES_SHAPE_MAP = {
  almond:    "almond-shaped",
  round:     "round",
  monolid:   "monolid",
  hooded:    "hooded",
  upturned:  "upturned",
  downturned:"downturned",
  wide_set:  "wide-set",
  close_set: "close-set",
};

const BODY_TYPE_MAP = {
  petite:       "petite",
  slim:         "slim",
  slim_curvy:   "slim-curvy",
  athletic:     "athletic",
  curvy:        "curvy",
  full_figured: "full-figured",
  plus_size:    "plus-size",
};

const STYLE_VIBE_MAP = {
  natural:    "natural and minimal",
  elegant:    "elegant and refined",
  edgy:       "edgy and bold",
  sporty:     "sporty and casual",
  glamorous:  "glamorous and striking",
  bohemian:   "bohemian and free-spirited",
  minimalist: "minimalist and clean",
};

// "none" is skipped via phraseNoNone — only actual makeup styles are mentioned.
const MAKEUP_MAP = {
  minimal:  "minimal",
  natural:  "natural",
  bold:     "bold",
  dramatic: "dramatic",
  artistic: "artistic",
};

// "none" is skipped via phraseNoNone — user has no glasses / didn't mention them.
const GLASSES_MAP = {
  thin_frame:  "thin-frame glasses",
  thick_frame: "thick-frame glasses",
  sunglasses:  "sunglasses",
  cat_eye:     "cat-eye glasses",
  round:       "round glasses",
};

// "none" is skipped via phraseNoNone — user has no jewelry / didn't mention it.
const JEWELRY_MAP = {
  minimal:       "minimal jewelry",
  statement:     "statement jewelry",
  earrings_only: "earrings",
  layered:       "layered jewelry",
};

// ── Dynamic MODEL IDENTITY block ──────────────────────────────────────────────
//
// Builds strictly from non-null values in the model JSON.
// Paragraph order: subject → hair → eyes → body → accessories → styling.
// Face fields are intentionally excluded from this block.
// body.feet_focus is intentionally excluded (framing is fixed as mid-thigh to head).

function buildModelIdentityBlock(m) {
  const parts = [];

  // ── 1. Subject identity sentence ────────────────────────────────────────────
  {
    const gender = val(m.gender_presentation);

    if (!gender || gender === "female") {
      const agePart      = phrase(AGE_MAP, val(m.age_range));
      const heritagePart = phrase(HERITAGE_MAP, val(m.heritage_look));
      const skinPart     = phrase(SKIN_TONE_MAP, val(m.skin_tone));
      const traits       = [heritagePart, skinPart].filter(Boolean);

      let sentence;
      if (agePart && traits.length > 0) {
        sentence = `The subject is a clearly adult woman ${agePart}, with ${joinAnd(traits)}.`;
      } else if (agePart) {
        sentence = `The subject is a clearly adult woman ${agePart}.`;
      } else if (traits.length > 0) {
        sentence = `The subject is a clearly adult woman, with ${joinAnd(traits)}.`;
      } else {
        sentence = "The subject is a clearly adult woman.";
      }
      parts.push(sentence);
    }
    // Future extension point: male, androgynous, non_binary
  }

  // ── 2. Hair sentence ────────────────────────────────────────────────────────
  {
    const color   = phrase(HAIR_COLOR_MAP, val(m.hair?.color));
    const texture = phrase(HAIR_TEXTURE_MAP, val(m.hair?.texture));
    const length  = phrase(HAIR_LENGTH_MAP, val(m.hair?.length));
    const described = [length, color, texture].filter(Boolean);

    if (described.length > 0) {
      parts.push(`Her hair is ${joinAnd(described)}, with natural volume and visible strand detail.`);
    }
  }

  // ── 3. Eyes sentence ────────────────────────────────────────────────────────
  {
    const color = phrase(EYES_COLOR_MAP, val(m.eyes?.color));
    const shape = phrase(EYES_SHAPE_MAP, val(m.eyes?.shape));

    if (color && shape) {
      parts.push(`Her eyes are ${color} and ${shape}.`);
    } else if (color) {
      parts.push(`Her eyes are ${color}.`);
    } else if (shape) {
      parts.push(`Her eyes are ${shape}.`);
    }
  }

  // ── 4. Body sentence ────────────────────────────────────────────────────────
  {
    const type = phrase(BODY_TYPE_MAP, val(m.body?.type));
    if (type) {
      parts.push(`Her body is ${type}, forming a balanced feminine silhouette.`);
    }
  }

  // ── 5. Accessories sentence ─────────────────────────────────────────────────
  {
    const glasses = phraseNoNone(GLASSES_MAP, val(m.accessories?.glasses));
    const jewelry = phraseNoNone(JEWELRY_MAP, val(m.accessories?.jewelry));
    const accParts = [glasses, jewelry].filter(Boolean);

    if (accParts.length > 0) {
      parts.push(`She is wearing ${joinAnd(accParts)}.`);
    }
  }

  // ── 6. Styling sentence ─────────────────────────────────────────────────────
  {
    const vibe = phrase(STYLE_VIBE_MAP, val(m.style?.vibe));

    if (vibe) {
      const makeupPhrase   = phraseNoNone(MAKEUP_MAP, val(m.style?.makeup));
      const glassesPresent = phraseNoNone(GLASSES_MAP, val(m.accessories?.glasses));
      const jewelryPresent = phraseNoNone(JEWELRY_MAP, val(m.accessories?.jewelry));
      const hasAccessories = !!(glassesPresent || jewelryPresent);

      const suffixes = [];
      if (makeupPhrase)    suffixes.push(`with ${makeupPhrase} makeup`);
      if (!hasAccessories) suffixes.push("with no visible accessories");

      const suffix = suffixes.length > 0 ? `, ${suffixes.join(", ")}` : "";
      parts.push(`Her styling is ${vibe}${suffix}.`);
    }
  }

  return parts.join("\n");
}

// ── Fixed blocks ──────────────────────────────────────────────────────────────
// These are immutable. Never modified by model data.

const BLOCK_INTRO = `Ultra photorealistic 8k vertical 9:16 image, shot like a smartphone photo with a 24mm lens, in a high-end social media realism style with natural skin texture and no over-smoothing.`;

const BLOCK_SCENE = `The scene takes place in a cozy dimly-lit bedroom at night, with an intimate, artistic, private mood. The environment includes unmade white bed sheets, soft pillows, a minimalist wooden desk in the background, a neutral-colored wall, and framed Mona Lisa and Starry Night prints with subtle reflections on the glass.`;

const BLOCK_LIGHTING = `Lighting is warm ambient from a soft bedside lamp, creating low-contrast shadows, soft highlights, and cinematic depth.`;

const BLOCK_CAMERA = `The camera perspective is slightly above bed level, framing the subject from mid-thigh to head, with a close and intimate distance. The subject is in sharp focus while the background remains softly blurred.`;

const BLOCK_WARDROBE = `--- WARDROBE (STRICT CONTROL) ---

She is wearing a simple, minimal indoor outfit consisting of a clean white cropped tank top and fitted black short tights. The clothing is lightweight and natural, following the body's form without distortion, allowing the silhouette and proportions to remain clearly readable.

Fabric interaction is realistic — soft folds, slight tension around movement areas, and natural contact with the skin. The outfit feels casual and unforced, appropriate for a relaxed indoor evening setting, without shifting into lingerie or overly stylized fashion.

--- END MODEL ---`;

const BLOCK_CLOSING = `Visible details include realistic skin texture with micro-variation, natural fabric interaction, soft highlight transitions, and a photographic realism that feels like a real captured moment rather than a generated image.

The overall image should feel indistinguishable from a real late-night smartphone photo.`;

// ── Main builder ──────────────────────────────────────────────────────────────

function buildFinalImagePrompt(modelJson) {
  if (!modelJson) return "";

  const identity = buildModelIdentityBlock(modelJson);

  return [
    BLOCK_INTRO,
    "",
    BLOCK_SCENE,
    "",
    BLOCK_LIGHTING,
    "",
    BLOCK_CAMERA,
    "",
    "--- MODEL IDENTITY ---",
    "",
    identity,
    "",
    BLOCK_WARDROBE,
    "",
    BLOCK_CLOSING,
  ].join("\n");
}

module.exports = { buildFinalImagePrompt, buildModelIdentityBlock };
