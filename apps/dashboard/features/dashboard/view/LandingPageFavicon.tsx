"use client"

import { useState } from "react"
import Image from "next/image"
import { cn } from "@workspace/ui/lib/utils"

type LandingPageFaviconProps = {
  faviconUrl: string | null
  brandName: string
  size?: number
  className?: string
  tone?: "default" | "inverse"
}

export function LandingPageFavicon({
  faviconUrl,
  brandName,
  size = 24,
  className,
  tone = "default",
}: LandingPageFaviconProps) {
  const [failed, setFailed] = useState(false)

  if (!faviconUrl || failed) {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-sm text-[11px] font-semibold uppercase select-none",
          tone === "inverse"
            ? "border border-white/20 bg-white/10 text-white/95"
            : "border border-neutral-200 bg-neutral-100 text-neutral-500",
          className
        )}
        style={{ width: size, height: size }}
        aria-hidden
      >
        {brandName.charAt(0)}
      </span>
    )
  }

  return (
    <Image
      src={faviconUrl}
      alt={`${brandName} favicon`}
      width={size}
      height={size}
      className={cn(
        "shrink-0 rounded-sm object-contain",
        tone === "inverse"
          ? "border border-white/15 ring-1 ring-white/10"
          : "border border-neutral-200",
        className
      )}
      onError={() => setFailed(true)}
      unoptimized
    />
  )
}
