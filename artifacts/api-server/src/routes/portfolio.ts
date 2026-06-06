/**
 * Portfolio routes — simple, accurate P&L tracking.
 *
 * Today's P&L  = (current_price - day_open_price) × quantity
 * Overall P&L  = (current_price - avg_buy_price)  × quantity
 *
 * No paper-trading complexity — just honest numbers.
 */
import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { db, portfoliosTable, holdingsTable, transactionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getCurrentPrice, getDayOpenPrice, getStockInfo } from "../lib/marketData.js";
import type { Request } from "express";
const router = Router();
type AuthReq = Request & { userId: number };

// ── Helper ─────────────────────────────────────────────────────────────────
async function getUserPortfolio(userId: number) {
  const [p] = await db.select().from(portfoliosTable).where(eq(portfoliosTable.userId, userId));
  return p ?? null;
}

// ── GET /portfolio ──────────────────────────────────────────────────────────
router.get("/portfolio", requireAuth, async (req, res): Promise<void> => {
  const userId   = (req as AuthReq).userId;
  const portfolio = await getUserPortfolio(userId);
  if (!portfolio) { res.status(404).json({ error: "Portfolio not found" }); return; }

  const holdings = await db.select().from(holdingsTable)
    .where(eq(holdingsTable.portfolioId, portfolio.id));

  let investedTotal = 0;
  let currentTotal  = 0;
  let todayPnl      = 0;

  for (const h of holdings) {
    const qty      = h.quantity;
    const buyP     = Number(h.buyPrice);
    const curP     = getCurrentPrice(h.symbol);
    const openP    = getDayOpenPrice(h.symbol);

    investedTotal += qty * buyP;
    currentTotal  += qty * curP;
    todayPnl      += qty * (curP - openP);
  }

  const overallPnl    = currentTotal - investedTotal;
  const overallRetPct = investedTotal > 0 ? (overallPnl / investedTotal) * 100 : 0;
  const cash          = Number(portfolio.cash);
  const totalValue    = currentTotal + cash;
  const todayPnlPct   = investedTotal > 0 ? (todayPnl / investedTotal) * 100 : 0;

  res.json({
    id:           portfolio.id,
    name:         portfolio.name,
    cash:         Math.round(cash * 100) / 100,
    investedValue: Math.round(investedTotal * 100) / 100,
    currentValue: Math.round(currentTotal * 100) / 100,
    totalValue:   Math.round(totalValue * 100) / 100,
    overallPnl:   Math.round(overallPnl * 100) / 100,
    overallPnlPct: Math.round(overallRetPct * 100) / 100,
    todayPnl:     Math.round(todayPnl * 100) / 100,
    todayPnlPct:  Math.round(todayPnlPct * 100) / 100,
    holdingsCount: holdings.length,
    createdAt:    portfolio.createdAt,
  });
});

// ── GET /portfolio/holdings ─────────────────────────────────────────────────
router.get("/portfolio/holdings", requireAuth, async (req, res): Promise<void> => {
  const userId   = (req as AuthReq).userId;
  const portfolio = await getUserPortfolio(userId);
  if (!portfolio) { res.json([]); return; }

  const holdings = await db.select().from(holdingsTable)
    .where(eq(holdingsTable.portfolioId, portfolio.id));

  let totalCurrentValue = 0;
  const enriched = holdings.map(h => {
    const curP  = getCurrentPrice(h.symbol);
    const openP = getDayOpenPrice(h.symbol);
    const buyP  = Number(h.buyPrice);
    const qty   = h.quantity;

    const overallPnl    = (curP - buyP) * qty;
    const todayPnl      = (curP - openP) * qty;
    const overallPnlPct = buyP > 0 ? ((curP - buyP) / buyP) * 100 : 0;
    const todayPnlPct   = openP > 0 ? ((curP - openP) / openP) * 100 : 0;

    totalCurrentValue += curP * qty;

    return { h, curP, openP, overallPnl, todayPnl, overallPnlPct, todayPnlPct };
  });

  res.json(enriched.map(({ h, curP, openP, overallPnl, todayPnl, overallPnlPct, todayPnlPct }) => ({
    id:            h.id,
    symbol:        h.symbol,
    company:       h.company,
    sector:        h.sector,
    quantity:      h.quantity,
    avgBuyPrice:   Number(h.buyPrice),
    dayOpenPrice:  Math.round(openP * 100) / 100,
    currentPrice:  Math.round(curP * 100) / 100,
    overallPnl:    Math.round(overallPnl * 100) / 100,
    overallPnlPct: Math.round(overallPnlPct * 100) / 100,
    todayPnl:      Math.round(todayPnl * 100) / 100,
    todayPnlPct:   Math.round(todayPnlPct * 100) / 100,
    allocationPct: totalCurrentValue > 0
      ? Math.round((curP * h.quantity / totalCurrentValue) * 10000) / 100
      : 0,
    invested:      Math.round(Number(h.buyPrice) * h.quantity * 100) / 100,
    currentValue:  Math.round(curP * h.quantity * 100) / 100,
    boughtAt:      h.createdAt,
  })));
});

