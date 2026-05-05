import { config as loadEnv } from "dotenv"
import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export function bootstrapDatabaseEnv(metaUrl: string): void {
  const moduleDir = dirname(fileURLToPath(metaUrl))
  const packageEnv = resolve(moduleDir, "../../.env")
  const rootEnv = resolve(moduleDir, "../../../../.env")

  if (existsSync(packageEnv)) loadEnv({ path: packageEnv, override: false })
  if (existsSync(rootEnv)) loadEnv({ path: rootEnv, override: false })
}
