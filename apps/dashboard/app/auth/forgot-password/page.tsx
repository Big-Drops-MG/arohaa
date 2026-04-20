"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Loader2, Mail, ArrowLeft } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { authApi } from "@/lib/api/auth"

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
})

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = React.useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  })

  async function onSubmit(data: ForgotPasswordValues) {
    setIsLoading(true)
    try {
      const response = await authApi.forgotPassword(data.email)
      if (response.error) {
        toast.error(response.error)
      } else {
        router.push("/auth/forgot-password/confirmation")
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
            Enter your email
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            We will send a password reset link to your email address
          </p>
        </div>

        <Card className="border-none shadow-lg">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    placeholder="admin@bigdropsmarketing.com"
                    type="email"
                    disabled={isLoading}
                    className="pl-10"
                    aria-invalid={!!errors.email}
                    {...register("email")}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Requesting...
                  </>
                ) : (
                  "Request Link"
                )}
              </Button>
              <div className="text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to login
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
