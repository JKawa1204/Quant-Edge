import { useGetSignals, getGetSignalsQueryKey } from "@workspace/api-client-react";
import { formatPercentage } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActionBadge, RegimeBadge } from "@/components/badges";
import { Link } from "wouter";

export default function Signals() {
  const { data: signals, isLoading } = useGetSignals({ query: { queryKey: getGetSignalsQueryKey() } });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Active Signals</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Algorithmic Trading Signals</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Forecast Return</TableHead>
                <TableHead>Regime</TableHead>
                <TableHead className="w-[300px]">Model Contributions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {signals?.map(signal => (
                <TableRow key={signal.id}>
                  <TableCell className="font-bold">
                    <Link href={`/stocks/${signal.symbol}`} className="hover:text-primary hover:underline">
                      {signal.symbol}
                    </Link>
                  </TableCell>
                  <TableCell><ActionBadge action={signal.action} /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${signal.confidence > 0.7 ? 'bg-chart-1' : signal.confidence > 0.4 ? 'bg-chart-3' : 'bg-destructive'}`} 
                          style={{ width: `${signal.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{(signal.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </TableCell>
                  <TableCell className={signal.forecastReturn > 0 ? 'text-chart-1' : 'text-destructive'}>
                    {signal.forecastReturn > 0 ? '+' : ''}{formatPercentage(signal.forecastReturn)}
                  </TableCell>
                  <TableCell>
                    <RegimeBadge regime={signal.regime} />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-full flex rounded-sm overflow-hidden border border-border/50" title={`ARIMA: ${formatPercentage(signal.arimaContribution)} | LSTM: ${formatPercentage(signal.lstmContribution)} | XGBoost: ${formatPercentage(signal.xgboostContribution)}`}>
                      <div className="bg-chart-1" style={{ width: `${(signal.arimaContribution || 0) * 100}%` }} />
                      <div className="bg-chart-2" style={{ width: `${(signal.lstmContribution || 0) * 100}%` }} />
                      <div className="bg-chart-4" style={{ width: `${(signal.xgboostContribution || 0) * 100}%` }} />
                      <div className="bg-chart-3" style={{ width: `${(signal.regimeContribution || 0) * 100}%` }} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}