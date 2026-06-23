# Arohaa analytics SDK — landing page integration

This document describes what the SDK does, which files to use, and how to embed it on external sites (Webflow, WordPress, static HTML, Next.js, and similar).

## What the SDK does

The browser SDK:

- Loads asynchronously so it does not block rendering.
- Queues calls made before the main bundle finishes loading (inline queue stub + `window.arohaa` command queue).
- Sends events to your ingestion API at `{apiBase}/v1/ingest`. On a **visible** page, events use `fetch` with `keepalive: true` so conversions survive an immediate redirect. `sendBeacon` is used only when the page is already hidden/unloading.
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

**Production CDN:** `https://cdn.arohaa.net/sdk.js` — deployed from `packages/sdk` on Vercel (`packages/sdk/vercel.json` rewrites `/sdk.js` → `/dist/sdk.js`). Rebuild with `pnpm --filter @workspace/sdk run build` and push `main` to publish.

For local or dashboard-hosted copies, the team also copies built files into `apps/dashboard/public/` (e.g. `https://your-dashboard.example/sdk.js`) so they are served as static assets.

## Required configuration

The main SDK script tag **must** include:

| Attribute    | Required | Meaning                                                                                                                      |
| ------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `data-wid`   | Yes      | Workspace ID (UUID string your backend expects).                                                                             |
| `data-api`   | Yes      | **Base URL only** for the ingestion API — no path suffix. The SDK appends `/v1/ingest`. Production: `https://api.arohaa.net` |
| `data-lp-id` | Yes      | Landing page public ID (`lp_…`) from the Arohaa dashboard. Events without a matching `lp_id` are not attributed to the page. |

Optional attributes (read from the same script element):

| Attribute       | Default          | Meaning                                                                                                                         |
| --------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `data-page`     | Current hostname | Logical page hostname — **must match** the URL registered in the dashboard (including `www`). Used with ingest hostname checks. |
| `data-variant`  | `A`              | A/B variant label.                                                                                                              |
| `data-formtype` | `single`         | One of `single`, `zip`, `multiple`. Must match the form type selected when the landing page was created.                        |

If `data-wid`, `data-api`, or `data-lp-id` is missing, initialization logs an error and tracking does not start reliably.

## Recommended integration: queue stub + script tag

Use the **inline queue stub** plus the **main script** in `<head>` so early user actions are queued until `sdk.js` loads. This is the pattern generated by the dashboard wizard and used in production Next.js layouts.

```html
<head>
  <meta name="arohaa-verify" content="YOUR_VERIFICATION_TOKEN" />

  <script>
    !(function (w) {
      if (w.arohaa) return
      var a = function () {
        ;(a.q = a.q || []).push(arguments)
      }
      a.q = []
      a.l = Date.now()
      w.arohaa = a
    })(window)
  </script>

  <script
    id="arohaa-sdk"
    src="https://cdn.arohaa.net/sdk.js"
    async
    data-wid="YOUR_WORKSPACE_UUID"
    data-api="https://api.arohaa.net"
    data-lp-id="lp_YOUR_PUBLIC_ID"
    data-page="www.example.com"
    data-formtype="zip"
  ></script>
</head>
```

The built `snippet.js` (optional) contains three string placeholders you **must replace** before publishing if you use that loader instead:

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

Recommended pattern (matches production landings such as Quotifii and Nation One Debt Relief):

