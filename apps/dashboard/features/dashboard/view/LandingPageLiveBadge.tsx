import { cn } from "@workspace/ui/lib/utils"

type LandingPageLiveBadgeProps = {
  isLive: boolean
  className?: string
}

export function LandingPageLiveBadge({
  isLive,
  className,
}: LandingPageLiveBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
        isLive
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80"
          : "bg-muted text-muted-foreground ring-1 ring-border",
        className
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          isLive ? "bg-emerald-500" : "bg-muted-foreground/60"
        )}
        aria-hidden
      />
      {isLive ? "Live" : "Not live"}
    </span>
  )
}
