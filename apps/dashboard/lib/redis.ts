import { Redis } from "@upstash/redis"

const url = process.env.KV_REST_API_URL || ""
const token = process.env.KV_REST_API_TOKEN || ""

if (!url || !token) {
  throw new Error(
    "KV_REST_API_URL or KV_REST_API_TOKEN is missing in .env.local"
  )
}

export const redis = new Redis({
  url,
  token,
})
