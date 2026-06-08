"""
ARIMA (AutoRegressive Integrated Moving Average) forecasting.
Uses statsmodels ARIMA on Log-Transformed Close Prices as per user notebook.
"""
import numpy as np
import pandas as pd
import warnings
from statsmodels.tsa.arima.model import ARIMA
import os
import joblib
from sklearn.metrics import mean_squared_error, mean_absolute_error

warnings.filterwarnings("ignore")

def forecast(df: pd.DataFrame, steps: int = 30) -> dict:
    closes = df["close"].values.astype(float) if "close" in df.columns else df["Close"].values.astype(float)
    symbol = df.name if hasattr(df, "name") else "unknown"
    series = closes[-200:]  # Need more data for auto_arima

    try:
        # User notebook logic: Log transform
        df_log = np.log(series)
        
        # In a real pipeline, auto_arima should only be run once and saved.
        # Here we will try to load a pre-trained order, otherwise default to (1,1,1).
        # We will not run auto_arima dynamically on every API call because it is extremely slow.
        model_path = os.path.join(os.path.dirname(__file__), "..", "saved_models", f"{symbol}_arima.pkl")
        model_path_ns = os.path.join(os.path.dirname(__file__), "..", "saved_models", f"{symbol}.NS_arima.pkl")
        target_path = model_path if os.path.exists(model_path) else (model_path_ns if os.path.exists(model_path_ns) else None)
        
        order = (1, 1, 1) # Default
        
        if target_path:
            try:
                saved = joblib.load(target_path)
                if hasattr(saved, 'order'):
                    order = saved.order
            except:
                pass
                
        # Fit ARIMA on Log Data
        model = ARIMA(df_log, order=order)
        fitted = model.fit()
        
        try:
            os.makedirs(os.path.dirname(model_path), exist_ok=True)
            # Just save the order to avoid pickling the massive statsmodels wrapper
            class Stub:
                def __init__(self, o):
                    self.order = o
            joblib.dump(Stub(order), model_path)
        except Exception as e:
            pass
        
        # Forecast log prices
        forecast_obj = fitted.get_forecast(steps=steps)
        pred_mean_log = forecast_obj.predicted_mean
        conf_int_log  = forecast_obj.conf_int(alpha=0.05)
        in_sample_log = fitted.fittedvalues
        
        # Inverse Transform (Exp) back to actual prices
        pred_mean = np.exp(pred_mean_log)
        conf_int = np.exp(conf_int_log)
        in_sample = np.exp(in_sample_log)
        
        # Metrics on actuals
        actuals = series[1:]
        residuals = actuals - in_sample[-len(actuals):]
        rmse = float(np.sqrt(np.mean(residuals ** 2)))
        mae  = float(np.mean(np.abs(residuals)))
        
        # Directional Accuracy
        actual_dir  = np.sign(np.diff(actuals[-31:]))
        pred_dir    = np.sign(np.diff(in_sample[-31:]))
        if len(actual_dir) > 0 and len(pred_dir) > 0:
            da = float(np.mean(actual_dir == pred_dir))
        else:
            da = 0.5
        
        current = float(series[-1])
        points = []
        for i, (mean, low, high) in enumerate(
            zip(pred_mean, conf_int.iloc[:, 0], conf_int.iloc[:, 1]), 1
        ):
            points.append({
                "day": i,
                "value": round(float(mean), 2),
                "lower": round(float(low), 2),
                "upper": round(float(high), 2),
            })

        expected_return = float((pred_mean.iloc[0] - current) / current)
        direction = "UP" if expected_return > 0.001 else "DOWN" if expected_return < -0.001 else "HOLD"
        
        confidence = min(95.0, max(50.0, 50 + (da - 0.5) * 100))

        return {
            "model": "ARIMA",
            "order": str(order),
            "description": "ARIMA fitted on Log-Transformed Close prices.",
            "nextDay":   round(float(pred_mean.iloc[0]), 2),
            "nextWeek":  round(float(pred_mean.iloc[min(4, steps-1)]), 2),
            "nextMonth": round(float(pred_mean.iloc[-1]), 2),
            "predicted_return": expected_return,
            "predicted_price": float(pred_mean.iloc[0]),
            "direction": direction,
            "confidence": round(confidence, 2),
            "rmse": round(rmse, 4),
            "mae":  round(mae, 4),
            "mape": 0.0,
            "directionalAccuracy": da,
            "forecastPoints": points,
            "error": None,
        }
    except Exception as e:
        return {
            "model": "ARIMA", "order": "(1,1,1)",
            "direction": "HOLD", "confidence": 50.0,
            "predicted_return": 0.0, "predicted_price": 0.0,
            "metrics": {"rmse": 0, "mae": 0, "directionalAccuracy": 0.5},
            "error": str(e)
        }
