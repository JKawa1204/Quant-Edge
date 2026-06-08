"""
Neural Network (MLP) price forecasting — a feedforward network that
approximates LSTM-style sequence learning via lag feature windows.
Uses scikit-learn MLPRegressor: no TensorFlow/PyTorch dependency needed.

Architecture: Input(30 lag returns) → Dense(128,relu) → Dense(64,relu) → Dense(1)
"""
import numpy as np
import pandas as pd
from sklearn.neural_network import MLPRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error, mean_absolute_error


WINDOW = 30  # look-back window (sequence length)


def _make_sequences(prices: np.ndarray):
    """Convert price series to supervised sequences."""
    returns = np.diff(prices) / prices[:-1]  # log-return-like
    X, y = [], []
    for i in range(WINDOW, len(returns)):
        X.append(returns[i - WINDOW:i])
        y.append(returns[i])
    return np.array(X), np.array(y)


import os
import joblib

def forecast(df: pd.DataFrame, steps: int = 30) -> dict:
    closes = df["close"].values.astype(float)
    symbol = df.name if hasattr(df, "name") else "unknown"

    try:
        X, y = _make_sequences(closes)

        split = int(len(X) * 0.8)
        X_train, X_test = X[:split], X[split:]
        y_train, y_test = y[:split], y[split:]

        model_path = os.path.join(os.path.dirname(__file__), "..", "saved_models", f"{symbol}_neural.pkl")
        model_path_ns = os.path.join(os.path.dirname(__file__), "..", "saved_models", f"{symbol}.NS_neural.pkl")
        
        if os.path.exists(model_path):
            saved = joblib.load(model_path)
            model = saved["model"]
            scaler = saved["scaler"]
            X_test_s = scaler.transform(X_test)
            iterations = getattr(model, "n_iter_", 0)
        elif os.path.exists(model_path_ns):
            saved = joblib.load(model_path_ns)
            model = saved["model"]
            scaler = saved["scaler"]
            X_test_s = scaler.transform(X_test)
            iterations = getattr(model, "n_iter_", 0)
        else:
            # Fallback if no pre-trained model: Return default 50% HOLD
            return {
                "model": "Neural Net (MLP)",
                "description": "Multi-Layer Perceptron Regressor.",
                "nextDay": float(closes[-1]),
                "nextWeek": float(closes[-1]),
                "nextMonth": float(closes[-1]),
                "direction": "HOLD",
                "confidence": 50.0,
                "rmse": 0.0,
                "mae": 0.0,
                "mape": 0.0,
                "directionalAccuracy": 50.0,
                "forecastPoints": [{"day": i, "value": round(float(closes[-1]), 2), "lower": round(float(closes[-1]), 2), "upper": round(float(closes[-1]), 2)} for i in range(1, steps + 1)],
                "featureImportance": {},
            }

        y_pred_test = model.predict(X_test_s)

        prices_scaled = closes / closes[0]  # normalize
        rmse_ret = float(np.sqrt(mean_squared_error(y_test, y_pred_test)))
        mae_ret  = float(mean_absolute_error(y_test, y_pred_test))
        mape     = float(np.mean(np.abs((y_test - y_pred_test) / (np.abs(y_test) + 1e-9))) * 100)
        da       = float(np.mean(np.sign(y_test) == np.sign(y_pred_test)) * 100)

        # Multi-step forecast
        current   = float(closes[-1])
        price     = current
        window    = list(np.diff(closes[-WINDOW - 1:]) / closes[-WINDOW - 1:-1])
        points    = []

        for step in range(1, steps + 1):
            x_input = np.array(window[-WINDOW:]).reshape(1, -1)
            x_scaled = scaler.transform(x_input)
            ret   = float(model.predict(x_scaled)[0])
            price = price * (1 + ret)
            std   = float(np.std(y_test))
            lower = price * (1 - 2 * std * np.sqrt(step))
            upper = price * (1 + 2 * std * np.sqrt(step))
            points.append({
                "day":   step,
                "value": round(price, 2),
                "lower": round(lower, 2),
                "upper": round(upper, 2),
            })
            window.append(ret)

        direction  = "UP" if points[-1]["value"] > current else "DOWN"
        confidence = min(90, max(52, 65 + (da - 50) * 0.6 - rmse_ret * 1000))

        return {
            "model": "Neural Net (MLP)",
            "order": "Layers: [30→128→64→1]",
            "description": "Multi-Layer Perceptron trained on 30-day return sequences. Mimics LSTM-style temporal learning by treating each look-back window as a flat feature vector. Uses ReLU activations with early stopping.",
            "nextDay":   points[0]["value"],
            "nextWeek":  points[4]["value"] if len(points) >= 5 else points[-1]["value"],
            "nextMonth": points[-1]["value"],
            "direction": direction,
            "confidence": round(confidence, 2),
            "rmse": round(rmse_ret * 1000, 4),
            "mae":  round(mae_ret * 1000, 4),
            "mape": round(mape, 4),
            "directionalAccuracy": round(da, 2),
            "forecastPoints": points,
            "iterations": iterations,
            "error": None,
        }

    except Exception as e:
        current = float(closes[-1])
        return {
            "model": "Neural Net (MLP)",
            "description": "MLP model",
            "nextDay": current, "nextWeek": current, "nextMonth": current,
            "direction": "HOLD", "confidence": 50.0,
            "rmse": 0, "mae": 0, "mape": 0, "directionalAccuracy": 50.0,
            "forecastPoints": [],
            "error": str(e),
        }
