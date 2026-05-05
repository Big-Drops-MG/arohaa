"use client"

import { generateOTPSetup, verifyAndEnableOTP } from "@/actions/otp.actions"
import { AuthBrandHeader, AuthScreen } from "./AuthScreen"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@workspace/ui/components/input-otp"
import { cn } from "@workspace/ui/lib/utils"
import { ArrowLeft, LoaderCircle } from "lucide-react"

const otpSlotClass =
  "relative flex size-11 items-center justify-center rounded-md border border-input bg-white text-lg font-medium text-neutral-900 shadow-xs transition-colors data-[active=true]:z-10 data-[active=true]:border-ring data-[active=true]:ring-3 data-[active=true]:ring-ring/50 sm:size-12 sm:text-xl"

function readOtpDigitsFromInput(elementId: string): string {
  if (typeof document === "undefined") return ""
  const el = document.getElementById(elementId)
  if (!el || !(el instanceof HTMLInputElement)) return ""
  return el.value.replace(/\D/g, "").slice(0, 6)
}

export function GoogleAuthenticatorScreen() {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("")
  const [enrolledEmail, setEnrolledEmail] = useState("")
  const [setupError, setSetupError] = useState("")
  const [verifyError, setVerifyError] = useState("")
  const [isLoadingSetup, setIsLoadingSetup] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const otpSubmitInFlightRef = useRef(false)

  const handleCodeChange = useCallback((value: string) => {
    setCode(value)
    setVerifyError("")
  }, [])

  useEffect(() => {
    let cancelled = false

    generateOTPSetup()
      .then((data) => {
        if (!cancelled) {
          setQrCodeDataUrl(data.qrCodeDataUrl)
          setEnrolledEmail(data.enrolledEmail)
          setSetupError("")
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSetupError(
            "Could not start authenticator setup. Sign in and try again."
          )
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSetup(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const isComplete = code.length === 6
  const slotClass = cn(otpSlotClass, verifyError && "border-destructive")

  const submitOtp = useCallback(async () => {
    if (otpSubmitInFlightRef.current || !qrCodeDataUrl) return

    const fromDom = readOtpDigitsFromInput("ga-otp")
    const fromState = code.replace(/\D/g, "").slice(0, 6)
    const digits = fromDom.length === 6 ? fromDom : fromState
    if (digits.length !== 6) return

    otpSubmitInFlightRef.current = true
    setIsProcessing(true)
    setVerifyError("")
    try {
      const result = await verifyAndEnableOTP(digits)
      if ("error" in result) {
        setVerifyError(result.error)
      } else {
        router.push("/dashboard")
      }
    } finally {
      otpSubmitInFlightRef.current = false
      setIsProcessing(false)
    }
  }, [code, qrCodeDataUrl, router])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await submitOtp()
  }

  useEffect(() => {
    if (
      code.length === 6 &&
      !isLoadingSetup &&
      !setupError &&
      !!qrCodeDataUrl
    ) {
      void submitOtp()
    }
  }, [code, isLoadingSetup, qrCodeDataUrl, setupError, submitOtp])

  return (
    <AuthScreen>
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="gap-3 pb-2 text-center sm:pb-4">
          <AuthBrandHeader
            title="Set up two-factor authentication"
            description="Scan this QR once. Your app will keep the account and show a new code every minute. Later logins only need that code—you never scan the QR again."
          />
          {enrolledEmail ? (
            <div className="space-y-1 text-center">
              <p className="text-sm text-muted-foreground">
                Registered email:{" "}
                <span className="font-medium text-foreground">
                  {enrolledEmail}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                After scanning, enter the current code shown in the app to
                confirm setup.
              </p>
            </div>
          ) : null}
        </CardHeader>
        <CardContent>
          <form
            noValidate
            onSubmit={handleSubmit}
            className="flex flex-col gap-6"
          >
            <div className="flex flex-col items-center gap-4">
              {setupError ? (
                <p
                  className="text-center text-sm text-destructive"
                  role="alert"
                >
                  {setupError}
                </p>
              ) : null}
              {isLoadingSetup ? (
                <div
                  className="size-[200px] animate-pulse rounded-md bg-muted"
                  aria-hidden
                />
              ) : qrCodeDataUrl ? (
                <Image
                  src={qrCodeDataUrl}
                  alt="Authenticator setup QR code"
                  width={200}
                  height={200}
                  className="rounded-md border border-border"
                  unoptimized
                />
              ) : null}
            </div>

            <div className="flex justify-center">
              <InputOTP
                id="ga-otp"
                maxLength={6}
                value={code}
                onChange={handleCodeChange}
                disabled={isProcessing || isLoadingSetup || !!setupError}
                containerClassName="gap-2 sm:gap-3"
                aria-label="6-digit authenticator code"
              >
                <InputOTPGroup className="gap-2 sm:gap-3">
                  <InputOTPSlot index={0} className={slotClass} />
                  <InputOTPSlot index={1} className={slotClass} />
                  <InputOTPSlot index={2} className={slotClass} />
                </InputOTPGroup>
                <InputOTPSeparator className="text-muted-foreground" />
                <InputOTPGroup className="gap-2 sm:gap-3">
                  <InputOTPSlot index={3} className={slotClass} />
                  <InputOTPSlot index={4} className={slotClass} />
                  <InputOTPSlot index={5} className={slotClass} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                type="submit"
                size="lg"
                className="h-11 w-full text-base font-medium"
                disabled={
                  !isComplete ||
                  isProcessing ||
                  isLoadingSetup ||
                  !!setupError ||
                  !qrCodeDataUrl
                }
                aria-busy={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <span>Verifying</span>
                    <LoaderCircle
                      className="size-5 shrink-0 animate-spin"
                      aria-hidden
                    />
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
              {verifyError ? (
                <p
                  className="text-center text-sm text-destructive"
                  role="alert"
                >
                  {verifyError}
                </p>
              ) : null}
            </div>

            <div className="flex justify-center">
              <Button
                variant="ghost"
                asChild
                className="h-auto gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                <Link href="/login">
                  <ArrowLeft className="size-4 shrink-0" aria-hidden />
                  Back to sign in
                </Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </AuthScreen>
  )
}
