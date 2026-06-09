"""
Portfolio Optimization Module — Markowitz Mean-Variance and Hierarchical Risk Parity.

Provides two portfolio optimization methods:
  1. Markowitz Mean-Variance: Maximizes Sharpe ratio subject to weight constraints.
  2. Hierarchical Risk Parity (HRP): Allocates inversely proportional to cluster
     variance using Ward linkage on correlation distance.

Also provides stock ranking by ML forecast confidence and automated portfolio
construction from the top-ranked stocks.
"""

import logging
import time
import warnings
from typing import Optional

import numpy as np
import pandas as pd
from scipy.optimize import minimize
from scipy.cluster.hierarchy import linkage, leaves_list
from scipy.spatial.distance import squareform

from models.data import get_ohlcv, list_symbols, get_stock_info
from models.arima_model import forecast as arima_forecast
from models.xgboost_model import forecast as xgb_forecast
from models.neural_model import forecast as nn_forecast
from models import ensemble as ens_module
from models.regime import detect_regime

warnings.filterwarnings("ignore")
log = logging.getLogger(__name__)

# ── Trading days per year ────────────────────────────────────────────────────
TRADING_DAYS = 252

# ── Weight constraints ───────────────────────────────────────────────────────
MIN_WEIGHT = 0.05   # min 5% per stock
MAX_WEIGHT = 0.30   # max 30% per stock


# ──────────────────────────────────────────────────────────────────────────────
#  Helper: build returns DataFrame from a list of symbols
# ──────────────────────────────────────────────────────────────────────────────

def _build_returns_df(symbols: list[str], days: int = 252) -> pd.DataFrame:
    """Fetch OHLCV for each symbol and compute daily returns DataFrame.

    Returns a DataFrame with columns = symbol names, rows = dates,
    values = daily percentage returns.
    """
    close_dict: dict[str, pd.Series] = {}
    for sym in symbols:
        try:
            df = get_ohlcv(sym, days=days)
            close_dict[sym] = df["close"]
        except Exception as exc:
            log.warning("skipping %s: %s", sym, exc)

    if not close_dict:
        raise ValueError("No valid OHLCV data for any symbol")

    close_df = pd.DataFrame(close_dict)
    # Forward-fill any NaN dates, then drop remaining leading NaN rows
    close_df = close_df.ffill().dropna()
    returns_df = close_df.pct_change().dropna()
    return returns_df


# ──────────────────────────────────────────────────────────────────────────────
#  Markowitz Mean-Variance Optimization
# ──────────────────────────────────────────────────────────────────────────────

def _portfolio_return(weights: np.ndarray, mean_returns: np.ndarray) -> float:
    """Expected annualized portfolio return."""
    return float(np.dot(weights, mean_returns) * TRADING_DAYS)


def _portfolio_volatility(weights: np.ndarray, cov_matrix: np.ndarray) -> float:
    """Expected annualized portfolio volatility."""
    return float(np.sqrt(np.dot(weights, np.dot(cov_matrix * TRADING_DAYS, weights))))


def _negative_sharpe(weights: np.ndarray, mean_returns: np.ndarray,
                     cov_matrix: np.ndarray, risk_free_rate: float) -> float:
    """Negative Sharpe ratio (we minimize this)."""
    port_ret = _portfolio_return(weights, mean_returns)
    port_vol = _portfolio_volatility(weights, cov_matrix)
    if port_vol < 1e-10:
        return 1e6
    return -(port_ret - risk_free_rate) / port_vol


def _risk_contribution(weights: np.ndarray, cov_matrix: np.ndarray) -> np.ndarray:
    """Marginal risk contribution of each asset (percentage of total portfolio risk)."""
    port_vol = _portfolio_volatility(weights, cov_matrix)
    if port_vol < 1e-10:
        return np.zeros(len(weights))
    # Marginal contribution = w * (Σ w) / σ_p
    marginal = weights * np.dot(cov_matrix * TRADING_DAYS, weights)
    total = np.sum(marginal)
    if total < 1e-10:
        return np.zeros(len(weights))
    return marginal / total


