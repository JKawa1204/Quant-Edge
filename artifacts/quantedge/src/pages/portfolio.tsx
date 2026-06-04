import { useGetPortfolio, getGetPortfolioQueryKey, useGetPortfolioHealth, getGetPortfolioHealthQueryKey, useGetPortfolioPerformance, getGetPortfolioPerformanceQueryKey, useGetPortfolioRisk, getGetPortfolioRiskQueryKey, useGetPortfolioOptimization, getGetPortfolioOptimizationQueryKey, useGetHoldings, getGetHoldingsQueryKey } from "@workspace/api-client-react";
import { formatCurrency, formatPercentage, getColorForValue } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ActionBadge } from "@/components/badges";
import { Link } from "wouter";

export default function Portfolio() {
  const { data: portfolio, isLoading: isPortfolioLoading } = useGetPortfolio({ query: { queryKey: getGetPortfolioQueryKey() } });
  const { data: health } = useGetPortfolioHealth({ query: { queryKey: getGetPortfolioHealthQueryKey() } });
  const { data: performance } = useGetPortfolioPerformance({ query: { queryKey: getGetPortfolioPerformanceQueryKey() } });
  const { data: risk } = useGetPortfolioRisk({ query: { queryKey: getGetPortfolioRiskQueryKey() } });
  const { data: optimization } = useGetPortfolioOptimization({ query: { queryKey: getGetPortfolioOptimizationQueryKey() } });
  const { data: holdings, isLoading: isHoldingsLoading } = useGetHoldings({ query: { queryKey: getGetHoldingsQueryKey() } });

  if (isPortfolioLoading || isHoldingsLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Portfolio</h1>
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Portfolio</h1>
        <div className="flex items-center gap-4">
          <div className="text-sm">
            <span className="text-muted-foreground mr-2">Health Score:</span>
            <span className="font-bold text-lg text-primary">{health?.score.toFixed(0)}/100</span>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground mr-2">Grade:</span>
            <span className="font-bold text-lg">{health?.grade}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(portfolio?.totalValue)}</div>
            <p className="text-xs text-muted-foreground mt-1">Cash: {formatCurrency(portfolio?.cash)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total PnL</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getColorForValue(portfolio?.totalPnl)}`}>
              {portfolio?.totalPnl && portfolio.totalPnl > 0 ? '+' : ''}{formatCurrency(portfolio?.totalPnl)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{formatPercentage(portfolio?.returnPct)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sharpe Ratio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{risk?.sharpeRatio.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Volatility: {formatPercentage(risk?.volatility)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Max Drawdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">-{formatPercentage(risk?.maxDrawdown)}</div>
            <p className="text-xs text-muted-foreground mt-1">Beta: {risk?.beta.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Equity Curve</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={performance}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val/1000}k`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(value: number) => [formatCurrency(value), 'Value']}
                  />
                  <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorValue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Optimization Suggestions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Expected Return:</span>
                <span className="font-medium text-chart-1">{formatPercentage(optimization?.expectedReturn)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Expected Risk:</span>
                <span className="font-medium text-chart-4">{formatPercentage(optimization?.expectedRisk)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Target Sharpe:</span>
                <span className="font-medium">{optimization?.sharpeRatio.toFixed(2)}</span>
              </div>
              
              <div className="mt-4 pt-4 border-t">
                <h4 className="text-sm font-medium mb-2">Rebalancing</h4>
                <ul className="text-xs space-y-2 text-muted-foreground">
                  {optimization?.rebalancingSuggestions.slice(0, 4).map((s, i) => (
                    <li key={i} className="flex gap-2"><span className="text-primary">•</span> {s}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Holdings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Avg Price</TableHead>
                  <TableHead>LTP</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>PnL</TableHead>
                  <TableHead>Weight</TableHead>
                  <TableHead>Rec</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holdings?.map((holding) => (
                  <TableRow key={holding.id}>
                    <TableCell className="font-medium">
                      <Link href={`/stocks/${holding.symbol}`} className="hover:underline hover:text-primary">
                        {holding.symbol}
                      </Link>
                    </TableCell>
                    <TableCell>{holding.quantity}</TableCell>
                    <TableCell>{formatCurrency(holding.buyPrice)}</TableCell>
                    <TableCell>{formatCurrency(holding.currentPrice)}</TableCell>
                    <TableCell>{formatCurrency(holding.currentPrice * holding.quantity)}</TableCell>
                    <TableCell className={getColorForValue(holding.pnl)}>
                      {formatCurrency(holding.pnl)} ({formatPercentage(holding.returnPct)})
                    </TableCell>
                    <TableCell>{formatPercentage(holding.allocationPct)}</TableCell>
                    <TableCell><ActionBadge action={holding.recommendation} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}