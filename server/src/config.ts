import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(8),
  JWT_REFRESH_SECRET: z.string().min(8),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(31).default(10),
  MATCHMAKING_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  BOT_FILL_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  SNAPSHOT_INTERVAL: z.coerce.number().int().positive().default(50),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LIVEKIT_URL: z.string().default("ws://localhost:7880"),
  LIVEKIT_API_KEY: z.string().default("devkey"),
  LIVEKIT_API_SECRET: z.string().default("devsecret"),
  LIVEKIT_WEBHOOK_SECRET: z.string().default("devsecret"),
});

function loadConfig() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const msg = Object.entries(errors)
      .map(([k, v]) => `${k}: ${(v ?? []).join(", ")}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${msg}`);
  }
  return result.data;
}

export const config = loadConfig();
export type Config = typeof config;
