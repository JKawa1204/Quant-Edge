/**
 * Upstox API Integration
 *
 * OAuth2 Flow:
 *   1. GET /api/upstox/auth        → redirects user to Upstox login
 *   2. GET /api/upstox/callback    → Upstox redirects here with ?code=...
 *                                    exchanges code for access token, stores in DB
 *   3. GET /api/upstox/status      → { connected: bool, expiresAt }
 *   4. DELETE /api/upstox/disconnect → remove stored token
 *
 * Market Data (uses Upstox if connected, else simulated):
 *   GET /api/upstox/quote/:symbol        → live quote
 *   GET /api/upstox/candles/:symbol/:tf  → OHLCV candles
 *   GET /api/upstox/portfolio/positions  → broker portfolio positions
 *
 * Set env vars: UPSTOX_API_KEY, UPSTOX_API_SECRET, UPSTOX_REDIRECT_URI
 */

import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { db, upstoxTokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request } from "express";
import { verifyToken } from "../lib/auth.js";
import { getCurrentPrice, getStockInfo } from "../lib/marketData.js";

const router = Router();
type AuthReq = Request & { userId: number; userEmail: string };

const UPSTOX_BASE    = "https://api.upstox.com/v2";
const UPSTOX_AUTH    = "https://api.upstox.com/v2/login/authorization/dialog";
const UPSTOX_TOKEN   = "https://api.upstox.com/v2/login/authorization/token";

function getCredentials() {
  return {
    apiKey:      process.env.UPSTOX_API_KEY ?? "",
    apiSecret:   process.env.UPSTOX_API_SECRET ?? "",
    redirectUri: process.env.UPSTOX_REDIRECT_URI ?? "",
  };
}

function isConfigured(): boolean {
  const { apiKey, apiSecret, redirectUri } = getCredentials();
  return !!(apiKey && apiSecret && redirectUri);
}

async function getStoredToken(userId: number): Promise<string | null> {
  const [row] = await db.select().from(upstoxTokensTable).where(eq(upstoxTokensTable.userId, userId));
  if (!row) return null;
  if (new Date() >= row.expiresAt) return null; // expired
  return row.accessToken;
}

/** Convert "RELIANCE" → "NSE_EQ|INE002A01018" — Upstox ISIN format.
 *  We keep a small lookup table; extend as needed. */
