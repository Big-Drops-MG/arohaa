"use client"

import { loginWithCredentials } from "@/actions/auth.actions"
import { AuthBrandHeader, AuthScreen } from "./AuthScreen"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { FormEvent } from "react"
import { useCallback, useRef, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@workspace/ui/components/input-otp"
import { Label } from "@workspace/ui/components/label"
import { cn } from "@workspace/ui/lib/utils"
import { ArrowLeft, Eye, EyeOff, LoaderCircle, Lock, Mail } from "lucide-react"

const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

const otpSlotClass =
  "relative flex size-11 items-center justify-center rounded-md border border-input bg-white text-lg font-medium text-neutral-900 shadow-xs transition-colors data-[active=true]:z-10 data-[active=true]:border-ring data-[active=true]:ring-3 data-[active=true]:ring-ring/50 sm:size-12 sm:text-xl"

const iconWrap =
  "pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center text-muted-foreground"

function readOtpDigitsFromInput(elementId: string): string {
  if (typeof document === "undefined") return ""
  const el = document.getElementById(elementId)
  if (!el || !(el instanceof HTMLInputElement)) return ""
  return el.value.replace(/\D/g, "").slice(0, 6)
}

export function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [otpCode, setOtpCode] = useState("")
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showTwoFactor, setShowTwoFactor] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const otpSubmitInFlightRef = useRef(false)

  const trimmedEmail = email.trim()
  const normalizedEmail = trimmedEmail.toLowerCase()
  const emailValid = EMAIL_PATTERN.test(normalizedEmail)
  const passwordValid = password.length >= 8
  const canSubmitPassword = emailValid && passwordValid
  const hasBothInputs = trimmedEmail.length > 0 && password.length > 0
  const otpComplete = otpCode.length === 6

  const emailFieldError = submitAttempted && !emailValid
  const passwordFieldError = submitAttempted && !passwordValid

  const otpSlotClassActive = cn(
    otpSlotClass,
    serverError && "border-destructive"
  )

  const resetOtp = useCallback(() => {
    setOtpCode("")
    setServerError(null)
  }, [])

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!hasBothInputs || isProcessing) return
    setSubmitAttempted(true)
    if (!canSubmitPassword) return

    setIsProcessing(true)
    setServerError(null)
    try {
      const fd = new FormData()
      fd.set("email", normalizedEmail)
      fd.set("password", password)
      const result = await loginWithCredentials(fd)

      if (result && "error" in result && result.error) {
        setServerError(result.error)
        return
      }
      if (result && "requiresTwoFactor" in result && result.requiresTwoFactor) {
        setShowTwoFactor(true)
        resetOtp()
      }
    } finally {
      setIsProcessing(false)
    }
  }

  const handleOtpSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isProcessing || otpSubmitInFlightRef.current) return

    const fromDom = readOtpDigitsFromInput("login-otp")
    const fromState = otpCode.replace(/\D/g, "").slice(0, 6)
    const digits = fromDom.length === 6 ? fromDom : fromState
    if (digits.length !== 6) return

    otpSubmitInFlightRef.current = true
    setIsProcessing(true)
    setServerError(null)
    try {
      const fd = new FormData()
      fd.set("email", normalizedEmail)
      fd.set("password", password)
      fd.set("code", digits)
      const result = await loginWithCredentials(fd)
      if (result && "error" in result && result.error) {
        setServerError(result.error)
        return
      }
      if (
        result &&
        "redirectTo" in result &&
        typeof result.redirectTo === "string"
      ) {
        router.push(result.redirectTo)
        router.refresh()
      }
    } finally {
      otpSubmitInFlightRef.current = false
      setIsProcessing(false)
    }
  }

  const handleOtpChange = useCallback((value: string) => {
    setOtpCode(value)
    setServerError(null)
  }, [])

  if (showTwoFactor) {
    return (
      <AuthScreen>
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="gap-0 pb-2 text-center sm:pb-4">
            <AuthBrandHeader
              title="Verify your identity"
              description="Open the authenticator entry you added for this email and type the current 6-digit code. You do not scan a QR when signing in—only the first time you set up 2FA."
            />
          </CardHeader>
          <CardContent>
            <form
              noValidate
              onSubmit={handleOtpSubmit}
              className="flex flex-col gap-6"
            >
              {serverError ? (
                <p
                  className="text-center text-sm text-destructive"
                  role="alert"
                >
                  {serverError}
                </p>
              ) : null}

              <div className="flex justify-center">
                <InputOTP
                  id="login-otp"
                  maxLength={6}
                  value={otpCode}
                  onChange={handleOtpChange}
                  disabled={isProcessing}
                  containerClassName="gap-2 sm:gap-3"
                  aria-label="6-digit authenticator code"
                >
                  <InputOTPGroup className="gap-2 sm:gap-3">
                    <InputOTPSlot index={0} className={otpSlotClassActive} />
                    <InputOTPSlot index={1} className={otpSlotClassActive} />
                    <InputOTPSlot index={2} className={otpSlotClassActive} />
                  </InputOTPGroup>
                  <InputOTPSeparator className="text-muted-foreground" />
                  <InputOTPGroup className="gap-2 sm:gap-3">
                    <InputOTPSlot index={3} className={otpSlotClassActive} />
                    <InputOTPSlot index={4} className={otpSlotClassActive} />
                    <InputOTPSlot index={5} className={otpSlotClassActive} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button
                type="submit"
                size="lg"
                className="h-11 w-full text-base font-medium"
                disabled={!otpComplete || isProcessing}
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

              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setShowTwoFactor(false)
                    resetOtp()
                  }}
                >
                  <ArrowLeft className="size-4 shrink-0" aria-hidden />
                  Back to sign in
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </AuthScreen>
    )
  }

  return (
    <AuthScreen>
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="gap-0 pb-2 text-center sm:pb-4">
          <AuthBrandHeader title="Login using your credentials" />
        </CardHeader>
        <CardContent>
          <form
            noValidate
            onSubmit={handlePasswordSubmit}
            className="flex flex-col gap-6"
          >
            {serverError ? (
              <p className="text-center text-sm text-destructive" role="alert">
                {serverError}
              </p>
            ) : null}

            <div className="flex flex-col gap-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">
                  Email
                </Label>
                <div className="relative">
                  <span className={iconWrap} aria-hidden>
                    <Mail className="size-4" />
                  </span>
                  <Input
                    id="email"
                    type="email"
                    name="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      setServerError(null)
                    }}
                    aria-invalid={emailFieldError}
                    aria-describedby={
                      emailFieldError ? "login-email-error" : undefined
                    }
                    className={cn(
                      "h-11 pl-10 text-base md:text-sm",
                      emailFieldError && "border-destructive"
                    )}
                  />
                </div>
                {emailFieldError ? (
                  <p
                    id="login-email-error"
                    className="text-sm text-destructive"
                    role="alert"
                  >
                    Enter a valid email address.
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="password" className="text-foreground">
                    Password
                  </Label>
                  <Link
                    href="/forgot-password"
                    className="text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <span className={iconWrap} aria-hidden>
                    <Lock className="size-4" />
                  </span>
                  <Input
                    id="password"
                    type={passwordVisible ? "text" : "password"}
                    name="password"
                    autoComplete="current-password"
                    placeholder="********"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setServerError(null)
                    }}
                    aria-invalid={passwordFieldError}
                    aria-describedby={
                      passwordFieldError ? "login-password-error" : undefined
                    }
                    className={cn(
                      "h-11 pr-11 pl-10 text-base md:text-sm",
                      passwordFieldError && "border-destructive"
                    )}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    aria-label={
                      passwordVisible ? "Hide password" : "Show password"
                    }
                    aria-pressed={passwordVisible}
                    onClick={() => setPasswordVisible((v) => !v)}
                  >
                    {passwordVisible ? (
                      <EyeOff className="size-4 shrink-0" aria-hidden />
                    ) : (
                      <Eye className="size-4 shrink-0" aria-hidden />
                    )}
                  </button>
                </div>
                {passwordFieldError ? (
                  <p
                    id="login-password-error"
                    className="text-sm text-destructive"
                    role="alert"
                  >
                    Password must be at least 8 characters.
                  </p>
                ) : null}
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              className="h-11 w-full text-base font-medium"
              disabled={!hasBothInputs || isProcessing}
              aria-busy={isProcessing}
            >
              {isProcessing ? (
                <>
                  <span>Signing in</span>
                  <LoaderCircle
                    className="size-5 shrink-0 animate-spin"
                    aria-hidden
                  />
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthScreen>
  )
}
