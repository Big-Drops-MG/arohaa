"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import type { SeoGscMeta, SeoSource } from "@/features/seo/model/seo"
import { SeoImportPanel } from "@/features/seo/view/SeoImportPanel"

type GscSite = { siteUrl: string; permissionLevel: string }

type SeoConnectPanelProps = {
  projectId: string
  source: SeoSource
  gsc: SeoGscMeta
  onChanged: () => void
}

export function SeoConnectPanel({
  projectId,
  source,
  gsc,
  onChanged,
}: SeoConnectPanelProps) {
  const [sites, setSites] = useState<GscSite[]>([])
  const [siteUrl, setSiteUrl] = useState(gsc.siteUrl ?? "")
  const [connected, setConnected] = useState(gsc.connected)
  const [email, setEmail] = useState(gsc.accountEmail)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refreshStatus = useCallback(async () => {
    const res = await fetch(
      `/api/integrations/gsc?public_id=${encodeURIComponent(projectId)}`
    )
    const body = (await res.json().catch(() => null)) as {
      connected?: boolean
      email?: string | null
      sites?: GscSite[]
      gscSiteUrl?: string | null
      error?: string
    } | null
    if (!res.ok && res.status !== 502) {
      setError(body?.error ?? "Failed to load Search Console status")
      return
    }
    setConnected(Boolean(body?.connected))
    setEmail(body?.email ?? null)
    setSites(body?.sites ?? [])
    setSiteUrl(body?.gscSiteUrl ?? "")
    if (body?.error) setError(body.error)
  }, [projectId])

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])

  useEffect(() => {
    setConnected(gsc.connected)
    setEmail(gsc.accountEmail)
    setSiteUrl(gsc.siteUrl ?? "")
  }, [gsc])

  const bindProperty = async () => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch(
        `/api/landing-pages/${encodeURIComponent(projectId)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            gscSiteUrl: siteUrl.trim() || null,
          }),
        }
      )
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(body?.error ?? "Failed to save property")
      }
      setMessage("Search Console property saved")
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save property")
    } finally {
      setBusy(false)
    }
  }

  const syncFromGsc = async () => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch(
        `/api/landing-pages/${encodeURIComponent(projectId)}/seo`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "gsc_sync" }),
        }
      )
      const body = (await res.json().catch(() => null)) as {
        error?: string
        inserted?: number
      } | null
      if (!res.ok) {
        throw new Error(body?.error ?? "Search Console sync failed")
      }
      setMessage(`Synced ${body?.inserted ?? 0} rows from Search Console`)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed")
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/integrations/gsc?public_id=${encodeURIComponent(projectId)}`,
        { method: "DELETE" }
      )
      if (!res.ok) {
        throw new Error("Failed to disconnect")
      }
      setConnected(false)
      setEmail(null)
      setSites([])
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disconnect failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {source === "gsc" ? "Search Console" : "Google organic (SDK)"}
        </span>
        {connected && email ? (
          <span className="text-xs text-muted-foreground">{email}</span>
        ) : null}
        {gsc.lastSyncedAt ? (
          <span className="text-xs text-muted-foreground">
            Last sync {new Date(gsc.lastSyncedAt).toLocaleString()}
          </span>
        ) : null}
      </div>

      <p className="text-sm text-muted-foreground">
        {source === "gsc"
          ? "Showing Search Console queries, clicks, impressions, CTR, and position."
          : "Showing Google organic traffic from the Arohaa SDK. Connect Search Console for keywords and rankings."}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {!connected ? (
          <Button asChild size="sm">
            <a
              href={`/api/integrations/gsc/connect?public_id=${encodeURIComponent(projectId)}`}
            >
              Connect Search Console
            </a>
          </Button>
        ) : (
          <>
            <Button
              type="button"
              size="sm"
              disabled={busy || !siteUrl.trim()}
              onClick={() => void syncFromGsc()}
            >
              {busy ? "Working..." : "Sync from Search Console"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void disconnect()}
            >
              Disconnect
            </Button>
          </>
        )}
        <SeoImportPanel projectId={projectId} onSynced={onChanged} />
      </div>

      {connected ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-[16rem] flex-1 flex-col gap-1 text-xs text-muted-foreground">
            Property for this landing page
            <select
              className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
              value={siteUrl}
              onChange={(event) => setSiteUrl(event.target.value)}
            >
              <option value="">Select a property</option>
              {sites.map((site) => (
                <option key={site.siteUrl} value={site.siteUrl}>
                  {site.siteUrl}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void bindProperty()}
          >
            Save property
          </Button>
        </div>
      ) : null}

      {message ? (
        <p className="text-sm text-emerald-700" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
