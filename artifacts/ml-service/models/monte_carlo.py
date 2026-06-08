import numpy as np
import pandas as pd
from models.data import get_ohlcv

def run_monte_carlo(symbol: str, days=252, simulations=2000, steps=30):
    """
    Simulate future price paths using Geometric Brownian Motion.
    Returns 5th, 50th, and 95th percentiles of the paths over `steps` days.
    """
    df = get_ohlcv(symbol, days=days)
    if df.empty or len(df) < 10:
        return {"error": "Not enough data to run Monte Carlo"}
    
    # Calculate daily returns
    returns = df['close'].pct_change().dropna()
    
    # Calculate drift and volatility
    mu = returns.mean()
    sigma = returns.std()
    
    last_price = df['close'].iloc[-1]
    
    # GBM Formula: S_t = S_{t-1} * exp((mu - 0.5 * sigma^2) + sigma * Z)
    drift = mu - (0.5 * sigma**2)
    
    paths = np.zeros((steps, simulations))
    paths[0] = last_price
    
    for t in range(1, steps):
        Z = np.random.standard_normal(simulations)
        paths[t] = paths[t-1] * np.exp(drift + sigma * Z)
    
    # Calculate percentiles for each step to plot a confidence cone
    percentile_5 = np.percentile(paths, 5, axis=1).tolist()
    percentile_50 = np.percentile(paths, 50, axis=1).tolist()
    percentile_95 = np.percentile(paths, 95, axis=1).tolist()
    
    return {
        "symbol": symbol,
        "currentPrice": float(last_price),
        "simulations": simulations,
        "steps": steps,
        "expectedReturnPct": float((percentile_50[-1] - last_price) / last_price * 100),
        "bounds": {
            "p5": percentile_5,
            "p50": percentile_50,
            "p95": percentile_95
        },
        "finalDistribution": {
            "p5": float(percentile_5[-1]),
            "p50": float(percentile_50[-1]),
            "p95": float(percentile_95[-1])
        }
    }
