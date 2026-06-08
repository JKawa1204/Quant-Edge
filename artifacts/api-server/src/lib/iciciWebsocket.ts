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
    logger.info("No ICICI App Key / Secret Key found. Starting simulated WebSocket fallback feed.");
    startSimulatedFeed();
    return;
  }

  try {
    const masterToken = getIciciSessionToken();
    if (!masterToken) {
      logger.info("No active ICICI session token in memory. Starting simulated WebSocket fallback feed.");
      startSimulatedFeed();
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
      breeze.subscribeFeeds({
        exchange_code: "NSE",
        stock_code: stockCode,
        product_type: "cash",
        get_exchange_quotes: true,
        get_market_depth: false
      });
    }

    logger.info("Successfully connected to ICICI Direct Breeze WebSocket feed.");
  } catch (err: any) {
    logger.error("Failed to connect to ICICI Direct WebSocket:", err.message);
    startSimulatedFeed();
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
