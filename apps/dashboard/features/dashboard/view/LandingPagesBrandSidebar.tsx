"use client"

import { cn } from "@workspace/ui/lib/utils"
import type { LandingPageBrandGroup } from "@/features/dashboard/model/landing-page-brands"

type LandingPagesBrandSidebarProps = {
  brands: LandingPageBrandGroup[]
  selectedBrandKey: string | null
  onSelectBrand: (brandKey: string) => void
}

export function LandingPagesBrandSidebar({
  brands,
  selectedBrandKey,
  onSelectBrand,
}: LandingPagesBrandSidebarProps) {
  if (brands.length === 0) {
    return (
      <aside className="text-xs text-muted-foreground">
        No brands match your search.
      </aside>
    )
  }

  return (
    <aside>
      <div className="mb-2">
        <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Brands
        </h2>
      </div>
      <nav aria-label="Brands">
        <ul className="space-y-0.5">
          {brands.map((brand) => {
            const selected = selectedBrandKey === brand.brandKey
            return (
              <li key={brand.brandKey}>
                <button
                  type="button"
                  className={cn(
                    "w-full truncate rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                    selected
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                  onClick={() => onSelectBrand(brand.brandKey)}
                >
                  {brand.brandName}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
