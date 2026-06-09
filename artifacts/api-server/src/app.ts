import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/ml", async (req, res) => {
  const mlUrl = process.env.ML_SERVICE_URL || "http://localhost:5000";
  try {
    const pyRes = await fetch(`${mlUrl}/ml${req.url}`, {
      method: req.method,
      headers: { "Content-Type": "application/json" },
      body: req.method === "POST" || req.method === "PUT" ? JSON.stringify(req.body) : undefined
    });
    
    // Attempt to parse JSON; fallback to text if necessary
    const contentType = pyRes.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await pyRes.json();
      res.status(pyRes.status).json(data);
    } else {
      const text = await pyRes.text();
      res.status(pyRes.status).send(text);
    }
  } catch(e) {
    logger.error({ error: e, url: req.url }, "ML Proxy Failed");
    res.status(500).json({ error: "ML Proxy Failed" });
  }
});

app.use("/api", router);

export default app;
