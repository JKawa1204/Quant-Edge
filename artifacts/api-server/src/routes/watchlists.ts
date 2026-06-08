import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { db, watchlistsTable, watchlistStocksTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getCurrentPrice, getStockInfo, generateForecasts } from "../lib/marketData.js";
import { CreateWatchlistBody, AddToWatchlistBody, AddToWatchlistParams, DeleteWatchlistParams, RemoveFromWatchlistParams } from "@workspace/api-zod";
import type { Request } from "express";

const router = Router();
type AuthReq = Request & { userId: number };

router.get("/watchlists", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthReq).userId;
  const lists = await db.select().from(watchlistsTable).where(eq(watchlistsTable.userId, userId));

  const result = await Promise.all(lists.map(async (list) => {
    const stocks = await db.select().from(watchlistStocksTable).where(eq(watchlistStocksTable.watchlistId, list.id));
    const enriched = [];
    for (const s of stocks) {
      const info = getStockInfo(s.symbol);
      const price = getCurrentPrice(s.symbol);
      const forecast = await generateForecasts(s.symbol, price);
      enriched.push({
        id: s.id,
        symbol: s.symbol,
        company: info.company,
        price,
        change: Math.round((price - info.basePrice) * 100) / 100,
        changePct: Math.round(((price - info.basePrice) / info.basePrice) * 10000) / 100,
        volume: Math.floor(500000 + Math.random() * 1000000),
        forecastDirection: forecast.ensemble.direction,
        signal: forecast.ensemble.direction === "UP" ? "BUY" : "HOLD",
        confidence: forecast.ensemble.confidence,
      });
    }
    return { id: list.id, name: list.name, stocks: enriched, createdAt: list.createdAt };
  }));

  res.json(result);
});

router.post("/watchlists", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthReq).userId;
  const parsed = CreateWatchlistBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [list] = await db.insert(watchlistsTable).values({ userId, name: parsed.data.name }).returning();
  res.status(201).json({ id: list.id, name: list.name, stocks: [], createdAt: list.createdAt });
});

router.delete("/watchlists/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteWatchlistParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(watchlistStocksTable).where(eq(watchlistStocksTable.watchlistId, params.data.id));
  await db.delete(watchlistsTable).where(eq(watchlistsTable.id, params.data.id));
  res.sendStatus(204);
});

router.post("/watchlists/:id/stocks", requireAuth, async (req, res): Promise<void> => {
  const params = AddToWatchlistParams.safeParse(req.params);
  const body = AddToWatchlistBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const [stock] = await db.insert(watchlistStocksTable).values({ watchlistId: params.data.id, symbol: body.data.symbol }).returning();
  const info = getStockInfo(stock.symbol);
  const price = getCurrentPrice(stock.symbol);
  const forecast = await generateForecasts(stock.symbol, price);
  res.status(201).json({
    id: stock.id, symbol: stock.symbol, company: info.company, price,
    change: 0, changePct: 0, volume: 500000,
    forecastDirection: forecast.ensemble.direction,
    signal: "HOLD", confidence: forecast.ensemble.confidence,
  });
});

router.delete("/watchlists/:id/stocks/:symbol", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const symbol = Array.isArray(req.params.symbol) ? req.params.symbol[0] : req.params.symbol;
  await db.delete(watchlistStocksTable).where(and(eq(watchlistStocksTable.watchlistId, id), eq(watchlistStocksTable.symbol, symbol)));
  res.sendStatus(204);
});

export default router;
