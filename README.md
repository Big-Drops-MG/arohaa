# shadcn/ui monorepo template

This is a Next.js monorepo template with shadcn/ui.

## Environment Setup

To import environment variables from your Vercel project into this repo:

1. Log in once (if you have not already): `pnpm dlx vercel@latest login`
2. Link the **dashboard** app (where `vercel.json` lives) to the Vercel project:
   - Interactive: `pnpm vercel:link`
   - Non-interactive (CI or scripts): `pnpm dlx vercel@latest link --yes --cwd apps/dashboard --team <team-slug-or-id> --project <project-name-or-id>`
3. Pull **Development** env vars into `apps/dashboard/.env.local` (Next.js loads this automatically for `pnpm dev` in that app):

   ```bash
   pnpm vercel:env:pull
   ```

   Other targets: `pnpm dlx vercel@latest env pull --cwd apps/dashboard --environment preview` or `--environment production`.

4. In the Vercel dashboard, add integrations (for example Neon Postgres, Upstash Redis) so `DATABASE_URL`, `UPSTASH_REDIS_REST_URL`, and related variables exist on the project before you pull.

Root-only scripts (for example `init-clickhouse.ts`) read env from the **repository root**; either run `pnpm dlx vercel@latest env pull --cwd apps/dashboard ../../.env` after linking, or maintain a separate root `.env` for those keys.

## Adding components

To add components to your app, run the following command at the root of your `web` app:

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

This will place the ui components in the `packages/ui/src/components` directory.

## Using components

To use the components in your app, import them from the `ui` package.

```tsx
import { Button } from "@workspace/ui/components/button"
```
