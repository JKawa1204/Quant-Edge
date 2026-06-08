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
  POST /ml/optimize                   — portfolio optimization (Markowitz / HRP)
  GET  /ml/rankings                   — ensemble-ranked stock list
  POST /ml/build-portfolio            — auto-build optimized portfolio

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
from models.optimization  import optimize_portfolio, rank_stocks, build_portfolio
from models.monte_carlo   import run_monte_carlo
from models.stress_test   import run_stress_test

# ── Simple in-memory cache (avoids re-fitting on every request) ───────────────
_cache: dict = {}
CACHE_TTL = 300  # 5 minutes

# ── Rankings cache (separate, longer TTL because ranking is expensive) ────────
_rankings_cache: dict = {"data": None, "timestamp": 0}
RANKINGS_CACHE_TTL = 600  # 10 minutes

# Start the WebSocket client to receive live prices from Node.js
from models.live_data import start_websocket_client_thread
start_websocket_client_thread()

import threading
from models.backtester import run_backtest_job

@app.route("/ml/backtest", methods=["POST"])
def trigger_backtest():
    payload = request.json
    job_id = payload.get("id")
    webhook_url = os.getenv("NODE_API_URL", "http://localhost:4000") + "/api/backtests/callback"
    threading.Thread(target=run_backtest_job, args=(job_id, payload, webhook_url)).start()
    return jsonify({"status": "accepted", "job_id": job_id})


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
        import time
        time.sleep(1) # prevent CPU overload

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
        log.exception("regime error for %s", symbol)
        return jsonify({"error": str(e)}), 500

@app.route("/ml/simulate/<symbol>")
def simulate_symbol(symbol: str):
    symbol = symbol.upper().strip()
    try:
        result = run_monte_carlo(symbol)
        if "error" in result:
            return jsonify(result), 400
        return jsonify(result)
    except Exception as e:
        log.exception("monte carlo error for %s", symbol)
        return jsonify({"error": str(e)}), 500

@app.route("/ml/stress-test/<symbol>")
def stress_test_symbol(symbol: str):
    symbol = symbol.upper().strip()
    try:
        result = run_stress_test(symbol)
        if "error" in result:
            return jsonify(result), 400
        return jsonify(result)
    except Exception as e:
        log.exception("stress test error for %s", symbol)
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
            
        import time
        time.sleep(1) # delay to prevent CPU limits/OOM on Render

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
            
        import time
        time.sleep(1) # prevent CPU limits/OOM on Render

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


# ── Portfolio Optimization Routes ────────────────────────────────────────────

@app.route("/ml/optimize", methods=["POST"])
def optimize():
    """Portfolio optimization endpoint.

    Accepts JSON:
        {
            "symbols": ["RELIANCE", "TCS", ...],
            "method": "markowitz" | "hrp" | "both",
            "riskTolerance": "low" | "medium" | "high"
        }
    """
    data = request.get_json(silent=True) or {}
    symbols = [s.upper().strip() for s in data.get("symbols", [])]
    method = data.get("method", "both").lower()
    risk_tolerance = data.get("riskTolerance", "medium").lower()

    if not symbols or len(symbols) < 2:
        return jsonify({"error": "At least 2 symbols are required"}), 400

    if method not in ("markowitz", "hrp", "both"):
        return jsonify({"error": "method must be 'markowitz', 'hrp', or 'both'"}), 400

    # Map risk tolerance to risk-free rate
    risk_free_map = {"low": 0.08, "medium": 0.065, "high": 0.04}
    risk_free_rate = risk_free_map.get(risk_tolerance, 0.065)

    try:
        result = optimize_portfolio(symbols, method=method, risk_free_rate=risk_free_rate)
        result["riskTolerance"] = risk_tolerance
        result["riskFreeRate"] = risk_free_rate
        return jsonify(result)
    except Exception as e:
        log.exception("optimization error")
        return jsonify({"error": str(e)}), 500


@app.route("/ml/rankings")
def rankings():
    """Return all stocks ranked by ensemble forecast confidence.

    Results are cached for 10 minutes since forecasting all ~50 stocks is expensive.
    Query params:
        limit (int, optional): max number of results to return
    """
    now = time.time()

    # Check cache
    if (_rankings_cache["data"] is not None and
            now - _rankings_cache["timestamp"] < RANKINGS_CACHE_TTL):
        log.info("rankings cache hit")
        ranked = _rankings_cache["data"]
    else:
        log.info("computing fresh rankings for all stocks")
        t0 = time.time()
        try:
            ranked = rank_stocks()
            _rankings_cache["data"] = ranked
            _rankings_cache["timestamp"] = now
            log.info("rankings computed in %.1fms", (time.time() - t0) * 1000)
        except Exception as e:
            log.exception("rankings error")
            return jsonify({"error": str(e)}), 500

    # Optional limit
    limit = request.args.get("limit", type=int)
    output = ranked[:limit] if limit and limit > 0 else ranked

    return jsonify({
        "rankings": output,
        "totalStocks": len(ranked),
        "returnedCount": len(output),
        "cachedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(_rankings_cache["timestamp"])),
    })


@app.route("/ml/build-portfolio", methods=["POST"])
def build_portfolio_route():
    """Auto-build an optimized portfolio from top-ranked stocks.

    Accepts JSON:
        {
            "count": 10,
            "method": "hrp" | "markowitz",
            "riskTolerance": "low" | "medium" | "high"
        }
    """
    data = request.get_json(silent=True) or {}
    count = data.get("count", 10)
    method = data.get("method", "hrp").lower()
    risk_tolerance = data.get("riskTolerance", "medium").lower()

    if not isinstance(count, int) or count < 2:
        return jsonify({"error": "count must be an integer >= 2"}), 400

    if method not in ("markowitz", "hrp"):
        return jsonify({"error": "method must be 'markowitz' or 'hrp'"}), 400

    risk_free_map = {"low": 0.08, "medium": 0.065, "high": 0.04}
    risk_free_rate = risk_free_map.get(risk_tolerance, 0.065)

    try:
        result = build_portfolio(count=count, method=method, risk_free_rate=risk_free_rate)
        result["riskTolerance"] = risk_tolerance
        result["riskFreeRate"] = risk_free_rate
        return jsonify(result)
    except Exception as e:
        log.exception("build-portfolio error")
        return jsonify({"error": str(e)}), 500


# ── Run ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8001))
    log.info("ML service starting on port %d", port)
    app.run(host="0.0.0.0", port=port, debug=False)
