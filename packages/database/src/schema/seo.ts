import {
  doublePrecision,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { landingPages } from './landing-pages.js';

export const seoResults = pgTable(
  'seo_result',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    landingPageId: text('landingPageId')
      .notNull()
      .references(() => landingPages.id, { onDelete: 'cascade' }),
    query: text('query').notNull(),
    pageUrl: text('pageUrl').notNull(),
    clicks: integer('clicks').notNull().default(0),
    impressions: integer('impressions').notNull().default(0),
    ctr: doublePrecision('ctr').notNull().default(0),
    position: doublePrecision('position').notNull().default(0),
    reportDate: timestamp('reportDate', { mode: 'date' }).notNull(),
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    landingQueryPageDateIdx: uniqueIndex('seo_result_lp_query_page_date_idx').on(
      table.landingPageId,
      table.query,
      table.pageUrl,
      table.reportDate,
    ),
  }),
);
