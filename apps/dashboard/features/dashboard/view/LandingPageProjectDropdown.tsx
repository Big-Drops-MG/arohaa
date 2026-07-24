"use client"

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Check, ChevronsUpDown, Plus, Search } from "lucide-react"
import { LandingPageFavicon } from "@/features/dashboard/view/LandingPageFavicon"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import type { LandingPageNavItem } from "@/features/dashboard/model/landing-page"

const RESERVED_SEGMENTS = new Set(["new-landing", "profile", "ops", "team"])
const SEARCH_DEBOUNCE_MS = 220

function projectPublicIdFromPath(pathname: string): string | null {
  if (!pathname.startsWith("/dashboard/")) return null
  const rest = pathname.slice("/dashboard/".length)
  if (!rest || rest.includes("/")) return null
  const seg = decodeURIComponent(rest)
  if (RESERVED_SEGMENTS.has(seg)) return null
  return seg
}

type LandingPageMenuSearchProps = {
  onDebouncedQueryChange: (normalized: string) => void
  onRequestClose: () => void
}

const LandingPageMenuSearch = memo(function LandingPageMenuSearch({
  onDebouncedQueryChange,
  onRequestClose,
}: LandingPageMenuSearchProps) {
  const [value, setValue] = useState("")
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const scheduleCommit = useCallback(
    (raw: string) => {
      clearTimer()
      timeoutRef.current = setTimeout(() => {
        onDebouncedQueryChange(raw.trim().toLowerCase())
        timeoutRef.current = null
      }, SEARCH_DEBOUNCE_MS)
    },
    [clearTimer, onDebouncedQueryChange]
  )

  useEffect(() => () => clearTimer(), [clearTimer])

  return (
    <div
      className="border-b border-neutral-100 p-3"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400"
          aria-hidden
        />
        <Input
          type="search"
          value={value}
          onChange={(e) => {
            const next = e.target.value
            setValue(next)
            scheduleCommit(next)
          }}
          placeholder="Find landing page..."
          aria-label="Find landing page"
          autoComplete="off"
          spellCheck={false}
          className="h-10 border-neutral-200 bg-neutral-50 pr-16 pl-10 text-sm shadow-none placeholder:text-neutral-400 focus-visible:bg-white"
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === "Escape") {
              e.preventDefault()
              onRequestClose()
            }
          }}
        />
        <kbd className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded border border-neutral-200 bg-white px-1.5 py-0.5 font-sans text-[10px] font-medium text-neutral-500 shadow-sm">
          Esc
        </kbd>
      </div>
    </div>
  )
})

type LandingPageListProps = {
  pages: LandingPageNavItem[]
  debouncedQuery: string
  currentId: string
  onPick: () => void
}

const LandingPageMenuList = memo(function LandingPageMenuList({
  pages,
  debouncedQuery,
  currentId,
  onPick,
}: LandingPageListProps) {
  const filteredPages = useMemo(() => {
    if (!debouncedQuery) return pages
    return pages.filter((p) =>
      p.brandName.toLowerCase().includes(debouncedQuery)
    )
  }, [pages, debouncedQuery])

  if (pages.length === 0) {
    return (
      <div className="max-h-[min(50vh,280px)] overflow-y-auto overscroll-contain px-2 py-1">
        <p className="px-3 py-4 text-sm text-neutral-500">No landing pages</p>
      </div>
    )
  }

  if (filteredPages.length === 0) {
    return (
      <div className="max-h-[min(50vh,280px)] overflow-y-auto overscroll-contain px-2 py-1">
        <p className="px-3 py-4 text-sm text-neutral-500">No matches</p>
      </div>
    )
  }

  return (
    <div className="max-h-[min(50vh,280px)] overflow-y-auto overscroll-contain px-2 py-1.5">
      {filteredPages.map((page) => {
        const selected = page.publicId === currentId
        return (
          <DropdownMenuItem
            key={page.publicId}
            asChild
            className="cursor-pointer rounded-md p-0 focus:bg-transparent"
          >
            <Link
              href={`/dashboard/${encodeURIComponent(page.publicId)}`}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors outline-none",
                "hover:bg-neutral-50 focus:bg-neutral-50",
                selected && "bg-neutral-50"
              )}
              onClick={onPick}
            >
              <LandingPageFavicon
                faviconUrl={page.faviconUrl}
                brandName={page.brandName}
                size={24}
              />
              <span className="min-w-0 flex-1 truncate text-neutral-900">
                {page.brandName}
              </span>
              {selected ? (
                <Check
                  className="size-4 shrink-0 text-neutral-600"
                  aria-hidden
                />
              ) : (
                <span className="size-4 shrink-0" aria-hidden />
              )}
            </Link>
          </DropdownMenuItem>
        )
      })}
    </div>
  )
})

