import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, ShieldAlert, BarChart, AlertTriangle } from "lucide-react";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

export function QuantitativeTests({ symbol }: { symbol: string }) {
  const [mcData, setMcData] = useState<any>(null);
  const [stressData, setStressData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    Promise.all([
      fetch(`${BASE}/ml/simulate/${symbol}`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${BASE}/ml/stress-test/${symbol}`).then(r => r.ok ? r.json() : null).catch(() => null)
    ]).then(([mc, stress]) => {
      if (!mounted) return;
      if (mc && !mc.error) setMcData(mc);
      if (stress && !stress.error) setStressData(stress);
      setLoading(false);
    });

    return () => { mounted = false; };
  }, [symbol]);

  if (loading) {
    return (
      <Card className="bg-card/60 border-border/50 h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" /> Quantitative Tests ({symbol})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!mcData && !stressData) return null;

  return (
    <Card className="bg-card/60 border-border/50 h-full flex flex-col">
      <CardHeader className="pb-3 border-b border-border/30">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" /> Quantitative Tests <Badge variant="outline" className="ml-2 font-mono">{symbol}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 flex-1 flex flex-col gap-4">
        
        {/* Monte Carlo Section */}
        {mcData && (
          <div className="border border-border/40 bg-card rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <BarChart className="w-4 h-4 text-blue-400" />
              <span className="font-semibold text-sm">Monte Carlo Simulation</span>
              <Badge variant="secondary" className="text-[10px] ml-auto">{mcData.simulations} paths</Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Expected bounds after {mcData.steps} days based on GBM stochastic modeling.
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-muted/30 rounded p-2">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Bear (5th)</div>
                <div className="text-sm font-mono font-medium text-red-400">
                  ₹{mcData.finalDistribution?.p5?.toFixed(1) || "N/A"}
                </div>
              </div>
              <div className="bg-muted/30 rounded p-2 border border-primary/20">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Median (50th)</div>
                <div className="text-sm font-mono font-medium text-blue-400">
                  ₹{mcData.finalDistribution?.p50?.toFixed(1) || "N/A"}
                </div>
              </div>
              <div className="bg-muted/30 rounded p-2">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Bull (95th)</div>
                <div className="text-sm font-mono font-medium text-green-400">
                  ₹{mcData.finalDistribution?.p95?.toFixed(1) || "N/A"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stress Test Section */}
        {stressData && (
          <div className="border border-border/40 bg-card rounded-lg p-3 flex-1">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="w-4 h-4 text-orange-400" />
              <span className="font-semibold text-sm">Market Stress Test</span>
              <div className={`ml-auto px-2 py-0.5 rounded text-xs font-bold ${
                stressData.vulnerabilityScore > 60 ? "bg-red-500/20 text-red-400" :
                stressData.vulnerabilityScore > 30 ? "bg-orange-500/20 text-orange-400" :
                "bg-green-500/20 text-green-400"
              }`}>
                Risk Score: {stressData.vulnerabilityScore}/100
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 mt-3">
              {Object.entries(stressData.scenarios || {}).slice(0, 4).map(([name, data]: [string, any]) => (
                <div key={name} className="bg-muted/30 p-2 rounded flex justify-between items-center">
                  <span className="text-[10px] font-medium text-muted-foreground truncate mr-2">
                    {name.replace(/_/g, " ")}
                  </span>
                  <span className="text-xs font-mono font-bold text-red-400 shrink-0">
                    {data.dropPercentage}%
                  </span>
                </div>
              ))}
            </div>
            
            <div className="mt-3 flex items-center justify-between bg-red-500/5 border border-red-500/20 p-2 rounded">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-red-400" /> Historical 99% VaR
              </span>
              <span className="font-mono text-sm font-bold text-red-400">
                {stressData.historicalVaR99Pct}%
              </span>
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
