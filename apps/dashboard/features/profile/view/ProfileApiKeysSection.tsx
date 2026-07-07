"use client"

import { useCallback, useEffect, useState } from "react"
import { KeyRound, Loader2, Plus, Trash2 } from "lucide-react"
import { SettingsCopyBlock } from "@/features/settings/view/SettingsCopyBlock"
import { SettingsSectionCard } from "@/features/settings/view/SettingsSectionCard"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

type ApiKeyItem = {
  id: string
  name: string
  keyPrefix: string
  createdAt: string
  lastUsedAt: string | null
}

export function ProfileApiKeysSection() {
  const [items, setItems] = useState<ApiKeyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [creating, setCreating] = useState(false)
  const [revealedKey, setRevealedKey] = useState<string | null>(null)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const loadKeys = useCallback(async () => {
    setError(null)
    const response = await fetch("/api/workspace/api-keys")
    if (!response.ok) {
      setError("Could not load API keys")
      return
    }
    const json = (await response.json()) as { items: ApiKeyItem[] }
    setItems(json.items)
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        await loadKeys()
      } finally {
        setLoading(false)
      }
    })()
  }, [loadKeys])

  const handleCreate = useCallback(async () => {
    setError(null)
    setCreating(true)
    try {
      const response = await fetch("/api/workspace/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      const json = (await response.json()) as {
        error?: string
        key?: string
        item?: ApiKeyItem
      }
      if (!response.ok) {
        setError(json.error ?? "Failed to create API key")
        return
      }
      if (json.item) {
        setItems((prev) => [json.item!, ...prev])
      }
      setRevealedKey(json.key ?? null)
      setName("")
    } finally {
      setCreating(false)
    }
  }, [name])

  const handleRevoke = useCallback(async (id: string) => {
    setError(null)
    setRevokingId(id)
    try {
      const response = await fetch(`/api/workspace/api-keys/${id}`, {
        method: "DELETE",
      })
      if (!response.ok) {
        const json = (await response.json()) as { error?: string }
        setError(json.error ?? "Failed to revoke API key")
        return
      }
      setItems((prev) => prev.filter((item) => item.id !== id))
    } finally {
      setRevokingId(null)
    }
  }, [])

  return (
    <SettingsSectionCard
      title="API keys"
      description="Generate workspace keys for programmatic analytics access. Keys are shown once at creation."
    >
      <div className="space-y-4">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {revealedKey ? (
          <SettingsCopyBlock
            label="New API key"
            description="Copy this key now. You will not be able to see it again."
            value={revealedKey}
            copyLabel="Copy key"
          />
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="api-key-name">Key name</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="api-key-name"
              placeholder="e.g. Production dashboard"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
            />
            <Button
              type="button"
              className="shrink-0 gap-2"
              disabled={creating || !name.trim()}
              onClick={() => void handleCreate()}
            >
              {creating ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Plus className="size-4" aria-hidden />
              )}
              Generate key
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading API keys…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No active API keys. Generate one to authenticate analytics requests
            with{" "}
            <code className="text-xs">Authorization: Bearer arohaa_live_…</code>
            .
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
                    <KeyRound className="size-4 shrink-0 text-muted-foreground" />
                    <p className="truncate text-sm font-medium text-foreground">
                      {item.name}
                    </p>
                  </div>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {item.keyPrefix}…
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Created {new Date(item.createdAt).toLocaleDateString()}
                    {item.lastUsedAt
                      ? ` · Last used ${new Date(item.lastUsedAt).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-2 text-destructive hover:text-destructive"
                  disabled={revokingId === item.id}
                  onClick={() => void handleRevoke(item.id)}
                >
                  {revokingId === item.id ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Trash2 className="size-4" aria-hidden />
                  )}
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SettingsSectionCard>
  )
}
