"""
ARIMA (AutoRegressive Integrated Moving Average) forecasting.
Uses statsmodels ARIMA(5,1,0) — a classic time series model that
captures autocorrelation patterns in price returns.
"""
import numpy as np
import warnings
from statsmodels.tsa.arima.model import ARIMA

warnings.filterwarnings("ignore")


def forecast(df, steps: int = 30) -> dict:
    """
    Fit ARIMA(5,1,0) on closing prices and forecast future values.

    Returns:
        dict with model metadata and per-step forecasts
    """
    closes = df["close"].values.astype(float)

    # Fit on last 120 candles for speed
    series = closes[-120:]

    try:
        model = ARIMA(series, order=(5, 1, 0))
        result = model.fit()

        forecast_obj = result.get_forecast(steps=steps)
        pred_mean = forecast_obj.predicted_mean
        conf_int  = forecast_obj.conf_int(alpha=0.05)  # 95% CI

        # In-sample residuals for accuracy metrics
        in_sample = result.fittedvalues
        actuals   = series[1:]  # ARIMA(d=1) loses first obs
        residuals = actuals - in_sample[-len(actuals):]
        rmse = float(np.sqrt(np.mean(residuals ** 2)))
        mae  = float(np.mean(np.abs(residuals)))
        mape = float(np.mean(np.abs(residuals / actuals)) * 100)

        # Directional accuracy on last 30 in-sample predictions
        actual_dir  = np.sign(np.diff(actuals[-31:]))
        pred_dir    = np.sign(np.diff(in_sample[-31:]))
        da = float(np.mean(actual_dir == pred_dir) * 100)

        current = float(closes[-1])
        points = []
        for i, (mean, low, high) in enumerate(
            zip(pred_mean, conf_int[:, 0], conf_int[:, 1]), 1
        ):
            points.append({
                "day": i,
                "value": round(float(mean), 2),
                "lower": round(float(low), 2),
                "upper": round(float(high), 2),
            })

        direction = "UP" if pred_mean[-1] > current else "DOWN"
        confidence = min(95, max(50, 100 - (rmse / current * 200)))

        return {
            "model": "ARIMA",
            "order": "(5,1,0)",
            "description": "AutoRegressive Integrated Moving Average captures linear autocorrelation in the price series. It models how past prices predict future prices through differencing and autoregressive terms.",
            "nextDay":   round(float(pred_mean[0]), 2),
            "nextWeek":  round(float(pred_mean[4]), 2),
            "nextMonth": round(float(pred_mean[-1]), 2),
            "direction": direction,
            "confidence": round(confidence, 2),
            "rmse": round(rmse, 4),
            "mae":  round(mae, 4),
            "mape": round(mape, 4),
            "directionalAccuracy": round(da, 2),
            "forecastPoints": points,
            "error": None,
        }
    except Exception as e:
        current = float(closes[-1])
        return {
            "model": "ARIMA", "order": "(5,1,0)",
            "description": "ARIMA model",
            "nextDay": current, "nextWeek": current, "nextMonth": current,
            "direction": "HOLD", "confidence": 50.0,
            "rmse": 0, "mae": 0, "mape": 0, "directionalAccuracy": 50.0,
            "forecastPoints": [],
            "error": str(e),
        }
