# Arohaa analytics SDK — landing page integration

This document describes what the SDK does, which files to use, and how to embed it on external sites (Webflow, WordPress, static HTML, Next.js, and similar).

## What the SDK does

The browser SDK:

- Loads asynchronously so it does not block rendering.
- Queues calls made before the main bundle finishes loading (snippet + command queue).
- Sends events to your ingestion API at `{apiBase}/v1/ingest` using `fetch` (with `keepalive` where appropriate) and `sendBeacon` when the page is hidden.
- Persists a durable anonymous `uid`, a sliding session `sid`, and a lightweight `fp` fingerprint in `localStorage` (privacy-oriented, no invasive cookies for identity).
- Attaches marketing fields from the current URL (UTM parameters) and `document.referrer` on every event.
- Optionally records Core Web Vitals (LCP, CLS, INP) and periodic visibility-aware heartbeats for engagement metrics.
- Uses an outbox in `localStorage` for failed sends (network or 5xx-class responses), with retries when the tab comes back online or becomes visible again.

The API validates payloads strictly; use sensible event names and JSON-serializable props.

## Build artifacts (monorepo)

From the repo root:

```bash
pnpm --filter @workspace/sdk run build
```

Outputs under `packages/sdk/dist/`:

| File              | Role                                                                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `snippet.js`      | Tiny loader: defines `window.arohaa` as a queue stub, injects the main script tag with `data-wid` / `data-api`. Paste this (after replacing placeholders) as high as possible in `<head>`. |
| `sdk.js`          | Current major-version bundle (IIFE). Loaded by the snippet.                                                                                                                                |
| `sdk.v{major}.js` | Same as `sdk.js` but pinned to the package’s semver major (e.g. `sdk.v1.js`). Use if you want stable major URLs without silent breaking changes across majors.                             |

For local or dashboard-hosted copies, the team also copies built files into `apps/dashboard/public/` (e.g. `https://your-dashboard.example/sdk.js`) so they are served as static assets.

## Required configuration

The main SDK script tag **must** include:

| Attribute  | Required | Meaning                                                                                                                                                                   |
| ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data-wid` | Yes      | Workspace ID (UUID string your backend expects).                                                                                                                          |
| `data-api` | Yes      | **Base URL only** for the ingestion API — no path suffix. The SDK appends `/v1/ingest`. Example: `https://ingest.example.com` not `https://ingest.example.com/v1/ingest`. |

Optional attributes (read from the same script element):

| Attribute       | Default          | Meaning                             |
| --------------- | ---------------- | ----------------------------------- |
| `data-page`     | Current hostname | Logical page / site label.          |
| `data-variant`  | `A`              | A/B variant label.                  |
| `data-formtype` | `single`         | One of `single`, `zip`, `multiple`. |

If `data-wid` or `data-api` is missing, initialization logs an error and tracking does not start.

## Recommended integration: snippet first

Use the **snippet** in `<head>` so early user actions are queued until `sdk.js` loads.

The built `snippet.js` contains three string placeholders you **must replace** with your real values before publishing:

- `__AROHAA_SDK_URL__` — full URL to `sdk.js` (or `sdk.v1.js`).
- `__AROHAA_WID__` — workspace UUID.
- `__AROHAA_API_BASE__` — ingestion API base URL (same rules as `data-api` above). Use an empty string only if you inject `data-api` another way; normally set the real base URL so the dynamically created script tag receives `data-api`.

Example after replacement (plain HTML):

```html
<head>
  <!-- ... -->
  <script>
    /* Paste contents of snippet.js here AFTER replacing the three __AROHAA_*__ strings,
       OR serve snippet.js from your CDN and use: */
  </script>
  <script src="https://cdn.example.com/arohaa/snippet.js" async></script>
</head>
```

If you serve the file as-is from disk/CDN, replace the placeholders in the minified file once (search-and-replace), or generate the snippet server-side with your CMS.

## How to apply on landing pages

Use this section when wiring the SDK onto a **marketing or client site** that is not the dashboard app itself. The goal is one global install (head) plus optional per-element calls for CTAs, forms, and key funnels.

### Placement rules (all platforms)

