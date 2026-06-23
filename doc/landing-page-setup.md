# Landing page setup and deployment guide

This guide covers how to register a landing page in the Arohaa dashboard, install tracking on the live site, and keep **code** and **database** aligned across `dev` and `main`.

For SDK integration details (Webflow, WordPress, static HTML, etc.), see [sdk-landing-pages.md](./sdk-landing-pages.md).

---

## Environments

| Environment           | Dashboard URL            | Git branch | Neon DB branch |
| --------------------- | ------------------------ | ---------- | -------------- |
| Development / preview | `https://dev.arohaa.net` | `dev`      | Neon `dev`     |
| Production            | `https://www.arohaa.net` | `main`     | Neon `main`    |

**Ingest API (events):** `https://api.arohaa.net`

All authenticated dashboard users see the same landing pages (shared team list). New pages are still stored under the creator’s workspace for quota purposes, but everyone can view and manage them.

---

## Prerequisites

Before adding a landing page, confirm you can log in to the dashboard with:

- Email + password
- Two-factor authentication enabled
- Onboarding completed (name, role, etc.)

The live landing page must be reachable over **HTTPS** (or HTTP for local testing only). The URL you enter in the dashboard must match the **canonical public URL** visitors actually land on — including `www` vs non-`www`. If the site redirects `example.com` → `www.example.com`, register `https://www.example.com/`. A mismatch breaks HTML verification and event ingest (`HOSTNAME_MISMATCH`).

---

## Part 1 — Create a landing page in the dashboard

### 1. Open the dashboard

- Dev: `https://dev.arohaa.net/dashboard`
- Production: `https://www.arohaa.net/dashboard`

### 2. Start the wizard

Click **Add New** (or go to `/dashboard/new-landing`).

### 3. Step 1 — Basic details

Fill in:

| Field                | Required | Notes                                                                                                  |
| -------------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| **Brand name**       | Yes      | Shown in the dashboard and sidebar                                                                     |
| **Landing page URL** | Yes      | Full **canonical** public URL, e.g. `https://www.example.com/` (use `www` if the site redirects there) |
| **Favicon URL**      | No       | `http` or `https` image URL for the card icon                                                          |
| **Form type**        | Yes      | `Single Step`, `Multi Step`, or `Zip` — affects funnel analytics                                       |

Click **Continue**. The server creates the landing page and returns:

- A **public ID** (e.g. `lp_…` or a short id)
- An **SDK script tag** to paste on the site
- An optional **HTML verification meta tag**

### 4. Step 2 — Install the SDK snippet

Copy the snippet from the dashboard. Production loads the bundle from **`https://cdn.arohaa.net/sdk.js`** (built from `packages/sdk` in this repo).

**Recommended install (queue stub + main script)**

Paste both blocks as high as possible inside `<head>` on every tracked page:

```html
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
  data-formtype="single"
></script>
```

| Attribute       | Required | Notes                                                                                    |
| --------------- | -------- | ---------------------------------------------------------------------------------------- |
| `data-wid`      | Yes      | Workspace UUID from the dashboard                                                        |
| `data-api`      | Yes      | Ingest API base only: `https://api.arohaa.net` (no `/v1/ingest` suffix)                  |
| `data-lp-id`    | Yes      | Landing page public ID (`lp_…`) from the wizard                                          |
| `data-page`     | Yes      | Hostname only — must match the registered landing page hostname (e.g. `www.example.com`) |
| `data-formtype` | Yes      | `single`, `multiple`, or `zip` — must match the form type chosen in the dashboard        |

**Form type quick reference**

| Dashboard form type | `data-formtype` | Typical landing pattern                                                                    |
| ------------------- | --------------- | ------------------------------------------------------------------------------------------ |
| Single Step         | `single`        | Full lead form POSTing to `/api/submit-form`                                               |
| Multi Step          | `multiple`      | Multi-step form with `data-arohaa-step` on step containers                                 |
| Zip                 | `zip`           | Zip capture widget; see [sdk-landing-pages.md — Zip landing pages](./sdk-landing-pages.md) |

**Where to put it**

