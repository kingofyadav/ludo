import Redis from "ioredis";
import { config } from "./config.js";

let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (_redis === null) {
    _redis = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: null, // required for BullMQ
      enableReadyCheck: false,
    });
    _redis.on("error", (err) => {
      console.error("Redis error:", err);
    });
  }
  return _redis;
}

export function createRedisClient(): Redis {
  return new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

/**
 * Returns a connection options object for BullMQ.
 * BullMQ ships its own ioredis, so we pass URL + options rather than
 * an ioredis instance to avoid type mismatches between the two copies.
 */
export function getBullMQConnection(): { url: string; maxRetriesPerRequest: null; enableReadyCheck: boolean } {
  return {
    url: config.REDIS_URL,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}

export async function closeRedis(): Promise<void> {
  if (_redis !== null) {
    await _redis.quit();
    _redis = null;
  }
}
