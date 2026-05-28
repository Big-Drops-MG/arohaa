"use client"

import React from 'react'
import Image from 'next/image'
import { FEATURES_CONTENT } from '@/lib/constant'

export default function Features() {
  return (
    <div className="features bg-[#F3F6FA] w-full h-full px-4 py-8 md:px-6 md:py-8 lg:px-14 lg:py-10 xl:px-20 xl:py-14">
      <div className="container mx-auto">
        <div className="features-content w-full flex flex-col items-center justify-center lg:flex-row  lg:justify-between gap-6 md:gap-10 lg:gap-14 xl:gap-14">
          <div className="left flex flex-col items-center justify-center lg:items-start gap-3 md:gap-4 xl:gap-6 lg:w-[40%] xl:w-[45%] ">
            <h2 className="text-2xl lg:text-3xl xl:text-4xl xl:max-w-[500px] font-bold text-[#111827] text-center lg:text-left font-sans" style={{ lineHeight: '1.2' }}>
              {FEATURES_CONTENT.header}
            </h2>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] md:max-w-[600px] lg:max-w-[500px] xl:max-w-[450px] lg:text-left text-[#374151] text-center font-sans" style={{ lineHeight: '1.6' }}>
              {FEATURES_CONTENT.description}
            </p>
          </div>

          <div className="right flex flex-col items-center justify-center gap-3 w-full lg:w-[60%] xl:w-[55%] ">
            <div className="grid grid-cols-1  gap-6 md:gap-5 lg:gap-6 xl:gap-7 w-full">
              {FEATURES_CONTENT.features.map((feature) => (
                <div 
                  key={feature.title} 
                  className="w-full md:w-auto min-w-0 flex flex-col items-start justify-center md:flex-row md:max-w-[540px] lg:max-w-[570px] xl:max-w-[670px] mx-0 md:mx-auto gap-3.5 bg-white rounded-[10px] shadow-[0_0_30px_0_rgba(15,36,64,0.10)] p-5 md:p-4 xl:p-4.5"
                >
                  <div className="bg-[#FFE5E5] w-13 h-13 xl:w-14 xl:h-14 rounded-[10px] p-2 flex items-center justify-center">
                    <div className="w-8.5 h-8.5 xl:w-9.5 xl:h-9.5 flex items-center justify-center">
                      <Image
                        src={feature.image.src}
                        alt={feature.image.alt}
                        width={48}
                        height={48}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col items-start justify-center gap-1.5 ">
                    <h3 className="text-[1.05rem] md:text-base lg:text-lg xl:text-xl font-medium text-[#111827] text-left font-sans">
                      {feature.title}
                    </h3>
                    <p className="text-sm xl:text-[1.15rem]  text-[#374151] text-left font-sans">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}