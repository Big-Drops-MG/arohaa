import {
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { landingPages } from './landing-pages.js';

export const experiments = pgTable('experiment', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  landingPageId: text('landingPageId')
    .notNull()
    .references(() => landingPages.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  status: text('status').notNull().default('Running'),
  variants: jsonb('variants').$type<string[]>().notNull(),
  startDate: timestamp('startDate', { mode: 'date' }).notNull().defaultNow(),
  highlighted: text('highlighted'), // e.g. "true" or null
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
});
