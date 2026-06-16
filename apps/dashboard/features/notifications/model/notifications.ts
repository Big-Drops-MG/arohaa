export type NotificationSeverity = "warning" | "alert" | "error" | "info"

export type NotificationRecord = {
  id: string
  type: string
  title: string
  body: string
  severity: NotificationSeverity
  landingPageId: string | null
  landingPagePublicId: string | null
  href: string | null
  readAt: string | null
  createdAt: string
}

export type NotificationsListResponse = {
  items: NotificationRecord[]
  unreadCount: number
}
