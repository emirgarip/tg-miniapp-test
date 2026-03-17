const { GoogleGenAI } = require("@google/genai");
const { getDb } = require("../../backend/db/mongo");

const MODEL = "gemini-2.5-flash";
const INPUT_TEXT =
  'bu kadinin promptunu olustur; kizil sacli, yesil gozlu, hafif cilleri olan. sonuc olarak canonical bir portre istiyorum. buna uygun prompt yazarmisin, image istemiyorum eksinlikle sadece prompt!';

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
          parts: [
            {
              text:
                "Convert the Turkish text into a single clean professional English prompt for photorealistic canonical studio portrait generation.\n\nRules:\n- Output language: English\n- Output ONLY the prompt (no headings, no markdown, no quotes, no explanations)\n- Make it detailed (aim for ~80-140 words)\n- Must explicitly mention: neutral studio lighting, clean/simple background, photorealistic skin texture, stable facial identity, mid-torso (upper body) framing, simple white cotton t-shirt with no logos, calm neutral expression with natural eye contact\n- Do NOT include technical camera/lens settings (no mm, no f-stop, no HDR, no color grading jargon)\n\nTurkish input:\n" +
                INPUT_TEXT,
            },
          ],
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

