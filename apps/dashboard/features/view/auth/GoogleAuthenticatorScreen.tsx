"use client"
import { useRouter } from "next/navigation"
import Image from "next/image"
import type { FormEvent } from "react"
import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@workspace/ui/components/input-otp"
import { LoaderCircle } from "lucide-react"

const baseOtpSlotClass =
  "h-[70px] w-[47.5px] rounded-[10px] border border-black text-center text-lg font-medium focus:outline-none focus:border-black focus:ring-0 focus:shadow-none shadow-none data-[active=true]:border-black data-[active=true]:ring-0 data-[active=true]:shadow-none"
const submitButtonClass =
  "mt-3 box-border flex h-12 w-full max-w-[360px] shrink-0 items-center justify-center gap-2 rounded-[10px] border p-3 text-base font-medium leading-none shadow-none"

export function GoogleAuthenticatorScreen() {
  const [code, setCode] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const router = useRouter()
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (code.length !== 6 || isProcessing) return

    setIsProcessing(true)

    try {
      await new Promise((resolve) => setTimeout(resolve, 500))

      if (code === "456789") {
        router.push("/Homepage")
        return
      }
    } finally {
      setIsProcessing(false)
    }
  }

  const DEFAULT_OTP = "456789"
  const isComplete = code.length === 6
  const isCorrect = code === DEFAULT_OTP
  const isWrong = isComplete && !isCorrect
  const getOtpClass = () => {
    if (isWrong) return `${baseOtpSlotClass} border-red-500`
    return `${baseOtpSlotClass} border-black`
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-4">
      <Card className="w-full max-w-[408px]">
        <CardHeader>
          <div className="flex w-full flex-col items-center gap-3 text-center">
            <Image
              src="/Frame%2030.svg"
              alt="Company logo"
              width={161}
              height={58}
              className="shrink-0 object-contain"
              priority
            />
            <CardTitle className="text-center text-[20px] font-bold">
              Enter Code for verification
            </CardTitle>
            <CardDescription>
              Enter the code from your authenticator app
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col items-center">
            <InputOTP
              maxLength={6}
              value={code}
              onChange={setCode}
              disabled={isProcessing}
            >
              <InputOTPGroup className="flex gap-[15px]">
                <InputOTPSlot index={0} className={getOtpClass()} />
                <InputOTPSlot index={1} className={getOtpClass()} />
                <InputOTPSlot index={2} className={getOtpClass()} />
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup className="flex gap-[15px]">
                <InputOTPSlot index={3} className={getOtpClass()} />
                <InputOTPSlot index={4} className={getOtpClass()} />
                <InputOTPSlot index={5} className={getOtpClass()} />
              </InputOTPGroup>
            </InputOTP>
            <Button
              type="submit"
              disabled={code.length !== 6 || isProcessing}
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
              <p className="mt-2 text-sm text-red-500">
                Invalid code. Please try again.
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
