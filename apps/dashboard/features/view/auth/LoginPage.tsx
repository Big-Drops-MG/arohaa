"use client"

import { GoogleAuthenticatorScreen } from "./GoogleAuthenticatorScreen"
import { AuthBrandHeader, AuthScreen } from "./AuthScreen"
import Link from "next/link"
import type { FormEvent } from "react"
import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { cn } from "@workspace/ui/lib/utils"
import { Eye, EyeOff, LoaderCircle, Lock, Mail } from "lucide-react"

const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

const iconWrap =
  "pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center text-muted-foreground"

export function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showOtp, setShowOtp] = useState(false)

  const trimmedEmail = email.trim()
  const normalizedEmail = trimmedEmail.toLowerCase()
  const emailValid = EMAIL_PATTERN.test(normalizedEmail)
  const passwordValid = password.length >= 8
  const canSubmit = emailValid && passwordValid
  const hasBothInputs = trimmedEmail.length > 0 && password.length > 0

  const emailFieldError = submitAttempted && !emailValid
  const passwordFieldError = submitAttempted && !passwordValid

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!hasBothInputs || isProcessing) return
    setSubmitAttempted(true)
    if (!canSubmit) return
    setIsProcessing(true)
    window.setTimeout(() => {
      setIsProcessing(false)
      setShowOtp(true)
    }, 1000)
  }

  if (showOtp) {
    return <GoogleAuthenticatorScreen />
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
            onSubmit={handleSubmit}
            className="flex flex-col gap-6"
          >
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
                    onChange={(e) => setEmail(e.target.value)}
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
                    onChange={(e) => setPassword(e.target.value)}
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
