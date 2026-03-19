const EXTRACTION_SYSTEM_PROMPT = `
You are STEP A (Extraction) in a 3-step prompt pipeline.
Input may be in ANY language. Understand semantics language-agnostically.

CRITICAL FOR STEP A:
- Extract only what the user explicitly states or very clearly implies.
- Do NOT invent missing details.
- Do NOT complete defaults.
- Preserve user intent exactly (normalized to English).
- If attribute is missing, set value to null.
- If attribute exists, keep meaning unchanged.

Safety:
- If user implies a minor or ambiguous underage subject, set refusal=true.
- If user includes illegal/exploitative content, set refusal=true.
- If user requests explicit sexual/nudity content, do not reproduce explicitly; describe this in safety_adjustments and keep extraction policy-safe.
- If user requests real person/celebrity replication, convert to "fictional adult inspired by general traits" in safety_adjustments.

Age rule:
- Return numeric age range only (e.g. "25-30", "35-45") when age is provided/implied.
- Do not output vague values like "adult", "young", "mature" for age_range.

Return ONLY valid JSON, no markdown, no extra text, with this exact shape:
{
  "input_language": "string",
  "subject_type": "string",
  "refusal": false,
  "safety_reason": "string|null",
  "safety_flags": {
    "minor_or_ambiguous_underage": false,
    "explicit_or_nudity_request": false,
    "real_person_or_celebrity_request": false,
    "illegal_or_exploitative": false
  },
  "extracted": {
    "gender": null,
    "age_range": null,
    "framing": null,
    "face": null,
    "hair": { "color": null, "style": null },
    "eyes": { "color": null, "details": null },
    "expression": null,
    "body": { "proportions": null, "emphasis": null, "emphasis_strength": null },
    "pose": null,
    "clothing": null,
    "environment": { "type": null, "details": null },
    "lighting": null,
    "camera": null,
    "realism_quality": null,
    "safety_adjustments": null
  }
}
`.trim();

const DEFAULT_CHARACTER_SPEC = {
  gender: "adult woman",
  age_range: "25-30",
  framing: "mid-torso portrait framing",
  face: "balanced facial proportions, natural skin tone, soft natural skin texture with visible pores",
  hair: {
    color: "natural dark blonde",
    style: "soft layered strands with realistic flyaways and refined texture",
  },
  eyes: {
    color: "natural hazel",
    details: "clear eyes with soft catchlights and natural eye definition",
  },
  expression: "calm confident expression with relaxed facial muscles",
  body: {
    proportions: "balanced proportions with a believable silhouette",
    emphasis: "controlled emphasis on natural body lines",
    emphasis_strength: "medium",
  },
  pose: "relaxed upright posture with graceful shoulder and neck alignment",
  clothing: "refined contemporary wardrobe with realistic fabric weave and subtle folds",
  environment: {
    type: "studio",
    details: "clean background with soft environmental depth and subtle tonal variation",
  },
  lighting: "soft natural daylight from one side with gentle fill and realistic shadow falloff",
  camera:
    "85mm portrait lens feel, shallow cinematic depth of field, sharp subject focus and naturally blurred background",
  realism_quality:
    "photorealistic skin texture, visible pores, individual hair strands, natural color grading, high dynamic range",
  safety_adjustments: "none",
};

const NEGATIVE_PROMPT =
  "no text, no watermark, no distortion, no extra limbs, no unnatural anatomy, no blur";

module.exports = {
  EXTRACTION_SYSTEM_PROMPT,
  DEFAULT_CHARACTER_SPEC,
  NEGATIVE_PROMPT,
};
