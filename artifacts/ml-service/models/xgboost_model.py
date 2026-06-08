"""
XGBoost (Extreme Gradient Boosting) price forecasting.
Uses lag features, rolling statistics, and technical indicators as inputs.
XGBoost excels at capturing non-linear relationships and feature interactions.
"""
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error, mean_absolute_error


def _build_features(df: pd.DataFrame) -> pd.DataFrame:
    """Engineer features from OHLCV data for supervised learning."""
    feat = pd.DataFrame(index=df.index)
    close = df["close"]

    # Lag features: past N days' returns
    for lag in [1, 2, 3, 5, 10, 21]:
        feat[f"ret_{lag}d"] = close.pct_change(lag)

    # Rolling statistics
    for w in [5, 10, 21]:
        feat[f"sma_{w}"] = close.rolling(w).mean() / close - 1
        feat[f"std_{w}"] = close.rolling(w).std() / close

    # RSI
    delta = close.diff()
    gain  = delta.clip(lower=0).rolling(14).mean()
    loss  = (-delta.clip(upper=0)).rolling(14).mean()
    rs    = gain / (loss + 1e-9)
    feat["rsi"] = 100 - 100 / (1 + rs)

    # MACD
    ema12 = close.ewm(span=12).mean()
    ema26 = close.ewm(span=26).mean()
    feat["macd"] = (ema12 - ema26) / close

    # Bollinger Band position
    sma20 = close.rolling(20).mean()
    std20 = close.rolling(20).std()
    feat["bb_pos"] = (close - sma20) / (2 * std20 + 1e-9)

    # Volume ratio
    if "volume" in df.columns:
        feat["vol_ratio"] = df["volume"] / df["volume"].rolling(20).mean()

    # High-Low range
    feat["hl_range"] = (df["high"] - df["low"]) / close

    # Target: next-day return
    feat["target"] = close.shift(-1) / close - 1

    return feat.dropna()


import os
import joblib

def forecast(df: pd.DataFrame, steps: int = 30) -> dict:
    """
    Load pre-trained XGBoost if available, else fallback to training dynamically.
    """
    closes = df["close"].values.astype(float)
    symbol = df.name if hasattr(df, "name") else "unknown"

    try:
        feat = _build_features(df)
        X = feat.drop("target", axis=1).values
        y = feat["target"].values

        # Train/test split (80/20) for metrics
        split = int(len(X) * 0.8)
        X_train, X_test = X[:split], X[split:]
        y_train, y_test = y[:split], y[split:]

        # Check for pre-trained model (with or without .NS)
        model_path = os.path.join(os.path.dirname(__file__), "..", "saved_models", f"{symbol}_xgboost.pkl")
        model_path_ns = os.path.join(os.path.dirname(__file__), "..", "saved_models", f"{symbol}.NS_xgboost.pkl")
        
        if os.path.exists(model_path):
            saved = joblib.load(model_path)
            model = saved["model"]
            scaler = saved["scaler"]
            X_test_s = scaler.transform(X_test)
        elif os.path.exists(model_path_ns):
            saved = joblib.load(model_path_ns)
            model = saved["model"]
            scaler = saved["scaler"]
            X_test_s = scaler.transform(X_test)
        else:
            # Fallback (may cause OOM on small servers)
            scaler = StandardScaler()
            X_train_s = scaler.fit_transform(X_train)
            X_test_s  = scaler.transform(X_test)

            model = xgb.XGBRegressor(
                n_estimators=200, max_depth=4, learning_rate=0.05,
                subsample=0.8, colsample_bytree=0.8, random_state=42, verbosity=0
            )
            model.fit(X_train_s, y_train)

        y_pred_test = model.predict(X_test_s)

        # Metrics on test set
        rmse = float(np.sqrt(mean_squared_error(y_test, y_pred_test)))
        mae  = float(mean_absolute_error(y_test, y_pred_test))
        mape = float(np.mean(np.abs((y_test - y_pred_test) / (np.abs(y_test) + 1e-9))) * 100)
        da   = float(np.mean(np.sign(y_test) == np.sign(y_pred_test)) * 100)

        # Multi-step forecast by iterating predictions
        current = float(closes[-1])
        last_df = df.copy()
        points  = []
        price   = current

        for step in range(1, steps + 1):
            feat_step = _build_features(last_df)
            if len(feat_step) == 0:
                points.append({"day": step, "value": round(price, 2),
                                "lower": round(price * 0.97, 2), "upper": round(price * 1.03, 2)})
                continue

            x_last = scaler.transform(feat_step.drop("target", axis=1).values[[-1]])
            ret    = float(model.predict(x_last)[0])
            price  = price * (1 + ret)
            std_ret = float(np.std(y_test))
            lower  = price * (1 - 2 * std_ret * np.sqrt(step))
            upper  = price * (1 + 2 * std_ret * np.sqrt(step))
            points.append({
                "day":   step,
                "value": round(price, 2),
                "lower": round(lower, 2),
                "upper": round(upper, 2),
            })

            # Update last_df with predicted price
            new_row = last_df.iloc[[-1]].copy()
            new_row.index = [new_row.index[-1] + pd.Timedelta(days=1)]
            new_row["close"] = price
            new_row["open"]  = price
            new_row["high"]  = price * 1.005
            new_row["low"]   = price * 0.995
            last_df = pd.concat([last_df, new_row])

        direction  = "UP" if points[-1]["value"] > current else "DOWN"
        ret_scaled = float(np.abs(y_pred_test[-1])) * 100
        confidence = min(92, max(52, 70 + (da - 50) * 0.5 - rmse * 200))

        return {
            "model": "XGBoost",
            "order": "n_est=200, depth=4",
            "description": "Gradient Boosting Regressor trained on 15 engineered features including lag returns, RSI, MACD, Bollinger Band position, and volume ratio. Captures non-linear patterns and feature interactions.",
            "nextDay":   points[0]["value"],
            "nextWeek":  points[4]["value"] if len(points) >= 5 else points[-1]["value"],
            "nextMonth": points[-1]["value"],
            "direction": direction,
            "confidence": round(confidence, 2),
            "rmse": round(rmse * 1000, 4),
            "mae":  round(mae * 1000, 4),
            "mape": round(mape, 4),
            "directionalAccuracy": round(da, 2),
            "forecastPoints": points,
            "featureImportance": {k: round(float(v), 4)
                for k, v in zip(feat.drop("target", axis=1).columns,
                                model.feature_importances_)},
            "error": None,
        }

    except Exception as e:
        current = float(closes[-1])
        return {
            "model": "XGBoost",
            "description": "XGBoost model",
            "nextDay": current, "nextWeek": current, "nextMonth": current,
            "direction": "HOLD", "confidence": 50.0,
            "rmse": 0, "mae": 0, "mape": 0, "directionalAccuracy": 50.0,
            "forecastPoints": [], "featureImportance": {},
            "error": str(e),
        }
