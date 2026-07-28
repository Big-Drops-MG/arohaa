"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { cn } from "@workspace/ui/lib/utils"
import { experimentVariantDisplayLabel } from "@/features/experiments/utils/experiment-table-columns"
import {
  overviewSelectContentClassName,
  overviewSelectItemClassName,
  overviewSelectTriggerClassName,
} from "@/features/overview/view/overview-select-styles"
import type { LandingPageRecord } from "@/features/settings/model/landing-page-settings"
import { SettingsSectionCard } from "@/features/settings/view/SettingsSectionCard"
import { formatLandingFormType } from "@/features/settings/utils/settings-format"

type MembershipVariant = {
  label: string
  publicId: string
  brandName: string
  hostname: string
  isControl: boolean
  isCurrent: boolean
}

type Membership = {
  experimentId: string
  experimentName: string
  status: string
  label: string | null
  isHub: boolean
  hubPublicId: string | null
  hubBrandName: string | null
  variants: MembershipVariant[]
}

type Candidate = {
  publicId: string
  brandName: string
  hostname: string
  formType: string
}

type MembershipResponse = {
  membership: Membership | null
  candidates: Candidate[]
}

type LabelPlan = {
  parentLabel: string
  availableLabels: string[]
  suggestedLabel: string
  hasExperiment: boolean
  experimentName: string | null
}

type SettingsExperimentSectionProps = {
  landingPage: LandingPageRecord
}

