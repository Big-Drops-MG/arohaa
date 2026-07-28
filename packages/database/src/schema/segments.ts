import { sql } from 'drizzle-orm';
import {
  jsonb,
  pgTable,
  text,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
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
    name: text('name').notNull(),
    description: text('description'),
    conditions: jsonb('conditions').notNull(),
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdx: index('segment_workspace_id_idx').on(table.workspaceId),
  }),
);
