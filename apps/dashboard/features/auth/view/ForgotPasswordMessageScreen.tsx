"use client"

import { AuthBrandHeader, AuthScreen } from "./AuthScreen"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useState } from "react"
import { requestPasswordReset } from "@/actions/forgot-password.actions"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card"
import { Loader2 } from "lucide-react"

export function ForgotPasswordMessageScreen() {
  const searchParams = useSearchParams()
  const emailParam = (searchParams.get("email") ?? "").trim().toLowerCase()
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState("")
  const [sent, setSent] = useState(false)

  async function handleResend() {
    if (!emailParam || isSending) return
    setIsSending(true)
    setError("")
    setSent(false)

    const result = await requestPasswordReset(emailParam)
    setIsSending(false)
    if (result.error) {
      setError(result.error)
      return
    }

    setSent(true)
  }

  return (
    <AuthScreen>
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="gap-0 pb-2 text-center sm:pb-4">
          <AuthBrandHeader
            title="Check your email"
            description="Click Send Resend Link to send a password reset email."
          />
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <Button
            size="lg"
            className="h-11 w-full text-base font-medium"
            onClick={handleResend}
            disabled={!emailParam || isSending}
          >
            {isSending ? <Loader2 className="size-4 animate-spin" /> : null}
            {isSending ? "Sending..." : "Send Resend Link"}
          </Button>
          {sent ? (
            <p className="text-sm text-green-600">
              Reset link sent successfully.
            </p>
          ) : null}
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button
            asChild
            size="lg"
            className="h-11 w-full text-base font-medium"
          >
            <Link href="/login">Back to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    </AuthScreen>
  )
}
