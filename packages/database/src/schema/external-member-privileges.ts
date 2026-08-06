import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './auth.js';

/** Empty string section = whole-tab grant (tabs without a section catalog). */
export const externalMemberPrivileges = pgTable(
  'external_member_privilege',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    landingPagePublicId: text('landingPagePublicId').notNull(),
    tab: text('tab').notNull(),
    section: text('section').notNull().default(''),
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    grantUid: uniqueIndex('external_member_privilege_uidx').on(
      t.userId,
      t.landingPagePublicId,
      t.tab,
      t.section,
    ),
  }),
);

/** One or more forced utm_source values per project for an external collaborator. */
export const externalMemberProjectScopes = pgTable(
  'external_member_project_scope',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    landingPagePublicId: text('landingPagePublicId').notNull(),
    utmSource: text('utmSource').notNull(),
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    scopeUid: uniqueIndex('external_member_project_scope_uidx').on(
      t.userId,
      t.landingPagePublicId,
      t.utmSource,
    ),
  }),
);
