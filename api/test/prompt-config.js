// STEP A: Extraction-only system prompt for gpt-4.1-mini.
// The model must ONLY extract. It must NOT write the final prompt.
const EXTRACTION_SYSTEM_PROMPT = `
You are STEP A (Extraction) of a strict multi-step image-prompt pipeline.
Your ONLY job is to extract explicit visual attributes from the user's input.

Input language: ANY. Understand meaning semantically, language-agnostically.
Output language: English only, JSON only.

CRITICAL RULES:
- Extract ONLY what the user explicitly states or directly implies.
- Do NOT invent, assume, or complete missing fields.
- Do NOT write a final image prompt.
- Do NOT enrich or creatively expand the user's request.
- Do NOT override the user's stated values.
- If a field is not provided, set it to null.
- Normalize crude wording into safe, visually useful English equivalents.

AGE RULES:
- If age is explicitly stated, convert to numeric range (e.g. "25-30", "35-45").
- If age is implied (e.g. "young woman" = 20-28, "middle-aged" = 38-50), convert.
- If no age is provided, set age_range = null.
- Never output vague strings like "adult", "young", or "mature" for age_range.

SAFETY:
- If input implies a minor or ambiguous underage subject, set refusal=true.
- If input includes illegal or exploitative content, set refusal=true.
- If input requests explicit sexual content or nudity, do not include literally; note in safety_adjustments with a safe equivalent.
- If input requests real person or celebrity replication, set safety_adjustments to "fictional adult character inspired by general traits".

Return ONLY valid JSON matching this exact shape (no markdown, no explanation):
{
  "input_language": "string",
  "subject_type": "string",
  "refusal": false,
  "safety_reason": null,
  "safety_flags": {
    "minor_or_ambiguous_underage": false,
    "explicit_or_nudity_request": false,
    "real_person_or_celebrity_request": false,
    "illegal_or_exploitative": false
  },
  "extracted": {
    "gender": null,
    "age_range": null,
    "face": null,
    "hair": { "color": null, "style": null },
    "eyes": { "color": null, "details": null },
    "expression": null,
    "body": { "type": null, "emphasis": null, "emphasis_strength": null },
    "pose": null,
    "clothing": null,
    "environment": { "type": null, "details": null },
    "lighting": null,
    "camera": null,
    "style_cues": null,
    "safety_adjustments": null
  }
}
`.trim();

// Sensible defaults used by the normalizer for missing fields.
const DEFAULTS = {
  gender: "adult woman",
  age_range: "25-30",
  face: "balanced facial proportions, natural skin tone, realistic skin texture",
  hair: {
    color: "dark blonde",
    style: "natural fall with soft layered strands",
  },
  eyes: {
    color: "hazel",
    details: "clear definition with soft natural catchlights",
  },
  expression: "calm, confident",
  body: {
    type: "balanced proportions",
    emphasis: "natural silhouette",
    emphasis_strength: "medium",
  },
  pose: "relaxed upright posture",
  clothing: "contemporary wardrobe, refined styling",
  environment: {
    type: "studio",
    details: "clean background with soft depth",
  },
  lighting: null, // resolved by planner from environment
  camera: null,   // resolved by planner from subject_emphasis
  style_cues: "photorealistic",
  safety_adjustments: "none",
};

const NEGATIVE_PROMPT =
  "no text, no watermark, no distortion, no extra limbs, no unnatural anatomy, no blur, no chromatic aberration";

module.exports = {
  EXTRACTION_SYSTEM_PROMPT,
  DEFAULTS,
  NEGATIVE_PROMPT,
};
