"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Bell, Loader2, UserPlus } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import { AlertSeverityIcon } from "@/features/alerts/view/AlertSeverityIcon"
import type {
  NotificationRecord,
  NotificationsListResponse,
} from "@/features/notifications/model/notifications"
import {
  formatNotificationTimestamp,
  isAccessRequestNotification,
  notificationRowClassName,
} from "@/features/notifications/utils/notification-format"
import { Button } from "@workspace/ui/components/button"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@workspace/ui/components/popover"

const REFETCH_MS = 60_000

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationRecord[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/notifications", { cache: "no-store" })
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
    void fetchNotifications()
  }, [fetchNotifications])

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return
      void fetchNotifications()
    }, REFETCH_MS)

    return () => window.clearInterval(id)
  }, [fetchNotifications])

  useEffect(() => {
    if (open) {
      void fetchNotifications()
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

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next)
  }, [])

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
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
            <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <PopoverHeader className="gap-2 border-b border-border px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <PopoverTitle className="text-sm font-semibold">
              Notifications
            </PopoverTitle>
            {unreadCount > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => void markAllRead()}
              >
                Mark all read
              </Button>
            ) : null}
          </div>
        </PopoverHeader>

        <div className="max-h-[min(24rem,60vh)] overflow-y-auto p-2">
          {isLoading && items.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Loading
            </div>
          ) : null}

          {error ? (
            <p className="px-2 py-6 text-center text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {!isLoading && !error && items.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">
              No notifications yet.
            </p>
          ) : null}

          {items.length > 0 ? (
            <ul className="space-y-2">
              {items.map((item) => {
                const isUnread = item.readAt == null
                const isAccessRequest = isAccessRequestNotification(item.type)
                const content = (
                  <>
                    <div className="mt-0.5 shrink-0">
                      {isAccessRequest ? (
                        <UserPlus
                          className="size-4 text-violet-600"
                          aria-hidden
                        />
                      ) : (
                        <AlertSeverityIcon
                          severity={item.severity}
                          className="size-4"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={cn(
                            "text-sm leading-snug",
                            isUnread
                              ? "font-semibold text-foreground"
                              : "font-medium text-foreground"
                          )}
                        >
                          {item.title}
                        </p>
                        {isUnread ? (
                          <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                        {item.body}
                      </p>
                      {isAccessRequest ? (
                        <p className="mt-1 text-[11px] font-medium text-violet-700">
                          Review on Team
                        </p>
                      ) : null}
                      <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                        {formatNotificationTimestamp(item.createdAt)}
                      </p>
                    </div>
                  </>
                )

                return (
                  <li key={item.id}>
                    {item.href ? (
                      <Link
                        href={item.href}
                        onClick={() => {
                          if (isUnread) void markRead(item.id)
                          setOpen(false)
                        }}
                        className={cn(
                          "flex gap-2 rounded-lg border px-3 py-2.5 transition-colors hover:bg-muted/40",
                          notificationRowClassName(item.severity, item.type),
                          isUnread && "ring-1 ring-primary/10"
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
                          "flex w-full gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-muted/40",
                          notificationRowClassName(item.severity, item.type),
                          isUnread && "ring-1 ring-primary/10"
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
