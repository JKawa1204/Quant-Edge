import { db, usersTable, portfoliosTable, holdingsTable, watchlistsTable, watchlistStocksTable, signalsTable, ordersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "quantedge_salt").digest("hex");
}

async function seed() {
  console.log("Seeding database...");

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, "demo@quantedge.in"));
  if (existing.length > 0) {
    console.log("Demo user already exists, skipping seed.");
    process.exit(0);
  }

  const [user] = await db.insert(usersTable).values({
    email: "demo@quantedge.in",
    password: hashPassword("demo1234"),
    name: "Arjun Mehta",
  }).returning();
  console.log("Created user:", user.email);

  const [portfolio] = await db.insert(portfoliosTable).values({
    userId: user.id,
    name: "Growth Portfolio",
    cash: "450000",
  }).returning();
  console.log("Created portfolio:", portfolio.id);

  const holdings = [
    { symbol: "RELIANCE", company: "Reliance Industries", sector: "Energy", quantity: 50, buyPrice: "2720" },
    { symbol: "TCS", company: "Tata Consultancy Services", sector: "Technology", quantity: 30, buyPrice: "3750" },
    { symbol: "HDFCBANK", company: "HDFC Bank", sector: "Financials", quantity: 100, buyPrice: "1650" },
    { symbol: "INFY", company: "Infosys", sector: "Technology", quantity: 80, buyPrice: "1780" },
    { symbol: "ICICIBANK", company: "ICICI Bank", sector: "Financials", quantity: 60, buyPrice: "1180" },
    { symbol: "BHARTIARTL", company: "Bharti Airtel", sector: "Telecom", quantity: 40, buyPrice: "1380" },
    { symbol: "LT", company: "Larsen & Toubro", sector: "Industrials", quantity: 20, buyPrice: "3480" },
    { symbol: "BAJFINANCE", company: "Bajaj Finance", sector: "Financials", quantity: 10, buyPrice: "6900" },
  ];

  await db.insert(holdingsTable).values(holdings.map(h => ({ ...h, portfolioId: portfolio.id })));
  console.log("Created holdings:", holdings.length);

  const [wl1] = await db.insert(watchlistsTable).values({ userId: user.id, name: "Tech Stocks" }).returning();
  const [wl2] = await db.insert(watchlistsTable).values({ userId: user.id, name: "Banking" }).returning();
  const [wl3] = await db.insert(watchlistsTable).values({ userId: user.id, name: "My Picks" }).returning();

  await db.insert(watchlistStocksTable).values([
    { watchlistId: wl1.id, symbol: "TCS" },
    { watchlistId: wl1.id, symbol: "INFY" },
    { watchlistId: wl1.id, symbol: "WIPRO" },
    { watchlistId: wl2.id, symbol: "HDFCBANK" },
    { watchlistId: wl2.id, symbol: "ICICIBANK" },
    { watchlistId: wl2.id, symbol: "AXISBANK" },
    { watchlistId: wl2.id, symbol: "KOTAKBANK" },
    { watchlistId: wl3.id, symbol: "RELIANCE" },
    { watchlistId: wl3.id, symbol: "MARUTI" },
    { watchlistId: wl3.id, symbol: "TITAN" },
  ]);
  console.log("Created watchlists: 3");

  const signals = [
    { symbol: "RELIANCE", company: "Reliance Industries", action: "BUY", confidence: "78.4", forecastReturn: "0.0342", regime: "Bull Market", arimaContribution: "22", lstmContribution: "38", xgboostContribution: "28", regimeContribution: "12", status: "active" },
    { symbol: "TCS", company: "Tata Consultancy Services", action: "HOLD", confidence: "62.1", forecastReturn: "0.0089", regime: "Bull Market", arimaContribution: "30", lstmContribution: "32", xgboostContribution: "25", regimeContribution: "13", status: "active" },
    { symbol: "ICICIBANK", company: "ICICI Bank", action: "BUY", confidence: "84.7", forecastReturn: "0.0512", regime: "Bull Market", arimaContribution: "18", lstmContribution: "42", xgboostContribution: "30", regimeContribution: "10", status: "active" },
    { symbol: "INFY", company: "Infosys", action: "SELL", confidence: "71.3", forecastReturn: "-0.0287", regime: "High Volatility", arimaContribution: "28", lstmContribution: "35", xgboostContribution: "22", regimeContribution: "15", status: "active" },
    { symbol: "HDFCBANK", company: "HDFC Bank", action: "BUY", confidence: "76.9", forecastReturn: "0.0421", regime: "Bull Market", arimaContribution: "20", lstmContribution: "40", xgboostContribution: "28", regimeContribution: "12", status: "active" },
    { symbol: "WIPRO", company: "Wipro", action: "HOLD", confidence: "55.2", forecastReturn: "0.0124", regime: "Sideways Market", arimaContribution: "32", lstmContribution: "28", xgboostContribution: "26", regimeContribution: "14", status: "active" },
    { symbol: "MARUTI", company: "Maruti Suzuki", action: "BUY", confidence: "80.6", forecastReturn: "0.0398", regime: "Bull Market", arimaContribution: "24", lstmContribution: "38", xgboostContribution: "26", regimeContribution: "12", status: "active" },
  ];

  await db.insert(signalsTable).values(signals);
  console.log("Created signals:", signals.length);

  await db.insert(ordersTable).values([
    { portfolioId: portfolio.id, symbol: "RELIANCE", company: "Reliance Industries", side: "BUY", quantity: 50, price: "2720", status: "executed", signalSource: "LSTM Signal", executedAt: new Date("2024-11-15T10:30:00Z") },
    { portfolioId: portfolio.id, symbol: "TCS", company: "Tata Consultancy Services", side: "BUY", quantity: 30, price: "3750", status: "executed", signalSource: "Ensemble Signal", executedAt: new Date("2024-11-18T11:15:00Z") },
    { portfolioId: portfolio.id, symbol: "HDFCBANK", company: "HDFC Bank", side: "BUY", quantity: 100, price: "1650", status: "executed", signalSource: "Markowitz Optimization", executedAt: new Date("2024-12-02T09:45:00Z") },
    { portfolioId: portfolio.id, symbol: "INFY", company: "Infosys", side: "BUY", quantity: 80, price: "1780", status: "executed", signalSource: "Manual", executedAt: new Date("2024-12-10T14:20:00Z") },
    { portfolioId: portfolio.id, symbol: "WIPRO", company: "Wipro", side: "SELL", quantity: 25, price: "520", status: "rejected", signalSource: "XGBoost Signal", executedAt: null },
  ]);
  console.log("Created orders: 5");

  console.log("Seed complete.");
  process.exit(0);
}

seed().catch(err => {
  console.error("Seed error:", err);
  process.exit(1);
});
