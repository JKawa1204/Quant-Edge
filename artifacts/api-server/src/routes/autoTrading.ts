import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { db, usersTable, autoTradesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { runAutoTradingCycle } from "../lib/autoTrader.js";
import type { Request } from "express";

const router = Router();
type AuthReq = Request & { userId: number };

router.get("/auto-trading/status", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthReq).userId;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const [lastTrade] = await db.select()
    .from(autoTradesTable)
    .orderBy(desc(autoTradesTable.createdAt))
    .limit(1);

  const totalAutoTrades = await db.select().from(autoTradesTable).then(res => res.length);

  res.json({
    enabled: user.autoTradingEnabled,
    confidenceThreshold: Number(user.autoTradingConfidenceThreshold),
    maxPositionPct: Number(user.autoTradingMaxPositionPct),
    lastRunAt: lastTrade?.createdAt ?? null,
    totalAutoTrades,
  });
});

router.post("/auto-trading/toggle", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthReq).userId;
  const { enabled } = req.body;
  
  if (typeof enabled !== "boolean") {
    res.status(400).json({ error: "enabled must be a boolean" });
    return;
  }

  const [updated] = await db.update(usersTable)
    .set({ autoTradingEnabled: enabled })
    .where(eq(usersTable.id, userId))
    .returning();

  if (enabled) {
    // Run an initial cycle immediately in background
    runAutoTradingCycle(userId).catch(console.error);
  }

  res.json({ enabled: updated.autoTradingEnabled });
});

router.post("/auto-trading/configure", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthReq).userId;
  const { confidenceThreshold, maxPositionPct } = req.body;

  const updateData: any = {};
  if (typeof confidenceThreshold === "number") updateData.autoTradingConfidenceThreshold = String(confidenceThreshold);
  if (typeof maxPositionPct === "number") updateData.autoTradingMaxPositionPct = String(maxPositionPct);

  if (Object.keys(updateData).length === 0) {
    res.status(400).json({ error: "No valid fields provided" });
    return;
  }

  await db.update(usersTable)
    .set(updateData)
    .where(eq(usersTable.id, userId));

  res.json({ success: true });
});

router.post("/auto-trading/run", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthReq).userId;
  
  try {
    const result = await runAutoTradingCycle(userId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.get("/auto-trading/history", requireAuth, async (req, res): Promise<void> => {
  const trades = await db.select()
    .from(autoTradesTable)
    .orderBy(desc(autoTradesTable.createdAt))
    .limit(50);
    
  res.json(trades);
});

export default router;
