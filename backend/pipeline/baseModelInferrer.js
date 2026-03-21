// AI Call #2 — Controlled inference only.
//
// Receives the partially built model (user values + required defaults already applied).
// Infers ONLY the 4 allowed inferrable fields from that context.
// Never changes user-provided or defaulted fields.

const OpenAI = require("openai");
const { INFERRABLE_FIELDS, sanitize } = require("./baseModelDefaults");

const SYSTEM_PROMPT = `
You are a PHYSICAL INFERENCE ASSISTANT for a model profile system.

You will receive a partially filled model profile JSON (already containing user-provided and default values).

Your ONLY job: infer values for these 4 specific fields if the existing profile gives you enough context:
  - body_height_impression: petite | average | tall
  - body_waist: narrow | defined | average | full
  - body_hips: narrow | balanced | wide | full
  - body_legs: slim | balanced | athletic | full

RULES:
- Use the existing "body_type" as your primary signal. Examples:
    slim → waist: narrow, hips: narrow, legs: slim
    slim_curvy → waist: defined, hips: wide, legs: balanced
    athletic → waist: defined, hips: balanced, legs: athletic
    curvy → waist: defined, hips: wide, legs: full
    full_figured → waist: full, hips: full, legs: full
    petite → height_impression: petite, waist: narrow
    plus_size → waist: full, hips: full
- Only infer if you are confident. If uncertain about a field, return null for it.
- Do NOT change any other field — only output the 4 listed fields.
- Do NOT infer celebrity likeness, pose, environment, or scenario.
- Do NOT hallucinate. Prefer null over a weak guess.

Return ONLY this JSON:
{
  "body_height_impression": null,
  "body_waist": null,
  "body_hips": null,
  "body_legs": null
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

// Strip source tags and null values from the partial flat model before sending to LLM.
// Only send fields that have a value — gives the model clean, readable context.
function buildContext(partialFlat) {
  const context = {};
  for (const [key, tagged] of Object.entries(partialFlat)) {
    if (tagged.value !== null) {
      context[key] = tagged.value;
    }
  }
  return context;
}

async function inferBaseModelFields(partialFlat, apiKey, model = "gpt-4.1-mini") {
  const client = new OpenAI({ apiKey });
  const context = buildContext(partialFlat);

  const response = await client.responses.create({
    model,
    instructions: SYSTEM_PROMPT,
    input: JSON.stringify(context, null, 2),
  });

  const raw = (response.output_text || "").trim();
  const parsed = firstJson(raw);

  if (!parsed) {
    console.warn("[baseModelInferrer] Invalid JSON from model — skipping inference.");
    return {};
  }

  // Validate and return only the allowed inferrable fields.
  const result = {};
  for (const field of INFERRABLE_FIELDS) {
    const val = sanitize(field, parsed[field]);
    if (val !== null) result[field] = val;
  }
  return result;
}

module.exports = { inferBaseModelFields };
