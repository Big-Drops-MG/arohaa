import { config as loadEnv } from "dotenv"
import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export function bootstrapDatabaseEnv(metaUrl: string): void {
  const moduleDir = dirname(fileURLToPath(metaUrl))
  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../../.env"),
    resolve(process.cwd(), "../../../.env"),
    resolve(moduleDir, "../../.env"),
    resolve(moduleDir, "../../../../.env"),
  ]

  for (const path of candidates) {
    if (existsSync(path)) loadEnv({ path, override: false })
  }
}
