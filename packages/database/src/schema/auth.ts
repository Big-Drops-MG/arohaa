import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import type { AdapterAccountType } from '@auth/core/adapters';

export const users = pgTable('user', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  firstName: text('firstName'),
  lastName: text('lastName'),
  role: text('role'),
  email: text('email').unique(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  image: text('image'),
  password: text('password'),
  isTwoFactorEnabled: boolean('isTwoFactorEnabled').default(false),
  pendingTwoFactorSecret: text('pendingTwoFactorSecret'),
  twoFactorSecret: text('twoFactorSecret'),
  lastSeenAt: timestamp('lastSeenAt', { mode: 'date' }),
  /** pending → awaiting team approval; approved → full access; rejected → blocked */
  accessStatus: text('accessStatus').notNull().default('pending'),
  accessReviewedAt: timestamp('accessReviewedAt', { mode: 'date' }),
  accessReviewedByUserId: text('accessReviewedByUserId'),
  /** internal → company roster; external → partner / collaborator */
  teamKind: text('teamKind').notNull().default('internal'),
  /** full → all actions; read_only → view data only (no create/edit/download) */
  accessLevel: text('accessLevel').notNull().default('full'),
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