1. **Put the snippet as high as practical in `<head>`** (or the platform’s “Head” / “Before `</head>`” injection point). That maximizes the chance the stub exists before the user taps a hero CTA.
2. **Serve `sdk.js` and the snippet over HTTPS** on a stable URL (your CDN, the dashboard `public` URL, or object storage with long cache headers).
3. **Use one `data-wid` per workspace** (per customer or per property). Every event sent from that site carries that ID.
4. **`data-api` is only the origin + optional path prefix without `/v1/ingest`** — the SDK always posts to `{data-api}/v1/ingest`.
5. **Confirm CORS** on the API allows the landing page’s exact origin (scheme + host + port). Test from the real domain, not only `localhost`.

### Checklist before go-live

- [ ] Replaced `__AROHAA_SDK_URL__`, `__AROHAA_WID__`, `__AROHAA_API_BASE__` in the snippet (or equivalent inline script).
- [ ] Opened the site, DevTools → Network: `sdk.js` loads with **200**.
- [ ] After a navigation or interaction, **`POST …/v1/ingest`** returns **202** and response includes **`x-trace-id`**.
- [ ] No red CORS errors on the ingest request.
- [ ] (Optional) Turn off network briefly, trigger an event, go back online: event should eventually send (outbox drain).

### Static HTML, PHP, or hand-built templates

Paste the **entire minified snippet** (after placeholder replacement) inside `<head>`, before other scripts if possible:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Landing</title>
    <!-- Arohaa: paste customized snippet.js contents here (one IIFE block) -->
  </head>
  <body>
    <button type="button" id="cta">Get a quote</button>
    <script>
      document.getElementById("cta").addEventListener("click", function () {
        if (window.arohaa) window.arohaa("cta_click", { id: "cta" })
      })
    </script>
  </body>
</html>
```

Use the same pattern in PHP: `echo` the snippet from a shared layout partial so every page gets it once.

### Webflow

1. **Site-wide:** **Project settings** → **Custom code** → **Head code**. Paste the customized snippet (or `<script src="https://your-cdn/.../snippet.js"></script>` if you host a pre-filled file).
2. **Single page only:** Page **Settings** (gear on that page) → **Custom code** → **Inside `<head>`**.
3. **Designer + interactions:** For a button, you can add an **Embed** with a small script, or use **Custom attributes** on the element and a site-wide script that listens for clicks. Prefer one delegated listener in an Embed at the bottom of the page if you have many buttons.
4. **Publish** the site after changes; Webflow does not run custom head code on the Designer canvas the same way as production.

### WordPress

1. **Recommended:** a small plugin or **Code snippets** / **WPCode**–style plugin: add the snippet to “Run everywhere” / site header, not inside a single post’s content (avoids duplication).
2. **Theme `header.php`:** works, but updates to the theme can wipe it; use a **child theme** if you go this route.
3. **Page builders (Elementor, Bricks, etc.):** many offer a **Custom code** or **HTML** widget in the header template; use that so the script loads on all landing pages that share the template.
4. **Caching / minification plugins:** allowlist `arohaa` script URLs or disable JS combine for that file if the SDK fails to parse attributes after optimization.

### Shopify

1. **Online Store** → **Themes** → **Edit code** → `theme.liquid`.
2. Paste the snippet **before** `</head>` (or use a dedicated snippet section your theme documents).
3. If you use **Shopify Markets** or multiple storefronts, the same `data-wid` can still be used unless you intentionally split analytics per store.

### Google Tag Manager

1. Create a **Custom HTML** tag.
2. Paste the full customized snippet (inline IIFE). Hosting snippet as external `script src` is also fine if the file on the server already has placeholders replaced.
3. Trigger: **All Pages** (or **Consent Initialized** if you gate analytics behind a CMP).
4. **Tag ordering:** if other tags fire first and you need earliest queueing, use **Tag sequencing** (“Fire tag before …”) or place Arohaa high in the container’s priority.
5. Publish the container and test in **Preview** mode on the live hostname.

### Squarespace, Wix, Carrd, Framer, etc.

- **Squarespace:** **Settings** → **Advanced** → **Code injection** → **Header**.
- **Wix:** **Settings** → **Custom code** → add code to **Head**, apply to **All pages** or selected pages.
- **Carrd:** **Settings** of the site → **Custom Code** → **Head**.
- **Framer:** **Site settings** → **General** → **Custom Code** → **Head start** / documented head slot.

Each product labels the field differently; look for “header”, “head”, or “before `</head>`”.

### Next.js (App Router) — landing app in the monorepo or separate repo

Use `next/script` so Next deduplicates and you keep `data-*` on the script that loads the bundle:

```tsx
import Script from "next/script"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <Script
          id="arohaa-sdk"
          src="https://your-cdn.example/arohaa/sdk.js"
          strategy="afterInteractive"
          data-wid="YOUR-WORKSPACE-UUID"
          data-api="https://your-ingest.example.com"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

