"use client"

import React from 'react'
import Image from 'next/image'
import { STEPS_CONTENT } from '@/lib/constant'

export default function Steps() {
  return (
    <div className="steps bg-[#F3F6FA] w-full h-full px-4 py-8 md:px-6 md:py-8 lg:px-14 lg:py-10 xl:px-20 xl:py-14">
      <div className="container mx-auto">
        <div className="step-content w-full flex flex-col items-center justify-center gap-3 md:gap-6 lg:gap-10 xl:gap-14">
          <h2 className="text-2xl lg:text-3xl xl:text-4xl font-bold text-[#111827] text-center  font-sans">
            {STEPS_CONTENT.header}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-6 xl:gap-26">
            {STEPS_CONTENT.steps.map((step) => (
              <div key={step.number} className="flex flex-col items-center gap-4 md:gap-6 lg:gap-8">
                <div className="flex flex-col-reverse items-center justify-center gap-2 lg:gap-5 w-full">
                  <div className="flex-1 flex flex-col items-center justify-center gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base lg:text-lg xl:text-xl font-semibold text-[#111827] font-sans">
                        {step.number}.
                      </span>
                      <h3 className="text-base lg:text-lg xl:text-xl font-semibold text-[#111827] font-sans">
                        {step.title}
                      </h3>
                    </div>
                    <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] xl:max-w-[310px] mx-auto text-[#374151] text-center  font-sans">
                      {step.description}
                    </p>
                  </div>
                  
                  <div className="flex-1 flex items-center justify-center w-full h-full">
                    <div className="w-[220px] h-[180px] md:w-[200px] md:h-[140px] lg:w-[250px] lg:h-[140px] xl:w-[300px] xl:h-[180px]">
                      <Image
                        src={step.image.src}
                        alt={step.image.alt}
                        width={220}
                        height={180}
                        className="w-full h-full object-contain"
                        priority
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
      </div>
     
    </div>
  )
}