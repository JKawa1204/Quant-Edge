import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = Router();

router.get("/analytics/portfolio", requireAuth, async (_req, res): Promise<void> => {
  const growthCurve = Array.from({ length: 90 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (90 - i));
    const v = 1000000 * (1 + Math.sin(i * 0.08) * 0.04 + i * 0.0015);
    return { date: d.toISOString().split("T")[0], value: Math.round(v * 100) / 100 };
  });

  const efficientFrontier = Array.from({ length: 20 }, (_, i) => ({
    risk: 8 + i * 1.5,
    return: 4 + i * 0.9 + Math.sin(i * 0.3) * 1.5,
  }));

  res.json({
    returns: 14.8,
    volatility: 18.2,
    sharpeRatio: 1.42,
    sortinoRatio: 1.87,
    maxDrawdown: -12.4,
    cagr: 16.3,
    growthCurve,
    efficientFrontier,
    allocationHistory: growthCurve.map(p => ({ date: p.date, value: p.value * 0.8 })),
  });
});

router.get("/analytics/trading", requireAuth, async (_req, res): Promise<void> => {
  res.json({
    strategies: [
      { name: "Buy & Hold", totalReturn: 8.4, winRate: 100, profitFactor: 1.08, sharpeRatio: 0.62, maxDrawdown: -18.2, tradesCount: 1 },
      { name: "Equal Weight", totalReturn: 11.2, winRate: 58, profitFactor: 1.32, sharpeRatio: 0.89, maxDrawdown: -14.6, tradesCount: 24 },
      { name: "Markowitz", totalReturn: 14.1, winRate: 62, profitFactor: 1.48, sharpeRatio: 1.21, maxDrawdown: -11.8, tradesCount: 31 },
      { name: "HRP", totalReturn: 15.6, winRate: 65, profitFactor: 1.61, sharpeRatio: 1.38, maxDrawdown: -10.2, tradesCount: 28 },
      { name: "Forecast + Markowitz", totalReturn: 18.3, winRate: 68, profitFactor: 1.79, sharpeRatio: 1.54, maxDrawdown: -9.4, tradesCount: 42 },
      { name: "Forecast + HRP", totalReturn: 21.7, winRate: 72, profitFactor: 2.01, sharpeRatio: 1.82, maxDrawdown: -8.1, tradesCount: 39 },
    ],
  });
});

router.get("/analytics/correlation", requireAuth, async (_req, res): Promise<void> => {
  const symbols = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK"];
  const matrix = symbols.map((_, i) =>
    symbols.map((__, j) => {
      if (i === j) return 1;
      const base = 0.3 + Math.abs(Math.sin((i + j) * 1.7)) * 0.5;
      return Math.round(base * 100) / 100;
    })
  );
  res.json({
    symbols,
    matrix,
    sectorExposure: [
      { sector: "Technology", weight: 35 },
      { sector: "Financials", weight: 30 },
      { sector: "Energy", weight: 20 },
      { sector: "Consumer", weight: 10 },
      { sector: "Others", weight: 5 },
    ],
    diversificationScore: 68,
  });
});

export default router;
