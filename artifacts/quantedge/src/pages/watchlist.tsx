import { useState } from "react";
import { useGetWatchlists, getGetWatchlistsQueryKey, useSearchStocks, getSearchStocksQueryKey, useAddToWatchlist } from "@workspace/api-client-react";
import { formatCurrency, formatPercentage, formatNumber, getColorForValue } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { ActionBadge } from "@/components/badges";
import { Link } from "wouter";

export default function Watchlist() {
  const { data: watchlists, isLoading } = useGetWatchlists({ query: { queryKey: getGetWatchlistsQueryKey() } });
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<string>("");

  if (isLoading) {
    return <div>Loading...</div>;
  }

  const activeWatchlist = watchlists?.find(w => w.id.toString() === activeTab) || watchlists?.[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Watchlist</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Add symbol..." 
              className="pl-8 w-64 bg-background"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button size="icon" variant="outline"><Plus className="h-4 w-4" /></Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Tabs defaultValue={watchlists?.[0]?.id.toString()} onValueChange={setActiveTab}>
            <div className="border-b px-4">
              <TabsList className="bg-transparent h-12">
                {watchlists?.map(w => (
                  <TabsTrigger 
                    key={w.id} 
                    value={w.id.toString()}
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4"
                  >
                    {w.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            
            {watchlists?.map(w => (
              <TabsContent key={w.id} value={w.id.toString()} className="m-0 p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Symbol</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Change</TableHead>
                      <TableHead>Volume</TableHead>
                      <TableHead>Forecast</TableHead>
                      <TableHead>Signal</TableHead>
                      <TableHead>Confidence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {w.stocks.map(stock => (
                      <TableRow key={stock.id}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <Link href={`/stocks/${stock.symbol}`} className="hover:text-primary hover:underline">
                              {stock.symbol}
                            </Link>
                            <span className="text-xs text-muted-foreground">{stock.company}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono">{formatCurrency(stock.price)}</TableCell>
                        <TableCell className={`font-mono ${getColorForValue(stock.change)}`}>
                          {stock.change > 0 ? '+' : ''}{formatCurrency(stock.change)} ({stock.change > 0 ? '+' : ''}{formatPercentage(stock.changePct)})
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatNumber(stock.volume)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {stock.forecastDirection === 'UP' ? <TrendingUp className="h-4 w-4 text-chart-1" /> : 
                             stock.forecastDirection === 'DOWN' ? <TrendingDown className="h-4 w-4 text-destructive" /> : 
                             <Minus className="h-4 w-4 text-muted-foreground" />}
                            <span className="text-sm capitalize">{stock.forecastDirection.toLowerCase()}</span>
                          </div>
                        </TableCell>
                        <TableCell><ActionBadge action={stock.signal} /></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${stock.confidence > 0.7 ? 'bg-chart-1' : stock.confidence > 0.4 ? 'bg-chart-3' : 'bg-destructive'}`} 
                                style={{ width: `${stock.confidence * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">{(stock.confidence * 100).toFixed(0)}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {w.stocks.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                          No stocks in this watchlist.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}