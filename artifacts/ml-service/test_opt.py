import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models.optimization import build_portfolio, optimize_portfolio

try:
    print("Testing build_portfolio...")
    res1 = build_portfolio(10, "markowitz")
    print("Build Success:", list(res1.keys()) if isinstance(res1, dict) else res1)
except Exception as e:
    import traceback
    traceback.print_exc()

try:
    print("Testing optimize_portfolio...")
    res2 = optimize_portfolio(["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS"], "markowitz")
    print("Optimize Success:", list(res2.keys()) if isinstance(res2, dict) else res2)
except Exception as e:
    import traceback
    traceback.print_exc()
