import { cva, type VariantProps } from "class-variance-authority"

export const navbarVariants = cva(
  "flex w-full items-center justify-between border-b border-border px-4 py-3 transition-colors",
  {
    variants: {
      variant: {
        default: "border-primary/20 bg-background",
        sticky:
          "sticky top-0 z-50 border-primary/30 bg-background/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/60",
      },
      type: {
        "1": "min-h-14 px-4 sm:px-6 md:px-8 [&>div:first-child]:flex-1 [&>div:first-child]:gap-4 [&>div:last-child]:ml-auto",
        "2": "min-h-14 justify-center px-4 sm:px-6 md:px-8 [&>div]:!flex-none",
      },
    },
    defaultVariants: {
      variant: "default",
      type: "1",
    },
  }
)

export type NavbarVariantsProps = VariantProps<typeof navbarVariants>
