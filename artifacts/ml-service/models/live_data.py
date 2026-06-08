import threading
import json
import time
import websocket
import logging
from models import data

log = logging.getLogger(__name__)

# Dictionary to hold the absolute latest tick price from Node.js
live_prices = {}

def on_message(ws, message):
    try:
        msg = json.loads(message)
        if msg.get("type") == "PRICE_UPDATE":
            symbol = msg["data"]["symbol"]
            price = msg["data"]["price"]
            live_prices[symbol] = price
            
            # Optionally update the historical dataframe's last close 
            # to make models immediately aware of the live price.
            # (In a production ML pipeline, you might buffer these ticks to build a 1m candle).
    except Exception as e:
        log.error(f"Error parsing WS message: {e}")

def on_error(ws, error):
    log.error(f"WebSocket Error: {error}")

def on_close(ws, close_status_code, close_msg):
    log.info("WebSocket connection closed. Reconnecting in 5s...")
    time.sleep(5)
    start_websocket_client_thread()

def on_open(ws):
    log.info("Connected to Node.js Market Data WebSocket Feed")

def run_ws():
    # Connect to the local Node.js Express WebSocket server that broadcasts Upstox/Simulated data
    import os
    ws_url = os.getenv("MARKET_DATA_WS_URL", "ws://localhost:4000")
    ws = websocket.WebSocketApp(ws_url,
                              on_open=on_open,
                              on_message=on_message,
                              on_error=on_error,
                              on_close=on_close)
    ws.run_forever()

def start_websocket_client_thread():
    """Starts the WebSocket client in a background daemon thread."""
    t = threading.Thread(target=run_ws, daemon=True)
    t.start()
