import { Redis } from 'ioredis'
import { resolveRedisUrl } from '../lib/resolve-redis-url.js'

export const redis = new Redis(resolveRedisUrl(), {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

redis.on('error', (err: Error) => {
  console.error('Redis Connection Error:', err);
});
