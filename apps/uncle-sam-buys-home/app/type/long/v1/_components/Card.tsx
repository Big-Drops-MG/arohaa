"use client"

import Image from "next/image"

const offerBreakdown = [
  { label: "Total Offer", value: "$482,700" },
  { label: "Closing Costs", value: "-$28,962" },
  { label: "Taxes & Fees", value: "-$6,421" },
] as const

function BlurredValue({
  children,
  className = "",
  useDefaultTextStyle = true,
}: {
  children: string
  className?: string
  useDefaultTextStyle?: boolean
}) {
  return (
    <span
      aria-hidden="true"
      className={`select-none tracking-tight blur-[7px] ${
        useDefaultTextStyle ? "font-semibold text-[rgba(255,255,255,0.85)]" : ""
      } ${className}`}
    >
      {children}
    </span>
  )
}

function OfferRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3">
      <p className="text-[0.8rem] lg:text-[0.83rem] font-normal  text-[#C8D2DE]">
        {label}
      </p>
      <BlurredValue className="text-[0.8rem] lg:text-[0.83rem] text-[#C8D2DE]">{value}</BlurredValue>
    </div>
  )
}

export default function CashOfferCard() {
  return (
    <aside
      aria-label="Estimated cash offer preview"
      className="w-full  md:max-w-[300px] mt-2 md:mt-4 rounded-[18px] bg-[#182542] p-4.5 text-white shadow-[0_14px_28px_rgba(16,34,56,0.24)] "
    >
      <h3 className="text-center text-[0.9rem] md:text-base font-semibold text-[#22C55E] ">
        Your Estimated Cash Offer
      </h3>

      <div className="mt-4 flex justify-center md:mt-5">
        <BlurredValue className="text-3xl xl:text-4xl text-white font-semibold">$482,700</BlurredValue>
      </div>

      <div className="my-5 h-px w-full bg-[rgba(255,255,255,0.06)] " />

      <div className="relative">
        <div className="space-y-3.5 md:space-y-4">
          {offerBreakdown.map((item) => (
            <OfferRow key={item.label} label={item.label} value={item.value} />
          ))}
        </div>

        <div className="pointer-events-none absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-[0_0_28px_rgba(49,231,208,0.18)] ">
          <Image
            src="/lock.svg"
            alt=""
            width={16}
            height={16}
            aria-hidden
            className="h-5 w-5 "
          />
        </div>
      </div>

      <div className="my-5 h-px w-full bg-[rgba(255,255,255,0.06)] " />

      <div className="grid grid-cols-[1fr_auto] items-center gap-3">
        <p className="text-sm font-medium text-[#22C55E] ">
          You Get
        </p>
        <BlurredValue className="text-sm font-medium text-[#22C55E]" useDefaultTextStyle={false}>
          $447,317
        </BlurredValue>
      </div>

      <div className="mt-3.5 grid grid-cols-[1fr_auto] items-center gap-3 ">
        <p className="text-[0.8rem] lg:text-[0.83rem] font-normal  text-[#C8D2DE]">
          Payment Send Date
        </p>
        <BlurredValue className="text-[0.8rem] lg:text-[0.83rem]">24/05/2026</BlurredValue>
      </div>
    </aside>
  )
}
