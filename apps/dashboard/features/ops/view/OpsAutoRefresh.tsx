"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"

const REFRESH_INTERVAL_MS = 20_000

export function OpsAutoRefresh() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [auto, setAuto] = useState(true)

  useEffect(() => {
    if (!auto) return
    const id = setInterval(() => {
      startTransition(() => router.refresh())
    }, REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [auto, router])

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3">
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 shadow-xs">
        <input
          type="checkbox"
          checked={auto}
          onChange={(e) => setAuto(e.target.checked)}
          className="size-3.5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900/20"
        />
        Auto-refresh every 20s
      </label>
      <button
        type="button"
        onClick={() => startTransition(() => router.refresh())}
        disabled={isPending}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-900 shadow-xs transition hover:bg-neutral-50 disabled:opacity-60"
      >
        <RefreshCw className={cn("size-3.5", isPending && "animate-spin")} />
        Refresh now
      </button>
    </div>
  )
}
