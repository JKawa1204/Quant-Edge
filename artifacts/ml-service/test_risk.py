import sys
import os
import json

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models.monte_carlo import run_monte_carlo
from models.stress_test import run_stress_test

try:
    print("Testing MC...")
    mc = run_monte_carlo("RELIANCE.NS")
    print(json.dumps(mc))
except Exception as e:
    import traceback
    traceback.print_exc()

try:
    print("Testing Stress...")
    st = run_stress_test("RELIANCE.NS")
    print(json.dumps(st))
except Exception as e:
    import traceback
    traceback.print_exc()
