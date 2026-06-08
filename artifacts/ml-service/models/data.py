"""
Simulated OHLCV market data engine.
Replace get_current_price() and get_ohlcv() with Upstox API calls
once credentials are configured.
"""
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

STOCKS = {
    "RELIANCE":    {"company": "Reliance Industries",          "sector": "Energy",      "base": 2850},
    "TCS":         {"company": "Tata Consultancy Services",    "sector": "Technology",  "base": 3920},
    "HDFCBANK":    {"company": "HDFC Bank",                    "sector": "Financials",  "base": 1720},
    "INFY":        {"company": "Infosys",                      "sector": "Technology",  "base": 1820},
    "ICICIBANK":   {"company": "ICICI Bank",                   "sector": "Financials",  "base": 1240},
    "HINDUNILVR":  {"company": "Hindustan Unilever",           "sector": "Consumer",    "base": 2560},
    "ITC":         {"company": "ITC",                          "sector": "Consumer",    "base": 460},
    "SBIN":        {"company": "State Bank of India",          "sector": "Financials",  "base": 820},
    "BHARTIARTL":  {"company": "Bharti Airtel",                "sector": "Telecom",     "base": 1460},
    "KOTAKBANK":   {"company": "Kotak Mahindra Bank",          "sector": "Financials",  "base": 1780},
    "LT":          {"company": "Larsen & Toubro",              "sector": "Industrials", "base": 3650},
    "AXISBANK":    {"company": "Axis Bank",                    "sector": "Financials",  "base": 1080},
    "BAJFINANCE":  {"company": "Bajaj Finance",                "sector": "Financials",  "base": 7200},
    "ASIANPAINT":  {"company": "Asian Paints",                 "sector": "Consumer",    "base": 2850},
    "MARUTI":      {"company": "Maruti Suzuki",                "sector": "Auto",        "base": 12400},
    "SUNPHARMA":   {"company": "Sun Pharmaceutical",           "sector": "Healthcare",  "base": 1680},
    "TITAN":       {"company": "Titan Company",                "sector": "Consumer",    "base": 3450},
    "HCLTECH":     {"company": "HCL Technologies",             "sector": "Technology",  "base": 1620},
    "NTPC":        {"company": "NTPC",                         "sector": "Utilities",   "base": 390},
    "TATAMOTORS":  {"company": "Tata Motors",                  "sector": "Auto",        "base": 980},
    "ULTRACEMCO":  {"company": "UltraTech Cement",             "sector": "Materials",   "base": 10800},
    "NESTLEIND":   {"company": "Nestle India",                 "sector": "Consumer",    "base": 2480},
    "POWERGRID":   {"company": "Power Grid Corporation",       "sector": "Utilities",   "base": 340},
    "M&M":         {"company": "Mahindra & Mahindra",          "sector": "Auto",        "base": 2650},
    "BAJAJ-AUTO":  {"company": "Bajaj Auto",                   "sector": "Auto",        "base": 9200},
    "WIPRO":       {"company": "Wipro",                        "sector": "Technology",  "base": 540},
    "ADANIPORTS":  {"company": "Adani Ports",                  "sector": "Industrials", "base": 1380},
    "INDUSINDBK":  {"company": "IndusInd Bank",                "sector": "Financials",  "base": 1450},
    "TECHM":       {"company": "Tech Mahindra",                "sector": "Technology",  "base": 1560},
    "TATASTEEL":   {"company": "Tata Steel",                   "sector": "Materials",   "base": 160},
    "ADANIENT":    {"company": "Adani Enterprises",            "sector": "Industrials", "base": 2800},
    "APOLLOHOSP":  {"company": "Apollo Hospitals",             "sector": "Healthcare",  "base": 6400},
    "BAJAJFINSV":  {"company": "Bajaj Finserv",                "sector": "Financials",  "base": 1680},
    "BPCL":        {"company": "Bharat Petroleum",             "sector": "Energy",      "base": 620},
    "BRITANNIA":   {"company": "Britannia Industries",         "sector": "Consumer",    "base": 5400},
    "CIPLA":       {"company": "Cipla",                        "sector": "Healthcare",  "base": 1480},
    "COALINDIA":   {"company": "Coal India",                   "sector": "Energy",      "base": 440},
    "DIVISLAB":    {"company": "Divi's Laboratories",          "sector": "Healthcare",  "base": 3800},
    "DRREDDY":     {"company": "Dr. Reddy's Laboratories",     "sector": "Healthcare",  "base": 6200},
    "EICHERMOT":   {"company": "Eicher Motors",                "sector": "Auto",        "base": 4600},
    "GRASIM":      {"company": "Grasim Industries",            "sector": "Materials",   "base": 2350},
    "HDFCLIFE":    {"company": "HDFC Life Insurance",          "sector": "Financials",  "base": 680},
    "HEROILMOTOCO": {"company": "Hero MotoCorp",              "sector": "Auto",        "base": 4800},
    "HINDALCO":    {"company": "Hindalco Industries",          "sector": "Materials",   "base": 620},
    "JSWSTEEL":    {"company": "JSW Steel",                    "sector": "Materials",   "base": 880},
    "ONGC":        {"company": "Oil & Natural Gas Corporation","sector": "Energy",      "base": 280},
    "SBILIFE":     {"company": "SBI Life Insurance",           "sector": "Financials",  "base": 1650},
    "TATACONSUM":  {"company": "Tata Consumer Products",       "sector": "Consumer",    "base": 1150},
    "SHRIRAMFIN":  {"company": "Shriram Finance",              "sector": "Financials",  "base": 2700},
    "TRENT":       {"company": "Trent",                        "sector": "Consumer",    "base": 5800},
}


