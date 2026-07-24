/** Shared styles for overview header filter / date-range controls. */
export const overviewSelectTriggerClassName =
  "h-9 gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-900 shadow-xs outline-none transition-[border-color,box-shadow,background-color] hover:border-neutral-300 hover:bg-neutral-50 focus:outline-none focus-visible:border-neutral-400 focus-visible:ring-2 focus-visible:ring-neutral-900/10 data-[state=open]:border-neutral-300 data-[state=open]:bg-neutral-50 data-[state=open]:shadow-sm [&_[data-slot=select-value]]:truncate [&_[data-slot=select-value]]:!text-neutral-900 [&_svg]:!text-neutral-500"

export const overviewSelectContentClassName =
  "rounded-lg border border-neutral-200 !bg-white p-1 !text-neutral-900 shadow-lg shadow-neutral-950/8 ring-1 ring-black/5"

export const overviewSelectItemClassName =
  "my-0.5 cursor-pointer rounded-md py-2 pr-8 pl-3 text-sm !text-neutral-800 outline-none first:mt-0 last:mb-0 hover:!bg-neutral-100 hover:!text-neutral-950 focus:!bg-neutral-100 focus:!text-neutral-950 data-[disabled]:!text-neutral-400 data-[highlighted]:!bg-neutral-100 data-[highlighted]:!text-neutral-950 data-[state=checked]:font-medium"
