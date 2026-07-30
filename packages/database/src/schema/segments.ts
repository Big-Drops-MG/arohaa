import { jsonb, pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';
import { landingPages } from './landing-pages.js';
import { workspaces } from './workspace.js';

export const segments = pgTable(
  'segment',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspaceId')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    landingPageId: text('landingPageId')
      .notNull()
      .references(() => landingPages.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    conditions: jsonb('conditions').notNull(),
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdx: index('segment_workspace_id_idx').on(table.workspaceId),
    landingPageIdx: index('segment_landing_page_id_idx').on(
      table.landingPageId,
    ),
  }),
);
