"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, Controller } from "react-hook-form"
import * as z from "zod"
import { Eye, EyeOff, Loader2, Lock } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { OTPInput } from "@workspace/ui/components/otp-input"
import { authApi } from "@/lib/api/auth"
import { cn } from "@workspace/ui/lib/utils"

const resetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
  code: z.string().length(6, "Verification code must be 6 digits"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>

const Logo = () => (
  <div className="flex items-center gap-0.5 px-1">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="3" fill="#EF4444"/>
      <circle cx="12" cy="4" r="2" fill="#EF4444"/>
      <circle cx="12" cy="20" r="2" fill="#EF4444"/>
      <circle cx="4" cy="12" r="2" fill="#EF4444"/>
      <circle cx="20" cy="12" r="2" fill="#EF4444"/>
      <circle cx="6.34" cy="6.34" r="2" fill="#EF4444"/>
      <circle cx="17.66" cy="17.66" r="2" fill="#EF4444"/>
      <circle cx="6.34" cy="17.66" r="2" fill="#EF4444"/>
      <circle cx="17.66" cy="6.34" r="2" fill="#EF4444"/>
    </svg>
  </div>
)

export default function ResetPasswordPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = React.useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
      code: "",
    },
  })

  async function onSubmit(data: ResetPasswordValues) {
    setIsLoading(true)
    try {
      const response = await authApi.resetPassword(data.password, data.code)
      if (response.error) {
        toast.error(response.error)
      } else {
        router.push("/auth/reset-password/success")
      }
    } catch (error) {
      toast.error("An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F9FAFB] dark:bg-background px-4 py-12">
      <div className="w-full max-w-[400px] space-y-8">
        <div className="flex flex-col items-center text-center">
          <h1 className="text-2xl font-bold tracking-tight">Arohaa</h1>
          <div className="mt-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            by <Logo /> <span className="font-extrabold text-red-600">Big Drops MG</span>
          </div>
          <h2 className="mt-10 text-xl font-semibold">
            Reset Password
          </h2>
        </div>

        <Card className="border-none bg-white dark:bg-card shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <CardContent className="p-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-1">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="New Password"
                    disabled={isLoading}
                    className={cn(
                      "h-12 border-gray-200 pl-10 pr-10 focus:border-black focus:ring-0 dark:border-input dark:focus:border-primary placeholder:text-gray-400",
                      errors.password && "border-red-500 focus:border-red-500"
                    )}
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm Password"
                    disabled={isLoading}
                    className={cn(
                      "h-12 border-gray-200 pl-10 pr-10 focus:border-black focus:ring-0 dark:border-input dark:focus:border-primary placeholder:text-gray-400",
                      errors.confirmPassword && "border-red-500 focus:border-red-500"
                    )}
                    {...register("confirmPassword")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    disabled={isLoading}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-center text-xs font-medium text-foreground">
                  Enter Code for Verification
                </p>
                <Controller
                  name="code"
                  control={control}
                  render={({ field }) => (
                    <OTPInput
                      value={field.value}
                      onChange={field.onChange}
                      disabled={isLoading}
                    />
                  )}
                />
              </div>

              {(errors.password || errors.confirmPassword || errors.code) && (
                <p className="text-center text-xs text-red-500">
                  {errors.password?.message || errors.confirmPassword?.message || errors.code?.message}
                </p>
              )}

              <Button
                type="submit"
                className="h-12 w-full bg-[#1F2937] text-white hover:bg-[#111827] dark:bg-primary dark:text-primary-foreground font-medium"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Setting Password
                  </>
                ) : (
                  "Set Password"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
