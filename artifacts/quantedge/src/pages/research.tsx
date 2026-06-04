import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function Research() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Research Findings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Research Lab</CardTitle>
          <CardDescription>Explore deep quantitative insights</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center border border-dashed rounded-md text-muted-foreground">
            Research modules available in premium tier.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}