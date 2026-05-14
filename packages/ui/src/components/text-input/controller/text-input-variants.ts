import { cva, type VariantProps } from "class-variance-authority"

const inputBase =
  "w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-base font-normal text-foreground shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground placeholder:font-normal disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:border-destructive aria-invalid:ring-destructive/20"

export const textInputVariants = cva(inputBase, {
  variants: {
    size: {
      default: "h-10",
      sm: "h-8 px-2.5 py-1.5 text-sm font-normal",
      lg: "h-12 px-4 py-3 text-base font-normal",
    },
  },
  defaultVariants: {
    size: "default",
  },
})

export type TextInputVariantsProps = VariantProps<typeof textInputVariants>
