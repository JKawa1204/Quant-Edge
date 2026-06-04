import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/auth.js";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  const decoded = verifyToken(token);
  if (!decoded) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  (req as Request & { userId: number; userEmail: string }).userId = decoded.userId;
  (req as Request & { userId: number; userEmail: string }).userEmail = decoded.email;
  next();
}
