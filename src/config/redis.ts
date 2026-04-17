import Redis from 'ioredis';
import { env } from '@/config/env';
import { logger } from '@/config/logger';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      lazyConnect: true,
    });

    redisClient.on('connect', () => {
      logger.info('✅ Redis connected');
    });

    redisClient.on('error', (err) => {
      logger.error('❌ Redis error:', err.message);
    });

    redisClient.on('close', () => {
      logger.warn('Redis connection closed');
    });

    redisClient.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
    });
  }

  return redisClient;
}

export async function connectRedis(): Promise<void> {
  try {
    const client = getRedisClient();
    await client.connect();
  } catch (error) {
    logger.error('❌ Failed to connect to Redis:', error);
    // Redis failure should not crash the app in development
    if (env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis disconnected');
  }
}

// Convenience helpers
export const redis = {
  get: (key: string) => getRedisClient().get(key),
  set: (key: string, value: string, ttlSeconds?: number) => {
    if (ttlSeconds) {
      return getRedisClient().set(key, value, 'EX', ttlSeconds);
    }
    return getRedisClient().set(key, value);
  },
  del: (key: string | string[]) => {
    const keys = Array.isArray(key) ? key : [key];
    return getRedisClient().del(...keys);
  },
  exists: (key: string) => getRedisClient().exists(key),
  expire: (key: string, seconds: number) => getRedisClient().expire(key, seconds),
  ttl: (key: string) => getRedisClient().ttl(key),
  keys: (pattern: string) => getRedisClient().keys(pattern),
};
