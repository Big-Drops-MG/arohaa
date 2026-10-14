import { describe, expect, it } from "vitest"
import {
  isMigrationApplied,
  MIGRATION_ALIASES,
  planMigrationAliasUpdates,
} from "./migration-aliases.js"

describe("migration aliases (web-push renumber)", () => {
  it("maps old ledger web-push names to current drizzle files", () => {
    expect(MIGRATION_ALIASES["0046_web_push.sql"]).toBe("0047_web_push.sql")
    expect(MIGRATION_ALIASES["0047_web_push_phase2.sql"]).toBe(
      "0048_web_push_phase2.sql",
    )
    expect(MIGRATION_ALIASES["0048_web_push_phase3.sql"]).toBe(
      "0049_web_push_phase3.sql",
    )
  })

  it("treats old ledger ids as applied for the new filenames", () => {
    const applied = new Set([
      "0046_web_push.sql",
      "0047_web_push_phase2.sql",
      "0048_web_push_phase3.sql",
    ])
    expect(isMigrationApplied("0047_web_push.sql", applied)).toBe(true)
    expect(isMigrationApplied("0048_web_push_phase2.sql", applied)).toBe(true)
    expect(isMigrationApplied("0049_web_push_phase3.sql", applied)).toBe(true)
    expect(isMigrationApplied("0046_company_workspace.sql", applied)).toBe(
      false,
    )
  })

  it("plans renames when only old ids are present", () => {
    expect(
      planMigrationAliasUpdates([
        "0046_web_push.sql",
        "0047_web_push_phase2.sql",
        "0048_web_push_phase3.sql",
      ]),
    ).toEqual([
      { type: "rename", from: "0046_web_push.sql", to: "0047_web_push.sql" },
      {
        type: "rename",
        from: "0047_web_push_phase2.sql",
        to: "0048_web_push_phase2.sql",
      },
      {
        type: "rename",
        from: "0048_web_push_phase3.sql",
        to: "0049_web_push_phase3.sql",
      },
    ])
  })

  it("drops obsolete old ids when both old and new are present", () => {
    expect(
      planMigrationAliasUpdates([
        "0046_web_push.sql",
        "0047_web_push.sql",
      ]),
    ).toEqual([{ type: "drop_obsolete", id: "0046_web_push.sql" }])
  })

  it("plans nothing when ledger already matches current files", () => {
    expect(
      planMigrationAliasUpdates([
        "0046_company_workspace.sql",
        "0047_web_push.sql",
        "0048_web_push_phase2.sql",
        "0049_web_push_phase3.sql",
      ]),
    ).toEqual([])
  })
})
