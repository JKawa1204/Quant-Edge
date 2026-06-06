/**
 * QUANTEDGE Dashboard — ML Showcase + Live Portfolio P&L
 */
import { useState, useEffect, useCallback } from "react";
import { useGetDashboardSummary, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  TrendingUp, TrendingDown, Activity, BrainCircuit,
  GitBranch, LineChart, Layers, Target, ArrowUpRight, ArrowDownRight, ChevronRight
} from "lucide-react";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
const API = `${BASE}/api`;

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("quantedge_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchHoldings() {
  const r = await fetch(`${API}/portfolio/holdings`, {
    headers: { "Content-Type": "application/json", ...authHeaders() },
  });
  if (!r.ok) return [];
  return r.json();
}

// ── Model card ──────────────────────────────────────────────────────────────
function ModelCard({
  name, tag, description, metrics, color,
}: {
  name: string; tag: string; description: string;
  metrics: { label: string; value: string }[];
  color: string;
}) {
  return (
    <Card className="border-border/50 bg-card/50 hover:border-primary/30 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${color}`} />
            <CardTitle className="text-sm font-semibold">{name}</CardTitle>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono">{tag}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground leading-relaxed mb-3">{description}</p>
        <div className="grid grid-cols-2 gap-2">
          {metrics.map(m => (
            <div key={m.label} className="bg-muted/40 rounded-md px-2 py-1.5">
              <div className="text-[10px] text-muted-foreground">{m.label}</div>
              <div className="text-xs font-semibold font-mono">{m.value}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Holdings table row ───────────────────────────────────────────────────────
function HoldingRow({ h }: { h: any }) {
  const overallUp = h.overallPnl >= 0;
  const todayUp   = h.todayPnl >= 0;
  return (
    <tr className="border-b border-border/30 hover:bg-muted/20 transition-colors">
      <td className="py-3 px-4">
        <div className="font-semibold text-sm">{h.symbol}</div>
        <div className="text-xs text-muted-foreground truncate max-w-[140px]">{h.company}</div>
      </td>
      <td className="py-3 px-4 text-center">
        <Badge variant="outline" className="text-[10px]">{h.sector}</Badge>
      </td>
      <td className="py-3 px-4 text-right font-mono text-sm">{h.quantity}</td>
      <td className="py-3 px-4 text-right font-mono text-sm">₹{h.avgBuyPrice?.toLocaleString()}</td>
      <td className="py-3 px-4 text-right font-mono text-sm font-medium text-primary">₹{h.currentPrice?.toLocaleString()}</td>
      <td className="py-3 px-4 text-right">
        <div className={`flex items-center justify-end gap-0.5 text-sm font-semibold ${todayUp ? "text-green-400" : "text-red-400"}`}>
          {todayUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {formatCurrency(Math.abs(h.todayPnl))}
        </div>
        <div className={`text-[10px] text-right ${todayUp ? "text-green-400/70" : "text-red-400/70"}`}>
          {todayUp ? "+" : ""}{h.todayPnlPct?.toFixed(2)}%
        </div>
      </td>
      <td className="py-3 px-4 text-right">
        <div className={`flex items-center justify-end gap-0.5 text-sm font-semibold ${overallUp ? "text-green-400" : "text-red-400"}`}>
          {overallUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {formatCurrency(Math.abs(h.overallPnl))}
        </div>
        <div className={`text-[10px] text-right ${overallUp ? "text-green-400/70" : "text-red-400/70"}`}>
          {overallUp ? "+" : ""}{h.overallPnlPct?.toFixed(2)}%
        </div>
      </td>
      <td className="py-3 px-4 text-right text-xs text-muted-foreground font-mono">{h.allocationPct}%</td>
    </tr>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey() },
  });

  const [holdings, setHoldings]         = useState<any[]>([]);
  const [loadingHoldings, setLoadingH]  = useState(true);

  const loadHoldings = useCallback(async () => {
    setLoadingH(true);
    try { setHoldings(await fetchHoldings()); } catch { setHoldings([]); } finally { setLoadingH(false); }
  }, []);

  useEffect(() => { loadHoldings(); }, [loadHoldings]);

  const totalTodayPnl   = holdings.reduce((s, h) => s + (h.todayPnl ?? 0), 0);
  const totalOverallPnl = holdings.reduce((s, h) => s + (h.overallPnl ?? 0), 0);
  const totalInvested   = holdings.reduce((s, h) => s + (h.invested ?? 0), 0);
  const totalCurrent    = holdings.reduce((s, h) => s + (h.currentValue ?? 0), 0);
  const overallPnlPct   = totalInvested > 0 ? (totalOverallPnl / totalInvested) * 100 : 0;
  const todayPnlPct     = totalInvested > 0 ? (totalTodayPnl   / totalInvested) * 100 : 0;
  const positiveToday   = totalTodayPnl >= 0;
  const positiveOverall = totalOverallPnl >= 0;

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <BrainCircuit className="h-7 w-7 text-primary" />
          QUANTEDGE
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          ML forecasting pipeline for Indian equity markets — ARIMA · XGBoost · Neural Net · Ensemble
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card/60">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-[11px] text-muted-foreground uppercase tracking-wider">Portfolio Value</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {loadingHoldings ? <Skeleton className="h-8 w-28" /> : (
              <>
                <div className="text-2xl font-bold font-mono">{formatCurrency(totalCurrent)}</div>
                <div className="text-xs text-muted-foreground mt-1">Invested: {formatCurrency(totalInvested)}</div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className={`bg-card/60 border-l-2 ${positiveToday ? "border-l-green-500" : "border-l-red-500"}`}>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-[11px] text-muted-foreground uppercase tracking-wider">Today's P&amp;L</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {loadingHoldings ? <Skeleton className="h-8 w-28" /> : (
              <>
                <div className={`text-2xl font-bold font-mono flex items-center gap-1 ${positiveToday ? "text-green-400" : "text-red-400"}`}>
                  {positiveToday ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                  {positiveToday ? "+" : "-"}{formatCurrency(Math.abs(totalTodayPnl))}
                </div>
                <div className={`text-xs mt-1 ${positiveToday ? "text-green-400/70" : "text-red-400/70"}`}>
                  {positiveToday ? "+" : ""}{todayPnlPct.toFixed(2)}% vs open
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className={`bg-card/60 border-l-2 ${positiveOverall ? "border-l-green-500" : "border-l-red-500"}`}>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-[11px] text-muted-foreground uppercase tracking-wider">Overall P&amp;L</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {loadingHoldings ? <Skeleton className="h-8 w-28" /> : (
              <>
                <div className={`text-2xl font-bold font-mono flex items-center gap-1 ${positiveOverall ? "text-green-400" : "text-red-400"}`}>
                  {positiveOverall ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                  {positiveOverall ? "+" : "-"}{formatCurrency(Math.abs(totalOverallPnl))}
                </div>
                <div className={`text-xs mt-1 ${positiveOverall ? "text-green-400/70" : "text-red-400/70"}`}>
                  {positiveOverall ? "+" : ""}{overallPnlPct.toFixed(2)}% all-time
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/60">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-[11px] text-muted-foreground uppercase tracking-wider">Holdings / Regime</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {loadingHoldings ? <Skeleton className="h-8 w-16" /> : (
              <>
                <div className="text-2xl font-bold font-mono">{holdings.length}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {loadingSummary ? "Loading…" : (summary?.regime ?? "Unknown")}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Holdings P&L table */}
      <Card className="bg-card/60">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">Holdings — Buy Price vs Current Price</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Today P&amp;L = (Current − Day Open) × Qty &nbsp;·&nbsp; Overall P&amp;L = (Current − Avg Buy) × Qty
            </p>
          </div>
          <Link href="/portfolio">
            <button className="flex items-center gap-1 text-xs text-primary hover:underline">
              Buy / Sell <ChevronRight className="h-3 w-3" />
            </button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {loadingHoldings ? (
            <div className="p-6 space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded" />)}
            </div>
          ) : holdings.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No holdings yet.{" "}
              <Link href="/portfolio"><span className="text-primary underline cursor-pointer">Buy your first stock →</span></Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-xs text-muted-foreground">
                    <th className="text-left py-2 px-4 font-medium">Stock</th>
                    <th className="text-center py-2 px-4 font-medium">Sector</th>
                    <th className="text-right py-2 px-4 font-medium">Qty</th>
                    <th className="text-right py-2 px-4 font-medium">Avg Buy</th>
                    <th className="text-right py-2 px-4 font-medium">Current</th>
                    <th className="text-right py-2 px-4 font-medium">Today P&amp;L</th>
                    <th className="text-right py-2 px-4 font-medium">Overall P&amp;L</th>
                    <th className="text-right py-2 px-4 font-medium">Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h: any) => <HoldingRow key={h.id} h={h} />)}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ML Pipeline */}
      <div>
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <BrainCircuit className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">ML Forecasting Pipeline</h2>
          <Badge variant="secondary" className="text-xs">Python · statsmodels · XGBoost · scikit-learn</Badge>
        </div>

        {/* Flow diagram */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          {["OHLCV Data", "Feature Eng.", "ARIMA", "XGBoost", "Neural Net", "Ensemble", "Signal"].map((step, i, arr) => (
            <div key={step} className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-muted/50 border border-border/50 rounded-full px-3 py-1 text-xs font-medium">
                {step}
              </div>
              {i < arr.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
            </div>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <ModelCard
            name="ARIMA" tag="(5,1,0)" color="bg-blue-400"
            description="AutoRegressive Integrated Moving Average. Captures linear autocorrelation in the price series. Order (5,1,0) = 5-lag AR, first-difference to remove trend, no MA terms."
            metrics={[
              { label: "Type",     value: "Statistical" },
              { label: "Input",    value: "Close price" },
              { label: "Horizon", value: "1–30 days" },
              { label: "Strength", value: "Linear AR" },
            ]}
          />
          <ModelCard
            name="XGBoost" tag="n=200, d=4" color="bg-orange-400"
            description="Gradient Boosting trained on 15 features: lag returns (1–21d), RSI-14, MACD (12/26), Bollinger Band position, volume ratio, high-low range. 80/20 chronological split."
            metrics={[
              { label: "Features",   value: "15 inputs" },
              { label: "Trees",      value: "200" },
              { label: "Max Depth", value: "4 levels" },
              { label: "Strength",   value: "Non-linear" },
            ]}
          />
          <ModelCard
            name="Neural Net" tag="[30→128→64→1]" color="bg-purple-400"
            description="MLP trained on 30-day return sequences. Two hidden layers (128, 64) with ReLU activations, Adam optimizer, and early stopping (20 rounds no-improve). Mimics LSTM temporal patterns."
            metrics={[
              { label: "Layers",     value: "128 → 64" },
              { label: "Window",     value: "30 days" },
              { label: "Optimizer", value: "Adam" },
              { label: "Strength",   value: "Sequences" },
            ]}
          />
          <ModelCard
            name="Ensemble" tag="DA-weighted" color="bg-green-400"
            description="Weighted average of all three models. Weights proportional to each model's directional accuracy on held-out test data. Final BUY/SELL by majority vote. HOLD if confidence < 65%."
            metrics={[
              { label: "Voting",     value: "Majority" },
              { label: "Weights",    value: "DA-based" },
              { label: "Threshold", value: "65% conf." },
              { label: "Strength",   value: "Robustness" },
            ]}
          />
        </div>
      </div>

      {/* How it works */}
      <Card className="bg-card/40 border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            How The Pipeline Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6 text-sm">
            <div>
              <div className="text-primary font-semibold mb-2">1. Data &amp; Features</div>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>252 trading days of OHLCV per symbol</li>
                <li>Lag returns: 1, 2, 3, 5, 10, 21 days</li>
                <li>RSI-14, MACD (12/26), Bollinger Bands</li>
                <li>Volume ratio vs 20-day moving average</li>
                <li>High-Low range normalised by close price</li>
                <li>Upstox live data when API key is set</li>
              </ul>
            </div>
            <div>
              <div className="text-primary font-semibold mb-2">2. Training &amp; Validation</div>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>80/20 chronological train/test split</li>
                <li>No look-ahead bias — strictly ordered</li>
                <li>Metrics: RMSE, MAE, MAPE, Directional Acc.</li>
                <li>XGBoost: StandardScaler normalisation</li>
                <li>Neural Net: early stopping (patience=20)</li>
                <li>ARIMA: Ljung-Box residual diagnostics</li>
              </ul>
            </div>
            <div>
              <div className="text-primary font-semibold mb-2">3. Signal Generation</div>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>Each model outputs 30-day price path + CI</li>
                <li>Weights ∝ directional accuracy (softmax)</li>
                <li>BUY: ensemble UP + confidence ≥ 65%</li>
                <li>SELL: ensemble DOWN + confidence ≥ 65%</li>
                <li>HOLD: conflicting or low-confidence signals</li>
                <li>Regime filter: bearish suppresses BUY signals</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Regime + Data source */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="bg-card/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Market Regime Detection</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <p className="mb-3">Rule-based classifier using SMA-50/200 crossover, 20-day realized vol (annualized), RSI-14, and 20-day linear regression slope.</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Bull Market",   desc: "Above SMA50+200, golden cross, +momentum", color: "bg-green-400/15 text-green-300 border-green-400/20" },
                { label: "Bear Market",   desc: "Below SMAs, death cross, −momentum",        color: "bg-red-400/15 text-red-300 border-red-400/20" },
                { label: "High Volatility", desc: "Realized vol > 30% annualized",           color: "bg-yellow-400/15 text-yellow-300 border-yellow-400/20" },
                { label: "Sideways",      desc: "Mixed signals, mean-reversion mode",         color: "bg-blue-400/15 text-blue-300 border-blue-400/20" },
              ].map(r => (
                <div key={r.label} className={`rounded-md p-2 border ${r.color}`}>
                  <div className="font-semibold text-xs">{r.label}</div>
                  <div className="text-[10px] mt-0.5 opacity-80">{r.desc}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Upstox API Integration</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-3">
            <p>
              Live market data via <strong className="text-foreground">Upstox API v2</strong> — NSE/BSE real-time quotes, OHLCV candles (1m to 1d), and broker portfolio positions.
            </p>
            <p>
              Without credentials, a deterministic OHLCV generator simulates realistic price series for all 15 Nifty stocks. All ML models run identically on both data sources.
            </p>
            <div className="border border-border/40 rounded-md p-3 bg-muted/30 font-mono text-[11px] space-y-1">
              <div className="text-foreground font-semibold font-sans text-xs mb-1">Connect live data:</div>
              <div>UPSTOX_API_KEY = your_api_key</div>
              <div>UPSTOX_API_SECRET = your_secret</div>
              <div>UPSTOX_REDIRECT_URI = callback_url</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
