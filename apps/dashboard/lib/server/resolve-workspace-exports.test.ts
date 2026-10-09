import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import * as resolveWorkspace from "@/lib/server/resolve-workspace"

describe("resolve-workspace landing tenancy exports", () => {
  it("exports company workspace resolvers for landing CRUD", () => {
    expect(typeof resolveWorkspace.resolveCompanyWorkspace).toBe("function")
    expect(typeof resolveWorkspace.resolveLandingPageWorkspace).toBe("function")
    expect(typeof resolveWorkspace.resolveTeamSettingsWorkspace).toBe(
      "function"
    )
  })

  it("does not export getOrCreateOwnerWorkspace (prevents Personal workspace inserts)", () => {
    expect(
      Object.prototype.hasOwnProperty.call(
        resolveWorkspace,
        "getOrCreateOwnerWorkspace"
      )
    ).toBe(false)

    const source = readFileSync(
      path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "resolve-workspace.ts"
      ),
      "utf8"
    )
    expect(source).not.toContain("getOrCreateOwnerWorkspace")
    expect(source).not.toContain('name: "Personal"')
  })
})
