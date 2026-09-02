"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@workspace/ui/components/button"
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
import { CheckCircle2, XCircle, Loader2, Copy, Check } from "lucide-react"
import type { OverviewLandingFormType } from "@/features/overview/model/overview"
import { LANDING_FORM_TYPE_OPTIONS } from "@/features/overview/model/overview"
import { VariantLabelField } from "@/features/experiments/view/VariantLabelField"
import {
  overviewSelectContentClassName,
  overviewSelectItemClassName,
  overviewSelectTriggerClassName,
} from "@/features/overview/view/overview-select-styles"
import type { NewLandingMode } from "@/features/dashboard/model/new-landing-mode"
import { writeDashboardPreference } from "@/lib/dashboard/dashboard-preferences"

type Step = 1 | 2 | 3
type ConnectionStatus = "idle" | "checking" | "connected" | "failed"

const POLL_MS = 2000
const TIMEOUT_MS = 90_000

const FORM_TYPE_OPTIONS = LANDING_FORM_TYPE_OPTIONS

type ParentProjectOption = {
  publicId: string
  brandName: string
  hostname: string
  formType: string
}

type VariantLabelPlan = {
  hasExperiment: boolean
  experimentName: string | null
  parentLabel: string
  takenLabels: string[]
  availableLabels: string[]
  suggestedLabel: string
}

type NewLandingPageProps = {
  mode?: NewLandingMode
  initialParentPublicId?: string | null
}

