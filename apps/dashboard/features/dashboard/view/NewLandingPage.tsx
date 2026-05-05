"use client"

import { useState, useCallback } from "react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { CheckCircle2, XCircle, Loader2, Copy, Check } from "lucide-react"

type Step = 1 | 2 | 3
type ConnectionStatus = "idle" | "checking" | "connected" | "failed"

export function NewLandingPage() {
  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [brandName, setBrandName] = useState("")
  const [landingPageUrl, setLandingPageUrl] = useState("")
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("idle")
  const [copied, setCopied] = useState(false)

  const [projectId] = useState(() => `lp_${Date.now().toString(36)}`)

  const sdkSnippet = `<script src="https://cdn.arohaa.com/sdk.js" data-brand="${brandName || "brand_name"}" data-page-url="${landingPageUrl || "https://example.com"}" data-project-id="${projectId}"> </script>`

  const isStep1Valid =
    brandName.trim().length > 0 && landingPageUrl.trim().length > 0

  const handleContinue = useCallback(() => {
    if (isStep1Valid) {
      setCurrentStep(2)
    }
  }, [isStep1Valid])

  const handleCopySDK = useCallback(async () => {
    await navigator.clipboard.writeText(sdkSnippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [sdkSnippet])

  const handleCheckConnection = useCallback(() => {
    setCurrentStep(3)
    setConnectionStatus("checking")

    setTimeout(() => {
      const success = Math.random() > 0.5
      setConnectionStatus(success ? "connected" : "failed")
    }, 3000)
  }, [])

  const handleCheckAgain = useCallback(() => {
    setConnectionStatus("checking")
    setTimeout(() => {
      const success = Math.random() > 0.5
      setConnectionStatus(success ? "connected" : "failed")
    }, 3000)
  }, [])

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      {/* Step 1 */}
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
          {currentStep === 1 && (
            <Button
              onClick={handleContinue}
              disabled={!isStep1Valid}
              className="mt-2"
            >
              Continue
            </Button>
          )}
        </div>
      </section>

      {/* Step 2 */}
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
          <div className="mt-4 flex items-center gap-3">
            <Button variant="outline" onClick={handleCopySDK} className="gap-2">
              {copied ? (
                <Check className="size-4" aria-hidden />
              ) : (
                <Copy className="size-4" aria-hidden />
              )}
              {copied ? "Copied" : "Copy SDK"}
            </Button>
            <Button onClick={handleCheckConnection}>Check Connection</Button>
          </div>
        </section>
      )}

      {/* Step 3 */}
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
