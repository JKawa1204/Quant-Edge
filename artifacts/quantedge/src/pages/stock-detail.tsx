import { useParams } from "wouter";
import { useGetStockDetail, getGetStockDetailQueryKey, useListStockCandles, getListStockCandlesQueryKey, useGetForecasts, getGetForecastsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatPercentage, formatNumber, getColorForValue } from "@/lib/format";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ActionBadge } from "@/components/badges";

export default function StockDetail() {
  const { symbol } = useParams();
  const { data: stock, isLoading: sLoad } = useGetStockDetail(symbol || '', { query: { queryKey: getGetStockDetailQueryKey(symbol || ''), enabled: !!symbol } });
  const { data: candles, isLoading: cLoad } = useListStockCandles(symbol || '', { timeframe: '1D' }, { query: { queryKey: getListStockCandlesQueryKey(symbol || '', { timeframe: '1D' }), enabled: !!symbol } });
  const { data: forecast, isLoading: fLoad } = useGetForecasts(symbol || '', { query: { queryKey: getGetForecastsQueryKey(symbol || ''), enabled: !!symbol } });

  if (sLoad || cLoad || fLoad) return <div>Loading...</div>;

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
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Price Action & Forecast</CardTitle>
            {forecast?.ensemble && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Ensemble Signal:</span>
                <ActionBadge action={forecast.ensemble.direction === 'UP' ? 'BUY' : forecast.ensemble.direction === 'DOWN' ? 'SELL' : 'HOLD'} />
              </div>
            )}
          </CardHeader>
          <CardContent className="h-[400px]">
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
    </div>
  );
}