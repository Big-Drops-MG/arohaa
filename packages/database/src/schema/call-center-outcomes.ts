import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { landingPages } from "./landing-pages.js"
import { workspaces } from "./workspace.js"
import { users } from "./auth.js"

export const callCenterUploads = pgTable(
  "call_center_upload",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspaceId")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    landingPageId: text("landingPageId")
      .notNull()
      .references(() => landingPages.id, { onDelete: "cascade" }),
    fileName: text("fileName").notNull(),
    rowCount: integer("rowCount").notNull().default(0),
    contactedCount: integer("contactedCount").notNull().default(0),
    transferredCount: integer("transferredCount").notNull().default(0),
    duplicateCount: integer("duplicateCount").notNull().default(0),
    uploadedByUserId: text("uploadedByUserId").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    landingPageIdx: index("call_center_upload_landing_page_idx").on(
      table.landingPageId
    ),
    createdAtIdx: index("call_center_upload_created_at_idx").on(table.createdAt),
  })
)

export const callCenterLeadOutcomes = pgTable(
  "call_center_lead_outcome",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspaceId")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    landingPageId: text("landingPageId")
      .notNull()
      .references(() => landingPages.id, { onDelete: "cascade" }),
    uploadId: text("uploadId")
      .notNull()
      .references(() => callCenterUploads.id, { onDelete: "cascade" }),
    externalLeadId: text("externalLeadId").notNull(),
    sid: text("sid").notNull().default(""),
    tid: text("tid").notNull().default(""),
    uid: text("uid").notNull().default(""),
    sub1: text("sub1").notNull().default(""),
    leadType: text("leadType").notNull().default(""),
    state: text("state").notNull().default(""),
    homeowner: boolean("homeowner"),
    insured: boolean("insured"),
    vehicles: text("vehicles").notNull().default(""),
    status: text("status").notNull().default(""),
    duplicate: boolean("duplicate").notNull().default(false),
    ccContacted: boolean("ccContacted").notNull().default(false),
    ccDisposition: text("ccDisposition").notNull().default(""),
    ccTransferred: boolean("ccTransferred").notNull().default(false),
    duration15m: boolean("duration15m").notNull().default(false),
    duration20m: boolean("duration20m").notNull().default(false),
    occurredAt: timestamp("occurredAt", { mode: "date" }),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    landingExternalUidx: uniqueIndex(
      "call_center_lead_outcome_landing_external_uidx"
    ).on(table.landingPageId, table.externalLeadId),
    landingSidIdx: index("call_center_lead_outcome_landing_sid_idx").on(
      table.landingPageId,
      table.sid
    ),
    landingTidIdx: index("call_center_lead_outcome_landing_tid_idx").on(
      table.landingPageId,
      table.tid
    ),
    landingOccurredIdx: index(
      "call_center_lead_outcome_landing_occurred_idx"
    ).on(table.landingPageId, table.occurredAt),
  })
)

/** Precomputed per-source rollup for fast Data Lab reads. */
export const callCenterSourceRollups = pgTable(
  "call_center_source_rollup",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    landingPageId: text("landingPageId")
      .notNull()
      .references(() => landingPages.id, { onDelete: "cascade" }),
    sid: text("sid").notNull(),
    leads: integer("leads").notNull().default(0),
    contacted: integer("contacted").notNull().default(0),
    transferred: integer("transferred").notNull().default(0),
    duration15m: integer("duration15m").notNull().default(0),
    duration20m: integer("duration20m").notNull().default(0),
    duplicates: integer("duplicates").notNull().default(0),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    landingSidUidx: uniqueIndex(
      "call_center_source_rollup_landing_sid_uidx"
    ).on(table.landingPageId, table.sid),
  })
)
