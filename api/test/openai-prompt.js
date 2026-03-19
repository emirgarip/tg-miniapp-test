const OpenAI = require("openai");
const { getDb } = require("../../backend/db/mongo");
const {
  EXTRACTION_SYSTEM_PROMPT,
  DEFAULT_CHARACTER_SPEC,
  NEGATIVE_PROMPT,
} = require("./prompt-config");

const MODEL = "gpt-4.1-mini";

function firstJsonObject(text) {
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

function mergeSpec(rawSpec = {}) {
  const spec = { ...DEFAULT_CHARACTER_SPEC, ...rawSpec };

  // Controlled body emphasis mapping.
  const strength = String(spec.body_emphasis_strength || "medium").toLowerCase();
  if (!["low", "medium", "high"].includes(strength)) {
    spec.body_emphasis_strength = "medium";
  } else {
    spec.body_emphasis_strength = strength;
  }

  if (spec.body_emphasis_strength === "high") {
    spec.body =
      "well-proportioned silhouette with emphasized yet believable curves, balanced hips and legs, graceful body lines, and realistic anatomy";
  } else if (spec.body_emphasis_strength === "medium") {
    spec.body =
      "balanced curvy proportions with controlled emphasis on silhouette, natural posture, and believable anatomy";
  } else {
    spec.body =
      "natural balanced proportions, subtle silhouette definition, and realistic anatomy";
  }

  return spec;
}

function composeFinalPrompt(spec) {
  return [
    `Subject overview: ${spec.gender}, ${spec.framing}, realistic editorial portrait intent with clear visual identity.`,
    `Age anchor: adult subject in the ${spec.age_range} range, explicitly adult with policy-safe characterization.`,
    `Face details: ${spec.face}.`,
    `Hair: ${spec.hair}.`,
    `Eyes and expression: ${spec.eyes}; ${spec.expression}.`,
    `Body and posture: ${spec.body}; ${spec.pose}.`,
    `Clothing and styling: ${spec.clothing}.`,
    `Environment and background: ${spec.environment}.`,
    `Lighting: ${spec.lighting}.`,
    `Camera and composition: ${spec.camera}.`,
    `Rendering quality and realism notes: ${spec.realism_quality}.`,
    `Negative prompt: ${NEGATIVE_PROMPT}.`,
  ].join("\n");
}

function composeStructuredAnalysis(raw, spec) {
  const a = raw?.structured_analysis || {};
  return [
    "Structured Analysis",
    `- Input language: ${a.input_language || raw?.input_language || "unknown"}`,
    `- Subject type: ${a.subject_type || raw?.subject_type || "adult portrait subject"}`,
    `- Face details: ${a.face_details || spec.face}`,
    `- Body details: ${a.body_details || spec.body}`,
    `- Clothing/styling: ${a.clothing_styling || spec.clothing}`,
    `- Scene/environment: ${a.scene_environment || spec.environment}`,
    `- Visual style: ${a.visual_style || spec.realism_quality}`,
    `- Safety adjustments applied: ${a.safety_adjustments_applied || spec.safety_adjustments || "none"}`,
  ].join("\n");
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "OPENAI_API_KEY is not configured." });
  }

  const inputText = String(req.body?.input || "").trim();
  if (inputText.length < 20) {
    return res.status(400).json({ error: "Please enter at least 20 characters." });
  }

  const startedAt = Date.now();

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await client.responses.create({
      model: MODEL,
      instructions: EXTRACTION_SYSTEM_PROMPT,
      input: inputText,
    });

    const output = (response.output_text || "").trim();
    const latencyMs = Date.now() - startedAt;

    const parsed = firstJsonObject(output);
    if (!parsed) {
      throw new Error("Model did not return valid JSON for character spec extraction.");
    }

    const refusal =
      !!parsed.refusal ||
      !!parsed?.safety_flags?.minor_or_ambiguous_underage ||
      !!parsed?.safety_flags?.illegal_or_exploitative;

    const mergedSpec = mergeSpec(parsed.character_spec || {});
    const structuredAnalysis = composeStructuredAnalysis(parsed, mergedSpec);
    const finalPrompt = refusal
      ? "Request refused for safety reasons: the input implies a minor/ambiguous underage or illegal/exploitative context. Please provide a clearly adult, policy-safe request."
      : composeFinalPrompt(mergedSpec);

    const db = await getDb();
    await db.collection("ai_logs").insertOne({
      provider: "openai",
      model: MODEL,
      type: "prompt_generation",
      latency_ms: latencyMs,
      estimated_cost: 0.00002,
      created_at: new Date(),
    });

    return res.status(200).json({
      provider: "openai",
      model: MODEL,
      type: "prompt_generation",
      structured_analysis: structuredAnalysis,
      character_spec: mergedSpec,
      final_prompt: finalPrompt,
      prompt: finalPrompt,
      latency_ms: latencyMs,
    });
  } catch (err) {
    console.error("OpenAI prompt error:", err);
    return res.status(500).json({ error: "Failed to generate prompt" });
  }
};

