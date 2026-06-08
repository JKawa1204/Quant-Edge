import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { db, signalsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ExplainSignalParams } from "@workspace/api-zod";
import { generateExplanation } from "../lib/explainability.js";

const router = Router();

router.get("/signals", requireAuth, async (_req, res): Promise<void> => {
  try {
    const mlUrl = process.env.ML_SERVICE_URL || "http://localhost:5000";
    // Hit ML service for top 10 stocks
    const mlRes = await fetch(`${mlUrl}/ml/signals`);
    if (mlRes.ok) {
      const mlData = await mlRes.json();
      // Map to expected UI format
      const formatted = mlData.map((s: any, i: number) => ({
        id: i + 1,
        symbol: s.symbol,
        company: s.company,
        action: s.action,
        confidence: Number(s.confidence),
        forecastReturn: Number(s.forecastReturn),
        regime: s.regime || "Bull Market",
        createdAt: new Date().toISOString(),
        status: "active",
        arimaContribution: s.arimaContribution ? Number(s.arimaContribution) : null,
        lstmContribution: s.lstmContribution ? Number(s.lstmContribution) : null,
        xgboostContribution: s.xgboostContribution ? Number(s.xgboostContribution) : null,
        regimeContribution: s.regimeContribution ? Number(s.regimeContribution) : null,
      }));
      res.json(formatted);
      return;
    }
  } catch (err) {
    console.error("Failed to fetch from ML service, falling back to DB", err);
  }

  // Fallback to DB
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
  
  const explanation = generateExplanation({
    ...signal,
    confidence: Number(signal.confidence),
    forecastReturn: Number(signal.forecastReturn),
    arimaContribution: Number(signal.arimaContribution ?? 25),
    lstmContribution: Number(signal.lstmContribution ?? 35),
    xgboostContribution: Number(signal.xgboostContribution ?? 28),
    regimeContribution: Number(signal.regimeContribution ?? 12),
  });
  
  res.json({
    signalId: signal.id,
    ...explanation
  });
});

export default router;
