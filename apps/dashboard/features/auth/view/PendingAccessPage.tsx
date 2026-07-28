import { AuthBrandHeader, AuthScreen } from "@/features/auth/view/AuthScreen"
import { SignOutButton } from "@/components/sign-out-button"
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card"

type PendingAccessPageProps = {
  status: "pending" | "rejected"
}

export function PendingAccessPage({ status }: PendingAccessPageProps) {
  const rejected = status === "rejected"

  return (
    <AuthScreen>
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="gap-3 pb-2 text-center sm:pb-4">
          <AuthBrandHeader
            title={rejected ? "Request rejected" : "Access pending"}
            description={
              rejected
                ? "Your request to join Arohaa was rejected. You do not have access to the dashboard."
                : "Your profile is complete. An existing team member must accept your request before you can use Arohaa."
            }
          />
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {!rejected ? (
            <p className="text-center text-sm text-muted-foreground">
              You will receive an email when your request is accepted or
              rejected. You can close this page and come back later.
            </p>
          ) : null}
          <SignOutButton />
        </CardContent>
      </Card>
    </AuthScreen>
  )
}
