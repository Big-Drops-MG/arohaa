"use client"

import { useEffect } from "react"
import {
  consumeAuthHistoryTrap,
  getAuthHistoryFloor,
  setAuthHistoryFloor,
  type AuthHistoryTrapTarget,
} from "@/lib/auth-navigation"

function isBufferState(state: unknown): boolean {
  return (
    typeof state === "object" && state !== null && "arohaaAuthTrap" in state
  )
}

export function AuthHistoryGuard({
  trapTarget,
}: {
  trapTarget: AuthHistoryTrapTarget
}) {
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        window.location.reload()
      }
    }
    window.addEventListener("pageshow", onPageShow)
    return () => window.removeEventListener("pageshow", onPageShow)
  }, [])

  useEffect(() => {
    if (consumeAuthHistoryTrap(trapTarget)) {
      setAuthHistoryFloor(window.location.pathname)
    }

    const floor = getAuthHistoryFloor()
    if (!floor || window.location.pathname !== floor) return

    const pushBuffer = () => {
      window.history.pushState(
        { ...(window.history.state ?? {}), arohaaAuthTrap: true },
        "",
        window.location.href
      )
    }

    if (!isBufferState(window.history.state)) pushBuffer()

    const onPopState = () => {
      if (window.location.pathname !== floor) return
      if (isBufferState(window.history.state)) return
      pushBuffer()
    }

    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [trapTarget])

  return null
}
