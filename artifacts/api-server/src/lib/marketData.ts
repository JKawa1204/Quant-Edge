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

function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

function getDayPrice(symbol: string, daysAgo: number = 0): number {
  const base = NIFTY_STOCKS[symbol]?.basePrice ?? 1000;
  const seed = symbol.charCodeAt(0) * 31 + symbol.charCodeAt(1) * 17 + daysAgo * 7;
  const dailyChange = (seededRandom(seed) - 0.48) * 0.04;
  let price = base;
  for (let i = daysAgo; i >= 0; i--) {
    const s = symbol.charCodeAt(0) * 31 + symbol.charCodeAt(1) * 17 + i * 7;
    price = price * (1 + (seededRandom(s) - 0.48) * 0.04);
  }
  return Math.round(price * 100) / 100;
}

export function getCurrentPrice(symbol: string): number {
  const base = NIFTY_STOCKS[symbol]?.basePrice ?? 1000;
  const now = Date.now();
  const minuteSeed = Math.floor(now / 60000);
  const change = (seededRandom(symbol.charCodeAt(0) + minuteSeed) - 0.48) * 0.006;
  return Math.round(base * (1 + change) * 100) / 100;
}

export function getDayOpenPrice(symbol: string): number {
  // Simulated day open — fixed per trading day using date as seed
  const base = NIFTY_STOCKS[symbol]?.basePrice ?? 1000;
  const today = new Date();
  const daySeed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  const change = (seededRandom(symbol.charCodeAt(0) + daySeed) - 0.48) * 0.008;
  return Math.round(base * (1 + change) * 100) / 100;
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
    .map(([symbol, info]) => ({
      symbol,
      company: info.company,
      sector: info.sector,
      industry: info.industry,
      exchange: "NSE",
    }));
}

export function getCandles(symbol: string, timeframe: string, limit: number = 100) {
  const candles = [];
  const base = NIFTY_STOCKS[symbol]?.basePrice ?? 1000;
  const now = new Date();

  for (let i = limit; i >= 0; i--) {
    const d = new Date(now);
    if (timeframe === "1d" || timeframe === "1w" || timeframe === "1mo") {
      d.setDate(d.getDate() - i);
    } else {
      const minutes = timeframe === "1m" ? i : timeframe === "5m" ? i * 5 : timeframe === "15m" ? i * 15 : i * 60;
      d.setMinutes(d.getMinutes() - minutes);
    }

    const seed = symbol.charCodeAt(0) * 100 + i;
    const open = base * (1 + (seededRandom(seed) - 0.48) * 0.03);
    const high = open * (1 + seededRandom(seed + 1) * 0.015);
    const low = open * (1 - seededRandom(seed + 2) * 0.015);
    const close = low + seededRandom(seed + 3) * (high - low);
    const volume = Math.floor(100000 + seededRandom(seed + 4) * 500000);

    candles.push({
      time: d.toISOString(),
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume,
    });
  }
  return candles;
}

