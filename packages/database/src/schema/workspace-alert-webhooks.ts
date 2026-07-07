import { sql } from 'drizzle-orm'
import { boolean, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { workspaces } from './workspace.js'

export const workspaceAlertWebhooks = pgTable(
  'workspace_alert_webhook',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspaceId')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    url: text('url').notNull(),
    provider: text('provider').notNull().default('slack'),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
    deletedAt: timestamp('deletedAt', { mode: 'date' }),
  },
  (t) => ({
    activeWorkspaceIdx: index('workspace_alert_webhook_workspace_active_idx')
      .on(t.workspaceId)
      .where(sql`${t.deletedAt} IS NULL`),
  }),
)
