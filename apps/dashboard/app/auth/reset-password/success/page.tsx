import Link from "next/link"
import { CheckCircle2 } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
} from "@workspace/ui/components/card"

export default function SuccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl font-bold">Arohaa</span>
          </div>
          <p className="text-sm text-muted-foreground">
            by <span className="font-semibold text-destructive">Big Drops MG</span>
          </p>
        </div>

        <Card className="border-none shadow-lg">
          <CardContent className="pt-8 pb-8 flex flex-col items-center">
            <div className="rounded-full bg-green-100 p-3 mb-4 dark:bg-green-900/20">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-semibold tracking-tight mb-2">
              Password Reset Successful
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Your password has been successfully reset. You can now log in with your new credentials.
            </p>
            <Button asChild className="w-full">
              <Link href="/login">Go to Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
