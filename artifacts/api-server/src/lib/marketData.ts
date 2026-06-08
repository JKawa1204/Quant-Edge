// Simulated market data engine — replace with Upstox API when credentials are added

const NIFTY_STOCKS: Record<string, { company: string; sector: string; industry: string; basePrice: number }> = {
  "RELIANCE": { company: "Reliance Industries", sector: "Energy", industry: "Oil & Gas", basePrice: 2850 },
  "TCS": { company: "Tata Consultancy Services", sector: "Technology", industry: "IT Services", basePrice: 3920 },
  "HDFCBANK": { company: "HDFC Bank", sector: "Financials", industry: "Banking", basePrice: 1720 },
  "INFY": { company: "Infosys", sector: "Technology", industry: "IT Services", basePrice: 1820 },
  "HINDUNILVR": { company: "Hindustan Unilever", sector: "Consumer", industry: "FMCG", basePrice: 2560 },
  "ICICIBANK": { company: "ICICI Bank", sector: "Financials", industry: "Banking", basePrice: 1240 },
  "WIPRO": { company: "Wipro", sector: "Technology", industry: "IT Services", basePrice: 540 },
  "AXISBANK": { company: "Axis Bank", sector: "Financials", industry: "Banking", basePrice: 1080 },
  "BHARTIARTL": { company: "Bharti Airtel", sector: "Telecom", industry: "Telecom Services", basePrice: 1460 },
  "KOTAKBANK": { company: "Kotak Mahindra Bank", sector: "Financials", industry: "Banking", basePrice: 1780 },
  "LT": { company: "Larsen & Toubro", sector: "Industrials", industry: "Engineering", basePrice: 3650 },
  "ITC": { company: "ITC", sector: "Consumer", industry: "FMCG", basePrice: 460 },
  "BAJFINANCE": { company: "Bajaj Finance", sector: "Financials", industry: "NBFC", basePrice: 7200 },
  "MARUTI": { company: "Maruti Suzuki", sector: "Auto", industry: "Automobiles", basePrice: 12400 },
  "SUNPHARMA": { company: "Sun Pharmaceutical", sector: "Healthcare", industry: "Pharma", basePrice: 1680 },
  "TITAN": { company: "Titan Company", sector: "Consumer", industry: "Jewellery & Watches", basePrice: 3450 },
  "ULTRACEMCO": { company: "UltraTech Cement", sector: "Materials", industry: "Cement", basePrice: 10800 },
  "ADANIPORTS": { company: "Adani Ports", sector: "Industrials", industry: "Ports & Logistics", basePrice: 1380 },
  "POWERGRID": { company: "Power Grid Corporation", sector: "Utilities", industry: "Power Transmission", basePrice: 340 },
  "NTPC": { company: "NTPC", sector: "Utilities", industry: "Power Generation", basePrice: 390 },
  "ADANIENT": { company: "Adani Enterprises", sector: "Industrials", industry: "Conglomerates", basePrice: 2800 },
  "APOLLOHOSP": { company: "Apollo Hospitals", sector: "Healthcare", industry: "Hospitals", basePrice: 6400 },
  "ASIANPAINT": { company: "Asian Paints", sector: "Consumer", industry: "Paints", basePrice: 2850 },
  "BAJAJ-AUTO": { company: "Bajaj Auto", sector: "Auto", industry: "Two-Wheelers", basePrice: 9200 },
  "BAJAJFINSV": { company: "Bajaj Finserv", sector: "Financials", industry: "Financial Services", basePrice: 1680 },
  "BPCL": { company: "Bharat Petroleum", sector: "Energy", industry: "Oil & Gas", basePrice: 620 },
  "BRITANNIA": { company: "Britannia Industries", sector: "Consumer", industry: "FMCG", basePrice: 5400 },
  "CIPLA": { company: "Cipla", sector: "Healthcare", industry: "Pharma", basePrice: 1480 },
  "COALINDIA": { company: "Coal India", sector: "Energy", industry: "Mining", basePrice: 440 },
  "DIVISLAB": { company: "Divi's Laboratories", sector: "Healthcare", industry: "Pharma", basePrice: 3800 },
  "DRREDDY": { company: "Dr. Reddy's", sector: "Healthcare", industry: "Pharma", basePrice: 6200 },
  "EICHERMOT": { company: "Eicher Motors", sector: "Auto", industry: "Automobiles", basePrice: 4600 },
  "GRASIM": { company: "Grasim Industries", sector: "Materials", industry: "Diversified", basePrice: 2350 },
  "HCLTECH": { company: "HCL Technologies", sector: "Technology", industry: "IT Services", basePrice: 1620 },
  "HDFCLIFE": { company: "HDFC Life", sector: "Financials", industry: "Insurance", basePrice: 680 },
  "HEROMOTOCO": { company: "Hero MotoCorp", sector: "Auto", industry: "Two-Wheelers", basePrice: 4800 },
  "HINDALCO": { company: "Hindalco", sector: "Materials", industry: "Metals", basePrice: 620 },
  "INDUSINDBK": { company: "IndusInd Bank", sector: "Financials", industry: "Banking", basePrice: 1450 },
  "JSWSTEEL": { company: "JSW Steel", sector: "Materials", industry: "Steel", basePrice: 880 },
  "M&M": { company: "Mahindra & Mahindra", sector: "Auto", industry: "Automobiles", basePrice: 2650 },
  "NESTLEIND": { company: "Nestle India", sector: "Consumer", industry: "FMCG", basePrice: 2480 },
  "ONGC": { company: "ONGC", sector: "Energy", industry: "Oil & Gas", basePrice: 280 },
  "SBILIFE": { company: "SBI Life", sector: "Financials", industry: "Insurance", basePrice: 1650 },
  "SBIN": { company: "State Bank of India", sector: "Financials", industry: "Banking", basePrice: 820 },
  "TATACONSUM": { company: "Tata Consumer", sector: "Consumer", industry: "FMCG", basePrice: 1150 },
  "TATAMOTORS": { company: "Tata Motors", sector: "Auto", industry: "Automobiles", basePrice: 980 },
  "TATASTEEL": { company: "Tata Steel", sector: "Materials", industry: "Steel", basePrice: 160 },
  "TECHM": { company: "Tech Mahindra", sector: "Technology", industry: "IT Services", basePrice: 1560 },
  "SHRIRAMFIN": { company: "Shriram Finance", sector: "Financials", industry: "NBFC", basePrice: 2700 },
  "TRENT": { company: "Trent", sector: "Consumer", industry: "Retail", basePrice: 5800 },
};

