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
  
  const symbol = params.data.symbol;
  const timeframe = params.data.timeframe;

  try {
    const { getBreezeInstance, SYMBOL_TO_ICICI } = await import("../lib/iciciWebsocket.js");
    const breeze = getBreezeInstance();
    const stockCode = SYMBOL_TO_ICICI[symbol];

    if (breeze && stockCode) {
      let interval = "1day";
      let daysBack = 365;
      
      if (timeframe === "1m") { interval = "1minute"; daysBack = 2; }
      else if (timeframe === "5m" || timeframe === "15m") { interval = "5minute"; daysBack = 5; }
      else if (timeframe === "1h") { interval = "30minute"; daysBack = 30; }
      else if (timeframe === "1d") { interval = "1day"; daysBack = 365; }
      else if (timeframe === "1w" || timeframe === "1mo") { interval = "1day"; daysBack = 1000; }

      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setDate(toDate.getDate() - daysBack);

      const iciciData = await breeze.getHistoricalDatav2({
        interval: interval,
        fromDate: fromDate.toISOString(),
        toDate: toDate.toISOString(),
        stockCode: stockCode,
        exchangeCode: "NSE",
        productType: "cash"
      });

      let dataArray = null;
      if (iciciData && iciciData.Success && Array.isArray(iciciData.Success)) dataArray = iciciData.Success;
      else if (iciciData && iciciData.data && Array.isArray(iciciData.data)) dataArray = iciciData.data;
      else if (Array.isArray(iciciData)) dataArray = iciciData;

      if (dataArray && dataArray.length > 0) {
        const candles = dataArray.map((c: any) => ({
          time: new Date(c.datetime || c.date || c.time).toISOString(),
          open: Number(c.open || c.open_price || 0),
          high: Number(c.high || c.high_price || 0),
          low: Number(c.low || c.low_price || 0),
          close: Number(c.close || c.close_price || 0),
          volume: Number(c.volume || 0)
        }));
        res.json(candles);
        return;
      }
    }
  } catch (err: any) {
    import("../lib/logger.js").then(({ logger }) => {
      logger.error(`Failed to fetch real historical data for ${symbol}: ${err.message}`);
    });
  }

  // Fallback to simulated if real fetch fails
  const candles = getCandles(symbol, timeframe, 100);
  res.json(candles);
});

router.get("/stocks/:symbol/indicators/:timeframe", requireAuth, async (req, res): Promise<void> => {
  const params = ListStockIndicatorsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid params" }); return; }
  const indicators = getTechnicalIndicators(params.data.symbol);
  res.json(indicators);
});

export default router;
