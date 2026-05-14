import { cva, type VariantProps } from "class-variance-authority"

export const progressBarVariants = cva(
  "mb-8 flex w-full min-w-0 flex-col md:mb-12",
  {
    variants: {
      type: {
        "1": "gap-0",
        "2": "gap-0",
        "3": "gap-0",
        "4": "gap-0",
        "5": "gap-0",
        "6": "items-center justify-between gap-0",
        "7": "!mb-0 gap-0 md:!mb-0",
        "8": "gap-0",
      },
    },
    defaultVariants: {
      type: "1",
    },
  }
)

export type ProgressBarVariantsProps = VariantProps<typeof progressBarVariants>
