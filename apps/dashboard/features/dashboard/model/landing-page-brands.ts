import type { LandingPageListItem } from "@/features/dashboard/model/landing-page"
import {
  brandKeyFromDomain,
  brandNameFromDomain,
} from "@/features/dashboard/model/domain-brand"

export type LandingPageBrandGroup = {
  brandKey: string
  brandName: string
  pages: LandingPageListItem[]
}

function sortPages(pages: LandingPageListItem[]): LandingPageListItem[] {
  return [...pages].sort((a, b) => {
    const byName = a.brandName.localeCompare(b.brandName)
    if (byName !== 0) return byName
    const aLabel = a.variantLabel?.toUpperCase() ?? ""
    const bLabel = b.variantLabel?.toUpperCase() ?? ""
    return aLabel.localeCompare(bLabel)
  })
}

/** Brand comes from Settings when set; otherwise from the landing page domain. */
export function resolvePageBrand(page: LandingPageListItem): {
  brandKey: string
  brandName: string
} {
  const manual = page.brand?.trim()
  if (manual) return { brandKey: manual.toLowerCase(), brandName: manual }

  const fromDomain = brandNameFromDomain(page.landingPageUrl)
  if (fromDomain) {
    return {
      brandKey: fromDomain.toLowerCase(),
      brandName: fromDomain,
    }
  }

  const fallbackKey =
    brandKeyFromDomain(page.landingPageUrl) ?? page.publicId.toLowerCase()
  return { brandKey: fallbackKey, brandName: page.brandName.trim() || "Other" }
}

export function groupLandingPagesByBrand(
  pages: LandingPageListItem[]
): LandingPageBrandGroup[] {
  const byBrand = new Map<string, LandingPageBrandGroup>()

  for (const page of pages) {
    const { brandKey, brandName } = resolvePageBrand(page)
    const existing = byBrand.get(brandKey)
    if (existing) {
      existing.pages.push(page)
      continue
    }
    byBrand.set(brandKey, { brandKey, brandName, pages: [page] })
  }

  const groups = [...byBrand.values()].map((group) => ({
    ...group,
    pages: sortPages(group.pages),
  }))

  groups.sort((a, b) => a.brandName.localeCompare(b.brandName))
  return groups
}
