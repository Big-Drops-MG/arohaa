const LOCAL_REDIS_URL = 'redis://127.0.0.1:6379'

export function resolveRedisUrl(): string {
  const candidates = [
    process.env.REDIS_URL,
    process.env.UPSTASH_REDIS_URL,
    process.env.KV_URL,
  ]

  for (const value of candidates) {
    const trimmed = value?.trim()
    if (trimmed) {
      return trimmed
    }
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'REDIS_URL environment variable is missing (set it or add Upstash/Vercel Redis integration)',
    )
  }

  console.warn(
    `[redis] REDIS_URL not set; using ${LOCAL_REDIS_URL}. Start Redis with: docker compose up -d redis`,
  )
  return LOCAL_REDIS_URL
}