```tsx
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="arohaa-verify" content="YOUR_VERIFICATION_TOKEN" />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "!function(w){if(w.arohaa)return;var a=function(){(a.q=a.q||[]).push(arguments)};a.q=[];a.l=Date.now();w.arohaa=a}(window);",
          }}
        />
        <script
          id="arohaa-sdk"
          src="https://cdn.arohaa.net/sdk.js"
          async
          data-wid="YOUR_WORKSPACE_UUID"
          data-api="https://api.arohaa.net"
          data-lp-id="lp_YOUR_PUBLIC_ID"
          data-page="www.example.com"
          data-formtype="single"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

Use `data-formtype="zip"` for zip landings and `single` / `multiple` for full lead forms. Set `data-page` to the **canonical hostname** registered in the dashboard.

You can also use `next/script` with `strategy="afterInteractive"`, but keep `id="arohaa-sdk"` and all `data-*` attributes on the tag that loads the bundle.

### Single-step landing pages (`data-formtype="single"`)

For a full lead form handled by your app API, point the form at your submit route so `form_success` only fires on a real successful response:

```html
<form method="POST" action="/api/submit-form">
  <input name="firstName" data-arohaa-field="firstName" />
  <input name="email" data-arohaa-field="email" />
  <button type="submit">Submit</button>
</form>
```

Phone CTAs use normal `tel:` links — no extra code:

```html
<a href="tel:+18664951543">Call us</a>
```

The SDK auto-fires `call_click` on any `<a href="tel:…">` click.

### Zip landing pages (`data-formtype="zip"`)

Zip funnels need the SDK script **and** zip widget markup. The SDK recognizes the whole zip widget (not only the input), which matters when the zip is **pre-filled** (e.g. geolocation) and the user's first action is clicking Submit.

**Required / recommended markup**

```html
<form data-arohaa-zip-form onsubmit="handleSubmit">
  <input data-arohaa-zip name="zip" maxlength="5" inputmode="numeric" />
  <button type="submit" data-arohaa-zip-submit>Get quote</button>
</form>
```

| Marker                   | Purpose                                                                                      |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| `data-arohaa-zip-form`   | Wrapper — any click/focus inside counts as zip engagement                                    |
| `data-arohaa-zip`        | Zip input (also: `name="zip"`, `data-arohaa-field="zip"`, or `[data-slot="zip-code-input"]`) |
| `data-arohaa-zip-submit` | Submit control for standalone zip CTAs outside a `<form>`                                    |

**Zip funnel events**

| Event          | When                                                                                                                                                             |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `zip_start`    | First interaction anywhere in the zip widget (input, submit button, or container). Also fired before every `zip_submit` so Started ≥ Submitted in the dashboard. |
| `zip_submit`   | Valid zip submitted (`data-formtype="zip"` on the SDK script)                                                                                                    |
| `form_start`   | Generic form engagement (also fires for zip forms)                                                                                                               |
| `form_success` | Successful conversion                                                                                                                                            |

If you `preventDefault()` and redirect in React, defer navigation ~300ms so `keepalive` fetch can finish — see [Do not navigate synchronously](#do-not-navigate-synchronously-right-after-a-conversion).

**Reference implementation:** `landing-pages` repo → `apps/auto-insurance-quotifii` (`Hero.tsx`, `Options.tsx`, `app/layout.tsx`).

### Tracking buttons, links, and forms

Always guard the call so a missing SDK does not throw:

```javascript
if (typeof window !== "undefined" && window.arohaa) {
  window.arohaa("newsletter_submit", { source: "footer" })
}
```

- **Buttons:** `click` listener on `document` (event delegation) or per-element `addEventListener` after `DOMContentLoaded`.
- **Forms:** the SDK auto-tracks most real `<form>` flows and common zip patterns (see [Auto-tracked conversion events](#auto-tracked-conversion-events)). For custom/div-based funnels, iframe submits, or non-standard markup, fire events manually (see [Manual conversion events](#manual-conversion-events)).
- **Phone links:** `tel:` anchors fire `call_click` automatically.
- **Outbound links:** non-`tel:` links fire `link_click` on click.

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

### Auto-tracked conversion events

The SDK fires these without manual `window.arohaa` calls when markup matches the patterns below.

| Event              | When it fires                                                                                                                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `call_click`       | Click on an `<a href="tel:…">` link.                                                                                                                                                                             |
| `form_start`       | First focus or click inside a `<form>`, or first interaction with a zip / `data-arohaa-field` input outside a form.                                                                                              |
| `zip_start`        | First interaction anywhere in a zip widget (`data-arohaa-zip-form`, zip input, or `data-arohaa-zip-submit`). Idempotent per session; also ensured before `zip_submit`. Requires `data-formtype="zip"`.           |
| `form_field_focus` | Focus on inputs inside a `<form>`, or on fields marked with `data-arohaa-field` / zip markers (see below).                                                                                                       |
| `form_submit`      | Native `<form>` `submit` event (capture phase).                                                                                                                                                                  |
| `form_success`     | On `<form>` submit when the form does **not** POST to same-origin `/api/submit-form` (external redirect, GET, etc.), **or** after a successful POST to `/api/submit-form` via `fetch`. Deduplicated per session. |
| `zip_submit`       | Same moment as `form_success` when `data-formtype="zip"` on the SDK script.                                                                                                                                      |

**Zip / field markup the SDK recognizes**

- Zip input: `data-arohaa-zip`, `data-arohaa-field="zip"`, `name="zip"`, or input inside `[data-slot="zip-code-input"]`.
- Zip container: `data-arohaa-zip-form` on the `<form>` or wrapper — clicks on the submit button count as zip engagement even when the zip was pre-filled.
- Standalone zip submit (no `<form>`): put `data-arohaa-zip-submit` on the CTA and optional `data-arohaa-zip-form` on a wrapper; fires `form_submit`, `form_success`, and `zip_submit` when the zip value is 5 digits.
- Other fields: `data-arohaa-field="email"` (etc.) on inputs, with optional `data-arohaa-form` wrapper for `form_start` grouping.

**Real `<form>` external redirect (zip landings)**

```html
<form method="get" action="https://partner.example/quote">
  <input data-arohaa-zip name="zip" maxlength="5" inputmode="numeric" />
  <button type="submit">Check availability</button>
