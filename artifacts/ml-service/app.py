"""
QUANTEDGE ML Service — Flask API for ML forecasting.
Endpoints:
  GET  /ml/healthz
  GET  /ml/forecast/<symbol>          — full 3-model + ensemble forecast
  GET  /ml/regime                     — NIFTY 50 market regime
  GET  /ml/regime/<symbol>            — single-stock regime
  GET  /ml/signals                    — signals for all held symbols
  GET  /ml/model-performance          — aggregate model accuracy stats
  POST /ml/forecast/batch             — multi-symbol forecasts

Upstox data override:
  If UPSTOX_ACCESS_TOKEN env var is set, live data is fetched from Upstox API.
  Otherwise, simulated OHLCV data is used (identical model logic).
"""

import os
import sys
import time
import json
import logging

from flask import Flask, jsonify, request
from flask_cors import CORS

# ── Logging ─────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger(__name__)

# ── App ──────────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app, origins="*")

# ── Models (lazy-imported to speed startup) ──────────────────────────────────
from models.data        import get_ohlcv, get_current_price, get_day_open_price, list_symbols, get_stock_info
from models.arima_model import forecast as arima_forecast
from models.xgboost_model import forecast as xgb_forecast
from models.neural_model  import forecast as nn_forecast
from models import ensemble as ens_module
from models.regime        import detect_regime

# ── Simple in-memory cache (avoids re-fitting on every request) ───────────────
_cache: dict = {}
CACHE_TTL = 300  # 5 minutes


