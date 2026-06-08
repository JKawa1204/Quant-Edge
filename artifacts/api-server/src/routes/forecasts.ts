import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { getCurrentPrice, generateForecasts } from "../lib/marketData.js";
import { GetForecastsParams, RunForecastParams } from "@workspace/api-zod";

const router = Router();

router.get("/forecasts/:symbol", requireAuth, async (req, res): Promise<void> => {
  const params = GetForecastsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid symbol" }); return; }
  const price = getCurrentPrice(params.data.symbol);
  res.json(await generateForecasts(params.data.symbol, price));
});

router.post("/forecasts/:symbol/run", requireAuth, async (req, res): Promise<void> => {
  const params = RunForecastParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid symbol" }); return; }
  const price = getCurrentPrice(params.data.symbol);
  res.json(await generateForecasts(params.data.symbol, price));
});

router.get("/forecasts/analytics/comparison", requireAuth, async (_req, res): Promise<void> => {
  res.json({
    stocks: ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK"],
    bestModel: "LSTM",
    metrics: [
      { model: "ARIMA", avgRmse: 28.4, avgMae: 21.2, avgMape: 1.8, avgR2: 0.72, avgDirectionalAccuracy: 61.2, winRate: 58.0 },
      { model: "LSTM", avgRmse: 19.6, avgMae: 14.8, avgMape: 1.2, avgR2: 0.84, avgDirectionalAccuracy: 72.4, winRate: 68.0 },
      { model: "XGBoost", avgRmse: 22.1, avgMae: 16.9, avgMape: 1.4, avgR2: 0.79, avgDirectionalAccuracy: 67.8, winRate: 63.5 },
      { model: "Ensemble", avgRmse: 17.3, avgMae: 13.1, avgMape: 1.0, avgR2: 0.88, avgDirectionalAccuracy: 75.6, winRate: 71.2 },
    ],
  });
});

export default router;
