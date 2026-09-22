/**
 * Drop-in service worker source for Model B.
 * Masked click URLs live in notification data.url — open that as-is.
 * Reports display/dismiss to /api/push/events (or data.events_path).
 */
export const WEB_PUSH_SERVICE_WORKER_SOURCE = `/* Arohaa web-push service worker (Model B) */
function beaconEvent(data, eventName) {
  try {
    const path = (data && data.events_path) || "/api/push/events"
    const body = JSON.stringify({
      event: eventName,
      delivery_id: data && data.delivery_id,
      arohaa_click_id: data && data.arohaa_click_id,
      wid: data && data.wid,
      occurred_at: new Date().toISOString(),
    })
    return fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body,
      credentials: "same-origin",
      keepalive: true,
    }).catch(function () {})
  } catch (e) {
    return Promise.resolve()
  }
}

self.addEventListener("push", (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { body: event.data ? event.data.text() : "" }
  }

  const title = payload.title || "Notification"
  const data = {
    url: payload.url || (payload.data && payload.data.url) || "/",
    ...(payload.data || {}),
  }
  const options = {
    body: payload.body || "",
    icon: payload.icon || undefined,
    badge: payload.badge || undefined,
    image: payload.image || undefined,
    tag: payload.tag || undefined,
    requireInteraction: Boolean(payload.requireInteraction),
    data: data,
  }

  event.waitUntil(
    self.registration.showNotification(title, options).then(function () {
      return beaconEvent(data, "push_displayed")
    }),
  )
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

self.addEventListener("notificationclose", (event) => {
  const data = (event.notification && event.notification.data) || {}
  event.waitUntil(beaconEvent(data, "push_dismissed"))
})
`
