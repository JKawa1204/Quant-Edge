import sys
import os
import json

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models.optimization import optimize_portfolio

symbols = ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "ICICIBANK.NS", "INFY.NS", "ITC.NS", "SBIN.NS", "BHARTIARTL.NS", "BAJFINANCE.NS", "LICI.NS"]

try:
    res = optimize_portfolio(symbols, method="markowitz", risk_free_rate=0.065)
    print("SUCCESS")
    print(json.dumps(res, indent=2))
except Exception as e:
    print("ERROR")
    import traceback
    traceback.print_exc()
