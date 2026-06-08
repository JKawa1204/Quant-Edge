import os
import yfinance as yf
import pandas as pd
import numpy as np
import joblib
import logging

from models.xgboost_model import _build_features as xgb_features
import xgboost as xgb
from sklearn.preprocessing import StandardScaler
from sklearn.neural_network import MLPRegressor
from models.neural_model import _make_sequences
from pmdarima import auto_arima

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("train_models")

# Top Nifty 50 Symbols
NIFTY_50 = [
    "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "ICICIBANK.NS", "BHARTIARTL.NS",
    "SBIN.NS", "INFY.NS", "LICI.NS", "ITC.NS", "HINDUNILVR.NS",
    "LT.NS", "BAJFINANCE.NS", "HCLTECH.NS", "MARUTI.NS", "SUNPHARMA.NS",
    "TATAMOTORS.NS", "TATASTEEL.NS", "ONGC.NS", "NTPC.NS", "KOTAKBANK.NS",
    "AXISBANK.NS", "ADANIENT.NS", "WIPRO.NS", "ASIANPAINT.NS", "ULTRACEMCO.NS",
    "BAJAJFINSV.NS", "TITAN.NS", "NESTLEIND.NS", "POWERGRID.NS", "JSWSTEEL.NS",
    "TECHM.NS", "HINDALCO.NS", "GRASIM.NS", "INDUSINDBK.NS", "ADANIPORTS.NS",
    "DIVISLAB.NS", "CIPLA.NS", "BAJAJ-AUTO.NS", "LTIM.NS", "EICHERMOT.NS",
    "DRREDDY.NS", "BRITANNIA.NS", "TRENT.NS", "TATACONSUM.NS", "APOLLOHOSP.NS",
    "HEROMOTOCO.NS", "COALINDIA.NS", "SHRIRAMFIN.NS", "M&M.NS", "BPCL.NS"
]

SAVED_MODELS_DIR = os.path.join(os.path.dirname(__file__), "saved_models")
os.makedirs(SAVED_MODELS_DIR, exist_ok=True)

def train_xgboost(symbol, df):
    feat = xgb_features(df)
    if len(feat) < 50: return False
    X = feat.drop("target", axis=1).values
    y = feat["target"].values
    
    scaler = StandardScaler()
    X_s = scaler.fit_transform(X)
    
    model = xgb.XGBRegressor(
        n_estimators=200, max_depth=4, learning_rate=0.05,
        subsample=0.8, colsample_bytree=0.8, random_state=42, verbosity=0
    )
    model.fit(X_s, y)
    
    # Save model and scaler
    joblib.dump({"model": model, "scaler": scaler, "features": list(feat.drop("target", axis=1).columns)}, 
                os.path.join(SAVED_MODELS_DIR, f"{symbol}_xgboost.pkl"))
    return True

def train_neural(symbol, df):
    closes = df["close"].values.astype(float)
    if len(closes) < 100: return False
    
    X, y = _make_sequences(closes)
    scaler = StandardScaler()
    X_s = scaler.fit_transform(X)
    
    model = MLPRegressor(
        hidden_layer_sizes=(128, 64), activation="relu", solver="adam",
        learning_rate_init=0.001, max_iter=500, random_state=42,
        early_stopping=True, validation_fraction=0.1, n_iter_no_change=20
    )
    model.fit(X_s, y)
    
    joblib.dump({"model": model, "scaler": scaler}, 
                os.path.join(SAVED_MODELS_DIR, f"{symbol}_neural.pkl"))
    return True

def train_arima(symbol, df):
    closes = df["close"].values.astype(float)
    if len(closes) < 50: return False
    # ARIMA takes a long time, we use a simpler fit for bulk
    model = auto_arima(
        closes, start_p=1, start_q=1, max_p=3, max_q=3, d=1,
        seasonal=False, trace=False, error_action='ignore', suppress_warnings=True
    )
    joblib.dump(model, os.path.join(SAVED_MODELS_DIR, f"{symbol}_arima.pkl"))
    return True

def main():
    log.info(f"Starting local pre-training for {len(NIFTY_50)} symbols.")
    
    # Fetch all data at once to save network time
    log.info("Downloading historical data...")
    data = yf.download(NIFTY_50, period="5y", progress=False)
    
    for symbol in NIFTY_50:
        try:
            log.info(f"Training models for {symbol}...")
            # Extract symbol data
            if len(NIFTY_50) == 1:
                df = data.copy()
            else:
                df = pd.DataFrame({
                    "open": data["Open"][symbol],
                    "high": data["High"][symbol],
                    "low": data["Low"][symbol],
                    "close": data["Close"][symbol],
                    "volume": data["Volume"][symbol]
                }).dropna()
            
            if len(df) < 200:
                log.warning(f"Not enough data for {symbol}, skipping.")
                continue

            # 1. XGBoost
            train_xgboost(symbol, df)
            
            # 2. Neural Net
            train_neural(symbol, df)
            
            # 3. ARIMA (Might take 10-20 seconds per stock)
            train_arima(symbol, df)
            
            log.info(f"Successfully saved pre-trained models for {symbol}.")
        except Exception as e:
            log.error(f"Failed training for {symbol}: {e}")

    log.info("All pre-training complete. Weights saved to saved_models/ directory.")

if __name__ == "__main__":
    main()
