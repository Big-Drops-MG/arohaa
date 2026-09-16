/**
 * Drop-in service worker source for Model B.
 * Masked click URLs live in notification data.url — open that as-is.
 */
export const WEB_PUSH_SERVICE_WORKER_SOURCE = `/* Arohaa web-push service worker (Model B) */
self.addEventListener("push", (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { body: event.data ? event.data.text() : "" }
  }

  const title = payload.title || "Notification"
  const options = {
    body: payload.body || "",
    icon: payload.icon || undefined,
    badge: payload.badge || undefined,
    image: payload.image || undefined,
    tag: payload.tag || undefined,
    requireInteraction: Boolean(payload.requireInteraction),
    data: {
      url: payload.url || (payload.data && payload.data.url) || "/",
      ...(payload.data || {}),
    },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const raw =
    (event.notification.data && event.notification.data.url) ||
    event.notification.data?.target_url ||
    "/"
  const url = typeof raw === "string" ? raw : "/"
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate?.(url)
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(url)
    }),
  )
})
`
