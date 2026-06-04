import { useGetCurrentRegime, getGetCurrentRegimeQueryKey, useGetRegimeHistory, getGetRegimeHistoryQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RegimeBadge } from "@/components/badges";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function Regime() {
  const { data: currentRegime, isLoading: rLoad } = useGetCurrentRegime({ query: { queryKey: getGetCurrentRegimeQueryKey() } });
  const { data: history, isLoading: hLoad } = useGetRegimeHistory({ query: { queryKey: getGetRegimeHistoryQueryKey() } });

  if (rLoad || hLoad) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Market Regime Analysis</h1>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1 border-primary/20 shadow-lg shadow-primary/5">
          <CardHeader>
            <CardTitle>Current Regime</CardTitle>
            <CardDescription>HMM/GMM Classification</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              {currentRegime && <RegimeBadge regime={currentRegime.regime} confidence={currentRegime.confidence} />}
            </div>
            <div className="text-sm text-muted-foreground pt-4 border-t">
              <p className="font-semibold text-foreground mb-1">Characteristics:</p>
              <p>{currentRegime?.description}</p>
            </div>
            <div className="text-sm text-muted-foreground pt-4 border-t">
              <p className="font-semibold text-foreground mb-1">Recommended Allocation:</p>
              <p>{currentRegime?.allocationStrategy}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Regime Probability Timeline</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" tickLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" tickLine={false} tickFormatter={v => `${(v*100).toFixed(0)}%`} />
                <Tooltip />
                <Area type="step" dataKey="confidence" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}