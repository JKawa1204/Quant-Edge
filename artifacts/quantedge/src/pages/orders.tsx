import { useGetOrders, getGetOrdersQueryKey } from "@workspace/api-client-react";
import { formatCurrency, formatNumber } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import { format } from "date-fns";

export default function Orders() {
  const { data: orders, isLoading } = useGetOrders({ query: { queryKey: getGetOrdersQueryKey() } });

  if (isLoading) return <div>Loading...</div>;

  const openOrders = orders?.filter(o => o.status === 'OPEN') || [];
  const executedOrders = orders?.filter(o => o.status === 'EXECUTED') || [];
  const rejectedOrders = orders?.filter(o => o.status === 'REJECTED') || [];

  const OrderTable = ({ data }: { data: typeof orders }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Time</TableHead>
          <TableHead>Symbol</TableHead>
          <TableHead>Side</TableHead>
          <TableHead>Qty</TableHead>
          <TableHead>Price</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Source</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data?.map(order => (
          <TableRow key={order.id}>
            <TableCell className="text-muted-foreground">
              {format(new Date(order.createdAt), "dd MMM HH:mm:ss")}
            </TableCell>
            <TableCell className="font-bold">
              <Link href={`/stocks/${order.symbol}`} className="hover:text-primary hover:underline">
                {order.symbol}
              </Link>
            </TableCell>
            <TableCell>
              <Badge variant="outline" className={order.side === 'BUY' ? 'text-chart-1 border-chart-1/20' : 'text-destructive border-destructive/20'}>
                {order.side}
              </Badge>
            </TableCell>
            <TableCell>{formatNumber(order.quantity)}</TableCell>
            <TableCell>{formatCurrency(order.price)}</TableCell>
            <TableCell>
              <Badge variant="secondary">{order.status}</Badge>
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">{order.signalSource}</TableCell>
          </TableRow>
        ))}
        {(!data || data.length === 0) && (
          <TableRow>
            <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
              No orders found
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Order Log</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Paper Trading Execution</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="open">
            <TabsList className="mb-4">
              <TabsTrigger value="open">Open ({openOrders.length})</TabsTrigger>
              <TabsTrigger value="executed">Executed ({executedOrders.length})</TabsTrigger>
              <TabsTrigger value="rejected">Rejected ({rejectedOrders.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="open"><OrderTable data={openOrders} /></TabsContent>
            <TabsContent value="executed"><OrderTable data={executedOrders} /></TabsContent>
            <TabsContent value="rejected"><OrderTable data={rejectedOrders} /></TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}