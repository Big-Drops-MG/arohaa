import { cva, type VariantProps } from "class-variance-authority"

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "rounded-md bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        destructive:
          "rounded-md bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20",
        outline:
          "rounded-md border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground",
        secondary:
          "rounded-md bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost: "rounded-md hover:bg-accent hover:text-accent-foreground",
        link: "rounded-none text-primary underline-offset-4 hover:underline",
      },
      type: {
        "1": "h-9 px-4 py-2 has-[>svg]:px-3",
        "2": "size-9 rounded-md p-0 [&>svg]:size-4",
        "3": "h-9 rounded-full px-4 py-2 has-[>svg]:px-3",
        "4": "h-9 w-9 rounded-none p-0 [&>svg]:size-4",
        "5": "h-auto min-h-0 rounded-none px-0 py-0 underline-offset-4 hover:underline",
        "6": "min-h-9 px-0 py-0",
      },
      size: {
        default: "",
        sm: "h-8 gap-1.5 px-3 text-xs has-[>svg]:px-2.5 [&.size-9]:size-8 [&[data-btn-type=icon]]:size-8",
        lg: "h-10 px-6 text-base has-[>svg]:px-4 [&.size-9]:size-10 [&[data-btn-type=icon]]:size-10",
        icon: "size-9 p-0 [&>svg]:size-4",
      },
    },
    defaultVariants: {
      variant: "default",
      type: "1",
      size: "default",
    },
  }
)

export type ButtonVariantsProps = VariantProps<typeof buttonVariants>
