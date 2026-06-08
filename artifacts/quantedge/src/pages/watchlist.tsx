import { useState, useEffect } from "react";
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
  const [activeTab, setActiveTab] = useState<string>("all");
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [allStocks, setAllStocks] = useState<any[]>([]);
  const [mlSignals, setMlSignals] = useState<Record<string, any>>({});

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const token = localStorage.getItem("quantedge_token");
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        const baseUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL : "";
        const res = await fetch(`${baseUrl}/api/stocks/search?q=`, { headers });
        if (res.ok) {
          const data = await res.json();
          setAllStocks(data);
          
          // Fetch sequentially to prevent backend overload and provide progressive UI updates
          const topSymbols = data.slice(0, 15).map((s: any) => s.symbol);
          const signalMap: Record<string, any> = {};
          
          for (const sym of topSymbols) {
            try {
              const mlRes = await fetch(`${baseUrl}/api/signals?symbols=${sym}`, { headers });
              if (mlRes.ok) {
                const mlData = await mlRes.json();
                if (mlData && mlData.length > 0) {
                  const item = mlData[0];
                  signalMap[item.symbol.replace(".NS", "")] = item;
                  // Update state immediately so UI reflects progress
                  setMlSignals({ ...signalMap });
                }
              }
              // Wait 1 second before querying the next stock
              await new Promise(r => setTimeout(r, 1000));
            } catch (err) {
              console.error(`Failed to fetch ML signal for ${sym}`, err);
            }
          }
        }
      } catch (e) {
        console.error("Failed to fetch all stocks", e);
      }
    };
    fetchAll();
  }, []);

  useEffect(() => {
    let wsUrl = "ws://localhost:3000/";
    if (import.meta.env.VITE_WS_URL) {
      wsUrl = import.meta.env.VITE_WS_URL;
    } else if (window.location.hostname !== "localhost") {
      wsUrl = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/`;
    }
      
    const ws = new WebSocket(wsUrl);
    
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "PRICE_UPDATE") {
          const { symbol, price } = msg.data;
          setLivePrices(prev => ({ ...prev, [symbol]: price }));
        }
      } catch (e) {
        console.error("WebSocket decode error", e);
      }
    };

    return () => ws.close();
  }, []);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  const combinedWatchlists = [
    {
      id: "all",
      name: "All Shares",
      stocks: allStocks.map(s => {
        const sig = mlSignals[s.symbol] || mlSignals[s.symbol.replace(".NS", "")];
        return {
          id: s.symbol,
          symbol: s.symbol,
          company: s.company,
          price: s.price || 0,
          change: s.change || 0,
          changePct: s.changePct || 0,
          volume: s.volume || 0,
          forecastDirection: sig?.action === "BUY" ? "UP" : sig?.action === "SELL" ? "DOWN" : "UNKNOWN",
          signal: sig?.action || "HOLD",
          forecastReturn: sig?.forecastReturn || 0,
          confidence: sig?.confidence || 0
        };
      })
    },
    ...(watchlists || []).map((w: any) => ({
      ...w,
      stocks: w.stocks.map((s: any) => {
        const sig = mlSignals[s.symbol] || mlSignals[s.symbol.replace(".NS", "")];
        return {
          ...s,
          forecastDirection: sig?.action === "BUY" ? "UP" : sig?.action === "SELL" ? "DOWN" : "UNKNOWN",
          signal: sig?.action || "HOLD",
          forecastReturn: sig?.forecastReturn || 0,
          confidence: sig?.confidence || 0
        };
      })
    }))
  ];

  const activeWatchlist = combinedWatchlists.find(w => w.id.toString() === activeTab) || combinedWatchlists[0];

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
          <Tabs defaultValue="all" onValueChange={setActiveTab}>
            <div className="border-b px-4">
              <TabsList className="bg-transparent h-12">
                {combinedWatchlists.map(w => (
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
            
            {combinedWatchlists.map(w => (
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
                    {w.stocks.map(stock => {
                      const currentPrice = livePrices[stock.symbol] || stock.price;
                      return (
                      <TableRow key={stock.id}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <Link href={`/stocks/${stock.symbol}`} className="hover:text-primary hover:underline">
                              {stock.symbol}
                            </Link>
                            <span className="text-xs text-muted-foreground">{stock.company}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono">{formatCurrency(currentPrice)}</TableCell>
                        <TableCell className={`font-mono ${getColorForValue(stock.change)}`}>
                          {stock.change > 0 ? '+' : ''}{formatCurrency(stock.change)} ({stock.change > 0 ? '+' : ''}{formatPercentage(stock.changePct)})
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatNumber(stock.volume)}</TableCell>
                        <TableCell>
                          {!mlSignals[stock.symbol] && !mlSignals[stock.symbol.replace(".NS", "")] ? (
                             <div className="flex items-center gap-2 text-muted-foreground text-xs animate-pulse">
                               <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                               Analyzing...
                             </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              {stock.forecastDirection === 'UP' ? <TrendingUp className="h-4 w-4 text-chart-1" /> : 
                               stock.forecastDirection === 'DOWN' ? <TrendingDown className="h-4 w-4 text-destructive" /> : 
                               <Minus className="h-4 w-4 text-muted-foreground" />}
                              <span className="text-sm capitalize">{stock.forecastDirection.toLowerCase()}</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {!mlSignals[stock.symbol] && !mlSignals[stock.symbol.replace(".NS", "")] ? (
                             <span className="text-xs text-muted-foreground">Pending</span>
                          ) : (
                             <ActionBadge action={stock.signal} />
                          )}
                        </TableCell>
                        <TableCell>
                          {!mlSignals[stock.symbol] && !mlSignals[stock.symbol.replace(".NS", "")] ? (
                             <span className="text-xs text-muted-foreground">-</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${stock.confidence > 70 ? 'bg-chart-1' : stock.confidence > 40 ? 'bg-chart-3' : 'bg-destructive'}`} 
                                  style={{ width: `${stock.confidence}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground">{(stock.confidence).toFixed(0)}%</span>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )})}
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