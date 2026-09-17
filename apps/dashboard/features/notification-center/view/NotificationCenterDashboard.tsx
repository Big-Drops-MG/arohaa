"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { Pause, Pencil, Play, Plus, Send, Trash2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { cn } from "@workspace/ui/lib/utils"
import type {
  NotificationCenterCampaign,
  NotificationCenterDashboardData,
} from "@/features/notification-center/model/notification-center"
import { WEB_PUSH_TRIGGER_EVENTS } from "@/features/notification-center/model/notification-center"
import { buildLpWebPushOpsSnippet } from "@/features/notification-center/model/lp-ops-snippet"
import { TrafficExpandableCard } from "@/features/traffic/view/TrafficExpandableCard"
import {
  overviewSelectContentClassName,
  overviewSelectItemClassName,
  overviewSelectTriggerClassName,
} from "@/features/overview/view/overview-select-styles"

type NotificationCenterDashboardProps = {
  data: NotificationCenterDashboardData
  projectId: string
  isLoading?: boolean
}

type NcInnerTab = "stats" | "campaigns" | "keys"

const NC_INNER_TABS: { value: NcInnerTab; label: string }[] = [
  { value: "stats", label: "Stats" },
  { value: "campaigns", label: "Campaigns" },
  { value: "keys", label: "Keys" },
]

const ncInnerTabTriggerClassName =
  "relative -mb-px shrink-0 rounded-none border-0 border-b-2 border-transparent bg-transparent px-0 py-2.5 text-sm font-normal text-neutral-600 shadow-none hover:text-neutral-900 data-[state=active]:border-neutral-950 data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-neutral-950 data-[state=active]:shadow-none"

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
    <div className="rounded-xl border border-neutral-200/80 bg-white px-3.5 py-3 shadow-xs">
      <p className="text-[11px] font-medium tracking-wide text-neutral-500 uppercase">
        {label}
      </p>
      <p className="mt-1.5 font-heading text-xl font-semibold tracking-tight text-foreground tabular-nums">
        {value}
      </p>
    </div>
  )
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "active":
    case "sent":
    case "clicked":
      return "bg-emerald-50 text-emerald-700"
    case "failed":
    case "cancelled":
      return "bg-red-50 text-red-700"
    case "queued":
    case "sending":
      return "bg-amber-50 text-amber-800"
    case "paused":
    case "inactive":
    case "draft":
      return "bg-neutral-100 text-neutral-600"
    default:
      return "bg-neutral-100 text-neutral-600"
  }
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase",
        statusBadgeClass(status)
      )}
    >
      {status}
    </span>
  )
}

function MetaChip({
  children,
  tone = "neutral",
}: {
  children: ReactNode
  tone?: "neutral" | "blue" | "violet" | "amber"
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium",
        tone === "neutral" && "bg-neutral-100 text-neutral-700",
        tone === "blue" && "bg-sky-50 text-sky-800",
        tone === "violet" && "bg-violet-50 text-violet-800",
        tone === "amber" && "bg-amber-50 text-amber-800"
      )}
    >
      {children}
    </span>
  )
}

function MetricChip({
  label,
  value,
  tone = "neutral",
}: {
  label: string
  value: number
  tone?: "neutral" | "emerald" | "sky" | "red" | "amber"
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[10px] leading-none font-medium tabular-nums",
        tone === "neutral" && "bg-neutral-100 text-neutral-700",
        tone === "emerald" && "bg-emerald-50 text-emerald-700",
        tone === "sky" && "bg-sky-50 text-sky-800",
        tone === "red" && "bg-red-50 text-red-700",
        tone === "amber" && "bg-amber-50 text-amber-800"
      )}
    >
      <span className="leading-none tracking-wide uppercase opacity-70">
        {label}
      </span>
      <span className="leading-none">{value}</span>
    </span>
  )
}

