import { logout } from "@/actions/auth.actions"
import { Button } from "@workspace/ui/components/button"

export function SignOutButton() {
  return (
    <form action={logout}>
      <Button type="submit" variant="outline" size="sm">
        Sign out
      </Button>
    </form>
  )
}
