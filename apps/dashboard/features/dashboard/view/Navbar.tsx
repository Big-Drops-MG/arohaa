import Image from "next/image"
import { Bell, CircleUserRound } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

type NavbarProps = {
  firstName: string
  lastName: string
  role: string
}

function buildInitials(firstName: string, lastName: string): string {
  const first = firstName.trim().charAt(0)
  const last = lastName.trim().charAt(0)
  return `${first}${last}`.trim().toUpperCase() || "DU"
}

export function Navbar({ firstName, lastName, role }: NavbarProps) {
  const fullName = `${firstName} ${lastName}`.trim()
  const initials = buildInitials(firstName, lastName)

  return (
    <header className="flex items-center justify-between border-b border-border bg-background px-4 py-3 sm:px-6">
      <div className="flex items-center">
        <Image
          src="/main-logo.svg"
          alt="Arohaa brand logo"
          width={138}
          height={40}
          className="h-10 w-auto object-contain"
          priority
        />
      </div>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-9 rounded-full"
          aria-label="Notifications"
        >
          <Bell className="size-4" aria-hidden />
        </Button>
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white">
            {initials}
          </div>
          <div className="hidden text-left sm:block">
            <p className="text-sm leading-none font-semibold text-foreground">
              {fullName}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{role}</p>
          </div>
          <CircleUserRound className="size-4 text-muted-foreground sm:hidden" />
        </div>
      </div>
    </header>
  )
}
