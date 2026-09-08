"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Bell,
  CheckCheck,
  Inbox,
  Loader2,
  PlugZap,
  Settings2,
  UserPlus,
} from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import { AlertSeverityIcon } from "@/features/alerts/view/AlertSeverityIcon"
import type {
  NotificationRecord,
  NotificationsListResponse,
} from "@/features/notifications/model/notifications"
import {
  formatNotificationTimestamp,
  isAccessRequestNotification,
  notificationAccentClass,
} from "@/features/notifications/utils/notification-format"
import { Button } from "@workspace/ui/components/button"
import { writeDashboardPreference } from "@/lib/dashboard/dashboard-preferences"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"

const POLL_MS = 90_000

function NotificationIcon({ item }: { item: NotificationRecord }) {
  if (isAccessRequestNotification(item.type)) {
    return <UserPlus className="size-4 text-violet-600" aria-hidden />
  }
  if (item.type === "connection") {
    return <PlugZap className="size-4 text-emerald-600" aria-hidden />
  }
  if (item.type === "project_action") {
    return <Settings2 className="size-4 text-neutral-500" aria-hidden />
  }
  return <AlertSeverityIcon severity={item.severity} className="size-4" />
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationRecord[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<"all" | "unread">("all")

  const fetchNotifications = useCallback(async (opts?: { sync?: boolean }) => {
    setIsLoading(true)
    setError(null)

    try {
      const url = opts?.sync
        ? "/api/notifications?sync=1"
        : "/api/notifications"
      const res = await fetch(url, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as
        | NotificationsListResponse
        | { error?: string }

      if (!res.ok || !("items" in data)) {
        setError(
          "error" in data && data.error
            ? data.error
            : "Could not load notifications"
        )
        return
      }

      setItems(data.items)
      setUnreadCount(data.unreadCount)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchNotifications({ sync: true })
  }, [fetchNotifications])

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return
      void fetchNotifications()
    }, POLL_MS)

    return () => window.clearInterval(id)
  }, [fetchNotifications])

  useEffect(() => {
    if (open) {
      void fetchNotifications({ sync: true })
    }
  }, [open, fetchNotifications])

  const markRead = useCallback(async (notificationId: string) => {
    await fetch(
      `/api/notifications/${encodeURIComponent(notificationId)}/read`,
      {
        method: "PATCH",
      }
    )

    setItems((current) =>
      current.map((item) =>
        item.id === notificationId
          ? { ...item, readAt: new Date().toISOString() }
          : item
      )
    )
    setUnreadCount((count) => Math.max(0, count - 1))
  }, [])

  const markAllRead = useCallback(async () => {
    await fetch("/api/notifications/read-all", { method: "POST" })
    const now = new Date().toISOString()
    setItems((current) =>
      current.map((item) => ({ ...item, readAt: item.readAt ?? now }))
    )
    setUnreadCount(0)
  }, [])

  const visibleItems = useMemo(() => {
    if (filter === "unread") {
      return items.filter((item) => item.readAt == null)
    }
    return items
  }, [filter, items])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative size-9 rounded-full border-border"
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : "Notifications"
          }
        >
          <Bell className="size-4" aria-hidden />
          {unreadCount > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-neutral-950 px-1 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[22.5rem] gap-0 overflow-hidden rounded-xl border-neutral-200 p-0 shadow-lg"
      >
        <PopoverHeader className="gap-0 border-b-0 p-0">
          <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-2">
            <div className="min-w-0">
              <PopoverTitle className="text-[13px] font-semibold tracking-tight text-neutral-950">
                Notifications
              </PopoverTitle>
              <p className="mt-0.5 text-[11px] text-neutral-500">
                {unreadCount > 0
                  ? `${unreadCount} unread`
                  : "You're all caught up"}
              </p>
            </div>
            {unreadCount > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-[11px] font-medium text-neutral-600 hover:text-neutral-950"
                onClick={() => void markAllRead()}
              >
                <CheckCheck className="size-3.5" aria-hidden />
                Mark all read
              </Button>
            ) : null}
          </div>

          <Tabs
            value={filter}
            onValueChange={(value) =>
              setFilter(value === "unread" ? "unread" : "all")
            }
            className="w-full"
          >
            <div className="w-full border-b border-neutral-200 bg-neutral-50/90 px-4">
              <TabsList className="h-auto min-h-9 w-auto justify-start gap-x-5 gap-y-1 rounded-none border-0 bg-transparent px-0">
                <TabsTrigger
                  value="all"
                  className="py-2 text-xs data-[state=active]:font-semibold"
                >
                  All
                </TabsTrigger>
                <TabsTrigger
                  value="unread"
                  className="py-2 text-xs data-[state=active]:font-semibold"
                >
                  Unread
                </TabsTrigger>
              </TabsList>
            </div>
          </Tabs>
        </PopoverHeader>

        <div className="max-h-[min(26rem,62vh)] overflow-y-auto">
          {isLoading && items.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-neutral-500">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Loading
            </div>
          ) : null}

          {error ? (
            <p className="px-4 py-10 text-center text-sm text-red-600">
              {error}
            </p>
          ) : null}

          {!isLoading && !error && visibleItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
                <Inbox className="size-4" aria-hidden />
              </div>
              <p className="text-sm font-medium text-neutral-800">
                {filter === "unread"
                  ? "No unread notifications"
                  : "No notifications yet"}
              </p>
              <p className="text-[12px] leading-relaxed text-neutral-500">
                Important traffic drops, conversion issues, and project updates
                will show up here.
              </p>
            </div>
          ) : null}

          {visibleItems.length > 0 ? (
            <ul className="divide-y divide-neutral-100">
              {visibleItems.map((item) => {
                const isUnread = item.readAt == null
                const isAccessRequest = isAccessRequestNotification(item.type)
                const targetHref =
                  item.href && item.landingPagePublicId
                    ? item.href.split("?")[0]!
                    : item.href

                const content = (
                  <>
                    <span
                      className={cn(
                        "absolute top-0 bottom-0 left-0 w-0.5",
                        isUnread
                          ? notificationAccentClass(item.severity, item.type)
                          : "bg-transparent"
                      )}
                      aria-hidden
                    />
                    <div
                      className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                        isUnread ? "bg-neutral-100" : "bg-neutral-50"
                      )}
                    >
                      <NotificationIcon item={item} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={cn(
                            "text-[13px] leading-snug",
                            isUnread
                              ? "font-semibold text-neutral-950"
                              : "font-medium text-neutral-700"
                          )}
                        >
                          {item.title}
                        </p>
                        <span className="shrink-0 text-[11px] text-neutral-400 tabular-nums">
                          {formatNotificationTimestamp(item.createdAt)}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-neutral-500">
                        {item.body}
                      </p>
                      {isAccessRequest ? (
                        <p className="mt-1.5 text-[11px] font-medium text-violet-700">
                          Review on Team
                        </p>
                      ) : null}
                    </div>
                  </>
                )

                return (
                  <li key={item.id}>
                    {targetHref ? (
                      <Link
                        href={targetHref}
                        onClick={() => {
                          if (item.href && item.landingPagePublicId) {
                            const params = new URLSearchParams(
                              item.href.split("?")[1] ?? ""
                            )
                            for (const [key, value] of params) {
                              writeDashboardPreference(
                                item.landingPagePublicId,
                                key,
                                value
                              )
                            }
                          }
                          if (isUnread) void markRead(item.id)
                          setOpen(false)
                        }}
                        className={cn(
                          "relative flex gap-3 px-4 py-3 transition-colors hover:bg-neutral-50",
                          isUnread && "bg-neutral-50/70"
                        )}
                      >
                        {content}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (isUnread) void markRead(item.id)
                        }}
                        className={cn(
                          "relative flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-neutral-50",
                          isUnread && "bg-neutral-50/70"
                        )}
                      >
                        {content}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}
