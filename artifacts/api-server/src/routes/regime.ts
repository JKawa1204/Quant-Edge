import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { getMarketRegime } from "../lib/marketData.js";

const router = Router();

router.get("/regime/current", requireAuth, async (_req, res): Promise<void> => {
  res.json(getMarketRegime());
});

router.get("/regime/history", requireAuth, async (_req, res): Promise<void> => {
  const regimes = ["Bull Market", "Sideways Market", "Bull Market", "High Volatility", "Bear Market", "Low Volatility", "Bull Market"];
  const history = regimes.map((regime, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (regimes.length - i) * 14);
    return { date: d.toISOString().split("T")[0], regime, confidence: 65 + Math.floor(Math.random() * 30) };
  });
  res.json(history);
});

export default router;
