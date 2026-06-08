"""
Ensemble forecast: weighted combination of ARIMA, XGBoost, and Neural Net.
Weights are proportional to each model's directional accuracy.
Higher-accuracy models get stronger votes.
"""
import numpy as np


def combine(arima: dict, xgb: dict, nn: dict) -> dict:
    """Combine three model outputs into a single ensemble forecast."""
    models = [arima, xgb, nn]

    # Weight by directional accuracy (normalized)
    das = np.array([
        m.get("directionalAccuracy", 50.0) for m in models
    ], dtype=float)

    # Softmax-style weighting so weights sum to 1
    das_shifted = das - das.min() + 1e-6
    weights = das_shifted / das_shifted.sum()

    def weighted_val(key: str) -> float:
        vals = np.array([m.get(key, 0.0) for m in models], dtype=float)
        return float(np.dot(weights, vals))

    # Ensemble next-day / week / month
    next_day   = weighted_val("nextDay")
    next_week  = weighted_val("nextWeek")
    next_month = weighted_val("nextMonth")

    # Directional vote: majority rules
    directions = [m.get("direction", "HOLD") for m in models]
    up_votes   = sum(1 for d in directions if d == "UP")
    down_votes = sum(1 for d in directions if d == "DOWN")
    hold_votes = sum(1 for d in directions if d == "HOLD")

    if up_votes > down_votes and up_votes >= 1:
        direction = "UP"
    elif down_votes > up_votes and down_votes >= 1:
        direction = "DOWN"
    else:
        direction = "HOLD"

    # Ensemble confidence: weighted average, boosted when all agree
    conf_avg = weighted_val("confidence")
    all_agree = len(set(directions)) == 1
    confidence = min(96, conf_avg + (5 if all_agree else 0))

    # Weighted model agreement score
    max_votes = max(up_votes, down_votes, hold_votes)
    model_agreement = int(round(max_votes / len(models) * 100))

    # Ensemble forecast points — weighted average per step
    steps = max(
        len(arima.get("forecastPoints", [])),
        len(xgb.get("forecastPoints",  [])),
        len(nn.get("forecastPoints",   [])),
    )

    ensemble_points = []
    for i in range(steps):
        vals, lows, highs = [], [], []
        for m, w in zip(models, weights):
            pts = m.get("forecastPoints", [])
            if i < len(pts):
                vals.append(pts[i]["value"]  * w)
                lows.append(pts[i]["lower"]  * w)
                highs.append(pts[i]["upper"] * w)
        if vals:
            ensemble_points.append({
                "day":   i + 1,
                "value": round(sum(vals), 2),
                "lower": round(sum(lows), 2),
                "upper": round(sum(highs), 2),
            })

    # Average metrics
    rmse_avg = weighted_val("rmse")
    mae_avg  = weighted_val("mae")
    mape_avg = weighted_val("mape")
    da_avg   = weighted_val("directionalAccuracy")

    return {
        "model": "Ensemble",
        "description": "Weighted combination of ARIMA, XGBoost, and Neural Net. Weights are assigned proportional to each model's directional accuracy on held-out test data. Final direction decided by majority vote.",
        "weights": {
            "ARIMA":      round(float(weights[0]), 4),
            "XGBoost":    round(float(weights[1]), 4),
            "NeuralNet":  round(float(weights[2]), 4),
        },
        "nextDay":   round(next_day, 2),
        "nextWeek":  round(next_week, 2),
        "nextMonth": round(next_month, 2),
        "direction": direction,
        "confidence": round(confidence, 2),
        "rmse": round(rmse_avg, 4),
        "mae":  round(mae_avg, 4),
        "mape": round(mape_avg, 4),
        "directionalAccuracy": round(da_avg, 2),
        "modelAgreement": model_agreement,
        "forecastPoints": ensemble_points,
        "individualAgreement": {
            "allAgree":   all_agree,
            "upVotes":    up_votes,
            "downVotes":  len(models) - up_votes,
        },
    }