const SYMBOL_TO_UPSTOX: Record<string, string> = {
  RELIANCE:    "NSE_EQ|INE002A01018",
  TCS:         "NSE_EQ|INE467B01029",
  HDFCBANK:    "NSE_EQ|INE040A01034",
  INFY:        "NSE_EQ|INE009A01021",
  ICICIBANK:   "NSE_EQ|INE090A01021",
  WIPRO:       "NSE_EQ|INE075A01022",
  AXISBANK:    "NSE_EQ|INE238A01034",
  BHARTIARTL:  "NSE_EQ|INE397D01024",
  KOTAKBANK:   "NSE_EQ|INE237A01028",
  LT:          "NSE_EQ|INE018A01030",
  ITC:         "NSE_EQ|INE154A01025",
  BAJFINANCE:  "NSE_EQ|INE296A01024",
  MARUTI:      "NSE_EQ|INE585B01010",
  SUNPHARMA:   "NSE_EQ|INE044A01036",
  TITAN:       "NSE_EQ|INE280A01028",
  ADANIENT:    "NSE_EQ|INE423A01024",
  ADANIPORTS:  "NSE_EQ|INE742F01042",
  APOLLOHOSP:  "NSE_EQ|INE437A01024",
  ASIANPAINT:  "NSE_EQ|INE021A01026",
  "BAJAJ-AUTO": "NSE_EQ|INE917I01010",
  BAJAJFINSV:  "NSE_EQ|INE918I01018",
  BPCL:        "NSE_EQ|INE029A01011",
  BRITANNIA:   "NSE_EQ|INE216A01030",
  CIPLA:       "NSE_EQ|INE059A01026",
  COALINDIA:   "NSE_EQ|INE522F01014",
  DIVISLAB:    "NSE_EQ|INE361B01024",
  DRREDDY:     "NSE_EQ|INE089A01023",
  EICHERMOT:   "NSE_EQ|INE066A01021",
  GRASIM:      "NSE_EQ|INE047A01021",
  HCLTECH:     "NSE_EQ|INE860A01027",
  HDFCLIFE:    "NSE_EQ|INE795G01014",
  HEROMOTOCO:  "NSE_EQ|INE158A01026",
  HINDALCO:    "NSE_EQ|INE038A01020",
  HINDUNILVR:  "NSE_EQ|INE030A01027",
  INDUSINDBK:  "NSE_EQ|INE095A01012",
  JSWSTEEL:    "NSE_EQ|INE019A01038",
  "M&M":       "NSE_EQ|INE101A01026",
  NESTLEIND:   "NSE_EQ|INE239A01016",
  NTPC:        "NSE_EQ|INE733E01010",
  ONGC:        "NSE_EQ|INE213A01029",
  POWERGRID:   "NSE_EQ|INE752E01010",
  SBILIFE:     "NSE_EQ|INE123W01016",
  SBIN:        "NSE_EQ|INE062A01020",
  TATACONSUM:  "NSE_EQ|INE192A01025",
  TATAMOTORS:  "NSE_EQ|INE155A01022",
  TATASTEEL:   "NSE_EQ|INE081A01020",
  TECHM:       "NSE_EQ|INE669C01036",
  ULTRACEMCO:  "NSE_EQ|INE481G01011",
  SHRIRAMFIN:  "NSE_EQ|INE721A01013",
  TRENT:       "NSE_EQ|INE849A01020",
};

function toUpstoxSymbol(symbol: string): string {
  return SYMBOL_TO_UPSTOX[symbol.toUpperCase()] ?? `NSE_EQ|${symbol.toUpperCase()}`;
}

// ── OAuth2 ─────────────────────────────────────────────────────────────────

