import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { and, eq, isNull } from "drizzle-orm"

// landing-pages-store → external-access imports landing-auth (next-auth).
vi.mock("@/lib/server/landing-auth", () => ({
  requireLandingPageActor: vi.fn(async () => null),
  requireWritableLandingPageActor: vi.fn(async () => null),
}))

const DUMMY_DATABASE_URL = "postgresql://127.0.0.1:5432/arohaa_acl_sweep_test"

function hasIntegrationDatabase(): boolean {
  const url = process.env.DATABASE_URL?.trim()
  return Boolean(url && url !== DUMMY_DATABASE_URL)
}

function integrationEnabled(): boolean {
  return (
    hasIntegrationDatabase() &&
    (process.env.CI === "true" ||
      process.env.RUN_LANDING_ACCESS_INTEGRATION === "1")
  )
}

describe.runIf(integrationEnabled())(
  "landing page company workspace access (integration)",
  () => {
    let db: typeof import("@workspace/database").db
    let users: typeof import("@workspace/database").users
    let workspaces: typeof import("@workspace/database").workspaces
    let landingPages: typeof import("@workspace/database").landingPages
    let accessRoles: typeof import("@workspace/database").accessRoles
    let MEMBER_ROLE_KEY: typeof import("@workspace/database").MEMBER_ROLE_KEY
    let resolveCompanyWorkspace: typeof import("@/lib/server/resolve-workspace").resolveCompanyWorkspace
    let resolveLandingPageWorkspace: typeof import("@/lib/server/resolve-workspace").resolveLandingPageWorkspace
    let listAccessibleLandingPagesForActor: typeof import("@/lib/server/landing-pages-store").listAccessibleLandingPagesForActor
    let getActiveLandingPageForActor: typeof import("@/lib/server/landing-pages-store").getActiveLandingPageForActor

    const memberId = crypto.randomUUID()
    const pageId = crypto.randomUUID()
    const publicId = `lp_test_${pageId.slice(0, 8)}`
    let companyWorkspaceId = ""
    let setupDone = false

    beforeAll(async () => {
      const [database, workspaceMod, storeMod] = await Promise.all([
        import("@workspace/database"),
        import("@/lib/server/resolve-workspace"),
        import("@/lib/server/landing-pages-store"),
      ])
      db = database.db
      users = database.users
      workspaces = database.workspaces
      landingPages = database.landingPages
      accessRoles = database.accessRoles
      MEMBER_ROLE_KEY = database.MEMBER_ROLE_KEY
      resolveCompanyWorkspace = workspaceMod.resolveCompanyWorkspace
      resolveLandingPageWorkspace = workspaceMod.resolveLandingPageWorkspace
      listAccessibleLandingPagesForActor =
        storeMod.listAccessibleLandingPagesForActor
      getActiveLandingPageForActor = storeMod.getActiveLandingPageForActor

      const memberRole = await db
        .select({ id: accessRoles.id })
        .from(accessRoles)
        .where(eq(accessRoles.key, MEMBER_ROLE_KEY))
        .limit(1)
      if (!memberRole[0]) {
        throw new Error("member role is not configured")
      }

      const company = await resolveCompanyWorkspace()
      companyWorkspaceId = company.id

      await db.insert(users).values({
        id: memberId,
        firstName: "Bug101",
        lastName: "Member",
        email: `bug101-member-${memberId.slice(0, 8)}@example.com`,
        emailVerified: new Date(),
        accessStatus: "approved",
        teamKind: "internal",
        roleId: memberRole[0].id,
      })

      await db.insert(landingPages).values({
        id: pageId,
        workspaceId: companyWorkspaceId,
        publicId,
        slug: `bug101-${pageId.slice(0, 8)}`,
        brandName: "Bug101",
        landingPageUrl: `https://example.com/bug101-${pageId.slice(0, 8)}`,
        normalizedUrl: `https://example.com/bug101-${pageId.slice(0, 8)}`,
        origin: "https://example.com",
        hostname: "example.com",
        status: "draft",
        formType: "single",
        createdByUserId: memberId,
        updatedByUserId: memberId,
        htmlVerificationToken: `tok_${pageId.slice(0, 12)}`,
      })
      setupDone = true
    })

    afterAll(async () => {
      if (!setupDone || !db) return
      await db.delete(landingPages).where(eq(landingPages.id, pageId))
      await db.delete(users).where(eq(users.id, memberId))
    })

    it("create target workspace ignores actor and is Company", async () => {
      const forMember = await resolveLandingPageWorkspace(memberId)
      const company = await resolveCompanyWorkspace()
      expect(forMember.id).toBe(company.id)
      expect(forMember.name).toBe("Company")
    })

    it("internal non-owner lists and loads the page in Company workspace", async () => {
      const actor = await db.query.users.findFirst({
        where: eq(users.id, memberId),
      })
      expect(actor).toBeTruthy()

      const listed = await listAccessibleLandingPagesForActor(actor!)
      expect(listed.some((row) => row.publicId === publicId)).toBe(true)

      const loaded = await getActiveLandingPageForActor(memberId, publicId)
      expect(loaded?.id).toBe(pageId)
      expect(loaded?.workspaceId).toBe(companyWorkspaceId)
    })

    it("does not create a Personal workspace for the member when listing", async () => {
      const actor = await db.query.users.findFirst({
        where: eq(users.id, memberId),
      })
      await listAccessibleLandingPagesForActor(actor!)

      const personal = await db
        .select()
        .from(workspaces)
        .where(
          and(
            eq(workspaces.ownerUserId, memberId),
            eq(workspaces.name, "Personal"),
            isNull(workspaces.deletedAt)
          )
        )
        .limit(1)

      expect(personal).toHaveLength(0)
    })
  }
)
