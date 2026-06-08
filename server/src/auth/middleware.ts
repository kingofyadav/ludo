import type { RequestHandler } from "express";
import { verifyAccessToken } from "./tokens.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      player?: { id: string; username: string };
    }
  }
}

export const requireAuth: RequestHandler = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyAccessToken(token);
    req.player = { id: payload.sub, username: payload.username };
    next();
  } catch {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid or expired token" });
  }
};
