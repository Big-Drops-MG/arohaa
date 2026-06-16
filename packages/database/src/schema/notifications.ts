import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './auth.js';
import { landingPages } from './landing-pages.js';

export const notifications = pgTable(
  'notification',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    severity: text('severity').notNull().default('alert'),
    landingPageId: text('landingPageId').references(() => landingPages.id, {
      onDelete: 'cascade',
    }),
    landingPagePublicId: text('landingPagePublicId'),
    href: text('href'),
    sourceType: text('sourceType'),
    sourceId: text('sourceId'),
    readAt: timestamp('readAt', { mode: 'date' }),
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    userSourceUid: uniqueIndex('notification_user_source_uidx')
      .on(t.userId, t.sourceType, t.sourceId)
      .where(sql`${t.sourceType} IS NOT NULL AND ${t.sourceId} IS NOT NULL`),
    userReadCreatedIdx: index('notification_user_read_created_idx').on(
      t.userId,
      t.readAt,
      t.createdAt,
    ),
  }),
);
