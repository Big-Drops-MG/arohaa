"use client"

import { useEffect, useState } from "react"
import {
  attachWebPushVisibilityEvents,
  isWebPushSupported,
  reportWebPushEvent,
  subscribeWebPush,
  unsubscribeWebPush,
} from "./web-push-client"
import type {
  WebPushContext,
  WebPushEnvConfig,
  WebPushSubscriptionJson,
} from "../model/web-push"

export type UseWebPushOptions = WebPushEnvConfig & {
  /** Auto-attach page_hidden / page_visible after a successful subscribe */
  trackVisibility?: boolean
  context?: Partial<WebPushContext>
}

export type UseWebPushResult = {
  supported: boolean
  permission: NotificationPermission | "unsupported"
  subscription: WebPushSubscriptionJson | null
  busy: boolean
  error: string | null
  subscribe: () => Promise<boolean>
  unsubscribe: () => Promise<boolean>
  reportEvent: (
    event: string,
    context?: Partial<WebPushContext>,
  ) => Promise<boolean>
}

export function useWebPush(options: UseWebPushOptions): UseWebPushResult {
  const [subscription, setSubscription] =
    useState<WebPushSubscriptionJson | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >("unsupported")

  const config: WebPushEnvConfig = {
    vapidPublicKey: options.vapidPublicKey,
    proxyBase: options.proxyBase,
    subscribeUrl: options.subscribeUrl,
    eventsUrl: options.eventsUrl,
    wid: options.wid,
    sessionId: options.sessionId,
    serviceWorkerUrl: options.serviceWorkerUrl,
  }

  const supported = isWebPushSupported()

  useEffect(() => {
    if (!supported) {
      setPermission("unsupported")
      return
    }
    setPermission(Notification.permission)
  }, [supported])

  useEffect(() => {
    if (!options.trackVisibility || !subscription) return
    return attachWebPushVisibilityEvents(config, {
      context: options.context,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- attach once per subscription
  }, [options.trackVisibility, subscription])

  async function subscribe() {
    setBusy(true)
    setError(null)
    try {
      const result = await subscribeWebPush({
        config,
        context: options.context,
      })
      if (!result.ok) {
        setError(result.error)
        return false
      }
      setSubscription(result.subscription)
      if (supported) setPermission(Notification.permission)
      void reportWebPushEvent({
        config,
        event: "push_subscribed",
        context: options.context,
        subscriptionEndpoint: result.subscription.endpoint,
      })
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "Subscribe failed")
      return false
    } finally {
      setBusy(false)
    }
  }

  async function unsubscribe() {
    setBusy(true)
    setError(null)
    try {
      await reportWebPushEvent({
        config,
        event: "unsubscribe",
        context: options.context,
      })
      const result = await unsubscribeWebPush({
        config,
        context: options.context,
      })
      if (!result.ok) {
        setError(result.error ?? "Unsubscribe failed")
        return false
      }
      setSubscription(null)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unsubscribe failed")
      return false
    } finally {
      setBusy(false)
    }
  }

  async function reportEvent(
    event: string,
    context?: Partial<WebPushContext>,
  ) {
    const result = await reportWebPushEvent({
      config,
      event,
      context: { ...options.context, ...context },
    })
    if (!result.ok) {
      setError(result.error ?? "Event failed")
      return false
    }
    return true
  }

  return {
    supported,
    permission,
    subscription,
    busy,
    error,
    subscribe,
    unsubscribe,
    reportEvent,
  }
}
