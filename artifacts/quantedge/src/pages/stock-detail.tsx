import { useParams } from "wouter";
import { useState, useEffect } from "react";
import { useGetStockDetail, getGetStockDetailQueryKey, useListStockCandles, getListStockCandlesQueryKey, useGetForecasts, getGetForecastsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatPercentage, formatNumber, getColorForValue } from "@/lib/format";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ActionBadge } from "@/components/badges";
import { Skeleton } from "@/components/ui/skeleton";

const TIMEFRAMES = ["1D", "1W", "1M", "3M", "6M", "1Y", "3Y", "5Y"];

export default function StockDetail() {
  const { symbol } = useParams();
  const [timeframe, setTimeframe] = useState("1D");
  const [features, setFeatures] = useState<any>(null);
  const [aiInsight, setAiInsight] = useState<string | null>(null);

  const { data: stock, isLoading: sLoad } = useGetStockDetail(symbol || '', { query: { queryKey: getGetStockDetailQueryKey(symbol || ''), enabled: !!symbol } });
  const { data: candles, isLoading: cLoad } = useListStockCandles(symbol || '', timeframe, { query: { queryKey: getListStockCandlesQueryKey(symbol || '', timeframe), enabled: !!symbol } });
  const { data: forecast, isLoading: fLoad } = useGetForecasts(symbol || '', { query: { queryKey: getGetForecastsQueryKey(symbol || ''), enabled: !!symbol } });

  // 2-second delay to fetch feature engineering
  useEffect(() => {
    if (!symbol) return;
    const t = setTimeout(() => {
      fetch(`/api/stocks/${symbol}/feature-engineering`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem('token')}` }
      })
      .then(r => r.json())
      .then(d => { if (!d.error) setFeatures(d); })
      .catch(console.error);
    }, 2000);
    return () => clearTimeout(t);
  }, [symbol]);

  // 3-second delay to fetch Gemini insights
  useEffect(() => {
    if (!symbol) return;
    const t = setTimeout(() => {
      fetch(`/api/ai/commentary`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          type: "stock", 
          symbol: symbol,
          context: `Analyze the current performance and indicators for ${symbol}.`
        })
      })
      .then(r => r.json())
      .then(d => { if (d.text) setAiInsight(d.text); })
      .catch(console.error);
    }, 3000);
    return () => clearTimeout(t);
  }, [symbol]);

  if (sLoad || fLoad) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{stock?.symbol}</h1>
          <p className="text-muted-foreground">{stock?.company} • {stock?.sector}</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold font-mono">{formatCurrency(stock?.currentPrice)}</div>
          <div className={`font-mono ${getColorForValue(stock?.change)}`}>
            {stock?.change && stock.change > 0 ? '+' : ''}{formatCurrency(stock?.change)} ({formatPercentage(stock?.changePct)})
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>Price Action</CardTitle>
            <div className="flex items-center gap-1 bg-muted p-1 rounded-md">
              {TIMEFRAMES.map(tf => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-3 py-1 text-xs font-medium rounded-sm transition-all ${timeframe === tf ? 'bg-background shadow-sm' : 'text-muted-foreground hover:bg-background/50'}`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="h-[400px]">
            {cLoad ? (
              <div className="h-full w-full flex items-center justify-center text-muted-foreground">Loading chart...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={candles}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" tickLine={false} tickFormatter={v => v.split('T')[0]} />
                <YAxis domain={['auto', 'auto']} stroke="hsl(var(--muted-foreground))" tickLine={false} tickFormatter={v => `₹${v}`} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))' }} />
                {/* Simplified candlestick visualization using composed chart */}
                <Bar dataKey="close" fill="hsl(var(--primary))" opacity={0.5} />
                <Line type="monotone" dataKey="close" stroke="hsl(var(--primary))" dot={false} strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Forecast Models</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {['arima', 'lstm', 'xgboost', 'ensemble'].map((model) => {
                const f = forecast?.[model as keyof typeof forecast] as any;
                if (!f) return null;
                return (
                  <div key={model} className="flex items-center justify-between text-sm">
                    <span className="capitalize font-medium">{model}</span>
                    <div className="flex items-center gap-4">
                      <span className={f.direction === 'UP' ? 'text-chart-1' : 'text-destructive'}>
                        {f.direction}
                      </span>
                      <span className="text-muted-foreground w-12 text-right">
                        {(f.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                );
              })}
              <div className="pt-4 border-t text-sm flex justify-between">
                <span className="text-muted-foreground">Agreement Score</span>
                <span className="font-bold">{(forecast?.modelAgreement ? forecast.modelAgreement * 100 : 0).toFixed(0)}%</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Key Metrics</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Market Cap</div>
                <div className="font-medium font-mono">{formatNumber(stock?.marketCap)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">P/E Ratio</div>
                <div className="font-medium font-mono">{stock?.pe.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Beta</div>
                <div className="font-medium font-mono">{stock?.beta.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Volume</div>
                <div className="font-medium font-mono">{formatNumber(stock?.currentVolume)}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              Gemini AI Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!aiInsight ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[90%]" />
                <Skeleton className="h-4 w-[80%]" />
                <p className="text-xs text-muted-foreground mt-4 italic">Gemini is analyzing the asset...</p>
              </div>
            ) : (
              <p className="text-sm leading-relaxed">{aiInsight}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Feature Engineering Indicators</CardTitle>
          </CardHeader>
          <CardContent>
            {!features ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <p className="text-xs text-muted-foreground mt-4 italic">Generating 5-year technicals...</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">RSI (14)</div>
                  <div className="font-mono font-medium">{features.latest.rsi ? features.latest.rsi.toFixed(2) : 'N/A'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">MACD</div>
                  <div className="font-mono font-medium">{features.latest.macd?.MACD ? features.latest.macd.MACD.toFixed(2) : 'N/A'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">VWAP</div>
                  <div className="font-mono font-medium">{features.latest.vwap ? formatCurrency(features.latest.vwap) : 'N/A'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">SMA (20)</div>
                  <div className="font-mono font-medium">{features.latest.sma ? formatCurrency(features.latest.sma) : 'N/A'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">EMA (20)</div>
                  <div className="font-mono font-medium">{features.latest.ema ? formatCurrency(features.latest.ema) : 'N/A'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">BB Width</div>
                  <div className="font-mono font-medium">{features.latest.bollinger ? ((features.latest.bollinger.upper - features.latest.bollinger.lower) / features.latest.bollinger.middle * 100).toFixed(2) + '%' : 'N/A'}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}