router.get("/upstox/auth", requireAuth, (req, res): void => {
  if (!isConfigured()) {
    res.status(503).json({
      error: "Upstox credentials not configured",
      help: "Set UPSTOX_API_KEY, UPSTOX_API_SECRET, UPSTOX_REDIRECT_URI in secrets",
    });
    return;
  }
  const { apiKey, redirectUri } = getCredentials();
  const url = `${UPSTOX_AUTH}?response_type=code&client_id=${apiKey}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  res.redirect(url);
});

router.get("/upstox/callback", async (req, res): Promise<void> => {
  const code = req.query.code as string | undefined;
  if (!code) { res.status(400).json({ error: "Missing code" }); return; }

  // We need userId from the session — read from a cookie/query we set before redirect.
  // For now: the user must already have a valid JWT token accessible here.
  // In production: pass state param with encoded userId.
  const token = req.headers.authorization?.slice(7) ?? (req.query.state as string ?? "");
  const decoded = token ? verifyToken(token) : null;
  if (!decoded) {
    res.status(401).json({ error: "Unauthorized — include JWT token in Authorization header" });
    return;
  }

  const { apiKey, apiSecret, redirectUri } = getCredentials();

  try {
    const resp = await fetch(UPSTOX_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
      body: new URLSearchParams({
        code,
        client_id:     apiKey,
        client_secret: apiSecret,
        redirect_uri:  redirectUri,
        grant_type:    "authorization_code",
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      res.status(400).json({ error: "Token exchange failed", detail: err });
      return;
    }

    const data = await resp.json() as { access_token: string; expires_in: number };
    const expiresAt = new Date(Date.now() + (data.expires_in ?? 86400) * 1000);

    await db.insert(upstoxTokensTable)
      .values({ userId: decoded.userId, accessToken: data.access_token, expiresAt })
      .onConflictDoUpdate({
        target: upstoxTokensTable.userId,
        set: { accessToken: data.access_token, expiresAt, updatedAt: new Date() },
      });

    res.json({ connected: true, expiresAt });
  } catch (e) {
    res.status(500).json({ error: "Token exchange error", detail: String(e) });
  }
});

router.get("/upstox/status", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthReq).userId;
  const configured = isConfigured();

  if (!configured) {
    res.json({ connected: false, configured: false, message: "Upstox credentials not set. Using simulated market data." });
    return;
  }

  const [row] = await db.select().from(upstoxTokensTable).where(eq(upstoxTokensTable.userId, userId));
  if (!row || new Date() >= row.expiresAt) {
    res.json({ connected: false, configured: true, message: "Not authenticated. Visit /api/upstox/auth to connect." });
    return;
  }

  res.json({ connected: true, configured: true, expiresAt: row.expiresAt });
});

router.delete("/upstox/disconnect", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthReq).userId;
  await db.delete(upstoxTokensTable).where(eq(upstoxTokensTable.userId, userId));
  res.json({ disconnected: true });
});

// ── Market Data (live if connected, simulated fallback) ─────────────────────

async function upstoxGet(token: string, path: string): Promise<unknown> {
  const url = `${UPSTOX_BASE}${path}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!resp.ok) throw new Error(`Upstox API ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

router.get("/upstox/quote/:symbol", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthReq).userId;
  const symbol = (req.params.symbol as string).toUpperCase();
  const token  = await getStoredToken(userId);

  if (token) {
    try {
      const upstoxSym = toUpstoxSymbol(symbol);
      const data = await upstoxGet(token, `/market-quote/quotes?symbol=${encodeURIComponent(upstoxSym)}`) as any;
      const quote = data?.data?.[upstoxSym] ?? {};
      res.json({
        symbol,
        source: "upstox",
        price:      quote.last_price        ?? 0,
        open:       quote.ohlc?.open        ?? 0,
        high:       quote.ohlc?.high        ?? 0,
        low:        quote.ohlc?.low         ?? 0,
        close:      quote.ohlc?.close       ?? 0,
        volume:     quote.volume            ?? 0,
        change:     quote.net_change        ?? 0,
        changePct:  quote.percentage_change ?? 0,
        updatedAt:  new Date().toISOString(),
      });
      return;
    } catch (e) {
      req.log?.warn({ err: e }, "Upstox quote failed, falling back");
    }
  }

  // Fallback: simulated
  const price = getCurrentPrice(symbol);
  const info  = getStockInfo(symbol);
  res.json({
    symbol,
    source:    "simulated",
    price,
    open:      Math.round(price * 0.998 * 100) / 100,
    high:      Math.round(price * 1.015 * 100) / 100,
    low:       Math.round(price * 0.985 * 100) / 100,
    close:     price,
    volume:    Math.floor(500000 + Math.random() * 1500000),
    change:    Math.round((price - (info as any).basePrice) * 100) / 100,
    changePct: Math.round(((price - (info as any).basePrice) / (info as any).basePrice) * 10000) / 100,
    updatedAt: new Date().toISOString(),
  });
});

router.get("/upstox/portfolio/positions", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthReq).userId;
  const token  = await getStoredToken(userId);

  if (!token) {
    res.json({ source: "not_connected", positions: [], message: "Connect Upstox to see broker positions" });
    return;
  }

  try {
    const data = await upstoxGet(token, "/portfolio/positions") as any;
    const positions = (data?.data ?? []).map((p: any) => ({
      symbol:       p.tradingsymbol,
      quantity:     p.quantity,
      avgPrice:     p.average_price,
      lastPrice:    p.last_price,
      pnl:          p.pnl,
      dayPnl:       p.day_change,
      dayPnlPct:    p.day_change_percentage,
    }));
    res.json({ source: "upstox", positions });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
