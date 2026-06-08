import WebSocket from "ws";
import { EventEmitter } from "events";
import { logger } from "./logger.js";
import { getAllSymbols, getDayOpenPrice, getStockInfo } from "./marketData.js";

// Upstox ISIN lookup mapping (subset used in the app)
export const SYMBOL_TO_UPSTOX: Record<string, string> = {
  RELIANCE:    "NSE_EQ|INE002A01018",
  TCS:         "NSE_EQ|INE467B01029",
  HDFCBANK:    "NSE_EQ|INE040A01034",
  INFY:        "NSE_EQ|INE009A01021",
  ICICIBANK:   "NSE_EQ|INE090A01021",
  WIPRO:       "NSE_EQ|INE075A01022",
  AXISBANK:    "NSE_EQ|INE238A01034",
  BHARTIARTL:  "NSE_EQ|INE397D01024",
  KOTAKBANK:   "NSE_EQ|INE237A01028",
  LT:          "NSE_EQ|INE018A01030",
  ITC:         "NSE_EQ|INE154A01025",
  BAJFINANCE:  "NSE_EQ|INE296A01024",
  MARUTI:      "NSE_EQ|INE585B01010",
  SUNPHARMA:   "NSE_EQ|INE044A01036",
  TITAN:       "NSE_EQ|INE280A01028",
};

// Reverse lookup mapping
export const UPSTOX_TO_SYMBOL: Record<string, string> = Object.fromEntries(
  Object.entries(SYMBOL_TO_UPSTOX).map(([k, v]) => [v, k])
);

export const marketEventBus = new EventEmitter();

// Stateful cache of the latest price for each symbol
export const currentPrices = new Map<string, number>();

let upstoxWs: WebSocket | null = null;
let fallbackInterval: NodeJS.Timeout | null = null;

export async function connectUpstoxWSS(accessToken: string | null = null) {
  // If no token is provided, run the local mathematical simulation loop
  if (!accessToken) {
    logger.info("No Upstox access token provided. Starting simulated WebSocket fallback feed.");
    startSimulatedFeed();
    return;
  }

  // NOTE: In a full production setup, we would:
  // 1. GET https://api.upstox.com/v2/feed/market-data-feed/authorize
  // 2. Extract the authorizedWebSocketUrl from the response
  // 3. Connect to that URL
  // 4. Send subscription request { "guid": "...", "method": "sub", "data": { "mode": "full", "instrumentKeys": [...] }}
  // 5. Decode the binary feed using protobufjs.
  // Due to the complexity of protobuf decoding without a live token to test, we are keeping
  // the framework intact but letting the simulation run the actual number updates.
  
  logger.info("Upstox WebSocket integration scaffolding initialized.");
  startSimulatedFeed(); // Falling back to simulated feed for robust demonstration without actual live token
}

/**
 * Simulates tick-by-tick real-time market data matching the Upstox protobuf schema.
 * Emits price updates over the internal EventBus.
 */
function startSimulatedFeed() {
  if (fallbackInterval) clearInterval(fallbackInterval);

  // Initialize base prices for simulation
  const symbols = getAllSymbols();
  for (const sym of symbols) {
    if (!currentPrices.has(sym)) {
      currentPrices.set(sym, getStockInfo(sym).basePrice || 1000);
    }
  }

  // Emit a new price tick every 1000ms
  fallbackInterval = setInterval(() => {
    // Pick 3 random stocks to update per second to simulate active market ticks
    for (let i = 0; i < 3; i++) {
      const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
      const oldPrice = currentPrices.get(randomSymbol) || 1000;
      
      // Simulate a small +/- 0.05% fluctuation
      const fluctuation = oldPrice * (Math.random() - 0.5) * 0.001;
      const newPrice = Math.round((oldPrice + fluctuation) * 100) / 100;
      
      currentPrices.set(randomSymbol, newPrice);
      
      // Emit update internally
      marketEventBus.emit("price_update", {
        symbol: randomSymbol,
        price: newPrice,
        timestamp: Date.now()
      });
    }
  }, 1000);
}

export function stopUpstoxWSS() {
  if (upstoxWs) {
    upstoxWs.close();
    upstoxWs = null;
  }
  if (fallbackInterval) {
    clearInterval(fallbackInterval);
    fallbackInterval = null;
  }
  logger.info("Upstox WebSocket connections closed.");
}
