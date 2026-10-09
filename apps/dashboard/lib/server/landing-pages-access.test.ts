import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  buildAccessFromGrants,
  canAccessProject,
} from "@/lib/server/external-access-acl"
import { filterLandingPagesForAccess } from "@/lib/server/landing-pages-store"

const resolveCompanyWorkspace = vi.hoisted(() =>
  vi.fn(async () => ({
    id: "ws-company",
    name: "Company",
    ownerUserId: "user-superadmin",
  }))
)

const getActorAccess = vi.hoisted(() => vi.fn())

const findFirstUser = vi.hoisted(() => vi.fn())

type ChainResult<T> = {
  from: () => ChainResult<T>
  where: () => ChainResult<T>
  orderBy: () => ChainResult<T>
  limit: () => Promise<T[]>
  then: Promise<T[]>["then"]
}

function selectChain<T>(rows: T[]): ChainResult<T> {
  const promise = Promise.resolve(rows)
  const chain: ChainResult<T> = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
    then: promise.then.bind(promise),
  }
  return chain
}

const dbSelect = vi.hoisted(() => vi.fn())

vi.mock("@/lib/server/resolve-workspace", () => ({
  resolveCompanyWorkspace,
  resolveLandingPageWorkspace: resolveCompanyWorkspace,
}))

vi.mock("@/lib/server/external-access", async () => {
  const acl = await import("@/lib/server/external-access-acl")
  return {
    ...acl,
    getActorAccess,
  }
})

vi.mock("@workspace/database", () => ({
  db: {
    select: (...args: unknown[]) => dbSelect(...args),
    query: {
      users: {
        findFirst: (...args: unknown[]) => findFirstUser(...args),
      },
    },
  },
  landingPages: {
    workspaceId: "workspaceId",
    deletedAt: "deletedAt",
    publicId: "publicId",
    slug: "slug",
    createdAt: "createdAt",
  },
  users: { id: "id" },
}))

describe("filterLandingPagesForAccess", () => {
  const companyPage = { publicId: "lp_company", workspaceId: "ws-company" }
  const otherPage = { publicId: "lp_other", workspaceId: "ws-personal" }

  it("lets internal actors see every row", () => {
    const access = { isExternal: false as const }
    expect(
      filterLandingPagesForAccess([companyPage, otherPage], access)
    ).toEqual([companyPage, otherPage])
  })

  it("limits external actors to granted publicIds", () => {
    const access = buildAccessFromGrants([
      {
        landingPagePublicId: "lp_company",
        tab: "overview",
        section: "",
      },
    ])
    expect(canAccessProject(access, "lp_company")).toBe(true)
    expect(canAccessProject(access, "lp_other")).toBe(false)
    expect(
      filterLandingPagesForAccess([companyPage, otherPage], access)
    ).toEqual([companyPage])
  })
})

describe("company workspace landing access", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resolveCompanyWorkspace.mockResolvedValue({
      id: "ws-company",
      name: "Company",
      ownerUserId: "user-superadmin",
    })
  })

  it("lists only Company-workspace pages for an internal non-owner", async () => {
    const { listAccessibleLandingPagesForActor } =
      await import("@/lib/server/landing-pages-store")

    getActorAccess.mockResolvedValue({ isExternal: false })
    dbSelect.mockReturnValue(
      selectChain([
        {
          id: "1",
          publicId: "lp_created",
          slug: "created",
          workspaceId: "ws-company",
        },
      ])
    )

    const rows = await listAccessibleLandingPagesForActor({
      id: "user-member",
      teamKind: "internal",
    })

    expect(resolveCompanyWorkspace).toHaveBeenCalledTimes(1)
    expect(rows.map((row) => row.publicId)).toEqual(["lp_created"])
    expect(getActorAccess).toHaveBeenCalledWith({
      id: "user-member",
      teamKind: "internal",
    })
  })

  it("hides company pages from externals without a grant", async () => {
    const { listAccessibleLandingPagesForActor } =
      await import("@/lib/server/landing-pages-store")

    getActorAccess.mockResolvedValue(buildAccessFromGrants([], []))
    dbSelect.mockReturnValue(
      selectChain([
        {
          id: "1",
          publicId: "lp_created",
          slug: "created",
          workspaceId: "ws-company",
        },
      ])
    )

    const rows = await listAccessibleLandingPagesForActor({
      id: "user-external",
      teamKind: "external",
    })

    expect(rows).toEqual([])
  })

  it("loads a company page by publicId for an internal actor", async () => {
    const { getActiveLandingPageForActor } =
      await import("@/lib/server/landing-pages-store")

    findFirstUser.mockResolvedValue({
      id: "user-member",
      teamKind: "internal",
    })
    getActorAccess.mockResolvedValue({ isExternal: false })
    dbSelect.mockReturnValue(
      selectChain([
        {
          id: "1",
          publicId: "lp_created",
          slug: "created",
          workspaceId: "ws-company",
        },
      ])
    )

    const row = await getActiveLandingPageForActor("user-member", "lp_created")
    expect(row?.publicId).toBe("lp_created")
    expect(resolveCompanyWorkspace).toHaveBeenCalled()
  })

  it("returns null when the page is not in the Company workspace", async () => {
    const { getActiveLandingPageForActor } =
      await import("@/lib/server/landing-pages-store")

    findFirstUser.mockResolvedValue({
      id: "user-member",
      teamKind: "internal",
    })
    getActorAccess.mockResolvedValue({ isExternal: false })
    // Company-scoped query finds nothing (page lived in a Personal workspace).
    dbSelect.mockReturnValue(selectChain([]))

    const row = await getActiveLandingPageForActor("user-member", "lp_personal")
    expect(row).toBeNull()
  })

  it("returns null for externals without a grant on an existing company page", async () => {
    const { getActiveLandingPageForActor } =
      await import("@/lib/server/landing-pages-store")

    findFirstUser.mockResolvedValue({
      id: "user-external",
      teamKind: "external",
    })
    getActorAccess.mockResolvedValue(buildAccessFromGrants([], []))
    dbSelect.mockReturnValue(
      selectChain([
        {
          id: "1",
          publicId: "lp_created",
          slug: "created",
          workspaceId: "ws-company",
        },
      ])
    )

    const row = await getActiveLandingPageForActor(
      "user-external",
      "lp_created"
    )
    expect(row).toBeNull()
  })
})

describe("resolveLandingPageWorkspace", () => {
  it("ignores the actor and resolves the Company workspace", async () => {
    const { resolveLandingPageWorkspace } =
      await import("@/lib/server/resolve-workspace")

    const ws = await resolveLandingPageWorkspace("any-non-owner-actor")
    expect(ws).toEqual({
      id: "ws-company",
      name: "Company",
      ownerUserId: "user-superadmin",
    })
    expect(resolveCompanyWorkspace).toHaveBeenCalled()
  })
})
