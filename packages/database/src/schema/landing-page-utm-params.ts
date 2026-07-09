import { pgEnum, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { landingPages } from './landing-pages.js'

export const landingPageUtmParamStatusEnum = pgEnum(
  'landing_page_utm_param_status',
  ['active', 'blocked'],
)

export const landingPageUtmParams = pgTable(
  'landing_page_utm_param',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    landingPageId: text('landingPageId')
      .notNull()
      .references(() => landingPages.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    value: text('value').notNull(),
    status: landingPageUtmParamStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    pageKeyValueUid: uniqueIndex('landing_page_utm_param_page_key_value_uidx').on(
      t.landingPageId,
      t.key,
      t.value,
    ),
  }),
)
