import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { searchStocks, getStockDetail, getCandles, getTechnicalIndicators } from "../lib/marketData.js";
import { SearchStocksQueryParams, GetStockDetailParams, ListStockCandlesParams, ListStockIndicatorsParams } from "@workspace/api-zod";

const router = Router();

router.get("/stocks/search", requireAuth, async (req, res): Promise<void> => {
  const parsed = SearchStocksQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: "Missing query" }); return; }
  res.json(searchStocks(parsed.data.q));
});

router.get("/stocks/:symbol", requireAuth, async (req, res): Promise<void> => {
  const params = GetStockDetailParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid symbol" }); return; }
  const detail = getStockDetail(params.data.symbol);
  if (!detail) { res.status(404).json({ error: "Stock not found" }); return; }
  res.json(detail);
});

router.get("/stocks/:symbol/candles/:timeframe", requireAuth, async (req, res): Promise<void> => {
  const params = ListStockCandlesParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid params" }); return; }
  const candles = getCandles(params.data.symbol, params.data.timeframe, 100);
  res.json(candles);
});

router.get("/stocks/:symbol/indicators/:timeframe", requireAuth, async (req, res): Promise<void> => {
  const params = ListStockIndicatorsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid params" }); return; }
  const indicators = getTechnicalIndicators(params.data.symbol);
  res.json(indicators);
});

export default router;
