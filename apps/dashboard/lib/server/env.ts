import { config as loadEnv } from "dotenv"
import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export function bootstrapDashboardEnv(metaUrl: string): void {
  const moduleDir = dirname(fileURLToPath(metaUrl))
  const appEnv = resolve(moduleDir, "../../.env")
  const rootEnv = resolve(moduleDir, "../../../../.env")

  if (existsSync(appEnv)) loadEnv({ path: appEnv, override: false })
  if (existsSync(rootEnv)) loadEnv({ path: rootEnv, override: false })
}

export function resolveAuthSecret(): string | undefined {
  return process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
}
