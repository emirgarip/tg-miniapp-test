const OpenAI = require("openai");
const { getDb } = require("../../backend/db/mongo");
const { INSTRUCTION, INPUT_TEXT } = require("./prompt-config");

const MODEL = "gpt-4.1-mini";

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "OPENAI_API_KEY is not configured." });
  }

  const startedAt = Date.now();

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await client.responses.create({
      model: MODEL,
      instructions: INSTRUCTION,
      input: INPUT_TEXT,
    });

    const prompt = (response.output_text || "").trim();
    const latencyMs = Date.now() - startedAt;

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
      prompt,
      latency_ms: latencyMs,
    });
  } catch (err) {
    console.error("OpenAI prompt error:", err);
    return res.status(500).json({ error: "Failed to generate prompt" });
  }
};