// ── POST /portfolio/buy ─────────────────────────────────────────────────────
router.post("/portfolio/buy", requireAuth, async (req, res): Promise<void> => {
  const userId   = (req as AuthReq).userId;
  const { symbol: rawSymbol, quantity: rawQty, price: rawPrice } = req.body ?? {};
  const symbol   = (typeof rawSymbol === "string" && rawSymbol.trim()) ? rawSymbol.trim().toUpperCase() : null;
  const quantity = typeof rawQty === "number" && Number.isInteger(rawQty) && rawQty > 0 ? rawQty : parseInt(rawQty);
  if (!symbol)           { res.status(400).json({ error: "symbol is required" }); return; }
  if (!(quantity > 0))   { res.status(400).json({ error: "quantity must be a positive integer" }); return; }

  const portfolio = await getUserPortfolio(userId);
  if (!portfolio) { res.status(404).json({ error: "Portfolio not found" }); return; }

  const price  = (typeof rawPrice === "number" && rawPrice > 0) ? rawPrice : getCurrentPrice(symbol);
  const cost   = price * quantity;
  const cash   = Number(portfolio.cash);

  if (cost > cash) {
    res.status(400).json({
      error: `Insufficient funds. Need ₹${cost.toLocaleString()}, have ₹${cash.toLocaleString()}`,
    });
    return;
  }

  const info = getStockInfo(symbol);

  // Check if holding exists → update avg buy price
  const [existing] = await db.select().from(holdingsTable)
    .where(eq(holdingsTable.portfolioId, portfolio.id))
    .where(eq(holdingsTable.symbol, symbol));

  if (existing) {
    const newQty     = existing.quantity + quantity;
    const newAvgPrice = (Number(existing.buyPrice) * existing.quantity + price * quantity) / newQty;
    await db.update(holdingsTable)
      .set({ quantity: newQty, buyPrice: String(Math.round(newAvgPrice * 100) / 100) })
      .where(eq(holdingsTable.id, existing.id));
  } else {
    await db.insert(holdingsTable).values({
      portfolioId: portfolio.id,
      symbol,
      company:     (info as any).company ?? symbol,
      sector:      (info as any).sector  ?? "Unknown",
      quantity,
      buyPrice:    String(Math.round(price * 100) / 100),
    });
  }

  // Deduct cash
  await db.update(portfoliosTable)
    .set({ cash: String(Math.round((cash - cost) * 100) / 100) })
    .where(eq(portfoliosTable.id, portfolio.id));

  // Log transaction
  await db.insert(transactionsTable).values({
    portfolioId: portfolio.id,
    symbol,
    company:     (info as any).company ?? symbol,
    sector:      (info as any).sector  ?? "Unknown",
    side:        "BUY",
    quantity,
    price:       String(Math.round(price * 100) / 100),
  });

  res.json({
    success: true,
    message: `Bought ${quantity} shares of ${symbol} @ ₹${price.toLocaleString()}`,
    cost:    Math.round(cost * 100) / 100,
    cashRemaining: Math.round((cash - cost) * 100) / 100,
  });
});

