import * as React from "react"
import { cn } from "@workspace/ui/lib/utils"
import type { FooterLink, FooterProps } from "../model/types"
import { footerVariants } from "../controller/footer-variants"

function Footer({
  type = "long",
  linkHeader: _linkHeader,
  links = [],
  logo,
  description,
  copyrightText,
  disclaimer,
  bgColor,
  descriptionClassName,
  disclaimerClassName,
  className,
  ...props
}: FooterProps) {
  void _linkHeader
  const style = bgColor != null ? { backgroundColor: bgColor } : undefined

  return (
    <footer
      role="contentinfo"
      className={cn(footerVariants({ type }), className)}
      style={style}
      {...props}
    >
      <div className="flex flex-col items-center gap-6 text-center">
        {logo != null && <div className="shrink-0">{logo}</div>}
        {description != null && (
          <p
            className={cn(
              "max-w-md text-sm leading-relaxed text-white/90",
              descriptionClassName
            )}
          >
            {description}
          </p>
        )}
        {links.length > 0 && (
          <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1">
            {links.map((link: FooterLink) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="text-sm text-white/80 transition-colors hover:text-white"
                >
                  {link.text}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-col gap-4 border-t border-white/20 pt-6 text-center md:pt-8">
        {copyrightText != null && (
          <p className="text-xs text-white/80">{copyrightText}</p>
        )}
        {disclaimer != null && (
          <p
            className={cn(
              "mx-auto max-w-3xl text-xs leading-relaxed text-white/70",
              disclaimerClassName
            )}
          >
            {disclaimer}
          </p>
        )}
      </div>
    </footer>
  )
}

export { Footer }