def _seed(symbol: str, offset: int = 0) -> float:
    s = sum(ord(c) * (i + 1) for i, c in enumerate(symbol)) + offset
    np.random.seed(s % 2**32)
    return np.random.random()


def get_ohlcv(symbol: str, days: int = 252) -> pd.DataFrame:
    """Generate deterministic synthetic OHLCV series for a symbol."""
    info = STOCKS.get(symbol, {"base": 1000})
    base = info["base"]

    np.random.seed(sum(ord(c) for c in symbol) % 2**32)
    returns = np.random.normal(0.0003, 0.015, days)
    prices = [base]
    for r in returns:
        prices.append(prices[-1] * (1 + r))

    rows = []
    today = datetime.utcnow().date()
    for i, close in enumerate(prices[1:], 1):
        date = today - timedelta(days=days - i)
        np.random.seed((sum(ord(c) for c in symbol) + i) % 2**32)
        spread = close * 0.012
        open_ = close + np.random.uniform(-spread * 0.4, spread * 0.4)
        high  = max(open_, close) + np.random.uniform(0, spread * 0.6)
        low   = min(open_, close) - np.random.uniform(0, spread * 0.6)
        vol   = int(np.random.uniform(200_000, 2_000_000))
        rows.append({
            "date":   date,
            "open":   round(open_, 2),
            "high":   round(high, 2),
            "low":    round(low, 2),
            "close":  round(close, 2),
            "volume": vol,
        })

    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["date"])
    df.set_index("date", inplace=True)
    return df


def get_current_price(symbol: str) -> float:
    df = get_ohlcv(symbol, days=2)
    return float(df["close"].iloc[-1])


def get_day_open_price(symbol: str) -> float:
    """Today's open price — used for today's P&L calculation."""
    df = get_ohlcv(symbol, days=2)
    return float(df["open"].iloc[-1])


def list_symbols():
    return list(STOCKS.keys())


def get_stock_info(symbol: str) -> dict:
    return STOCKS.get(symbol, {"company": symbol, "sector": "Unknown", "base": 1000})
