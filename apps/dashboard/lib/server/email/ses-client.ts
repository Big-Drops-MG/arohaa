import "server-only"
import { SESv2Client } from "@aws-sdk/client-sesv2"
import { resolveSesConfig } from "@/lib/server/email/config"

let client: SESv2Client | null = null

export function getSesClient(): SESv2Client {
  if (client) return client

  const cfg = resolveSesConfig()
  client = new SESv2Client({
    region: cfg.region,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  })

  return client
}
