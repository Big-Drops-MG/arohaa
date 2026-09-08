import Link from "next/link"
import { ExternalLink } from "lucide-react"
import {
  landingPageDisplayUrl,
  type LandingPageListItem,
} from "@/features/dashboard/model/landing-page"
import { experimentVariantDisplayLabel } from "@/features/experiments/utils/experiment-table-columns"
import { LandingPageChannelBadge } from "@/features/dashboard/view/LandingPageChannelBadge"
import { LandingPageFavicon } from "@/features/dashboard/view/LandingPageFavicon"
import { LandingPageLiveBadge } from "@/features/dashboard/view/LandingPageLiveBadge"
import { LandingPageMetrics } from "@/features/dashboard/view/LandingPageMetrics"

type LandingPageCardProps = {
  page: LandingPageListItem
}

export function LandingPageCard({ page }: LandingPageCardProps) {
  const href = `/dashboard/${encodeURIComponent(page.slug)}`
  const displayUrl = landingPageDisplayUrl(page.landingPageUrl)
  const variantLabel = page.variantLabel
    ? experimentVariantDisplayLabel(page.variantLabel)
    : null
  // The owner's own card already carries that name in its title.
  const groupName =
    page.experimentGroupName && page.experimentGroupName !== page.brandName
      ? page.experimentGroupName
      : null
  const hasBadges = Boolean(page.channelType || variantLabel)

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition duration-200 hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-[0_12px_28px_-16px_rgba(16,24,40,0.28)]">
      <Link
        href={href}
        className="absolute inset-0 z-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={page.brandName}
      />
      <div className="pointer-events-none relative z-10 flex flex-1 flex-col gap-3 p-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background shadow-xs">
            <LandingPageFavicon
              faviconUrl={page.faviconUrl}
              brandName={page.brandName}
              size={20}
              className="border-0"
            />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h2 className="truncate text-[15px] leading-5 font-semibold tracking-tight text-foreground">
                {page.brandName}
              </h2>
              <LandingPageLiveBadge isLive={page.isLive} />
            </div>
            <a
              href={page.landingPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={`Open ${displayUrl}`}
              className="pointer-events-auto mt-1 flex min-w-0 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              onClick={(event) => event.stopPropagation()}
            >
              <span className="min-w-0 truncate">{displayUrl}</span>
              <ExternalLink className="size-3.5 shrink-0" aria-hidden />
            </a>
          </div>
        </div>

        {hasBadges ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {page.channelType ? (
              <LandingPageChannelBadge channelType={page.channelType} />
            ) : null}
            {variantLabel ? (
              <span
                className="inline-flex h-6 max-w-full items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 text-[11px] leading-4 ring-1 ring-indigo-200/80"
                title={
                  groupName ? `${variantLabel} · ${groupName}` : variantLabel
                }
              >
                <span className="size-1.5 shrink-0 rounded-full bg-indigo-500" />
                <span className="shrink-0 font-semibold text-indigo-700">
                  {variantLabel}
                </span>
                {groupName ? (
                  <>
                    <span className="h-2.5 w-px shrink-0 bg-indigo-300/80" />
                    <span className="truncate text-indigo-700/75">
                      {groupName}
                    </span>
                  </>
                ) : null}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="pointer-events-none relative z-10 border-t border-border/60 bg-muted/25 px-4 py-3">
        <LandingPageMetrics metrics={page.metrics} />
      </div>
    </article>
  )
}
