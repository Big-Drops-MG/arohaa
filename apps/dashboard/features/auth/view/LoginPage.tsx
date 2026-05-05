"use client"

import {
  loginWithCredentials,
  verifyTwoFactorCode,
} from "@/actions/auth.actions"
import { resolveOtpDigits, shouldAutoSubmitOtp } from "../controller/otp"
import { isOtpComplete } from "../model/otp"
import { signIn } from "next-auth/react"
import { AuthBrandHeader, AuthScreen } from "./AuthScreen"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import type { FormEvent } from "react"
import { useCallback, useEffect, useRef, useState } from "react"
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

export function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requiresTwoFactorParam =
    searchParams.get("requiresTwoFactor") === "true"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [otpCode, setOtpCode] = useState("")
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isGoogleProcessing, setIsGoogleProcessing] = useState(false)
  const [showTwoFactor, setShowTwoFactor] = useState(requiresTwoFactorParam)
  const [serverError, setServerError] = useState<string | null>(null)
  const otpSubmitInFlightRef = useRef(false)

  useEffect(() => {
    if (requiresTwoFactorParam) {
      setShowTwoFactor(true)
    }
  }, [requiresTwoFactorParam])

  const trimmedEmail = email.trim()
  const normalizedEmail = trimmedEmail.toLowerCase()
  const emailValid = EMAIL_PATTERN.test(normalizedEmail)
  const passwordValid = password.length >= 8
  const canSubmitPassword = emailValid && passwordValid
  const hasBothInputs = trimmedEmail.length > 0 && password.length > 0
  const otpComplete = isOtpComplete(otpCode)

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
    if (!hasBothInputs || isProcessing || isGoogleProcessing) return
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
    await submitOtp()
  }

  const submitOtp = useCallback(async () => {
    if (otpSubmitInFlightRef.current) return

    const digits = resolveOtpDigits(otpCode)
    if (digits.length !== 6) return

    otpSubmitInFlightRef.current = true
    setIsProcessing(true)
    setServerError(null)
    try {
      if (email && password) {
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
      } else {
        const result = await verifyTwoFactorCode(digits)
        if (result.error) {
          setServerError(result.error)
          return
        }
        if (result.success) {
          router.push("/dashboard")
          router.refresh()
        }
      }
    } finally {
      otpSubmitInFlightRef.current = false
      setIsProcessing(false)
    }
  }, [email, normalizedEmail, otpCode, password, router])

  useEffect(() => {
    if (shouldAutoSubmitOtp(otpCode, { enabled: showTwoFactor })) {
      void submitOtp()
    }
  }, [otpCode, showTwoFactor, submitOtp])

  const handleOtpChange = useCallback((value: string) => {
    setOtpCode(value)
    setServerError(null)
  }, [])

  const handleGoogleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isProcessing || isGoogleProcessing) return
    setIsGoogleProcessing(true)
    try {
      await signIn("google", { callbackUrl: "/dashboard" })
    } catch {
      setIsGoogleProcessing(false)
    }
  }

  if (showTwoFactor) {
    return (
      <AuthScreen>
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="gap-0 pb-2 text-center sm:pb-4">
            <AuthBrandHeader
              title="Verify your identity"
              description="Open your authenticator app and enter the current code."
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
                      className="ml-2 size-5 shrink-0 animate-spin"
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
          <AuthBrandHeader title="Sign in to Dashboard" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-6">
            <form onSubmit={handleGoogleLogin}>
              <Button
                type="submit"
                size="lg"
                variant="outline"
                className="h-11 w-full text-base font-medium"
                disabled={isProcessing || isGoogleProcessing}
                aria-busy={isGoogleProcessing}
              >
                {isGoogleProcessing ? (
                  <>
                    <span>Signing in...</span>
                    <LoaderCircle
                      className="ml-2 size-5 shrink-0 animate-spin"
                      aria-hidden
                    />
                  </>
                ) : (
                  <div className="flex w-full items-center justify-center gap-3">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 48 48"
                      className="size-5"
                    >
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      ></path>
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      ></path>
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      ></path>
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      ></path>
                    </svg>
                    <span>Sign in with Google</span>
                  </div>
                )}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>

            <form
              noValidate
              onSubmit={handlePasswordSubmit}
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
                      disabled={isProcessing || isGoogleProcessing}
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
                      disabled={isProcessing || isGoogleProcessing}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      aria-label={
                        passwordVisible ? "Hide password" : "Show password"
                      }
                      aria-pressed={passwordVisible}
                      onClick={() => setPasswordVisible((v) => !v)}
                      disabled={isProcessing || isGoogleProcessing}
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
                disabled={!hasBothInputs || isProcessing || isGoogleProcessing}
                aria-busy={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <span>Signing in...</span>
                    <LoaderCircle
                      className="ml-2 size-5 shrink-0 animate-spin"
                      aria-hidden
                    />
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            </form>

            <p className="mt-2 text-center text-sm text-muted-foreground">
              Only authorized{" "}
              <span className="font-medium text-foreground">
                @bigdropsmarketing.com
              </span>{" "}
              accounts can access the dashboard.
            </p>
          </div>
        </CardContent>
      </Card>
    </AuthScreen>
  )
}
