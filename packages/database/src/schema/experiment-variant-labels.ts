import { pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { experiments } from './experiments.js'

export const experimentVariantLabels = pgTable(
  'experiment_variant_label',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    experimentId: text('experimentId')
      .notNull()
      .references(() => experiments.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    experimentLabelUid: uniqueIndex(
      'experiment_variant_label_experiment_label_uidx',
    ).on(t.experimentId, t.label),
  }),
)
