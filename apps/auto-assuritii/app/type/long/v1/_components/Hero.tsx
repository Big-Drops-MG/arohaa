"use client"

import Image from "next/image"
import { useUtmParams } from "@workspace/lp-core"
import { HERO_CONTENT } from "@/lib/constant"
import Form from "@/app/type/long/v1/_components/Form"

export default function Hero() {
  useUtmParams(30)

  return (
    <div className="bg-white w-full h-full px-4 py-8 md:px-6 md:py-8 lg:px-14 lg:py-10 xl:px-20 xl:py-14">
      <div className="container mx-auto min-w-0 flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-10">
        <div className="w-full min-w-0 lg:w-1/2 flex flex-col items-center gap-5 lg:gap-8">
          <div className="w-full space-y-4 text-center lg:text-left">
            <h1 className="text-3xl lg:text-4xl xl:text-5xl text-[#0F2440] font-bold">{HERO_CONTENT.headline}</h1>
            <p className="text-sm lg:text-base xl:text-lg text-[#374151] max-w-xl">{HERO_CONTENT.description}</p>
          </div>
          <div className="w-full flex justify-center lg:justify-start min-h-0">
            <Image
              src={HERO_CONTENT.image.src}
              alt={HERO_CONTENT.image.alt}
              width={500}
              height={500}
              className="w-full max-w-md object-contain object-center h-auto max-h-[240px] sm:max-h-[280px] lg:max-h-[320px]"
            />
          </div>
          <a
            href="#customer-reviews"
            aria-label="Scroll to customer reviews"
            className="w-full min-w-0 flex items-center justify-center lg:justify-start gap-4 sm:gap-6 overflow-hidden cursor-pointer rounded-sm outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-[#0F2440]"
          >
            <Image src={HERO_CONTENT.partners[0].src} alt={HERO_CONTENT.partners[0].alt} width={80} height={80} className="object-contain w-16 sm:w-20 lg:w-24 h-auto min-w-0 flex-shrink" />
            <Image src={HERO_CONTENT.partners[1].src} alt={HERO_CONTENT.partners[1].alt} width={80} height={80} className="object-contain w-14 sm:w-16 lg:w-20 h-auto min-w-0 flex-shrink" />
            <Image src={HERO_CONTENT.partners[2].src} alt={HERO_CONTENT.partners[2].alt} width={80} height={80} className="object-contain w-24 sm:w-32 lg:w-40 h-auto min-w-0 flex-shrink" />
          </a>
        </div>
        <div className="w-full lg:w-1/2 h-full flex flex-col items-center lg:items-start justify-center gap-4">
          <Form />
        </div>
      </div>
    </div>
  );
}