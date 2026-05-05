import {
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './auth';
import { workspaces } from './workspace';

export const landingPages = pgTable(
  'landing_page',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    publicId: text('publicId').notNull().unique(),
    workspaceId: text('workspaceId')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    createdByUserId: text('createdByUserId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    updatedByUserId: text('updatedByUserId').references(() => users.id, {
      onDelete: 'set null',
    }),
    brandName: text('brandName').notNull(),
    landingPageUrl: text('landingPageUrl').notNull(),
    normalizedUrl: text('normalizedUrl').notNull(),
    origin: text('origin').notNull(),
    hostname: text('hostname').notNull(),
    status: text('status').notNull().default('pending_verification'),
    sdkInstallStatus: text('sdkInstallStatus').notNull().default('waiting'),
    verificationMethod: text('verificationMethod'),
    verifiedAt: timestamp('verifiedAt', { mode: 'date' }),
    lastSeenAt: timestamp('lastSeenAt', { mode: 'date' }),
    lastEventAt: timestamp('lastEventAt', { mode: 'date' }),
    notes: text('notes'),
    htmlVerificationToken: text('htmlVerificationToken'),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
    deletedAt: timestamp('deletedAt', { mode: 'date' }),
  },
  (t) => ({
    workspaceNormalizedUid: uniqueIndex(
      'landing_workspace_normalized_active_uidx',
    )
      .on(t.workspaceId, t.normalizedUrl)
      .where(sql`${t.deletedAt} IS NULL`),
  }),
);

export const landingPageAuditLogs = pgTable('landing_page_audit_log', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  actorUserId: text('actorUserId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  landingPageId: text('landingPageId')
    .notNull()
    .references(() => landingPages.id, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  beforePayload: jsonb('beforePayload').$type<Record<string, unknown> | null>(),
  afterPayload: jsonb('afterPayload').$type<Record<string, unknown> | null>(),
  traceId: text('traceId'),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
});
