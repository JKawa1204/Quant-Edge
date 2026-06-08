"""
LSTM (Long Short-Term Memory) neural network for sequence prediction.
Uses PyTorch to train an LSTM on Open, High, Low, Close daily returns.
"""
import os
import joblib
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score

class LSTMModel(nn.Module):
    def __init__(self, n_features, hidden=64):
        super().__init__()
        self.lstm = nn.LSTM(n_features, hidden, batch_first=True)
        self.fc = nn.Linear(hidden, n_features)

    def forward(self, x):
        _, (h, _) = self.lstm(x)
        return self.fc(h[-1])

def _create_sequences(data, window=30):
    X, y = [], []
    for i in range(window, len(data)):
        X.append(data[i-window:i])
        y.append(data[i])
    return np.array(X), np.array(y)

def forecast(df: pd.DataFrame, steps: int = 30) -> dict:
    symbol = df.name if hasattr(df, "name") else "unknown"
    
    # 1. Prepare Data
    # Use Open, High, Low, Close
    cols = []
    for c in ['Open', 'High', 'Low', 'Close']:
        if c in df.columns:
            cols.append(c)
        elif c.lower() in df.columns:
            cols.append(c.lower())
    
    if len(cols) != 4:
        return {"direction": "HOLD", "confidence": 50.0, "predicted_return": 0.0, "metrics": {"rmse": 0, "mae": 0, "directionalAccuracy": 0.5}}
        
    data = df[cols].copy()
    returns = data.pct_change().dropna()
    
    if len(returns) < 50:
        return {"direction": "HOLD", "confidence": 50.0, "predicted_return": 0.0, "metrics": {"rmse": 0, "mae": 0, "directionalAccuracy": 0.5}}

    scaler = MinMaxScaler()
    scaled = scaler.fit_transform(returns)
    
    X, y = _create_sequences(scaled, window=30)
    if len(X) == 0:
        return {"direction": "HOLD", "confidence": 50.0, "predicted_return": 0.0, "metrics": {"rmse": 0, "mae": 0, "directionalAccuracy": 0.5}}
        
    X_t = torch.tensor(X, dtype=torch.float32)
    y_t = torch.tensor(y, dtype=torch.float32)

    split = int(0.8 * len(X))
    X_train, X_test = X_t[:split], X_t[split:]
    y_train, y_test = y_t[:split], y_t[split:]

    model_path = os.path.join(os.path.dirname(__file__), "..", "saved_models", f"{symbol}_neural.pkl")
    model_path_ns = os.path.join(os.path.dirname(__file__), "..", "saved_models", f"{symbol}.NS_neural.pkl")
    target_path = model_path if os.path.exists(model_path) else (model_path_ns if os.path.exists(model_path_ns) else None)

    # 2. Train or Load Model
    if target_path:
        saved = joblib.load(target_path)
        model = saved["model"]
        scaler = saved["scaler"]
    else:
        model = LSTMModel(X.shape[2], hidden=64)
        criterion = nn.MSELoss()
        optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
        
        for epoch in range(20):
            optimizer.zero_grad()
            preds = model(X_train)
            loss = criterion(preds, y_train)
            loss.backward()
            optimizer.step()
            
        try:
            os.makedirs(os.path.dirname(model_path), exist_ok=True)
            joblib.dump({"model": model, "scaler": scaler}, model_path)
        except Exception as e:
            pass

    # 3. Evaluate
    model.eval()
    with torch.no_grad():
        if len(X_test) > 0:
            preds_test = model(X_test).numpy()
            actual_test = y_test.numpy()
            
            # Index 3 corresponds to Close Return
            rmse = float(np.sqrt(mean_squared_error(actual_test[:, 3], preds_test[:, 3])))
            mae = float(mean_absolute_error(actual_test[:, 3], preds_test[:, 3]))
            
            # Directional Accuracy
            da = float(np.mean(np.sign(actual_test[:, 3] - 0.5) == np.sign(preds_test[:, 3] - 0.5)))
        else:
            rmse, mae, da = 0.0, 0.0, 0.5

    # 4. Predict Next Day
    last_window = scaled[-30:]
    last_window_t = torch.tensor([last_window], dtype=torch.float32)
    with torch.no_grad():
        pred_scaled = model(last_window_t).numpy()
    
    pred_unscaled = scaler.inverse_transform(pred_scaled)
    # Return index 3 is Close Return
    expected_return = float(pred_unscaled[0, 3])

    direction = "UP" if expected_return > 0.001 else "DOWN" if expected_return < -0.001 else "HOLD"
    confidence = min(95.0, max(50.0, 50 + (da - 0.5) * 100))

    return {
        "direction": direction,
        "confidence": float(confidence),
        "predicted_return": expected_return,
        "metrics": {
            "rmse": rmse,
            "mae": mae,
            "directionalAccuracy": da
        }
    }
