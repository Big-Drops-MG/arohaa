import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "@workspace/ui/lib/utils"
import type { ButtonHtmlType, ButtonProps, ButtonType } from "../model/types"
import { buttonVariants } from "../controller/button-variants"

function resolveNativeAndDesignType(
  typeProp: ButtonProps["type"],
  htmlType: ButtonHtmlType | undefined,
  asChild: boolean
): { designType: ButtonType; nativeType: ButtonHtmlType | undefined } {
  if (typeProp === "submit" || typeProp === "button" || typeProp === "reset") {
    return {
      designType: "1",
      nativeType: asChild ? undefined : typeProp,
    }
  }
  return {
    designType: (typeProp ?? "1") as ButtonType,
    nativeType: asChild ? undefined : (htmlType ?? "button"),
  }
}

function Button({
  type: typeProp,
  variant = "default",
  size = "default",
  htmlType = "button",
  backgroundColor,
  foregroundColor,
  asChild = false,
  className,
  style,
  ...props
}: ButtonProps) {
  const { designType, nativeType } = resolveNativeAndDesignType(
    typeProp,
    htmlType,
    asChild
  )
  const Comp = asChild ? Slot : "button"
  const mergedStyle = React.useMemo(
    () => ({
      ...style,
      ...(backgroundColor != null && { backgroundColor }),
      ...(foregroundColor != null && { color: foregroundColor }),
    }),
    [style, backgroundColor, foregroundColor]
  )

  return (
    <Comp
      type={nativeType}
      data-slot="button"
      data-type={designType}
      data-btn-type={designType === "2" ? "icon" : undefined}
      className={cn(
        buttonVariants({ variant, type: designType, size }),
        className
      )}
      style={mergedStyle}
      {...props}
    />
  )
}

export { Button, buttonVariants }
