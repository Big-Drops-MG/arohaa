"use client"

import { logout } from "@/actions/auth.actions"
import { replaceToAuthPath } from "@/lib/auth-navigation"
import { Button } from "@workspace/ui/components/button"
import { useState } from "react"

export function SignOutButton() {
  const [pending, setPending] = useState(false)

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      aria-busy={pending}
      onClick={() => {
        if (pending) return
        setPending(true)
        void logout()
          .then(() => replaceToAuthPath("/login", { trapBack: true }))
          .catch(() => {
            setPending(false)
            replaceToAuthPath("/login", { trapBack: true })
          })
      }}
    >
      Sign out
    </Button>
  )
}
