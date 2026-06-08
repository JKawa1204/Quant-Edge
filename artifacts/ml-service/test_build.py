import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models.optimization import build_portfolio

try:
    res = build_portfolio(count=10, method="markowitz", risk_free_rate=0.065)
    print("SUCCESS")
    print(res)
except Exception as e:
    print("ERROR")
    import traceback
    traceback.print_exc()
