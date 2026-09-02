"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, type FormEvent } from "react"
import { acceptExternalMemberInvite } from "@/actions/accept-external-invite.actions"
import { AuthBrandHeader, AuthScreen } from "@/features/auth/view/AuthScreen"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { cn } from "@workspace/ui/lib/utils"
import { Eye, EyeOff, LoaderCircle, Lock } from "lucide-react"

const iconWrap =
  "pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center text-muted-foreground"

export function AcceptExternalInvite() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")?.trim() ?? ""

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [confirmVisible, setConfirmVisible] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [serverError, setServerError] = useState("")

  useEffect(() => {
    if (!token) {
      setServerError("Invite link is invalid or expired.")
    }
  }, [token])

  const passwordValid = password.length === 0 || password.length >= 12
  const passwordsMatch =
    confirmPassword.length === 0 || password === confirmPassword
  const canSubmit =
    token.length > 0 &&
    password.length >= 12 &&
    confirmPassword.length >= 12 &&
    password === confirmPassword

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit || isProcessing) return

    setIsProcessing(true)
    setServerError("")
    try {
      const result = await acceptExternalMemberInvite({
        token,
        password,
        confirmPassword,
      })
      if (result.error) {
        setServerError(result.error)
        return
      }
      router.push("/login?invite=accepted")
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <AuthScreen>
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="gap-0 pb-2 text-center sm:pb-4">
          <AuthBrandHeader
            title="Set your password"
            description="Choose a password for your Arohaa partner account, then sign in to finish authenticator setup."
          />
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="space-y-2">
              <Label htmlFor="invite-password">Password</Label>
              <div className="relative">
                <span className={iconWrap} aria-hidden>
                  <Lock className="size-4" />
                </span>
                <Input
                  id="invite-password"
                  type={passwordVisible ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={cn(
                    "h-11 pr-11 pl-10",
                    !passwordValid &&
                      password.length > 0 &&
                      "border-destructive"
                  )}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground"
                  onClick={() => setPasswordVisible((v) => !v)}
                >
                  {passwordVisible ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-confirm-password">Confirm password</Label>
              <div className="relative">
                <span className={iconWrap} aria-hidden>
                  <Lock className="size-4" />
                </span>
                <Input
                  id="invite-confirm-password"
                  type={confirmVisible ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={cn(
                    "h-11 pr-11 pl-10",
                    !passwordsMatch &&
                      confirmPassword.length > 0 &&
                      "border-destructive"
                  )}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground"
                  onClick={() => setConfirmVisible((v) => !v)}
                >
                  {confirmVisible ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              className="h-11 w-full"
              disabled={!canSubmit || isProcessing}
            >
              {isProcessing ? (
                <>
                  Saving
                  <LoaderCircle className="size-5 animate-spin" />
                </>
              ) : (
                "Continue to sign in"
              )}
            </Button>

            {serverError ? (
              <p className="text-center text-sm text-destructive" role="alert">
                {serverError}
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </AuthScreen>
  )
}
