import type * as React from "react"

export type NavbarVariant = "default" | "sticky"

export type NavbarType = "1" | "2" | "3"
// TODO: Add more navbar types (4, 5, 6, ...) as design variants are defined

export interface NavbarItem {
  label: string
  href: string
  children?: NavbarItem[]
}

import type {
  ButtonSize,
  ButtonType,
  ButtonVariant,
} from "@workspace/ui/components/button"

export interface NavbarContactButtonProps {
  type?: ButtonType
  variant?: ButtonVariant
  size?: ButtonSize
  backgroundColor?: string
  foregroundColor?: string
  className?: string
}

export interface NavbarProps extends Omit<
  React.ComponentPropsWithoutRef<"nav">,
  "children"
> {
  variant?: NavbarVariant
  type?: NavbarType
  logo?: React.ReactNode
  contactText?: string
  contactHref?: string
  contactLabel?: string
  contactTextClassName?: string
  contactButton?: NavbarContactButtonProps
  showContactIcon?: boolean
  className?: string
}
