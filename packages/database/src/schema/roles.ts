import { pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const roles = pgTable(
  'role',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    nameUid: uniqueIndex('role_name_uidx').on(t.name),
  }),
);