function campaignTriggerChips(campaign: NotificationCenterCampaign): ReactNode {
  const chips: ReactNode[] = []
  if (campaign.trigger.type === "drip") {
    chips.push(
      <MetaChip key="type" tone="violet">
        Drip · {campaign.trigger.steps?.length ?? 0} steps
      </MetaChip>
    )
    if (campaign.trigger.event) {
      chips.push(
        <MetaChip key="event" tone="blue">
          {campaign.trigger.event}
        </MetaChip>
      )
    }
  } else if (campaign.trigger.type === "delay_after_event") {
    chips.push(
      <MetaChip key="type" tone="blue">
        Delay · {Math.round((campaign.trigger.delayMs ?? 0) / 60_000)}m
      </MetaChip>
    )
    if (campaign.trigger.event) {
      chips.push(
        <MetaChip key="event" tone="violet">
          {campaign.trigger.event}
        </MetaChip>
      )
    }
  } else {
    chips.push(
      <MetaChip key="type" tone="neutral">
        Manual
      </MetaChip>
    )
  }

  if (campaign.click.mode === "last_url") {
    chips.push(
      <MetaChip key="click" tone="neutral">
        Last URL
      </MetaChip>
    )
  } else if (campaign.click.mode === "fixed") {
    chips.push(
      <MetaChip key="click" tone="neutral">
        Fixed URL
      </MetaChip>
    )
  } else {
    chips.push(
      <MetaChip key="click" tone="neutral">
        Template
      </MetaChip>
    )
  }

  if (campaign.limits?.maxPerUserPerDay) {
    chips.push(
      <MetaChip key="cap" tone="amber">
        Cap {campaign.limits.maxPerUserPerDay}/day
      </MetaChip>
    )
  }
  if (campaign.limits?.quietHours) {
    chips.push(
      <MetaChip key="quiet" tone="amber">
        Quiet {campaign.limits.quietHours.start}–
        {campaign.limits.quietHours.end}
      </MetaChip>
    )
  }
  if (campaign.tag) {
    chips.push(
      <MetaChip key="tag" tone="neutral">
        #{campaign.tag}
      </MetaChip>
    )
  }

  return <div className="flex flex-wrap gap-1.5">{chips}</div>
}

const campaignTableThClassName =
  "px-4 py-2.5 text-left text-[11px] font-semibold tracking-wide whitespace-nowrap text-neutral-500 uppercase"

const campaignTableTdClassName = "px-4 py-3 align-middle"

