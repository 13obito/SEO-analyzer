import IORedis, { type RedisOptions } from "ioredis";

/**
 * BullMQ requires maxRetriesPerRequest: null on the Redis client.
 */
function buildClient(): IORedis {
  const url = process.env.REDIS_URL?.trim();
  if (url) {
    return new IORedis(url, { maxRetriesPerRequest: null });
  }
  const host = process.env.REDIS_HOST?.trim() || "127.0.0.1";
  const port = Number(process.env.REDIS_PORT || "6379");
  return new IORedis({ host, port, maxRetriesPerRequest: null });
}

let shared: IORedis | null = null;

/** Shared connection; duplicate() for Queue/Worker instances in the same process. */
export function getRedisConnection(): IORedis {
  if (!shared) {
    shared = buildClient();
  }
  return shared;
}

export function createRedisDuplicate(): IORedis {
  return getRedisConnection().duplicate();
}

const failFastOpts: RedisOptions = {
  maxRetriesPerRequest: null,
  connectTimeout: 5000,
  retryStrategy: () => null,
};

/**
 * One-off client: fails quickly if Redis is down (no infinite reconnect spam).
 */
export async function pingRedisOrThrow(): Promise<void> {
  const url = process.env.REDIS_URL?.trim();
  const client = url
    ? new IORedis(url, failFastOpts)
    : new IORedis({
        host: process.env.REDIS_HOST?.trim() || "127.0.0.1",
        port: Number(process.env.REDIS_PORT || "6379"),
        ...failFastOpts,
      });
  try {
    await client.ping();
  } finally {
    await client.quit().catch(() => {});
  }
}