def markowitz_optimize(symbols: list[str], returns_df: pd.DataFrame,
                       risk_free_rate: float = 0.065) -> dict:
    """Markowitz Mean-Variance portfolio optimization.

    Maximizes the Sharpe ratio subject to:
      - All weights sum to 1
      - Each weight in [0, 0.25] (no shorting, max 25% per stock)

    Returns:
        dict with keys: method, weights, expectedReturn, expectedVolatility,
                        sharpeRatio, riskContribution, reasoning
    """
    # Filter to symbols present in returns_df
    valid_symbols = [s for s in symbols if s in returns_df.columns]
    if len(valid_symbols) < 2:
        raise ValueError("Need at least 2 valid symbols for optimization")

    ret = returns_df[valid_symbols]
    n = len(valid_symbols)

    mean_returns = ret.mean().values
    cov_matrix = ret.cov().values

    # Constraints
    constraints = [
        {"type": "eq", "fun": lambda w: np.sum(w) - 1.0},  # weights sum to 1
    ]
    bounds = [(MIN_WEIGHT, MAX_WEIGHT) for _ in range(n)]

    # Initial guess: equal weight
    w0 = np.ones(n) / n

    result = minimize(
        _negative_sharpe,
        w0,
        args=(mean_returns, cov_matrix, risk_free_rate),
        method="SLSQP",
        bounds=bounds,
        constraints=constraints,
        options={"maxiter": 1000, "ftol": 1e-12},
    )

    if not result.success:
        log.warning("Markowitz optimizer did not converge: %s. Using best result.", result.message)

    optimal_weights = result.x
    # Clean up near-zero weights
    optimal_weights = np.maximum(optimal_weights, 0.0)
    optimal_weights = optimal_weights / optimal_weights.sum()  # re-normalize

    exp_ret = _portfolio_return(optimal_weights, mean_returns)
    exp_vol = _portfolio_volatility(optimal_weights, cov_matrix)
    sharpe = (exp_ret - risk_free_rate) / exp_vol if exp_vol > 1e-10 else 0.0
    risk_contrib = _risk_contribution(optimal_weights, cov_matrix)

    # Build weights dict (sorted by weight descending)
    weights_dict = {}
    for sym, w in sorted(zip(valid_symbols, optimal_weights), key=lambda x: -x[1]):
        if w > 1e-4:
            weights_dict[sym] = round(float(w), 4)

    risk_dict = {}
    for sym, rc in zip(valid_symbols, risk_contrib):
        if sym in weights_dict:
            risk_dict[sym] = round(float(rc) * 100, 2)

    # Count non-zero allocations
    active_count = sum(1 for w in optimal_weights if w > 1e-4)

    reasoning = (
        f"Markowitz mean-variance optimization maximized the Sharpe ratio to {sharpe:.2f} "
        f"by allocating across {active_count} stocks. "
        f"Expected annual return is {exp_ret * 100:.1f}% with {exp_vol * 100:.1f}% volatility. "
        f"Risk-free rate assumed at {risk_free_rate * 100:.1f}%. "
        f"Maximum single-stock weight capped at {MAX_WEIGHT * 100:.0f}% to limit concentration risk."
    )

    return {
        "method": "markowitz",
        "weights": weights_dict,
        "expectedReturn": round(exp_ret * 100, 2),
        "expectedVolatility": round(exp_vol * 100, 2),
        "sharpeRatio": round(sharpe, 4),
        "riskContribution": risk_dict,
        "reasoning": reasoning,
    }


# ──────────────────────────────────────────────────────────────────────────────
#  Hierarchical Risk Parity (HRP)
# ──────────────────────────────────────────────────────────────────────────────

def _quasi_diagonalize(link: np.ndarray) -> list[int]:
    """Reorder rows/columns of the covariance matrix by hierarchical clustering
    so that similar assets are grouped together (quasi-diagonalization).
    """
    return list(leaves_list(link))


