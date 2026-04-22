"use client"

import { useRouter } from "next/navigation"
import { useCallback, useMemo, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardDescription,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"
import { LoaderCircle, Mail } from "lucide-react"

const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

const fieldClass =
  "box-border flex h-12 w-full max-w-full shrink-0 items-center gap-[15px] rounded-[10px] border border-[1px] px-[25px] opacity-100 shadow-none focus-within:border-black focus-within:ring-0 focus-within:shadow-none dark:focus-within:border-white"

const inputClass =
  "h-full min-h-0 min-w-0 flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:border-0 focus-visible:ring-0 focus-visible:shadow-none aria-invalid:border-0 aria-invalid:ring-0 aria-invalid:shadow-none dark:aria-invalid:border-0 dark:aria-invalid:ring-0 invalid:ring-0 invalid:shadow-none"

const submitButtonClass =
  "box-border flex h-12 w-full max-w-full shrink-0 items-center justify-center gap-[15px] rounded-[10px] border border-[1px] p-[25px] mt-[20px] text-base font-medium leading-none opacity-100 shadow-none"
export function ForgotPassword() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)

  const emailValid = useMemo(() => {
    const normalized = (email || "").trim().toLowerCase()
    return EMAIL_PATTERN.test(normalized)
  }, [email])

  const emailFieldError = submitAttempted && !emailValid

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (isProcessing) return
      if (!email.trim()) return
      if (!emailValid) {
        setSubmitAttempted(true)
        return
      }
      setIsProcessing(true)
      router.push("/MessageScreen")
    },
    [email, emailValid, isProcessing, router]
  )

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-4">
      <Card className="w-full max-w-[408px]">
        <CardHeader>
          <div className="flex w-full flex-col items-center gap-3 text-center">
            <img
              src="/Frame%2030.svg"
              alt="Company Logo"
              width={160.5347137451172}
              height={58}
              className="shrink-0 object-contain opacity-100"
              style={{
                width: "160.5347137451172px",
                height: "58px",
              }}
            />
            <CardTitle className="text-center text-[20px] font-bold">
              Enter your email
            </CardTitle>
            <CardDescription>
              You will receive password reset link in your email
            </CardDescription>
          </div>
        </CardHeader>
        <form noValidate onSubmit={handleSubmit}>
          <CardContent>
            <div className="mx-auto flex w-[360px] max-w-full flex-col gap-[15px]">
              <div
                className={cn(
                  fieldClass,
                  "group/forgot-email",
                  emailFieldError &&
                    "border-destructive focus-within:border-destructive dark:border-destructive dark:focus-within:border-destructive"
                )}
              >
                <Mail
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="forgot-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => {
                    const v = e.target.value
                    setEmail(v)
                    const ok = EMAIL_PATTERN.test(v.trim().toLowerCase())
                    if (ok) setSubmitAttempted(false)
                  }}
                  aria-invalid={emailFieldError}
                  className={cn(
                    inputClass,
                    emailFieldError
                      ? "text-foreground"
                      : "text-muted-foreground group-focus-within/forgot-email:text-foreground"
                  )}
                />
              </div>
              {emailFieldError ? (
                <p className="text-left text-sm text-destructive" role="alert">
                  Invalid email. Please try again
                </p>
              ) : null}
            </div>
          </CardContent>
          <CardFooter className="mx-auto flex max-w-full flex-col gap-[15px]">
            <Button
              type="submit"
              disabled={!email.trim() || isProcessing}
              aria-busy={isProcessing}
              className={cn(submitButtonClass)}
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
                "Request Link"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
