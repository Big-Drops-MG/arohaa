"use client"

import { useCallback, useEffect, useState } from "react"
import { Bell, Loader2, Plus, Trash2 } from "lucide-react"
import { SettingsSectionCard } from "@/features/settings/view/SettingsSectionCard"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

type WebhookItem = {
  id: string
  name: string
  url: string
  provider: string
  enabled: boolean
  createdAt: string
}

export function ProfileAlertWebhooksSection() {
  const [items, setItems] = useState<WebhookItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [url, setUrl] = useState("")
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Bell className="size-4 shrink-0 text-muted-foreground" />
                    <p className="truncate text-sm font-medium text-foreground">
                      {item.name}
                    </p>
                  </div>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {item.url} · {item.provider}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-2 text-destructive hover:text-destructive"
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
              </li>
            ))}
          </ul>
        )}
      </div>
    </SettingsSectionCard>
  )
}