def _get_cluster_var(cov: np.ndarray, cluster_items: list[int]) -> float:
    """Compute the variance of an inverse-variance-weighted cluster."""
    sub_cov = cov[np.ix_(cluster_items, cluster_items)]
    inv_diag = 1.0 / np.diag(sub_cov)
    inv_diag = inv_diag / inv_diag.sum()
    cluster_var = float(np.dot(inv_diag, np.dot(sub_cov, inv_diag)))
    return cluster_var


def _recursive_bisection(cov: np.ndarray, sorted_indices: list[int]) -> np.ndarray:
    """Recursive bisection: allocate inversely proportional to cluster variance.

    The sorted_indices come from quasi-diagonalization of the linkage matrix.
    """
    n = len(sorted_indices)
    weights = np.ones(n)
    cluster_items = [sorted_indices]

    while len(cluster_items) > 0:
        new_cluster_items = []
        for cluster in cluster_items:
            if len(cluster) <= 1:
                continue
            mid = len(cluster) // 2
            left = cluster[:mid]
            right = cluster[mid:]

            left_var = _get_cluster_var(cov, left)
            right_var = _get_cluster_var(cov, right)

            alloc_factor = 1.0 - left_var / (left_var + right_var)

            # Scale weights
            for idx in left:
                pos = sorted_indices.index(idx)
                weights[pos] *= alloc_factor
            for idx in right:
                pos = sorted_indices.index(idx)
                weights[pos] *= (1.0 - alloc_factor)

            if len(left) > 1:
                new_cluster_items.append(left)
            if len(right) > 1:
                new_cluster_items.append(right)

        cluster_items = new_cluster_items

    return weights


def hrp_optimize(symbols: list[str], returns_df: pd.DataFrame) -> dict:
    """Hierarchical Risk Parity portfolio optimization.

    Steps:
      1. Compute correlation and covariance matrices from daily returns.
      2. Build a distance matrix from correlations: d = sqrt(0.5 * (1 - corr)).
      3. Apply Ward linkage on the distance matrix.
      4. Quasi-diagonalize (reorder) the covariance matrix.
      5. Recursive bisection: allocate inversely proportional to cluster variance.

    Returns:
        dict with keys: method, weights, expectedReturn, expectedVolatility,
                        sharpeRatio, riskContribution, diversificationScore, reasoning
    """
    valid_symbols = [s for s in symbols if s in returns_df.columns]
    if len(valid_symbols) < 2:
        raise ValueError("Need at least 2 valid symbols for HRP optimization")

    ret = returns_df[valid_symbols]
    n = len(valid_symbols)

    corr_matrix = ret.corr().values
    cov_matrix = ret.cov().values

    # Distance matrix from correlation
    # d(i,j) = sqrt(0.5 * (1 - corr(i,j)))
    dist_matrix = np.sqrt(0.5 * (1.0 - corr_matrix))
    np.fill_diagonal(dist_matrix, 0.0)

    # Ward linkage
    condensed_dist = squareform(dist_matrix)
    link = linkage(condensed_dist, method="ward")

    # Quasi-diagonalize
    sorted_indices = _quasi_diagonalize(link)

    # Recursive bisection
    raw_weights = _recursive_bisection(cov_matrix, sorted_indices)

    # Map weights back to original symbol order
    final_weights = np.zeros(n)
    for i, sorted_idx in enumerate(sorted_indices):
        final_weights[sorted_idx] = raw_weights[i]

    # Normalize to sum to 1
    final_weights = final_weights / final_weights.sum()

    # Clip to max weight constraint and re-normalize
    final_weights = np.clip(final_weights, MIN_WEIGHT, MAX_WEIGHT)
    final_weights = final_weights / final_weights.sum()

    # Portfolio metrics
    mean_returns = ret.mean().values
    exp_ret = _portfolio_return(final_weights, mean_returns)
    exp_vol = _portfolio_volatility(final_weights, cov_matrix)
    risk_free = 0.065
    sharpe = (exp_ret - risk_free) / exp_vol if exp_vol > 1e-10 else 0.0
    risk_contrib = _risk_contribution(final_weights, cov_matrix)

    # Diversification score: 1 - HHI (Herfindahl-Hirschman Index)
    # HHI = sum(w_i^2). Perfect diversification among n stocks → HHI = 1/n → score ≈ 1
    hhi = float(np.sum(final_weights ** 2))
    max_hhi = 1.0  # single stock
    min_hhi = 1.0 / n  # equal weight
    if max_hhi > min_hhi:
        diversification_score = round((1.0 - (hhi - min_hhi) / (max_hhi - min_hhi)) * 100, 2)
    else:
        diversification_score = 100.0

    # Build weights dict (sorted by weight descending)
    weights_dict = {}
    for sym, w in sorted(zip(valid_symbols, final_weights), key=lambda x: -x[1]):
        if w > 1e-4:
            weights_dict[sym] = round(float(w), 4)

    risk_dict = {}
    for sym, rc in zip(valid_symbols, risk_contrib):
        if sym in weights_dict:
            risk_dict[sym] = round(float(rc) * 100, 2)

    active_count = sum(1 for w in final_weights if w > 1e-4)

    reasoning = (
        f"Hierarchical Risk Parity allocated across {active_count} stocks using "
        f"Ward-linkage clustering on correlation distances. "
        f"Expected annual return is {exp_ret * 100:.1f}% with {exp_vol * 100:.1f}% volatility "
        f"(Sharpe {sharpe:.2f}). "
        f"Diversification score is {diversification_score:.0f}/100 "
        f"({'excellent' if diversification_score > 80 else 'good' if diversification_score > 60 else 'moderate'}). "
        f"HRP avoids the sensitivity to estimation errors that plagues mean-variance optimization."
    )

    return {
        "method": "hrp",
        "weights": weights_dict,
        "expectedReturn": round(exp_ret * 100, 2),
        "expectedVolatility": round(exp_vol * 100, 2),
        "sharpeRatio": round(sharpe, 4),
        "riskContribution": risk_dict,
        "diversificationScore": diversification_score,
        "reasoning": reasoning,
    }


