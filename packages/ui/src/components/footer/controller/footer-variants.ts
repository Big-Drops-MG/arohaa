import { cva, type VariantProps } from "class-variance-authority"

export const footerVariants = cva("w-full", {
  variants: {
    type: {
      long: "flex flex-col gap-8 px-4 py-8 md:gap-10 md:px-6 md:py-10 lg:px-14 lg:py-12 xl:px-20 xl:py-14",
    },
  },
  defaultVariants: {
    type: "long",
  },
})

export type FooterVariantsProps = VariantProps<typeof footerVariants>
