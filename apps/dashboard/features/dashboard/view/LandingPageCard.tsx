import Link from "next/link"
import type { LandingPageListItem } from "@/features/dashboard/model/landing-page"
import { LandingPageFavicon } from "@/features/dashboard/view/LandingPageFavicon"
import { LandingPageLiveBadge } from "@/features/dashboard/view/LandingPageLiveBadge"
import { LandingPageMetrics } from "@/features/dashboard/view/LandingPageMetrics"

type LandingPageCardProps = {
  page: LandingPageListItem
}

export function LandingPageCard({ page }: LandingPageCardProps) {
  const href = `/dashboard/${encodeURIComponent(page.publicId)}`

  return (
    <Link
      href={href}
      className="block rounded-xl transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <article className="h-full rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-foreground/20 hover:shadow-md">
        <div className="mb-4 flex min-w-0 items-start gap-3">
          <LandingPageFavicon
            faviconUrl={page.faviconUrl}
            brandName={page.brandName}
            size={32}
            className="mt-0.5"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h2 className="truncate text-sm font-semibold text-foreground">
                {page.brandName}
              </h2>
              <LandingPageLiveBadge isLive={page.isLive} />
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {page.landingPageUrl}
            </p>
          </div>
        </div>
        <LandingPageMetrics metrics={page.metrics} />
      </article>
    </Link>
  )
}
