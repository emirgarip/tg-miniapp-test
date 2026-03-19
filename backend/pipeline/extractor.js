// STEP A — Extraction
// Calls gpt-4.1-mini with the strict extraction-only system prompt.
// Returns a validated extraction object; throws on invalid JSON or refusal.

const OpenAI = require("openai");
const { EXTRACTION_SYSTEM_PROMPT } = require("./prompt-config");

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

async function extract(inputText, apiKey, model = "gpt-4.1-mini") {
  const client = new OpenAI({ apiKey });

  const response = await client.responses.create({
    model,
    instructions: EXTRACTION_SYSTEM_PROMPT,
    input: inputText,
  });

  const raw = (response.output_text || "").trim();
  const parsed = firstJson(raw);

  if (!parsed) {
    throw new Error(
      `Extraction failed: model did not return valid JSON. Raw output: ${raw.slice(0, 200)}`
    );
  }

  const refusal =
    !!parsed.refusal ||
    !!parsed?.safety_flags?.minor_or_ambiguous_underage ||
    !!parsed?.safety_flags?.illegal_or_exploitative;

  return {
    input_language: parsed.input_language || "unknown",
    subject_type: parsed.subject_type || "portrait subject",
    refusal,
    safety_reason: parsed.safety_reason || null,
    safety_flags: parsed.safety_flags || {},
    extracted: parsed.extracted || {},
  };
}

module.exports = { extract };