type LandingPageProjectDropdownProps = {
  pages: LandingPageNavItem[]
}

export function LandingPageProjectDropdown({
  pages,
}: LandingPageProjectDropdownProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [searchInstance, setSearchInstance] = useState(0)

  const currentId = useMemo(
    () => projectPublicIdFromPath(pathname ?? ""),
    [pathname]
  )

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next)
    setDebouncedQuery("")
    setSearchInstance((k) => k + 1)
  }, [])

  const handleDebouncedQueryChange = useCallback((q: string) => {
    setDebouncedQuery(q)
  }, [])

  const handleRequestClose = useCallback(() => {
    handleOpenChange(false)
  }, [handleOpenChange])

  if (!currentId) return null

  const current = pages.find((p) => p.publicId === currentId)
  const label = current?.brandName ?? currentId

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange} modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex min-h-10 w-full max-w-[min(100vw-8rem,320px)] items-center gap-3.5 rounded-sm border border-neutral-200 bg-white py-2.5 pr-2 pl-3.5 text-left text-sm shadow-sm transition-colors outline-none focus:outline-none",
            "hover:border-neutral-300 hover:bg-neutral-50/90",
            "focus-visible:border-neutral-300 focus-visible:ring-2 focus-visible:ring-neutral-900/10",
            "data-[state=open]:border-neutral-300 data-[state=open]:bg-neutral-50/90"
          )}
          aria-label="Switch landing page"
        >
          <LandingPageFavicon
            faviconUrl={current?.faviconUrl ?? null}
            brandName={label}
            size={22}
            className="shrink-0"
          />
          <span className="min-w-0 flex-1 truncate px-0.5 font-medium text-neutral-900">
            {label}
          </span>
          <span
            className="flex size-5 shrink-0 items-center justify-center rounded-sm bg-black text-white"
            aria-hidden
          >
            <ChevronsUpDown className="size-3" strokeWidth={2} />
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className={cn(
          "w-[min(calc(100vw-2rem),340px)] overflow-hidden rounded-sm border border-neutral-200/90 bg-white p-0 text-neutral-900 shadow-lg ring-0"
        )}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <LandingPageMenuSearch
          key={searchInstance}
          onDebouncedQueryChange={handleDebouncedQueryChange}
          onRequestClose={handleRequestClose}
        />

        <LandingPageMenuList
          pages={pages}
          debouncedQuery={debouncedQuery}
          currentId={currentId}
          onPick={handleRequestClose}
        />

        <DropdownMenuSeparator className="my-0 bg-neutral-100" />
        <div className="p-2">
          <DropdownMenuItem asChild className="cursor-pointer rounded-md p-0">
            <Link
              href="/dashboard/new-landing"
              className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-neutral-700 transition-colors outline-none hover:bg-neutral-50 focus:bg-neutral-50"
              onClick={handleRequestClose}
            >
              <Plus className="size-4 shrink-0 text-neutral-500" aria-hidden />
              Add landing page
            </Link>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