- As high as possible inside `<head>` on every page you want tracked.
- On Webflow: Project settings → Custom code → Head.
- On WordPress: site header via a child theme or a header-code plugin.
- On **Next.js** (App Router): root `layout.tsx` `<head>` — see [sdk-landing-pages.md](./sdk-landing-pages.md#nextjs-app-router--landing-app-in-the-monorepo-or-separate-repo).

**Optional HTML verification**

If you cannot install the script immediately, paste the meta tag into `<head>`:

```html
<meta name="arohaa-verify" content="…" />
```

Then use **Check HTML verification** in the dashboard. View **page source** on the live URL (not only React DevTools) to confirm the tag is present.

### 5. Step 3 — Verify connection

1. Publish the site with the snippet (or meta tag) live.
2. In the dashboard, click **Check connection**.
3. The dashboard polls until it sees the SDK or HTML verification (up to ~90 seconds).

**Manual checks**

- **View source** on the live homepage: `arohaa-verify`, the queue stub, and `cdn.arohaa.net/sdk.js` are present.
- Browser DevTools → Network: `sdk.js` loads with **200**.
- After a page view, **`POST https://api.arohaa.net/v1/ingest`** returns **202**.
- No CORS errors from the landing page origin.
- If you use Vercel or similar, confirm the deploy that contains the snippet is **production** (pushed to the branch the host builds from).

### 6. Confirm in the dashboard

After verification, the landing page appears on `/dashboard` and in the project dropdown. Open `/dashboard/{publicId}` to view analytics (overview, traffic, funnel, etc.).

---

## Part 2 — Code changes (if the landing app lives in this repo or a client repo)

Some landing pages are separate apps (e.g. under `apps/` in this monorepo, or client repos such as `landing-pages` / `Nation-One-Debt-Relief`). If you add or change the SDK in code:

### 1. Work on `dev`

```bash
git checkout dev
git pull origin dev
```

Make your changes (snippet in layout, env vars, etc.), then run locally:

```bash
pnpm install
pnpm --filter dashboard dev
# or the specific landing app, e.g. pnpm --filter auto-assuritii dev
```

### 2. Lint and typecheck

From the repo root:

```bash
pnpm lint
pnpm typecheck
```

Fix any errors before pushing.

### 3. Commit on `dev`

```bash
git add <files>
git commit -m "feat(dashboard): add SDK tracking to example landing page"
git push origin dev
```

Vercel deploys `dev.arohaa.net` from the `dev` branch. Wait for the build to finish, then test.

### 4. Promote to `main` (production)

When dev looks good, merge into `main` and push:

```bash
git checkout main
git pull origin main
git merge dev
git push origin main
```

Then fast-forward `dev` so both branches stay identical:

```bash
git checkout dev
git merge main
git push origin dev
```

Verify both point to the same commit:

```bash
git rev-parse origin/main origin/dev
```

The two SHAs should match.

### 5. Recommended workflow (avoid drift)

1. Develop and test on **`dev`** → `dev.arohaa.net`
2. Merge **`dev` → `main`** when ready for production
3. Merge **`main` → `dev`** immediately after so branches stay in sync
4. Never leave fixes on only one branch for long

---

## Part 3 — Keep the database in sync

Landing pages are stored in **Neon Postgres**. The `dev` and `main` Neon branches can diverge if pages are created on only one environment.

### When to sync

- A page exists on production but not on `dev.arohaa.net`
- Page counts differ between environments
- After a long period of testing on only one environment

### Reset Neon `dev` from `main`

In the [Neon console](https://console.neon.tech), open project **Arohaa** and reset branch **`dev`** from **`main`**.

Or ask a teammate with Neon MCP access to run a reset (optionally preserving the old dev state under a backup branch name).

After reset, both DB branches have the same landing pages. **Redeploy or hard-refresh** the dashboard.

### Long-term option

Point Vercel Preview’s `DATABASE_URL` to the **main** Neon connection string so dev and production always share one database. Only do this if the team accepts shared data (test creates affect production).

---

## Part 4 — Checklist

### New landing page (external site)

- [ ] Created in dashboard (`/dashboard/new-landing`)
- [ ] Registered **canonical** URL (correct `www` / hostname)
- [ ] Queue stub + SDK script in `<head>` on the live URL
- [ ] `data-lp-id`, `data-wid`, `data-page`, and `data-formtype` match the dashboard
- [ ] Connection verified in dashboard
- [ ] Ingest `POST /v1/ingest` returns 202 from the live site
- [ ] Page visible to other team members on `/dashboard`

### Code in this monorepo

- [ ] Changes committed on `dev` and pushed
- [ ] Tested on `dev.arohaa.net`
- [ ] Merged `dev` → `main` and pushed
- [ ] Synced `dev` back to `main` (same commit SHA)
- [ ] Production deploy green on Vercel

### Database

- [ ] If environments disagree, reset Neon `dev` from `main` (or use shared `DATABASE_URL`)

---

## Troubleshooting

| Problem                                   | Likely cause                              | Fix                                                                                                       |
| ----------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Only your pages show, not teammates’      | Old deployment without shared list fix    | Ensure `dev` and `main` are on the same commit; redeploy Vercel                                           |
| Fewer pages on dev than production        | Neon `dev` DB behind `main`               | Reset Neon `dev` from `main`                                                                              |
| Connection check never passes             | Snippet not published, wrong URL, or CORS | Confirm live HTML (view source), correct `data-api`, API allows origin                                    |
| SDK not detected but code is in Git       | Host has not deployed latest commit       | Redeploy production; hard-refresh live site                                                               |
| HTML verify fails with redirect error     | Registered URL ≠ canonical host (`www`)   | Update landing page URL in dashboard to match live redirect target                                        |
| Events in Network tab but dashboard empty | `data-page` / hostname mismatch           | Align dashboard URL, `data-page`, and actual `window.location.hostname`                                   |
| `form_start` but no `form_success`        | Redirect fires before conversion sends    | See [sdk-landing-pages.md](./sdk-landing-pages.md#do-not-navigate-synchronously-right-after-a-conversion) |
| `401` / cannot create page                | 2FA or onboarding incomplete              | Finish profile and 2FA in dashboard                                                                       |
| `403` landing page limit                  | Quota per workspace (default 100)         | Archive unused pages or raise `LANDING_PAGES_MAX_PER_WORKSPACE`                                           |

---

## Related docs

- [sdk-landing-pages.md](./sdk-landing-pages.md) — SDK embed patterns by platform
- [todo.md](./todo.md) — backend implementation notes and schema reference
