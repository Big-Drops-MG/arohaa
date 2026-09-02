import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import type { AdapterAccountType } from '@auth/core/adapters';
import { accessRoles } from './access-roles.js';

export const users = pgTable('user', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  firstName: text('firstName'),
  lastName: text('lastName'),
  role: text('role'),
  roleId: text('roleId')
    .notNull()
    .references(() => accessRoles.id, { onDelete: 'restrict' }),
  email: text('email').unique(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  image: text('image'),
  password: text('password'),
  isTwoFactorEnabled: boolean('isTwoFactorEnabled').default(false),
  pendingTwoFactorSecret: text('pendingTwoFactorSecret'),
  twoFactorSecret: text('twoFactorSecret'),
  lastSeenAt: timestamp('lastSeenAt', { mode: 'date' }),
  accessStatus: text('accessStatus').notNull().default('pending'),
  accessReviewedAt: timestamp('accessReviewedAt', { mode: 'date' }),
  accessReviewedByUserId: text('accessReviewedByUserId'),
  teamKind: text('teamKind').notNull().default('internal'),
  accessLevel: text('accessLevel').notNull().default('full'),
  sessionsInvalidBefore: timestamp('sessionsInvalidBefore', { mode: 'date' }),
});

export const accounts = pgTable(
  'account',
  {
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<AdapterAccountType>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  }),
);

export const sessions = pgTable('session', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});
