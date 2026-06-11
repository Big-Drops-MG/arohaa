# Build from repo root:
#   docker build -f apps/api/Dockerfile -t arohaa-api .
#
# Run locally (env from dashboard .env.local mounted or -e flags):
#   docker run --rm -p 3001:3001 --env-file apps/dashboard/.env.local -e NODE_ENV=production arohaa-api

FROM node:20-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app

FROM base AS deps

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/database/package.json packages/database/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/eslint-config/package.json packages/eslint-config/

RUN pnpm install --frozen-lockfile --filter @workspace/api...

FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/database/node_modules ./packages/database/node_modules

COPY apps/api/package.json apps/api/
COPY apps/api/tsconfig.json apps/api/
COPY apps/api/src apps/api/src
COPY packages/database/package.json packages/database/
COPY packages/database/src packages/database/src
COPY packages/typescript-config packages/typescript-config

WORKDIR /app/apps/api

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3001) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["pnpm", "start"]