export function NewLandingPage({
  mode = "landing",
  initialParentPublicId = null,
}: NewLandingPageProps) {
  const isVariantMode = mode === "variant"

  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [brandName, setBrandName] = useState("")
  const [landingPageUrl, setLandingPageUrl] = useState("")
  const [faviconUrl, setFaviconUrl] = useState("")
  const [formType, setFormType] = useState<OverviewLandingFormType>("single")
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("idle")
  const [copied, setCopied] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sdkSnippet, setSdkSnippet] = useState("")
  const [htmlVerificationMetaTag, setHtmlVerificationMetaTag] = useState("")
  const [publicLandingId, setPublicLandingId] = useState<string | null>(null)
  const [landingPageSlug, setLandingPageSlug] = useState<string | null>(null)
  const [verifyHtmlHint, setVerifyHtmlHint] = useState<string | null>(null)

  const [parentOptions, setParentOptions] = useState<ParentProjectOption[]>([])
  const [parentPublicId, setParentPublicId] = useState(
    initialParentPublicId ?? ""
  )
  const [isLoadingParents, setIsLoadingParents] = useState(isVariantMode)
  const [labelPlan, setLabelPlan] = useState<VariantLabelPlan | null>(null)
  const [variantLabel, setVariantLabel] = useState("")
  const [createdVariantLabel, setCreatedVariantLabel] = useState<string | null>(
    null
  )

  const selectedParent = useMemo(
    () => parentOptions.find((p) => p.publicId === parentPublicId) ?? null,
    [parentOptions, parentPublicId]
  )

  useEffect(() => {
    if (!isVariantMode) return

    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/landing-pages", { cache: "no-store" })
        const data = (await res.json().catch(() => ({}))) as {
          landingPages?: ParentProjectOption[]
          error?: string
        }
        if (cancelled) return
        if (!res.ok) {
          setSubmitError(data.error ?? "Could not load your projects")
          return
        }
        setParentOptions(data.landingPages ?? [])
      } finally {
        if (!cancelled) setIsLoadingParents(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isVariantMode])

  useEffect(() => {
    if (!isVariantMode || !parentPublicId) {
      setLabelPlan(null)
      return
    }

    let cancelled = false
    void (async () => {
      const res = await fetch(
        `/api/landing-pages/${encodeURIComponent(parentPublicId)}/experiments/variant-labels`,
        { cache: "no-store" }
      )
      const data = (await res.json().catch(() => ({}))) as VariantLabelPlan & {
        error?: string
      }
      if (cancelled) return
      if (!res.ok) {
        setLabelPlan(null)
        setSubmitError(data.error ?? "Could not load variant labels")
        return
      }
      setSubmitError(null)
      setLabelPlan(data)
      setVariantLabel(data.suggestedLabel)
    })()

    return () => {
      cancelled = true
    }
  }, [isVariantMode, parentPublicId])

  // Variants are only comparable when both pages measure the same conversion.
  useEffect(() => {
    if (!selectedParent) return
    const parentFormType = selectedParent.formType
    if (
      parentFormType === "single" ||
      parentFormType === "multiple" ||
      parentFormType === "zip" ||
      parentFormType === "none"
    ) {
      setFormType(parentFormType)
    }
  }, [selectedParent])

  const isStep1Valid =
    brandName.trim().length > 0 &&
    landingPageUrl.trim().length > 0 &&
    (!isVariantMode || (parentPublicId.length > 0 && variantLabel.length > 0))

  const handleContinue = useCallback(async () => {
    if (!isStep1Valid) return
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/landing-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName,
          landingPageUrl,
          formType,
          faviconUrl: faviconUrl.trim() || undefined,
          ...(isVariantMode ? { variantOf: parentPublicId, variantLabel } : {}),
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        sdkSnippetHtml?: string
        htmlVerificationMetaTag?: string
        landingPage?: { publicId?: string; slug?: string }
        variant?: { label?: string } | null
      }
      if (!res.ok) {
        setSubmitError(data.error ?? "Could not create landing page")
        return
      }
      const snippet = data.sdkSnippetHtml
      const pid = data.landingPage?.publicId
      const slug = data.landingPage?.slug
      if (typeof snippet !== "string" || !snippet.trim() || !pid || !slug) {
        setSubmitError("Invalid response from server")
        return
      }
      setSdkSnippet(snippet)
      setPublicLandingId(pid)
      setLandingPageSlug(slug)
      setCreatedVariantLabel(data.variant?.label ?? null)
      setHtmlVerificationMetaTag(
        typeof data.htmlVerificationMetaTag === "string"
          ? data.htmlVerificationMetaTag
          : ""
      )
      setCurrentStep(2)
    } finally {
      setIsSubmitting(false)
    }
  }, [
    brandName,
    faviconUrl,
    formType,
    isStep1Valid,
    isVariantMode,
    landingPageUrl,
    parentPublicId,
    variantLabel,
  ])

  const handleCopySDK = useCallback(async () => {
    if (!sdkSnippet) return
    await navigator.clipboard.writeText(sdkSnippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [sdkSnippet])

  const handleCheckConnection = useCallback(() => {
    setCurrentStep(3)
    setConnectionStatus("checking")
  }, [])

  useEffect(() => {
    if (
      currentStep !== 3 ||
      connectionStatus !== "checking" ||
      !publicLandingId
    )
      return

    const pid = publicLandingId

    let cancelled = false
    const startedAt = Date.now()

    async function pollOnce(): Promise<boolean> {
      try {
        const res = await fetch(
          `/api/landing-pages/${encodeURIComponent(pid)}/connection-status`,
          { cache: "no-store" }
        )
        const data = (await res.json().catch(() => ({}))) as {
          sdkInstallStatus?: string
          status?: string
          verificationMethod?: string
        }
        if (!res.ok) return false

        const connected =
          data.verificationMethod === "html_meta" ||
          data.sdkInstallStatus === "detected" ||
          data.status === "verified"

        if (connected && !cancelled) {
          setConnectionStatus("connected")
          return true
        }
      } catch {
        /* transient */
      }

      return false
    }

    void pollOnce()

    const iv = window.setInterval(() => {
      void (async () => {
        if (cancelled) return
        if (await pollOnce()) {
          cancelled = true
          window.clearInterval(iv)
          return
        }

        if (Date.now() - startedAt >= TIMEOUT_MS) {
          if (!cancelled) {
            setConnectionStatus("failed")
          }
          cancelled = true
          window.clearInterval(iv)
        }
      })()
    }, POLL_MS)

    return () => {
      cancelled = true
      window.clearInterval(iv)
    }
  }, [connectionStatus, currentStep, publicLandingId])

  const handleCheckAgain = useCallback(() => {
    setConnectionStatus("checking")
  }, [])

  const verifyHtmlInstallation = useCallback(async () => {
    if (!publicLandingId) return
    setVerifyHtmlHint(null)
    const res = await fetch(
      `/api/landing-pages/${encodeURIComponent(publicLandingId)}/verify-html`,
      { method: "POST" }
    )
    const data = (await res.json().catch(() => ({}))) as {
      error?: string
      ok?: boolean
    }
    if (!res.ok) {
      setVerifyHtmlHint(data.error ?? "HTML verification failed")
      return
    }
    setVerifyHtmlHint(
      data.ok === true ? "HTML verification succeeded." : "Verified."
    )
  }, [publicLandingId])

  const experimentHref = landingPageSlug
    ? `/dashboard/${encodeURIComponent(landingPageSlug)}`
    : "/dashboard"

  return (
    <div className="mx-auto w-full max-w-3xl py-10">
      <section className="mb-8">
        <h2 className="mb-1 text-xl font-semibold text-foreground">
          {isVariantMode ? "Step 1: Add Variant" : "Step 1: Add Landing Page"}
        </h2>
        {isVariantMode ? (
          <p className="mb-5 text-sm text-muted-foreground">
            Pick the project you want to test against, label this page, then add
            its own details. Both pages will share one experiment.
          </p>
        ) : null}
        <div className="space-y-4">
          {isVariantMode ? (
            <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
              <div className="space-y-1.5">
                <Label htmlFor="variant-parent">Project on Arohaa</Label>
                <Select
                  value={parentPublicId || undefined}
                  disabled={isLoadingParents || currentStep > 1}
                  onValueChange={setParentPublicId}
                >
                  <SelectTrigger
                    id="variant-parent"
                    aria-label="Project on Arohaa"
                    className={cn(
                      overviewSelectTriggerClassName,
                      "h-12 w-full text-base"
                    )}
                  >
                    <SelectValue
                      placeholder={
                        isLoadingParents
                          ? "Loading projects…"
                          : "Select a project…"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    align="start"
                    className={overviewSelectContentClassName}
                  >
                    {parentOptions.map((option) => (
                      <SelectItem
                        key={option.publicId}
                        value={option.publicId}
                        className={overviewSelectItemClassName}
                      >
                        {option.brandName} ({option.hostname})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="variant-label">Variant</Label>
                <VariantLabelField
                  id="variant-label"
                  value={variantLabel}
                  onValueChange={setVariantLabel}
                  availableLabels={labelPlan?.availableLabels ?? []}
                  disabled={!labelPlan || currentStep > 1}
                  placeholder="—"
                  triggerClassName="h-12 text-base"
                />
              </div>
            </div>
          ) : null}

          {isVariantMode && labelPlan && selectedParent ? (
            <p className="text-sm text-muted-foreground">
              {labelPlan.hasExperiment
                ? `${selectedParent.brandName} is Variant ${labelPlan.parentLabel} in "${labelPlan.experimentName}". Already used: ${labelPlan.takenLabels.join(", ")}.`
                : `${selectedParent.brandName} becomes Variant ${labelPlan.parentLabel} and a new experiment is created.`}
            </p>
          ) : null}

          {isVariantMode && !isLoadingParents && parentOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You need at least one landing page on Arohaa before you can add a
              variant.
            </p>
          ) : null}

          <Input
            placeholder="Brand Name"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            className="h-12 rounded-lg px-4 text-base"
          />
          <Input
            placeholder="Landing Page URL"
            value={landingPageUrl}
            onChange={(e) => setLandingPageUrl(e.target.value)}
            className="h-12 rounded-lg px-4 text-base"
          />
          <Input
            type="url"
            placeholder="Favicon URL"
            value={faviconUrl}
            onChange={(e) => setFaviconUrl(e.target.value)}
            className="h-12 rounded-lg px-4 text-base"
            autoComplete="off"
          />
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-foreground">
              Form type
            </legend>
            <div
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
              role="presentation"
            >
              {FORM_TYPE_OPTIONS.map((opt) => {
                const selected = formType === opt.value
                return (
                  <label
                    key={opt.value}
                    className={cn(
                      "relative flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3.5 text-left shadow-xs transition-[border-color,box-shadow,background-color] outline-none",
                      "has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring has-[input:focus-visible]:ring-offset-2 has-[input:focus-visible]:ring-offset-background",
                      selected
                        ? "border-primary bg-primary/6 shadow-sm"
                        : "border-border bg-card hover:border-muted-foreground/35 hover:bg-muted/25"
                    )}
                  >
                    <input
                      type="radio"
                      name="newLpFormType"
                      value={opt.value}
                      checked={selected}
                      onChange={() => setFormType(opt.value)}
                      className="sr-only"
                    />
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                        selected
                          ? "border-primary bg-primary"
                          : "border-muted-foreground/45 bg-background"
                      )}
                      aria-hidden
                    >
                      <span
                        className={cn(
                          "size-2 rounded-full bg-primary-foreground transition-opacity",
                          selected ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {opt.label}
                    </span>
                  </label>
                )
              })}
            </div>
            {isVariantMode && selectedParent ? (
              <p className="text-xs text-muted-foreground">
                Matched to {selectedParent.brandName} so both variants report
                the same conversion.
              </p>
            ) : null}
          </fieldset>
          {submitError ? (
            <p className="text-sm text-destructive" role="alert">
              {submitError}
            </p>
          ) : null}
          {currentStep === 1 && (
            <Button
              type="button"
              onClick={() => void handleContinue()}
              disabled={!isStep1Valid || isSubmitting}
              className="mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  Saving
                </>
              ) : (
                "Continue"
              )}
            </Button>
          )}
        </div>
      </section>

      {currentStep >= 2 && (
        <section className="mb-8">
          <h2 className="mb-2 text-xl font-semibold text-foreground">
            Step 2: Install SDK
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Copy this script and paste it inside the &lt;head&gt; tag of your
            {createdVariantLabel
              ? ` Variant ${createdVariantLabel} page.`
              : " landing page."}
          </p>
          <div className="min-h-[80px] rounded-lg border border-border bg-muted/30 px-4 py-4">
            <code className="block text-sm break-all whitespace-pre-wrap text-foreground">
              {sdkSnippet}
            </code>
          </div>
          {htmlVerificationMetaTag.trim() ? (
            <div className="mt-6 space-y-2">
              <p className="text-sm font-medium text-foreground">
                Optional HTML verification (meta tag)
              </p>
              <p className="text-sm text-muted-foreground">
                Paste this meta tag anywhere inside the landing page HTML
                &lt;head&gt; to prove ownership without waiting for SDK
                telemetry.
              </p>
              <div className="rounded-lg border border-border bg-muted/30 px-4 py-4">
                <code className="block text-sm break-all whitespace-pre-wrap text-foreground">
                  {htmlVerificationMetaTag}
                </code>
              </div>
              <Button
                type="button"
                variant="outline"
                className="mt-2"
                onClick={() => void verifyHtmlInstallation()}
              >
                Check HTML verification
              </Button>
              {verifyHtmlHint ? (
                <p className="text-sm text-muted-foreground" role="status">
                  {verifyHtmlHint}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="mt-4 flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleCopySDK()}
              className="gap-2"
              disabled={!sdkSnippet}
            >
              {copied ? (
                <Check className="size-4" aria-hidden />
              ) : (
                <Copy className="size-4" aria-hidden />
              )}
              {copied ? "Copied" : "Copy SDK"}
            </Button>
            <Button type="button" onClick={handleCheckConnection}>
              Check Connection
            </Button>
          </div>
        </section>
      )}

      {currentStep >= 3 && (
        <section>
          <h2 className="mb-2 text-xl font-semibold text-foreground">
            Step 3: Check Connection
          </h2>

          {connectionStatus === "checking" && (
            <div className="flex items-center gap-3 rounded-lg border border-border px-4 py-4">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                Waiting for SDK Connection
              </span>
            </div>
          )}

          {connectionStatus === "connected" && (
            <div>
              <div className="flex items-center gap-3 rounded-lg border border-border px-4 py-4">
                <CheckCircle2 className="size-5 text-green-600" />
                <span className="text-sm font-medium text-foreground">
                  SDK Connected Successfully
                </span>
              </div>
              {createdVariantLabel ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  This page is now Variant {createdVariantLabel}. The Experiment
                  tab of every page in this experiment now compares all
                  variants.
                </p>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  Your landing page is now connected with Arohaa.
                  <br />
                  We will start collecting page views, sessions, clicks, form
                  activity, and conversion events.
                </p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {createdVariantLabel ? (
                  <Button asChild>
                    <Link
                      href={experimentHref}
                      onClick={() => {
                        if (publicLandingId) {
                          writeDashboardPreference(
                            publicLandingId,
                            "tab",
                            "experiments"
                          )
                        }
                      }}
                    >
                      View experiment
                    </Link>
                  </Button>
                ) : null}
                <Button
                  asChild
                  variant={createdVariantLabel ? "outline" : "default"}
                >
                  <Link href="/dashboard">Go to Dashboard</Link>
                </Button>
              </div>
            </div>
          )}

          {connectionStatus === "failed" && (
            <div>
              <div className="flex items-center gap-3 rounded-lg border border-border px-4 py-4">
                <XCircle className="size-5 text-destructive" />
                <span className="text-sm font-medium text-foreground">
                  SDK Not Detected
                </span>
              </div>
              <div className="mt-3 text-sm text-muted-foreground">
                <p className="mb-1 font-medium">Please check:</p>
                <ol className="list-inside list-decimal space-y-0.5">
                  <li>Script is added inside &lt;head&gt;</li>
                  <li>Landing page URL is correct</li>
                  <li>Page is published/live</li>
                  <li>You opened the landing page after adding SDK</li>
                </ol>
              </div>
              <Button className="mt-4" onClick={handleCheckAgain}>
                Check Again
              </Button>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
