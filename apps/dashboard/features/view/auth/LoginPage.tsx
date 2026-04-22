"use client"
import { GoogleAuthenticatorScreen } from "./GoogleAuthenticatorScreen"
import { useCallback, useMemo, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"
import { Eye, EyeOff, LoaderCircle, Lock, Mail } from "lucide-react"

const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

const loginFieldClass =
  "box-border flex h-12 max-w-full shrink-0 items-center gap-[15px] rounded-[10px] border border-[1px] px-[25px] opacity-100 shadow-none focus-within:border-black focus-within:ring-0 focus-within:shadow-none dark:focus-within:border-white"

const loginInputClass =
  "h-full min-h-0 min-w-0 flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:border-0 focus-visible:ring-0 focus-visible:shadow-none aria-invalid:border-0 aria-invalid:ring-0 aria-invalid:shadow-none dark:aria-invalid:border-0 dark:aria-invalid:ring-0 invalid:ring-0 invalid:shadow-none"

const loginSubmitButtonClass =
  "box-border flex h-12 w-[360px] max-w-full shrink-0 items-center justify-center gap-[15px] rounded-[10px] border border-[1px] p-[25px] mt-[12px] text-base font-medium leading-none opacity-100 shadow-none"
export function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showOtp, setShowOtp] = useState(false)

  const { emailValid, passwordValid, canSubmit, hasBothInputs } =
    useMemo(() => {
      const trimmedEmail = (email || "").trim()
      const normalizedEmail = trimmedEmail.toLowerCase()
      const validEmail = EMAIL_PATTERN.test(normalizedEmail)
      const validPassword = password.length >= 8
      return {
        emailValid: validEmail,
        passwordValid: validPassword,
        canSubmit: validEmail && validPassword,
        hasBothInputs: trimmedEmail.length > 0 && password.length > 0,
      }
    }, [email, password])

  const emailFieldError = submitAttempted && !emailValid
  const passwordFieldError = submitAttempted && !passwordValid
  const showCredentialsError = submitAttempted && !canSubmit

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!hasBothInputs || isProcessing) return
      setSubmitAttempted(true)
      if (!canSubmit) return
      setIsProcessing(true)

      setTimeout(() => {
        setIsProcessing(false)
        setShowOtp(true)
      }, 1000)
    },
    [canSubmit, hasBothInputs, isProcessing]
  )
  if (showOtp) {
    return <GoogleAuthenticatorScreen />
  }
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
              Log in using your credentials
            </CardTitle>
          </div>
        </CardHeader>
        <form noValidate onSubmit={handleSubmit}>
          <CardContent>
            <div className="mx-auto flex w-[360px] max-w-full flex-col gap-[15px]">
              <div
                className={cn(
                  loginFieldClass,
                  "group/login-email",
                  emailFieldError &&
                    "border-destructive focus-within:border-destructive dark:border-destructive dark:focus-within:border-destructive"
                )}
              >
                <Mail
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={emailFieldError}
                  className={cn(
                    loginInputClass,
                    emailFieldError
                      ? "text-foreground"
                      : "text-muted-foreground group-focus-within/login-email:text-foreground"
                  )}
                />
              </div>
              <div
                className={cn(
                  loginFieldClass,
                  "group/login-password",
                  passwordFieldError &&
                    "border-destructive focus-within:border-destructive dark:border-destructive dark:focus-within:border-destructive"
                )}
              >
                <Lock
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="password"
                  type={passwordVisible ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={passwordFieldError}
                  className={cn(
                    loginInputClass,
                    passwordFieldError
                      ? "text-foreground"
                      : "text-muted-foreground group-focus-within/login-password:text-foreground"
                  )}
                />
                <button
                  type="button"
                  className="inline-flex shrink-0 rounded-sm text-muted-foreground transition-opacity outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  aria-label={
                    passwordVisible ? "Hide password" : "Show password"
                  }
                  aria-pressed={passwordVisible}
                  onClick={() => setPasswordVisible((v) => !v)}
                >
                  {passwordVisible ? (
                    <EyeOff className="size-4" aria-hidden />
                  ) : (
                    <Eye className="size-4" aria-hidden />
                  )}
                </button>
              </div>
              {showCredentialsError ? (
                <p className="text-left text-sm text-destructive" role="alert">
                  Invalid email or password. Please try again!
                </p>
              ) : null}
              <div className="flex justify-end">
                <a
                  href="/ForgotPassword"
                  className="text-sm underline-offset-4 hover:underline"
                >
                  Forgot password?
                </a>
              </div>
            </div>
          </CardContent>
          <CardFooter className="mx-auto flex w-[410px] max-w-full flex-col gap-[15px]">
            <Button
              type="submit"
              disabled={!hasBothInputs || isProcessing}
              aria-busy={isProcessing}
              className={cn(loginSubmitButtonClass)}
            >
              {isProcessing ? (
                <>
                  <span>Logging in</span>
                  <LoaderCircle
                    className="size-5 shrink-0 animate-spin"
                    aria-hidden
                  />
                </>
              ) : (
                "Login"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
