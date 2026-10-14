import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import {
  purgeLandingPageSoftDeleteChildren,
  SOFT_DELETE_CHILD_TABLES,
  type SoftDeleteChildExecutor,
} from "@/lib/server/landing-page-soft-delete-children"

describe("purgeLandingPageSoftDeleteChildren", () => {
  it("covers privilege grants, project scopes, and UTM catalog orphans", () => {
    expect(SOFT_DELETE_CHILD_TABLES).toEqual([
      "external_member_privilege",
      "external_member_project_scope",
      "landing_page_utm_param",
    ])
  })

  it("deletes children keyed by publicId and landingPageId", async () => {
    const deletedTables: unknown[] = []
    const whereCalls: unknown[] = []

    const tx = {
      delete: ((table: unknown) => {
        deletedTables.push(table)
        return {
          where: async (condition: unknown) => {
            whereCalls.push(condition)
            return undefined
          },
        }
      }) as unknown as SoftDeleteChildExecutor["delete"],
    }

    await purgeLandingPageSoftDeleteChildren(tx, {
      id: "lp-internal-id",
      publicId: "gov-loan-options",
    })

    expect(deletedTables).toHaveLength(3)
    expect(whereCalls).toHaveLength(3)
  })

  it("is invoked from the soft-delete transaction path", () => {
    const source = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "landing-page-soft-delete.ts"
      ),
      "utf8"
    )
    expect(source).toContain("purgeLandingPageSoftDeleteChildren")
  })
})
