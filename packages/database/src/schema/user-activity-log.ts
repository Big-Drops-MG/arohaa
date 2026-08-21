import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'
import { users } from './auth.js'

/**
 * Dashboard user activity (tab visits, clicks, navigation, and important actions).
 * Separate from landing_page_audit_log, which is project-mutation focused.
 */
export const userActivityLogs = pgTable(
  'user_activity_log',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    actorUserId: text('actorUserId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** page_view | tab_view | button_click | nav_click | action */
    eventType: text('eventType').notNull(),
    /** Short human-readable title, e.g. "Opened Overview tab" */
    summary: text('summary').notNull(),
    path: text('path'),
    tab: text('tab'),
    projectPublicId: text('projectPublicId'),
    targetLabel: text('targetLabel'),
    targetHref: text('targetHref'),
    ipAddress: text('ipAddress'),
    userAgent: text('userAgent'),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    actorCreatedIdx: index('user_activity_log_actor_created_idx').on(
      t.actorUserId,
      t.createdAt,
    ),
  }),
)
