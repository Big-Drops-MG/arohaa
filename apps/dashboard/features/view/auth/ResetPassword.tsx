"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import type { FormEvent } from "react"
import { useMemo, useState } from "react"
import { Button } from "@workspace/ui/components/button"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@workspace/ui/components/input-otp"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"
import { Eye, EyeOff, LoaderCircle, Lock } from "lucide-react"

const CORRECT_TEST_OTP = "456789"

const loginFieldClass =
  "box-border flex h-12 max-w-full shrink-0 items-center gap-[15px] rounded-[10px] border border-[1px] px-[25px] opacity-100 shadow-none focus-within:border-black focus-within:ring-0 focus-within:shadow-none dark:focus-within:border-white"

const loginInputClass =
  "h-full min-h-0 min-w-0 flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:border-0 focus-visible:ring-0 focus-visible:shadow-none aria-invalid:border-0 aria-invalid:ring-0 aria-invalid:shadow-none dark:aria-invalid:border-0 dark:aria-invalid:ring-0 invalid:ring-0 invalid:shadow-none"

const baseOtpSlotClass =
  "h-[70px] w-[40px] rounded-[10px] border text-center text-lg font-medium shadow-none focus:outline-none focus:ring-0 data-[active=true]:ring-0 data-[active=true]:shadow-none"

const submitButtonClass =
  "mt-3 box-border flex h-12 w-full max-w-[360px] shrink-0 items-center justify-center gap-2 rounded-[10px] border p-3 text-base font-medium leading-none shadow-none"

export function ResetPassword() {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [newPasswordVisible, setNewPasswordVisible] = useState(false)
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false)
  const [code, setCode] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  const newPasswordValid = useMemo(
    () => newPassword.length === 0 || newPassword.length >= 8,
    [newPassword]
  )
  const passwordsMatch =
    confirmPassword.length === 0 || newPassword === confirmPassword

  const newPasswordFieldError = newPassword.length > 0 && !newPasswordValid
  const confirmPasswordFieldError =
    confirmPassword.length > 0 && !passwordsMatch

  const passwordsReady = useMemo(() => {
    return (
      newPassword.length >= 8 &&
      confirmPassword.length > 0 &&
      newPassword === confirmPassword
    )
  }, [newPassword, confirmPassword])

  const isComplete = code.length === 6
  const isCorrect = code === CORRECT_TEST_OTP
  const isWrong = isComplete && !isCorrect

  const canSubmit = passwordsReady && code.length === 6

  const otpSlotClass = cn(
    baseOtpSlotClass,
    isWrong
      ? "border-destructive focus:border-destructive data-[active=true]:border-destructive dark:border-destructive"
      : "border-black focus:border-black data-[active=true]:border-black dark:border-white dark:focus:border-white dark:data-[active=true]:border-white"
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!passwordsReady || code.length !== 6 || isProcessing) return

    setIsProcessing(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 500))
      if (code === CORRECT_TEST_OTP) {
        router.push("/ResetPasswordMsgScr")
      }
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-4">
      <Card className="w-full max-w-[408px]">
        <CardHeader className="pb-0">
          <div className="flex w-full flex-col items-center gap-3 text-center">
            <Image
              src="/Frame%2030.svg"
              alt="Company logo"
              width={161}
              height={58}
              className="shrink-0 object-contain"
              priority
            />
          </div>
        </CardHeader>
        <CardTitle className="text-center">Reset Password</CardTitle>
        <CardContent className="flex flex-col gap-6 pt-2">
          <div className="mx-auto flex w-[360px] max-w-full flex-col gap-[15px]">
            <div
              className={cn(
                loginFieldClass,
                "group/reset-new-password",
                newPasswordFieldError &&
                  "border-destructive focus-within:border-destructive dark:border-destructive dark:focus-within:border-destructive"
              )}
            >
              <Lock
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="new-password"
                type={newPasswordVisible ? "text" : "password"}
                name="newPassword"
                autoComplete="new-password"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                aria-invalid={newPasswordFieldError}
                className={cn(
                  loginInputClass,
                  newPasswordFieldError
                    ? "text-foreground"
                    : "text-muted-foreground group-focus-within/reset-new-password:text-foreground"
                )}
              />
              <button
                type="button"
                className="inline-flex shrink-0 rounded-sm text-muted-foreground transition-opacity outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label={
                  newPasswordVisible ? "Hide password" : "Show password"
                }
                aria-pressed={newPasswordVisible}
                onClick={() => setNewPasswordVisible((v) => !v)}
              >
                {newPasswordVisible ? (
                  <EyeOff className="size-4" aria-hidden />
                ) : (
                  <Eye className="size-4" aria-hidden />
                )}
              </button>
            </div>
            <div
              className={cn(
                loginFieldClass,
                "group/reset-confirm-password",
                confirmPasswordFieldError &&
                  "border-destructive focus-within:border-destructive dark:border-destructive dark:focus-within:border-destructive"
              )}
            >
              <Lock
                className="size-4 shrink-0 gap-5 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="confirm-password"
                type={confirmPasswordVisible ? "text" : "password"}
                name="confirmPassword"
                autoComplete="new-password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                aria-invalid={confirmPasswordFieldError}
                className={cn(
                  loginInputClass,
                  confirmPasswordFieldError
                    ? "text-foreground"
                    : "text-muted-foreground group-focus-within/reset-confirm-password:text-foreground"
                )}
              />
              <button
                type="button"
                className="inline-flex shrink-0 rounded-sm text-muted-foreground transition-opacity outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label={
                  confirmPasswordVisible ? "Hide password" : "Show password"
                }
                aria-pressed={confirmPasswordVisible}
                onClick={() => setConfirmPasswordVisible((v) => !v)}
              >
                {confirmPasswordVisible ? (
                  <EyeOff className="size-4" aria-hidden />
                ) : (
                  <Eye className="size-4" aria-hidden />
                )}
              </button>
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-[360px] flex-col items-center gap-5">
            <CardTitle className="text-center">
              Enter the code for verification
            </CardTitle>
            <form
              onSubmit={handleSubmit}
              className="flex w-full flex-col items-center gap-5"
            >
              <InputOTP
                maxLength={6}
                value={code}
                onChange={setCode}
                disabled={isProcessing || !passwordsReady}
              >
                <InputOTPGroup className="flex gap-[15px]">
                  <InputOTPSlot index={0} className={otpSlotClass} />
                  <InputOTPSlot index={1} className={otpSlotClass} />
                  <InputOTPSlot index={2} className={otpSlotClass} />
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup className="flex gap-[15px]">
                  <InputOTPSlot index={3} className={otpSlotClass} />
                  <InputOTPSlot index={4} className={otpSlotClass} />
                  <InputOTPSlot index={5} className={otpSlotClass} />
                </InputOTPGroup>
              </InputOTP>
              <Button
                type="submit"
                disabled={!canSubmit || isProcessing}
                aria-busy={isProcessing}
                className={submitButtonClass}
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
                  "Verify"
                )}
              </Button>
              {isWrong && (
                <p className="mt-2 text-center text-sm text-destructive">
                  Invalid code. Please try again.
                </p>
              )}
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
