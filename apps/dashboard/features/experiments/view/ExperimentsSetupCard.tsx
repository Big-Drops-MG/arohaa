"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, useTransition } from "react"
import { FlaskConical, Plus, Trash2 } from "lucide-react"
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
import type {
  ExperimentConfigView,
  SiblingLandingPageOption,
} from "@/lib/server/experiments-store"
import type { ExperimentVariantLink } from "@workspace/database"

const CONTROL_NONE = "__none__"

type ExperimentsSetupCardProps = {
  projectId: string
  config: ExperimentConfigView | null
  siblings: SiblingLandingPageOption[]
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
  siblings,
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
  const [label, setLabel] = useState("")
  const [landingPageId, setLandingPageId] = useState("")
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
      setLabel((current) => current || data.suggestedLabel)
    })()

    return () => {
      cancelled = true
    }
  }, [projectId, configSignature])

  const linkedIds = useMemo(
    () => new Set(config?.variants.map((v) => v.landingPageId) ?? []),
    [config]
  )

  const availableSiblings = siblings.filter((s) => !linkedIds.has(s.id))

  const labelOptions = useMemo(() => {
    const options = [...(labelPlan?.availableLabels ?? [])]
    if (label && !options.includes(label)) options.unshift(label)
    return options
  }, [label, labelPlan])

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

  async function addVariant() {
    if (!config) return
    const nextLabel = label.trim()
    if (!nextLabel || !landingPageId) {
      setError("Choose a landing page and enter a label")
      return
    }
    const variants: ExperimentVariantLink[] = [
      ...config.variants.map((v) => ({
        label: v.label,
        landingPageId: v.landingPageId,
      })),
      { label: nextLabel, landingPageId },
    ]
    setLabel("")
    setLandingPageId("")
    await patchExperiment({
      variants,
      controlLandingPageId:
        config.controlLandingPageId ?? variants[0]?.landingPageId ?? null,
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
    <Card className="gap-0 py-0">
      <CardHeader className="border-b border-border px-5 py-4 sm:px-6">
        <CardTitle className="text-base font-semibold">
          Experiment setup
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Link other landing pages (different domains) as variants to compare
          analytics. Each domain needs its own Arohaa snippet installed.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 px-5 py-4 sm:px-6">
        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        {config && !config.isHub ? (
          <p className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
            This page is{" "}
            <span className="font-medium text-foreground">
              {config.currentLabel
                ? experimentVariantDisplayLabel(config.currentLabel)
                : "a linked variant"}
            </span>{" "}
            of{" "}
            {config.hubPublicId ? (
              <Link
                href={`/dashboard/${encodeURIComponent(config.hubPublicId)}?tab=experiments`}
                className="font-medium text-foreground underline underline-offset-2"
              >
                {config.hubBrandName ?? "the parent project"}
              </Link>
            ) : (
              (config.hubBrandName ?? "the parent project")
            )}
            . Changes here apply to the shared experiment.
          </p>
        ) : null}

        {!config ? (
          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label htmlFor="exp-name">Experiment name</Label>
                <Input
                  id="exp-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Homepage domains"
                />
              </div>
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
                  No variants linked yet. Add another landing page below.
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

            <div className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="add-lp">Landing page</Label>
                <Select
                  value={landingPageId || undefined}
                  onValueChange={setLandingPageId}
                >
                  <SelectTrigger
                    id="add-lp"
                    aria-label="Landing page to add as variant"
                    className={cn(overviewSelectTriggerClassName, "w-full")}
                  >
                    <SelectValue placeholder="Select project…" />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    align="start"
                    className={overviewSelectContentClassName}
                  >
                    {availableSiblings.map((s) => (
                      <SelectItem
                        key={s.id}
                        value={s.id}
                        className={overviewSelectItemClassName}
                      >
                        {s.brandName} ({s.hostname})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-label">Variant</Label>
                <Select
                  value={label || undefined}
                  onValueChange={setLabel}
                  disabled={labelOptions.length === 0}
                >
                  <SelectTrigger
                    id="add-label"
                    aria-label="Variant label"
                    className={cn(overviewSelectTriggerClassName, "w-full")}
                  >
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    align="start"
                    className={overviewSelectContentClassName}
                  >
                    {labelOptions.map((option) => (
                      <SelectItem
                        key={option}
                        value={option}
                        className={overviewSelectItemClassName}
                      >
                        {experimentVariantDisplayLabel(option)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                onClick={() => void addVariant()}
                disabled={isPending || availableSiblings.length === 0}
              >
                <Plus className="size-4" />
                Add variant
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {availableSiblings.length === 0
                ? "All landing pages are already linked. "
                : ""}
              <Link
                href={newVariantPath(projectId)}
                className="inline-flex items-center gap-1.5 font-medium text-foreground underline underline-offset-2"
              >
                <FlaskConical className="size-3.5" aria-hidden />
                Add a new variant landing page
              </Link>
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
