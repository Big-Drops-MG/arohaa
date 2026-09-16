"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { cn } from "@workspace/ui/lib/utils"
import type {
  NotificationCenterCampaign,
  NotificationCenterDashboardData,
} from "@/features/notification-center/model/notification-center"
import { WEB_PUSH_TRIGGER_EVENTS } from "@/features/notification-center/model/notification-center"
import { buildLpWebPushOpsSnippet } from "@/features/notification-center/model/lp-ops-snippet"

type NotificationCenterDashboardProps = {
  data: NotificationCenterDashboardData
  projectId: string
  isLoading?: boolean
}

type DripStepForm = {
  delayMinutes: string
  title: string
  body: string
  tag: string
}

type CampaignFormState = {
  name: string
  title: string
  body: string
  iconUrl: string
  badgeUrl: string
  imageUrl: string
  tag: string
  requireInteraction: boolean
  clickMode: "fixed" | "template" | "last_url"
  fixedUrl: string
  urlTemplate: string
  appendUtmSource: string
  appendUtmMedium: string
  appendUtmCampaign: string
  maskedRedirect: boolean
  resumeMode: "frozen" | "fresh"
  triggerType: "delay_after_event" | "immediate" | "drip"
  triggerEvent: string
  delayMinutes: string
  dripSteps: DripStepForm[]
  cancelOn: string[]
  maxPerUserPerDay: string
  quietEnabled: boolean
  quietStart: string
  quietEnd: string
  quietTz: string
  status: "draft" | "active" | "paused"
}

const EMPTY_FORM: CampaignFormState = {
  name: "",
  title: "",
  body: "",
  iconUrl: "",
  badgeUrl: "",
  imageUrl: "",
  tag: "",
  requireInteraction: false,
  clickMode: "last_url",
  fixedUrl: "",
  urlTemplate:
    "https://{{lp_host}}/?utm_source=push&utm_campaign={{campaign_id}}",
  appendUtmSource: "push",
  appendUtmMedium: "web_push",
  appendUtmCampaign: "",
  maskedRedirect: true,
  resumeMode: "frozen",
  triggerType: "delay_after_event",
  triggerEvent: "page_hidden",
  delayMinutes: "15",
  dripSteps: [
    { delayMinutes: "15", title: "", body: "", tag: "abandon-1" },
    { delayMinutes: "240", title: "", body: "", tag: "abandon-2" },
  ],
  cancelOn: ["page_visible", "form_success", "unsubscribe"],
  maxPerUserPerDay: "3",
  quietEnabled: false,
  quietStart: "22:00",
  quietEnd: "08:00",
  quietTz: "user",
  status: "draft",
}

function formFromCampaign(c: NotificationCenterCampaign): CampaignFormState {
  return {
    name: c.name,
    title: c.title,
    body: c.body ?? "",
    iconUrl: c.iconUrl ?? "",
    badgeUrl: c.badgeUrl ?? "",
    imageUrl: c.imageUrl ?? "",
    tag: c.tag ?? "",
    requireInteraction: c.requireInteraction,
    clickMode: c.click.mode,
    fixedUrl: c.click.fixedUrl ?? "",
    urlTemplate:
      c.click.urlTemplate ??
      "https://{{lp_host}}/?utm_source=push&utm_campaign={{campaign_id}}",
    appendUtmSource: c.click.appendUtms?.utm_source ?? "push",
    appendUtmMedium: c.click.appendUtms?.utm_medium ?? "web_push",
    appendUtmCampaign: c.click.appendUtms?.utm_campaign ?? "",
    maskedRedirect: c.click.maskedRedirect !== false,
    resumeMode: c.click.resumeMode === "fresh" ? "fresh" : "frozen",
    triggerType: c.trigger.type,
    triggerEvent: c.trigger.event ?? "page_hidden",
    delayMinutes: String(Math.round((c.trigger.delayMs ?? 900000) / 60000)),
    dripSteps:
      c.trigger.steps && c.trigger.steps.length > 0
        ? c.trigger.steps.map((s) => ({
            delayMinutes: String(Math.round((s.delayMs ?? 0) / 60000)),
            title: s.title ?? "",
            body: s.body ?? "",
            tag: s.tag ?? "",
          }))
        : EMPTY_FORM.dripSteps,
    cancelOn: c.trigger.cancelOn ?? [],
    maxPerUserPerDay:
      c.limits?.maxPerUserPerDay != null
        ? String(c.limits.maxPerUserPerDay)
        : "",
    quietEnabled: Boolean(c.limits?.quietHours?.start),
    quietStart: c.limits?.quietHours?.start ?? "22:00",
    quietEnd: c.limits?.quietHours?.end ?? "08:00",
    quietTz: c.limits?.quietHours?.tz ?? "user",
    status: c.status,
  }
}

