"use client"

import { useMemo, useState, useTransition } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { cn } from "@workspace/ui/lib/utils"
import type {
  ExperimentConfigView,
  SiblingLandingPageOption,
} from "@/lib/server/experiments-store"
import type { ExperimentVariantLink } from "@workspace/database"

type ExperimentsSetupCardProps = {
  projectId: string
  config: ExperimentConfigView | null
  siblings: SiblingLandingPageOption[]
  hubLandingPageId?: string
  onChanged: () => void
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

  const linkedIds = useMemo(
    () => new Set(config?.variants.map((v) => v.landingPageId) ?? []),
    [config]
  )

  const availableSiblings = siblings.filter((s) => !linkedIds.has(s.id))

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

        {!config ? (
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
                <select
                  id="exp-status"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="Draft">Draft</option>
                  <option value="Running">Running</option>
                  <option value="Paused">Paused</option>
                  <option value="Completed">Completed</option>
                </select>
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
                <select
                  id="exp-control"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={controlLandingPageId}
                  onChange={(e) => setControlLandingPageId(e.target.value)}
                >
                  <option value="">None</option>
                  {config.variants.map((v) => (
                    <option key={v.landingPageId} value={v.landingPageId}>
                      {v.label} ({v.hostname})
                    </option>
                  ))}
                </select>
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
                          {v.label}
                          {v.isControl ? (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              Control
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
                        aria-label={`Remove ${v.label}`}
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
                <select
                  id="add-lp"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={landingPageId}
                  onChange={(e) => setLandingPageId(e.target.value)}
                >
                  <option value="">Select project…</option>
                  {availableSiblings.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.brandName} ({s.hostname})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-label">Label</Label>
                <Input
                  id="add-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="B"
                />
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
            {availableSiblings.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                All workspace landing pages are already linked, or add another
                project first.
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}
