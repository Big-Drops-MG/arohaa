import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

export const vehicleModels = pgTable(
  'vehicle_model',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    year: integer('year').notNull(),
    makeCode: text('makeCode').notNull(),
    makeName: text('makeName').notNull(),
    modelCode: text('modelCode').notNull(),
    modelName: text('modelName').notNull(),
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    yearMakeModelUid: uniqueIndex('vehicle_model_year_make_model_uidx').on(
      table.year,
      table.makeCode,
      table.modelCode,
    ),
    yearMakeIdx: index('vehicle_model_year_make_idx').on(
      table.year,
      table.makeCode,
    ),
  }),
)
