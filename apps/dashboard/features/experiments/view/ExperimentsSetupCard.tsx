"use client"

import Link from "next/link"
import { useEffect, useState, useTransition } from "react"
import { FlaskConical, Trash2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { cn } from "@workspace/ui/lib/utils"
import { newVariantPath } from "@/features/dashboard/model/new-landing-mode"
import { experimentVariantDisplayLabel } from "@/features/experiments/utils/experiment-table-columns"
import {
  overviewSelectContentClassName,
  overviewSelectItemClassName,
  overviewSelectTriggerClassName,
} from "@/features/overview/view/overview-select-styles"
import type { ExperimentConfigView } from "@/lib/server/experiments-store"

const CONTROL_NONE = "__none__"

type ExperimentsSetupCardProps = {
  projectId: string
  config: ExperimentConfigView | null
  onChanged: () => void
}

type VariantLabelPlan = {
  parentLabel: string
  availableLabels: string[]
  suggestedLabel: string
}

function healthLabel(health: "ok" | "waiting" | "stale"): string {
  if (health === "ok") return "Receiving events"
  if (health === "stale") return "Stale (no recent events)"
  return "Waiting for events"
}

export function ExperimentsSetupCard({
  projectId,
  config,
  onChanged,
}: ExperimentsSetupCardProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState(config?.name ?? "Multi-domain test")
  const [status, setStatus] = useState(config?.status ?? "Running")
  const [startDate, setStartDate] = useState(
    config?.startDate ?? new Date().toISOString().slice(0, 10)
  )
  const [noEndDate, setNoEndDate] = useState(config?.noEndDate ?? true)
  const [endDate, setEndDate] = useState(config?.endDate ?? "")
  const [controlLandingPageId, setControlLandingPageId] = useState(
    config?.controlLandingPageId ?? ""
  )
  const [labelPlan, setLabelPlan] = useState<VariantLabelPlan | null>(null)

  const configSignature = config
    ? [
        config.id,
        config.name,
        config.status,
        config.startDate,
        config.endDate ?? "",
        config.controlLandingPageId ?? "",
        config.variants.map((v) => `${v.label}@${v.landingPageId}`).join(","),
      ].join("|")
    : "none"

  // Resyncs only when the persisted experiment actually changes, so the
  // 60s background refetch never overwrites what is being typed.
  const [syncedSignature, setSyncedSignature] = useState(configSignature)
  if (config && configSignature !== syncedSignature) {
    setSyncedSignature(configSignature)
    setName(config.name)
    setStatus(config.status)
    setStartDate(config.startDate)
    setNoEndDate(config.noEndDate)
    setEndDate(config.endDate ?? "")
    setControlLandingPageId(config.controlLandingPageId ?? "")
  }

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const res = await fetch(
        `/api/landing-pages/${encodeURIComponent(projectId)}/experiments/variant-labels`,
        { cache: "no-store" }
      )
      if (!res.ok) return
      const data = (await res
        .json()
        .catch(() => null)) as VariantLabelPlan | null
      if (!data || cancelled) return
      setLabelPlan(data)
    })()

    return () => {
      cancelled = true
    }
  }, [projectId, configSignature])

  async function createExperiment() {
    setError(null)
    startTransition(async () => {
      const res = await fetch(
        `/api/landing-pages/${encodeURIComponent(projectId)}/experiments/config`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            status,
            startDate,
            noEndDate,
            endDate: noEndDate ? null : endDate || null,
          }),
        }
      )
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        setError(body?.error ?? `Failed (${res.status})`)
        return
      }
      onChanged()
    })
  }

  async function patchExperiment(body: Record<string, unknown>) {
    if (!config) return
    setError(null)
    startTransition(async () => {
      const res = await fetch(
        `/api/landing-pages/${encodeURIComponent(projectId)}/experiments/config/${encodeURIComponent(config.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      )
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        setError(payload?.error ?? `Failed (${res.status})`)
        return
      }
      onChanged()
    })
  }

  async function saveMeta() {
    await patchExperiment({
      name,
      status,
      startDate,
      noEndDate,
      endDate: noEndDate ? null : endDate || null,
      controlLandingPageId: controlLandingPageId || null,
    })
  }

  async function removeVariant(landingPageIdToRemove: string) {
    if (!config) return
    const variants = config.variants
      .filter((v) => v.landingPageId !== landingPageIdToRemove)
      .map((v) => ({ label: v.label, landingPageId: v.landingPageId }))
    await patchExperiment({
      variants,
      controlLandingPageId:
        config.controlLandingPageId === landingPageIdToRemove
          ? (variants[0]?.landingPageId ?? null)
          : config.controlLandingPageId,
    })
  }

  async function deleteExperiment() {
    if (!config) return
    if (!window.confirm("Delete this experiment configuration?")) return
    setError(null)
    startTransition(async () => {
      const res = await fetch(
        `/api/landing-pages/${encodeURIComponent(projectId)}/experiments/config/${encodeURIComponent(config.id)}`,
        { method: "DELETE" }
      )
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        setError(payload?.error ?? `Failed (${res.status})`)
        return
      }
      onChanged()
    })
  }

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="gap-1">
        <CardTitle className="flex items-center gap-2 text-base">
          <FlaskConical className="size-4 text-muted-foreground" aria-hidden />
          Experiment setup
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Link other landing pages (different domains) as variants to compare
          analytics. Each domain needs its own Arohaa snippet installed.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {!config ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="exp-name">Name</Label>
              <Input
                id="exp-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Homepage domains A/B"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => void createExperiment()}
                disabled={isPending || !name.trim()}
              >
                Create experiment
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Or{" "}
              <Link
                href={newVariantPath(projectId)}
                className="font-medium text-foreground underline underline-offset-2"
              >
                add a new variant landing page
              </Link>{" "}
              to start an experiment with this project as{" "}
              {experimentVariantDisplayLabel(labelPlan?.parentLabel ?? "A")}.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="exp-name-edit">Name</Label>
                <Input
                  id="exp-name-edit"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="exp-status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger
                    id="exp-status"
                    aria-label="Experiment status"
                    className={cn(overviewSelectTriggerClassName, "w-full")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    align="start"
                    className={overviewSelectContentClassName}
                  >
                    {(["Draft", "Running", "Paused", "Completed"] as const).map(
                      (option) => (
                        <SelectItem
                          key={option}
                          value={option}
                          className={overviewSelectItemClassName}
                        >
                          {option}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="exp-start">Start date</Label>
                <Input
                  id="exp-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="exp-end">End date</Label>
                <div className="flex flex-wrap items-center gap-3">
                  <Input
                    id="exp-end"
                    type="date"
                    value={endDate}
                    disabled={noEndDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="max-w-48"
                  />
                  <label className="inline-flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={noEndDate}
                      onChange={(e) => setNoEndDate(e.target.checked)}
                    />
                    No end date
                  </label>
                </div>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="exp-control">Control variant</Label>
                <Select
                  value={controlLandingPageId || CONTROL_NONE}
                  onValueChange={(value) =>
                    setControlLandingPageId(value === CONTROL_NONE ? "" : value)
                  }
                >
                  <SelectTrigger
                    id="exp-control"
                    aria-label="Control variant"
                    className={cn(overviewSelectTriggerClassName, "w-full")}
                  >
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    align="start"
                    className={overviewSelectContentClassName}
                  >
                    <SelectItem
                      value={CONTROL_NONE}
                      className={overviewSelectItemClassName}
                    >
                      None
                    </SelectItem>
                    {config.variants.map((v) => (
                      <SelectItem
                        key={v.landingPageId}
                        value={v.landingPageId}
                        className={overviewSelectItemClassName}
                      >
                        {experimentVariantDisplayLabel(v.label)} ({v.hostname})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void saveMeta()}
                disabled={isPending}
              >
                Save settings
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void deleteExperiment()}
                disabled={isPending}
              >
                Delete experiment
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Variants</p>
              {config.variants.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No variants linked yet. Add a new variant landing page below,
                  or link an existing project from Settings → Experiment
                  variant.
                </p>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {config.variants.map((v) => (
                    <li
                      key={v.landingPageId}
                      className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {experimentVariantDisplayLabel(v.label)}
                          {v.isControl ? (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              Control
                            </span>
                          ) : null}
                          {v.isCurrent ? (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              This page
                            </span>
                          ) : null}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {v.brandName} · {v.hostname}
                        </p>
                        <p
                          className={cn(
                            "text-xs",
                            v.health === "ok"
                              ? "text-emerald-700"
                              : v.health === "stale"
                                ? "text-amber-700"
                                : "text-muted-foreground"
                          )}
                        >
                          {healthLabel(v.health)}
                          {v.lastEventAt
                            ? ` · last ${new Date(v.lastEventAt).toLocaleString()}`
                            : ""}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => void removeVariant(v.landingPageId)}
                        disabled={isPending}
                        aria-label={`Remove ${experimentVariantDisplayLabel(v.label)}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="text-sm text-muted-foreground">
              <Link
                href={newVariantPath(projectId)}
                className="inline-flex items-center gap-1.5 font-medium text-foreground underline underline-offset-2"
              >
                <FlaskConical className="size-3.5" aria-hidden />
                Add a new variant landing page
              </Link>
              {" · "}
              Link an existing project from that project&rsquo;s Settings →
              Experiment variant.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
