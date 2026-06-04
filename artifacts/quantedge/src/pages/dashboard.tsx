import { useGetDashboardSummary, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { formatCurrency, formatPercentage, getColorForValue } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RegimeBadge } from "@/components/badges";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, DollarSign, TrendingUp, TrendingDown, Target, BrainCircuit } from "lucide-react";

export default function Dashboard() {
  const { data: summary, isLoading } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey() }
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Executive Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Executive Dashboard</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Regime:</span>
          {summary?.regime && <RegimeBadge regime={summary.regime} />}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Portfolio Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary?.portfolioValue)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Available Cash: {formatCurrency(summary?.availableCash)}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's PnL</CardTitle>
            {summary?.todayPnl && summary.todayPnl > 0 ? (
              <TrendingUp className="h-4 w-4 text-chart-1" />
            ) : (
              <TrendingDown className="h-4 w-4 text-destructive" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getColorForValue(summary?.todayPnl)}`}>
              {summary?.todayPnl && summary.todayPnl > 0 ? '+' : ''}{formatCurrency(summary?.todayPnl)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatPercentage(summary?.todayPnlPct)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overall PnL</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getColorForValue(summary?.overallPnl)}`}>
              {summary?.overallPnl && summary.overallPnl > 0 ? '+' : ''}{formatCurrency(summary?.overallPnl)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatPercentage(summary?.overallPnlPct)} All Time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Signals</CardTitle>
            <Target className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.activeSignalsCount || 0}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <BrainCircuit className="h-3 w-3" />
              Best: {summary?.bestModel}
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Additional dashboard content would go here */}
    </div>
  );
}