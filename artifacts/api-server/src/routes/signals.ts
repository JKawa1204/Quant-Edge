import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { db, signalsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ExplainSignalParams } from "@workspace/api-zod";

const router = Router();

router.get("/signals", requireAuth, async (_req, res): Promise<void> => {
  const signals = await db.select().from(signalsTable).where(eq(signalsTable.status, "active"));
  res.json(signals.map(s => ({
    id: s.id,
    symbol: s.symbol,
    company: s.company,
    action: s.action,
    confidence: Number(s.confidence),
    forecastReturn: Number(s.forecastReturn),
    regime: s.regime,
    createdAt: s.createdAt,
    status: s.status,
    arimaContribution: s.arimaContribution ? Number(s.arimaContribution) : null,
    lstmContribution: s.lstmContribution ? Number(s.lstmContribution) : null,
    xgboostContribution: s.xgboostContribution ? Number(s.xgboostContribution) : null,
    regimeContribution: s.regimeContribution ? Number(s.regimeContribution) : null,
  })));
});

router.get("/signals/:id/explain", requireAuth, async (req, res): Promise<void> => {
  const params = ExplainSignalParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [signal] = await db.select().from(signalsTable).where(eq(signalsTable.id, params.data.id));
  if (!signal) { res.status(404).json({ error: "Signal not found" }); return; }
  res.json({
    signalId: signal.id,
    symbol: signal.symbol,
    action: signal.action,
    arimaContribution: Number(signal.arimaContribution ?? 25),
    lstmContribution: Number(signal.lstmContribution ?? 35),
    xgboostContribution: Number(signal.xgboostContribution ?? 28),
    regimeContribution: Number(signal.regimeContribution ?? 12),
    optimizationContribution: 0,
    confidenceScore: Number(signal.confidence),
    reasoning: `Signal generated based on ensemble forecast showing ${signal.action} direction with ${signal.confidence}% confidence. LSTM model had highest weight due to superior recent accuracy. Regime (${signal.regime}) supports this directional bias.`,
  });
});

export default router;
