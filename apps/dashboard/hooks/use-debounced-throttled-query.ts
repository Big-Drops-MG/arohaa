"use client"

import { useCallback, useEffect, useRef, useState } from "react"

const DEFAULT_DEBOUNCE_MS = 220
const DEFAULT_THROTTLE_MS = 100

type UseDebouncedThrottledQueryOptions = {
  debounceMs?: number
  throttleMs?: number
}

/**
 * Immediate input value for the search field, plus a delayed query used for
 * filtering. Throttle keeps the list updating while typing; debounce flushes
 * the final query after typing stops.
 */
export function useDebouncedThrottledQuery(
  options: UseDebouncedThrottledQueryOptions = {}
) {
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS
  const throttleMs = options.throttleMs ?? DEFAULT_THROTTLE_MS

  const [inputValue, setInputValue] = useState("")
  const [query, setQuery] = useState("")

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastThrottleAtRef = useRef(0)

  const clearDebounce = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
  }, [])

  const commitQuery = useCallback((raw: string) => {
    const next = raw.trim().toLowerCase()
    setQuery((prev) => (prev === next ? prev : next))
    lastThrottleAtRef.current = Date.now()
  }, [])

  const setSearchValue = useCallback(
    (raw: string) => {
      setInputValue(raw)
      clearDebounce()

      const now = Date.now()
      const elapsed = now - lastThrottleAtRef.current
      if (elapsed >= throttleMs) {
        commitQuery(raw)
      }

      debounceTimerRef.current = setTimeout(() => {
        commitQuery(raw)
        debounceTimerRef.current = null
      }, debounceMs)
    },
    [clearDebounce, commitQuery, debounceMs, throttleMs]
  )

  const reset = useCallback(() => {
    clearDebounce()
    setInputValue("")
    setQuery("")
    lastThrottleAtRef.current = 0
  }, [clearDebounce])

  useEffect(() => () => clearDebounce(), [clearDebounce])

  return {
    inputValue,
    query,
    setSearchValue,
    reset,
  }
}
