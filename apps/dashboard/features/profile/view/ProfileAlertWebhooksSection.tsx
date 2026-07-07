"use client"

import { useCallback, useEffect, useState } from "react"
import { Bell, Loader2, Plus, Send, Trash2 } from "lucide-react"
import { SettingsSectionCard } from "@/features/settings/view/SettingsSectionCard"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { cn } from "@workspace/ui/lib/utils"

type WebhookItem = {
  id: string
  name: string
  url: string
  provider: string
  enabled: boolean
  lastTestedAt: string | null
  lastTestStatus: string | null
  lastTestError: string | null
  createdAt: string
}

function formatTestStatus(item: WebhookItem): string | null {
  if (!item.lastTestedAt) return null
  const when = new Date(item.lastTestedAt).toLocaleString()
  if (item.lastTestStatus === "success") return `Last test succeeded · ${when}`
  if (item.lastTestStatus === "failed") {
    return `Last test failed · ${when}${item.lastTestError ? ` · ${item.lastTestError}` : ""}`
  }
  return `Last tested · ${when}`
}

export function ProfileAlertWebhooksSection() {
  const [items, setItems] = useState<WebhookItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [url, setUrl] = useState("")
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const loadWebhooks = useCallback(async () => {
    setError(null)
    const response = await fetch("/api/workspace/alert-webhooks")
    if (!response.ok) {
      setError("Could not load alert webhooks")
      return
    }
    const json = (await response.json()) as { items: WebhookItem[] }
    setItems(json.items)
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        await loadWebhooks()
      } finally {
        setLoading(false)
      }
    })()
  }, [loadWebhooks])

  const handleCreate = useCallback(async () => {
    setError(null)
    setCreating(true)
    try {
      const response = await fetch("/api/workspace/alert-webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, url }),
      })
      const json = (await response.json()) as {
        error?: string
        item?: WebhookItem
      }
      if (!response.ok) {
        setError(json.error ?? "Failed to add webhook")
        return
      }
      if (json.item) {
        setItems((prev) => [json.item!, ...prev])
      }
      setName("")
      setUrl("")
    } finally {
      setCreating(false)
    }
  }, [name, url])

  const handleDelete = useCallback(async (id: string) => {
    setError(null)
    setDeletingId(id)
    try {
      const response = await fetch(`/api/workspace/alert-webhooks/${id}`, {
        method: "DELETE",
      })
      if (!response.ok) {
        const json = (await response.json()) as { error?: string }
        setError(json.error ?? "Failed to remove webhook")
        return
      }
      setItems((prev) => prev.filter((item) => item.id !== id))
    } finally {
      setDeletingId(null)
    }
  }, [])

  const handleTest = useCallback(async (id: string) => {
    setError(null)
    setTestingId(id)
    try {
      const response = await fetch(`/api/workspace/alert-webhooks/${id}/test`, {
        method: "POST",
      })
      const json = (await response.json()) as {
        error?: string
        item?: WebhookItem
        success?: boolean
      }
      if (json.item) {
        setItems((prev) =>
          prev.map((item) => (item.id === id ? json.item! : item))
        )
      }
      if (!response.ok) {
        setError(json.error ?? "Webhook test failed")
      }
    } finally {
      setTestingId(null)
    }
  }, [])

  const handleToggleEnabled = useCallback(
    async (id: string, enabled: boolean) => {
      setError(null)
      setTogglingId(id)
      try {
        const response = await fetch(`/api/workspace/alert-webhooks/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled }),
        })
        const json = (await response.json()) as {
          error?: string
          item?: WebhookItem
        }
        if (!response.ok) {
          setError(json.error ?? "Failed to update webhook")
          return
        }
        if (json.item) {
          setItems((prev) =>
            prev.map((item) => (item.id === id ? json.item! : item))
          )
        }
      } finally {
        setTogglingId(null)
      }
    },
    []
  )

  return (
    <SettingsSectionCard
      title="Alert webhooks"
      description="Send analytics alerts to your Slack or Discord channel when traffic or conversion metrics change."
    >
      <div className="space-y-4">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="webhook-name">Name</Label>
            <Input
              id="webhook-name"
              placeholder="e.g. #marketing-alerts"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="webhook-url">Incoming webhook URL</Label>
            <Input
              id="webhook-url"
              placeholder="https://hooks.slack.com/services/…"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
          </div>
        </div>

        <Button
          type="button"
          className="gap-2"
          disabled={creating || !name.trim() || !url.trim()}
          onClick={() => void handleCreate()}
        >
          {creating ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="size-4" aria-hidden />
          )}
          Add webhook
        </Button>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading webhooks…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No webhooks configured. Add a Slack or Discord incoming webhook to
            receive analytics alerts.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {items.map((item) => {
              const testStatus = formatTestStatus(item)
              return (
                <li
                  key={item.id}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Bell className="size-4 shrink-0 text-muted-foreground" />
                      <p className="truncate text-sm font-medium text-foreground">
                        {item.name}
                      </p>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          item.enabled
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {item.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {item.url} · {item.provider}
                    </p>
                    {testStatus ? (
                      <p
                        className={cn(
                          "mt-2 text-xs",
                          item.lastTestStatus === "failed"
                            ? "text-destructive"
                            : "text-muted-foreground"
                        )}
                      >
                        {testStatus}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      disabled={testingId === item.id || togglingId === item.id}
                      onClick={() => void handleTest(item.id)}
                    >
                      {testingId === item.id ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <Send className="size-4" aria-hidden />
                      )}
                      Test
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={testingId === item.id || togglingId === item.id}
                      onClick={() =>
                        void handleToggleEnabled(item.id, !item.enabled)
                      }
                    >
                      {item.enabled ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2 text-destructive hover:text-destructive"
                      disabled={deletingId === item.id}
                      onClick={() => void handleDelete(item.id)}
                    >
                      {deletingId === item.id ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <Trash2 className="size-4" aria-hidden />
                      )}
                      Remove
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </SettingsSectionCard>
  )
}