export function SettingsExperimentSection({
  landingPage,
}: SettingsExperimentSectionProps) {
  const router = useRouter()
  const publicId = landingPage.publicId

  const [data, setData] = useState<MembershipResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)

  const [parentPublicId, setParentPublicId] = useState("")
  const [labelPlan, setLabelPlan] = useState<LabelPlan | null>(null)
  const [label, setLabel] = useState("")

  const membershipPath = `/api/landing-pages/${encodeURIComponent(publicId)}/experiments/membership`

  const applyResponse = useCallback((next: MembershipResponse) => {
    setData(next)
    setParentPublicId("")
    setLabelPlan(null)
    setLabel("")
    setConfirmLeave(false)
  }, [])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const res = await fetch(membershipPath, { cache: "no-store" })
        const payload = (await res.json().catch(() => ({}))) as
          | (MembershipResponse & { error?: string })
          | Record<string, never>
        if (cancelled) return
        if (!res.ok) {
          setError(
            ("error" in payload ? payload.error : null) ??
              "Could not load experiment details"
          )
          return
        }
        setData(payload as MembershipResponse)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [membershipPath])

  // While joining, free labels come from the target project's experiment.
  // Once linked, they come from this project's own experiment so the label can
  // be changed without colliding with a sibling variant.
  const labelPlanSource = data?.membership ? publicId : parentPublicId

  useEffect(() => {
    if (!labelPlanSource) {
      setLabelPlan(null)
      return
    }

    let cancelled = false

    void (async () => {
      const res = await fetch(
        `/api/landing-pages/${encodeURIComponent(labelPlanSource)}/experiments/variant-labels`,
        { cache: "no-store" }
      )
      if (!res.ok || cancelled) return
      const plan = (await res.json().catch(() => null)) as LabelPlan | null
      if (!plan || cancelled) return
      setLabelPlan(plan)
      setLabel(plan.suggestedLabel)
    })()

    return () => {
      cancelled = true
    }
  }, [labelPlanSource])

  const handleJoin = useCallback(async () => {
    setError(null)
    setSuccess(null)
    setIsSaving(true)

    try {
      const res = await fetch(membershipPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentPublicId, label }),
      })
      const payload = (await res.json().catch(() => ({}))) as
        | (MembershipResponse & { error?: string })
        | Record<string, never>

      if (!res.ok) {
        setError(
          ("error" in payload ? payload.error : null) ??
            "Could not link this project as a variant"
        )
        return
      }

      applyResponse(payload as MembershipResponse)
      setSuccess(
        `This project is now ${experimentVariantDisplayLabel(label)} in the experiment.`
      )
      router.refresh()
    } finally {
      setIsSaving(false)
    }
  }, [applyResponse, label, membershipPath, parentPublicId, router])

  const handleRelabel = useCallback(
    async (nextLabel: string) => {
      setError(null)
      setSuccess(null)
      setIsSaving(true)

      try {
        const res = await fetch(membershipPath, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: nextLabel }),
        })
        const payload = (await res.json().catch(() => ({}))) as
          | (MembershipResponse & { error?: string })
          | Record<string, never>

        if (!res.ok) {
          setError(
            ("error" in payload ? payload.error : null) ??
              "Could not change the variant label"
          )
          return
        }

        applyResponse(payload as MembershipResponse)
        setSuccess(`Renamed to ${experimentVariantDisplayLabel(nextLabel)}.`)
        router.refresh()
      } finally {
        setIsSaving(false)
      }
    },
    [applyResponse, membershipPath, router]
  )

  const handleLeave = useCallback(async () => {
    if (!confirmLeave) {
      setConfirmLeave(true)
      setError(null)
      setSuccess(null)
      return
    }

    setError(null)
    setSuccess(null)
    setIsSaving(true)

    try {
      const res = await fetch(membershipPath, { method: "DELETE" })
      const payload = (await res.json().catch(() => ({}))) as
        | (MembershipResponse & {
            error?: string
            experimentDeleted?: boolean
          })
        | Record<string, never>

      if (!res.ok) {
        setError(
          ("error" in payload ? payload.error : null) ??
            "Could not remove this project from the experiment"
        )
        setConfirmLeave(false)
        return
      }

      const deleted =
        "experimentDeleted" in payload && payload.experimentDeleted === true
      applyResponse(payload as MembershipResponse)
      setSuccess(
        deleted
          ? "Removed from the experiment. It had no other variants, so the experiment was deleted."
          : "Removed from the experiment. The remaining variants keep running."
      )
      router.refresh()
    } finally {
      setIsSaving(false)
    }
  }, [applyResponse, confirmLeave, membershipPath, router])

  const membership = data?.membership ?? null
  const candidates = data?.candidates ?? []
  const joinLabelOptions = labelPlan
    ? Array.from(
        new Set([labelPlan.suggestedLabel, ...labelPlan.availableLabels])
      )
    : []
  const selectedCandidate =
    candidates.find((c) => c.publicId === parentPublicId) ?? null
  const formTypeMismatch =
    selectedCandidate != null &&
    selectedCandidate.formType !== landingPage.formType

  return (
    <SettingsSectionCard
      title="Experiment variant"
      description="Compare this project against another Arohaa project by running them as variants of one experiment."
    >
      {isLoading ? (
        <div
          className="space-y-3"
          aria-busy
          aria-label="Loading experiment details"
        >
          <div className="h-4 w-48 animate-pulse rounded-md bg-muted" />
          <div className="h-3 w-72 animate-pulse rounded-md bg-muted" />
          <div className="space-y-2 rounded-lg border border-border p-4">
            {Array.from({ length: 3 }, (_, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 py-2"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3.5 w-40 animate-pulse rounded-md bg-muted" />
                  <div className="h-3 w-56 animate-pulse rounded-md bg-muted" />
                </div>
                <div className="h-3 w-10 shrink-0 animate-pulse rounded-md bg-muted" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {membership ? (
            <>
              <div className="space-y-3 rounded-lg border border-border p-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {membership.label
                      ? experimentVariantDisplayLabel(membership.label)
                      : "Experiment owner"}{" "}
                    in &ldquo;{membership.experimentName}&rdquo;
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Status {membership.status}
                    {membership.isHub
                      ? " · this project owns the experiment"
                      : membership.hubBrandName
                        ? ` · owned by ${membership.hubBrandName}`
                        : ""}
                  </p>
                </div>

                <ul className="divide-y divide-border rounded-md border border-border">
                  {membership.variants.map((variant) => (
                    <li
                      key={variant.publicId}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-foreground">
                          {experimentVariantDisplayLabel(variant.label)}
                          {variant.isControl ? (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              Control
                            </span>
                          ) : null}
                          {variant.isCurrent ? (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              This project
                            </span>
                          ) : null}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {variant.brandName} · {variant.hostname}
                        </span>
                      </span>
                      {variant.isCurrent ? null : (
                        <Link
                          href={`/dashboard/${encodeURIComponent(variant.publicId)}?tab=experiments`}
                          className="text-xs font-medium text-foreground underline underline-offset-2"
                        >
                          Open
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {membership.label ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="w-full space-y-1.5 sm:max-w-48">
                    <Label htmlFor="variant-relabel">Variant label</Label>
                    <Select
                      value={membership.label}
                      disabled={isSaving}
                      onValueChange={(value) => void handleRelabel(value)}
                    >
                      <SelectTrigger
                        id="variant-relabel"
                        aria-label="Variant label"
                        className={cn(overviewSelectTriggerClassName, "w-full")}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent
                        position="popper"
                        align="start"
                        className={overviewSelectContentClassName}
                      >
                        {[
                          membership.label,
                          ...(labelPlan?.availableLabels ?? []),
                        ].map((option) => (
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
                  <Button asChild variant="outline">
                    <Link
                      href={`/dashboard/${encodeURIComponent(publicId)}?tab=experiments`}
                    >
                      Open Experiments tab
                    </Link>
                  </Button>
                </div>
              ) : null}

              <div className="space-y-2 rounded-lg border border-border p-4">
                <p className="text-sm font-medium text-foreground">
                  Remove from experiment
                </p>
                <p className="text-sm text-muted-foreground">
                  This project goes back to standalone reporting. Analytics data
                  is not deleted.
                  {membership.isHub && membership.variants.length > 1
                    ? " Ownership of the experiment moves to a remaining variant."
                    : ""}
                </p>
                <div className="flex flex-wrap gap-3 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleLeave()}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <>
                        <Loader2
                          className="mr-2 size-4 animate-spin"
                          aria-hidden
                        />
                        Removing
                      </>
                    ) : confirmLeave ? (
                      "Confirm remove"
                    ) : (
                      "Remove from experiment"
                    )}
                  </Button>
                  {confirmLeave && !isSaving ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setConfirmLeave(false)}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </div>
            </>
          ) : candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You need another landing page on Arohaa before this project can
              become a variant.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                This project is not part of an experiment. Pick a project to
                compare it against and it becomes a variant of that
                project&rsquo;s experiment.
              </p>

              <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
                <div className="space-y-1.5">
                  <Label htmlFor="join-parent">Compare against</Label>
                  <Select
                    value={parentPublicId || undefined}
                    disabled={isSaving}
                    onValueChange={setParentPublicId}
                  >
                    <SelectTrigger
                      id="join-parent"
                      aria-label="Compare against project"
                      className={cn(overviewSelectTriggerClassName, "w-full")}
                    >
                      <SelectValue placeholder="Select a project…" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      align="start"
                      className={overviewSelectContentClassName}
                    >
                      {candidates.map((candidate) => (
                        <SelectItem
                          key={candidate.publicId}
                          value={candidate.publicId}
                          className={overviewSelectItemClassName}
                        >
                          {candidate.brandName} ({candidate.hostname})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="join-label">This project becomes</Label>
                  <Select
                    value={label || undefined}
                    disabled={!labelPlan || isSaving}
                    onValueChange={setLabel}
                  >
                    <SelectTrigger
                      id="join-label"
                      aria-label="Variant label for this project"
                      className={cn(overviewSelectTriggerClassName, "w-full")}
                    >
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      align="start"
                      className={overviewSelectContentClassName}
                    >
                      {joinLabelOptions.map((option) => (
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
              </div>

              {labelPlan && selectedCandidate ? (
                <p className="text-sm text-muted-foreground">
                  {labelPlan.hasExperiment
                    ? `${selectedCandidate.brandName} is ${experimentVariantDisplayLabel(labelPlan.parentLabel)} in "${labelPlan.experimentName}".`
                    : `${selectedCandidate.brandName} becomes ${experimentVariantDisplayLabel(labelPlan.parentLabel)} and a new experiment is created.`}
                </p>
              ) : null}

              {formTypeMismatch && selectedCandidate ? (
                <p className="text-sm text-amber-700" role="status">
                  Form types differ (
                  {formatLandingFormType(landingPage.formType)} vs{" "}
                  {formatLandingFormType(selectedCandidate.formType)}). The
                  variants will be compared on different conversion definitions.
                </p>
              ) : null}

              <Button
                type="button"
                onClick={() => void handleJoin()}
                disabled={isSaving || !parentPublicId || !label}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                    Linking
                  </>
                ) : (
                  "Make this a variant"
                )}
              </Button>
            </>
          )}

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="text-sm text-muted-foreground" role="status">
              {success}
            </p>
          ) : null}
        </div>
      )}
    </SettingsSectionCard>
  )
}
