import { pgTable, text, serial, timestamp, integer, numeric, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const autoTradesTable = pgTable("auto_trades", {
  id: serial("id").primaryKey(),
  portfolioId: integer("portfolio_id").notNull(),
  symbol: text("symbol").notNull(),
  company: text("company").notNull().default(""),
  action: text("action").notNull(), // BUY | SELL | HOLD_SKIPPED
  quantity: integer("quantity"),
  price: numeric("price", { precision: 15, scale: 2 }),
  confidence: numeric("confidence", { precision: 5, scale: 2 }).notNull(),
  reasoning: jsonb("reasoning").notNull(), // structured reasoning object
  forecastReturn: numeric("forecast_return", { precision: 8, scale: 4 }),
  regime: text("regime").notNull().default("Unknown"),
  optimizationMethod: text("optimization_method").notNull().default("none"),
  modelContributions: jsonb("model_contributions"), // {arima: %, xgboost: %, neuralNet: %}
  status: text("status").notNull().default("pending"), // executed | skipped | insufficient_funds | error
  executedAt: timestamp("executed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAutoTradeSchema = createInsertSchema(autoTradesTable).omit({ id: true, createdAt: true });
export type InsertAutoTrade = z.infer<typeof insertAutoTradeSchema>;
export type AutoTrade = typeof autoTradesTable.$inferSelect;
