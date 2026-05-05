"use client"

import { AuthBrandHeader, AuthScreen } from "./AuthScreen"
import Link from "next/link"
import type { FormEvent } from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { cn } from "@workspace/ui/lib/utils"
import { ArrowLeft, Mail } from "lucide-react"

const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

const iconWrap =
  "pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center text-muted-foreground"

export function ForgotPassword() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [submitAttempted, setSubmitAttempted] = useState(false)

  const normalized = email.trim().toLowerCase()
  const emailValid = EMAIL_PATTERN.test(normalized)
  const emailFieldError = submitAttempted && !emailValid

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!email.trim()) return
    if (!emailValid) {
      setSubmitAttempted(true)
      return
    }
    router.push("/forgot-password/sent")
  }

  return (
    <AuthScreen>
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="gap-0 pb-2 text-center sm:pb-4">
          <AuthBrandHeader
            title="Forgot password"
            description="We will email you a link to reset your password."
          />
        </CardHeader>
        <CardContent>
          <form
            noValidate
            onSubmit={handleSubmit}
            className="flex flex-col gap-6"
          >
            <div className="space-y-2">
              <Label htmlFor="forgot-email" className="text-foreground">
                Email
              </Label>
              <div className="relative">
                <span className={iconWrap} aria-hidden>
                  <Mail className="size-4" />
                </span>
                <Input
                  id="forgot-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => {
                    const v = e.target.value
                    setEmail(v)
                    if (EMAIL_PATTERN.test(v.trim().toLowerCase())) {
                      setSubmitAttempted(false)
                    }
                  }}
                  aria-invalid={emailFieldError}
                  aria-describedby={
                    emailFieldError ? "forgot-email-error" : undefined
                  }
                  className={cn(
                    "h-11 pl-10 text-base md:text-sm",
                    emailFieldError && "border-destructive"
                  )}
                />
              </div>
              {emailFieldError ? (
                <p
                  id="forgot-email-error"
                  className="text-sm text-destructive"
                  role="alert"
                >
                  Enter a valid email address.
                </p>
              ) : null}
            </div>

            <Button
              type="submit"
              size="lg"
              className="h-11 w-full text-base font-medium"
              disabled={!email.trim()}
            >
              Send reset link
            </Button>

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