# ──────────────────────────────────────────────────────────────────────────────
#  Main entry point: optimize_portfolio
# ──────────────────────────────────────────────────────────────────────────────

def optimize_portfolio(symbols: list[str], method: str = "both",
                       risk_free_rate: float = 0.065) -> dict:
    """Run portfolio optimization on the given symbols.

    Args:
        symbols: list of stock ticker symbols
        method: 'markowitz', 'hrp', or 'both'
        risk_free_rate: annualized risk-free rate (default 6.5% for India)

    Returns:
        dict with optimization results for the requested method(s).
    """
    t0 = time.time()

    if len(symbols) < 2:
        raise ValueError("Portfolio optimization requires at least 2 symbols")

    # Build returns matrix
    returns_df = _build_returns_df(symbols, days=252)
    valid_symbols = [s for s in symbols if s in returns_df.columns]

    if len(valid_symbols) < 2:
        raise ValueError("Could not fetch data for at least 2 symbols")

    results: dict = {
        "symbols": valid_symbols,
        "symbolCount": len(valid_symbols),
        "method": method,
    }

    if method in ("markowitz", "both"):
        try:
            results["markowitz"] = markowitz_optimize(valid_symbols, returns_df, risk_free_rate)
        except Exception as exc:
            log.exception("Markowitz optimization failed")
            results["markowitz"] = {"error": str(exc)}

    if method in ("hrp", "both"):
        try:
            results["hrp"] = hrp_optimize(valid_symbols, returns_df)
        except Exception as exc:
            log.exception("HRP optimization failed")
            results["hrp"] = {"error": str(exc)}

    results["computeMs"] = round((time.time() - t0) * 1000)
    return results


# ──────────────────────────────────────────────────────────────────────────────
#  Stock ranking by forecast confidence
# ──────────────────────────────────────────────────────────────────────────────

