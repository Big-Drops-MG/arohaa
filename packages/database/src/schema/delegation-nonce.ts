import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { users } from './auth.js'

export const usedDelegationNonce = pgTable(
  'used_delegation_nonce',
  {
    nonce: text('nonce').primaryKey(),
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expiresAt', { mode: 'date' }).notNull(),
  },
  (t) => ({
    expiresAtIdx: index('used_delegation_nonce_expires_at_idx').on(t.expiresAt),
  }),
)
