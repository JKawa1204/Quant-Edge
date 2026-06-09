import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";
import { runAutoTradingCycle } from "./autoTrader.js";

const POLLING_INTERVAL_MS = 60 * 1000; // 60 seconds
let isRunning = false;

/**
 * Starts the continuous High-Frequency Trading (HFT) loop in the background.
 * It periodically checks for enabled users and executes paper trades based on live ML signals.
 */
export function startHFTWorker() {
  if (isRunning) return;
  isRunning = true;
  
  logger.info(`[HFT Worker] Started. Polling interval: ${POLLING_INTERVAL_MS / 1000}s`);
  
  // Start the perpetual loop
  setInterval(async () => {
    try {
      // Find all users who have enabled auto-trading
      const enabledUsers = await db.select()
        .from(usersTable)
        .where(eq(usersTable.autoTradingEnabled, true));
        
      if (enabledUsers.length === 0) {
        // No users to process this cycle
        return;
      }
      
      logger.info(`[HFT Worker] Cycle starting for ${enabledUsers.length} enabled user(s)`);
      
      // Process each user
      for (const user of enabledUsers) {
        try {
          const result = await runAutoTradingCycle(user.id);
          
          if (result.tradesExecuted > 0) {
            logger.info(`[HFT Worker] Executed ${result.tradesExecuted} trades for user ${user.username}`);
          }
          
          if (result.errors && result.errors.length > 0 && !result.errors.includes("No signals available")) {
            logger.warn(`[HFT Worker] Errors for user ${user.username}: ${result.errors.join(", ")}`);
          }
        } catch (userErr) {
          logger.error(`[HFT Worker] Failed to process user ${user.username}:`, userErr);
        }
      }
    } catch (err) {
      logger.error(`[HFT Worker] Critical cycle error:`, err);
    }
  }, POLLING_INTERVAL_MS);
}
