import { useGetBacktests, getGetBacktestsQueryKey } from "@workspace/api-client-react";
import { formatPercentage } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { format } from "date-fns";

export default function Backtests() {
  const { data: backtests, isLoading } = useGetBacktests({ query: { queryKey: getGetBacktestsQueryKey() } });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Backtesting Engine</h1>
        <Button><Plus className="h-4 w-4 mr-2" /> New Backtest</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historical Runs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Opt Method</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>CAGR</TableHead>
                <TableHead>Sharpe</TableHead>
                <TableHead>Max DD</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {backtests?.map(b => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell><Badge variant="outline">{b.forecastModel}</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-sm">{b.optimizationMethod}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(b.startDate), 'MMM yy')} - {format(new Date(b.endDate), 'MMM yy')}
                  </TableCell>
                  <TableCell className={b.cagr && b.cagr > 0 ? 'text-chart-1' : ''}>
                    {b.cagr ? formatPercentage(b.cagr) : '-'}
                  </TableCell>
                  <TableCell>{b.sharpeRatio?.toFixed(2) || '-'}</TableCell>
                  <TableCell className="text-destructive">
                    {b.maxDrawdown ? `-${formatPercentage(b.maxDrawdown)}` : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={b.status === 'COMPLETED' ? 'secondary' : 'default'} className={b.status === 'COMPLETED' ? 'bg-primary/20 text-primary' : ''}>
                      {b.status}
                    </Badge>
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