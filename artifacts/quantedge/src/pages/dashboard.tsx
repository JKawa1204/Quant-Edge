/**
 * QUANTEDGE Dashboard — ML Showcase + Live Portfolio P&L
 */
import { useState, useEffect, useCallback } from "react";
import { useGetDashboardSummary, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { useGetSignals, getGetSignalsQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionBadge, RegimeBadge } from "@/components/badges";
import { Link } from "wouter";
import {
  TrendingUp, TrendingDown, Activity, BrainCircuit,
  GitBranch, LineChart, Layers, Target, ArrowUpRight, ArrowDownRight, ChevronRight,
  Bot, Zap, Play, Settings, Clock, ChevronDown, ChevronUp, Shield, BarChart3, Brain
} from "lucide-react";
import { QuantitativeTests } from "@/components/QuantitativeTests";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
const API = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : `${BASE}/api`;

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

// ── Types ───────────────────────────────────────────────────────────────────
interface AutoTradingStatus {
  enabled: boolean;
  confidenceThreshold: number;
  maxPositionSize: number;
  lastRunTime: string | null;
}

interface AutoTradeEntry {
  id: string;
  symbol: string;
  company: string;
  action: string;
  quantity: number;
  price: number;
  confidence: number;
  reasoning: {
    summary?: string;
    signalSummary?: string;
  };
  arimaContribution: number;
  xgboostContribution: number;
  lstmContribution: number;
  optimizationMethod: string;
  timestamp: string;
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

// ── Auto-Trading Control Panel (Section A) ─────────────────────────────────
function AutoTradingPanel() {
  const [status, setStatus] = useState<AutoTradingStatus>({
    enabled: false,
    confidenceThreshold: 70,
    maxPositionSize: 15,
    lastRunTime: null,
  });
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [configThreshold, setConfigThreshold] = useState(70);
  const [configMaxPosition, setConfigMaxPosition] = useState(15);
  const [configSaving, setConfigSaving] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch(`${API}/auto-trading/status`, {
        headers: { "Content-Type": "application/json", ...authHeaders() },
      });
      if (r.ok) {
        const data = await r.json();
        setStatus(data);
        setConfigThreshold(data.confidenceThreshold ?? 70);
        setConfigMaxPosition(data.maxPositionSize ?? 15);
      }
    } catch {
      // API not available — keep defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const toggleAutoTrading = async () => {
    try {
      const r = await fetch(`${API}/auto-trading/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ enabled: !status.enabled }),
      });
      if (r.ok) {
        const data = await r.json();
        setStatus(prev => ({ ...prev, enabled: data.enabled ?? !prev.enabled }));
      } else {
        setStatus(prev => ({ ...prev, enabled: !prev.enabled }));
      }
    } catch {
      setStatus(prev => ({ ...prev, enabled: !prev.enabled }));
    }
  };

  const runNow = async () => {
    setRunning(true);
    try {
      await fetch(`${API}/auto-trading/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
      });
      setStatus(prev => ({ ...prev, lastRunTime: new Date().toISOString() }));
    } catch {
      // silently fail
    } finally {
      setRunning(false);
    }
  };

  const saveConfig = async () => {
    setConfigSaving(true);
    try {
      const r = await fetch(`${API}/auto-trading/configure`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          confidenceThreshold: configThreshold,
          maxPositionSize: configMaxPosition,
        }),
      });
      if (r.ok) {
        setStatus(prev => ({
          ...prev,
          confidenceThreshold: configThreshold,
          maxPositionSize: configMaxPosition,
        }));
      }
    } catch {
      // update locally even if API fails
      setStatus(prev => ({
        ...prev,
        confidenceThreshold: configThreshold,
        maxPositionSize: configMaxPosition,
      }));
    } finally {
      setConfigSaving(false);
      setShowConfig(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-card/60 border-border/50">
        <CardContent className="p-6">
          <Skeleton className="h-32 w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/60 border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Automated Paper Trading</CardTitle>
            <Zap className="h-4 w-4 text-yellow-400" />
          </div>
          {status.enabled && (
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-400" />
              </span>
              <span className="text-xs text-green-400 font-medium">Auto-trading active</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Toggle + Actions Row */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={toggleAutoTrading}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              status.enabled
                ? "bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-600/20"
                : "bg-muted/60 hover:bg-muted text-muted-foreground border border-border/50"
            }`}
          >
            {status.enabled ? "ENABLED" : "DISABLED"}
          </button>

          <button
            onClick={runNow}
            disabled={running}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-colors disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5" />
            {running ? "Running…" : "Run Now"}
          </button>

          <button
            onClick={() => setShowConfig(!showConfig)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-muted/40 hover:bg-muted/60 text-muted-foreground border border-border/50 transition-colors"
          >
            <Settings className="h-3.5 w-3.5" />
            Configure
          </button>
        </div>

        {/* Parameters Display */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="bg-muted/30 border border-border/40 rounded-lg px-3 py-2">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Min Confidence</div>
            <div className="text-sm font-bold font-mono text-primary">{status.confidenceThreshold}%</div>
          </div>
          <div className="bg-muted/30 border border-border/40 rounded-lg px-3 py-2">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Max Position</div>
            <div className="text-sm font-bold font-mono text-primary">{status.maxPositionSize}%</div>
          </div>
          {status.lastRunTime && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Last run: {new Date(status.lastRunTime).toLocaleString()}
            </div>
          )}
        </div>

        {/* Configuration Form (inline) */}
        {showConfig && (
          <div className="border border-border/40 bg-muted/20 rounded-lg p-4 space-y-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Configuration
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Confidence Threshold (%)</label>
                <input
                  type="number"
                  min={50}
                  max={99}
                  value={configThreshold}
                  onChange={e => setConfigThreshold(parseInt(e.target.value) || 70)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Max Position Size (%)</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={configMaxPosition}
                  onChange={e => setConfigMaxPosition(parseInt(e.target.value) || 15)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={saveConfig}
                disabled={configSaving}
                className="px-4 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {configSaving ? "Saving…" : "Save Configuration"}
              </button>
              <button
                onClick={() => setShowConfig(false)}
                className="px-4 py-1.5 rounded-lg text-xs font-medium bg-muted/40 hover:bg-muted/60 text-muted-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Model Contribution Bar ──────────────────────────────────────────────────
function ModelContributionBar({
  arima, xgboost, lstm, compact,
}: {
  arima: number; xgboost: number; lstm: number; compact?: boolean;
}) {
  const total = arima + xgboost + lstm;
  const arimaPct = total > 0 ? (arima / total) * 100 : 33.3;
  const xgboostPct = total > 0 ? (xgboost / total) * 100 : 33.3;
  const lstmPct = total > 0 ? (lstm / total) * 100 : 33.4;

  return (
    <div className="space-y-1">
      <div className={`w-full flex rounded-sm overflow-hidden border border-border/50 ${compact ? "h-3" : "h-4"}`}>
        <div
          className="bg-blue-500 transition-all"
          style={{ width: `${arimaPct}%` }}
          title={`ARIMA: ${arimaPct.toFixed(1)}%`}
        />
        <div
          className="bg-orange-500 transition-all"
          style={{ width: `${xgboostPct}%` }}
          title={`XGBoost: ${xgboostPct.toFixed(1)}%`}
        />
        <div
          className="bg-purple-500 transition-all"
          style={{ width: `${lstmPct}%` }}
          title={`Neural Net: ${lstmPct.toFixed(1)}%`}
        />
      </div>
      {!compact && (
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            ARIMA {arimaPct.toFixed(0)}%
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-orange-500" />
            XGBoost {xgboostPct.toFixed(0)}%
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-purple-500" />
            Neural Net {lstmPct.toFixed(0)}%
          </div>
        </div>
      )}
    </div>
  );
}

// ── Recent Auto-Trades Feed (Section B) ─────────────────────────────────────
function RecentAutoTradesFeed() {
  const [trades, setTrades] = useState<AutoTradeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/auto-trading/history`, {
          headers: { "Content-Type": "application/json", ...authHeaders() },
        });
        if (r.ok) {
          const data = await r.json();
          setTrades(Array.isArray(data) ? data.slice(0, 5) : []);
        }
      } catch {
        // API not available
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const actionColor = (action: string) => {
    const a = action.toUpperCase();
    if (a === "BUY") return "bg-green-500/15 text-green-400 border-green-500/20";
    if (a === "SELL") return "bg-red-500/15 text-red-400 border-red-500/20";
    return "bg-muted/40 text-muted-foreground border-border/50";
  };

  return (
    <Card className="bg-card/60 border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Recent Auto-Trade Decisions</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
          </div>
        ) : trades.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Bot className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <div className="text-sm text-muted-foreground">
              Enable auto-trading to see automated decisions here
            </div>
            <div className="text-xs text-muted-foreground/60 mt-1">
              The bot will analyze signals and execute paper trades automatically
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {trades.map((trade) => (
              <div
                key={trade.id}
                className="border border-border/40 bg-muted/10 rounded-lg p-4 space-y-3 hover:border-border/60 transition-colors"
              >
                {/* Header row */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div>
                      <span className="font-bold text-sm">{trade.symbol}</span>
                      {trade.company && (
                        <span className="text-xs text-muted-foreground ml-2">{trade.company}</span>
                      )}
                    </div>
                    <Badge variant="outline" className={`text-[10px] font-semibold ${actionColor(trade.action)}`}>
                      {trade.action.toUpperCase()}
                    </Badge>
                    {trade.optimizationMethod && (
                      <Badge variant="outline" className="text-[10px] font-mono bg-primary/10 text-primary border-primary/20">
                        {trade.optimizationMethod}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(trade.timestamp).toLocaleString()}
                  </div>
                </div>

                {/* Details row */}
                <div className="flex items-center gap-4 flex-wrap text-xs">
                  <div className="bg-muted/30 rounded-md px-2.5 py-1">
                    <span className="text-muted-foreground">Qty: </span>
                    <span className="font-mono font-semibold">{trade.quantity}</span>
                  </div>
                  <div className="bg-muted/30 rounded-md px-2.5 py-1">
                    <span className="text-muted-foreground">Price: </span>
                    <span className="font-mono font-semibold">₹{trade.price?.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Confidence:</span>
                    <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          trade.confidence >= 0.8 ? "bg-green-400" :
                          trade.confidence >= 0.6 ? "bg-yellow-400" : "bg-red-400"
                        }`}
                        style={{ width: `${(trade.confidence ?? 0) * 100}%` }}
                      />
                    </div>
                    <span className="font-mono font-semibold">{((trade.confidence ?? 0) * 100).toFixed(0)}%</span>
                  </div>
                </div>

                {/* Reasoning */}
                {(trade.reasoning?.summary || trade.reasoning?.signalSummary) && (
                  <div className="text-xs text-muted-foreground bg-muted/20 rounded-md px-3 py-2 leading-relaxed">
                    {trade.reasoning.summary || trade.reasoning.signalSummary}
                  </div>
                )}

                {/* Model contributions bar */}
                <ModelContributionBar
                  arima={trade.arimaContribution ?? 0}
                  xgboost={trade.xgboostContribution ?? 0}
                  lstm={trade.lstmContribution ?? 0}
                  compact
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Active Signals with Explanations (Section C) ────────────────────────────
function ActiveSignalsExplained() {
  const { data: signals, isLoading } = useGetSignals({ query: { queryKey: getGetSignalsQueryKey() } });
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const toggleExpand = (id: number) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const getHighestModel = (signal: any) => {
    const contributions = [
      { name: "ARIMA", value: signal.arimaContribution ?? 0 },
      { name: "Neural Net", value: signal.lstmContribution ?? 0 },
      { name: "XGBoost", value: signal.xgboostContribution ?? 0 },
    ];
    contributions.sort((a, b) => b.value - a.value);
    return contributions[0];
  };

  const getDirection = (signal: any) => {
    if (signal.action?.toUpperCase() === "BUY") return "upward";
    if (signal.action?.toUpperCase() === "SELL") return "downward";
    return "neutral";
  };

  const getRegimeStrategy = (regime: string) => {
    const r = (regime ?? "").toLowerCase();
    if (r.includes("bull")) return { supports: true, strategy: "momentum / growth strategies" };
    if (r.includes("bear")) return { supports: false, strategy: "defensive / hedging strategies" };
    if (r.includes("sideways")) return { supports: true, strategy: "mean-reversion strategies" };
    if (r.includes("high vol")) return { supports: false, strategy: "reduced position sizing" };
    return { supports: true, strategy: "balanced strategies" };
  };

  return (
    <Card className="bg-card/60 border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Active Signals — Why Buy / Sell / Hold</CardTitle>
          </div>
          <Link href="/signals">
            <button className="flex items-center gap-1 text-xs text-primary hover:underline">
              View all <ChevronRight className="h-3 w-3" />
            </button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
          </div>
        ) : !signals || signals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <BarChart3 className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <div className="text-sm text-muted-foreground">
              No active signals available
            </div>
            <div className="text-xs text-muted-foreground/60 mt-1">
              Signals will appear once the ML pipeline generates predictions
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {signals.map((signal) => {
              const isExpanded = expandedId === signal.id;
              const highest = getHighestModel(signal);
              const direction = getDirection(signal);
              const regimeInfo = getRegimeStrategy(signal.regime ?? "unknown");
              const confidencePct = (signal.confidence ?? 0) * 100;
              const highestPct = (highest.value ?? 0) * 100;

              return (
                <div key={signal.id} className="border border-border/40 rounded-lg overflow-hidden hover:border-border/60 transition-colors">
                  {/* Signal row */}
                  <button
                    onClick={() => toggleExpand(signal.id)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/10 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-bold text-sm">{signal.symbol}</span>
                      <ActionBadge action={signal.action} />
                      {/* Confidence meter */}
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              confidencePct >= 70 ? "bg-green-400" :
                              confidencePct >= 50 ? "bg-yellow-400" : "bg-red-400"
                            }`}
                            style={{ width: `${confidencePct}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-muted-foreground">{confidencePct.toFixed(0)}%</span>
                      </div>
                      {signal.regime && <RegimeBadge regime={signal.regime} />}
                    </div>
                    <div className="flex items-center gap-2">
                      {signal.forecastReturn !== undefined && (
                        <span className={`text-xs font-mono font-semibold ${
                          signal.forecastReturn > 0 ? "text-green-400" : "text-red-400"
                        }`}>
                          {signal.forecastReturn > 0 ? "+" : ""}{(signal.forecastReturn ?? 0).toFixed(2)}%
                        </span>
                      )}
                      {isExpanded
                        ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      }
                    </div>
                  </button>

                  {/* Expandable explanation */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 space-y-4 border-t border-border/30 bg-muted/5">
                      {/* Model Breakdown */}
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          <BarChart3 className="h-3 w-3" />
                          Model Breakdown
                        </div>
                        <div className="space-y-2">
                          {[
                            { name: "ARIMA", value: (signal.arimaContribution ?? 0) * 100, color: "bg-blue-500" },
                            { name: "Neural Net (LSTM)", value: (signal.lstmContribution ?? 0) * 100, color: "bg-purple-500" },
                            { name: "XGBoost", value: (signal.xgboostContribution ?? 0) * 100, color: "bg-orange-500" },
                          ].map(model => (
                            <div key={model.name} className="flex items-center gap-3">
                              <span className="text-xs text-muted-foreground w-28 flex-shrink-0">{model.name}</span>
                              <div className="flex-1 h-2 bg-muted/40 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${model.color} transition-all`}
                                  style={{ width: `${model.value}%` }}
                                />
                              </div>
                              <span className="text-xs font-mono font-semibold w-12 text-right">{model.value.toFixed(1)}%</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Regime Impact */}
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          <Shield className="h-3 w-3" />
                          Regime Impact
                        </div>
                        <div className="bg-muted/20 rounded-md px-3 py-2 text-xs">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-muted-foreground">Current Regime:</span>
                            <RegimeBadge regime={signal.regime ?? "unknown"} />
                          </div>
                          <p className="text-muted-foreground leading-relaxed">
                            The {(signal.regime ?? "unknown").toLowerCase()} regime{" "}
                            <span className={regimeInfo.supports ? "text-green-400" : "text-red-400"}>
                              {regimeInfo.supports ? "supports" : "contradicts"}
                            </span>{" "}
                            this {signal.action?.toUpperCase()} signal. Recommended: {regimeInfo.strategy}.
                          </p>
                        </div>
                      </div>

                      {/* Forecast */}
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          <TrendingUp className="h-3 w-3" />
                          Forecast
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <div className="bg-muted/20 rounded-md px-3 py-2">
                            <span className="text-muted-foreground">Expected Return: </span>
                            <span className={`font-mono font-bold ${
                              (signal.forecastReturn ?? 0) > 0 ? "text-green-400" : "text-red-400"
                            }`}>
                              {(signal.forecastReturn ?? 0) > 0 ? "+" : ""}{(signal.forecastReturn ?? 0).toFixed(2)}%
                            </span>
                          </div>
                          <div className="bg-muted/20 rounded-md px-3 py-2">
                            <span className="text-muted-foreground">Direction: </span>
                            <span className={`font-semibold ${
                              direction === "upward" ? "text-green-400" :
                              direction === "downward" ? "text-red-400" : "text-muted-foreground"
                            }`}>
                              {direction === "upward" ? "↑ Bullish" : direction === "downward" ? "↓ Bearish" : "— Neutral"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Generated Explanation */}
                      <div className="bg-primary/5 border border-primary/10 rounded-lg px-4 py-3">
                        <p className="text-xs leading-relaxed text-foreground/80">
                          <strong>{signal.action?.toUpperCase()}</strong> because the ensemble model shows{" "}
                          <strong>{direction}</strong> movement with{" "}
                          <strong className="font-mono">{confidencePct.toFixed(0)}%</strong> confidence.{" "}
                          <strong>{highest.name}</strong> contributed most ({highestPct.toFixed(0)}%).{" "}
                          Regime (<em>{signal.regime ?? "unknown"}</em>){" "}
                          {regimeInfo.supports ? "supports" : "contradicts"} the{" "}
                          {signal.action?.toUpperCase() === "BUY" ? "long" : signal.action?.toUpperCase() === "SELL" ? "short" : "hold"} strategy.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey() },
  });

  const [holdings, setHoldings]         = useState<any[]>([]);
  const [loadingHoldings, setLoadingH]  = useState(true);
  const [iciciConnected, setIciciConnected] = useState(false);

  const loadHoldings = useCallback(async () => {
    setLoadingH(true);
    try { setHoldings(await fetchHoldings()); } catch { setHoldings([]); } finally { setLoadingH(false); }
  }, []);

  const checkIciciStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API}/icici/status`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setIciciConnected(!!data.connected);
      }
    } catch (e) {
      console.error("Failed to fetch ICICI status", e);
    }
  }, []);

  useEffect(() => { 
    loadHoldings(); 
    checkIciciStatus();
  }, [loadHoldings, checkIciciStatus]);

  // Connect to Live Price WebSocket
  useEffect(() => {
    // In dev, the API server is on 3000. In prod, we use VITE_WS_URL or relative host.
    let wsUrl = "ws://localhost:3000/";
    
    if (import.meta.env.VITE_WS_URL) {
      wsUrl = import.meta.env.VITE_WS_URL;
    } else if (window.location.hostname !== "localhost") {
      wsUrl = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/`;
    }
      
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "PRICE_UPDATE") {
          const { symbol, price } = msg.data;
          
          setHoldings(prev => prev.map(h => {
            if (h.symbol === symbol) {
              const prevClose = h.prevClose || h.avgBuyPrice;
              const todayPnl = (price - prevClose) * h.quantity;
              const todayPnlPct = ((price - prevClose) / prevClose) * 100;
              
              const overallPnl = (price - h.avgBuyPrice) * h.quantity;
              const overallPnlPct = ((price - h.avgBuyPrice) / h.avgBuyPrice) * 100;
              
              const currentValue = price * h.quantity;
              
              return { ...h, currentPrice: price, todayPnl, todayPnlPct, overallPnl, overallPnlPct, currentValue };
            }
            return h;
          }));
        }
      } catch (e) {
        console.error("WebSocket decode error", e);
      }
    };

    return () => ws.close();
  }, []);

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <BrainCircuit className="h-7 w-7 text-primary" />
            QUANTEDGE
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            ML forecasting pipeline for Indian equity markets — ARIMA · XGBoost · Neural Net · Ensemble
          </p>
        </div>
        {iciciConnected ? (
          <div className="bg-green-500/10 text-green-500 border border-green-500/20 px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 shadow-sm">
            <Zap className="h-4 w-4" />
            Connected to ICICI Direct
          </div>
        ) : (
          <button 
            onClick={async () => {
              try {
                const res = await fetch(`${API}/icici/auth`, { headers: authHeaders() });
                const data = await res.json();
                if (data.url) window.location.href = data.url;
                else alert(data.error || "Failed to initiate ICICI login");
              } catch (err) {
                alert("Network error connecting to broker");
              }
            }}
            className="bg-[#D9381E] hover:bg-[#b02d18] text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
          >
            <Activity className="h-4 w-4" />
            Connect ICICI Direct
          </button>
        )}
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

      {/* ═══════════════════ NEW SECTIONS ═══════════════════ */}

      {/* Section A: Auto-Trading Control Panel */}
      <AutoTradingPanel />

      {/* Section B: Recent Auto-Trades Feed */}
      <RecentAutoTradesFeed />

      {/* Section C: Active Signals with Explanations */}
      <ActiveSignalsExplained />

      {/* ═══════════════════ EXISTING SECTIONS ═══════════════════ */}

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

      {/* Quantitative Testing */}
      {holdings.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Activity className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">Quantitative Risk Analysis</h2>
            <Badge variant="secondary" className="text-xs">Monte Carlo &amp; Stress Tests</Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from(new Set(holdings.map((h: any) => h.symbol as string))).slice(0, 3).map((symbol) => (
              <QuantitativeTests key={symbol} symbol={symbol} />
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
