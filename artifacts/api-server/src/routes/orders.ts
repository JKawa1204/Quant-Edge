import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { db, ordersTable, portfoliosTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { PlaceOrderBody, GetOrdersQueryParams } from "@workspace/api-zod";
import type { Request } from "express";

const router = Router();
type AuthReq = Request & { userId: number };

router.get("/orders", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthReq).userId;
  const parsed = GetOrdersQueryParams.safeParse(req.query);
  const [portfolio] = await db.select().from(portfoliosTable).where(eq(portfoliosTable.userId, userId));
  if (!portfolio) { res.json([]); return; }

  const allOrders = await db.select().from(ordersTable).where(eq(ordersTable.portfolioId, portfolio.id));
  const status = parsed.success ? parsed.data.status : "all";
  const filtered = status === "all" ? allOrders : allOrders.filter(o => o.status === status);

  res.json(filtered.map(o => ({
    id: o.id, symbol: o.symbol, company: o.company, side: o.side,
    quantity: o.quantity, price: Number(o.price), status: o.status,
    signalSource: o.signalSource, executedAt: o.executedAt, createdAt: o.createdAt,
  })));
});

router.post("/orders", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthReq).userId;
  const parsed = PlaceOrderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [portfolio] = await db.select().from(portfoliosTable).where(eq(portfoliosTable.userId, userId));
  if (!portfolio) { res.status(404).json({ error: "Portfolio not found" }); return; }

  const [order] = await db.insert(ordersTable).values({
    portfolioId: portfolio.id,
    symbol: parsed.data.symbol,
    company: parsed.data.symbol,
    side: parsed.data.side,
    quantity: parsed.data.quantity,
    price: String(parsed.data.price),
    status: "executed",
    signalSource: parsed.data.signalSource,
    executedAt: new Date(),
  }).returning();

  res.status(201).json({
    id: order.id, symbol: order.symbol, company: order.company, side: order.side,
    quantity: order.quantity, price: Number(order.price), status: order.status,
    signalSource: order.signalSource, executedAt: order.executedAt, createdAt: order.createdAt,
  });
});

export default router;
