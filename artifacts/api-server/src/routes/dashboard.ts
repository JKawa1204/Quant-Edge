import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { db, portfoliosTable, holdingsTable, signalsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getCurrentPrice, getMarketIndices, getMarketMovers, getMarketRegime, generateForecasts } from "../lib/marketData.js";
import type { Request } from "express";

const router = Router();

type AuthReq = Request & { userId: number };

router.get("/dashboard/summary", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthReq).userId;
  const [portfolio] = await db.select().from(portfoliosTable).where(eq(portfoliosTable.userId, userId));
  if (!portfolio) { res.status(404).json({ error: "Portfolio not found" }); return; }

  const holdings = await db.select().from(holdingsTable).where(eq(holdingsTable.portfolioId, portfolio.id));
  const signals = await db.select().from(signalsTable).where(eq(signalsTable.status, "active"));

  let invested = 0;
  let currentValue = 0;
  for (const h of holdings) {
    const qty = h.quantity;
    const buyP = Number(h.buyPrice);
    const curP = getCurrentPrice(h.symbol);
    invested += qty * buyP;
    currentValue += qty * curP;
  }

  const cash = Number(portfolio.cash);
  const totalValue = currentValue + cash;
  const totalPnl = currentValue - invested;
  const returnPct = invested > 0 ? (totalPnl / invested) * 100 : 0;
  const regime = getMarketRegime();

  let bestConfidence = 0;
  let bestForecastSymbol = holdings[0]?.symbol ?? "RELIANCE";
  for (const h of holdings) {
    const f = generateForecasts(h.symbol, getCurrentPrice(h.symbol));
    if (f.ensemble.confidence > bestConfidence) {
      bestConfidence = f.ensemble.confidence;
      bestForecastSymbol = h.symbol;
    }
  }

  res.json({
    portfolioValue: Math.round(totalValue * 100) / 100,
    todayPnl: Math.round(totalPnl * 0.3 * 100) / 100,
    todayPnlPct: Math.round(returnPct * 0.3 * 100) / 100,
    overallPnl: Math.round(totalPnl * 100) / 100,
    overallPnlPct: Math.round(returnPct * 100) / 100,
    availableCash: cash,
    returnPct: Math.round(returnPct * 100) / 100,
    healthScore: Math.min(100, Math.round(50 + holdings.length * 5 + (returnPct > 0 ? 10 : 0))),
    regime: regime.regime,
    forecastConfidence: Math.round(bestConfidence * 100) / 100,
    bestModel: "LSTM",
    bestStrategy: "Forecast + HRP",
    activeSignalsCount: signals.length,
  });
});

router.get("/dashboard/market-overview", requireAuth, async (req, res): Promise<void> => {
  const movers = getMarketMovers();
  const indices = getMarketIndices();
  res.json({ indices, topGainers: movers.gainers, topLosers: movers.losers, mostActive: movers.mostActive });
});

export default router;