def _cache_key(symbol: str) -> str:
    bucket = int(time.time() // CACHE_TTL)
    return f"{symbol}:{bucket}"


def _run_forecast(symbol: str) -> dict:
    key = _cache_key(symbol)
    if key in _cache:
        log.info("cache hit: %s", symbol)
        return _cache[key]

    log.info("fitting models for %s", symbol)
    t0 = time.time()

    df = get_ohlcv(symbol, days=252)

    arima  = arima_forecast(df, steps=30)
    xgb    = xgb_forecast(df, steps=30)
    nn     = nn_forecast(df, steps=30)
    ens    = ens_module.combine(arima, xgb, nn)
    regime = detect_regime(df)

    current = get_current_price(symbol)
    info    = get_stock_info(symbol)

    result = {
        "symbol":      symbol,
        "company":     info.get("company", symbol),
        "sector":      info.get("sector", "Unknown"),
        "currentPrice": current,
        "arima":       arima,
        "xgboost":     xgb,
        "neuralNet":   nn,
        "ensemble":    ens,
        "regime":      regime,
        "computedAt":  time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "computeMs":   round((time.time() - t0) * 1000),
    }

    _cache[key] = result
    log.info("forecast complete for %s in %.1fms", symbol, result["computeMs"])
    return result


# ── Routes ───────────────────────────────────────────────────────────────────

@app.route("/ml/healthz")
def healthz():
    return jsonify({"status": "ok", "service": "ml"})


@app.route("/ml/forecast/<symbol>")
def forecast_symbol(symbol: str):
    symbol = symbol.upper().strip()
    try:
        return jsonify(_run_forecast(symbol))
    except Exception as e:
        log.exception("forecast error for %s", symbol)
        return jsonify({"error": str(e)}), 500


@app.route("/ml/forecast/batch", methods=["POST"])
def forecast_batch():
    data    = request.get_json(silent=True) or {}
    symbols = [s.upper().strip() for s in data.get("symbols", [])]
    if not symbols:
        return jsonify({"error": "symbols list required"}), 400

    results = {}
    for symbol in symbols[:10]:  # cap at 10
        try:
            results[symbol] = _run_forecast(symbol)
        except Exception as e:
            results[symbol] = {"error": str(e)}

    return jsonify(results)


@app.route("/ml/regime")
def regime_market():
    """NIFTY 50 proxy: use RELIANCE as market proxy for regime detection."""
    symbol = request.args.get("symbol", "RELIANCE").upper()
    try:
        df     = get_ohlcv(symbol, days=252)
        result = detect_regime(df)
        return jsonify(result)
    except Exception as e:
        log.exception("regime error")
        return jsonify({"error": str(e)}), 500


@app.route("/ml/regime/<symbol>")
def regime_symbol(symbol: str):
    symbol = symbol.upper().strip()
    try:
        df     = get_ohlcv(symbol, days=252)
        result = detect_regime(df)
        result["symbol"] = symbol
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/ml/signals")
def signals():
    """
    Generate BUY/SELL/HOLD signals for a list of symbols.
    Query param: symbols=RELIANCE,TCS,HDFCBANK (comma-separated)
    Defaults to top 10 NIFTY stocks.
    """
    raw     = request.args.get("symbols", "")
    symbols = [s.upper().strip() for s in raw.split(",") if s.strip()]
    if not symbols:
        symbols = list_symbols()[:10]

    out = []
    for symbol in symbols:
        try:
            fc = _run_forecast(symbol)
            ens = fc["ensemble"]
            action = (
                "BUY"  if ens["direction"] == "UP"  and ens["confidence"] >= 65 else
                "SELL" if ens["direction"] == "DOWN" and ens["confidence"] >= 65 else
                "HOLD"
            )
            forecast_return = (ens["nextWeek"] - fc["currentPrice"]) / fc["currentPrice"]
            out.append({
                "symbol":              symbol,
                "company":             fc["company"],
                "action":              action,
                "confidence":          ens["confidence"],
                "forecastReturn":      round(forecast_return * 100, 4),
                "regime":              fc["regime"]["regime"],
                "arimaContribution":   round(ens["weights"]["ARIMA"] * 100, 2),
                "lstmContribution":    round(ens["weights"]["NeuralNet"] * 100, 2),
                "xgboostContribution": round(ens["weights"]["XGBoost"] * 100, 2),
                "modelAgreement":      ens["modelAgreement"],
                "nextDay":             ens["nextDay"],
                "nextWeek":            ens["nextWeek"],
                "currentPrice":        fc["currentPrice"],
            })
        except Exception as e:
            log.warning("signal error for %s: %s", symbol, e)

    # Sort by confidence descending
    out.sort(key=lambda x: x["confidence"], reverse=True)
    return jsonify(out)


@app.route("/ml/model-performance")
def model_performance():
    """Aggregate model accuracy across a basket of stocks."""
    symbols = list_symbols()[:8]
    stats: dict = {
        "ARIMA":          {"rmse": [], "mae": [], "mape": [], "da": []},
        "XGBoost":        {"rmse": [], "mae": [], "mape": [], "da": []},
        "Neural Net (MLP)": {"rmse": [], "mae": [], "mape": [], "da": []},
        "Ensemble":       {"rmse": [], "mae": [], "mape": [], "da": []},
    }

    for symbol in symbols:
        try:
            fc = _run_forecast(symbol)
            for model_key, model_name in [
                ("arima",    "ARIMA"),
                ("xgboost",  "XGBoost"),
                ("neuralNet","Neural Net (MLP)"),
                ("ensemble", "Ensemble"),
            ]:
                m = fc.get(model_key, {})
                s = stats[model_name]
                if m.get("rmse"):    s["rmse"].append(m["rmse"])
                if m.get("mae"):     s["mae"].append(m["mae"])
                if m.get("mape"):    s["mape"].append(m["mape"])
                if m.get("directionalAccuracy"): s["da"].append(m["directionalAccuracy"])
        except Exception:
            pass

    result = []
    for model_name, s in stats.items():
        def avg(lst): return round(sum(lst) / len(lst), 4) if lst else 0
        result.append({
            "model":               model_name,
            "avgRmse":             avg(s["rmse"]),
            "avgMae":              avg(s["mae"]),
            "avgMape":             avg(s["mape"]),
            "avgDirectionalAccuracy": avg(s["da"]),
        })

    result.sort(key=lambda x: -x["avgDirectionalAccuracy"])
    return jsonify({"models": result, "evaluatedOn": symbols})


# ── Run ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8001))
    log.info("ML service starting on port %d", port)
    app.run(host="0.0.0.0", port=port, debug=False)