function toPayload(form: CampaignFormState) {
  const appendUtms: Record<string, string> = {}
  if (form.appendUtmSource.trim()) {
    appendUtms.utm_source = form.appendUtmSource.trim()
  }
  if (form.appendUtmMedium.trim()) {
    appendUtms.utm_medium = form.appendUtmMedium.trim()
  }
  if (form.appendUtmCampaign.trim()) {
    appendUtms.utm_campaign = form.appendUtmCampaign.trim()
  }

  const delayMinutes = Number(form.delayMinutes)
  const maxPerDay = Number(form.maxPerUserPerDay)

  return {
    name: form.name.trim(),
    title: form.title.trim(),
    body: form.body.trim() || null,
    iconUrl: form.iconUrl.trim() || null,
    badgeUrl: form.badgeUrl.trim() || null,
    imageUrl: form.imageUrl.trim() || null,
    tag: form.tag.trim() || null,
    requireInteraction: form.requireInteraction,
    click: {
      mode: form.clickMode,
      fixedUrl: form.fixedUrl.trim() || null,
      urlTemplate: form.urlTemplate.trim() || null,
      appendUtms: Object.keys(appendUtms).length ? appendUtms : null,
      maskedRedirect: form.maskedRedirect,
      resumeMode: form.resumeMode,
    },
    trigger: {
      type: form.triggerType,
      event:
        form.triggerType === "delay_after_event" || form.triggerType === "drip"
          ? form.triggerEvent
          : null,
      delayMs:
        form.triggerType === "delay_after_event"
          ? Math.max(
              0,
              Math.round(
                (Number.isFinite(delayMinutes) ? delayMinutes : 0) * 60_000
              )
            )
          : 0,
      steps:
        form.triggerType === "drip"
          ? form.dripSteps.map((s) => {
              const mins = Number(s.delayMinutes)
              return {
                delayMs: Math.max(
                  0,
                  Math.round((Number.isFinite(mins) ? mins : 0) * 60_000)
                ),
                title: s.title.trim() || null,
                body: s.body.trim() || null,
                tag: s.tag.trim() || null,
              }
            })
          : null,
      cancelOn: form.cancelOn,
    },
    limits: {
      maxPerUserPerDay:
        Number.isFinite(maxPerDay) && maxPerDay > 0 ? maxPerDay : null,
      quietHours: form.quietEnabled
        ? {
            start: form.quietStart.trim(),
            end: form.quietEnd.trim(),
            tz: form.quietTz.trim() || "user",
          }
        : null,
    },
    status: form.status,
  }
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-xs">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 font-heading text-2xl font-semibold text-foreground tabular-nums">
        {value}
      </p>
    </div>
  )
}

