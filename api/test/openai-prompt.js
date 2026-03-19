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

function normalizeAgeRange(value) {
  if (!value) return null;
  const s = String(value).trim();
  const range = s.match(/(\d{2})\s*[-–]\s*(\d{2})/);
  if (range) return `${range[1]}-${range[2]}`;
  const single = s.match(/\b(\d{2})\b/);
  if (!single) return null;
  const n = parseInt(single[1], 10);
  if (!Number.isFinite(n)) return null;
  const min = Math.max(18, n - 5);
  const max = Math.max(min + 4, n + 5);
  return `${min}-${max}`;
}

function chooseBodyStrength(emphasis) {
  const txt = String(emphasis || "").toLowerCase();
  if (!txt) return "medium";
  if (txt.includes("extreme") || txt.includes("very strong")) return "high";
  if (txt.includes("subtle") || txt.includes("light")) return "low";
  return "medium";
}

function fromExtraction(extracted = {}) {
  const out = {};
  for (const [k, v] of Object.entries(extracted)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = {};
      for (const [kk, vv] of Object.entries(v)) {
        out[k][kk] = { value: vv ?? null, source: vv == null ? null : "user" };
      }
    } else {
      out[k] = { value: v ?? null, source: v == null ? null : "user" };
    }
  }
  return out;
}

function applyDefaults(extractedSpec) {
  const spec = fromExtraction(extractedSpec);

  function ensure(path, fallback) {
    const parts = path.split(".");
    let cur = spec;
    for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
    const last = parts[parts.length - 1];
    if (!cur[last] || cur[last].value == null || cur[last].value === "") {
      cur[last] = { value: fallback, source: "auto" };
    }
  }

  ensure("gender", DEFAULT_CHARACTER_SPEC.gender);
  const normalizedAge = normalizeAgeRange(spec.age_range?.value);
  spec.age_range = {
    value: normalizedAge || DEFAULT_CHARACTER_SPEC.age_range,
    source: normalizedAge ? (spec.age_range?.source || "user") : "auto",
  };
  ensure("framing", DEFAULT_CHARACTER_SPEC.framing);
  ensure("face", DEFAULT_CHARACTER_SPEC.face);
  ensure("hair.color", DEFAULT_CHARACTER_SPEC.hair.color);
  ensure("hair.style", DEFAULT_CHARACTER_SPEC.hair.style);
  ensure("eyes.color", DEFAULT_CHARACTER_SPEC.eyes.color);
  ensure("eyes.details", DEFAULT_CHARACTER_SPEC.eyes.details);
  ensure("expression", DEFAULT_CHARACTER_SPEC.expression);
  ensure("body.proportions", DEFAULT_CHARACTER_SPEC.body.proportions);
  ensure("body.emphasis", DEFAULT_CHARACTER_SPEC.body.emphasis);

  const userBodyEmphasis = spec.body.emphasis.value;
  const strength = chooseBodyStrength(userBodyEmphasis || spec.body.emphasis_strength?.value);
  spec.body.emphasis_strength = {
    value: strength,
    source: spec.body.emphasis_strength?.source || (userBodyEmphasis ? "user" : "auto"),
  };

  if (spec.body.emphasis.source !== "user") {
    if (strength === "high") {
      spec.body.emphasis = {
        value:
          "emphasis on hips and legs with controlled, believable anatomy and graceful body lines",
        source: "auto",
      };
    } else if (strength === "low") {
      spec.body.emphasis = {
        value: "subtle emphasis on natural silhouette and posture",
        source: "auto",
      };
    } else {
      spec.body.emphasis = {
        value: "balanced emphasis on silhouette with realistic proportions",
        source: "auto",
      };
    }
  }

  ensure("pose", DEFAULT_CHARACTER_SPEC.pose);
  ensure("clothing", DEFAULT_CHARACTER_SPEC.clothing);
  ensure("environment.type", DEFAULT_CHARACTER_SPEC.environment.type);
  ensure("environment.details", DEFAULT_CHARACTER_SPEC.environment.details);
  ensure("lighting", DEFAULT_CHARACTER_SPEC.lighting);
  ensure("camera", DEFAULT_CHARACTER_SPEC.camera);
  ensure("realism_quality", DEFAULT_CHARACTER_SPEC.realism_quality);
  ensure("safety_adjustments", DEFAULT_CHARACTER_SPEC.safety_adjustments);

  return spec;
}

