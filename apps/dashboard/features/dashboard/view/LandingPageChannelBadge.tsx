import { cn } from "@workspace/ui/lib/utils"
import {
  channelTypeLabel,
  type LandingPageChannelType,
} from "@/features/settings/model/landing-page-channel-types"

type LandingPageChannelBadgeProps = {
  channelType: LandingPageChannelType
  className?: string
}

const CHANNEL_BADGE_STYLES: Record<
  LandingPageChannelType,
  { shell: string; dot: string; text: string }
> = {
  email: {
    shell: "bg-sky-50 ring-1 ring-sky-200/80",
    dot: "bg-sky-500",
    text: "text-sky-700",
  },
  social: {
    shell: "bg-violet-50 ring-1 ring-violet-200/80",
    dot: "bg-violet-500",
    text: "text-violet-700",
  },
}

export function LandingPageChannelBadge({
  channelType,
  className,
}: LandingPageChannelBadgeProps) {
  const styles = CHANNEL_BADGE_STYLES[channelType]

  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[11px] leading-4 font-medium",
        styles.shell,
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full", styles.dot)} aria-hidden />
      <span className={styles.text}>{channelTypeLabel(channelType)}</span>
    </span>
  )
}
