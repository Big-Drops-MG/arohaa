import { createWriteStream, existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGunzip } from 'node:zlib'
import { pipeline } from 'node:stream/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(__dirname, '../geoip')
const outPath = resolve(outDir, 'dbip-city-lite.mmdb')

function monthKeys() {
  const now = new Date()
  const cur = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0))
  const prevKey = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}`
  return [cur, prevKey]
}

async function download() {
  if (existsSync(outPath)) {
    console.log(`[geoip] already present at ${outPath}`)
    return
  }

  await mkdir(outDir, { recursive: true })

  for (const month of monthKeys()) {
    const url = `https://download.db-ip.com/free/dbip-city-lite-${month}.mmdb.gz`
    const res = await fetch(url)
    if (!res.ok || !res.body) continue

    const gunzip = createGunzip()
    const file = createWriteStream(outPath)
    await pipeline(res.body, gunzip, file)
    console.log(`[geoip] downloaded to ${outPath}`)
    return
  }

  throw new Error('Failed to download GeoIP database from db-ip.com')
}

download().catch((err) => {
  console.error('[geoip] download failed:', err.message)
  process.exit(1)
})
