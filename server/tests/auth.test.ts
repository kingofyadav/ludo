import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";

// ---- Mock config FIRST (hoisted) ----
vi.mock("../src/config.js", () => ({
  config: {
    PORT: 3000,
    DATABASE_URL: "postgresql://ludo:ludo@localhost:5432/ludo",
    REDIS_URL: "redis://localhost:6379",
    JWT_ACCESS_SECRET: "test_access_secret_very_long",
    JWT_REFRESH_SECRET: "test_refresh_secret_very_long",
    JWT_ACCESS_EXPIRES_IN: "15m",
    JWT_REFRESH_EXPIRES_IN: "7d",
    BCRYPT_ROUNDS: 4,
    MATCHMAKING_TIMEOUT_MS: 30000,
    BOT_FILL_TIMEOUT_MS: 15000,
    SNAPSHOT_INTERVAL: 50,
    NODE_ENV: "test",
  },
}));

// Mock DB client — must avoid top-level variable references in factory
vi.mock("../src/db/client.js", () => {
  const mockFn = Object.assign(vi.fn().mockResolvedValue([]), {
    unsafe: vi.fn().mockResolvedValue([]),
  });
  return {
    getSql: () => mockFn,
    closeSql: vi.fn(),
  };
});

// Mock DB queries
vi.mock("../src/db/queries/players.js", () => ({
  createPlayer: vi.fn(),
  findPlayerByEmail: vi.fn(),
  findPlayerById: vi.fn(),
  updatePlayer: vi.fn(),
  getPlayerStats: vi.fn(),
  updatePlayerStats: vi.fn(),
  incrementPlayerStats: vi.fn(),
  getTopPlayersByElo: vi.fn(),
}));

import bcrypt from "bcryptjs";
import { findPlayerByEmail, createPlayer } from "../src/db/queries/players.js";
import { authRouter } from "../src/auth/router.js";

const MOCK_PLAYER = {
  id: "player-uuid-1",
  username: "testuser",
  email: "test@example.com",
  password_hash: "",
  avatar: null as string | null,
  created_at: new Date(),
  last_played: null as Date | null,
};

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/auth", authRouter);
  return app;
}

describe("Auth Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /auth/register", () => {
    it("returns 400 for invalid body", async () => {
      const app = buildApp();
      const res = await request(app)
        .post("/auth/register")
        .send({ username: "ab", email: "notanemail", password: "short" });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("VALIDATION_ERROR");
    });

    it("returns 409 when email is taken", async () => {
      vi.mocked(findPlayerByEmail).mockResolvedValueOnce(MOCK_PLAYER);
      const app = buildApp();
      const res = await request(app)
        .post("/auth/register")
        .send({ username: "newuser", email: "test@example.com", password: "password123" });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe("EMAIL_TAKEN");
    });

    it("returns 201 with accessToken and sets refreshToken cookie on success", async () => {
      vi.mocked(findPlayerByEmail).mockResolvedValueOnce(null);
      vi.mocked(createPlayer).mockResolvedValueOnce(MOCK_PLAYER);

      const app = buildApp();
      const res = await request(app)
        .post("/auth/register")
        .send({ username: "newuser", email: "new@example.com", password: "password123" });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("accessToken");
      expect(res.body).toHaveProperty("player");
      expect(res.body.player.username).toBe("testuser");

      const cookie = res.headers["set-cookie"];
      expect(cookie).toBeDefined();
      expect(String(cookie)).toContain("refreshToken");
    });
  });

  describe("POST /auth/login", () => {
    it("returns 400 for invalid body", async () => {
      const app = buildApp();
      const res = await request(app)
        .post("/auth/login")
        .send({ email: "notvalid" });
      expect(res.status).toBe(400);
    });

    it("returns 401 when player not found", async () => {
      vi.mocked(findPlayerByEmail).mockResolvedValueOnce(null);
      const app = buildApp();
      const res = await request(app)
        .post("/auth/login")
        .send({ email: "nobody@example.com", password: "password123" });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("INVALID_CREDENTIALS");
    });

    it("returns 401 for wrong password", async () => {
      const hash = await bcrypt.hash("correctpassword", 4);
      vi.mocked(findPlayerByEmail).mockResolvedValueOnce({ ...MOCK_PLAYER, password_hash: hash });
      const app = buildApp();
      const res = await request(app)
        .post("/auth/login")
        .send({ email: "test@example.com", password: "wrongpassword" });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("INVALID_CREDENTIALS");
    });

    it("returns accessToken and sets refreshToken cookie on valid login", async () => {
      const hash = await bcrypt.hash("password123", 4);
      vi.mocked(findPlayerByEmail).mockResolvedValueOnce({ ...MOCK_PLAYER, password_hash: hash });

      const app = buildApp();
      const res = await request(app)
        .post("/auth/login")
        .send({ email: "test@example.com", password: "password123" });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("accessToken");
      const cookie = res.headers["set-cookie"];
      expect(String(cookie)).toContain("refreshToken");
    });
  });

  describe("POST /auth/refresh", () => {
    it("returns 401 when no refresh token cookie", async () => {
      const app = buildApp();
      const res = await request(app).post("/auth/refresh");
      expect(res.status).toBe(401);
    });
  });

  describe("POST /auth/logout", () => {
    it("returns 200 and clears cookie even without a token", async () => {
      const app = buildApp();
      const res = await request(app).post("/auth/logout");
      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Logged out");
    });
  });
});

describe("JWT tokens", () => {
  it("signs and verifies access token correctly", async () => {
    const { signAccessToken, verifyAccessToken } = await import("../src/auth/tokens.js");
    const token = signAccessToken({ sub: "player-1", username: "alice" });
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe("player-1");
    expect(payload.username).toBe("alice");
  });

  it("throws on invalid token", async () => {
    const { verifyAccessToken } = await import("../src/auth/tokens.js");
    expect(() => verifyAccessToken("not.a.token")).toThrow();
  });
});
