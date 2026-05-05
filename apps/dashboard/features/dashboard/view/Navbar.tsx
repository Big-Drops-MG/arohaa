import Image from "next/image"
import { Bell, CircleUserRound, LogOut, User } from "lucide-react"
import Link from "next/link"
import { logout } from "@/actions/auth.actions"
import { Button } from "@workspace/ui/components/button"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@workspace/ui/components/popover"

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
    <header className="flex h-16 items-center justify-between border-b border-border bg-background px-4 sm:px-6 lg:px-8">
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
      <div className="flex items-center gap-2 sm:gap-3">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9 rounded-full border-border"
              aria-label="Notifications"
            >
              <Bell className="size-4" aria-hidden />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-4">
            <PopoverHeader className="gap-1 p-0">
              <PopoverTitle className="text-sm">Notifications</PopoverTitle>
              <PopoverDescription>
                No new notifications right now.
              </PopoverDescription>
            </PopoverHeader>
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Open profile menu"
            >
              <div className="flex size-9 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white">
                {initials}
              </div>
              <div className="hidden text-left sm:block">
                <p className="text-sm leading-tight font-semibold text-foreground">
                  {fullName}
                </p>
                <p className="text-xs text-muted-foreground">{role}</p>
              </div>
              <CircleUserRound
                className="size-4 text-muted-foreground sm:hidden"
                aria-hidden
              />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-48 p-2">
            <div className="flex flex-col gap-0.5">
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="justify-start px-2.5"
              >
                <Link href="/dashboard/profile">
                  <User className="size-4" aria-hidden />
                  Profile
                </Link>
              </Button>
              <form action={logout}>
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start px-2.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <LogOut className="size-4" aria-hidden />
                  Logout
                </Button>
              </form>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  )
}
