import { useGetPortfolioAnalytics, getGetPortfolioAnalyticsQueryKey, useGetTradingAnalytics, getGetTradingAnalyticsQueryKey, useGetCorrelationAnalytics, getGetCorrelationAnalyticsQueryKey, useGetForecastComparison, getGetForecastComparisonQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPercentage, formatCurrency } from "@/lib/format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, ScatterChart, Scatter, ZAxis } from "recharts";

export default function Analytics() {
  const { data: portfolioAnal, isLoading: pLoad } = useGetPortfolioAnalytics({ query: { queryKey: getGetPortfolioAnalyticsQueryKey() } });
  const { data: tradingAnal, isLoading: tLoad } = useGetTradingAnalytics({ query: { queryKey: getGetTradingAnalyticsQueryKey() } });
  const { data: corrAnal, isLoading: cLoad } = useGetCorrelationAnalytics({ query: { queryKey: getGetCorrelationAnalyticsQueryKey() } });
  const { data: forecastComp, isLoading: fLoad } = useGetForecastComparison({ query: { queryKey: getGetForecastComparisonQueryKey() } });

  if (pLoad || tLoad || cLoad || fLoad) return <div><Skeleton className="h-64" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Analytics Lab</h1>

      <Tabs defaultValue="portfolio">
        <TabsList>
          <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
          <TabsTrigger value="trading">Trading</TabsTrigger>
          <TabsTrigger value="correlation">Correlation</TabsTrigger>
          <TabsTrigger value="forecast">Forecast Comparison</TabsTrigger>
        </TabsList>

        <TabsContent value="portfolio" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Growth Curve</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={portfolioAnal?.growthCurve}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" tickLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" tickLine={false} tickFormatter={v => `₹${v/1000}k`} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))' }} />
                    <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Efficient Frontier</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" dataKey="risk" name="Risk" stroke="hsl(var(--muted-foreground))" tickFormatter={v => `${(v*100).toFixed(0)}%`} />
                    <YAxis type="number" dataKey="return" name="Return" stroke="hsl(var(--muted-foreground))" tickFormatter={v => `${(v*100).toFixed(0)}%`} />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                    <Scatter name="Portfolios" data={portfolioAnal?.efficientFrontier} fill="hsl(var(--chart-1))" />
                  </ScatterChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trading" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Strategy Comparison</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Strategy</TableHead>
                    <TableHead>Total Return</TableHead>
                    <TableHead>Win Rate</TableHead>
                    <TableHead>Profit Factor</TableHead>
                    <TableHead>Sharpe</TableHead>
                    <TableHead>Max Drawdown</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tradingAnal?.strategies.map(s => (
                    <TableRow key={s.name}>
                      <TableCell className="font-bold">{s.name}</TableCell>
                      <TableCell className={s.totalReturn > 0 ? 'text-chart-1' : 'text-destructive'}>{formatPercentage(s.totalReturn)}</TableCell>
                      <TableCell>{formatPercentage(s.winRate)}</TableCell>
                      <TableCell>{s.profitFactor.toFixed(2)}</TableCell>
                      <TableCell>{s.sharpeRatio.toFixed(2)}</TableCell>
                      <TableCell className="text-destructive">-{formatPercentage(s.maxDrawdown)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="correlation" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Sector Exposure</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={corrAnal?.sectorExposure} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={true} vertical={false} />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" tickFormatter={v => `${(v*100).toFixed(0)}%`} />
                  <YAxis dataKey="sector" type="category" width={100} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip cursor={{fill: 'hsl(var(--accent))'}} />
                  <Bar dataKey="weight" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forecast" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Model Accuracy Metrics</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>RMSE</TableHead>
                    <TableHead>MAE</TableHead>
                    <TableHead>R²</TableHead>
                    <TableHead>Dir. Accuracy</TableHead>
                    <TableHead>Win Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {forecastComp?.metrics.map(m => (
                    <TableRow key={m.model}>
                      <TableCell className="font-bold">{m.model}</TableCell>
                      <TableCell>{m.avgRmse.toFixed(4)}</TableCell>
                      <TableCell>{m.avgMae.toFixed(4)}</TableCell>
                      <TableCell>{m.avgR2.toFixed(4)}</TableCell>
                      <TableCell>{formatPercentage(m.avgDirectionalAccuracy)}</TableCell>
                      <TableCell>{formatPercentage(m.winRate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}