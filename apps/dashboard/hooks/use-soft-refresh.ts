"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

const DEFAULT_INTERVAL_MS = 5_000

export function useSoftRefresh(intervalMs = DEFAULT_INTERVAL_MS) {
  const router = useRouter()

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") {
        router.refresh()
      }
    }

    const id = window.setInterval(refresh, intervalMs)
    return () => window.clearInterval(id)
  }, [router, intervalMs])
}
