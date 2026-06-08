import app from "./app";
import { logger } from "./lib/logger";
import { WebSocketServer } from "ws";
import { connectUpstoxWSS, marketEventBus } from "./lib/upstoxWebsocket";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, async (err?: any) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  
  // Start the Upstox Market Data Feed connection (falls back to simulation if no token)
  await connectUpstoxWSS(null); // Passing null initiates fallback until user explicitly auths

  // Attach a WebSocket Server for frontend clients
  const wss = new WebSocketServer({ server });
  
  wss.on("connection", (ws) => {
    logger.info("New frontend client connected to WebSocket.");
    ws.send(JSON.stringify({ type: "CONNECTION_ESTABLISHED" }));
  });

  // Broadcast price updates to all connected frontend clients
  marketEventBus.on("price_update", (data) => {
    const payload = JSON.stringify({ type: "PRICE_UPDATE", data });
    for (const client of wss.clients) {
      if (client.readyState === 1 /* WebSocket.OPEN */) {
        client.send(payload);
      }
    }
  });
});