import { currentPrices, openPrices, currentVolumes } from "./iciciWebsocket.js";

export function getCurrentPrice(symbol: string): number {
  if (currentPrices && currentPrices.has(symbol)) {
    return currentPrices.get(symbol)!;
  }
  return NIFTY_STOCKS[symbol]?.basePrice ?? 0;
}

export function getDayOpenPrice(symbol: string): number {
  if (openPrices && openPrices.has(symbol)) {
    return openPrices.get(symbol)!;
  }
  return NIFTY_STOCKS[symbol]?.basePrice ?? 0;
}

export function getDayVolume(symbol: string): number {
  if (currentVolumes && currentVolumes.has(symbol)) {
    return currentVolumes.get(symbol)!;
  }
  return 800000;
}

export function getStockInfo(symbol: string) {
  return NIFTY_STOCKS[symbol] ?? { company: symbol, sector: "Unknown", industry: "Unknown", basePrice: 1000 };
}

export function getAllSymbols(): string[] {
  return Object.keys(NIFTY_STOCKS);
}

export function searchStocks(query: string) {
  const q = query.toLowerCase();
  return Object.entries(NIFTY_STOCKS)
    .filter(([sym, info]) => sym.toLowerCase().includes(q) || info.company.toLowerCase().includes(q))
    .map(([symbol, info]) => {
      const price = getCurrentPrice(symbol);
      const prevPrice = getDayOpenPrice(symbol);
      const change = price - prevPrice;
      return {
        symbol,
        company: info.company,
        sector: info.sector,
        industry: info.industry,
        exchange: "NSE",
        price,
        change: Math.round(change * 100) / 100,
        changePct: Math.round((change / prevPrice) * 10000) / 100,
        volume: getDayVolume(symbol)
      };
    });
}