export function getStockDetail(symbol: string) {
  const info = NIFTY_STOCKS[symbol];
  if (!info) return null;

  const price = getCurrentPrice(symbol);
  const prevPrice = info.basePrice;
  const seed = symbol.charCodeAt(0) * 7;

  return {
    symbol,
    company: info.company,
    sector: info.sector,
    industry: info.industry,
    description: `${info.company} is a leading ${info.industry} company listed on the NSE. It operates across multiple segments contributing significantly to the Indian economy.`,
    marketCap: Math.round(price * (1_000_000 + seededRandom(seed) * 5_000_000) * 100) / 100,
    eps: Math.round((20 + seededRandom(seed + 1) * 80) * 100) / 100,
    pe: Math.round((12 + seededRandom(seed + 2) * 40) * 100) / 100,
    bookValue: Math.round((price * 0.3 + seededRandom(seed + 3) * price * 0.4) * 100) / 100,
    dividendYield: Math.round(seededRandom(seed + 4) * 3 * 100) / 100,
    roe: Math.round((8 + seededRandom(seed + 5) * 25) * 100) / 100,
    roa: Math.round((3 + seededRandom(seed + 6) * 15) * 100) / 100,
    debtToEquity: Math.round(seededRandom(seed + 7) * 2 * 100) / 100,
    revenue: Math.round((10000 + seededRandom(seed + 8) * 90000) * 100) / 100,
    netProfit: Math.round((1000 + seededRandom(seed + 9) * 20000) * 100) / 100,
    operatingMargin: Math.round((10 + seededRandom(seed + 10) * 30) * 100) / 100,
    freeCashFlow: Math.round((500 + seededRandom(seed + 11) * 15000) * 100) / 100,
    week52High: Math.round(price * (1.2 + seededRandom(seed + 12) * 0.3) * 100) / 100,
    week52Low: Math.round(price * (0.6 + seededRandom(seed + 13) * 0.2) * 100) / 100,
    beta: Math.round((0.6 + seededRandom(seed + 14) * 1.2) * 100) / 100,
    volatility: Math.round((10 + seededRandom(seed + 15) * 25) * 100) / 100,
    avgVolume: Math.floor(500000 + seededRandom(seed + 16) * 2000000),
    currentVolume: Math.floor(300000 + seededRandom(seed + 17) * 1500000),
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
  const seed = Math.floor(Date.now() / 300000);
  const niftyBase = 24500;
  const sensexBase = 80500;
  const niftyChange = (seededRandom(seed) - 0.48) * 400;
  const sensexChange = (seededRandom(seed + 1) - 0.48) * 1200;

  return [
    {
      name: "NIFTY 50",
      symbol: "^NSEI",
      value: Math.round((niftyBase + niftyChange) * 100) / 100,
      change: Math.round(niftyChange * 100) / 100,
      changePct: Math.round((niftyChange / niftyBase) * 10000) / 100,
      updatedAt: now,
    },
    {
      name: "SENSEX",
      symbol: "^BSESN",
      value: Math.round((sensexBase + sensexChange) * 100) / 100,
      change: Math.round(sensexChange * 100) / 100,
      changePct: Math.round((sensexChange / sensexBase) * 10000) / 100,
      updatedAt: now,
    },
    {
      name: "BANK NIFTY",
      symbol: "^NSEBANK",
      value: Math.round((52300 + (seededRandom(seed + 2) - 0.48) * 800) * 100) / 100,
      change: Math.round((seededRandom(seed + 3) - 0.48) * 800 * 100) / 100,
      changePct: Math.round((seededRandom(seed + 4) - 0.48) * 3 * 100) / 100,
      updatedAt: now,
    },
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
  const seed = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  const regimes = ["Bull Market", "Bear Market", "Sideways Market", "High Volatility", "Low Volatility"];
  const regime = regimes[Math.floor(seededRandom(seed) * regimes.length)];
  const confidence = Math.round((60 + seededRandom(seed + 1) * 35) * 100) / 100;

  const strategyMap: Record<string, string> = {
    "Bull Market": "Aggressive Allocation — Increase equity exposure",
    "Bear Market": "Defensive Allocation — Shift to bonds and cash",
    "Sideways Market": "Balanced Allocation — Maintain current weights",
    "High Volatility": "Reduce Exposure — Lower position sizes",
    "Low Volatility": "Momentum Strategy — Follow trend signals",
  };

  return {
    regime,
    confidence,
    description: `Market is currently in a ${regime} phase based on momentum, volatility, and breadth indicators.`,
    allocationStrategy: strategyMap[regime] ?? "Balanced",
    updatedAt: new Date().toISOString(),
  };
}

export function generateForecasts(symbol: string, currentPrice: number) {
  const seed = symbol.charCodeAt(0) * 13 + symbol.charCodeAt(1) * 7;
  const trend = seededRandom(seed) > 0.5 ? 1 : -1;
  const regime = getMarketRegime().regime;

  const makeModel = (name: string, offset: number) => {
    const modelSeed = seed + offset;
    const dir = seededRandom(modelSeed) > 0.45 ? 1 : -1;
    const mag1 = seededRandom(modelSeed + 1) * 0.03;
    const mag5 = seededRandom(modelSeed + 2) * 0.07;
    const mag20 = seededRandom(modelSeed + 3) * 0.12;
    const conf = 55 + seededRandom(modelSeed + 4) * 40;
    const rmse = 5 + seededRandom(modelSeed + 5) * 30;
    const mae = rmse * 0.7;
    const mape = 0.5 + seededRandom(modelSeed + 6) * 4;
    const r2 = 0.6 + seededRandom(modelSeed + 7) * 0.35;
    const da = 55 + seededRandom(modelSeed + 8) * 35;

    const pts = [];
    for (let i = 1; i <= 30; i++) {
      const p = currentPrice * (1 + dir * mag20 * (i / 30));
      pts.push({
        date: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        value: Math.round(p * 100) / 100,
        lower: Math.round(p * 0.97 * 100) / 100,
        upper: Math.round(p * 1.03 * 100) / 100,
      });
    }

    return {
      model: name,
      nextDay: Math.round(currentPrice * (1 + dir * mag1) * 100) / 100,
      nextWeek: Math.round(currentPrice * (1 + dir * mag5) * 100) / 100,
      nextMonth: Math.round(currentPrice * (1 + dir * mag20) * 100) / 100,
      confidence: Math.round(conf * 100) / 100,
      direction: dir > 0 ? "UP" : "DOWN",
      rmse: Math.round(rmse * 100) / 100,
      mae: Math.round(mae * 100) / 100,
      mape: Math.round(mape * 100) / 100,
      r2: Math.round(r2 * 1000) / 1000,
      directionalAccuracy: Math.round(da * 100) / 100,
      forecastPoints: pts,
    };
  };

  const arima = makeModel("ARIMA", 0);
  const lstm = makeModel("LSTM", 100);
  const xgboost = makeModel("XGBoost", 200);

  const ensembleDir = [arima, lstm, xgboost].filter(m => m.direction === "UP").length >= 2 ? 1 : -1;
  const ensemble = {
    ...makeModel("Ensemble", 300),
    direction: ensembleDir > 0 ? "UP" : "DOWN",
    confidence: Math.round(([arima, lstm, xgboost].reduce((s, m) => s + m.confidence, 0) / 3) * 100) / 100,
  };

  const agreements = [arima, lstm, xgboost].filter(m => m.direction === ensemble.direction).length;
  const modelAgreement = Math.round((agreements / 3) * 100);

  return {
    symbol,
    currentPrice,
    arima,
    lstm,
    xgboost,
    ensemble,
    modelAgreement,
    regimeAdjusted: true,
    updatedAt: new Date().toISOString(),
  };
}