</form>
```

Set `data-formtype="zip"` on the SDK script. On submit, the SDK fires `form_submit`, `form_success`, and `zip_submit` before the browser navigates away.

**Do not navigate synchronously right after a conversion (important)**

On a visible page, conversions are sent with `fetch(..., { keepalive: true })`, which survives navigation much more reliably than `sendBeacon` with `application/json`. Still, if you call `preventDefault()` and redirect in the same handler, give the request a moment to flush before unloading:

This is the most common reason zip submissions show as started but not submitted when redirect timing is too aggressive. Two safe patterns:

1. **Let the real `<form>` navigate natively.** Put the destination on the form (`action` + `method`) and do not call `preventDefault()`. The SDK fires the conversion beacons on the `submit` event (capture phase) and the browser then navigates.
2. **If you must build the redirect URL in JS, defer the navigation a moment** so the beacon can flush. The SDK already dispatched the beacon on the `submit` event before your handler runs; a short delay just keeps the page alive long enough for it to complete:

```javascript
function handleSubmit(e) {
  e.preventDefault()
  const redirectUrl = buildRedirectUrl() // your params, UTM, zip, etc.
  // SDK already fired form_submit / form_success / zip_submit on this submit event.
  // Give the beacon ~300ms to flush before unloading the page.
  setTimeout(() => {
    window.location.href = redirectUrl
  }, 300)
}
```

Do **not** add a manual `window.arohaa("form_success")` in the same handler when the SDK already auto-tracks the `<form>` submit — it produces a duplicate `form_success`. Rely on the auto-tracking, or fire manual events only for div/JS-based funnels the SDK cannot see (see [Manual conversion events](#manual-conversion-events)).

### Manual conversion events

Fire these yourself when auto-tracking cannot see the interaction:

```javascript
// when the user begins a custom/div-based funnel (no <form> / no recognized markers)
window.arohaa("form_start")

// multi-step funnels without data-arohaa-step on each step container
window.arohaa("form_step_view", { stepIndex: 1 })

// custom fields in div-based UIs (no data-arohaa-field on inputs)
window.arohaa("form_field_focus", { fieldName: "email" })

// success only via JS (fetch to a third-party API, iframe postMessage, etc.)
window.arohaa("form_success")