export function getCandles(symbol: string, timeframe: string, limit: number = 100) {
  // Fallback has been removed, this is only here to satisfy TS types in other places if called.
  return [] as any[];
}

export function getStockDetail(symbol: string) {
  const info = NIFTY_STOCKS[symbol];
  if (!info) return null;

  const price = getCurrentPrice(symbol);
  const prevPrice = getDayOpenPrice(symbol);

  return {
    symbol,
    company: info.company,
    sector: info.sector,
    industry: info.industry,
    description: `${info.company} is a leading ${info.industry} company listed on the NSE.`,
    marketCap: 1000000,
    eps: 50,
    pe: 25,
    bookValue: price * 0.5,
    dividendYield: 1.5,
    roe: 15,
    roa: 8,
    debtToEquity: 0.5,
    revenue: 50000,
    netProfit: 10000,
    operatingMargin: 20,
    freeCashFlow: 5000,
    week52High: price * 1.2,
    week52Low: price * 0.8,
    beta: 1.1,
    volatility: 15,
    avgVolume: 1000000,
    currentVolume: getDayVolume(symbol),
    currentPrice: price,
    change: Math.round((price - prevPrice) * 100) / 100,
    changePct: Math.round(((price - prevPrice) / prevPrice) * 10000) / 100,
  };
}

export function getTechnicalIndicators(symbol: string) {
  const candles = getCandles(symbol, "1d", 50);
  const closes = candles.map(c => c.close);
  const last = closes[closes.length - 1];

  const sma = (n: number) => closes.slice(-n).reduce((a, b) => a + b, 0) / n;
  const sma20 = sma(20);
  const sma50 = sma(50);
  const ema20 = closes.slice(-20).reduce((acc, c, i) => {
    const k = 2 / (20 + 1);
    return i === 0 ? c : acc * (1 - k) + c * k;
  }, 0);

  const gains = closes.slice(-15).map((c, i, arr) => i === 0 ? 0 : Math.max(0, c - arr[i - 1]));
  const losses = closes.slice(-15).map((c, i, arr) => i === 0 ? 0 : Math.max(0, arr[i - 1] - c));
  const avgGain = gains.slice(1).reduce((a, b) => a + b, 0) / 14;
  const avgLoss = losses.slice(1).reduce((a, b) => a + b, 0) / 14;
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);

  const ema12 = closes.slice(-26).reduce((acc, c, i) => { const k = 2 / 13; return i === 0 ? c : acc * (1 - k) + c * k; }, 0);
  const ema26 = closes.reduce((acc, c, i) => { const k = 2 / 27; return i === 0 ? c : acc * (1 - k) + c * k; }, 0);
  const macd = ema12 - ema26;
  const macdSignal = macd * 0.9;
  const bbMiddle = sma20;
  const stdDev = Math.sqrt(closes.slice(-20).reduce((s, c) => s + Math.pow(c - sma20, 2), 0) / 20);
  const bbUpper = bbMiddle + 2 * stdDev;
  const bbLower = bbMiddle - 2 * stdDev;
  const vwap = last * (1 + (Math.sin(last * 0.001) * 0.01));

  return {
    sma20: Math.round(sma20 * 100) / 100,
    sma50: Math.round(sma50 * 100) / 100,
    ema20: Math.round(ema20 * 100) / 100,
    rsi: Math.round(rsi * 100) / 100,
    macd: Math.round(macd * 100) / 100,
    macdSignal: Math.round(macdSignal * 100) / 100,
    macdHistogram: Math.round((macd - macdSignal) * 100) / 100,
    bbUpper: Math.round(bbUpper * 100) / 100,
    bbMiddle: Math.round(bbMiddle * 100) / 100,
    bbLower: Math.round(bbLower * 100) / 100,
    vwap: Math.round(vwap * 100) / 100,
  };
}

