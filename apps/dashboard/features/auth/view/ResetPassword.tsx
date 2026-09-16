"use client"

import { submitResetPasswordAttempt } from "@/actions/reset-password.actions"
import { AuthBrandHeader, AuthScreen } from "./AuthScreen"
import type { FormEvent } from "react"
import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { cn } from "@workspace/ui/lib/utils"
import { Eye, EyeOff, LoaderCircle, Lock } from "lucide-react"

const iconWrap =
  "pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center text-muted-foreground"

export function ResetPassword() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")?.trim() ?? ""

  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [newPasswordVisible, setNewPasswordVisible] = useState(false)
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false)
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

  const canSubmit = passwordsReady && Boolean(token)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit || isProcessing) return

    setIsProcessing(true)
    setServerError("")
    try {
      const result = await submitResetPasswordAttempt({
        token,
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
            description={
              token
                ? "Choose a new password for your account."
                : "Open the reset link from your email to continue."
            }
          />
        </CardHeader>
        <CardContent>
          {!token ? (
            <p className="text-center text-sm text-destructive" role="alert">
              This reset link is missing or invalid. Request a new one from the
              forgot password page.
            </p>
          ) : (
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
                        confirmPasswordVisible
                          ? "Hide password"
                          : "Show password"
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
                      <span>Saving</span>
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
            </form>
          )}
        </CardContent>
      </Card>
    </AuthScreen>
  )
}
