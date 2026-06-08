import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  portfolioId: integer("portfolio_id").notNull(),
  symbol: text("symbol").notNull(),
  company: text("company").notNull().default(""),
  sector: text("sector").notNull().default("Unknown"),
  side: text("side").notNull(), // BUY | SELL
  quantity: integer("quantity").notNull(),
  price: numeric("price", { precision: 15, scale: 2 }).notNull(),
  notes: text("notes"),
  executedAt: timestamp("executed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const iciciTokensTable = pgTable("icici_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  sessionToken: text("session_token").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({ id: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
export type IciciToken = typeof iciciTokensTable.$inferSelect;
