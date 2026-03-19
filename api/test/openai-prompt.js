const OpenAI = require("openai");
const { getDb } = require("../../backend/db/mongo");
const { SYSTEM_PROMPT } = require("./prompt-config");

const MODEL = "gpt-4.1-mini";

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
      instructions: SYSTEM_PROMPT,
      input: inputText,
    });

    const output = (response.output_text || "").trim();
    const latencyMs = Date.now() - startedAt;

    const finalPromptMarker = "Final Prompt";
    const markerIndex = output.indexOf(finalPromptMarker);
    const finalPrompt =
      markerIndex >= 0
        ? output.slice(markerIndex + finalPromptMarker.length).trim()
        : output;
    const structuredAnalysis =
      markerIndex >= 0 ? output.slice(0, markerIndex).trim() : "Structured Analysis\n- Not available";

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
      final_prompt: finalPrompt,
      prompt: finalPrompt,
      latency_ms: latencyMs,
    });
  } catch (err) {
    console.error("OpenAI prompt error:", err);
    return res.status(500).json({ error: "Failed to generate prompt" });
  }
};

