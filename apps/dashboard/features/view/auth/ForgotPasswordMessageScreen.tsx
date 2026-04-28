import { AuthBrandHeader, AuthScreen } from "./AuthScreen"
import Link from "next/link"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card"

export function ForgotPasswordMessageScreen() {
  return (
    <AuthScreen>
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="gap-0 pb-2 text-center sm:pb-4">
          <AuthBrandHeader
            title="Check your email"
            description="If an account exists for that address, we sent a link to reset your password."
          />
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
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
