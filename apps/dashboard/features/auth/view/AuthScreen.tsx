import Image from "next/image"
import type { ReactNode } from "react"
import { CardDescription, CardTitle } from "@workspace/ui/components/card"

type AuthScreenProps = {
  children: ReactNode
}

export function AuthScreen({ children }: AuthScreenProps) {
  return (
    <div className="relative flex min-h-svh w-full flex-col items-center justify-center overflow-x-hidden bg-muted/30 px-4 py-10 sm:px-6 sm:py-12">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,color-mix(in_oklch,var(--foreground)_6%,transparent),transparent)]"
        aria-hidden
      />
      <div className="relative z-1 w-full max-w-md">{children}</div>
    </div>
  )
}

type AuthBrandHeaderProps = {
  title: string
  description?: string
}

export function AuthBrandHeader({ title, description }: AuthBrandHeaderProps) {
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <Image
        src="/auth-logo.svg"
        alt="Company logo"
        width={140}
        height={52}
        className="h-11 w-auto object-contain sm:h-12"
        priority
      />
      <div className="max-w-sm space-y-1.5">
        <CardTitle className="text-xl font-semibold tracking-tight text-balance sm:text-2xl">
          {title}
        </CardTitle>
        {description ? (
          <CardDescription className="text-sm leading-relaxed text-pretty sm:text-[15px]">
            {description}
          </CardDescription>
        ) : null}
      </div>
    </div>
  )
}
