import { pgTable, serial, integer, text, unique } from "drizzle-orm/pg-core"

export const vehicleYears = pgTable("vehicle_years", {
  id: serial("id").primaryKey(),
  apiYearId: integer("api_year_id").notNull().unique(),
  year: integer("year").notNull(),
})

export const vehicleMakes = pgTable("vehicle_makes", {
  id: serial("id").primaryKey(),
  makeId: integer("make_id").notNull().unique(),
  name: text("name").notNull(),
  yearId: integer("year_id")
    .notNull()
    .references(() => vehicleYears.id),
})

export const vehicleModels = pgTable("vehicle_models", {
  id: serial("id").primaryKey(),
  modelId: integer("model_id").notNull(),
  name: text("name").notNull(),
  makeId: integer("make_id")
    .notNull()
    .references(() => vehicleMakes.id),
}, (table) => ({
  uniqueModelMake: unique().on(table.modelId, table.makeId),
}))
