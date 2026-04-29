import { pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

export const verificationTokens = pgTable(
  'verificationToken',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  }),
);

export const passwordResetTokens = pgTable('password_reset_token', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull(),
  token: text('token').unique().notNull(),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const twoFactorTokens = pgTable('two_factor_token', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull(),
  token: text('token').unique().notNull(),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});
