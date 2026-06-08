"""
Script to pre-train all ML models for the Watchlist universe.
Iterates over all defined stocks in models.data.STOCKS, fetches data, 
and calls _run_forecast to trigger on-the-fly training and saving of models.
"""

import sys
import os
import time

# Add the ml-service directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import _run_forecast, get_ohlcv
from models.data import list_symbols

def main():
    symbols = list_symbols()
    print(f"Found {len(symbols)} stocks. Beginning pre-training pipeline...")
    
    success_count = 0
    fail_count = 0
    
    for i, symbol in enumerate(symbols):
        print(f"[{i+1}/{len(symbols)}] Training models for {symbol}...")
        
        try:
            # First ensure data is available, will simulate if not Upstox
            _ = get_ohlcv(symbol, days=252)
            
            # Run forecast which triggers XGBoost, Neural (LSTM), and ARIMA training
            _run_forecast(symbol)
            success_count += 1
            print(f"    -> Successfully trained and saved models for {symbol}.")
        except Exception as e:
            fail_count += 1
            print(f"    -> ERROR training {symbol}: {e}")
            
        # Give CPU a breather
        time.sleep(1)
        
    print("\n--- Pre-training Complete ---")
    print(f"Successfully pre-trained: {success_count} stocks")
    print(f"Failed: {fail_count} stocks")

if __name__ == "__main__":
    main()
