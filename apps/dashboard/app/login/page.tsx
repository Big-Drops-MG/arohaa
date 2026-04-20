"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Eye, EyeOff, Loader2, Mail, Lock } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { authApi } from "@/lib/api/auth"
import { cn } from "@workspace/ui/lib/utils"

const loginSchema = z.object({
  email: z.string().email("Invalid email or password. Please try again."),
  password: z.string().min(1, "Invalid email or password. Please try again."),
})

type LoginFormValues = z.infer<typeof loginSchema>

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

export default function LoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  async function onSubmit(data: LoginFormValues) {
    setIsLoading(true)
    try {
      const response = await authApi.login(data.email, data.password)
      if (response.error) {
        toast.error(response.error)
      } else if (response.requires2FA) {
        router.push("/auth/2fa")
      }
    } catch {
      toast.error("An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F9FAFB] dark:bg-background px-4 py-12">
      <div className="w-full max-w-[440px] space-y-[30px]">
        <div className="flex flex-col items-center text-center">
          <h1 className="text-2xl font-bold tracking-tight font-heading">Arohaa</h1>
          <div className="mt-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground font-sans">
            by <Logo /> <span className="font-extrabold text-red-600">Big Drops MG</span>
          </div>
          <h2 className="mt-10 text-xl font-semibold font-heading">
            Log in using your credentials
          </h2>
        </div>

        <Card className="border-none bg-white dark:bg-card shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <CardContent className="px-8 py-[30px]">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-[30px]">
              <div className="space-y-1">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Email"
                    type="email"
                    disabled={isLoading}
                    className={cn(
                      "h-12 border-gray-200 pl-10 focus:border-black focus:ring-0 dark:border-input dark:focus:border-primary placeholder:text-gray-400 font-sans",
                      errors.email && "border-red-500 focus:border-red-500"
                    )}
                    {...register("email")}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    disabled={isLoading}
                    className={cn(
                      "h-12 border-gray-200 pl-10 pr-10 focus:border-black focus:ring-0 dark:border-input dark:focus:border-primary placeholder:text-gray-400 font-sans",
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
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <div className="flex justify-end pt-1">
                  <Link
                    href="/auth/forgot-password"
                    className="text-[11px] text-muted-foreground hover:underline font-sans"
                  >
                    Forgot password?
                  </Link>
                </div>
              </div>

              {(errors.email || errors.password) && (
                <p className="text-center text-xs text-red-500 font-sans">
                  {errors.email?.message || errors.password?.message}
                </p>
              )}

              <Button
                type="submit"
                className="h-12 w-full bg-[#1F2937] text-white hover:bg-[#111827] dark:bg-primary dark:text-primary-foreground font-medium font-heading"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Logging in
                  </>
                ) : (
                  "Login"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
