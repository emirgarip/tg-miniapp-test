const { GoogleGenAI } = require("@google/genai");
const { getDb } = require("../../backend/db/mongo");
const { INSTRUCTION, INPUT_TEXT } = require("./prompt-config");

const MODEL = "gemini-2.5-flash";

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not configured." });
  }

  const startedAt = Date.now();

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const resp = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [{ text: INSTRUCTION + "\n\nTurkish input:\n" + INPUT_TEXT }],
        },
      ],
    });

    const prompt = (resp?.text || "").trim();
    const latencyMs = Date.now() - startedAt;

    const db = await getDb();
    await db.collection("ai_logs").insertOne({
      provider: "gemini",
      model: MODEL,
      type: "prompt_generation",
      latency_ms: latencyMs,
      estimated_cost: 0,
      created_at: new Date(),
    });

    return res.status(200).json({
      provider: "gemini",
      model: MODEL,
      type: "prompt_generation",
      prompt,
      latency_ms: latencyMs,
    });
  } catch (err) {
    console.error("Gemini prompt error:", err);
    return res.status(500).json({ error: "Failed to generate prompt" });
  }
};

