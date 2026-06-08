import { Router } from "express";
import { z } from "zod";
import { register, login, refresh, logout } from "./service.js";

const router = Router();

const REFRESH_COOKIE = "refreshToken";
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env["NODE_ENV"] === "production",
  sameSite: "strict" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

const registerSchema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    return;
  }

  try {
    const tokens = await register(parsed.data);
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, COOKIE_OPTIONS);
    res.status(201).json({
      accessToken: tokens.accessToken,
      player: { id: tokens.playerId, username: tokens.username },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UNKNOWN";
    if (msg === "EMAIL_TAKEN") {
      res.status(409).json({ error: "EMAIL_TAKEN", message: "Email is already registered" });
    } else {
      console.error("[auth/register] error:", err);
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Registration failed" });
    }
  }
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    return;
  }

  try {
    const tokens = await login(parsed.data);
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, COOKIE_OPTIONS);
    res.json({
      accessToken: tokens.accessToken,
      player: { id: tokens.playerId, username: tokens.username },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UNKNOWN";
    if (msg === "INVALID_CREDENTIALS") {
      res.status(401).json({ error: "INVALID_CREDENTIALS", message: "Invalid email or password" });
    } else {
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Login failed" });
    }
  }
});

router.post("/refresh", async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (!token) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "No refresh token" });
    return;
  }

  try {
    const tokens = await refresh(token);
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, COOKIE_OPTIONS);
    res.json({
      accessToken: tokens.accessToken,
      player: { id: tokens.playerId, username: tokens.username },
    });
  } catch {
    res.clearCookie(REFRESH_COOKIE);
    res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid or expired refresh token" });
  }
});

router.post("/logout", async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (token) {
    try {
      await logout(token);
    } catch {
      // Best effort — clear cookie regardless
    }
  }
  res.clearCookie(REFRESH_COOKIE);
  res.json({ message: "Logged out" });
});

export { router as authRouter };
