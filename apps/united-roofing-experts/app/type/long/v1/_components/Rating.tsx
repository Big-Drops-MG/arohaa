"use client"

import Image from "next/image"
import { RATING_CONTENT } from "@/lib/constant"

export default function Rating() {
  const ratings = RATING_CONTENT.ratings

  return (
    <div className="rating bg-white w-full px-4 py-8 md:px-6 md:py-10 md:pb-7 lg:px-14  xl:px-20 xl:pt-14 ">
      <div className="container mx-auto ">
        <div className="rating-content w-full flex flex-col items-center justify-center md:flex-row md:items-start md:justify-start gap-6 lg:gap-8 ">
          {ratings.map((item, index) => (
            <div
              key={item.id}
              className={`w-full flex flex-col items-center justify-center md:justify-start text-center gap-2 lg:gap-3 xl:gap-4 md:border-l-[#0000004D] ${index < ratings.length - 1 ? "md:border-r md:border-r-[#0000004D] md:pr-6" : ""}`}
            >
              <p className="text-[#111827] font-medium text-sm lg:text-base xl:text-lg ">
                {item.label}
              </p>
              <p className="text-[#DC2626] font-extrabold text-3xl lg:text-4xl xl:text-5xl ">
                {item.value}
              </p>
              <div className="flex items-center justify-center min-h-[44px] ">
                <Image
                  src={item.logo.src}
                  alt={item.logo.alt}
                  width={160}
                  height={48}
                  className={item.logo.className}
                />
              </div>
              {index < ratings.length - 1 && (
                <div
                  className="w-full max-w-[210px] border-b border-[#0000004D]  md:border-b-0 md:border-l-[#0000004D] mt-4 "
                  aria-hidden
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
