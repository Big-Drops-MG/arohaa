import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { internalActor } from "@/lib/server/route-acl-fixtures"
import {
  evaluateGuardWithDbActor,
  EXPECTED_MEMBER_PERMISSIONS,
  EXPECTED_VIEWER_PERMISSIONS,
  findHandler,
} from "@/lib/server/route-acl-sweep.helpers"

const DUMMY_DATABASE_URL = "postgresql://127.0.0.1:5432/arohaa_acl_sweep_test"

function hasIntegrationDatabase(): boolean {
  const url = process.env.DATABASE_URL?.trim()
  return Boolean(url && url !== DUMMY_DATABASE_URL)
}

function integrationEnabled(): boolean {
  return (
    hasIntegrationDatabase() &&
    (process.env.CI === "true" || process.env.RUN_ACL_INTEGRATION === "1")
  )
}

if (process.env.CI === "true" && !integrationEnabled()) {
  describe("ACL sweep DB integration", () => {
    it("requires DATABASE_URL in CI", () => {
      throw new Error(
        "DATABASE_URL must be set in CI for route-acl-sweep.integration.test.ts"
      )
    })
  })
}

describe.runIf(integrationEnabled())("ACL sweep DB integration", () => {
  let memberRoleId: string
  let viewerRoleId: string
  let ceoRoleId: string
  const ephemeralRoleId = crypto.randomUUID()
  const ephemeralRoleKey = `acl-test-${crypto.randomUUID()}`

  let db: typeof import("@workspace/database").db
  let accessRoles: typeof import("@workspace/database").accessRoles
  let rolePermissions: typeof import("@workspace/database").rolePermissions
  let actorCan: typeof import("@/lib/server/actor-can").actorCan
  let getMemberRoleId: typeof import("@/lib/server/actor-can").getMemberRoleId
  let getRoleByKey: typeof import("@/lib/server/actor-can").getRoleByKey
  let getViewerRoleId: typeof import("@/lib/server/actor-can").getViewerRoleId
  let listRolePermissions: typeof import("@/lib/server/actor-can").listRolePermissions
  let eq: typeof import("drizzle-orm").eq
  let and: typeof import("drizzle-orm").and

  beforeAll(async () => {
    const [database, actorCanMod, drizzle] = await Promise.all([
      import("@workspace/database"),
      import("@/lib/server/actor-can"),
      import("drizzle-orm"),
    ])
    db = database.db
    accessRoles = database.accessRoles
    rolePermissions = database.rolePermissions
    actorCan = actorCanMod.actorCan
    getMemberRoleId = actorCanMod.getMemberRoleId
    getRoleByKey = actorCanMod.getRoleByKey
    getViewerRoleId = actorCanMod.getViewerRoleId
    listRolePermissions = actorCanMod.listRolePermissions
    eq = drizzle.eq
    and = drizzle.and
    ;[memberRoleId, viewerRoleId] = await Promise.all([
      getMemberRoleId(),
      getViewerRoleId(),
    ])
    const ceoRole = await getRoleByKey("ceo")
    if (!ceoRole) {
      throw new Error("CEO role is not configured.")
    }
    ceoRoleId = ceoRole.id

    await db.insert(accessRoles).values({
      id: ephemeralRoleId,
      key: ephemeralRoleKey,
      label: "ACL integration test role",
      isSystem: false,
    })
    await db.insert(rolePermissions).values({
      roleId: ephemeralRoleId,
      permission: "landing_pages.read",
    })
  }, 30_000)

  afterAll(async () => {
    await db.delete(accessRoles).where(eq(accessRoles.id, ephemeralRoleId))
  })

  it("seeds member permissions in role_permissions", async () => {
    const permissions = await listRolePermissions(memberRoleId)
    expect([...permissions].sort()).toEqual(
      [...EXPECTED_MEMBER_PERMISSIONS].sort()
    )
  })

  it("seeds viewer permissions in role_permissions", async () => {
    const permissions = await listRolePermissions(viewerRoleId)
    expect([...permissions].sort()).toEqual(
      [...EXPECTED_VIEWER_PERMISSIONS].sort()
    )
  })

  it("allows member through notifications GET via actorCan", async () => {
    const handler = findHandler("notifications/route.ts", "GET")
    expect(handler).toBeDefined()

    const result = await evaluateGuardWithDbActor(
      handler!,
      internalActor("acl-member", memberRoleId)
    )
    expect(result.ok).toBe(true)
  })

  it("denies viewer on landing-pages POST via actorCan", async () => {
    const handler = findHandler("landing-pages/route.ts", "POST")
    expect(handler).toBeDefined()

    const result = await evaluateGuardWithDbActor(
      handler!,
      internalActor("acl-viewer", viewerRoleId)
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(403)
    }
  })

  it("denies member on workspace api-keys POST via actorCan", async () => {
    const handler = findHandler("workspace/api-keys/route.ts", "POST")
    expect(handler).toBeDefined()

    const result = await evaluateGuardWithDbActor(
      handler!,
      internalActor("acl-member", memberRoleId)
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(403)
    }
  })

  it("allows CEO on workspace api-keys POST via actorCan", async () => {
    const handler = findHandler("workspace/api-keys/route.ts", "POST")
    expect(handler).toBeDefined()

    const result = await evaluateGuardWithDbActor(
      handler!,
      internalActor("acl-ceo", ceoRoleId)
    )
    expect(result.ok).toBe(true)
  })

  it("denies actorCan after permission row is removed", async () => {
    expect(
      await actorCan(
        { id: "acl-ephemeral", roleId: ephemeralRoleId },
        "landing_pages.read"
      )
    ).toBe(true)

    await db
      .delete(rolePermissions)
      .where(
        and(
          eq(rolePermissions.roleId, ephemeralRoleId),
          eq(rolePermissions.permission, "landing_pages.read")
        )
      )

    expect(
      await actorCan(
        { id: "acl-ephemeral", roleId: ephemeralRoleId },
        "landing_pages.read"
      )
    ).toBe(false)
  })
})
