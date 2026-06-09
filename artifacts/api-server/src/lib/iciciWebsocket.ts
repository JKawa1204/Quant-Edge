import { EventEmitter } from "events";
import { logger } from "./logger.js";
import { getAllSymbols, getStockInfo } from "./marketData.js";
// @ts-ignore
import { BreezeConnect } from "breezeconnect";

// ICICI specific Stock Codes mapped to our general NIFTY symbol strings
export const SYMBOL_TO_ICICI: Record<string, string> = {
  "RELIANCE": "RELIND",
  "TCS": "TCS",
  "HDFCBANK": "HDFBAN",
  "INFY": "INFTEC",
  "HINDUNILVR": "HINLEV",
  "ICICIBANK": "ICIBAN",
  "WIPRO": "WIPRO",
  "AXISBANK": "AXIBAN",
  "BHARTIARTL": "BHAAIR",
  "KOTAKBANK": "KOTMAH",
  "LT": "LARTOU",
  "ITC": "ITC",
  "BAJFINANCE": "BAJFI",
  "MARUTI": "MARUTI",
  "SUNPHARMA": "SUNPHA",
  "TITAN": "TITIND",
  "ULTRACEMCO": "ULTCEM",
  "ADANIPORTS": "ADAPOR",
  "POWERGRID": "POWGRI",
  "NTPC": "NTPC",
  "ADANIENT": "ADAENT",
  "APOLLOHOSP": "APOHOS",
  "ASIANPAINT": "ASIPAI",
  "BAJAJ-AUTO": "BAAUTO",
  "BAJAJFINSV": "BAFINS",
  "BPCL": "BHAPET",
  "BRITANNIA": "BRIIND",
  "CIPLA": "CIPLA",
  "COALINDIA": "COALIN",
  "DIVISLAB": "DIVLAB",
  "DRREDDY": "DRREDD",
  "EICHERMOT": "EICMOT",
  "GRASIM": "GRASIM",
  "HCLTECH": "HCLTEC",
  "HDFCLIFE": "HDFSTA",
  "HEROMOTOCO": "HERHON",
  "HINDALCO": "HINDAL",
  "INDUSINDBK": "INDBA",
  "JSWSTEEL": "JSWSTE",
  "M&M": "MAHMAH",
  "NESTLEIND": "NESIND",
  "ONGC": "ONGC",
  "SBILIFE": "SBILIF",
  "SBIN": "STABAN",
  "TATACONSUM": "TATGLO",
  "TATAMOTORS": "TATMOT",
  "TATASTEEL": "TATSTE",
  "TECHM": "TECMAH",
  "SHRIRAMFIN": "SHRTRA",
  "TRENT": "TRENT"
};

export const ICICI_TO_SYMBOL: Record<string, string> = Object.fromEntries(
  Object.entries(SYMBOL_TO_ICICI).map(([k, v]) => [v, k])
);

export const marketEventBus = new EventEmitter();
export const currentPrices = new Map<string, number>();
export const openPrices = new Map<string, number>();
export const currentVolumes = new Map<string, number>();

let breeze: any = null;
let fallbackInterval: NodeJS.Timeout | null = null;
let activeSessionToken: string | null = null;

export function getBreezeInstance(): any {
  return breeze;
}

export function getIciciSessionToken(): string | null {
  return activeSessionToken;
}

export function setIciciSessionToken(token: string | null) {
  activeSessionToken = token;
}

