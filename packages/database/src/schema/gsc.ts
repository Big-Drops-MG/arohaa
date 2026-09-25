import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { workspaces } from "./workspace.js"

export const workspaceGscConnections = pgTable(
  "workspace_gsc_connection",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspaceId")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    refreshTokenEncrypted: text("refreshTokenEncrypted").notNull(),
    googleAccountEmail: text("googleAccountEmail"),
    status: text("status").notNull().default("active"),
    connectedAt: timestamp("connectedAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    workspaceUid: uniqueIndex("workspace_gsc_connection_workspace_uidx").on(
      t.workspaceId
    ),
  })
)
