# shadcn/ui monorepo template

This is a Next.js monorepo template with shadcn/ui.

## Environment Setup

To set up your local environment variables with Vercel:
1. Go to the Vercel project and install the Neon (Postgres) and Upstash Redis integrations.
2. Once linked, run the following command at the root of the project to pull down the `DATABASE_URL` and `UPSTASH_REDIS_REST_URL` into your local `.env` file:
   ```bash
   vercel env pull
   ```

## Adding components

To add components to your app, run the following command at the root of your `web` app:

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

This will place the ui components in the `packages/ui/src/components` directory.

## Using components

To use the components in your app, import them from the `ui` package.

```tsx
import { Button } from "@workspace/ui/components/button";
```
