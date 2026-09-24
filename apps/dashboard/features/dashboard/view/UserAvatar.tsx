"use client"

import { useEffect, useState } from "react"
import { cn } from "@workspace/ui/lib/utils"
import { avatarProxyPath } from "@/features/dashboard/model/avatar"

type UserAvatarProps = {
  initials: string
  imageUrl?: string | null
  /** When set, load via same-origin proxy to avoid Google Referer/403 issues. */
  userId?: string | null
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
 * Same-origin `/api/avatars/:userId` avoids Googleusercontent Referer 403s;
 * referrerPolicy="no-referrer" covers direct googleusercontent URLs.
 */
export function UserAvatar({
  initials,
  imageUrl,
  userId,
  size = "md",
  className,
  alt = "",
}: UserAvatarProps) {
  const [failed, setFailed] = useState(false)
  const directSrc = imageUrl?.trim() || null
  const proxySrc =
    userId?.trim() && directSrc ? avatarProxyPath(userId.trim()) : null
  const src = proxySrc || directSrc
  const showImage = Boolean(src) && !failed

  useEffect(() => {
    setFailed(false)
  }, [src])

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
