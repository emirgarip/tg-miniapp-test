// AI Call #1 — Explicit extraction only.
//
// Extracts ONLY what the user directly stated. No inference, no guessing.

const OpenAI = require("openai");

const SYSTEM_PROMPT = `
You are a PHYSICAL ATTRIBUTE EXTRACTOR for a model profile system.

Your ONLY job: extract physical appearance traits the user EXPLICITLY stated in their input.
Input language: ANY. Understand meaning semantically, language-agnostically.
Output: JSON only — no prose, no explanation, no markdown.

STRICT RULES:
- Extract ONLY what the user directly and explicitly stated.
- Do NOT infer, guess, or derive anything beyond what is literally described.
- IGNORE completely: poses, environments, lighting, camera, scenarios, emotional content,
  relationship language, erotic content, celebrity names, realism/prompt instructions.
- Do NOT reject input for irrelevant content — just extract physical traits and ignore the rest.
- Celebrity names: always leave all fields null. Celebrity similarity is disabled.
- Age safety: if the user clearly implies or states a subject UNDER 20 years old,
  set "age_rejected": true and return immediately (all other fields stay null).
- Age conversion: convert a specific age to the nearest range.
  Ranges: "20-24" | "25-29" | "30-34" | "35-39" | "40-44" | "45-50" | "50+"

ALLOWED VALUES — only use these exactly, or null if the user did not explicitly state it:
  gender_presentation: female | male | androgynous | non_binary
  age_range: 20-24 | 25-29 | 30-34 | 35-39 | 40-44 | 45-50 | 50+
  heritage_look: east_asian | south_asian | southeast_asian | middle_eastern | black_african | latin_hispanic | eastern_european | western_european | scandinavian | mediterranean | mixed_ambiguous
  skin_tone: fair | light | light_olive | olive | warm_beige | tan | medium_brown | brown | deep_brown | ebony
  hair_color: black | dark_brown | medium_brown | light_brown | auburn | red | strawberry_blonde | dark_blonde | blonde | platinum_blonde | silver | white | dyed_unusual
  hair_texture: straight | slightly_wavy | wavy | curly | coily | kinky
  hair_length: very_short | short | chin_length | shoulder_length | long | very_long
  eyes_color: brown | dark_brown | hazel | green | blue | gray | amber
  eyes_shape: almond | round | monolid | hooded | upturned | downturned | wide_set | close_set
  face_shape: oval | round | square | heart | oblong | diamond | triangle
  face_jawline: sharp | defined | softly_defined | rounded | soft
  face_nose: straight | button | upturned | roman | wide | narrow | snub
  face_lips: full | balanced | thin | wide | cupids_bow | pouty
  face_cheekbones: high | prominent | balanced | soft | flat
  face_skin_details: none | freckles | moles | scars | dimples
  body_type: petite | slim | slim_curvy | athletic | curvy | full_figured | plus_size
  body_height_impression: petite | average | tall
  body_bust: small | balanced | full | large
  body_waist: narrow | defined | average | full
  body_hips: narrow | balanced | wide | full
  body_legs: slim | balanced | athletic | full
  body_feet_focus: none | visible | emphasized
  style_vibe: natural | elegant | edgy | sporty | glamorous | bohemian | minimalist
  style_makeup: none | minimal | natural | bold | dramatic | artistic
  accessories_glasses: none | thin_frame | thick_frame | sunglasses | cat_eye | round
  accessories_jewelry: none | minimal | statement | earrings_only | layered

CRITICAL — accessories "none" meaning:
  "none" means the user has NO glasses / NO jewelry at all, or did not mention them.
  "none" does NOT mean "glasses mentioned but type unknown."

  If the user says they wear glasses (in any language, e.g. "gözlüklü", "mit Brille", "wearing glasses",
  "glasses", "lunettes") but does NOT specify the frame style:
    → use "thin_frame" as the default type — do NOT use "none"

  If the user mentions jewelry (in any language) but does NOT specify the type:
    → use "minimal" as the default type — do NOT use "none"

  Only use "none" when:
    - The user explicitly says they have no glasses / no jewelry
    - The user did not mention glasses / jewelry at all (leave null instead)

Return ONLY this JSON:
{
  "age_rejected": false,
  "explicit": {
    "gender_presentation": null,
    "age_range": null,
    "heritage_look": null,
    "skin_tone": null,
    "hair_color": null,
    "hair_texture": null,
    "hair_length": null,
    "eyes_color": null,
    "eyes_shape": null,
    "face_shape": null,
    "face_jawline": null,
    "face_nose": null,
    "face_lips": null,
    "face_cheekbones": null,
    "face_skin_details": null,
    "body_type": null,
    "body_height_impression": null,
    "body_bust": null,
    "body_waist": null,
    "body_hips": null,
    "body_legs": null,
    "body_feet_focus": null,
    "style_vibe": null,
    "style_makeup": null,
    "accessories_glasses": null,
    "accessories_jewelry": null
  }
}
`.trim();

function firstJson(text) {
  const s = String(text || "");
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch (_) {
    return null;
  }
}

async function extractBaseModelExplicit(inputText, apiKey, model = "gpt-4.1-mini") {
  const client = new OpenAI({ apiKey });

  const response = await client.responses.create({
    model,
    instructions: SYSTEM_PROMPT,
    input: inputText,
  });

  const raw = (response.output_text || "").trim();
  const parsed = firstJson(raw);

  if (!parsed) {
    console.warn("[baseModelExtractor] Invalid JSON from model — using empty extraction.");
    return { age_rejected: false, explicit: {} };
  }

  return {
    age_rejected: !!parsed.age_rejected,
    explicit: parsed.explicit || {},
  };
}

module.exports = { extractBaseModelExplicit };
