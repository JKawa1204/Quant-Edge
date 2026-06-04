import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import dashboardRouter from "./dashboard";
import portfolioRouter from "./portfolio";
import holdingsRouter from "./holdings";
import watchlistsRouter from "./watchlists";
import stocksRouter from "./stocks";
import forecastsRouter from "./forecasts";
import signalsRouter from "./signals";
import ordersRouter from "./orders";
import regimeRouter from "./regime";
import analyticsRouter from "./analytics";
import backtestsRouter from "./backtests";
import marketRouter from "./market";
import aiCommentaryRouter from "./aiCommentary";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(dashboardRouter);
router.use(portfolioRouter);
router.use(holdingsRouter);
router.use(watchlistsRouter);
router.use(stocksRouter);
router.use(forecastsRouter);
router.use(signalsRouter);
router.use(ordersRouter);
router.use(regimeRouter);
router.use(analyticsRouter);
router.use(backtestsRouter);
router.use(marketRouter);
router.use(aiCommentaryRouter);

export default router;
