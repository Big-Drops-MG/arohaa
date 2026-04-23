"use client"

import { AuthBrandHeader, AuthScreen } from "./AuthScreen"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { FormEvent } from "react"
import { useState } from "react"
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

const DEFAULT_OTP = "456789"

const otpSlotClass =
  "relative flex size-11 items-center justify-center rounded-md border border-input bg-white text-lg font-medium text-neutral-900 shadow-xs transition-colors data-[active=true]:z-10 data-[active=true]:border-ring data-[active=true]:ring-3 data-[active=true]:ring-ring/50 sm:size-12 sm:text-xl"

export function GoogleAuthenticatorScreen() {
  const [code, setCode] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const router = useRouter()

  const isComplete = code.length === 6
  const isWrong = isComplete && code !== DEFAULT_OTP
  const slotClass = cn(otpSlotClass, isWrong && "border-destructive")

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isComplete || isProcessing) return
    setIsProcessing(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 500))
      if (code === DEFAULT_OTP) {
        router.push("/dashboard")
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
            title="Verify your identity"
            description="Enter the 6-digit code from your authenticator app."
          />
        </CardHeader>
        <CardContent>
          <form
            noValidate
            onSubmit={handleSubmit}
            className="flex flex-col gap-6"
          >
            <div className="flex justify-center">
              <InputOTP
                id="ga-otp"
                maxLength={6}
                value={code}
                onChange={setCode}
                disabled={isProcessing}
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
                disabled={!isComplete || isProcessing}
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
              {isWrong ? (
                <p
                  className="text-center text-sm text-destructive"
                  role="alert"
                >
                  That code did not match. Please try again.
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
