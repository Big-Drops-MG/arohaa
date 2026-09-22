# Landing-page web push contract (Model B)

Arohaa owns subscriptions, VAPID private keys, campaign scheduling, and direct `web-push` delivery. Landing pages own permission UX, subscribe/unsubscribe webhooks, lifecycle events, and the service worker.

## LP environment

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public key from Arohaa Notification Center>
NEXT_PUBLIC_AROHAA_WID=<landing page public UUID>
WEB_PUSH_AROHAA_API_BASE=https://api.arohaa.net
WEB_PUSH_WEBHOOK_SECRET=<secret from Notification Center · shown once>
WEB_PUSH_SUBSCRIBE_URL=https://api.arohaa.net/v1/web-push/subscriptions
WEB_PUSH_EVENTS_URL=https://api.arohaa.net/v1/web-push/events
```

Browser traffic should hit **same-origin** LP routes (`/api/push/*`). The LP server forwards to Arohaa with HMAC — never put `WEB_PUSH_WEBHOOK_SECRET` in client bundles.

Optional (debug / Model A fallback only; not used by Arohaa campaigns):

```env
VAPID_PRIVATE_KEY=...
WEB_PUSH_SEND_SECRET=...
```

## Phase LP ops (wiring)

Use `@workspace/lp-core` in the LP repo (or copy the helpers):

| Piece             | Export                                                     | Role                                                                        |
| ----------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------- |
| Browser subscribe | `useWebPush` / `subscribeWebPush`                          | Permission + PushManager + POST `/api/push/subscribe`                       |
| Visibility        | `attachWebPushVisibilityEvents` or `trackVisibility: true` | `page_hidden` / `page_visible`                                              |
| Server forward    | `forwardWebPushSubscribe` / `forwardWebPushEvent`          | Sign + POST Arohaa `/v1/web-push/*`                                         |
| Service worker    | `WEB_PUSH_SERVICE_WORKER_SOURCE`                           | Write to `public/sw.js` (opens payload `url`, including masked `/r/:token`) |
| SDK bridge        | `data-web-push-proxy="/api/push"` on arohaa-sdk script     | Extra visibility beacons via LP proxy                                       |

### Minimal LP page

```tsx
import { useWebPush } from "@workspace/lp-core/controller"

export function PushOptIn({ wid }: { wid: string }) {
  const push = useWebPush({
    vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    proxyBase: "/api/push",
    wid,
    trackVisibility: true,
  })
  return (
    <button
      type="button"
      disabled={push.busy}
      onClick={() => void push.subscribe()}
    >
      Enable notifications
    </button>
  )
}
```

### Minimal Next.js forwarder (`app/api/push/subscribe/route.ts`)

```ts
import { NextRequest, NextResponse } from "next/server"
import { forwardWebPushSubscribe } from "@workspace/lp-core/controller"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const result = await forwardWebPushSubscribe({
    config: {
      apiBase: process.env.WEB_PUSH_AROHAA_API_BASE!,
      webhookSecret: process.env.WEB_PUSH_WEBHOOK_SECRET,
    },
    action: body.action === "unsubscribe" ? "unsubscribe" : "subscribe",
    subscription: body.subscription,
    context: body.context,
  })
  return NextResponse.json(result.json, { status: result.status })
}
```

Mirror for `unsubscribe` and `events` (`forwardWebPushEvent`).

### SDK tag

```html
<script
  id="arohaa-sdk"
  data-wid="YOUR_WID"
  data-api="https://api.arohaa.net"
  data-web-push-proxy="/api/push"
  src="https://cdn.arohaa.net/sdk.js"
  async
></script>
```

## Masked click URLs (Phase 3)

Push notifications open an Arohaa short link, not the raw LP URL:

```text
https://<arohaa-api-host>/r/{clickId}
  → 302 → real destination (frozen at send, or fresh last_seen_url)
  → marks delivery clicked
  → destination includes `arohaa_click_id` + `utm_medium=web_push` for attribution
```

Also available as `/v1/web-push/r/{clickId}`.

**Service worker** (`WEB_PUSH_SERVICE_WORKER_SOURCE`) opens `data.url` and beacons `push_displayed` / `push_dismissed` to `/api/push/events` (or `data.events_path`) with `delivery_id` and `arohaa_click_id`.

**Attribution:** Notification Center Stats joins ClickHouse `form_success` / `zip_submit` / `service_click` where `url` contains `arohaa_click_id`, within 24h of click. Keep masked redirect on for accurate CTR and conversions.

Set on Arohaa (API + worker + dashboard):

```env
WEB_PUSH_CLICK_BASE_URL=https://api.arohaa.net
```

(falls back to `INGEST_BASE_URL` / local `http://127.0.0.1:3001`)

Campaign options in Notification Center:

| Option            | Meaning                                                                |
| ----------------- | ---------------------------------------------------------------------- |
| Masked click URL  | On by default when click base is configured                            |
| Resume **frozen** | Redirect to the URL captured when the push was sent (best for abandon) |
| Resume **fresh**  | Re-resolve from subscription `lastSeenUrl` at click time               |

## Media uploads (Phase 3)

Notification Center accepts paste HTTPS URLs always.

Optional S3 upload (dashboard):

```env
WEB_PUSH_MEDIA_S3_BUCKET=your-bucket
WEB_PUSH_MEDIA_S3_REGION=us-east-1
WEB_PUSH_MEDIA_CDN_BASE=https://cdn.arohaa.net
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

Bucket/CDN must serve objects publicly. If unset, paste-URL only.

## Webhook auth (Phase 2)

Once a webhook secret is generated for the landing page, every subscribe/event request must authenticate with one of:

1. **HMAC (preferred)** — `x-arohaa-web-push-signature: sha256=<HMAC-SHA256(secret, rawBody)>`
2. **Shared secret** — `x-arohaa-web-push-secret: <secret>` or `Authorization: Bearer <secret>`

If no secret is configured yet, unsigned webhooks are accepted (dev / gradual rollout).

## Subscribe / unsubscribe

`POST /v1/web-push/subscriptions`

```json
{
  "action": "subscribe",
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/...",
    "expirationTime": null,
    "keys": { "p256dh": "...", "auth": "..." }
  },
  "context": {
    "wid": "<landing page public UUID>",
    "origin": "https://example.com",
    "page_url": "https://example.com/?utm_source=fb&zip=90210&step=2",
    "timezone": "America/Los_Angeles",
    "session_id": "...",
    "zip": "90210",
    "step": 2
  }
}
```

Keep sending updated `page_url` / `step` on lifecycle events so resume works.

## Lifecycle events

`POST /v1/web-push/events` — same auth as subscribe.

Useful events: `page_hidden`, `page_visible`, `form_success`, `unsubscribe`, etc.

### Scheduling (Phase 2)

| Feature           | Behavior                                                     |
| ----------------- | ------------------------------------------------------------ |
| Delay after event | One delivery at `occurred_at + delayMs`                      |
| Drip              | N steps with delays from event + optional creative overrides |
| Cancel on         | Cancels queued deliveries for that campaign + subscription   |
| Quiet hours       | Defers until quiet end                                       |
| Frequency cap     | Max sends / subscription / 24h                               |

## Push payload

```json
{
  "title": "...",
  "body": "...",
  "url": "https://api.arohaa.net/r/clk_...",
  "data": {
    "campaign_id": "...",
    "arohaa_click_id": "clk_...",
    "delivery_id": "...",
    "target_url": "https://example.com/...?zip=90210"
  }
}
```

## Ops checklist

1. Generate VAPID + webhook secret in Notification Center (copy **LP wiring** env block).
2. Set `WEB_PUSH_CLICK_BASE_URL` on API/worker so masked links work.
3. On the LP: env + `public/sw.js` + `/api/push/*` forwarders + `useWebPush` + `data-web-push-proxy`.
4. Create campaign with **last_url** + **masked** + **frozen** resume for abandon.
5. Optional: configure S3 for icon/badge/banner uploads.
6. Disable LP-local abandon schedulers (`/api/push/send` timers).
7. Smoke: subscribe → hide tab → receive push → click → lands on resume URL + delivery shows `clicked`.
