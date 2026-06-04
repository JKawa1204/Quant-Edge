import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { getMarketIndices, getMarketMovers, getSectorPerformance } from "../lib/marketData.js";

const router = Router();

router.get("/market/indices", requireAuth, async (_req, res): Promise<void> => {
  res.json(getMarketIndices());
});

router.get("/market/movers", requireAuth, async (_req, res): Promise<void> => {
  const movers = getMarketMovers();
  res.json(movers);
});

router.get("/market/sectors", requireAuth, async (_req, res): Promise<void> => {
  res.json(getSectorPerformance());
});

export default router;
