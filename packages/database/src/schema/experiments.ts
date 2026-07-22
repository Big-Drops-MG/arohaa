import {
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'
import { landingPages } from './landing-pages.js'

export type ExperimentStatus =
  | 'Draft'
  | 'Running'
  | 'Paused'
  | 'Completed'

export type ExperimentVariantLink = {
  label: string
  landingPageId: string
}

export const experiments = pgTable('experiment', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  landingPageId: text('landingPageId')
    .notNull()
    .references(() => landingPages.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  status: text('status').notNull().default('Running'),
  variants: jsonb('variants').$type<ExperimentVariantLink[]>().notNull(),
  controlLandingPageId: text('controlLandingPageId'),
  startDate: timestamp('startDate', { mode: 'date' }).notNull().defaultNow(),
  endDate: timestamp('endDate', { mode: 'date' }),
  highlighted: text('highlighted'),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
})
