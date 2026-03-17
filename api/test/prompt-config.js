const INSTRUCTION = `
Convert the Turkish text into a single clean professional English prompt for photorealistic canonical studio portrait generation.

Rules:
- Output language: English
- Output ONLY the prompt
- Make it detailed (80-140 words)
- Include: neutral studio lighting, clean background, photorealistic skin texture, mid‑torso framing
`.trim();

const INPUT_TEXT =
  'bu kadinin promptunu olustur; kizil sacli, yesil gozlu, hafif cilleri olan. sonuc olarak canonical bir portre istiyorum. buna uygun prompt yazarmisin, image istemiyorum eksinlikle sadece prompt!';

module.exports = { INSTRUCTION, INPUT_TEXT };
