import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models.optimization import _build_returns_df, markowitz_optimize
from models.data import list_symbols

symbols = list_symbols()[:10]
df = _build_returns_df(symbols)

try:
    res = markowitz_optimize(symbols, df)
    print("SUCCESS")
    print(res)
except Exception as e:
    print("ERROR")
    import traceback
    traceback.print_exc()
