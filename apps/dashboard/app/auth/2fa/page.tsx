"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, Controller } from "react-hook-form"
import * as z from "zod"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
} from "@workspace/ui/components/card"
import { OTPInput } from "@workspace/ui/components/otp-input"
import { authApi } from "@/lib/api/auth"
import { useAuth } from "@/components/auth-provider"

const twoFactorSchema = z.object({
  code: z.string().length(6, "Verification code must be 6 digits"),
})

type TwoFactorValues = z.infer<typeof twoFactorSchema>

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

export default function TwoFactorPage() {
  const router = useRouter()
  const { setUser } = useAuth()
  const [isLoading, setIsLoading] = React.useState(false)

  const {
    control,
    handleSubmit,
    formState: { isValid },
  } = useForm<TwoFactorValues>({
    resolver: zodResolver(twoFactorSchema),
    defaultValues: {
      code: "",
    },
    mode: "onChange",
  })

  const onSubmit = async (data: TwoFactorValues) => {
    setIsLoading(true)
    try {
      const response = await authApi.verify2FA(data.code)
      if (response.error) {
        toast.error(response.error)
      } else if (response.user) {
        setUser(response.user)
        toast.success("Login successful!")
        router.push("/")
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
            Enter Code for Verification
          </h2>
          <p className="mt-2 text-sm text-muted-foreground font-sans">
            Enter the code from your authenticator app
          </p>
        </div>

        <Card className="border-none bg-white dark:bg-card shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <CardContent className="px-8 py-[30px]">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-[30px]">
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
              <Button
                type="submit"
                className="h-12 w-full bg-[#1F2937] text-white hover:bg-[#111827] dark:bg-primary dark:text-primary-foreground font-medium font-heading"
                disabled={isLoading || !isValid}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying
                  </>
                ) : (
                  "Verify"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