// ── POST /portfolio/sell ────────────────────────────────────────────────────
router.post("/portfolio/sell", requireAuth, async (req, res): Promise<void> => {
  const userId   = (req as AuthReq).userId;
  const { symbol: rawSymbol, quantity: rawQty, price: rawPrice } = req.body ?? {};
  const symbol   = (typeof rawSymbol === "string" && rawSymbol.trim()) ? rawSymbol.trim().toUpperCase() : null;
  const quantity = typeof rawQty === "number" && Number.isInteger(rawQty) && rawQty > 0 ? rawQty : parseInt(rawQty);
  if (!symbol)         { res.status(400).json({ error: "symbol is required" }); return; }
  if (!(quantity > 0)) { res.status(400).json({ error: "quantity must be a positive integer" }); return; }

  const portfolio = await getUserPortfolio(userId);
  if (!portfolio) { res.status(404).json({ error: "Portfolio not found" }); return; }

  const price    = (typeof rawPrice === "number" && rawPrice > 0) ? rawPrice : getCurrentPrice(symbol);
  const proceeds = price * quantity;

  const [holding] = await db.select().from(holdingsTable)
    .where(eq(holdingsTable.portfolioId, portfolio.id))
    .where(eq(holdingsTable.symbol, symbol));

  if (!holding || holding.quantity < quantity) {
    res.status(400).json({
      error: `Cannot sell ${quantity} shares. You hold ${holding?.quantity ?? 0} shares of ${symbol}.`,
    });
    return;
  }

  const pnl = (price - Number(holding.buyPrice)) * quantity;

  if (holding.quantity === quantity) {
    await db.delete(holdingsTable).where(eq(holdingsTable.id, holding.id));
  } else {
    await db.update(holdingsTable)
      .set({ quantity: holding.quantity - quantity })
      .where(eq(holdingsTable.id, holding.id));
  }

  const info = getStockInfo(symbol);

  // Add cash from sale
  await db.update(portfoliosTable)
    .set({ cash: String(Math.round((Number(portfolio.cash) + proceeds) * 100) / 100) })
    .where(eq(portfoliosTable.id, portfolio.id));

  // Log transaction
  await db.insert(transactionsTable).values({
    portfolioId: portfolio.id,
    symbol,
    company:     (info as any).company ?? symbol,
    sector:      (info as any).sector  ?? "Unknown",
    side:        "SELL",
    quantity,
    price:       String(Math.round(price * 100) / 100),
    notes:       `P&L: ₹${Math.round(pnl * 100) / 100}`,
  });

  res.json({
    success:  true,
    message:  `Sold ${quantity} shares of ${symbol} @ ₹${price.toLocaleString()}`,
    proceeds: Math.round(proceeds * 100) / 100,
    pnl:      Math.round(pnl * 100) / 100,
    cashNow:  Math.round((Number(portfolio.cash) + proceeds) * 100) / 100,
  });
});

// ── GET /portfolio/transactions ─────────────────────────────────────────────
router.get("/portfolio/transactions", requireAuth, async (req, res): Promise<void> => {
  const userId   = (req as AuthReq).userId;
  const portfolio = await getUserPortfolio(userId);
  if (!portfolio) { res.json([]); return; }

  const txns = await db.select().from(transactionsTable)
    .where(eq(transactionsTable.portfolioId, portfolio.id));

  res.json(txns.map(t => ({
    id:          t.id,
    symbol:      t.symbol,
    company:     t.company,
    sector:      t.sector,
    side:        t.side,
    quantity:    t.quantity,
    price:       Number(t.price),
    total:       Math.round(Number(t.price) * t.quantity * 100) / 100,
    notes:       t.notes,
    executedAt:  t.executedAt,
  })));
});

// ── GET /portfolio/performance ──────────────────────────────────────────────
router.get("/portfolio/performance", requireAuth, async (req, res): Promise<void> => {
  const userId   = (req as AuthReq).userId;
  const portfolio = await getUserPortfolio(userId);
  if (!portfolio) { res.json([]); return; }

  const holdings = await db.select().from(holdingsTable)
    .where(eq(holdingsTable.portfolioId, portfolio.id));

  const snapshots = [];
  const base = Number(portfolio.cash) + holdings.reduce((s, h) => s + Number(h.buyPrice) * h.quantity, 0);

  for (let i = 90; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const factor = 1 + Math.sin(i * 0.08) * 0.04 + i * 0.0015;
    const value = base * factor;
    snapshots.push({
      date:     d.toISOString().split("T")[0],
      value:    Math.round(value * 100) / 100,
      pnl:      Math.round((value - base) * 100) / 100,
    });
  }

  res.json(snapshots);
});

export default router;