For **early queueing** on a Next marketing site, either paste the **inline snippet** into a small `Script` with `strategy="beforeInteractive"` (dangerouslySetInnerHTML only if you trust the string), or add the minified snippet file via `src` on a static `snippet.js` you control.

### Tracking buttons, links, and forms

Always guard the call so a missing SDK does not throw:

```javascript
if (typeof window !== "undefined" && window.arohaa) {
  window.arohaa("newsletter_submit", { source: "footer" })
}
```

- **Buttons:** `click` listener on `document` (event delegation) or per-element `addEventListener` after `DOMContentLoaded`.
- **Forms:** `form.addEventListener("submit", …)` — call `window.arohaa` before or after `preventDefault` depending on whether you handle AJAX yourself; the SDK does not auto-track forms.
- **Outbound links:** on `click`, fire `window.arohaa` then allow default navigation (the browser may use `sendBeacon` when the page unloads).

### Calling the SDK

After load, `window.arohaa` is a function you can call like a command stub **before** and **after** the full SDK loads:

```javascript
window.arohaa("button_click", { button_id: "cta-hero" })
```

You can also use the explicit method:

```javascript
window.arohaa.track("checkout_started", { step: 1 })
```

Queued stub calls are replayed automatically when the full SDK initializes.

## Alternative: single script tag (no snippet)

You can skip the snippet and load only the main bundle if you do not need early queuing:

```html
<script
  id="arohaa-sdk"
  async
  src="https://cdn.example.com/arohaa/sdk.js"
  data-wid="00000000-0000-0000-0000-000000000000"
  data-api="https://ingest.example.com"
></script>
```

The SDK resolves configuration from `document.currentScript`, `#arohaa-sdk`, or `script[data-wid][src*="sdk"]`.

## CORS

Browser `POST` requests to the API are cross-origin unless the page is served from the same host as the API. Your Fastify (or other) server must allow the landing page origin via `@fastify/cors` (or equivalent). Without that, the browser will block requests and the SDK may store events in the outbox until policy is fixed.

## Event naming and props

- Use consistent, lowercase/snake_case-style event names (e.g. `page_view`, `form_submit`).
- `props` must be a plain object with JSON-serializable values (strings, numbers, booleans, nested objects/arrays of the same). The API schema rejects unknown top-level fields on the body; custom data belongs under `props`.

## Rebuilding and publishing

1. Run `pnpm --filter @workspace/sdk run build`.
2. Upload `dist/snippet.js` (with placeholders replaced or templated), `dist/sdk.js`, and optionally `dist/sdk.v1.js` to your CDN or static host.
3. Confirm `GET` of `sdk.js` returns `200` and correct `Content-Type` (`application/javascript` or `text/javascript`).
4. In browser devtools, verify `POST {apiBase}/v1/ingest` returns `202` and response headers include `x-trace-id` when testing.

## Troubleshooting

| Symptom                                  | Likely cause                                                                                                     |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Console: missing `data-wid` / `data-api` | Attributes not on the script that loads `sdk.js`, or snippet did not pass `apiBase` so `data-api` was never set. |
| CORS errors in Network tab               | API `Access-Control-Allow-Origin` does not include the page origin.                                              |
| Events only appear after reconnect       | Working as designed: outbox drains on `online` / visibility / load after transient failures.                     |
| 400 from API                             | Body failed JSON schema validation (event name pattern, UUID format for `wid`, etc.).                            |

## Further reading (code)

- Snippet loader: `packages/sdk/src/snippet.ts`
- Global + queue drain: `packages/sdk/src/sdk.ts`
- Config resolution: `packages/sdk/src/model/config.ts`
- Transport and outbox: `packages/sdk/src/services/network.service.ts`, `packages/sdk/src/network/retry.ts`
- Payload shape: `packages/sdk/src/model/event.ts`, `packages/sdk/src/types/index.ts`
