import { Badge } from "@/components/ui/badge";

export function ActionBadge({ action }: { action: string }) {
  let variant: "default" | "destructive" | "outline" | "secondary" = "outline";
  let className = "";

  if (action.toUpperCase() === "BUY") {
    className = "bg-chart-1/10 text-chart-1 hover:bg-chart-1/20 border-chart-1/20";
  } else if (action.toUpperCase() === "SELL") {
    variant = "destructive";
    className = "bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20";
  } else {
    className = "bg-chart-3/10 text-chart-3 hover:bg-chart-3/20 border-chart-3/20";
  }

  return (
    <Badge variant={variant} className={className}>
      {action.toUpperCase()}
    </Badge>
  );
}

export function RegimeBadge({ regime, confidence }: { regime: string, confidence?: number }) {
  let className = "bg-muted text-muted-foreground";
  
  const r = regime.toLowerCase();
  if (r.includes("bull")) className = "bg-chart-1/10 text-chart-1 border-chart-1/20";
  else if (r.includes("bear")) className = "bg-destructive/10 text-destructive border-destructive/20";
  else if (r.includes("sideways")) className = "bg-blue-500/10 text-blue-500 border-blue-500/20";
  else if (r.includes("high vol")) className = "bg-orange-500/10 text-orange-500 border-orange-500/20";
  else if (r.includes("low vol")) className = "bg-teal-500/10 text-teal-500 border-teal-500/20";

  return (
    <Badge variant="outline" className={className}>
      {regime.toUpperCase()}
      {confidence ? ` (${(confidence * 100).toFixed(0)}%)` : ''}
    </Badge>
  );
}
