/**
 * Auto-Trading Engine
 *
 * Core engine that fetches ML signals, evaluates them against user preferences,
 * calculates position sizes, executes trades, and logs all decisions with
 * full explainability reasoning.
 */

import { db, portfoliosTable, holdingsTable, ordersTable, transactionsTable, signalsTable, autoTradesTable, usersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { getCurrentPrice, getStockInfo, getMarketRegime } from "../lib/marketData.js";
import { generateAutoTradeReasoning } from "../lib/explainability.js";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AutoTradeDecision {
  symbol: string;
  company: string;
  action: string;
  quantity: number;
  price: number;
  confidence: number;
  forecastReturn: number;
  regime: string;
  status: string;
  reasoning: string;
}

export interface AutoTradeCycleResult {
  tradesExecuted: number;
  tradeDetails: AutoTradeDecision[];
  timestamp: string;
  errors: string[];
}

interface MLSignal {
  symbol: string;
  company: string;
  action: string;
  confidence: number;
  forecastReturn: number;
  regime: string;
  arimaContribution?: number;
  lstmContribution?: number;
  xgboostContribution?: number;
  regimeContribution?: number;
}

// ── ML Service Communication ───────────────────────────────────────────────────

const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? "http://localhost:8001";

/**
 * Fetch signals from the ML service.
 * Falls back to the database signals table if the ML service is unreachable.
 */
async function fetchMLSignals(): Promise<MLSignal[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${ML_SERVICE_URL}/ml/signals`, {
      method: "GET",
      headers: { "Accept": "application/json" },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`ML service returned ${response.status}`);
    }

    const data = await response.json() as any;
    const signals: MLSignal[] = Array.isArray(data) ? data : (data?.signals ?? []);

    return signals.map((s: any) => ({
      symbol: s.symbol ?? "",
      company: s.company ?? getStockInfo(s.symbol ?? "").company,
      action: (s.action ?? "HOLD").toUpperCase(),
      confidence: Number(s.confidence ?? 0),
      forecastReturn: Number(s.forecastReturn ?? s.forecast_return ?? 0),
      regime: s.regime ?? "Unknown",
      arimaContribution: s.arimaContribution ?? s.arima_contribution ?? null,
      lstmContribution: s.lstmContribution ?? s.lstm_contribution ?? null,
      xgboostContribution: s.xgboostContribution ?? s.xgboost_contribution ?? null,
      regimeContribution: s.regimeContribution ?? s.regime_contribution ?? null,
    }));
  } catch (error) {
    // ML service is not running — fallback to database signals
    console.warn(`[AutoTrader] ML service unavailable (${error instanceof Error ? error.message : String(error)}). Falling back to DB signals.`);

    const dbSignals = await db.select().from(signalsTable).where(eq(signalsTable.status, "active"));

    return dbSignals.map(s => ({
      symbol: s.symbol,
      company: s.company,
      action: s.action,
      confidence: Number(s.confidence),
      forecastReturn: Number(s.forecastReturn),
      regime: s.regime,
      arimaContribution: s.arimaContribution ? Number(s.arimaContribution) : undefined,
      lstmContribution: s.lstmContribution ? Number(s.lstmContribution) : undefined,
      xgboostContribution: s.xgboostContribution ? Number(s.xgboostContribution) : undefined,
      regimeContribution: s.regimeContribution ? Number(s.regimeContribution) : undefined,
    }));
  }
}

// ── Core Engine ────────────────────────────────────────────────────────────────

/**
 * Run a complete auto-trading cycle for a given user.
 *
 * Steps:
 * 1. Fetch user preferences (threshold, max position %)
 * 2. Fetch the user's portfolio and current holdings
 * 3. Fetch ML signals
 * 4. For each signal meeting the threshold:
 *    - BUY: calculate position size, check cash, execute
 *    - SELL: check if holding exists, sell entire position
 *    - HOLD / below threshold: log as skipped
 * 5. Log every decision to the autoTrades table
 * 6. Return a summary
 */
export async function runAutoTradingCycle(userId: number): Promise<AutoTradeCycleResult> {
  const timestamp = new Date().toISOString();
  const errors: string[] = [];
  const tradeDetails: AutoTradeDecision[] = [];
  let tradesExecuted = 0;

  try {
    // 1. Fetch user preferences
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) {
      return { tradesExecuted: 0, tradeDetails: [], timestamp, errors: ["User not found"] };
    }

    if (!user.autoTradingEnabled) {
      return { tradesExecuted: 0, tradeDetails: [], timestamp, errors: ["Auto-trading is not enabled for this user"] };
    }

    const confidenceThreshold = Number(user.autoTradingConfidenceThreshold);
    const maxPositionPct = Number(user.autoTradingMaxPositionPct);

    // 2. Fetch portfolio
    const [portfolio] = await db.select().from(portfoliosTable).where(eq(portfoliosTable.userId, userId));
    if (!portfolio) {
      return { tradesExecuted: 0, tradeDetails: [], timestamp, errors: ["No portfolio found for user"] };
    }

    let availableCash = Number(portfolio.cash);
    const currentHoldings = await db.select().from(holdingsTable).where(eq(holdingsTable.portfolioId, portfolio.id));

    // Create a map of current holdings for quick lookup
    const holdingsMap = new Map<string, typeof currentHoldings[number]>();
    for (const h of currentHoldings) {
      holdingsMap.set(h.symbol, h);
    }

    // 3. Fetch ML signals
    let signals: MLSignal[];
    try {
      signals = await fetchMLSignals();
    } catch (err) {
      const errMsg = `Failed to fetch signals: ${err instanceof Error ? err.message : String(err)}`;
      errors.push(errMsg);
      return { tradesExecuted: 0, tradeDetails: [], timestamp, errors };
    }

    if (signals.length === 0) {
      return { tradesExecuted: 0, tradeDetails: [], timestamp, errors: ["No signals available"] };
    }

    const regime = getMarketRegime();

    // 4. Process each signal
    for (const signal of signals) {
      const currentPrice = getCurrentPrice(signal.symbol);
      const stockInfo = getStockInfo(signal.symbol);
      const company = signal.company || stockInfo.company;

      // Check if signal meets confidence threshold
      if (signal.confidence < confidenceThreshold) {
        // Log as skipped due to low confidence
        const reasoning = generateAutoTradeReasoning(
          signal,
          { method: "threshold-filter", suggestedWeight: 0, reason: `Confidence ${signal.confidence}% is below threshold ${confidenceThreshold}%` },
          "HOLD_SKIPPED",
          0
        );

        await db.insert(autoTradesTable).values({
          portfolioId: portfolio.id,
          symbol: signal.symbol,
          company,
          action: "HOLD_SKIPPED",
          quantity: 0,
          price: String(currentPrice),
          confidence: String(signal.confidence),
          reasoning,
          forecastReturn: String(signal.forecastReturn),
          regime: signal.regime || regime.regime,
          optimizationMethod: "threshold-filter",
          modelContributions: {
            arima: signal.arimaContribution ?? 0,
            xgboost: signal.xgboostContribution ?? 0,
            neuralNet: signal.lstmContribution ?? 0,
          },
          status: "skipped",
        });

        tradeDetails.push({
          symbol: signal.symbol,
          company,
          action: "HOLD_SKIPPED",
          quantity: 0,
          price: currentPrice,
          confidence: signal.confidence,
          forecastReturn: signal.forecastReturn,
          regime: signal.regime || regime.regime,
          status: "skipped",
          reasoning: `Skipped: Confidence ${signal.confidence}% below threshold ${confidenceThreshold}%`,
        });

        continue;
      }

      // Process BUY signals
      if (signal.action === "BUY") {
        const existingHolding = holdingsMap.get(signal.symbol);

        // Calculate position size
        const maxPositionValue = (availableCash * maxPositionPct) / 100;
        const quantity = Math.floor(maxPositionValue / currentPrice);

        if (quantity <= 0 || availableCash < currentPrice) {
          // Insufficient funds
          const reasoning = generateAutoTradeReasoning(
            signal,
            { method: "position-sizing", suggestedWeight: maxPositionPct, reason: "Insufficient cash for minimum position" },
            "BUY",
            0
          );

          await db.insert(autoTradesTable).values({
            portfolioId: portfolio.id,
            symbol: signal.symbol,
            company,
            action: "BUY",
            quantity: 0,
            price: String(currentPrice),
            confidence: String(signal.confidence),
            reasoning,
            forecastReturn: String(signal.forecastReturn),
            regime: signal.regime || regime.regime,
            optimizationMethod: "position-sizing",
            modelContributions: {
              arima: signal.arimaContribution ?? 0,
              xgboost: signal.xgboostContribution ?? 0,
              neuralNet: signal.lstmContribution ?? 0,
            },
            status: "insufficient_funds",
          });

          tradeDetails.push({
            symbol: signal.symbol,
            company,
            action: "BUY",
            quantity: 0,
            price: currentPrice,
            confidence: signal.confidence,
            forecastReturn: signal.forecastReturn,
            regime: signal.regime || regime.regime,
            status: "insufficient_funds",
            reasoning: `Insufficient funds: Need ₹${currentPrice} per share, available cash ₹${availableCash.toFixed(2)}`,
          });

          continue;
        }

        const totalCost = quantity * currentPrice;

        try {
          // Execute the BUY trade
          if (existingHolding) {
            // Update existing holding — calculate new average price
            const existingQty = existingHolding.quantity;
            const existingCost = existingQty * Number(existingHolding.buyPrice);
            const newTotalQty = existingQty + quantity;
            const newAvgPrice = (existingCost + totalCost) / newTotalQty;

            await db.update(holdingsTable)
              .set({
                quantity: newTotalQty,
                buyPrice: String(Math.round(newAvgPrice * 100) / 100),
              })
              .where(eq(holdingsTable.id, existingHolding.id));

            // Update the map
            holdingsMap.set(signal.symbol, {
              ...existingHolding,
              quantity: newTotalQty,
              buyPrice: String(Math.round(newAvgPrice * 100) / 100),
            });
          } else {
            // Insert new holding
            const [newHolding] = await db.insert(holdingsTable).values({
              portfolioId: portfolio.id,
              symbol: signal.symbol,
              company,
              sector: stockInfo.sector,
              quantity,
              buyPrice: String(currentPrice),
            }).returning();

            if (newHolding) {
              holdingsMap.set(signal.symbol, newHolding);
            }
          }

          // Deduct cash
          availableCash -= totalCost;
          await db.update(portfoliosTable)
            .set({ cash: String(Math.round(availableCash * 100) / 100) })
            .where(eq(portfoliosTable.id, portfolio.id));

          // Log transaction
          await db.insert(transactionsTable).values({
            portfolioId: portfolio.id,
            symbol: signal.symbol,
            company,
            sector: stockInfo.sector,
            side: "BUY",
            quantity,
            price: String(currentPrice),
            notes: `Auto-trade BUY: ${signal.confidence}% confidence, ${signal.forecastReturn}% forecast return`,
            executedAt: new Date(),
          });

          // Log order
          await db.insert(ordersTable).values({
            portfolioId: portfolio.id,
            symbol: signal.symbol,
            company,
            side: "BUY",
            quantity,
            price: String(currentPrice),
            status: "executed",
            signalSource: "auto-trade",
            executedAt: new Date(),
          });

          // Log auto-trade with reasoning
          const reasoning = generateAutoTradeReasoning(
            signal,
            { method: "position-sizing", suggestedWeight: maxPositionPct, reason: `Position sized at ${maxPositionPct}% of available cash` },
            "BUY",
            quantity
          );

          await db.insert(autoTradesTable).values({
            portfolioId: portfolio.id,
            symbol: signal.symbol,
            company,
            action: "BUY",
            quantity,
            price: String(currentPrice),
            confidence: String(signal.confidence),
            reasoning,
            forecastReturn: String(signal.forecastReturn),
            regime: signal.regime || regime.regime,
            optimizationMethod: "position-sizing",
            modelContributions: {
              arima: signal.arimaContribution ?? 0,
              xgboost: signal.xgboostContribution ?? 0,
              neuralNet: signal.lstmContribution ?? 0,
            },
            status: "executed",
            executedAt: new Date(),
          });

          tradesExecuted++;
          tradeDetails.push({
            symbol: signal.symbol,
            company,
            action: "BUY",
            quantity,
            price: currentPrice,
            confidence: signal.confidence,
            forecastReturn: signal.forecastReturn,
            regime: signal.regime || regime.regime,
            status: "executed",
            reasoning: `Bought ${quantity} shares at ₹${currentPrice} (total ₹${totalCost.toFixed(2)})`,
          });
        } catch (err) {
          const errMsg = `Error executing BUY for ${signal.symbol}: ${err instanceof Error ? err.message : String(err)}`;
          errors.push(errMsg);

          await db.insert(autoTradesTable).values({
            portfolioId: portfolio.id,
            symbol: signal.symbol,
            company,
            action: "BUY",
            quantity: 0,
            price: String(currentPrice),
            confidence: String(signal.confidence),
            reasoning: { error: errMsg },
            forecastReturn: String(signal.forecastReturn),
            regime: signal.regime || regime.regime,
            optimizationMethod: "none",
            status: "error",
          });

          tradeDetails.push({
            symbol: signal.symbol,
            company,
            action: "BUY",
            quantity: 0,
            price: currentPrice,
            confidence: signal.confidence,
            forecastReturn: signal.forecastReturn,
            regime: signal.regime || regime.regime,
            status: "error",
            reasoning: errMsg,
          });
        }
      }

      // Process SELL signals
      else if (signal.action === "SELL") {
        const existingHolding = holdingsMap.get(signal.symbol);

        if (!existingHolding || existingHolding.quantity <= 0) {
          // No holding to sell — skip
          const reasoning = generateAutoTradeReasoning(
            signal,
            { method: "position-check", suggestedWeight: 0, reason: "No existing position to sell" },
            "SELL",
            0
          );

          await db.insert(autoTradesTable).values({
            portfolioId: portfolio.id,
            symbol: signal.symbol,
            company,
            action: "SELL",
            quantity: 0,
            price: String(currentPrice),
            confidence: String(signal.confidence),
            reasoning,
            forecastReturn: String(signal.forecastReturn),
            regime: signal.regime || regime.regime,
            optimizationMethod: "position-check",
            modelContributions: {
              arima: signal.arimaContribution ?? 0,
              xgboost: signal.xgboostContribution ?? 0,
              neuralNet: signal.lstmContribution ?? 0,
            },
            status: "skipped",
          });

          tradeDetails.push({
            symbol: signal.symbol,
            company,
            action: "SELL",
            quantity: 0,
            price: currentPrice,
            confidence: signal.confidence,
            forecastReturn: signal.forecastReturn,
            regime: signal.regime || regime.regime,
            status: "skipped",
            reasoning: `Skipped: No existing position in ${signal.symbol} to sell`,
          });

          continue;
        }

        try {
          const sellQuantity = existingHolding.quantity;
          const totalProceeds = sellQuantity * currentPrice;

          // Remove holding
          await db.delete(holdingsTable).where(eq(holdingsTable.id, existingHolding.id));
          holdingsMap.delete(signal.symbol);

          // Add cash
          availableCash += totalProceeds;
          await db.update(portfoliosTable)
            .set({ cash: String(Math.round(availableCash * 100) / 100) })
            .where(eq(portfoliosTable.id, portfolio.id));

          // Log transaction
          await db.insert(transactionsTable).values({
            portfolioId: portfolio.id,
            symbol: signal.symbol,
            company,
            sector: stockInfo.sector,
            side: "SELL",
            quantity: sellQuantity,
            price: String(currentPrice),
            notes: `Auto-trade SELL: ${signal.confidence}% confidence, ${signal.forecastReturn}% forecast return`,
            executedAt: new Date(),
          });

          // Log order
          await db.insert(ordersTable).values({
            portfolioId: portfolio.id,
            symbol: signal.symbol,
            company,
            side: "SELL",
            quantity: sellQuantity,
            price: String(currentPrice),
            status: "executed",
            signalSource: "auto-trade",
            executedAt: new Date(),
          });

          // Log auto-trade with reasoning
          const reasoning = generateAutoTradeReasoning(
            signal,
            { method: "full-liquidation", suggestedWeight: 0, reason: "Selling entire position based on SELL signal" },
            "SELL",
            sellQuantity
          );

          await db.insert(autoTradesTable).values({
            portfolioId: portfolio.id,
            symbol: signal.symbol,
            company,
            action: "SELL",
            quantity: sellQuantity,
            price: String(currentPrice),
            confidence: String(signal.confidence),
            reasoning,
            forecastReturn: String(signal.forecastReturn),
            regime: signal.regime || regime.regime,
            optimizationMethod: "full-liquidation",
            modelContributions: {
              arima: signal.arimaContribution ?? 0,
              xgboost: signal.xgboostContribution ?? 0,
              neuralNet: signal.lstmContribution ?? 0,
            },
            status: "executed",
            executedAt: new Date(),
          });

          tradesExecuted++;
          tradeDetails.push({
            symbol: signal.symbol,
            company,
            action: "SELL",
            quantity: sellQuantity,
            price: currentPrice,
            confidence: signal.confidence,
            forecastReturn: signal.forecastReturn,
            regime: signal.regime || regime.regime,
            status: "executed",
            reasoning: `Sold ${sellQuantity} shares at ₹${currentPrice} (total ₹${totalProceeds.toFixed(2)})`,
          });
        } catch (err) {
          const errMsg = `Error executing SELL for ${signal.symbol}: ${err instanceof Error ? err.message : String(err)}`;
          errors.push(errMsg);

          await db.insert(autoTradesTable).values({
            portfolioId: portfolio.id,
            symbol: signal.symbol,
            company,
            action: "SELL",
            quantity: 0,
            price: String(currentPrice),
            confidence: String(signal.confidence),
            reasoning: { error: errMsg },
            forecastReturn: String(signal.forecastReturn),
            regime: signal.regime || regime.regime,
            optimizationMethod: "none",
            status: "error",
          });

          tradeDetails.push({
            symbol: signal.symbol,
            company,
            action: "SELL",
            quantity: 0,
            price: currentPrice,
            confidence: signal.confidence,
            forecastReturn: signal.forecastReturn,
            regime: signal.regime || regime.regime,
            status: "error",
            reasoning: errMsg,
          });
        }
      }

      // Process HOLD signals
      else {
        const reasoning = generateAutoTradeReasoning(
          signal,
          { method: "hold-signal", suggestedWeight: 0, reason: "Signal indicates HOLD — no action taken" },
          "HOLD_SKIPPED",
          0
        );

        await db.insert(autoTradesTable).values({
          portfolioId: portfolio.id,
          symbol: signal.symbol,
          company,
          action: "HOLD_SKIPPED",
          quantity: 0,
          price: String(currentPrice),
          confidence: String(signal.confidence),
          reasoning,
          forecastReturn: String(signal.forecastReturn),
          regime: signal.regime || regime.regime,
          optimizationMethod: "hold-signal",
          modelContributions: {
            arima: signal.arimaContribution ?? 0,
            xgboost: signal.xgboostContribution ?? 0,
            neuralNet: signal.lstmContribution ?? 0,
          },
          status: "skipped",
        });

        tradeDetails.push({
          symbol: signal.symbol,
          company,
          action: "HOLD_SKIPPED",
          quantity: 0,
          price: currentPrice,
          confidence: signal.confidence,
          forecastReturn: signal.forecastReturn,
          regime: signal.regime || regime.regime,
          status: "skipped",
          reasoning: `HOLD signal — maintaining current position for ${signal.symbol}`,
        });
      }
    }
  } catch (err) {
    const errMsg = `Auto-trading cycle error: ${err instanceof Error ? err.message : String(err)}`;
    errors.push(errMsg);
    console.error(`[AutoTrader] ${errMsg}`);
  }

  return { tradesExecuted, tradeDetails, timestamp, errors };
}
