/** Build copy-paste LP env + wiring snippets for Notification Center ops. */
export function buildLpWebPushOpsSnippet(input: {
  ingestBaseUrl: string | null
  landingPagePublicId: string
  vapidPublicKey: string | null
  webhookSecretPlaintext: string | null
}): { envFile: string; sdkAttr: string; checklist: string[] } {
  const api = (input.ingestBaseUrl ?? "https://api.arohaa.net").replace(
    /\/$/,
    ""
  )
  const vapid = input.vapidPublicKey ?? "<generate in Notification Center>"
  const secret =
    input.webhookSecretPlaintext ??
    "<paste secret shown once after Generate secret>"

  const envFile = [
    `# Landing page — Model B (forward via /api/push → Arohaa)`,
    `NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapid}`,
    `NEXT_PUBLIC_AROHAA_WID=${input.landingPagePublicId}`,
    `WEB_PUSH_AROHAA_API_BASE=${api}`,
    `WEB_PUSH_WEBHOOK_SECRET=${secret}`,
    `WEB_PUSH_SUBSCRIBE_URL=${api}/v1/web-push/subscriptions`,
    `WEB_PUSH_EVENTS_URL=${api}/v1/web-push/events`,
  ].join("\n")

  const sdkAttr = `data-web-push-proxy="/api/push"`

  const checklist = [
    "Generate VAPID + webhook secret in Notification Center",
    "Add env vars above to the LP (server secret never in the browser)",
    "Write public/sw.js from WEB_PUSH_SERVICE_WORKER_SOURCE (@workspace/lp-core)",
    "Add /api/push/{subscribe,unsubscribe,events} routes using forwardWebPush*",
    "Call useWebPush({ vapidPublicKey, proxyBase: '/api/push', wid, trackVisibility: true })",
    'Add data-web-push-proxy="/api/push" on the Arohaa SDK script tag',
    "Disable any LP-local abandon /api/push/send schedulers (Arohaa owns send)",
    "Create an active campaign (last_url + masked + frozen) and smoke-test subscribe → hide tab → push",
  ]

  return { envFile, sdkAttr, checklist }
}
