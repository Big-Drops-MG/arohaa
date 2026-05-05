"use client"

import { generateOTPSetup, verifyAndEnableOTP } from "@/actions/otp.actions"
import { resolveOtpDigits, shouldAutoSubmitOtp } from "../controller/otp"
import { isOtpComplete } from "../model/otp"
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

export function GoogleAuthenticatorScreen() {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("")
  const [enrolledEmail, setEnrolledEmail] = useState("")
  const [setupError, setSetupError] = useState("")
  const [verifyError, setVerifyError] = useState("")
  const [verifyStatus, setVerifyStatus] = useState<
    "idle" | "success" | "error"
  >("idle")
  const [isLoadingSetup, setIsLoadingSetup] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const otpSubmitInFlightRef = useRef(false)

  const handleCodeChange = useCallback((value: string) => {
    setCode(value)
    setVerifyError("")
    setVerifyStatus("idle")
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

  const isComplete = isOtpComplete(code)
  const slotClass = cn(otpSlotClass, verifyError && "border-destructive")

  const submitOtp = useCallback(async () => {
    if (otpSubmitInFlightRef.current || !qrCodeDataUrl) return

    const digits = resolveOtpDigits(code)
    if (digits.length !== 6) return

    otpSubmitInFlightRef.current = true
    setIsProcessing(true)
    setVerifyError("")
    setVerifyStatus("idle")
    try {
      const result = await verifyAndEnableOTP(digits)
      if ("error" in result) {
        setVerifyError(result.error)
        setVerifyStatus("error")
      } else {
        setVerifyStatus("success")
        await new Promise((resolve) => setTimeout(resolve, 500))
        router.push("/onboarding")
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
      shouldAutoSubmitOtp(code, {
        ready: !isLoadingSetup && !setupError && !!qrCodeDataUrl,
      })
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
            description="Scan this QR once, then use the code from your app to log in."
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
                ) : verifyStatus === "success" ? (
                  "Verified"
                ) : verifyStatus === "error" ? (
                  "Wrong code"
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
