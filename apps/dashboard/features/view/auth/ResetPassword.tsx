"use client"

import { submitResetPasswordAttempt } from "@/actions/reset-password.actions"
import { AuthBrandHeader, AuthScreen } from "./AuthScreen"
import type { FormEvent } from "react"
import { useMemo, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@workspace/ui/components/input-otp"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { cn } from "@workspace/ui/lib/utils"
import { Eye, EyeOff, LoaderCircle, Lock } from "lucide-react"

const iconWrap =
  "pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center text-muted-foreground"

const otpSlotBase =
  "relative flex size-11 items-center justify-center rounded-md border border-input bg-white text-lg font-medium text-neutral-900 shadow-xs transition-colors data-[active=true]:z-10 data-[active=true]:border-ring data-[active=true]:ring-3 data-[active=true]:ring-ring/50 sm:size-12 sm:text-xl"

export function ResetPassword() {
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [newPasswordVisible, setNewPasswordVisible] = useState(false)
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false)
  const [code, setCode] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [serverError, setServerError] = useState("")

  const newPasswordValid = newPassword.length === 0 || newPassword.length >= 8
  const passwordsMatch =
    confirmPassword.length === 0 || newPassword === confirmPassword

  const newPasswordFieldError = newPassword.length > 0 && !newPasswordValid
  const confirmPasswordFieldError =
    confirmPassword.length > 0 && !passwordsMatch

  const passwordsReady =
    newPassword.length >= 8 &&
    confirmPassword.length > 0 &&
    newPassword === confirmPassword

  const canSubmit = passwordsReady && code.length === 6

  const slotClass = useMemo(
    () => cn(otpSlotBase, !!serverError && "border-destructive"),
    [serverError]
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!passwordsReady || code.length !== 6 || isProcessing) return

    setIsProcessing(true)
    setServerError("")
    try {
      const result = await submitResetPasswordAttempt({
        code,
        newPassword,
        confirmPassword,
      })
      if (result?.error) {
        setServerError(result.error)
      }
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <AuthScreen>
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="gap-0 pb-2 text-center sm:pb-4">
          <AuthBrandHeader
            title="Reset password"
            description="Choose a new password, then enter the 6-digit verification code."
          />
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-8">
            <div className="flex flex-col gap-5">
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-foreground">
                  New password
                </Label>
                <div className="relative">
                  <span className={iconWrap} aria-hidden>
                    <Lock className="size-4" />
                  </span>
                  <Input
                    id="new-password"
                    type={newPasswordVisible ? "text" : "password"}
                    name="newPassword"
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    aria-invalid={newPasswordFieldError}
                    aria-describedby={
                      newPasswordFieldError
                        ? "reset-new-password-error"
                        : undefined
                    }
                    className={cn(
                      "h-11 pr-11 pl-10 text-base md:text-sm",
                      newPasswordFieldError && "border-destructive"
                    )}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    aria-label={
                      newPasswordVisible ? "Hide password" : "Show password"
                    }
                    aria-pressed={newPasswordVisible}
                    onClick={() => setNewPasswordVisible((v) => !v)}
                  >
                    {newPasswordVisible ? (
                      <EyeOff className="size-4 shrink-0" aria-hidden />
                    ) : (
                      <Eye className="size-4 shrink-0" aria-hidden />
                    )}
                  </button>
                </div>
                {newPasswordFieldError ? (
                  <p
                    id="reset-new-password-error"
                    className="text-sm text-destructive"
                    role="alert"
                  >
                    Password must be at least 8 characters.
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-foreground">
                  Confirm password
                </Label>
                <div className="relative">
                  <span className={iconWrap} aria-hidden>
                    <Lock className="size-4" />
                  </span>
                  <Input
                    id="confirm-password"
                    type={confirmPasswordVisible ? "text" : "password"}
                    name="confirmPassword"
                    autoComplete="new-password"
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    aria-invalid={confirmPasswordFieldError}
                    aria-describedby={
                      confirmPasswordFieldError
                        ? "reset-confirm-password-error"
                        : undefined
                    }
                    className={cn(
                      "h-11 pr-11 pl-10 text-base md:text-sm",
                      confirmPasswordFieldError && "border-destructive"
                    )}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    aria-label={
                      confirmPasswordVisible ? "Hide password" : "Show password"
                    }
                    aria-pressed={confirmPasswordVisible}
                    onClick={() => setConfirmPasswordVisible((v) => !v)}
                  >
                    {confirmPasswordVisible ? (
                      <EyeOff className="size-4 shrink-0" aria-hidden />
                    ) : (
                      <Eye className="size-4 shrink-0" aria-hidden />
                    )}
                  </button>
                </div>
                {confirmPasswordFieldError ? (
                  <p
                    id="reset-confirm-password-error"
                    className="text-sm text-destructive"
                    role="alert"
                  >
                    Passwords do not match.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-5">
              <div className="space-y-2">
                <Label
                  id="reset-otp-label"
                  htmlFor="reset-otp"
                  className="text-foreground"
                >
                  Verification code
                </Label>
                <div className="flex justify-center">
                  <InputOTP
                    id="reset-otp"
                    maxLength={6}
                    value={code}
                    onChange={setCode}
                    disabled={isProcessing || !passwordsReady}
                    containerClassName="gap-2 sm:gap-3"
                    aria-labelledby="reset-otp-label"
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
                {!passwordsReady ? (
                  <p className="text-center text-sm text-muted-foreground">
                    Enter matching passwords above to enable the code field.
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  type="submit"
                  size="lg"
                  className="h-11 w-full text-base font-medium"
                  disabled={!canSubmit || isProcessing}
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
                    "Reset password"
                  )}
                </Button>
                {serverError ? (
                  <p
                    className="text-center text-sm text-destructive"
                    role="alert"
                  >
                    {serverError}
                  </p>
                ) : null}
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </AuthScreen>
  )
}
