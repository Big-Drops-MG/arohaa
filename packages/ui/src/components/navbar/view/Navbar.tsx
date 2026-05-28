import * as React from "react"
import { Phone } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import type { NavbarContactButtonProps, NavbarProps } from "../model/types"
import { navbarVariants } from "../controller/navbar-variants"

const DEFAULT_CONTACT_BUTTON: NavbarContactButtonProps = {
  type: "1",
  variant: "default",
  size: "sm",
}

function Navbar({
  variant = "default",
  type = "1",
  logo,
  contactText = "Call us",
  contactHref = "#",
  contactLabel = "Contact",
  contactTextClassName,
  contactButton,
  showContactIcon = true,
  className,
  ...props
}: NavbarProps) {
  const btn = { ...DEFAULT_CONTACT_BUTTON, ...contactButton }
  const hasCustomClassName =
    btn.className != null && btn.className.trim() !== ""

  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      className={cn(
        navbarVariants({ variant, type: type as "1" | "2" }),
        className
      )}
      {...props}
    >
      {type === "2" ? (
        logo != null ? (
          <div className="shrink-0">{logo}</div>
        ) : null
      ) : (
        <>
          <div className="flex items-center gap-6">
            {logo != null ? <div className="shrink-0">{logo}</div> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={cn(
                "text-sm font-medium text-muted-foreground",
                contactTextClassName
              )}
            >
              {contactText}
            </span>
            <Button
              type={hasCustomClassName ? "6" : btn.type}
              variant={btn.variant}
              size={hasCustomClassName ? "default" : (btn.size ?? "sm")}
              backgroundColor={btn.backgroundColor}
              foregroundColor={btn.foregroundColor}
              className={cn(
                "inline-flex items-center gap-2",
                hasCustomClassName ? btn.className : undefined
              )}
              asChild
            >
              <a
                href={contactHref}
                aria-label={`${contactText}: ${contactLabel}`}
              >
                {showContactIcon ? (
                  <Phone className="size-4" aria-hidden />
                ) : null}
                {contactLabel}
              </a>
            </Button>
          </div>
        </>
      )}
    </nav>
  )
}

export { Navbar }
