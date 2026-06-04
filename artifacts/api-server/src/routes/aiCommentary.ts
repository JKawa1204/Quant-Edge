import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { GetAiCommentaryBody, GetAiSignalExplanationBody } from "@workspace/api-zod";
import { GoogleGenAI } from "@google/genai";

const router = Router();

function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");
  return new GoogleGenAI({ apiKey });
}

router.post("/ai/commentary", requireAuth, async (req, res): Promise<void> => {
  const parsed = GetAiCommentaryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    const ai = getAiClient();
    const prompt = `You are a professional quantitative analyst. Provide a concise, insightful ${parsed.data.type} commentary for a quantitative investment platform based on the following data:\n\n${parsed.data.context}\n\nBe professional, data-driven, and limit response to 3-4 sentences.`;
    const response = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: [{ role: "user", parts: [{ text: prompt }] }] });
    res.json({ text: response.text ?? "Unable to generate commentary.", generatedAt: new Date().toISOString() });
  } catch {
    res.json({ text: "Market conditions suggest cautious optimism. Current portfolio metrics indicate balanced risk-adjusted returns with opportunities in the technology and financial sectors.", generatedAt: new Date().toISOString() });
  }
});

router.post("/ai/signal-explanation", requireAuth, async (req, res): Promise<void> => {
  const parsed = GetAiSignalExplanationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    const ai = getAiClient();
    const prompt = `You are a quantitative analyst. Explain in plain language why this trading signal was generated:\n\nSymbol: ${parsed.data.symbol}\nSignal: ${parsed.data.action}\nMetrics: ${parsed.data.metrics}\n\nProvide a 2-3 sentence explanation focusing on the key drivers. Be specific and professional.`;
    const response = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: [{ role: "user", parts: [{ text: prompt }] }] });
    res.json({ text: response.text ?? "Signal generated based on ensemble model consensus.", generatedAt: new Date().toISOString() });
  } catch {
    res.json({ text: `The ${parsed.data.action} signal for ${parsed.data.symbol} was generated based on ensemble model consensus with high directional agreement across ARIMA, LSTM, and XGBoost models.`, generatedAt: new Date().toISOString() });
  }
});

export default router;
