import { EventEmitter } from "events";
import { logger } from "./logger.js";
import { getAllSymbols, getStockInfo } from "./marketData.js";
// @ts-ignore
import { BreezeConnect } from "breezeconnect";

// ICICI specific Stock Codes mapped to our general NIFTY symbol strings
export const SYMBOL_TO_ICICI: Record<string, string> = {
  RELIANCE:    "RELI",
  TCS:         "TCS",
  HDFCBANK:    "HDFBAN",
  INFY:        "INFTEC",
  ICICIBANK:   "ICIBAN",
  WIPRO:       "WIPRO",
  AXISBANK:    "AXIBAN",
  BHARTIARTL:  "BHAART",
  KOTAKBANK:   "KOTMAH",
  LT:          "LARTOU",
  ITC:         "ITC",
  BAJFINANCE:  "BAJFI",
  MARUTI:      "MARUTI",
  SUNPHARMA:   "SUNPHA",
  TITAN:       "TITIND",
};

export const ICICI_TO_SYMBOL: Record<string, string> = Object.fromEntries(
  Object.entries(SYMBOL_TO_ICICI).map(([k, v]) => [v, k])
);

export const marketEventBus = new EventEmitter();
export const currentPrices = new Map<string, number>();

let breeze: any = null;
let fallbackInterval: NodeJS.Timeout | null = null;
let activeSessionToken: string | null = null;

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
    breeze.on('ticks', (ticks: any) => {
      // The tick object structure from ICICI
      // ticks: { stock_code: "RELI", last: 2500, ... }
      const stockCode = ticks?.stock_code;
      if (stockCode && ICICI_TO_SYMBOL[stockCode]) {
        const symbol = ICICI_TO_SYMBOL[stockCode];
        const newPrice = Number(ticks.last) || currentPrices.get(symbol) || 0;
        
        currentPrices.set(symbol, newPrice);
        
        marketEventBus.emit("price_update", {
          symbol: symbol,
          price: newPrice,
          timestamp: Date.now()
        });
      }
    });

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
            const price = Number(data.ltp || data.last || data.close_price || data.previous_close || data.close || 0);
            if (price > 0) {
              currentPrices.set(symbol, price);
              marketEventBus.emit("price_update", {
                symbol: symbol,
                price: price,
                timestamp: Date.now()
              });
            }
          }
        }).catch(() => {});
      }, index * 200); // 200ms delay between each to avoid rate limits
    });

    logger.info("Successfully connected to ICICI Direct Breeze WebSocket feed.");
  } catch (err: any) {
    logger.error("Failed to connect to ICICI Direct WebSocket:", err.message);
  }
}

function startSimulatedFeed() {
  if (fallbackInterval) clearInterval(fallbackInterval);

  const symbols = getAllSymbols();
  for (const sym of symbols) {
    if (!currentPrices.has(sym)) {
      currentPrices.set(sym, getStockInfo(sym).basePrice || 1000);
    }
  }

  fallbackInterval = setInterval(() => {
    for (let i = 0; i < 3; i++) {
      const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
      const oldPrice = currentPrices.get(randomSymbol) || 1000;
      
      const fluctuation = oldPrice * (Math.random() - 0.5) * 0.001;
      const newPrice = Math.round((oldPrice + fluctuation) * 100) / 100;
      
      currentPrices.set(randomSymbol, newPrice);
      
      marketEventBus.emit("price_update", {
        symbol: randomSymbol,
        price: newPrice,
        timestamp: Date.now()
      });
    }
  }, 1000);
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