function SubscriptionsList({
  items,
  compact = false,
}: {
  items: NotificationCenterDashboardData["subscriptions"]
  compact?: boolean
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <p className="text-sm text-muted-foreground">No subscriptions yet.</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-neutral-100">
      {items.map((sub) => (
        <div key={sub.id} className={cn("px-4", compact ? "py-2.5" : "py-3.5")}>
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 font-mono text-xs text-foreground">
              {sub.endpointHash}
            </p>
            <StatusBadge status={sub.status} />
          </div>
          <p className="mt-1 truncate text-[11px] text-neutral-500">
            {sub.lastSeenUrl || sub.origin || "—"}
          </p>
          {sub.lastEventAt || sub.createdAt ? (
            <p className="mt-1 text-[10px] text-neutral-400 tabular-nums">
              {sub.lastEventAt
                ? `Last event ${new Date(sub.lastEventAt).toLocaleString()}`
                : `Created ${new Date(sub.createdAt).toLocaleString()}`}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  )
}

function DeliveriesList({
  items,
  compact = false,
}: {
  items: NotificationCenterDashboardData["recentDeliveries"]
  compact?: boolean
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <p className="text-sm text-muted-foreground">No deliveries yet.</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-neutral-100">
      {items.map((d) => (
        <div key={d.id} className={cn("px-4", compact ? "py-2.5" : "py-3.5")}>
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 truncate text-xs font-medium text-foreground">
              {d.campaignName}
            </p>
            <StatusBadge status={d.status} />
          </div>
          <p className="mt-1 text-[11px] text-neutral-500">
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
  )
}

function StatsPanelCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="flex h-full min-h-88 flex-col overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-xs">
      <div className="shrink-0 border-b border-neutral-100 px-4 py-3 pr-12">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {children}
      </div>
    </section>
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
  const [innerTab, setInnerTab] = useState<NcInnerTab>("stats")
  const [flushConfirmOpen, setFlushConfirmOpen] = useState(false)
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

  async function flushStats() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`${basePath}/web-push/flush`, {
        method: "POST",
      })
      const json = (await res.json()) as {
        error?: string
        deletedSubscriptions?: number
        deletedDeliveries?: number
      }
      if (!res.ok) throw new Error(json.error || "Flush failed")
      setFlushConfirmOpen(false)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Flush failed")
    } finally {
      setBusy(false)
    }
  }

  const canFlush =
    data.stats.activeSubscriptions > 0 ||
    data.stats.inactiveSubscriptions > 0 ||
    data.stats.sentCount > 0 ||
    data.stats.failedCount > 0 ||
    data.stats.queuedCount > 0 ||
    data.stats.clickedCount > 0 ||
    data.subscriptions.length > 0 ||
    data.recentDeliveries.length > 0

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
    setInnerTab("campaigns")
  }

  function openEdit(campaign: NotificationCenterCampaign) {
    setEditingId(campaign.id)
    setForm(formFromCampaign(campaign))
    setShowForm(true)
    setInnerTab("campaigns")
  }

  if (isLoading && !data.landingPageId) {
    return (
      <div className="h-64 animate-pulse rounded-xl border border-neutral-200 bg-neutral-100/70" />
    )
  }

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Notification Center
        </h1>
        <p className="text-sm text-muted-foreground">
          Web push campaigns for this landing page. Arohaa stores subscriptions
          and sends directly to browsers.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <Tabs
        value={innerTab}
        onValueChange={(value) => {
          if (value === "stats" || value === "campaigns" || value === "keys") {
            setInnerTab(value)
          }
        }}
        className="flex flex-col gap-4"
      >
        <div className="border-b border-neutral-200 bg-transparent">
          <TabsList className="h-auto min-h-10 w-full flex-wrap justify-start gap-x-5 gap-y-1 rounded-none border-0 bg-transparent p-0">
            {NC_INNER_TABS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className={ncInnerTabTriggerClassName}
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="stats" className="mt-0 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
            <StatCard
              label="Active subs"
              value={data.stats.activeSubscriptions}
            />
            <StatCard label="Campaigns on" value={data.stats.campaignsActive} />
            <StatCard label="Paused" value={data.stats.campaignsPaused} />
            <StatCard label="Draft" value={data.stats.campaignsDraft} />
            <StatCard label="Sent" value={data.stats.sentCount} />
            <StatCard label="Clicked" value={data.stats.clickedCount} />
            <StatCard label="Failed" value={data.stats.failedCount} />
            <StatCard label="Queued" value={data.stats.queuedCount} />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Subscriptions and delivery history for this landing page.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || !canFlush}
              className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
              onClick={() => setFlushConfirmOpen(true)}
            >
              Flush subscriptions & deliveries
            </Button>
          </div>

          <div className="grid items-stretch gap-4 xl:grid-cols-2">
            <TrafficExpandableCard
              title="Subscriptions"
              className="h-full"
              dialogClassName="max-w-2xl"
              expandedContent={<SubscriptionsList items={data.subscriptions} />}
            >
              <StatsPanelCard
                title="Subscriptions"
                description="Recent push endpoints for this landing page"
              >
                <SubscriptionsList items={data.subscriptions} compact />
              </StatsPanelCard>
            </TrafficExpandableCard>

            <TrafficExpandableCard
              title="Recent deliveries"
              className="h-full"
              dialogClassName="max-w-2xl"
              expandedContent={<DeliveriesList items={data.recentDeliveries} />}
            >
              <StatsPanelCard
                title="Recent deliveries"
                description="Latest sends, clicks, and failures"
              >
                <DeliveriesList items={data.recentDeliveries} compact />
              </StatsPanelCard>
            </TrafficExpandableCard>
          </div>
        </TabsContent>

        <TabsContent value="campaigns" className="mt-0 flex flex-col gap-5">
          <section className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-xs">
            <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Campaigns
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Creatives, click URLs, delay-after-event triggers, and Send
                  now
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={busy}
                className="gap-1.5"
                onClick={openCreate}
              >
                <Plus className="size-3.5" aria-hidden />
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
                    <Select
                      value={form.status}
                      onValueChange={(value) =>
                        setForm((f) => ({
                          ...f,
                          status: value as CampaignFormState["status"],
                        }))
                      }
                    >
                      <SelectTrigger
                        className={cn(overviewSelectTriggerClassName, "w-full")}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={overviewSelectContentClassName}>
                        <SelectItem
                          value="draft"
                          className={overviewSelectItemClassName}
                        >
                          Draft
                        </SelectItem>
                        <SelectItem
                          value="active"
                          className={overviewSelectItemClassName}
                        >
                          Active
                        </SelectItem>
                        <SelectItem
                          value="paused"
                          className={overviewSelectItemClassName}
                        >
                          Paused
                        </SelectItem>
                      </SelectContent>
                    </Select>
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
                    onChange={(badgeUrl) =>
                      setForm((f) => ({ ...f, badgeUrl }))
                    }
                  />
                  <MediaField
                    label="Banner image (HTTPS URL or upload)"
                    kind="image"
                    value={form.imageUrl}
                    onChange={(imageUrl) =>
                      setForm((f) => ({ ...f, imageUrl }))
                    }
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
                    <Select
                      value={form.clickMode}
                      onValueChange={(value) =>
                        setForm((f) => ({
                          ...f,
                          clickMode: value as CampaignFormState["clickMode"],
                        }))
                      }
                    >
                      <SelectTrigger
                        className={cn(overviewSelectTriggerClassName, "w-full")}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={overviewSelectContentClassName}>
                        <SelectItem
                          value="last_url"
                          className={overviewSelectItemClassName}
                        >
                          Last seen URL
                        </SelectItem>
                        <SelectItem
                          value="fixed"
                          className={overviewSelectItemClassName}
                        >
                          Fixed URL
                        </SelectItem>
                        <SelectItem
                          value="template"
                          className={overviewSelectItemClassName}
                        >
                          Template
                        </SelectItem>
                      </SelectContent>
                    </Select>
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
                          setForm((f) => ({
                            ...f,
                            urlTemplate: e.target.value,
                          }))
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
                    <Select
                      value={form.resumeMode}
                      onValueChange={(value) =>
                        setForm((f) => ({
                          ...f,
                          resumeMode: value as "frozen" | "fresh",
                        }))
                      }
                    >
                      <SelectTrigger
                        className={cn(overviewSelectTriggerClassName, "w-full")}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={overviewSelectContentClassName}>
                        <SelectItem
                          value="frozen"
                          className={overviewSelectItemClassName}
                        >
                          Frozen (URL at send time)
                        </SelectItem>
                        <SelectItem
                          value="fresh"
                          className={overviewSelectItemClassName}
                        >
                          Fresh (latest last-seen URL)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Append utm_source</Label>
                    <Input
                      value={form.appendUtmSource}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          appendUtmSource: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Append utm_medium</Label>
                    <Input
                      value={form.appendUtmMedium}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          appendUtmMedium: e.target.value,
                        }))
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
                    <Select
                      value={form.triggerType}
                      onValueChange={(value) =>
                        setForm((f) => ({
                          ...f,
                          triggerType:
                            value as CampaignFormState["triggerType"],
                        }))
                      }
                    >
                      <SelectTrigger
                        className={cn(overviewSelectTriggerClassName, "w-full")}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={overviewSelectContentClassName}>
                        <SelectItem
                          value="delay_after_event"
                          className={overviewSelectItemClassName}
                        >
                          Delay after event
                        </SelectItem>
                        <SelectItem
                          value="drip"
                          className={overviewSelectItemClassName}
                        >
                          Drip sequence
                        </SelectItem>
                        <SelectItem
                          value="immediate"
                          className={overviewSelectItemClassName}
                        >
                          Immediate (manual only)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.triggerType === "delay_after_event" ||
                  form.triggerType === "drip" ? (
                    <div className="space-y-1.5">
                      <Label>Event</Label>
                      <Select
                        value={form.triggerEvent}
                        onValueChange={(value) =>
                          setForm((f) => ({
                            ...f,
                            triggerEvent: value,
                          }))
                        }
                      >
                        <SelectTrigger
                          className={cn(
                            overviewSelectTriggerClassName,
                            "w-full"
                          )}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent
                          className={overviewSelectContentClassName}
                        >
                          {WEB_PUSH_TRIGGER_EVENTS.map((ev) => (
                            <SelectItem
                              key={ev}
                              value={ev}
                              className={overviewSelectItemClassName}
                            >
                              {ev}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                                  i === index
                                    ? { ...s, title: e.target.value }
                                    : s
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
                                  i === index
                                    ? { ...s, tag: e.target.value }
                                    : s
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
                                    i === index
                                      ? { ...s, body: e.target.value }
                                      : s
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
                  <div className="flex flex-wrap gap-1.5">
                    {WEB_PUSH_TRIGGER_EVENTS.map((ev) => {
                      const checked = form.cancelOn.includes(ev)
                      return (
                        <button
                          key={ev}
                          type="button"
                          className={cn(
                            "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                            checked
                              ? "border-neutral-900 bg-neutral-900 text-white"
                              : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50"
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
              <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  No campaigns yet. Create one to start sending web push.
                </p>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  className="gap-1.5"
                  onClick={openCreate}
                >
                  <Plus className="size-3.5" aria-hidden />
                  New campaign
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-190 border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50/80">
                      <th className={campaignTableThClassName}>Campaign</th>
                      <th className={campaignTableThClassName}>Trigger</th>
                      <th className={campaignTableThClassName}>Metrics</th>
                      <th
                        className={cn(campaignTableThClassName, "text-right")}
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.campaigns.map((campaign) => (
                      <tr
                        key={campaign.id}
                        className="border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50/60"
                      >
                        <td
                          className={cn(campaignTableTdClassName, "max-w-64")}
                        >
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {campaign.title || campaign.name}
                            </p>
                            <StatusBadge status={campaign.status} />
                          </div>
                        </td>
                        <td className={campaignTableTdClassName}>
                          {campaignTriggerChips(campaign)}
                        </td>
                        <td className={campaignTableTdClassName}>
                          <div className="flex flex-wrap gap-1.5">
                            <MetricChip
                              label="Sent"
                              value={campaign.sentCount}
                              tone="emerald"
                            />
                            <MetricChip
                              label="Click"
                              value={campaign.clickedCount}
                              tone="sky"
                            />
                            <MetricChip
                              label="Fail"
                              value={campaign.failedCount}
                              tone="red"
                            />
                            <MetricChip
                              label="Queue"
                              value={campaign.queuedCount}
                              tone="amber"
                            />
                          </div>
                        </td>
                        <td
                          className={cn(campaignTableTdClassName, "text-right")}
                        >
                          <div className="inline-flex flex-wrap justify-end gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              className="h-8 gap-1.5 px-2.5"
                              onClick={() => openEdit(campaign)}
                            >
                              <Pencil className="size-3.5" aria-hidden />
                              Edit
                            </Button>
                            {campaign.status !== "active" ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={busy}
                                className="h-8 gap-1.5 px-2.5"
                                onClick={() =>
                                  void setCampaignStatus(campaign, "active")
                                }
                              >
                                <Play className="size-3.5" aria-hidden />
                                Activate
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={busy}
                                className="h-8 gap-1.5 px-2.5"
                                onClick={() =>
                                  void setCampaignStatus(campaign, "paused")
                                }
                              >
                                <Pause className="size-3.5" aria-hidden />
                                Pause
                              </Button>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              disabled={busy || campaign.status === "draft"}
                              className="h-8 gap-1.5 px-2.5"
                              onClick={() => void sendNow(campaign.id)}
                            >
                              <Send className="size-3.5" aria-hidden />
                              Send
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </TabsContent>

        <TabsContent value="keys" className="mt-0 flex flex-col gap-5">
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
                No secret yet. Until one is generated, webhooks are accepted
                without HMAC (dev-friendly).
              </p>
            )}
          </section>

          <LpOpsWiringPanel
            ingestBaseUrl={data.ingestBaseUrl}
            landingPagePublicId={data.landingPagePublicId}
            vapidPublicKey={data.vapid?.publicKey ?? null}
            webhookSecretPlaintext={freshWebhookSecret}
          />
        </TabsContent>
      </Tabs>

      <Dialog
        open={flushConfirmOpen}
        onOpenChange={(open) => {
          if (busy) return
          setFlushConfirmOpen(open)
        }}
      >
        <DialogContent className="max-w-md gap-4" showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-foreground">
              Flush subscriptions & deliveries?
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
              This permanently deletes all push endpoints and delivery history
              for this landing page. Campaigns and VAPID keys are kept. Visitors
              must opt in again to receive notifications.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3.5 py-3 text-xs text-neutral-600">
            <p>
              Active subscriptions:{" "}
              <span className="font-medium text-foreground tabular-nums">
                {data.stats.activeSubscriptions}
              </span>
            </p>
            <p className="mt-1">
              Deliveries (sent / clicked / failed / queued):{" "}
              <span className="font-medium text-foreground tabular-nums">
                {data.stats.sentCount +
                  data.stats.clickedCount +
                  data.stats.failedCount +
                  data.stats.queuedCount}
              </span>
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-lg border-neutral-200 bg-white shadow-xs"
              disabled={busy}
              onClick={() => setFlushConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-9 rounded-lg"
              disabled={busy}
              onClick={() => void flushStats()}
            >
              <Trash2 className="size-3.5" aria-hidden />
              {busy ? "Flushing…" : "Flush all"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
