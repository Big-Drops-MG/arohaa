import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { createClient, ClickHouseClient } from '@clickhouse/client';
import { bootstrapDatabaseEnv } from './config/env.js';
import * as authSchema from './schema/auth.js';
import * as landingSchema from './schema/landing-pages.js';
import * as tokenSchema from './schema/tokens.js';
import * as workspaceSchema from './schema/workspace.js';
import * as experimentsSchema from './schema/experiments.js';
import * as experimentVariantLabelsSchema from './schema/experiment-variant-labels.js';
import * as notificationsSchema from './schema/notifications.js';
import * as seoSchema from './schema/seo.js';
import * as workspaceApiKeysSchema from './schema/workspace-api-keys.js';
import * as workspaceAlertWebhooksSchema from './schema/workspace-alert-webhooks.js';
import * as landingPageUtmParamsSchema from './schema/landing-page-utm-params.js';
import * as rolesSchema from './schema/roles.js';
import * as accessRolesSchema from './schema/access-roles.js';
import * as segmentsSchema from './schema/segments.js';
import * as externalMemberPrivilegesSchema from './schema/external-member-privileges.js';
import * as userActivityLogSchema from './schema/user-activity-log.js';
import * as twoFactorSchema from './schema/two-factor.js';
import * as delegationNonceSchema from './schema/delegation-nonce.js';
import * as externalInviteTokensSchema from './schema/external-invite-tokens.js';

const schema = {
  ...authSchema,
  ...landingSchema,
  ...workspaceSchema,
  ...tokenSchema,
  ...experimentsSchema,
  ...experimentVariantLabelsSchema,
  ...notificationsSchema,
  ...seoSchema,
  ...workspaceApiKeysSchema,
  ...workspaceAlertWebhooksSchema,
  ...landingPageUtmParamsSchema,
  ...rolesSchema,
  ...accessRolesSchema,
  ...segmentsSchema,
  ...externalMemberPrivilegesSchema,
  ...userActivityLogSchema,
  ...twoFactorSchema,
  ...delegationNonceSchema,
  ...externalInviteTokensSchema,
};

bootstrapDatabaseEnv(import.meta.url);

function resolveDatabaseUrl(): string {
  const url =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL
  if (!url) {
    throw new Error(
      'No database URL. Set DATABASE_URL (or POSTGRES_PRISMA_URL / POSTGRES_URL for Neon/Vercel).',
    )
  }
  return url
}

const sql = neon(resolveDatabaseUrl());
export const db = drizzle(sql, { schema });

export * from './schema/auth.js';
export * from './schema/landing-pages.js';
export * from './schema/workspace.js';
export * from './schema/tokens.js';
export * from './schema/experiments.js';
export * from './schema/experiment-variant-labels.js';
export * from './schema/notifications.js';
export * from './schema/seo.js';
export * from './schema/workspace-api-keys.js';
export * from './schema/workspace-alert-webhooks.js';
export * from './schema/landing-page-utm-params.js';
export * from './schema/roles.js';
export * from './schema/access-roles.js';
export * from './schema/segments.js';
export * from './schema/external-member-privileges.js';
export * from './schema/user-activity-log.js';
export * from './schema/two-factor.js';
export * from './schema/delegation-nonce.js';
export * from './schema/external-invite-tokens.js';
export * from './email.js';
export * from './notifications/create-notification.js';
export * from './landing/normalizeLandingPageUrl.js';
export * from './landing/generatePublicLandingId.js';
export * from './landing/experimentVariants.js';
export * from './landing/htmlVerificationToken.js';
export * from './workspace-api-keys/api-key.js';
export * from './workspace-api-keys/scopes.js';
export * from './internal-api/delegation.js';
export * from './alert-webhooks/dispatch.js';

export {
  WORKSPACE_API_KEY_SCOPE_ANALYTICS,
  WORKSPACE_API_KEY_SCOPE_DATA_EXPORT,
  WORKSPACE_API_KEY_SCOPES,
  type WorkspaceApiKeyScope,
} from './workspace-api-keys/scopes.js';

export * from 'drizzle-orm';

export let clickhouse: ClickHouseClient | null = null;
if (process.env.CLICKHOUSE_URL) {
  clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL,
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
  });
}

export * from './queries/events.js';
export * from './queries/segments.js';
