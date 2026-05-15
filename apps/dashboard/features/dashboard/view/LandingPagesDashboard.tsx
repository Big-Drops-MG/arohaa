"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Input } from "@workspace/ui/components/input"
import { Button } from "@workspace/ui/components/button"
import { Plus, Search } from "lucide-react"
import type { LandingPageListItem } from "@/features/dashboard/model/landing-page"
import { LandingPageCard } from "@/features/dashboard/view/LandingPageCard"
import { useSoftRefresh } from "@/hooks/use-soft-refresh"

type LandingPagesDashboardProps = {
  pages: LandingPageListItem[]
}

export function LandingPagesDashboard({ pages }: LandingPagesDashboardProps) {
  useSoftRefresh()
  const [query, setQuery] = useState("")

  const filteredPages = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return pages

    return pages.filter((page) => {
      const searchableText =
        `${page.brandName} ${page.landingPageUrl}`.toLowerCase()
      return searchableText.includes(normalizedQuery)
    })
  }, [pages, query])

  if (pages.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col items-center justify-center px-4 py-10">
        <Button type="button" size="lg" className="gap-2" asChild>
          <Link href="/dashboard/new-landing">
            <Plus className="size-5" aria-hidden />
            Add a Landing Page
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-6 py-9">
      <div className="mb-6 grid gap-4 lg:grid-cols-[180px_minmax(280px,1fr)_140px] lg:items-center">
        <h1 className="text-xl font-semibold text-foreground">Landing Pages</h1>

        <div className="relative">
          <div className="pointer-events-none absolute top-1/2 left-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-sm bg-slate-950 text-white">
            <Search className="size-4" aria-hidden />
          </div>
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search landing pages"
            aria-label="Search landing pages"
            className="h-11 rounded-md border-neutral-400 pl-12 text-sm shadow-none"
          />
        </div>

        <Button type="button" className="h-11 gap-2 rounded-md px-5" asChild>
          <Link href="/dashboard/new-landing">
            <Plus className="size-4" aria-hidden />
            Add New
          </Link>
        </Button>
      </div>

      {filteredPages.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPages.map((page) => (
            <LandingPageCard key={page.publicId} page={page} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
          No landing pages match your search.
        </div>
      )}
    </div>
  )
}
