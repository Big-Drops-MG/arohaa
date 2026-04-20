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
    } catch (error) {
      toast.error("An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl font-bold">Arohaa</span>
          </div>
          <p className="text-sm text-muted-foreground">
            by <span className="font-semibold text-destructive">Big Drops MG</span>
          </p>
          <h2 className="mt-6 text-xl font-semibold tracking-tight">
            Enter Code for Verification
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter the code from your authenticator app
          </p>
        </div>

        <Card className="border-none shadow-lg">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
              <Button type="submit" className="w-full" disabled={isLoading || !isValid}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
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
