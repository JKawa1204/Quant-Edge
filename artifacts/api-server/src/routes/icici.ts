import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
type AuthReq = import("express").Request & { userId: number };
// @ts-ignore
import { BreezeConnect } from "breezeconnect";
import { connectIciciWSS, stopIciciWSS, setIciciSessionToken, getIciciSessionToken } from "../lib/iciciWebsocket.js";

const router = Router();

// Utility: To interact with ICICI Breeze, we usually instantiate BreezeConnect.
export async function getBreezeInstance() {
  const sessionToken = getIciciSessionToken();
  if (!sessionToken) throw new Error("Not authenticated with ICICI Direct");

  const appKey = process.env.ICICI_APP_KEY;
  if (!appKey) throw new Error("ICICI_APP_KEY not configured");

  const breeze = new BreezeConnect({ appKey });
  await breeze.generateSession(process.env.ICICI_SECRET_KEY, sessionToken);
  
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

    // Save the session token in memory
    setIciciSessionToken(apisession);

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
 * Returns { connected: boolean } based on whether the server has an active ICICI token in memory.
 */
router.get("/icici/status", requireAuth, async (req, res): Promise<void> => {
  const token = getIciciSessionToken();
  res.json({ connected: !!token });
});

/**
 * 4. DELETE /api/icici/disconnect
 */
router.post("/icici/disconnect", requireAuth, async (req, res): Promise<void> => {
  try {
    setIciciSessionToken(null);
    stopIciciWSS();
    
    // Optionally restart the dummy feed so the frontend still shows simulated prices
    await connectIciciWSS();

    res.json({ success: true, message: "Disconnected from ICICI Direct." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
