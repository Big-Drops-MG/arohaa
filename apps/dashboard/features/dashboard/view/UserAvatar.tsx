"use client"

import { useState } from "react"
import { cn } from "@workspace/ui/lib/utils"

type UserAvatarProps = {
  initials: string
  imageUrl?: string | null
  size?: "sm" | "md" | "lg"
  className?: string
  alt?: string
}

const sizeClassName = {
  sm: "size-8 text-[11px]",
  md: "size-9 text-xs",
  lg: "size-14 text-sm",
} as const

/**
 * Prefer a plain <img> for Google (and other SSO) avatars.
 * Google user-content hosts often 403 when a Referer is sent (esp. on localhost);
 * referrerPolicy="no-referrer" is required for reliable loading.
 */
export function UserAvatar({
  initials,
  imageUrl,
  size = "md",
  className,
  alt = "",
}: UserAvatarProps) {
  const [failed, setFailed] = useState(false)
  const src = imageUrl?.trim() || null
  const showImage = Boolean(src) && !failed

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-950 font-semibold text-white",
        sizeClassName[size],
        className
      )}
      aria-hidden={alt ? undefined : true}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- Google SSO avatars need referrerPolicy; next/image still 403s without it in some hosts.
        <img
          src={src!}
          alt={alt}
          referrerPolicy="no-referrer"
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden>{initials}</span>
      )}
    </div>
  )
}
