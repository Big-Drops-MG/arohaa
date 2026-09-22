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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { cn } from "@workspace/ui/lib/utils"
import type {
  NotificationCenterCampaign,
  NotificationCenterDashboardData,
} from "@/features/notification-center/model/notification-center"
import {
  CampaignFormDialog,
  type CampaignFormState,
} from "@/features/notification-center/view/CampaignFormDialog"
import {
  NotificationCenterKeysTab,
  type KeysPendingAction,
} from "@/features/notification-center/view/NotificationCenterKeysTab"
import { NotificationCenterStatsTab } from "@/features/notification-center/view/NotificationCenterStatsTab"
import { NotificationCenterDashboardSkeleton } from "@/features/dashboard/view/dashboard-skeletons"
import { OverviewHeader } from "@/features/overview/view/OverviewHeader"
import {
  overviewSelectContentClassName,
  overviewSelectItemClassName,
  overviewSelectTriggerClassName,
} from "@/features/overview/view/overview-select-styles"
import { useDashboardDateRange } from "@/hooks/use-dashboard-date-range"
import { TRAFFIC_DATE_RANGE_OPTIONS } from "@/features/traffic/model/traffic-range"

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
  const [keysPending, setKeysPending] = useState<KeysPendingAction>(null)
  const { dateRangeId, customRange, setDateRangeId, setCustomRange } =
    useDashboardDateRange()
  const [statsCampaignId, setStatsCampaignId] = useState("all")

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

  async function generateVapid(): Promise<boolean> {
    setBusy(true)
    setKeysPending("vapid")
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
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "VAPID generation failed")
      return false
    } finally {
      setKeysPending(null)
      setBusy(false)
    }
  }

  async function generateWebhookSecret(): Promise<boolean> {
    setBusy(true)
    setKeysPending("webhook")
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
      return true
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Webhook secret generation failed"
      )
      return false
    } finally {
      setKeysPending(null)
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
      <div className="flex flex-col gap-4 pb-6">
        <OverviewHeader
          title="Notification Center"
          subtitle="Web push campaigns for this landing page. Arohaa stores subscriptions and sends directly to browsers."
        />
        <NotificationCenterDashboardSkeleton />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 pb-6">
      <OverviewHeader
        title="Notification Center"
        subtitle="Web push campaigns for this landing page. Arohaa stores subscriptions and sends directly to browsers."
        dateRangeOptions={
          innerTab === "stats" ? TRAFFIC_DATE_RANGE_OPTIONS : undefined
        }
        dateRangeId={innerTab === "stats" ? dateRangeId : undefined}
        customRange={innerTab === "stats" ? customRange : undefined}
        onDateRangeChange={innerTab === "stats" ? setDateRangeId : undefined}
        onCustomRangeChange={innerTab === "stats" ? setCustomRange : undefined}
        actions={
          innerTab === "stats" ? (
            <Select value={statsCampaignId} onValueChange={setStatsCampaignId}>
              <SelectTrigger
                className={cn(
                  overviewSelectTriggerClassName,
                  "h-9 w-45 rounded-lg"
                )}
              >
                <SelectValue placeholder="All campaigns" />
              </SelectTrigger>
              <SelectContent className={overviewSelectContentClassName}>
                <SelectItem value="all" className={overviewSelectItemClassName}>
                  All campaigns
                </SelectItem>
                {data.campaigns.map((c) => (
                  <SelectItem
                    key={c.id}
                    value={c.id}
                    className={overviewSelectItemClassName}
                  >
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : undefined
        }
      />

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

        <TabsContent value="stats" className="mt-0">
          <NotificationCenterStatsTab
            projectId={projectId}
            shell={data}
            dateRangeId={dateRangeId}
            customRange={customRange ?? null}
            campaignId={statsCampaignId}
            busy={busy}
            canFlush={canFlush}
            onFlushRequest={() => setFlushConfirmOpen(true)}
          />
        </TabsContent>

        <TabsContent value="campaigns" className="mt-0 flex flex-col gap-5">
          <section className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-xs">
            <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Campaigns
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Create, schedule, and send web push campaigns
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

        <TabsContent value="keys" className="mt-0">
          <NotificationCenterKeysTab
            data={data}
            freshWebhookSecret={freshWebhookSecret}
            pendingAction={keysPending}
            onGenerateVapid={generateVapid}
            onGenerateWebhookSecret={generateWebhookSecret}
          />
        </TabsContent>
      </Tabs>

      <CampaignFormDialog
        open={showForm}
        onOpenChange={(open) => {
          if (busy) return
          setShowForm(open)
          if (!open) setEditingId(null)
        }}
        form={form}
        setForm={setForm}
        editingId={editingId}
        busy={busy}
        mediaUploadConfigured={data.mediaUploadConfigured}
        clickBaseUrl={data.clickBaseUrl}
        onUploadMedia={uploadMedia}
        onSave={() => void saveCampaign()}
      />

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
