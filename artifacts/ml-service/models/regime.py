"""
Market Regime Detection using rule-based technical indicators.
Classifies the market into: Bull, Bear, Sideways, High Volatility, Low Volatility.

Logic:
  - Volatility: 20-day realized vol annualized
  - Trend:      50-day vs 200-day SMA cross (price above/below)
  - Momentum:   14-day RSI
  - Breadth:    Average cross-stock return over last 20 days
"""
import numpy as np
import pandas as pd
from typing import Dict, Any


def detect_regime(df: pd.DataFrame) -> Dict[str, Any]:
    """Detect current market regime from OHLCV data."""
    closes = df["close"].values.astype(float)

    # Realized volatility (annualized)
    returns = np.diff(closes) / closes[:-1]
    vol_20d = float(np.std(returns[-20:]) * np.sqrt(252) * 100)  # %

    # Moving averages
    sma50  = float(np.mean(closes[-50:])) if len(closes) >= 50 else closes[-1]
    sma200 = float(np.mean(closes[-200:])) if len(closes) >= 200 else closes[-1]
    current = float(closes[-1])

    above_sma50  = current > sma50
    above_sma200 = current > sma200
    golden_cross = sma50 > sma200  # bullish when true

    # RSI
    delta = np.diff(closes[-16:])
    gains = np.maximum(delta, 0)
    losses = np.maximum(-delta, 0)
    avg_gain = np.mean(gains[-14:]) + 1e-9
    avg_loss = np.mean(losses[-14:]) + 1e-9
    rs  = avg_gain / avg_loss
    rsi = float(100 - 100 / (1 + rs))

    # Trend strength: slope of 20-day linear regression
    x = np.arange(20)
    y = closes[-20:]
    slope = float(np.polyfit(x, y, 1)[0])
    slope_pct = (slope / current) * 100  # % per day

    # Recent return
    ret_20d = float((closes[-1] / closes[-21] - 1) * 100) if len(closes) >= 21 else 0.0

    # --- Classification ---
    if vol_20d > 30:
        regime = "High Volatility"
        description = "Market is exhibiting extreme volatility (>30% annualized). Reduce position sizes and avoid leveraged trades. Options strategies for protection are advisable."
        strategy = "Reduce exposure. Hedge with options. Wait for volatility to compress before adding risk."
    elif vol_20d < 10:
        regime = "Low Volatility"
        description = "Market is extremely calm (<10% annualized vol). Often precedes volatility spikes. Momentum strategies tend to work well in this environment."
        strategy = "Momentum strategies work well. Consider selling options premium. Trend-following signals are reliable."
    elif golden_cross and above_sma200 and ret_20d > 2:
        regime = "Bull Market"
        description = "Price above both 50-day and 200-day SMA with a golden cross. Upward momentum is strong. Trend-following long strategies are favored."
        strategy = "Increase equity allocation. Focus on high-momentum stocks. Growth and cyclical sectors outperform."
    elif not golden_cross and not above_sma200 and ret_20d < -2:
        regime = "Bear Market"
        description = "Price below both SMAs with a death cross. Downward trend is established. Defensive positioning and capital preservation take priority."
        strategy = "Defensive allocation. Shift to bonds, gold, and cash. Quality dividend stocks over growth. Short signals from ML models take higher weight."
    else:
        regime = "Sideways Market"
        description = "Price oscillating without clear directional bias. Mixed signals from trend indicators. Mean-reversion strategies are preferred over momentum."
        strategy = "Equal-weight allocation. Mean-reversion trades. Set tight stop-losses. Sector rotation based on relative strength."

    # Confidence from signal coherence
    signals_aligned = sum([
        golden_cross and ret_20d > 0,
        not golden_cross and ret_20d < 0,
        above_sma50 == above_sma200,
        vol_20d < 20 or vol_20d > 30,
    ])
    confidence = round(55 + signals_aligned * 10, 2)

    return {
        "regime":      regime,
        "confidence":  confidence,
        "description": description,
        "strategy":    strategy,
        "indicators": {
            "volatility20d":  round(vol_20d, 2),
            "sma50":          round(sma50, 2),
            "sma200":         round(sma200, 2),
            "currentPrice":   round(current, 2),
            "aboveSma50":     above_sma50,
            "aboveSma200":    above_sma200,
            "goldenCross":    golden_cross,
            "rsi":            round(rsi, 2),
            "return20d":      round(ret_20d, 2),
            "slopePctPerDay": round(slope_pct, 4),
        },
    }
