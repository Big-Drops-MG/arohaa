import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './auth.js';

export const externalMemberInviteTokens = pgTable('external_member_invite_token', {
  userId: text('userId')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
});

export const usedExternalInviteTokens = pgTable('used_external_invite_token', {
  tokenHash: text('tokenHash').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
});
