import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { db, iciciTokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";
// @ts-ignore
import { BreezeConnect } from "breezeconnect";
import { connectIciciWSS, stopIciciWSS } from "../lib/iciciWebsocket.js";

const router = Router();
type AuthReq = import("express").Request & { userId: number };

// Utility: To interact with ICICI Breeze, we usually instantiate BreezeConnect.
export async function getBreezeInstance(userId: number) {
  const [row] = await db.select().from(iciciTokensTable).where(eq(iciciTokensTable.userId, userId));
  if (!row) throw new Error("Not authenticated with ICICI Direct");

  const appKey = process.env.ICICI_APP_KEY;
  if (!appKey) throw new Error("ICICI_APP_KEY not configured");

  const breeze = new BreezeConnect({ appKey });
  await breeze.generateSession(process.env.ICICI_SECRET_KEY, row.sessionToken);
  
  return breeze;
}

/**
 * 1. GET /api/icici/auth
 * Redirects the user to the ICICI login page.
 */
router.get("/icici/auth", requireAuth, (req, res): void => {
  const appKey = process.env.ICICI_APP_KEY;
  if (!appKey) {
    res.status(500).json({ error: "ICICI_APP_KEY not configured on server." });
    return;
  }
  const loginUrl = `https://api.icicidirect.com/apiuser/login?api_key=${encodeURIComponent(appKey)}`;
  res.json({ url: loginUrl });
});

/**
 * 2. GET /api/icici/callback
 * ICICI redirects here with ?apisession=... after successful login.
 */
router.post("/icici/callback", requireAuth, async (req, res): Promise<void> => {
  try {
    const { apisession } = req.body;
    if (!apisession || typeof apisession !== "string") {
      res.status(400).send("Missing apisession parameter in body");
      return;
    }

    const userId = (req as AuthReq).userId;

    // First, delete any existing tokens for this user to avoid duplicate constraint issues
    await db.delete(iciciTokensTable).where(eq(iciciTokensTable.userId, userId));

    // Then insert the new session token
    await db.insert(iciciTokensTable).values({
      userId: userId,
      sessionToken: apisession,
      updatedAt: new Date(),
    });

    // Reconnect WebSocket Feed globally using the new token
    stopIciciWSS();
    await connectIciciWSS();

    res.json({ success: true, message: "ICICI Direct connected successfully." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 3. GET /api/icici/status
 */
router.get("/icici/status", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthReq).userId;
  const configured = !!process.env.ICICI_APP_KEY && !!process.env.ICICI_SECRET_KEY;

  try {
    const [row] = await db.select().from(iciciTokensTable).where(eq(iciciTokensTable.userId, userId));
    if (!row) {
      res.json({ connected: false, configured, message: "Not authenticated. Visit /api/icici/auth to connect." });
      return;
    }
    res.json({ connected: true, configured, message: "ICICI Direct is connected." });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * 4. DELETE /api/icici/disconnect
 */
router.delete("/icici/disconnect", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthReq).userId;
  await db.delete(iciciTokensTable).where(eq(iciciTokensTable.userId, userId));
  res.json({ success: true, message: "Disconnected from ICICI Direct." });
});

export default router;
