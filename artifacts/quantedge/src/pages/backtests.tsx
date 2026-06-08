import { useState, useEffect } from "react";
import { useGetBacktests } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown, Activity, Shield, Zap, ChevronDown, ChevronUp, Award, Plus, Play } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
const API = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : `${BASE}/api`;

function authHdr(): Record<string, string> {
  const t = localStorage.getItem("quantedge_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

type DetailData = Awaited<ReturnType<typeof fetchDetail>>;
async function fetchDetail(id: number) {
  const r = await fetch(`${API}/backtests/${id}`, { headers: { "Content-Type": "application/json", ...authHdr() } as Record<string, string> });
  return r.json() as Promise<{
    id: number; name: string; symbols: string[]; startDate: string; endDate: string;
    forecastModel: string; optimizationMethod: string;
    metrics: {
      totalReturn: number; benchmarkReturn: number; cagr: number; sharpeRatio: number;
      sortinoRatio: number; maxDrawdown: number; alpha: number; beta: number;
      informationRatio: number; winRate: number; profitFactor: number; annualizedVol: number;
    };
    equityCurve: { date: string; strategy: number; benchmark: number; drawdown: number }[];
    monthlyReturns: { year: number; month: number; return: number }[];
    modelComparison: { model: string; cagr: number; sharpe: number; maxDD: number; selected: boolean }[];
    portfolioWeights: { symbol: string; weight: number; allocation: number }[];
  }>;
}

function pct(v: number, dec = 1) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(dec)}%`;
}

function MetricPill({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  const color = positive === undefined ? "text-foreground" : positive ? "text-emerald-400" : "text-red-400";
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`text-sm font-semibold ${color}`}>{value}</span>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
    </div>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MODEL_COLORS: Record<string, string> = {
  ensemble: "bg-blue-500/20 text-blue-400 border-blue-500/40",
  xgboost: "bg-orange-500/20 text-orange-400 border-orange-500/40",
  arima: "bg-purple-500/20 text-purple-400 border-purple-500/40",
  neural: "bg-cyan-500/20 text-cyan-400 border-cyan-500/40",
};

function DetailPanel({ id }: { id: number }) {
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);

  useEffect(() => {
    let timeoutId: any;
    let isMounted = true;
    
    async function fetchIt() {
      if (!loaded && isMounted) setLoading(true);
      try {
        const d = await fetchDetail(id);
        if (!isMounted) return;
        setData(d);
        setLoaded(true);
        if ((d as any).status === "running" || (d as any).status === "pending") {
           timeoutId = setTimeout(fetchIt, 3000);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    
    fetchIt();
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [id]);

  if (loading && !data) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading scenario data…</div>;
  }

  if (data && ((data as any).status === "running" || (data as any).status === "pending")) {
    return (
      <div className="p-12 text-center flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <div className="space-y-1">
          <p className="font-medium text-foreground">Running ML Backtest Engine...</p>
          <p className="text-xs text-muted-foreground animate-pulse">Downloading data and applying {data.forecastModel} model. This may take 2-5 minutes.</p>
        </div>
      </div>
    );
  }

  if ("error" in data! || !data!.equityCurve) {
    return <div className="p-8 text-center text-red-400">Failed to load backtest data: {(data as any).error || "Missing data"}</div>;
  }

  useEffect(() => {
    if (loaded && data && !aiInsight) {
      const t = setTimeout(() => {
        fetch(`${API}/ai/commentary`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHdr() },
          body: JSON.stringify({ 
            type: "backtest strategy", 
            context: `Strategy CAGR: ${data.metrics.cagr}%, Sharpe: ${data.metrics.sharpeRatio}, Max DD: ${data.metrics.maxDrawdown}%, Win Rate: ${data.metrics.winRate}%.`
          })
        })
        .then(r => r.json())
        .then(d => { if (d.text) setAiInsight(d.text); else setAiInsight("Failed to load insights."); })
        .catch(() => setAiInsight("Failed to load insights."));
      }, 3000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [loaded, data, aiInsight]);

  const metrics = data?.metrics || {} as any;
  const equityCurve = data?.equityCurve || [];
  const monthlyReturns = data?.monthlyReturns || [];
  const modelComparison = data?.modelComparison || [];
  const portfolioWeights = data?.portfolioWeights || [];

  const curveEvery = Math.max(1, Math.floor(equityCurve.length / 120));
  const chartData = equityCurve.filter((_, i) => i % curveEvery === 0).map(p => ({
    date: p.date,
    Strategy: Math.round((p.strategy || 0) / 1000) / 1,
    Benchmark: Math.round((p.benchmark || 0) / 1000) / 1,
    Drawdown: p.drawdown || 0,
  }));

  const years = [...new Set(monthlyReturns.map(m => m.year))].sort();

  const WEIGHT_COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#06b6d4","#84cc16"];

  return (
    <div className="space-y-6 pt-4">
      {/* Summary metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: "Total Return", value: pct(metrics?.totalReturn || 0), positive: (metrics?.totalReturn || 0) > 0 },
          { label: "CAGR", value: pct(metrics?.cagr || 0), positive: true },
          { label: "Sharpe", value: (metrics?.sharpeRatio || 0).toFixed(2), positive: (metrics?.sharpeRatio || 0) > 1 },
          { label: "Sortino", value: (metrics?.sortinoRatio || 0).toFixed(2), positive: (metrics?.sortinoRatio || 0) > 1 },
          { label: "Max Drawdown", value: pct(metrics?.maxDrawdown || 0), positive: false },
          { label: "Alpha", value: pct(metrics?.alpha || 0), positive: true },
          { label: "Beta", value: (metrics?.beta || 0).toFixed(2), positive: undefined },
          { label: "Win Rate", value: `${metrics?.winRate || 0}%`, positive: (metrics?.winRate || 0) > 55 },
          { label: "Profit Factor", value: (metrics?.profitFactor || 0).toFixed(2), positive: (metrics?.profitFactor || 0) > 1.5 },
          { label: "Ann. Vol", value: pct(metrics?.annualizedVol || 0), positive: undefined },
          { label: "Info Ratio", value: (metrics?.informationRatio || 0).toFixed(2), positive: (metrics?.informationRatio || 0) > 0.8 },
          { label: "vs Benchmark", value: pct((metrics?.totalReturn || 0) - (metrics?.benchmarkReturn || 0)), positive: (metrics?.totalReturn || 0) > (metrics?.benchmarkReturn || 0) },
        ].map(m => (
          <Card key={m.label} className="py-3 px-4">
            <MetricPill label={m.label} value={m.value} positive={m.positive} />
          </Card>
        ))}
      </div>

      {/* Gemini AI Insights */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            AI Strategy Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!aiInsight ? (
            <div className="space-y-2">
              <div className="h-4 w-full bg-muted animate-pulse rounded" />
              <div className="h-4 w-[90%] bg-muted animate-pulse rounded" />
              <p className="text-xs text-muted-foreground mt-2 italic">Gemini is analyzing strategy performance...</p>
            </div>
          ) : (
            <p className="text-sm leading-relaxed">{aiInsight}</p>
          )}
        </CardContent>
      </Card>

      {/* Equity curve */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Equity Curve vs Nifty 50
            <span className="text-xs text-muted-foreground font-normal ml-2">₹10L initial capital</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="stratGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="benchGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6b7280" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6b7280" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(0, 7)} interval={Math.floor(chartData.length / 6)} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${v}k`} />
              <Tooltip formatter={(v: number) => [`₹${v.toLocaleString()}k`, ""]} labelStyle={{ fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="Strategy" stroke="#3b82f6" fill="url(#stratGrad)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="Benchmark" stroke="#6b7280" fill="url(#benchGrad)" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Drawdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-red-400" /> Drawdown Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={130}>
            <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(0, 7)} interval={Math.floor(chartData.length / 6)} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
              <ReferenceLine y={0} stroke="#374151" />
              <Tooltip formatter={(v: number) => [`${v.toFixed(2)}%`, "Drawdown"]} labelStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="Drawdown" stroke="#ef4444" fill="url(#ddGrad)" strokeWidth={1.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly returns heatmap */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Monthly Returns Heatmap
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left text-muted-foreground pr-2 font-normal">Year</th>
                    {MONTHS.map(m => <th key={m} className="text-muted-foreground font-normal px-1">{m}</th>)}
                    <th className="text-muted-foreground font-normal px-1">Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {years.map(y => {
                    const row = MONTHS.map((_, mi) => monthlyReturns.find(m => m.year === y && m.month === mi + 1));
                    const vals = row.filter(Boolean).map(m => m!.return);
                    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
                    return (
                      <tr key={y}>
                        <td className="text-muted-foreground pr-2 py-0.5 font-medium">{y}</td>
                        {row.map((m, mi) => {
                          const v = m?.return ?? null;
                          const bg = v === null ? "bg-transparent" : v > 3 ? "bg-emerald-500/40" : v > 1 ? "bg-emerald-500/25" : v > 0 ? "bg-emerald-500/12" : v > -2 ? "bg-red-500/20" : "bg-red-500/40";
                          return (
                            <td key={mi} className={`px-1 py-0.5 text-center rounded ${bg}`} title={v !== null ? `${v > 0 ? "+" : ""}${v.toFixed(2)}%` : ""}>
                              {v !== null ? <span className={v >= 0 ? "text-emerald-400" : "text-red-400"}>{v > 0 ? "+" : ""}{v.toFixed(1)}</span> : ""}
                            </td>
                          );
                        })}
                        <td className={`px-1 py-0.5 text-center font-medium ${avg >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {avg >= 0 ? "+" : ""}{avg.toFixed(1)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ML model comparison */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-400" /> ML Model Comparison
              <span className="text-xs text-muted-foreground font-normal">same period & universe</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground text-xs border-b border-border">
                  <th className="text-left pb-2 font-normal">Model</th>
                  <th className="text-right pb-2 font-normal">CAGR</th>
                  <th className="text-right pb-2 font-normal">Sharpe</th>
                  <th className="text-right pb-2 font-normal">Max DD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {modelComparison.map(m => (
                  <tr key={m.model} className={m.selected ? "bg-primary/5" : ""}>
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-2">
                        {m.selected && <Award className="h-3 w-3 text-yellow-400" />}
                        <span className={m.selected ? "font-semibold text-foreground" : "text-muted-foreground"}>{m.model}</span>
                        {m.selected && <Badge variant="outline" className="text-[10px] py-0 px-1 border-yellow-500/40 text-yellow-400">selected</Badge>}
                      </div>
                    </td>
                    <td className={`text-right py-2 ${m.cagr > 0 ? "text-emerald-400" : "text-red-400"}`}>+{m.cagr}%</td>
                    <td className="text-right py-2 text-foreground">{m.sharpe}</td>
                    <td className="text-right py-2 text-red-400">{m.maxDD}%</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Portfolio weights */}
            {portfolioWeights.length > 1 && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide flex items-center gap-1">
                  <Shield className="h-3 w-3" /> Optimised Portfolio Weights
                </p>
                <div className="space-y-1.5">
                  {portfolioWeights.map((w, i) => (
                    <div key={w.symbol} className="flex items-center gap-2">
                      <span className="text-xs w-20 truncate font-medium">{w.symbol}</span>
                      <div className="flex-1 bg-muted/30 rounded-full h-2 overflow-hidden">
                        <div className="h-2 rounded-full" style={{ width: `${w.weight}%`, backgroundColor: WEIGHT_COLORS[i % WEIGHT_COLORS.length] }} />
                      </div>
                      <span className="text-xs text-muted-foreground w-10 text-right">{w.weight.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const MODEL_BADGE: Record<string, string> = {
  ensemble: "Ensemble", xgboost: "XGBoost", arima: "ARIMA", neural: "Neural Net",
};
const OPT_LABEL: Record<string, string> = {
  max_sharpe: "Max Sharpe", min_variance: "Min Variance", risk_parity: "Risk Parity",
};

export default function Backtests() {
  const { data: backtests, isLoading } = useGetBacktests({});
  const [expanded, setExpanded] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Backtesting Engine</h1>
        <div className="grid grid-cols-1 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="h-20 bg-card rounded-lg animate-pulse" />)}
        </div>
      </div>
    );
  }

  const total = backtests?.length ?? 0;
  const avgCagr = backtests?.length ? backtests.reduce((s, b) => s + (b.cagr ?? 0), 0) / backtests.length : 0;
  const bestSharpe = backtests?.reduce((best, b) => (b.sharpeRatio ?? 0) > (best.sharpeRatio ?? 0) ? b : best, backtests[0]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Backtesting Engine</h1>
          <p className="text-muted-foreground text-sm mt-1">Pre-built scenarios — 5 to 10 years of Indian equity history with ML model attribution</p>
        </div>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Run New Strategy
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Run New ML Backtest</DialogTitle>
              <DialogDescription>
                Execute a real historical backtest on Render. 
                <span className="block mt-1 text-emerald-400">Tip: For optimal 2-5 min compute times, select 1-3 symbols, a 2-year timeframe, and XGBoost.</span>
              </DialogDescription>
            </DialogHeader>
            <form className="space-y-4 mt-2" onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              
              // Process symbols, auto-append .NS
              const rawSymbols = fd.get("symbols") as string;
              const symbols = rawSymbols.split(",").map(s => {
                let trimmed = s.trim().toUpperCase();
                if (trimmed && !trimmed.endsWith(".NS")) trimmed += ".NS";
                return trimmed;
              }).filter(Boolean);

              const payload = {
                name: fd.get("name"),
                symbols: symbols,
                startDate: fd.get("startDate"),
                endDate: fd.get("endDate"),
                forecastModel: fd.get("forecastModel"),
                optimizationMethod: fd.get("optimizationMethod")
              };

              try {
                const res = await fetch(`${API}/backtests`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", ...authHdr() },
                  body: JSON.stringify(payload)
                });
                if (res.ok) {
                  window.location.reload();
                }
              } catch (err) {
                console.error(err);
              }
            }}>
              <div className="space-y-2">
                <Label>Strategy Name</Label>
                <Input name="name" required placeholder="e.g., Tech Momentum 2023" />
              </div>
              <div className="space-y-2">
                <Label>Symbols (comma separated)</Label>
                <Input name="symbols" required placeholder="TCS, INFY, RELIANCE" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input type="date" name="startDate" required defaultValue="2022-01-01" />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input type="date" name="endDate" required defaultValue="2023-12-31" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>ML Model</Label>
                  <Select name="forecastModel" defaultValue="xgboost">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="xgboost">XGBoost (Fast)</SelectItem>
                      <SelectItem value="arima">ARIMA</SelectItem>
                      <SelectItem value="neural">Neural Network</SelectItem>
                      <SelectItem value="ensemble">Ensemble (Slow)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Optimization</Label>
                  <Select name="optimizationMethod" defaultValue="max_sharpe">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="max_sharpe">Max Sharpe</SelectItem>
                      <SelectItem value="min_variance">Min Variance</SelectItem>
                      <SelectItem value="risk_parity">Risk Parity</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" className="w-full gap-2 mt-4"><Play className="h-4 w-4" /> Start Backtest Job</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="py-4 px-5">
          <p className="text-2xl font-bold text-primary">{total}</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mt-0.5">Scenarios</p>
        </Card>
        <Card className="py-4 px-5">
          <p className="text-2xl font-bold text-emerald-400">+{avgCagr.toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mt-0.5">Avg CAGR</p>
        </Card>
        <Card className="py-4 px-5">
          <p className="text-2xl font-bold text-blue-400">{bestSharpe?.sharpeRatio?.toFixed(2) ?? "—"}</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mt-0.5">Best Sharpe · {bestSharpe?.name?.split("—")[0].trim()}</p>
        </Card>
      </div>

      {/* Scenario list */}
      <div className="space-y-6">
        {backtests?.map(b => {
          const metrics = b.metrics || b || {};
          const cagr = metrics.cagr ?? 0;
          const sharpe = metrics.sharpeRatio ?? 0;
          const maxDd = metrics.maxDrawdown ?? 0;
          const alpha = metrics.alpha ?? 0;
          
          const cagrColor = cagr >= 18 ? "text-emerald-400" : cagr >= 10 ? "text-yellow-400" : "text-red-400";
          const modelKey = (b.forecastModel ?? "").toLowerCase();
          const badgeCls = MODEL_COLORS[modelKey] ?? "bg-muted/40 text-muted-foreground border-border";

          return (
            <Card key={b.id} className="overflow-hidden border-border/60 shadow-sm">
              <div className="bg-muted/10 px-5 py-4 flex items-center gap-4 border-b border-border/40">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-lg">{b.name}</span>
                    <Badge variant="outline" className={`text-xs py-0.5 px-2 border ${badgeCls}`}>
                      {MODEL_BADGE[modelKey] ?? b.forecastModel}
                    </Badge>
                    <span className="text-xs text-muted-foreground border border-border rounded px-2 py-0.5">
                      {OPT_LABEL[b.optimizationMethod ?? ""] ?? b.optimizationMethod}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground">
                    <span>{b.symbols?.join(", ")}</span>
                    <span>·</span>
                    <span>{format(new Date(b.startDate!), "MMM yyyy")} → {format(new Date(b.endDate!), "MMM yyyy")}</span>
                  </div>
                </div>

                <div className="flex items-center gap-6 shrink-0 bg-background/50 px-4 py-2 rounded-lg border border-border/40">
                  <div className="text-right">
                    <div className={`text-xl font-bold tabular-nums ${cagrColor}`}>+{cagr.toFixed(1)}%</div>
                    <div className="text-xs text-muted-foreground uppercase font-medium">CAGR</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold tabular-nums">{sharpe.toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground uppercase font-medium">Sharpe</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold tabular-nums text-red-400">{maxDd.toFixed(1)}%</div>
                    <div className="text-xs text-muted-foreground uppercase font-medium">Max DD</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold tabular-nums text-blue-400">+{alpha.toFixed(1)}%</div>
                    <div className="text-xs text-muted-foreground uppercase font-medium">Alpha</div>
                  </div>
                </div>
              </div>

              <div className="px-5 pb-5 pt-2">
                <DetailPanel id={b.id!} />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
