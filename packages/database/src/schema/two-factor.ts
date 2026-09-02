import { pgTable, primaryKey, text, timestamp, bigint } from 'drizzle-orm/pg-core'
import { users } from './auth.js'

export const usedTotp = pgTable(
  'used_totp',
  {
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    periodCounter: bigint('periodCounter', { mode: 'number' }).notNull(),
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.periodCounter] }),
  }),
)


export const twoFactorSessionStamp = pgTable(
  'two_factor_session_stamp',
  {
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sessionJti: text('sessionJti').notNull(),
    verifiedAt: timestamp('verifiedAt', { mode: 'date' }).notNull(),
    expiresAt: timestamp('expiresAt', { mode: 'date' }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.sessionJti] }),
  }),
)

export const revokedJti = pgTable('revoked_jti', {
  jti: text('jti').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  revokedAt: timestamp('revokedAt', { mode: 'date' }).notNull().defaultNow(),
  expiresAt: timestamp('expiresAt', { mode: 'date' }).notNull(),
})
