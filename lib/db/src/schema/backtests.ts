import { pgTable, text, serial, timestamp, integer, numeric, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const backtestsTable = pgTable("backtests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  symbols: text("symbols").array().notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  forecastModel: text("forecast_model").notNull(),
  optimizationMethod: text("optimization_method").notNull(),
  status: text("status").notNull().default("pending"), // pending | running | completed | failed
  cagr: numeric("cagr", { precision: 8, scale: 4 }),
  sharpeRatio: numeric("sharpe_ratio", { precision: 8, scale: 4 }),
  maxDrawdown: numeric("max_drawdown", { precision: 8, scale: 4 }),
  alpha: numeric("alpha", { precision: 8, scale: 4 }),
  results: jsonb("results"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBacktestSchema = createInsertSchema(backtestsTable).omit({ id: true, createdAt: true });
export type InsertBacktest = z.infer<typeof insertBacktestSchema>;
export type Backtest = typeof backtestsTable.$inferSelect;