// zip landings built without <form> and without data-arohaa-zip-submit
window.arohaa("zip_submit")

// phone CTAs that are buttons/divs instead of tel: links
window.arohaa("call_click", { href: "tel:+15551234567" })
```

Which events matter per `data-formtype` (auto-tracked when markup matches above):

| `data-formtype` | Funnel labels                 | Expected events                                                                         |
| --------------- | ----------------------------- | --------------------------------------------------------------------------------------- |
| `zip`           | Zip Started / Zip Submitted   | `zip_start`, `form_start`, `form_success`, `zip_submit` (auto when markup matches)      |
| `single`        | Form Started / Form Submitted | `form_start`, `form_success`, `call_click` on `tel:` links, optional `form_field_focus` |
| `multiple`      | Form Started / Form Submitted | `form_start`, `form_step_view` per step, `form_success`, optional `form_field_focus`    |

`form_step_view` is auto-tracked when step containers use `data-arohaa-step` (see `form-step-tracking.ts`). `form_success` is the canonical "submitted" event used across Overview, Funnel, Traffic, Segments, and Experiments.

## Alternative: single script tag (no queue stub)

You can skip the inline queue stub if you do not need early queuing (not recommended for hero CTAs above the fold):

```html
<script
  id="arohaa-sdk"
  async
  src="https://cdn.arohaa.net/sdk.js"
  data-wid="00000000-0000-0000-0000-000000000000"
  data-api="https://api.arohaa.net"
  data-lp-id="lp_YOUR_PUBLIC_ID"
  data-page="www.example.com"
  data-formtype="single"
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
2. Push to `main` — Vercel rebuilds `https://cdn.arohaa.net/sdk.js` from `packages/sdk` (cache ~5–10 minutes).
3. Or upload `dist/sdk.js` and `dist/sdk.v1.js` to your own CDN.
4. Confirm `GET` of `sdk.js` returns `200` and correct `Content-Type` (`application/javascript` or `text/javascript`).
5. In browser devtools, verify `POST {apiBase}/v1/ingest` returns `202` and response headers include `x-trace-id` when testing.

## Troubleshooting

| Symptom                                                         | Likely cause                                                                                                                                                                 |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Console: missing `data-wid` / `data-api`                        | Attributes not on the script that loads `sdk.js`, or snippet did not pass `apiBase` so `data-api` was never set.                                                             |
| SDK in Git but not on live site                                 | Production host has not deployed latest commit — view **page source**, not only DevTools.                                                                                    |
| Connection / verify fails                                       | Dashboard URL hostname ≠ canonical live URL (`www` redirect). Update the registered URL to match where users land.                                                           |
| CORS errors in Network tab                                      | API `Access-Control-Allow-Origin` does not include the page origin.                                                                                                          |
| Events only appear after reconnect                              | Working as designed: outbox drains on `online` / visibility / load after transient failures.                                                                                 |
| `form_start` tracked but `form_success` / `zip_submit` are zero | Page redirects too quickly after submit. Defer redirect ~300ms or let the form navigate natively (see above).                                                                |
| Zip Started ≪ Zip Submitted (historical)                        | Old SDK only fired `zip_start` on input focus; upgrade `cdn.arohaa.net/sdk.js` and use `data-arohaa-zip-form` markup. API funnel also clamps using `form_start` as fallback. |
| 400 from API                                                    | Body failed JSON schema validation (event name pattern, UUID format for `wid`, etc.).                                                                                        |

## Further reading (code)

- Snippet loader: `packages/sdk/src/snippet.ts`
- Global + queue drain: `packages/sdk/src/sdk.ts`
- Config resolution: `packages/sdk/src/model/config.ts`
- Transport and outbox: `packages/sdk/src/services/network.service.ts`, `packages/sdk/src/network/retry.ts`
- Form + zip tracking: `packages/sdk/src/events/form-tracking.ts`, `packages/sdk/src/events/zip.events.ts`, `packages/sdk/src/events/form-dom.utils.ts`
