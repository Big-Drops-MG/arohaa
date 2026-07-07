import { sql } from 'drizzle-orm'
import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { users } from './auth.js'
import { workspaces } from './workspace.js'

export const workspaceApiKeys = pgTable(
  'workspace_api_key',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspaceId')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    keyPrefix: text('keyPrefix').notNull(),
    keyHash: text('keyHash').notNull(),
    createdByUserId: text('createdByUserId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
    revokedAt: timestamp('revokedAt', { mode: 'date' }),
    lastUsedAt: timestamp('lastUsedAt', { mode: 'date' }),
  },
  (t) => ({
    activeWorkspaceIdx: index('workspace_api_key_workspace_active_idx')
      .on(t.workspaceId)
      .where(sql`${t.revokedAt} IS NULL`),
  }),
)
