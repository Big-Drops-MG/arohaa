import { sql } from 'drizzle-orm';
import {
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './auth.js';

export const workspaces = pgTable(
  'workspace',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    ownerUserId: text('ownerUserId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull().default('Personal'),
    heatmapSampleRate: real('heatmapSampleRate').notNull().default(1),
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
    deletedAt: timestamp('deletedAt', { mode: 'date' }),
  },
  (t) => ({
    ownerUnique: uniqueIndex('workspace_owner_user_uidx')
      .on(t.ownerUserId)
      .where(sql`${t.deletedAt} IS NULL`),
  }),
);
