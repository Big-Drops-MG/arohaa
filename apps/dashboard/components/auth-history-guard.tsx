"use client"

import { useEffect } from "react"
import { consumeAuthHistoryTrap } from "@/lib/auth-navigation"

export function AuthHistoryGuard() {
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
    if (!consumeAuthHistoryTrap()) return

    const href = window.location.href
    let absorbed = false

    const pushBuffer = () => {
      window.history.pushState(
        { ...(window.history.state ?? {}), arohaaAuthTrap: true },
        "",
        href
      )
    }

    pushBuffer()

    const onPopState = () => {
      if (absorbed) return
      absorbed = true
      pushBuffer()
    }

    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  return null
}
