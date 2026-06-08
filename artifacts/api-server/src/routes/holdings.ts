import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { db, portfoliosTable, holdingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getCurrentPrice, generateForecasts } from "../lib/marketData.js";
import type { Request } from "express";

const router = Router();
type AuthReq = Request & { userId: number };

router.get("/holdings", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthReq).userId;
  const [portfolio] = await db.select().from(portfoliosTable).where(eq(portfoliosTable.userId, userId));
  if (!portfolio) { res.json([]); return; }
  const holdings = await db.select().from(holdingsTable).where(eq(holdingsTable.portfolioId, portfolio.id));

  let totalCurrentValue = 0;
  const enriched = [];
  for (const h of holdings) {
    const curP = getCurrentPrice(h.symbol);
    const buyP = Number(h.buyPrice);
    const pnl = (curP - buyP) * h.quantity;
    const returnPct = ((curP - buyP) / buyP) * 100;
    totalCurrentValue += curP * h.quantity;
    const forecast = await generateForecasts(h.symbol, curP);
    enriched.push({ h, curP, pnl, returnPct, forecastPrice: forecast.ensemble.nextWeek, recommendation: forecast.ensemble.direction === "UP" ? "BUY" : "HOLD" });
  }

  const result = enriched.map(({ h, curP, pnl, returnPct, forecastPrice, recommendation }) => ({
    id: h.id,
    symbol: h.symbol,
    company: h.company,
    sector: h.sector,
    quantity: h.quantity,
    buyPrice: Number(h.buyPrice),
    currentPrice: curP,
    pnl: Math.round(pnl * 100) / 100,
    returnPct: Math.round(returnPct * 100) / 100,
    allocationPct: totalCurrentValue > 0 ? Math.round((curP * h.quantity / totalCurrentValue) * 10000) / 100 : 0,
    riskContribution: Math.round(Math.abs(returnPct) * 0.5 * 100) / 100,
    forecastPrice,
    recommendation,
  }));

  res.json(result);
});

export default router;
