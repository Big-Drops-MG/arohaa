"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import type {
  UtmDashboardData,
  UtmParamItem,
  UtmParamPair,
} from "@/features/utm/model/utm"
import { getUtmParamLabel } from "@workspace/lp-core"
import {
  overviewAnalyticCardHeaderClassName,
  overviewAnalyticCardShellClassName,
  overviewSectionHeadingClassName,
} from "@/features/overview/view/overview-card-density"

const PARAM_GROUPS = [
  { key: "utm_source", label: "Source" },
  { key: "utm_s1", label: "S1" },
] as const

type CardFilter = "all" | "source" | "s1"
type ModalFilter = "all" | "active" | "blocked"

function sortParams<T extends { key: string; value: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const byKey = a.key.localeCompare(b.key)
    if (byKey !== 0) return byKey
    return a.value.localeCompare(b.value, undefined, { sensitivity: "base" })
  })
}

function ParamsPanel({
  title,
  items,
  tone,
  headerActions,
  emptyMessage,
}: {
  title: string
  items: UtmParamPair[]
  tone: "danger" | "success"
  headerActions?: React.ReactNode
  emptyMessage: string
}) {
  const sorted = sortParams(items)
  const byKey = new Map<string, UtmParamPair[]>()
  for (const row of sorted) {
    const list = byKey.get(row.key) ?? []
    list.push(row)
    byKey.set(row.key, list)
  }

  const headerTone =
    tone === "danger"
      ? "border-rose-200/70 bg-rose-50/40 text-rose-800"
      : "border-teal-200/70 bg-teal-50/40 text-teal-800"

  return (
    <Card className={cn(overviewAnalyticCardShellClassName, "h-full")}>
      <CardHeader
        className={cn(
          overviewAnalyticCardHeaderClassName,
          "border-b",
          headerTone
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            <p className="mt-1 text-xs opacity-80">
              {tone === "success"
                ? "Allowed traffic parameters"
                : "Filtered out by rules"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {headerActions}
            <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-semibold tabular-nums">
              {items.length}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="max-h-[420px] overflow-y-auto p-0">
        {items.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground sm:px-6">
            {emptyMessage}
          </p>
        ) : (
          <div className="divide-y divide-border">
            {PARAM_GROUPS.map((group) => {
              const rows = byKey.get(group.key) ?? []
              if (rows.length === 0) return null
              return (
                <div key={group.key} className="px-5 py-3 sm:px-6">
                  <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {group.label} ({group.key})
                  </p>
                  <div className="space-y-2">
                    {rows.map((item) => (
                      <div
                        key={`${item.key}:${item.value}`}
                        className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground"
                      >
                        {item.value}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

type UtmParamsColumnsProps = {
  projectId: string
  data: UtmDashboardData
  onDataChange: (data: UtmDashboardData) => void
}

export function UtmParamsColumns({
  projectId,
  data,
  onDataChange,
}: UtmParamsColumnsProps) {
  const [cardFilter, setCardFilter] = useState<CardFilter>("all")
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<ModalFilter>("all")
  const [draftItems, setDraftItems] = useState<UtmParamItem[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [addBlockedType, setAddBlockedType] = useState<"utm_source" | "utm_s1">(
    "utm_source"
  )
  const [addBlockedValue, setAddBlockedValue] = useState("")
  const [isAddingBlocked, setIsAddingBlocked] = useState(false)
  const [addBlockedError, setAddBlockedError] = useState("")
  const [isAddBlockedOpen, setIsAddBlockedOpen] = useState(false)

  const filteredActiveItems = useMemo(() => {
    if (cardFilter === "all") return data.activeItems
    if (cardFilter === "source") {
      return data.activeItems.filter((item) => item.key === "utm_source")
    }
    return data.activeItems.filter((item) => item.key === "utm_s1")
  }, [cardFilter, data.activeItems])

  const filteredBlockedItems = useMemo(() => {
    if (cardFilter === "all") return data.blockedItems
    if (cardFilter === "source") {
      return data.blockedItems.filter((item) => item.key === "utm_source")
    }
    return data.blockedItems.filter((item) => item.key === "utm_s1")
  }, [cardFilter, data.blockedItems])

  const draftCounts = useMemo(
    () => ({
      all: draftItems.length,
      active: draftItems.filter((item) => item.status === "active").length,
      blocked: draftItems.filter((item) => item.status === "blocked").length,
    }),
    [draftItems]
  )

  const filteredDraftItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return draftItems.filter((item) => {
      const statusMatch = statusFilter === "all" || item.status === statusFilter
      const searchMatch =
        !q ||
        item.value.toLowerCase().includes(q) ||
        getUtmParamLabel(item.key).toLowerCase().includes(q)
      return statusMatch && searchMatch
    })
  }, [draftItems, searchQuery, statusFilter])

  const persistItems = useCallback(
    async (items: UtmParamItem[]) => {
      const response = await fetch(
        `/api/landing-pages/${encodeURIComponent(projectId)}/utm`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        }
      )
      if (!response.ok) return null
      return (await response.json()) as UtmDashboardData
    },
    [projectId]
  )

  const openEditModal = () => {
    setDraftItems(data.items)
    setSearchQuery("")
    setStatusFilter("all")
    setIsEditOpen(true)
  }

  const updateStatus = (
    key: string,
    value: string,
    status: "active" | "blocked"
  ) => {
    setDraftItems((prev) =>
      prev.map((item) =>
        item.key === key && item.value === value ? { ...item, status } : item
      )
    )
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const next = await persistItems(draftItems)
      if (next) {
        onDataChange(next)
        setIsEditOpen(false)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const addBlockedParam = async () => {
    setAddBlockedError("")
    const value = addBlockedValue.trim()
    if (!value) {
      setAddBlockedError("Please enter a value.")
      return false
    }
    setIsAddingBlocked(true)
    try {
      const next = await persistItems([
        { key: addBlockedType, value, status: "blocked" },
      ])
      if (!next) {
        setAddBlockedError("Failed to add blocked param.")
        return false
      }
      onDataChange(next)
      setAddBlockedValue("")
      return true
    } catch {
      setAddBlockedError("Failed to add blocked param.")
      return false
    } finally {
      setIsAddingBlocked(false)
    }
  }

  useEffect(() => {
    if (!isEditOpen && !isAddBlockedOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isEditOpen, isAddBlockedOpen])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className={overviewSectionHeadingClassName}>UTM Params Status</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Active params on the left, blocked on the right.
          </p>
        </div>
        <Button type="button" size="sm" onClick={openEditModal}>
          Edit
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "All"],
            ["source", "Source"],
            ["s1", "S1"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setCardFilter(value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              cardFilter === value
                ? "border-neutral-300 bg-neutral-100 text-neutral-900"
                : "border-border bg-card text-muted-foreground hover:bg-muted/50"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ParamsPanel
          title="Active"
          items={filteredActiveItems}
          tone="success"
          emptyMessage="No active UTM params yet."
        />
        <ParamsPanel
          title="Blocked"
          items={filteredBlockedItems}
          tone="danger"
          headerActions={
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setAddBlockedError("")
                setAddBlockedValue("")
                setAddBlockedType("utm_source")
                setIsAddBlockedOpen(true)
              }}
            >
              Add Manually
            </Button>
          }
          emptyMessage="No blocked UTM params."
        />
      </div>

      {isEditOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-card shadow-xl">
            <div className="border-b border-border px-5 py-4 sm:px-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold">Edit UTM Params</h3>
                <span className="text-xs text-muted-foreground">
                  {draftCounts.all} total
                </span>
              </div>
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by value or type..."
                className="mt-3"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {(
                  [
                    ["all", `All (${draftCounts.all})`],
                    ["active", `Active (${draftCounts.active})`],
                    ["blocked", `Blocked (${draftCounts.blocked})`],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setStatusFilter(value)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-semibold",
                      statusFilter === value
                        ? "border-neutral-300 bg-neutral-100"
                        : "border-border"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="max-h-[50vh] overflow-y-auto px-5 py-3 sm:px-6">
              {filteredDraftItems.map((item) => (
                <div
                  key={`${item.key}:${item.value}`}
                  className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{item.value}</p>
                    <p className="text-xs text-muted-foreground">
                      {getUtmParamLabel(item.key)}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        updateStatus(item.key, item.value, "active")
                      }
                      className={cn(
                        "rounded-md px-2 py-1 text-xs font-semibold",
                        item.status === "active"
                          ? "bg-teal-100 text-teal-700"
                          : "text-muted-foreground hover:bg-muted"
                      )}
                    >
                      Active
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateStatus(item.key, item.value, "blocked")
                      }
                      className={cn(
                        "rounded-md px-2 py-1 text-xs font-semibold",
                        item.status === "blocked"
                          ? "bg-rose-100 text-rose-700"
                          : "text-muted-foreground hover:bg-muted"
                      )}
                    >
                      Blocked
                    </button>
                  </div>
                </div>
              ))}
              {filteredDraftItems.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No UTM params found for this search.
                </p>
              ) : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-5 py-4 sm:px-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {isAddBlockedOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl sm:p-6">
            <h3 className="text-lg font-semibold">Add Blocked UTM Param</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose type and enter the value you want to block.
            </p>
            <div className="mt-4 flex gap-2">
              {(
                [
                  ["utm_source", "Source"],
                  ["utm_s1", "S1"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setAddBlockedType(key)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-xs font-semibold",
                    addBlockedType === key
                      ? "border-rose-300 bg-rose-50 text-rose-700"
                      : "border-border"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <Input
              value={addBlockedValue}
              onChange={(e) => setAddBlockedValue(e.target.value)}
              placeholder="Enter value to block"
              className="mt-3"
            />
            {addBlockedError ? (
              <p className="mt-2 text-sm text-rose-600">{addBlockedError}</p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddBlockedOpen(false)}
                disabled={isAddingBlocked}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  void addBlockedParam().then((ok) => {
                    if (ok) setIsAddBlockedOpen(false)
                  })
                }}
                disabled={isAddingBlocked}
              >
                {isAddingBlocked ? "Adding..." : "Add"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
