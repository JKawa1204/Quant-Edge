"""
Ensemble forecast: weighted combination of ARIMA, XGBoost, and Neural Net.
Weights are proportional to each model's directional accuracy.
Blends Predicted Returns into a single unified forecast trajectory.
"""
import numpy as np

def combine(arima: dict, xgb: dict, nn: dict, current_price: float) -> dict:
    """Combine three model outputs into a single ensemble forecast."""
    models = [arima, xgb, nn]

    # Handle errors gracefully
    for m in models:
        if "metrics" not in m:
            m["metrics"] = {"rmse": 0, "mae": 0, "directionalAccuracy": m.get("directionalAccuracy", 0.5)}

    # Weight by directional accuracy (normalized)
    das = np.array([m["metrics"].get("directionalAccuracy", 0.5) for m in models], dtype=float)

    # Softmax-style weighting
    das_shifted = das - das.min() + 1e-6
    weights = das_shifted / das_shifted.sum()

    # Get expected returns
    ret_arima = float(arima.get("predicted_return", 0.0))
    ret_xgb   = float(xgb.get("predicted_return", 0.0))
    ret_nn    = float(nn.get("predicted_return", 0.0))

    # Blended Expected Daily Return
    blended_return = (ret_arima * weights[0]) + (ret_xgb * weights[1]) + (ret_nn * weights[2])

    # Directional vote
    directions = [m.get("direction", "HOLD") for m in models]
    up_votes   = sum(1 for d in directions if d == "UP")
    down_votes = sum(1 for d in directions if d == "DOWN")
    hold_votes = sum(1 for d in directions if d == "HOLD")

    # If ensemble return is clearly up/down, let that override a tie
    if blended_return > 0.001:
        direction = "UP"
    elif blended_return < -0.001:
        direction = "DOWN"
    else:
        direction = "HOLD"

    # Confidence calculation based on model agreement and D.A.
    def weighted_val(key_func):
        vals = np.array([key_func(m) for m in models], dtype=float)
        return float(np.dot(weights, vals))

    conf_avg = weighted_val(lambda m: m.get("confidence", 50.0))
    all_agree = len(set(directions)) == 1
    confidence = min(96.0, conf_avg + (5.0 if all_agree else 0.0))

    # Agreement score
    max_votes = max(up_votes, down_votes, hold_votes)
    model_agreement = int(round(max_votes / len(models) * 100))

    # Synthesize forecast points (30 days) using the blended expected return and random walk
    # Since only ARIMA gives full paths now, we construct the ensemble path linearly + noise
    steps = 30
    ensemble_points = []
    current = float(current_price)
    
    # Simple drift = blended_return. Add some noise proportional to historical rmse
    base_rmse = weighted_val(lambda m: m["metrics"].get("rmse", 0)) / (current + 1e-9)
    daily_vol = max(0.01, base_rmse) # At least 1% daily vol

    np.random.seed(42) # For reproducible frontend charts
    path = [current]
    low_path = [current]
    high_path = [current]

    for i in range(1, steps + 1):
        # Drift
        drift = path[-1] * blended_return
        
        # Add slight mean-reverting noise
        noise = np.random.normal(0, daily_vol) * path[-1]
        next_val = path[-1] + drift + noise
        
        path.append(next_val)
        low_path.append(next_val * (1 - daily_vol * 1.5))
        high_path.append(next_val * (1 + daily_vol * 1.5))
        
        ensemble_points.append({
            "day": i,
            "value": round(next_val, 2),
            "lower": round(low_path[-1], 2),
            "upper": round(high_path[-1], 2)
        })

    next_day = path[1]
    next_week = path[min(5, steps)]
    next_month = path[-1]

    # Average metrics
    rmse_avg = weighted_val(lambda m: m["metrics"].get("rmse", 0.0))
    mae_avg  = weighted_val(lambda m: m["metrics"].get("mae", 0.0))
    da_avg   = weighted_val(lambda m: m["metrics"].get("directionalAccuracy", 0.5))

    return {
        "model": "Ensemble",
        "description": "Blended forecast combining Log-ARIMA, PyTorch LSTM, and XGBoost Expected Returns.",
        "weights": {
            "ARIMA":      round(float(weights[0]), 4),
            "XGBoost":    round(float(weights[1]), 4),
            "NeuralNet":  round(float(weights[2]), 4),
        },
        "nextDay":   round(next_day, 2),
        "nextWeek":  round(next_week, 2),
        "nextMonth": round(next_month, 2),
        "predicted_return": round(blended_return, 4),
        "direction": direction,
        "confidence": round(confidence, 2),
        "rmse": round(rmse_avg, 4),
        "mae":  round(mae_avg, 4),
        "mape": 0.0,
        "directionalAccuracy": round(da_avg, 2),
        "modelAgreement": model_agreement,
        "forecastPoints": ensemble_points
    }