export function NotificationCenterDashboard({
  data: initial,
  projectId,
  isLoading = false,
}: NotificationCenterDashboardProps) {
  const [data, setData] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CampaignFormState>(EMPTY_FORM)
  const [freshWebhookSecret, setFreshWebhookSecret] = useState<string | null>(
    null
  )

  useEffect(() => {
    setData(initial)
  }, [initial])

  const basePath = useMemo(
    () => `/api/landing-pages/${encodeURIComponent(projectId)}`,
    [projectId]
  )

  const refresh = useCallback(async () => {
    const res = await fetch(`${basePath}/notification-center`, {
      cache: "no-store",
    })
    if (!res.ok) throw new Error(`Refresh failed (${res.status})`)
    const next = (await res.json()) as NotificationCenterDashboardData
    setData(next)
  }, [basePath])

  async function generateVapid() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`${basePath}/web-push/vapid`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok)
        throw new Error(json.error || "Failed to generate VAPID keys")
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "VAPID generation failed")
    } finally {
      setBusy(false)
    }
  }

  async function generateWebhookSecret() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`${basePath}/web-push/webhook-secret`, {
        method: "POST",
      })
      const json = (await res.json()) as { error?: string; secret?: string }
      if (!res.ok)
        throw new Error(json.error || "Failed to generate webhook secret")
      setFreshWebhookSecret(json.secret ?? null)
      await refresh()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Webhook secret generation failed"
      )
    } finally {
      setBusy(false)
    }
  }

  async function saveCampaign() {
    setBusy(true)
    setError(null)
    try {
      const payload = toPayload(form)
      const res = await fetch(
        editingId
          ? `${basePath}/web-push/campaigns/${editingId}`
          : `${basePath}/web-push/campaigns`,
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        }
      )
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error || "Failed to save campaign")
      setShowForm(false)
      setEditingId(null)
      setForm(EMPTY_FORM)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setBusy(false)
    }
  }

  async function setCampaignStatus(
    campaign: NotificationCenterCampaign,
    status: "draft" | "active" | "paused"
  ) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`${basePath}/web-push/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error || "Failed to update status")
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status update failed")
    } finally {
      setBusy(false)
    }
  }

  async function sendNow(campaignId: string) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(
        `${basePath}/web-push/campaigns/${campaignId}/send-now`,
        { method: "POST" }
      )
      const json = (await res.json()) as { error?: string; created?: number }
      if (!res.ok) throw new Error(json.error || "Send failed")
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send now failed")
    } finally {
      setBusy(false)
    }
  }

  async function uploadMedia(
    kind: "icon" | "badge" | "image",
    file: File
  ): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      const body = new FormData()
      body.set("kind", kind)
      body.set("file", file)
      const res = await fetch(`${basePath}/web-push/media`, {
        method: "POST",
        body,
      })
      const json = (await res.json()) as { error?: string; publicUrl?: string }
      if (!res.ok) throw new Error(json.error || "Upload failed")
      if (!json.publicUrl) throw new Error("Upload returned no URL")
      setForm((f) => ({
        ...f,
        ...(kind === "icon"
          ? { iconUrl: json.publicUrl! }
          : kind === "badge"
            ? { badgeUrl: json.publicUrl! }
            : { imageUrl: json.publicUrl! }),
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setBusy(false)
    }
  }

  function MediaField({
    label,
    kind,
    value,
    onChange,
  }: {
    label: string
    kind: "icon" | "badge" | "image"
    value: string
    onChange: (next: string) => void
  }) {
    return (
      <div className="space-y-1.5">
        <Label>{label}</Label>
        <Input
          value={value}
          placeholder="https://..."
          onChange={(e) => onChange(e.target.value)}
        />
        {data.mediaUploadConfigured ? (
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="block w-full text-xs text-muted-foreground"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void uploadMedia(kind, file)
              e.target.value = ""
            }}
          />
        ) : (
          <p className="text-[10px] text-muted-foreground">
            Paste HTTPS URL (S3 upload not configured)
          </p>
        )}
      </div>
    )
  }

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEdit(campaign: NotificationCenterCampaign) {
    setEditingId(campaign.id)
    setForm(formFromCampaign(campaign))
    setShowForm(true)
  }

  if (isLoading && !data.landingPageId) {
    return (
      <div className="h-64 animate-pulse rounded-xl border border-neutral-200 bg-neutral-100/70" />
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-sm font-semibold text-foreground">
          Notification Center
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Web push campaigns for this landing page. Arohaa stores subscriptions
          and sends directly to browsers.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <StatCard label="Active subs" value={data.stats.activeSubscriptions} />
        <StatCard label="Campaigns on" value={data.stats.campaignsActive} />
        <StatCard label="Paused" value={data.stats.campaignsPaused} />
        <StatCard label="Draft" value={data.stats.campaignsDraft} />
        <StatCard label="Sent" value={data.stats.sentCount} />
        <StatCard label="Clicked" value={data.stats.clickedCount} />
        <StatCard label="Failed" value={data.stats.failedCount} />
        <StatCard label="Queued" value={data.stats.queuedCount} />
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              VAPID keys
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Set the public key on the LP as{" "}
              <code className="rounded bg-neutral-100 px-1 py-0.5 text-[11px]">
                NEXT_PUBLIC_VAPID_PUBLIC_KEY
              </code>
              . Private key stays in Arohaa.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void generateVapid()}
          >
            {data.vapid ? "Rotate keys" : "Generate keys"}
          </Button>
        </div>
        {data.vapid ? (
          <div className="mt-3 space-y-2">
            <Label className="text-xs">Public key</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={data.vapid.publicKey}
                className="font-mono text-xs"
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() =>
                  void navigator.clipboard.writeText(data.vapid!.publicKey)
                }
              >
                Copy
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Subject: {data.vapid.subject}
              {data.vapid.rotatedAt
                ? ` · Rotated ${new Date(data.vapid.rotatedAt).toLocaleString()}`
                : ""}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            No VAPID pair yet. Generate one before sending.
          </p>
        )}
        {data.ingestBaseUrl ? (
          <p className="mt-3 text-[11px] text-muted-foreground">
            LP webhook base:{" "}
            <code className="rounded bg-neutral-100 px-1 py-0.5">
              {data.ingestBaseUrl}/v1/web-push/subscriptions
            </code>
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Webhook HMAC secret
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Once set, LPs must send{" "}
              <code className="rounded bg-neutral-100 px-1 py-0.5 text-[11px]">
                x-arohaa-web-push-signature: sha256=&lt;hmac&gt;
              </code>{" "}
              (or the raw secret header) on subscribe/events.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void generateWebhookSecret()}
          >
            {data.webhook.configured ? "Rotate secret" : "Generate secret"}
          </Button>
        </div>
        {freshWebhookSecret ? (
          <div className="mt-3 space-y-2">
            <Label className="text-xs">Copy now — shown only once</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={freshWebhookSecret}
                className="font-mono text-xs"
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() =>
                  void navigator.clipboard.writeText(freshWebhookSecret)
                }
              >
                Copy
              </Button>
            </div>
          </div>
        ) : data.webhook.configured ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Configured · prefix{" "}
            <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs">
              {data.webhook.secretPrefix}…
            </code>
            {data.webhook.rotatedAt
              ? ` · Rotated ${new Date(data.webhook.rotatedAt).toLocaleString()}`
              : ""}
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            No secret yet. Until one is generated, webhooks are accepted without
            HMAC (dev-friendly).
          </p>
        )}
      </section>

      <LpOpsWiringPanel
        ingestBaseUrl={data.ingestBaseUrl}
        landingPagePublicId={data.landingPagePublicId}
        vapidPublicKey={data.vapid?.publicKey ?? null}
        webhookSecretPlaintext={freshWebhookSecret}
      />

      <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xs">
        <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Campaigns</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Creatives, click URLs, delay-after-event triggers, and Send now
            </p>
          </div>
          <Button type="button" size="sm" disabled={busy} onClick={openCreate}>
            New campaign
          </Button>
        </div>

        {showForm ? (
          <div className="space-y-4 border-b border-neutral-100 bg-neutral-50/60 px-4 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      status: e.target.value as CampaignFormState["status"],
                    }))
                  }
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Title</Label>
                <Input
                  value={form.title}
                  maxLength={64}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Body</Label>
                <textarea
                  value={form.body}
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, body: e.target.value }))
                  }
                />
              </div>
              <MediaField
                label="Icon (HTTPS URL or upload)"
                kind="icon"
                value={form.iconUrl}
                onChange={(iconUrl) => setForm((f) => ({ ...f, iconUrl }))}
              />
              <MediaField
                label="Badge (HTTPS URL or upload)"
                kind="badge"
                value={form.badgeUrl}
                onChange={(badgeUrl) => setForm((f) => ({ ...f, badgeUrl }))}
              />
              <MediaField
                label="Banner image (HTTPS URL or upload)"
                kind="image"
                value={form.imageUrl}
                onChange={(imageUrl) => setForm((f) => ({ ...f, imageUrl }))}
              />
              <div className="space-y-1.5">
                <Label>Tag</Label>
                <Input
                  value={form.tag}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, tag: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Click mode</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.clickMode}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      clickMode: e.target
                        .value as CampaignFormState["clickMode"],
                    }))
                  }
                >
                  <option value="last_url">Last seen URL</option>
                  <option value="fixed">Fixed URL</option>
                  <option value="template">Template</option>
                </select>
              </div>
              {form.clickMode === "fixed" ? (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Fixed URL</Label>
                  <Input
                    value={form.fixedUrl}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, fixedUrl: e.target.value }))
                    }
                  />
                </div>
              ) : null}
              {form.clickMode === "template" ? (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>URL template</Label>
                  <Input
                    value={form.urlTemplate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, urlTemplate: e.target.value }))
                    }
                  />
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={form.maskedRedirect}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      maskedRedirect: e.target.checked,
                    }))
                  }
                />
                Masked click URL ({data.clickBaseUrl || "api"}/r/token)
              </label>
              <div className="space-y-1.5">
                <Label>Resume mode</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.resumeMode}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      resumeMode: e.target.value as "frozen" | "fresh",
                    }))
                  }
                >
                  <option value="frozen">
                    Frozen (URL captured when push was sent)
                  </option>
                  <option value="fresh">
                    Fresh (latest last-seen URL at click)
                  </option>
                </select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Append utm_source</Label>
                <Input
                  value={form.appendUtmSource}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, appendUtmSource: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Append utm_medium</Label>
                <Input
                  value={form.appendUtmMedium}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, appendUtmMedium: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Append utm_campaign</Label>
                <Input
                  value={form.appendUtmCampaign}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      appendUtmCampaign: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Trigger</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.triggerType}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      triggerType: e.target
                        .value as CampaignFormState["triggerType"],
                    }))
                  }
                >
                  <option value="delay_after_event">Delay after event</option>
                  <option value="drip">Drip sequence</option>
                  <option value="immediate">Immediate (manual only)</option>
                </select>
              </div>
              {form.triggerType === "delay_after_event" ||
              form.triggerType === "drip" ? (
                <div className="space-y-1.5">
                  <Label>Event</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.triggerEvent}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        triggerEvent: e.target.value,
                      }))
                    }
                  >
                    {WEB_PUSH_TRIGGER_EVENTS.map((ev) => (
                      <option key={ev} value={ev}>
                        {ev}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              {form.triggerType === "delay_after_event" ? (
                <div className="space-y-1.5">
                  <Label>Delay (minutes)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.delayMinutes}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        delayMinutes: e.target.value,
                      }))
                    }
                  />
                </div>
              ) : null}
            </div>

            {form.triggerType === "drip" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Drip steps (delay from event)</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        dripSteps: [
                          ...f.dripSteps,
                          {
                            delayMinutes: "60",
                            title: "",
                            body: "",
                            tag: `step-${f.dripSteps.length + 1}`,
                          },
                        ],
                      }))
                    }
                  >
                    Add step
                  </Button>
                </div>
                {form.dripSteps.map((step, index) => (
                  <div
                    key={index}
                    className="grid gap-2 rounded-lg border border-neutral-200 bg-white p-3 sm:grid-cols-4"
                  >
                    <div className="space-y-1">
                      <Label className="text-[11px]">Delay (min)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={step.delayMinutes}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            dripSteps: f.dripSteps.map((s, i) =>
                              i === index
                                ? { ...s, delayMinutes: e.target.value }
                                : s
                            ),
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Title override</Label>
                      <Input
                        value={step.title}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            dripSteps: f.dripSteps.map((s, i) =>
                              i === index ? { ...s, title: e.target.value } : s
                            ),
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Tag</Label>
                      <Input
                        value={step.tag}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            dripSteps: f.dripSteps.map((s, i) =>
                              i === index ? { ...s, tag: e.target.value } : s
                            ),
                          }))
                        }
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="min-w-0 flex-1 space-y-1">
                        <Label className="text-[11px]">Body override</Label>
                        <Input
                          value={step.body}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              dripSteps: f.dripSteps.map((s, i) =>
                                i === index ? { ...s, body: e.target.value } : s
                              ),
                            }))
                          }
                        />
                      </div>
                      {form.dripSteps.length > 1 ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              dripSteps: f.dripSteps.filter(
                                (_, i) => i !== index
                              ),
                            }))
                          }
                        >
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Max pushes / user / 24h</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="Unlimited"
                  value={form.maxPerUserPerDay}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      maxPerUserPerDay: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={form.quietEnabled}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        quietEnabled: e.target.checked,
                      }))
                    }
                  />
                  Quiet hours
                </label>
              </div>
              {form.quietEnabled ? (
                <>
                  <div className="space-y-1.5">
                    <Label>Quiet start (HH:mm)</Label>
                    <Input
                      value={form.quietStart}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          quietStart: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Quiet end (HH:mm)</Label>
                    <Input
                      value={form.quietEnd}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          quietEnd: e.target.value,
                        }))
                      }
                    />
                  </div>
                </>
              ) : null}
            </div>
            {form.quietEnabled ? (
              <div className="space-y-1.5 sm:max-w-xs">
                <Label>Quiet hours timezone</Label>
                <Input
                  value={form.quietTz}
                  placeholder="user or America/New_York"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, quietTz: e.target.value }))
                  }
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Cancel on</Label>
              <div className="flex flex-wrap gap-2">
                {WEB_PUSH_TRIGGER_EVENTS.map((ev) => {
                  const checked = form.cancelOn.includes(ev)
                  return (
                    <button
                      key={ev}
                      type="button"
                      className={cn(
                        "rounded-md border px-2 py-1 text-[11px]",
                        checked
                          ? "border-neutral-900 bg-neutral-900 text-white"
                          : "border-neutral-200 bg-white text-neutral-600"
                      )}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          cancelOn: checked
                            ? f.cancelOn.filter((x) => x !== ev)
                            : [...f.cancelOn, ev],
                        }))
                      }
                    >
                      {ev}
                    </button>
                  )
                })}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={form.requireInteraction}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    requireInteraction: e.target.checked,
                  }))
                }
              />
              Require interaction (desktop)
            </label>

            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => void saveCampaign()}
              >
                {editingId ? "Save changes" : "Create campaign"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setShowForm(false)
                  setEditingId(null)
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {data.campaigns.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No campaigns yet.
          </p>
        ) : (
          <div className="divide-y divide-neutral-100">
            {data.campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {campaign.name}
                    </p>
                    <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-neutral-600 uppercase">
                      {campaign.status}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {campaign.title}
                    {campaign.trigger.type === "drip"
                      ? ` · drip ${campaign.trigger.steps?.length ?? 0} steps on ${campaign.trigger.event}`
                      : campaign.trigger.type === "delay_after_event"
                        ? ` · ${campaign.trigger.event} + ${Math.round((campaign.trigger.delayMs ?? 0) / 60000)}m`
                        : " · manual"}
                    {campaign.limits?.maxPerUserPerDay
                      ? ` · cap ${campaign.limits.maxPerUserPerDay}/day`
                      : ""}
                    {campaign.limits?.quietHours
                      ? ` · quiet ${campaign.limits.quietHours.start}–${campaign.limits.quietHours.end}`
                      : ""}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                    Sent {campaign.sentCount} · Clicked {campaign.clickedCount}{" "}
                    · Failed {campaign.failedCount} · Queued{" "}
                    {campaign.queuedCount}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => openEdit(campaign)}
                  >
                    Edit
                  </Button>
                  {campaign.status !== "active" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void setCampaignStatus(campaign, "active")}
                    >
                      Activate
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void setCampaignStatus(campaign, "paused")}
                    >
                      Pause
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() => void sendNow(campaign.id)}
                  >
                    Send now
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xs">
          <div className="border-b border-neutral-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">
              Subscriptions
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Recent push endpoints for this landing page
            </p>
          </div>
          {data.subscriptions.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No subscriptions yet.
            </p>
          ) : (
            <div className="divide-y divide-neutral-100">
              {data.subscriptions.map((sub) => (
                <div key={sub.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-xs text-foreground">
                      {sub.endpointHash}
                    </p>
                    <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                      {sub.status}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">
                    {sub.lastSeenUrl || sub.origin || "—"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xs">
          <div className="border-b border-neutral-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">
              Recent deliveries
            </h3>
          </div>
          {data.recentDeliveries.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No deliveries yet.
            </p>
          ) : (
            <div className="divide-y divide-neutral-100">
              {data.recentDeliveries.map((d) => (
                <div key={d.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-medium text-foreground">
                      {d.campaignName}
                    </p>
                    <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                      {d.status}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {d.clickedAt
                      ? `Clicked ${new Date(d.clickedAt).toLocaleString()}`
                      : d.sentAt
                        ? `Sent ${new Date(d.sentAt).toLocaleString()}`
                        : `Scheduled ${new Date(d.scheduledFor).toLocaleString()}`}
                    {d.failureReason ? ` · ${d.failureReason}` : ""}
                  </p>
                  {d.targetUrl ? (
                    <p className="mt-0.5 truncate text-[10px] text-neutral-400">
                      → {d.targetUrl}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function LpOpsWiringPanel(props: {
  ingestBaseUrl: string | null
  landingPagePublicId: string
  vapidPublicKey: string | null
  webhookSecretPlaintext: string | null
}) {
  const snippet = buildLpWebPushOpsSnippet(props)
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            LP wiring (ops)
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Paste into the landing page env, add{" "}
            <code className="rounded bg-neutral-100 px-1 py-0.5 text-[11px]">
              {snippet.sdkAttr}
            </code>{" "}
            on the Arohaa SDK tag, and forward{" "}
            <code className="rounded bg-neutral-100 px-1 py-0.5 text-[11px]">
              /api/push/*
            </code>{" "}
            with{" "}
            <code className="rounded bg-neutral-100 px-1 py-0.5 text-[11px]">
              @workspace/lp-core
            </code>
            .
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => void navigator.clipboard.writeText(snippet.envFile)}
        >
          Copy env
        </Button>
      </div>
      <pre className="mt-3 max-h-48 overflow-auto rounded-lg border border-neutral-100 bg-neutral-50 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-foreground">
        {snippet.envFile}
      </pre>
      <ol className="mt-3 list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
        {snippet.checklist.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    </section>
  )
}
