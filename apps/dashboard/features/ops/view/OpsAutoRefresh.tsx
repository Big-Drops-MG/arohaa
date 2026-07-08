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
    <div className="flex items-center gap-3">
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={auto}
          onChange={(e) => setAuto(e.target.checked)}
          className="size-3.5 rounded border-neutral-300"
        />
        Auto-refresh (20s)
      </label>
      <button
        type="button"
        onClick={() => startTransition(() => router.refresh())}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm transition hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-900"
      >
        <RefreshCw className={cn("size-3.5", isPending && "animate-spin")} />
        Refresh
      </button>
    </div>
  )
}
