import "server-only"
import { bootstrapDashboardEnv } from "@/lib/server/env"

bootstrapDashboardEnv(import.meta.url)

type SesConfig = {
  region: string
  accessKeyId: string
  secretAccessKey: string
  fromEmail: string
  fromName?: string
  configurationSetName?: string
}

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value || !value.trim()) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value.trim()
}

function requiredEnvAny(names: string[]): string {
  for (const name of names) {
    const value = process.env[name]
    if (value && value.trim()) {
      return value.trim()
    }
  }

  throw new Error(`Missing required env var: ${names.join(" or ")}`)
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name]
  if (!value || !value.trim()) return undefined
  return value.trim()
}

export function resolveSesConfig(): SesConfig {
  return {
    region: requiredEnvAny(["AWS_SES_REGION"]),
    accessKeyId: requiredEnvAny(["AWS_SES_ACCESS_KEY_ID"]),
    secretAccessKey: requiredEnvAny(["AWS_SES_SECRET_ACCESS_KEY"]),
    fromEmail: requiredEnv("AWS_SES_FROM_EMAIL"),
    fromName: optionalEnv("AWS_SES_FROM_NAME"),
    configurationSetName: optionalEnv("AWS_SES_CONFIGURATION_SET"),
  }
}
