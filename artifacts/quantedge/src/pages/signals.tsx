import React, { useState } from "react";
import { useGetSignals, getGetSignalsQueryKey } from "@workspace/api-client-react";
import { formatPercentage } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActionBadge, RegimeBadge } from "@/components/badges";
import { Link } from "wouter";
import { ChevronDown, ChevronUp, BarChart3, Shield, Brain } from "lucide-react";

export default function Signals() {
  const { data: signals, isLoading } = useGetSignals({ query: { queryKey: getGetSignalsQueryKey() } });
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [explanations, setExplanations] = useState<Record<number, any>>({});
  const [loadingExpl, setLoadingExpl] = useState<Record<number, boolean>>({});

  const toggleExpand = async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    
    setExpandedId(id);
    
    if (!explanations[id]) {
      setLoadingExpl(prev => ({ ...prev, [id]: true }));
      try {
        const token = localStorage.getItem("quantedge_token");
        const r = await fetch(`/api/signals/${id}/explain`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (r.ok) {
          const data = await r.json();
          setExplanations(prev => ({ ...prev, [id]: data }));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingExpl(prev => ({ ...prev, [id]: false }));
      }
    }
  };

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
                <TableHead className="w-[200px]">Contributions</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {signals?.map(signal => (
                <React.Fragment key={signal.id}>
                  <TableRow 
                    className="cursor-pointer hover:bg-muted/10"
                    onClick={() => toggleExpand(signal.id)}
                  >
                    <TableCell className="font-bold">
                      <span className="hover:text-primary">{signal.symbol}</span>
                    </TableCell>
                    <TableCell><ActionBadge action={signal.action} /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${signal.confidence > 0.7 ? 'bg-green-400' : signal.confidence > 0.4 ? 'bg-yellow-400' : 'bg-red-400'}`} 
                            style={{ width: `${signal.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{(signal.confidence * 100).toFixed(0)}%</span>
                      </div>
                    </TableCell>
                    <TableCell className={signal.forecastReturn > 0 ? 'text-green-400' : 'text-red-400'}>
                      {signal.forecastReturn > 0 ? '+' : ''}{formatPercentage(signal.forecastReturn)}
                    </TableCell>
                    <TableCell>
                      <RegimeBadge regime={signal.regime} />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-full flex rounded-sm overflow-hidden border border-border/50" title={`ARIMA: ${formatPercentage(signal.arimaContribution)} | LSTM: ${formatPercentage(signal.lstmContribution)} | XGBoost: ${formatPercentage(signal.xgboostContribution)}`}>
                        <div className="bg-blue-500" style={{ width: `${(signal.arimaContribution || 0) * 100}%` }} />
                        <div className="bg-purple-500" style={{ width: `${(signal.lstmContribution || 0) * 100}%` }} />
                        <div className="bg-orange-500" style={{ width: `${(signal.xgboostContribution || 0) * 100}%` }} />
                      </div>
                    </TableCell>
                    <TableCell>
                      {expandedId === signal.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </TableCell>
                  </TableRow>
                  
                  {expandedId === signal.id && (
                    <TableRow className="bg-muted/5 border-b border-border/30">
                      <TableCell colSpan={7} className="p-0">
                        <div className="p-6">
                          {loadingExpl[signal.id] ? (
                            <div className="animate-pulse flex space-x-4">
                              <div className="flex-1 space-y-4 py-1">
                                <div className="h-2 bg-muted rounded w-3/4"></div>
                                <div className="space-y-2">
                                  <div className="h-2 bg-muted rounded"></div>
                                  <div className="h-2 bg-muted rounded w-5/6"></div>
                                </div>
                              </div>
                            </div>
                          ) : explanations[signal.id] ? (
                            <div className="grid md:grid-cols-2 gap-6">
                              {/* Left Column: Breakdowns */}
                              <div className="space-y-6">
                                {/* Model Breakdown */}
                                <div>
                                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                    <BarChart3 className="h-4 w-4 text-primary" />
                                    Model Breakdown
                                  </div>
                                  <div className="space-y-3">
                                    {Object.entries(explanations[signal.id].modelBreakdown || {}).map(([key, model]: [string, any]) => {
                                      const isArima = key === "arima";
                                      const isLSTM = key === "neuralNet";
                                      const isXGB = key === "xgboost";
                                      const color = isArima ? "bg-blue-500" : isLSTM ? "bg-purple-500" : "bg-orange-500";
                                      
                                      return (
                                        <div key={key} className="bg-muted/20 rounded-lg p-3">
                                          <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                              <div className={`w-2 h-2 rounded-full ${color}`} />
                                              <span className="font-semibold text-sm">{model.name}</span>
                                            </div>
                                            <span className="font-mono text-xs font-bold">{model.weight}%</span>
                                          </div>
                                          <p className="text-xs text-muted-foreground leading-relaxed">
                                            {model.contribution}
                                          </p>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>

                              {/* Right Column: Reasoning & Context */}
                              <div className="space-y-6">
                                {/* Explanation Summary */}
                                <div>
                                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                    <Brain className="h-4 w-4 text-primary" />
                                    Ensemble Reasoning
                                  </div>
                                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                                    <p className="text-sm leading-relaxed text-foreground/90">
                                      {explanations[signal.id].ensembleReasoning}
                                    </p>
                                  </div>
                                </div>

                                {/* Regime Impact */}
                                <div>
                                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                    <Shield className="h-4 w-4 text-primary" />
                                    Regime Impact
                                  </div>
                                  <div className="bg-muted/20 border border-border/40 rounded-lg p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="text-xs text-muted-foreground">Current Market:</span>
                                      <RegimeBadge regime={explanations[signal.id].regimeImpact.regime} />
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                                      {explanations[signal.id].regimeImpact.effect}
                                    </p>
                                    <p className="text-xs font-medium text-foreground">
                                      Strategy: {explanations[signal.id].regimeImpact.strategy}
                                    </p>
                                  </div>
                                </div>
                                
                                {/* Risk Factors */}
                                {explanations[signal.id].riskFactors && explanations[signal.id].riskFactors.length > 0 && (
                                  <div>
                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                      Risk Assessment
                                    </div>
                                    <ul className="space-y-1.5">
                                      {explanations[signal.id].riskFactors.map((risk: string, i: number) => (
                                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                                          <span className="text-yellow-500 mt-0.5">•</span>
                                          <span className="leading-relaxed">{risk}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground">Failed to load explanation</div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}