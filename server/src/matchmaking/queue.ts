import { getRedis } from "../redis.js";

export interface QueueEntry {
  playerId: string;
  username: string;
  socketId: string;
  requestedSize: 2 | 3 | 4;
  joinedAt: number;
}

const queueKey = (size: number) => `queue:${size}`;

export async function addToQueue(entry: QueueEntry): Promise<void> {
  const redis = getRedis();
  const key = queueKey(entry.requestedSize);
  await redis.zadd(key, entry.joinedAt, JSON.stringify(entry));
}

export async function removeFromQueue(playerId: string, requestedSize: 2 | 3 | 4): Promise<void> {
  const redis = getRedis();
  const key = queueKey(requestedSize);
  const members = await redis.zrange(key, 0, -1);
  for (const member of members) {
    const entry = JSON.parse(member) as QueueEntry;
    if (entry.playerId === playerId) {
      await redis.zrem(key, member);
      return;
    }
  }
}

export async function removeFromAllQueues(playerId: string): Promise<void> {
  for (const size of [2, 3, 4] as const) {
    await removeFromQueue(playerId, size);
  }
}

export async function peekQueue(size: 2 | 3 | 4): Promise<QueueEntry[]> {
  const redis = getRedis();
  const key = queueKey(size);
  const members = await redis.zrange(key, 0, -1, "WITHSCORES");
  const entries: QueueEntry[] = [];
  for (let i = 0; i < members.length; i += 2) {
    const member = members[i];
    if (member) {
      entries.push(JSON.parse(member) as QueueEntry);
    }
  }
  return entries;
}

export async function popFromQueue(size: 2 | 3 | 4, count: number): Promise<QueueEntry[]> {
  const redis = getRedis();
  const key = queueKey(size);
  const members = await redis.zrange(key, 0, count - 1);
  const entries: QueueEntry[] = [];
  for (const member of members) {
    entries.push(JSON.parse(member) as QueueEntry);
    await redis.zrem(key, member);
  }
  return entries;
}

export async function getQueuePosition(playerId: string, requestedSize: 2 | 3 | 4): Promise<number> {
  const redis = getRedis();
  const key = queueKey(requestedSize);
  const members = await redis.zrange(key, 0, -1);
  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    if (member) {
      const entry = JSON.parse(member) as QueueEntry;
      if (entry.playerId === playerId) return i + 1;
    }
  }
  return -1;
}

export async function getQueueSize(requestedSize: 2 | 3 | 4): Promise<number> {
  const redis = getRedis();
  return redis.zcard(queueKey(requestedSize));
}
