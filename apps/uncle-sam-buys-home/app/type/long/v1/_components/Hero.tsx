
"use client"

import { useUtmParams } from "@workspace/lp-core"
import FormPage from "@/app/type/long/v1/_components/Form"


export default function Hero() {
  useUtmParams(30)

  return (
    <section className="relative bg-[#F8F9FB] w-full h-full px-6 py-8 md:px-6 md:py-10 lg:px-14 lg:py-10 xl:px-20 xl:py-14 ">
      <div className="flex flex-col items-center justify-center gap-4">
       
        <FormPage />
      </div>
    </section>
  )
}