export function getMarketIndices() {
  const now = new Date().toISOString();
  return [
    { name: "NIFTY 50", symbol: "^NSEI", value: 24500, change: 0, changePct: 0, updatedAt: now },
    { name: "SENSEX", symbol: "^BSESN", value: 80500, change: 0, changePct: 0, updatedAt: now },
    { name: "BANK NIFTY", symbol: "^NSEBANK", value: 52300, change: 0, changePct: 0, updatedAt: now },
  ];
}

export function getMarketMovers() {
  const symbols = getAllSymbols();
  const quotes = symbols.map(symbol => {
    const info = NIFTY_STOCKS[symbol];
    const price = getCurrentPrice(symbol);
    const prev = info.basePrice;
    const change = price - prev;
    const changePct = (change / prev) * 100;
    return {
      symbol,
      company: info.company,
      price,
      change: Math.round(change * 100) / 100,
      changePct: Math.round(changePct * 100) / 100,
      volume: Math.floor(500000 + Math.abs(changePct) * 100000),
    };
  });

  const sorted = [...quotes].sort((a, b) => b.changePct - a.changePct);
  return {
    gainers: sorted.slice(0, 5),
    losers: sorted.slice(-5).reverse(),
    mostActive: [...quotes].sort((a, b) => b.volume - a.volume).slice(0, 5),
  };
}

export function getSectorPerformance() {
  const sectors: Record<string, { total: number; count: number; topStock: string; topChange: number }> = {};
  for (const [symbol, info] of Object.entries(NIFTY_STOCKS)) {
    const price = getCurrentPrice(symbol);
    const changePct = ((price - info.basePrice) / info.basePrice) * 100;
    if (!sectors[info.sector]) {
      sectors[info.sector] = { total: 0, count: 0, topStock: symbol, topChange: changePct };
    }
    sectors[info.sector].total += changePct;
    sectors[info.sector].count += 1;
    if (Math.abs(changePct) > Math.abs(sectors[info.sector].topChange)) {
      sectors[info.sector].topStock = symbol;
      sectors[info.sector].topChange = changePct;
    }
  }

  return Object.entries(sectors).map(([sector, data]) => ({
    sector,
    change: 0,
    changePct: Math.round((data.total / data.count) * 100) / 100,
    topStock: data.topStock,
  }));
}

export function getMarketRegime() {
  return {
    regime: "Bull Market",
    confidence: 85,
    description: `Market is currently in a Bull phase.`,
    allocationStrategy: "Aggressive Allocation — Increase equity exposure",
    updatedAt: new Date().toISOString(),
  };
}

export async function generateForecasts(symbol: string, currentPrice: number) {
  const mlServiceUrl = process.env.ML_SERVICE_URL;
  if (mlServiceUrl) {
    try {
      const res = await fetch(`${mlServiceUrl}/ml/forecast/${symbol}`);
      if (res.ok) {
        const data = await res.json();
        return data;
      } else {
        console.error(`ML service returned status ${res.status}`);
      }
    } catch (e: any) {
      console.error(`Failed to fetch from ML service at ${mlServiceUrl}:`, e.message);
    }
  }

  // Returns flat values without seeded random noise as fallback
  const makeModel = (name: string) => ({
    model: name,
    nextDay: currentPrice * 1.01,
    nextWeek: currentPrice * 1.05,
    nextMonth: currentPrice * 1.10,
    confidence: 0.80,
    direction: "UP",
    rmse: 10,
    mae: 7,
    mape: 1.5,
    r2: 0.85,
    directionalAccuracy: 75,
    forecastPoints: [],
  });

  const arima = makeModel("ARIMA");
  const lstm = makeModel("LSTM");
  const xgboost = makeModel("XGBoost");

  const ensemble = {
    ...makeModel("Ensemble"),
    direction: "UP",
    confidence: 0.85,
  };

  return {
    symbol,
    currentPrice,
    arima,
    lstm,
    xgboost,
    ensemble,
    modelAgreement: 1.0,
    regimeAdjusted: true,
    updatedAt: new Date().toISOString(),
  };
}