function composeFinalPrompt(spec) {
  const v = (p) => p.value;
  return [
    `Subject overview: ${v(spec.gender)}, ${v(spec.framing)}, with coherent visual identity and realistic editorial presence.`,
    `Age anchor: adult subject in the ${v(spec.age_range)} range.`,
    `Face details: ${v(spec.face)}.`,
    `Hair: ${v(spec.hair.color)} hair, ${v(spec.hair.style)}.`,
    `Eyes and expression: ${v(spec.eyes.color)} eyes, ${v(spec.eyes.details)}, ${v(spec.expression)}.`,
    `Body and posture: ${v(spec.body.proportions)}, ${v(spec.body.emphasis)}, ${v(spec.pose)}.`,
    `Clothing and styling: ${v(spec.clothing)}.`,
    `Environment and background: ${v(spec.environment.type)} setting, ${v(spec.environment.details)}.`,
    `Lighting: ${v(spec.lighting)} with visible directionality and natural shadow depth.`,
    `Camera and composition: ${v(spec.camera)}.`,
    `Rendering quality and realism notes: ${v(spec.realism_quality)} with environmental depth, texture fidelity, and believable material response.`,
    `Negative prompt: ${NEGATIVE_PROMPT}.`,
  ].join("\n");
}

function composeStructuredAnalysis(raw, finalSpec) {
  const a = raw?.structured_analysis || {};
  const v = (x) => x?.value;
  return [
    "Structured Analysis",
    `- Input language: ${a.input_language || raw?.input_language || "unknown"}`,
    `- Subject type: ${a.subject_type || raw?.subject_type || "adult portrait subject"}`,
    `- Face details: ${a.face_details || v(finalSpec.face)}`,
    `- Body details: ${a.body_details || `${v(finalSpec.body.proportions)}; ${v(finalSpec.body.emphasis)}`}`,
    `- Clothing/styling: ${a.clothing_styling || v(finalSpec.clothing)}`,
    `- Scene/environment: ${a.scene_environment || `${v(finalSpec.environment.type)}; ${v(finalSpec.environment.details)}`}`,
    `- Visual style: ${a.visual_style || v(finalSpec.realism_quality)}`,
    `- Safety adjustments applied: ${a.safety_adjustments_applied || v(finalSpec.safety_adjustments) || "none"}`,
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

    const extracted = parsed.extracted || {};
    const finalSpec = applyDefaults(extracted);
    const extractedAttributes = [];
    const autoFilledAttributes = [];
    const walk = (node, prefix = "") => {
      if (!node || typeof node !== "object") return;
      for (const [k, v] of Object.entries(node)) {
        const key = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === "object" && "value" in v && "source" in v) {
          if (v.source === "user") extractedAttributes.push(`${key}: ${v.value}`);
          if (v.source === "auto") autoFilledAttributes.push(`${key}: ${v.value}`);
        } else {
          walk(v, key);
        }
      }
    };
    walk(finalSpec);

    const structuredAnalysis = composeStructuredAnalysis(parsed, finalSpec);
    const finalPrompt = refusal
      ? "Request refused for safety reasons: the input implies a minor/ambiguous underage or illegal/exploitative context. Please provide a clearly adult, policy-safe request."
      : composeFinalPrompt(finalSpec);

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
      extracted_attributes: extractedAttributes,
      auto_filled_attributes: autoFilledAttributes,
      character_spec: finalSpec,
      final_prompt: finalPrompt,
      prompt: finalPrompt,
      latency_ms: latencyMs,
    });
  } catch (err) {
    console.error("OpenAI prompt error:", err);
    return res.status(500).json({ error: "Failed to generate prompt" });
  }
};

