import type { LandingPageListItem } from "@/features/dashboard/model/landing-page"
import { LandingPageMetrics } from "@/features/dashboard/view/LandingPageMetrics"

type LandingPageCardProps = {
  page: LandingPageListItem
}

export function LandingPageCard({ page }: LandingPageCardProps) {
  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-4 flex min-w-0 items-start gap-4">
        <div className="size-10 shrink-0 rounded-sm bg-muted" aria-hidden />
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-foreground">
            {page.brandName}
          </h2>
          <p className="truncate text-xs text-muted-foreground">
            {page.landingPageUrl}
          </p>
        </div>
      </div>
      <LandingPageMetrics metrics={page.metrics} />
    </article>
  )
}