export async function connectIciciWSS() {
  const appKey = process.env.ICICI_APP_KEY;
  const secretKey = process.env.ICICI_SECRET_KEY;

  if (!appKey || !secretKey) {
    logger.info("No ICICI App Key / Secret Key found. Skipping WebSocket connection.");
    return;
  }

  try {
    const masterToken = getIciciSessionToken();
    if (!masterToken) {
      logger.info("No active ICICI session token in memory. Skipping WebSocket connection.");
      return;
    }

    breeze = new BreezeConnect({ appKey });
    await breeze.generateSession(secretKey, masterToken);
    
    // Connect to WebSocket
    breeze.wsConnect();

    // Subscribe to events
    breeze.onTicks = function(ticks: any) {
      const stockCode = ticks?.stock_code;
      if (stockCode && ICICI_TO_SYMBOL[stockCode]) {
        const symbol = ICICI_TO_SYMBOL[stockCode];
        const newPrice = Number(ticks.last) || currentPrices.get(symbol) || 0;
        const newVolume = Number(ticks.total_quantity_traded || ticks.ttq || ticks.volume || 0);
        
        currentPrices.set(symbol, newPrice);
        if (newVolume > 0) currentVolumes.set(symbol, newVolume);
        
        marketEventBus.emit("price_update", {
          symbol: symbol,
          price: newPrice,
          timestamp: Date.now()
        });
      }
    };

    // Subscribe feeds for all symbols we track
    for (const [symbol, stockCode] of Object.entries(SYMBOL_TO_ICICI)) {
      try {
        const promise = breeze.subscribeFeeds({
          exchangeCode: "NSE",
          exchange_code: "NSE",
          stockCode: stockCode,
          stock_code: stockCode,
          stockToken: "1.1!" + stockCode,
          stock_token: "1.1!" + stockCode,
          productType: "cash",
          product_type: "cash",
          getExchangeQuotes: true,
          get_exchange_quotes: true,
          getMarketDepth: false,
          get_market_depth: false
        });
        if (promise && typeof promise.catch === 'function') {
          promise.catch((err: any) => {
            logger.error(`Feed subscription error for ${symbol}: ${err}`);
          });
        }
      } catch (err: any) {
        logger.error(`Feed subscription sync error for ${symbol}: ${err.message}`);
      }
    }

    // Fetch initial quotes to populate prices immediately (especially post-market)
    Object.entries(SYMBOL_TO_ICICI).forEach(([symbol, stockCode], index) => {
      setTimeout(() => {
        breeze.getQuotes({
          stockCode: stockCode,
          exchangeCode: "NSE",
          productType: "cash"
        }).then((res: any) => {
          let data = res;
          if (res && res.Success) data = Array.isArray(res.Success) ? res.Success[0] : res.Success;
          else if (res && res.data) data = Array.isArray(res.data) ? res.data[0] : res.data;
          
          if (data) {
            // Check all possible field names returned by ICICI
            const price = Number(data.ltp || data.last || data.close_price || data.close || 0);
            const prevClose = Number(data.previous_close || data.open_price || price);
            const volume = Number(data.total_quantity_traded || data.volume || data.TotalQunatityTraded || data.ttq || 0);
            
            if (price > 0) {
              currentPrices.set(symbol, price);
              if (prevClose > 0 && !openPrices.has(symbol)) {
                openPrices.set(symbol, prevClose);
              }
              if (volume > 0) {
                currentVolumes.set(symbol, volume);
              }
              marketEventBus.emit("price_update", {
                symbol: symbol,
                price: price,
                timestamp: Date.now()
              });
            }
          }
        }).catch((err: any) => {
          logger.error(`Initial quote fetch failed for ${symbol}: ${err}`);
        });
      }, index * 2000); // 2s delay between each to avoid ICICI strict rate limits
    });

    logger.info("Successfully connected to ICICI Direct Breeze WebSocket feed.");
  } catch (err: any) {
    logger.error(`Failed to connect to ICICI Direct WebSocket: ${err.message}.`);
  }
}



export function stopIciciWSS() {
  if (breeze) {
    // Currently, breezeconnect SDK does not expose a clear close() method on WS.
    // If needed, we nullify the instance and let garbage collection handle disconnects, 
    // or rely on server shutdown.
    breeze = null;
  }
  if (fallbackInterval) {
    clearInterval(fallbackInterval);
    fallbackInterval = null;
  }
  logger.info("ICICI WebSocket connections closed.");
}
