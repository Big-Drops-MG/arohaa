"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { CheckCircle2, XCircle, Loader2, Copy, Check } from "lucide-react"

type Step = 1 | 2 | 3
type ConnectionStatus = "idle" | "checking" | "connected" | "failed"

const POLL_MS = 2000
const TIMEOUT_MS = 90_000

export function NewLandingPage() {
  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [brandName, setBrandName] = useState("")
  const [landingPageUrl, setLandingPageUrl] = useState("")
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("idle")
  const [copied, setCopied] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sdkSnippet, setSdkSnippet] = useState("")
  const [htmlVerificationMetaTag, setHtmlVerificationMetaTag] = useState("")
  const [publicLandingId, setPublicLandingId] = useState<string | null>(null)
  const [verifyHtmlHint, setVerifyHtmlHint] = useState<string | null>(null)

  const isStep1Valid =
    brandName.trim().length > 0 && landingPageUrl.trim().length > 0

  const handleContinue = useCallback(async () => {
    if (!isStep1Valid) return
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/landing-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandName, landingPageUrl }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        sdkSnippetHtml?: string
        htmlVerificationMetaTag?: string
        landingPage?: { publicId?: string }
      }
      if (!res.ok) {
        setSubmitError(data.error ?? "Could not create landing page")
        return
      }
      const snippet = data.sdkSnippetHtml
      const pid = data.landingPage?.publicId
      if (typeof snippet !== "string" || !snippet.trim() || !pid) {
        setSubmitError("Invalid response from server")
        return
      }
      setSdkSnippet(snippet)
      setPublicLandingId(pid)
      setHtmlVerificationMetaTag(
        typeof data.htmlVerificationMetaTag === "string"
          ? data.htmlVerificationMetaTag
          : ""
      )
      setCurrentStep(2)
    } finally {
      setIsSubmitting(false)
    }
  }, [brandName, isStep1Valid, landingPageUrl])

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

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <section className="mb-8">
        <h2 className="mb-5 text-xl font-semibold text-foreground">
          Step 1: Add Landing Page
        </h2>
        <div className="space-y-4">
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
            landing page.
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
              <p className="mt-3 text-sm text-muted-foreground">
                Your landing page is now connected with Arohaa.
                <br />
                We will start collecting page views, sessions, clicks, form
                activity, and conversion events.
              </p>
              <Button className="mt-4" asChild>
                <a href="/dashboard">Go to Dashboard</a>
              </Button>
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
