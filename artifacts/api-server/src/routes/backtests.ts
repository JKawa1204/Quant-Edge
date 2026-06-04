import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { db, backtestsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { RunBacktestBody, GetBacktestParams } from "@workspace/api-zod";
import type { Request } from "express";

const router = Router();
type AuthReq = Request & { userId: number };

router.get("/backtests", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthReq).userId;
  const tests = await db.select().from(backtestsTable).where(eq(backtestsTable.userId, userId));
  res.json(tests.map(t => ({
    id: t.id, name: t.name, symbols: t.symbols, startDate: t.startDate, endDate: t.endDate,
    forecastModel: t.forecastModel, optimizationMethod: t.optimizationMethod, status: t.status,
    cagr: t.cagr ? Number(t.cagr) : null,
    sharpeRatio: t.sharpeRatio ? Number(t.sharpeRatio) : null,
    maxDrawdown: t.maxDrawdown ? Number(t.maxDrawdown) : null,
    alpha: t.alpha ? Number(t.alpha) : null,
    createdAt: t.createdAt,
  })));
});

router.post("/backtests", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthReq).userId;
  const parsed = RunBacktestBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const cagr = 10 + Math.random() * 20;
  const sharpe = 0.8 + Math.random() * 1.5;
  const drawdown = -(5 + Math.random() * 20);
  const alpha = Math.random() * 8;

  const [test] = await db.insert(backtestsTable).values({
    userId,
    name: parsed.data.name,
    symbols: parsed.data.symbols,
    startDate: parsed.data.startDate,
    endDate: parsed.data.endDate,
    forecastModel: parsed.data.forecastModel,
    optimizationMethod: parsed.data.optimizationMethod,
    status: "completed",
    cagr: String(Math.round(cagr * 100) / 100),
    sharpeRatio: String(Math.round(sharpe * 100) / 100),
    maxDrawdown: String(Math.round(drawdown * 100) / 100),
    alpha: String(Math.round(alpha * 100) / 100),
  }).returning();

  res.status(201).json({
    id: test.id, name: test.name, symbols: test.symbols, startDate: test.startDate, endDate: test.endDate,
    forecastModel: test.forecastModel, optimizationMethod: test.optimizationMethod, status: test.status,
    cagr: Number(test.cagr), sharpeRatio: Number(test.sharpeRatio),
    maxDrawdown: Number(test.maxDrawdown), alpha: Number(test.alpha), createdAt: test.createdAt,
  });
});

router.get("/backtests/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetBacktestParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [test] = await db.select().from(backtestsTable).where(eq(backtestsTable.id, params.data.id));
  if (!test) { res.status(404).json({ error: "Backtest not found" }); return; }

  const equityCurve = Array.from({ length: 90 }, (_, i) => {
    const d = new Date(test.startDate);
    d.setDate(d.getDate() + i);
    const v = 1000000 * (1 + i * 0.002 + Math.sin(i * 0.1) * 0.03);
    return { date: d.toISOString().split("T")[0], value: Math.round(v * 100) / 100 };
  });

  const drawdownCurve = equityCurve.map(p => ({ date: p.date, value: Math.round((p.value / 1000000 - 1) * 10000) / 100 }));

  const monthlyReturns = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1, year: 2024,
    return: Math.round((Math.random() * 10 - 3) * 100) / 100,
  }));

  const tradeLogs = test.symbols.flatMap((sym, i) => [
    { date: "2024-02-15", symbol: sym, side: "BUY", quantity: 10, price: 2800 + i * 100, pnl: 0 },
    { date: "2024-05-20", symbol: sym, side: "SELL", quantity: 10, price: 3200 + i * 100, pnl: 4000 + i * 500 },
  ]);

  const benchmarkComparison = equityCurve.map((p, i) => ({
    date: p.date,
    value: Math.round(1000000 * (1 + i * 0.0012 + Math.sin(i * 0.08) * 0.02) * 100) / 100,
  }));

  res.json({
    id: test.id,
    name: test.name,
    metrics: {
      totalReturn: Number(test.cagr) * 0.8,
      cagr: Number(test.cagr),
      sharpeRatio: Number(test.sharpeRatio),
      sortinoRatio: Number(test.sharpeRatio) * 1.3,
      maxDrawdown: Number(test.maxDrawdown),
      alpha: Number(test.alpha),
      beta: 0.82,
      informationRatio: 0.94,
      trackingError: 8.2,
      winRate: 62 + Math.random() * 15,
      profitFactor: 1.4 + Math.random() * 0.8,
      totalTrades: tradeLogs.length,
    },
    equityCurve,
    drawdownCurve,
    monthlyReturns,
    tradeLogs,
    benchmarkComparison,
  });
});

export default router;
