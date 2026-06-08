"""
XGBoost (Extreme Gradient Boosting) price forecasting.
Uses features explicitly defined in the user's xgboost.ipynb notebook.
Predicts the Raw Close Price and converts it to Expected Return.
"""
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import mean_squared_error, mean_absolute_error
import os
import joblib

def _build_features(df: pd.DataFrame, predict_mode=False) -> pd.DataFrame:
    """Engineer features exactly as per xgboost.ipynb."""
    feat = df.copy()
    
    # In live data, columns might be lowercase. Normalize to Title Case if needed.
    if 'close' in feat.columns and 'Close' not in feat.columns:
        feat = feat.rename(columns={'open':'Open', 'high':'High', 'low':'Low', 'close':'Close', 'volume':'Volume'})

    feat['Return'] = feat['Close'].pct_change()
    feat['Lag_1'] = feat['Return'].shift(1)
    feat['Lag_2'] = feat['Return'].shift(2)
    feat['Lag_3'] = feat['Return'].shift(3)

    feat['MA_5'] = feat['Close'].rolling(5).mean()
    feat['MA_10'] = feat['Close'].rolling(10).mean()

    feat['Volatility'] = feat['Return'].rolling(10).std()

    if not predict_mode:
        feat.dropna(inplace=True)
    return feat

def forecast(df: pd.DataFrame, steps: int = 30) -> dict:
    symbol = df.name if hasattr(df, "name") else "unknown"
    
    # 1. Feature Engineering
    feat = _build_features(df, predict_mode=False)
    if len(feat) < 50:
        return {"direction": "HOLD", "confidence": 50.0, "metrics": {"rmse": 0, "mae": 0, "directionalAccuracy": 0.5}, "predicted_return": 0.0}

    # As per notebook: Predict Raw Close Price
    X = feat.drop(columns=['Close'])
    y = feat['Close']

    split = int(len(X) * 0.8)
    X_train, X_test = X.iloc[:split], X.iloc[split:]
    y_train, y_test = y.iloc[:split], y.iloc[split:]

    model_path = os.path.join(os.path.dirname(__file__), "..", "saved_models", f"{symbol}_xgboost.pkl")
    model_path_ns = os.path.join(os.path.dirname(__file__), "..", "saved_models", f"{symbol}.NS_xgboost.pkl")
    target_path = model_path if os.path.exists(model_path) else (model_path_ns if os.path.exists(model_path_ns) else None)

    # 2. Train or Load Model
    if target_path:
        saved = joblib.load(target_path)
        model = saved["model"]
    else:
        # Train on the fly using notebook parameters
        model = xgb.XGBRegressor(
            n_estimators=200,
            max_depth=5,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            objective='reg:squarederror',
            random_state=42
        )
        model.fit(X_train, y_train)
        
        # Save model for future use
        try:
            os.makedirs(os.path.dirname(model_path), exist_ok=True)
            joblib.dump({"model": model}, model_path)
        except Exception as e:
            pass

    # 3. Predict & Evaluate
    preds = model.predict(X_test)
    
    rmse = float(np.sqrt(mean_squared_error(y_test, preds)))
    mae  = float(mean_absolute_error(y_test, preds))

    # Directional Accuracy (comparing actual price move vs predicted price move)
    actual_returns = y_test.diff().dropna()
    predicted_returns = pd.Series(preds, index=y_test.index).diff().dropna()
    if len(actual_returns) > 0 and len(predicted_returns) > 0:
        da = float(np.mean(np.sign(actual_returns) == np.sign(predicted_returns)))
    else:
        da = 0.5

    # 4. Forecast Next Day
    last_row = _build_features(df, predict_mode=True).iloc[-1:]
    X_last = last_row.drop(columns=['Close'])
    
    try:
        next_price = model.predict(X_last)[0]
    except Exception as e:
        # If prediction fails (e.g. missing columns), return default
        return {"direction": "HOLD", "confidence": 50.0, "predicted_return": 0.0, "metrics": {"rmse": rmse, "mae": mae, "directionalAccuracy": da}}

    current_price = float(df['close'].iloc[-1] if 'close' in df.columns else df['Close'].iloc[-1])
    
    # Calculate Expected Return Percentage
    expected_return = float((next_price - current_price) / current_price)

    # Derive Direction and Confidence
    direction = "UP" if expected_return > 0.001 else "DOWN" if expected_return < -0.001 else "HOLD"
    
    # Base confidence on directional accuracy mapped to 50-95%
    confidence = min(95.0, max(50.0, 50 + (da - 0.5) * 100))

    return {
        "direction": direction,
        "confidence": float(confidence),
        "predicted_return": expected_return,
        "predicted_price": float(next_price),
        "metrics": {
            "rmse": rmse,
            "mae": mae,
            "directionalAccuracy": da
        }
    }
