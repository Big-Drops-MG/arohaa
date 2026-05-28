"use client"

import { ReactCompareSlider, ReactCompareSliderImage } from "react-compare-slider"
import { IMAGE_COMPARE_CONTENT, REPAIR_COSTS_CONTENT } from "@/lib/constant"

export default function ImageCompare() {
  return (
    <div className="image-compare bg-white w-full h-full px-4 py-8 md:px-6 md:py-8 lg:px-14 lg:py-10 xl:px-20 xl:py-14">
      <div className="container mx-auto">
        <div className="image-compare-content w-full flex flex-col items-center justify-center gap-3 md:gap-6 lg:gap-10 xl:gap-14">
          <h2 className="text-2xl lg:text-3xl xl:text-4xl font-bold text-[#111827] text-center font-sans">
            {IMAGE_COMPARE_CONTENT.header}
          </h2>

          <div className="w-full max-w-full sm:max-w-[400px] md:hidden rounded-[10px] overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.12)]">
            <div className="bg-[#1A2F4A] px-5 pt-5 pb-6">
              <p className="text-white font-bold text-center text-lg uppercase tracking-wide font-sans">
                {REPAIR_COSTS_CONTENT.header}
              </p>
              <div className="h-0.5 w-full bg-[#93C5FD] mt-3 mb-5" />
              <p className="text-white font-bold text-sm uppercase tracking-wide font-sans mb-1">
                {REPAIR_COSTS_CONTENT.withoutLabel}
              </p>
              <div className="h-0.5 w-16 bg-[#93C5FD] mb-4" />
              <div className="flex flex-col gap-3">
                {REPAIR_COSTS_CONTENT.items.map((item) => (
                  <div key={item.label} className="flex flex-col gap-0.5">
                    <p className="text-white text-xs uppercase font-sans">{item.label}</p>
                    <p className="text-white font-bold text-lg font-sans">{item.cost}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-[#6BB3F2] px-5 pt-5 pb-8 relative overflow-hidden">
              <p className="text-white font-bold text-sm uppercase tracking-wide font-sans mb-1">
                {REPAIR_COSTS_CONTENT.withLabel}
              </p>
              <div className="h-0.5 w-16 bg-[#93C5FD] mb-4" />
              <p className="text-white text-xs uppercase font-sans">{REPAIR_COSTS_CONTENT.totalLabel}</p>
              <p className="text-white font-bold text-3xl font-sans">{REPAIR_COSTS_CONTENT.withTotalCost}</p>
              <div className="absolute bottom-8 right-36 w-[100px] h-[60px] pointer-events-none flex items-end justify-end">
                <svg className="w-full h-full" viewBox="0 0 143.8 86.2" fill="none">
                  <g>
                    <g>
                      <polygon fill="#93C5FD" points="48.15 0 99.5 0 54.1 43.1 99.5 86.2 48.15 86.2 0 43.1 48.15 0" />
                      <polygon fill="#93C5FD" style={{ opacity: 0.5 }} points="108.85 0 128.19 0 81.53 43.1 128.19 86.2 108.85 86.2 62.62 43.1 108.85 0" />
                      <polygon fill="#93C5FD" style={{ opacity: 0.25 }} points="137.05 0 143.8 0 98.28 43.1 143.8 86.2 137.05 86.2 91.64 43.1 137.05 0" />
                    </g>
                  </g>
                </svg>
              </div>
            </div>
          </div>

          <div className="w-full max-w-full md:max-w-[720px] lg:max-w-[1000px] xl:max-w-[1240px] mx-auto overflow-hidden rounded-lg [&_img]:object-cover [&>div]:!h-full [&>div]:!w-full hidden md:block">
            <ReactCompareSlider
              itemOne={
                <ReactCompareSliderImage
                  src={IMAGE_COMPARE_CONTENT.imageOne.src}
                  alt={IMAGE_COMPARE_CONTENT.imageOne.alt}
                />
              }
              itemTwo={
                <ReactCompareSliderImage
                  src={IMAGE_COMPARE_CONTENT.imageTwo.src}
                  alt={IMAGE_COMPARE_CONTENT.imageTwo.alt}
                />
              }
            />
          </div>
        </div>
      </div>
    </div>
  )
}
