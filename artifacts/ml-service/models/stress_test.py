import pandas as pd
import numpy as np
from models.data import get_ohlcv

# Historical Shock Scenarios (Percentage Drop / Volatility Multiplier)
SCENARIOS = {
    "2008_Financial_Crisis": {"drop": -0.40, "vol_multiplier": 3.0},
    "COVID_19_Crash": {"drop": -0.30, "vol_multiplier": 4.0},
    "Black_Monday": {"drop": -0.22, "vol_multiplier": 2.5},
    "Tech_Bubble_Burst": {"drop": -0.25, "vol_multiplier": 2.0}
}

def run_stress_test(symbol: str):
    """
    Applies historical extreme shocks to the current stock.
    Calculates Value at Risk (VaR) and a Vulnerability Score.
    """
    df = get_ohlcv(symbol, days=252)
    if df.empty or len(df) < 10:
        return {"error": "Not enough data for stress test"}
    
    returns = df['close'].pct_change().dropna()
    current_price = df['close'].iloc[-1]
    current_vol = returns.std() * np.sqrt(252) # Annualized
    
    results = {}
    total_risk_score = 0
    
    # Calculate 99% VaR (Value at Risk) based on historical simulation
    var_99 = np.percentile(returns, 1)
    
    for name, shock in SCENARIOS.items():
        # Simulated drop
        simulated_drop = shock['drop']
        stressed_price = current_price * (1 + simulated_drop)
        stressed_vol = current_vol * shock['vol_multiplier']
        
        # Risk score calculation (higher is worse)
        score = abs(simulated_drop * 100) + (stressed_vol * 10)
        total_risk_score += score
        
        results[name] = {
            "stressedPrice": float(round(stressed_price, 2)),
            "dropPercentage": float(round(simulated_drop * 100, 2)),
            "stressedVolatility": float(round(stressed_vol, 2))
        }
        
    avg_risk_score = min(100, round(total_risk_score / len(SCENARIOS)))
    
    return {
        "symbol": symbol,
        "currentPrice": float(current_price),
        "historicalVaR99Pct": float(round(var_99 * 100, 2)),
        "scenarios": results,
        "vulnerabilityScore": float(avg_risk_score)
    }
