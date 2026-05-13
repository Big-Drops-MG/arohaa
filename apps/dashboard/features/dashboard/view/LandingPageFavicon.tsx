"use client"

import { useState } from "react"
import Image from "next/image"
import { cn } from "@workspace/ui/lib/utils"

type LandingPageFaviconProps = {
  faviconUrl: string | null
  brandName: string
  size?: number
  className?: string
}

export function LandingPageFavicon({
  faviconUrl,
  brandName,
  size = 24,
  className,
}: LandingPageFaviconProps) {
  const [failed, setFailed] = useState(false)

  if (!faviconUrl || failed) {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded border border-neutral-200 bg-neutral-100 text-[11px] font-semibold text-neutral-500 uppercase select-none",
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
        "shrink-0 rounded border border-neutral-200 object-contain",
        className
      )}
      onError={() => setFailed(true)}
      unoptimized
    />
  )
}
