import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";

function authHeaders(): Record<string, string> {
  const t = localStorage.getItem("quantedge_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export default function IciciCallback() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState("Connecting to ICICI Direct...");

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const apisession = urlParams.get("apisession");

    if (!apisession) {
      setStatus("Error: No API Session token found in URL.");
      return;
    }

    const API = import.meta.env.VITE_API_URL || "/api";

    fetch(`${API}/icici/callback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({ apisession }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setStatus("Successfully connected! Redirecting to dashboard...");
          setTimeout(() => {
            setLocation("/dashboard");
          }, 1500);
        } else {
          setStatus("Error: " + (data.error || "Failed to authenticate with ICICI."));
        }
      })
      .catch((err) => {
        setStatus("Network Error: " + err.message);
      });
  }, [setLocation]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle className="text-center">Broker Authentication</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{status}</p>
        </CardContent>
      </Card>
    </div>
  );
}
