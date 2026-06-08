"""
ARIMA (AutoRegressive Integrated Moving Average) forecasting (MOCKED).
"""
import numpy as np
import pandas as pd
import warnings

warnings.filterwarnings("ignore")

def forecast(df: pd.DataFrame, steps: int = 30) -> dict:
    closes = df["close"].values.astype(float) if "close" in df.columns else df["Close"].values.astype(float)
    series = closes[-20:]
    last_val = series[-1]
    
    np.random.seed(int(last_val * 100) % 2**32)
    drift = np.random.normal(0.0001, 0.002)
    
    preds = [last_val]
    upper = []
    lower = []
    
    for i in range(steps):
        next_val = preds[-1] * (1 + drift + np.random.normal(0, 0.005))
        preds.append(next_val)
        margin = next_val * 0.02 * (i + 1)
        upper.append(next_val + margin)
        lower.append(next_val - margin)
        
    preds = preds[1:]
    
    # Calculate basic metrics
    da = float(np.random.uniform(50, 65))
    confidence = float(np.random.uniform(60, 85))
    
    return {
        "predictions": [round(float(p), 2) for p in preds],
        "upper": [round(float(u), 2) for u in upper],
        "lower": [round(float(l), 2) for l in lower],
        "rmse": float(last_val * 0.015),
        "mae": float(last_val * 0.012),
        "mape": float(1.5),
        "directionalAccuracy": round(da, 2),
        "confidence": round(confidence, 2),
        "direction": "UP" if preds[-1] > last_val else "DOWN"
    }
