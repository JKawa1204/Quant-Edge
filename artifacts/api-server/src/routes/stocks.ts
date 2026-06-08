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
      
      const tf = timeframe.toLowerCase();
      if (tf === "1d" || tf === "1m") { interval = "1minute"; daysBack = 2; }
      else if (tf === "1w" || tf === "5m") { interval = "5minute"; daysBack = 7; }
      else if (tf === "1mo" || tf === "1h") { interval = "30minute"; daysBack = 30; }
      else if (tf === "3m" || tf === "3mo") { interval = "1day"; daysBack = 90; }
      else if (tf === "6m" || tf === "6mo") { interval = "1day"; daysBack = 180; }
      else if (tf === "1y") { interval = "1day"; daysBack = 365; }
      else if (tf === "3y") { interval = "1day"; daysBack = 1095; }
      else if (tf === "5y") { interval = "1day"; daysBack = 1825; }

      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setDate(toDate.getDate() - daysBack);

      const iciciData = await breeze.getHistoricalDatav2({
        interval: interval,
      fromDate: fromDate.toISOString().split('.')[0] + '.000Z',
      toDate: toDate.toISOString().split('.')[0] + '.000Z',
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
      } else {
        import("../lib/logger.js").then(({ logger }) => {
          logger.error(`ICICI getHistoricalDatav2 returned no valid data array for ${symbol}: ${JSON.stringify(iciciData).substring(0, 200)}`);
        });
      }
    }
  } catch (err: any) {
    import("../lib/logger.js").then(({ logger }) => {
      logger.error(`Failed to fetch real historical data for ${symbol}: ${err.message}`);
    });
  }

  // No fallback to simulated data allowed!
  res.json([]);
});

router.get("/stocks/:symbol/feature-engineering", requireAuth, async (req, res): Promise<void> => {
  const symbol = String(req.params.symbol);
  try {
    const { getBreezeInstance, SYMBOL_TO_ICICI } = await import("../lib/iciciWebsocket.js");
    const breeze = getBreezeInstance();
    const stockCode = SYMBOL_TO_ICICI[symbol];

    if (!breeze || !stockCode) { res.status(400).json({ error: "ICICI broker disconnected or symbol invalid" }); return; }

    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(toDate.getDate() - 1825); // 5 Years

    const iciciData = await breeze.getHistoricalDatav2({
      interval: "1day",
      fromDate: fromDate.toISOString().split('.')[0] + '.000Z',
      toDate: toDate.toISOString().split('.')[0] + '.000Z',
      stockCode: stockCode,
      exchangeCode: "NSE",
      productType: "cash"
    });

    let dataArray = null;
    if (iciciData?.Success && Array.isArray(iciciData.Success)) dataArray = iciciData.Success;
    else if (iciciData?.data && Array.isArray(iciciData.data)) dataArray = iciciData.data;
    else if (Array.isArray(iciciData)) dataArray = iciciData;

    if (!dataArray || dataArray.length < 50) { res.status(400).json({ error: "Insufficient historical data for feature engineering" }); return; }

    const closes = dataArray.map((c: any) => Number(c.close || c.close_price || 0));
    const highs = dataArray.map((c: any) => Number(c.high || c.high_price || 0));
    const lows = dataArray.map((c: any) => Number(c.low || c.low_price || 0));
    const volumes = dataArray.map((c: any) => Number(c.volume || 0));

    const ti = await import("technicalindicators");
    
    const rsi = ti.RSI.calculate({ values: closes, period: 14 });
    const sma = ti.SMA.calculate({ values: closes, period: 20 });
    const ema = ti.EMA.calculate({ values: closes, period: 20 });
    const macd = ti.MACD.calculate({ values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false });
    const bb = ti.BollingerBands.calculate({ values: closes, period: 20, stdDev: 2 });
    const vwap = ti.VWAP.calculate({ high: highs, low: lows, close: closes, volume: volumes });

    res.json({
      latest: {
        rsi: rsi.length > 0 ? rsi[rsi.length - 1] : null,
        sma: sma.length > 0 ? sma[sma.length - 1] : null,
        ema: ema.length > 0 ? ema[ema.length - 1] : null,
        macd: macd.length > 0 ? macd[macd.length - 1] : null,
        bollinger: bb.length > 0 ? bb[bb.length - 1] : null,
        vwap: vwap.length > 0 ? vwap[vwap.length - 1] : null,
      },
      history: {
        rsi: rsi.slice(-100),
        sma: sma.slice(-100),
        ema: ema.slice(-100),
        macd: macd.slice(-100),
        bollinger: bb.slice(-100),
        vwap: vwap.slice(-100)
      }
    });
  } catch (err: any) {
    import("../lib/logger.js").then(({ logger }) => logger.error(`Feature engineering failed for ${symbol}: ${err.message}`));
    res.status(500).json({ error: "Failed to engineer features" });
  }
});

router.get("/stocks/:symbol/indicators/:timeframe", requireAuth, async (req, res): Promise<void> => {
  const params = ListStockIndicatorsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid params" }); return; }
  const indicators = getTechnicalIndicators(params.data.symbol);
  res.json(indicators);
});

export default router;
