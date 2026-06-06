/**
 * Portfolio page — buy/sell shares, see P&L per holding, transaction history.
 * Simple and clear: avg buy price vs current price, today's P&L, overall P&L.
 */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpRight, ArrowDownRight, ShoppingCart, TrendingDown, RefreshCw } from "lucide-react";
import { formatCurrency } from "@/lib/format";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
const API = `${BASE}/api`;

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("quantedge_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers ?? {}) },
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: r.statusText }));
    throw new Error(err.error ?? r.statusText);
  }
  return r.json();
}

// ── Buy/Sell Modal ──────────────────────────────────────────────────────────
function TradeModal({
  mode, symbol, maxQty, currentPrice, onClose, onDone,
}: {
  mode: "buy" | "sell"; symbol?: string; maxQty?: number;
  currentPrice?: number; onClose: () => void; onDone: () => void;
}) {
  const [sym, setSym]       = useState(symbol ?? "");
  const [qty, setQty]       = useState(1);
  const [price, setPrice]   = useState(currentPrice ?? 0);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");

  async function submit() {
    if (!sym || qty < 1 || price <= 0) return;
    setLoading(true); setError(""); setSuccess("");
    try {
      const data = await apiFetch(`/portfolio/${mode}`, {
        method: "POST",
        body: JSON.stringify({ symbol: sym.toUpperCase(), quantity: qty, price }),
      });
      setSuccess(data.message ?? "Done!");
      setTimeout(() => { onDone(); }, 900);
    } catch (e: any) {
      setError(e.message ?? "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            {mode === "buy"
              ? <ShoppingCart className="h-4 w-4 text-green-400" />
              : <TrendingDown className="h-4 w-4 text-red-400" />}
            <span className="font-semibold capitalize">{mode} Shares</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Symbol (NSE)</label>
            <input
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:border-primary"
              value={sym} onChange={e => setSym(e.target.value)}
              placeholder="e.g. RELIANCE"
              disabled={!!symbol}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Quantity {mode === "sell" && maxQty ? `(you hold ${maxQty})` : ""}
            </label>
            <input
              type="number" min={1} max={mode === "sell" ? maxQty : undefined}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
              value={qty} onChange={e => setQty(parseInt(e.target.value) || 1)}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Price per share (₹)</label>
            <input
              type="number" step="0.01" min={0.01}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
              value={price} onChange={e => setPrice(parseFloat(e.target.value) || 0)}
            />
          </div>

          {price > 0 && qty > 0 && (
            <div className="bg-muted/40 rounded-lg p-3">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Total {mode === "buy" ? "cost" : "proceeds"}</span>
                <span className="font-mono font-semibold">
                  ₹{(price * qty).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}

          {error   && <div className="bg-destructive/20 text-destructive text-xs p-2 rounded-lg">{error}</div>}
          {success && <div className="bg-green-500/20 text-green-400 text-xs p-2 rounded-lg">{success}</div>}

          <button
            onClick={submit}
            disabled={loading || !sym || qty < 1 || price <= 0}
            className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
              mode === "buy"
                ? "bg-green-600 hover:bg-green-500 text-white"
                : "bg-red-600 hover:bg-red-500 text-white"
            }`}
          >
            {loading ? "Processing…" : `Confirm ${mode === "buy" ? "Buy" : "Sell"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Single holding card ───────────────────────────────────────────────────────
function HoldingCard({ h, onSell }: { h: any; onSell: () => void }) {
  const overallUp = h.overallPnl >= 0;
  const todayUp   = h.todayPnl >= 0;

  return (
    <Card className="bg-card/60 hover:border-border/80 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="font-bold text-base">{h.symbol}</div>
            <div className="text-xs text-muted-foreground mt-0.5 max-w-[160px] truncate">{h.company}</div>
            <Badge variant="outline" className="text-[10px] mt-1">{h.sector}</Badge>
          </div>
          <button
            onClick={onSell}
            className="text-xs border border-red-500/40 text-red-400 hover:bg-red-500/10 rounded-md px-2 py-1 transition-colors"
          >
            Sell
          </button>
        </div>

        {/* Price comparison */}
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          <div className="bg-muted/40 rounded-md p-2 text-center">
            <div className="text-[10px] text-muted-foreground">Avg Buy</div>
            <div className="text-xs font-mono font-semibold">₹{h.avgBuyPrice.toLocaleString()}</div>
          </div>
          <div className="bg-muted/40 rounded-md p-2 text-center">
            <div className="text-[10px] text-muted-foreground">Day Open</div>
            <div className="text-xs font-mono">₹{h.dayOpenPrice.toLocaleString()}</div>
          </div>
          <div className="bg-muted/40 rounded-md p-2 text-center">
            <div className="text-[10px] text-muted-foreground">Current</div>
            <div className="text-xs font-mono font-semibold text-primary">₹{h.currentPrice.toLocaleString()}</div>
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between text-muted-foreground">
            <span>Qty</span>
            <span className="font-mono font-medium text-foreground">{h.quantity} shares</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Invested</span>
            <span className="font-mono">{formatCurrency(h.invested)}</span>
          </div>
          <div className="border-t border-border/30 pt-1.5 flex justify-between items-center">
            <span className="text-muted-foreground">Today's P&amp;L <span className="opacity-60">(vs open)</span></span>
            <span className={`font-semibold font-mono flex items-center gap-0.5 ${todayUp ? "text-green-400" : "text-red-400"}`}>
              {todayUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {todayUp ? "+" : "-"}{formatCurrency(Math.abs(h.todayPnl))}
              <span className="text-[10px] opacity-70 ml-0.5">({todayUp ? "+" : ""}{h.todayPnlPct.toFixed(1)}%)</span>
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Overall P&amp;L <span className="opacity-60">(vs buy)</span></span>
            <span className={`font-semibold font-mono flex items-center gap-0.5 ${overallUp ? "text-green-400" : "text-red-400"}`}>
              {overallUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {overallUp ? "+" : "-"}{formatCurrency(Math.abs(h.overallPnl))}
              <span className="text-[10px] opacity-70 ml-0.5">({overallUp ? "+" : ""}{h.overallPnlPct.toFixed(1)}%)</span>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function Portfolio() {
  const [holdings, setHoldings]   = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState<null | {
    mode: "buy" | "sell"; symbol?: string; maxQty?: number; currentPrice?: number;
  }>(null);

  const fetchHoldings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/portfolio/holdings");
      setHoldings(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHoldings(); }, [fetchHoldings]);

  const totalTodayPnl   = holdings.reduce((s, h) => s + h.todayPnl, 0);
  const totalOverallPnl = holdings.reduce((s, h) => s + h.overallPnl, 0);
  const totalInvested   = holdings.reduce((s, h) => s + h.invested, 0);
  const totalCurrent    = holdings.reduce((s, h) => s + h.currentValue, 0);

  return (
    <div className="space-y-6">
      {modal && (
        <TradeModal
          {...modal}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); fetchHoldings(); }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Portfolio</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your holdings — buy price vs current price, today's &amp; overall P&amp;L
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchHoldings}
            className="flex items-center gap-1.5 text-xs border border-border rounded-lg px-3 py-2 hover:bg-muted/40 transition-colors"
          >
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
          <button
            onClick={() => setModal({ mode: "buy" })}
            className="flex items-center gap-1.5 text-xs bg-green-600 hover:bg-green-500 text-white rounded-lg px-3 py-2 transition-colors font-medium"
          >
            <ShoppingCart className="h-3 w-3" /> Buy Stock
          </button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Invested",      value: formatCurrency(totalInvested),   cls: "" },
          { label: "Current Value", value: formatCurrency(totalCurrent),    cls: "" },
          {
            label: "Today's P&L",
            value: `${totalTodayPnl >= 0 ? "+" : ""}${formatCurrency(totalTodayPnl)}`,
            cls: totalTodayPnl >= 0 ? "text-green-400" : "text-red-400",
          },
          {
            label: "Overall P&L",
            value: `${totalOverallPnl >= 0 ? "+" : ""}${formatCurrency(totalOverallPnl)}`,
            cls: totalOverallPnl >= 0 ? "text-green-400" : "text-red-400",
          },
        ].map(s => (
          <div key={s.label} className="bg-card/60 border border-border/50 rounded-xl p-3">
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className={`text-lg font-bold font-mono mt-0.5 ${s.cls}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Holdings grid */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      ) : holdings.length === 0 ? (
        <Card className="bg-card/40">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ShoppingCart className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <div className="text-base font-semibold">No holdings yet</div>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Buy your first stock to start tracking P&amp;L
            </p>
            <button
              onClick={() => setModal({ mode: "buy" })}
              className="text-sm bg-primary text-primary-foreground rounded-lg px-4 py-2 hover:opacity-90 transition-opacity"
            >
              Buy a Stock
            </button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {holdings.map(h => (
            <HoldingCard
              key={h.id}
              h={h}
              onSell={() => setModal({
                mode: "sell",
                symbol: h.symbol,
                maxQty: h.quantity,
                currentPrice: h.currentPrice,
              })}
            />
          ))}
        </div>
      )}

      {/* P&L formula reminder */}
      <Card className="bg-card/30 border-border/30">
        <CardContent className="py-4 px-5">
          <div className="flex flex-wrap gap-6 text-xs text-muted-foreground">
            <div>
              <span className="text-foreground font-semibold">Today's P&amp;L</span>
              {" "}= (Current Price − Day Open Price) × Quantity
            </div>
            <div>
              <span className="text-foreground font-semibold">Overall P&amp;L</span>
              {" "}= (Current Price − Avg Buy Price) × Quantity
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
