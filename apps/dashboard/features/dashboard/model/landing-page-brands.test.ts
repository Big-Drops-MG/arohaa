import { describe, expect, it } from "vitest"
import type { LandingPageListItem } from "@/features/dashboard/model/landing-page"
import { groupLandingPagesByBrand } from "@/features/dashboard/model/landing-page-brands"
import {
  brandNameFromDomain,
  segmentDomainLabel,
} from "@/features/dashboard/model/domain-brand"

function page(
  overrides: Partial<LandingPageListItem> &
    Pick<LandingPageListItem, "publicId" | "landingPageUrl">
): LandingPageListItem {
  return {
    slug: overrides.publicId,
    brandName: overrides.publicId,
    brand: null,
    faviconUrl: null,
    isLive: true,
    metrics: [],
    channelType: null,
    variantLabel: null,
    experimentName: null,
    experimentGroupName: null,
    experimentId: null,
    hubPublicId: null,
    ...overrides,
  }
}

describe("brandNameFromDomain", () => {
  it("uses the registrable domain, ignoring subdomains", () => {
    expect(brandNameFromDomain("https://autocoverage.quotifii.com/")).toBe(
      "Quotifii"
    )
    expect(brandNameFromDomain("https://www.quotifii.com")).toBe("Quotifii")
  })

  it("splits concatenated words", () => {
    expect(
      brandNameFromDomain("https://go.cheapautoinsuranceoptions.com/")
    ).toBe("Cheap Auto Insurance Options")
  })

  it("handles hyphens and multi-part suffixes", () => {
    expect(brandNameFromDomain("https://best-auto-quotes.co.uk")).toBe(
      "Best Auto Quotes"
    )
  })

  it("names current production domains", () => {
    const cases: Array<[string, string]> = [
      ["https://auto.assuritii.com/", "Assuritii"],
      ["https://www.unclesambuyshomes.com/", "Uncle Sam Buys Homes"],
      ["https://get.nationonedebtrelief.com/", "Nation One Debt Relief"],
      ["https://www.govloanoptions.com/", "Gov Loan Options"],
      ["https://go.usaloanstoday.com/", "USA Loans Today"],
      ["https://www.medisavingz.com/", "Medisavingz"],
      ["https://cheapautoinsurance.com/favicon.png", "Cheap Auto Insurance"],
      ["http://127.0.0.1:5500/", "Local Development"],
    ]
    for (const [url, expected] of cases) {
      expect(brandNameFromDomain(url)).toBe(expected)
    }
  })

  it("leaves unknown words intact", () => {
    expect(segmentDomainLabel("quotifii")).toBeNull()
  })
})

describe("groupLandingPagesByBrand", () => {
  it("groups by domain regardless of project names or variants", () => {
    const groups = groupLandingPagesByBrand([
      page({
        publicId: "a",
        brandName: "Auto Coverage",
        landingPageUrl: "https://autocoverage.quotifii.com",
      }),
      page({
        publicId: "b",
        brandName: "Home Quotes",
        landingPageUrl: "https://home.quotifii.com",
        variantLabel: "B",
        experimentId: "exp-1",
        experimentGroupName: "Something Else",
      }),
      page({
        publicId: "c",
        brandName: "Cheap Auto",
        landingPageUrl: "https://go.cheapautoinsuranceoptions.com",
      }),
    ])
    expect(groups.map((group) => group.brandName)).toEqual([
      "Cheap Auto Insurance Options",
      "Quotifii",
    ])
    expect(groups[1]?.pages).toHaveLength(2)
  })

  it("lets a brand set in Settings override the domain", () => {
    const groups = groupLandingPagesByBrand([
      page({
        publicId: "a",
        landingPageUrl: "https://quotifii.com",
      }),
      page({
        publicId: "b",
        landingPageUrl: "https://partner-site.com",
        brand: "Quotifii",
      }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0]?.pages).toHaveLength(2)
  })
})