def rank_stocks(symbols: Optional[list[str]] = None) -> list[dict]:
    """Rank stocks by ensemble forecast confidence.

    For each stock, runs the 3-model ensemble forecast and returns
    a sorted list (highest confidence first).

    Args:
        symbols: list of tickers. Defaults to all stocks in the universe.

    Returns:
        Sorted list of dicts, each with:
          symbol, company, sector, confidence, direction, forecastReturn, regime
    """
    if symbols is None:
        symbols = list_symbols()

    rankings: list[dict] = []

    for sym in symbols:
        try:
            df = get_ohlcv(sym, days=252)
            current = float(df["close"].iloc[-1])
            info = get_stock_info(sym)

            arima = arima_forecast(df, steps=30)
            xgb = xgb_forecast(df, steps=30)
            nn = nn_forecast(df, steps=30)
            ens = ens_module.combine(arima, xgb, nn, current)
            regime = detect_regime(df)

            forecast_return = (ens["nextWeek"] - current) / current

            rankings.append({
                "symbol": sym,
                "company": info.get("company", sym),
                "sector": info.get("sector", "Unknown"),
                "confidence": ens["confidence"],
                "direction": ens["direction"],
                "forecastReturn": round(forecast_return * 100, 4),
                "regime": regime["regime"],
                "currentPrice": round(current, 2),
                "nextDay": ens["nextDay"],
                "nextWeek": ens["nextWeek"],
                "nextMonth": ens["nextMonth"],
                "modelAgreement": ens["modelAgreement"],
            })
        except Exception as exc:
            log.warning("ranking error for %s: %s", sym, exc)

    # Sort by confidence descending, then by absolute forecastReturn descending
    rankings.sort(key=lambda x: (-x["confidence"], -abs(x["forecastReturn"])))
    return rankings


# ──────────────────────────────────────────────────────────────────────────────
#  Build portfolio: rank → select top N → optimize
# ──────────────────────────────────────────────────────────────────────────────

def build_portfolio(count: int = 10, method: str = "hrp",
                    risk_free_rate: float = 0.065,
                    precomputed_rankings: Optional[list[dict]] = None) -> dict:
    """Pick top N stocks by confidence ranking, then optimize weights.

    Args:
        count: number of top stocks to include (default 10)
        method: optimization method - 'hrp' or 'markowitz'
        risk_free_rate: annualized risk-free rate
        precomputed_rankings: optional list of pre-ranked stocks to skip expensive ML inference

    Returns:
        dict with:
          stocks: list of ranked stock info
          optimization: optimization result dict
          reasoning: human-readable explanation
    """
    t0 = time.time()

    # Rank all stocks
    all_rankings = precomputed_rankings if precomputed_rankings is not None else rank_stocks()

    if not all_rankings:
        raise ValueError("No stocks could be ranked — forecasting failed for all")

    # Select top N by confidence
    count = min(count, len(all_rankings))
    count = max(count, 2)  # need at least 2 for optimization
    top_stocks = all_rankings[:count]
    selected_symbols = [s["symbol"] for s in top_stocks]

    # Run optimization on the selected stocks
    optimization = optimize_portfolio(selected_symbols, method=method,
                                      risk_free_rate=risk_free_rate)

    # Build sector breakdown of selected stocks
    sector_counts: dict[str, int] = {}
    for s in top_stocks:
        sec = s["sector"]
        sector_counts[sec] = sector_counts.get(sec, 0) + 1

    sector_summary = ", ".join(f"{sec} ({cnt})" for sec, cnt in
                               sorted(sector_counts.items(), key=lambda x: -x[1]))

    avg_confidence = sum(s["confidence"] for s in top_stocks) / len(top_stocks)
    up_count = sum(1 for s in top_stocks if s["direction"] == "UP")
    down_count = count - up_count

    reasoning = (
        f"Selected top {count} stocks by ML ensemble forecast confidence "
        f"(avg confidence: {avg_confidence:.1f}%). "
        f"Directional split: {up_count} bullish, {down_count} bearish. "
        f"Sector allocation: {sector_summary}. "
        f"Weights optimized using {'HRP (risk-parity)' if method == 'hrp' else 'Markowitz (max Sharpe)'}."
    )

    compute_ms = round((time.time() - t0) * 1000)

    return {
        "stocks": top_stocks,
        "optimization": optimization,
        "reasoning": reasoning,
        "stockCount": count,
        "avgConfidence": round(avg_confidence, 2),
        "sectorBreakdown": sector_counts,
        "computeMs": compute_ms,
    }
