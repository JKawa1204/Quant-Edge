import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const signalsTable = pgTable("signals", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  company: text("company").notNull().default(""),
  action: text("action").notNull(), // BUY | SELL | HOLD
  confidence: numeric("confidence", { precision: 5, scale: 2 }).notNull(),
  forecastReturn: numeric("forecast_return", { precision: 8, scale: 4 }).notNull(),
  regime: text("regime").notNull().default("Unknown"),
  status: text("status").notNull().default("active"), // active | executed | expired
  arimaContribution: numeric("arima_contribution", { precision: 5, scale: 2 }),
  lstmContribution: numeric("lstm_contribution", { precision: 5, scale: 2 }),
  xgboostContribution: numeric("xgboost_contribution", { precision: 5, scale: 2 }),
  regimeContribution: numeric("regime_contribution", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSignalSchema = createInsertSchema(signalsTable).omit({ id: true, createdAt: true });
export type InsertSignal = z.infer<typeof insertSignalSchema>;
export type Signal = typeof signalsTable.$inferSelect;
