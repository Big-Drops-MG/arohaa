"use client"

import React from 'react'
import Image from 'next/image'
import { REVIEW_CONTENT } from '@/lib/constant'

export default function Review() {
  return (
    <div className="review bg-white w-full h-full px-4 py-8 md:px-6 md:py-8 lg:px-14 lg:py-6 xl:px-20 xl:py-14">
      <div className="container mx-auto">
        <div className="review-content w-full flex flex-col items-center justify-center gap-8 md:gap-10 lg:gap-10 xl:gap-16">
          <h2 className="text-2xl md:text-[1.7rem] lg:text-3xl xl:text-4xl font-bold text-[#111827] text-center font-sans ">
            {REVIEW_CONTENT.header}
          </h2>

          <div className="w-full flex flex-col items-center justify-center md:flex-row  gap-6 xl:gap-8 md:mb-2">
            {REVIEW_CONTENT.testimonialImages.map((image) => (
              <div key={image.id} className="relative w-full  h-auto md:max-w-[400px] md:h-[230px] xl:max-w-full xl:h-[360px]">
                <Image src={image.testimonialImage.src} alt={image.testimonialImage.alt} width={200} height={200}
                  className="w-full h-full object-cover" priority />

                <div className="absolute bottom-0 left-0 mb-2 ml-2 xl:mb-3 xl:ml-3 bg-[#FFFFFF] px-3 py-1.5 rounded-[6px]">
                  <p className="text-[#1F3A5F] text-left text-xs xl:text-lg  font-semibold font-sans">BEFORE</p>
                </div>

                <div className="absolute bottom-0 right-0 mb-2 mr-2 xl:mb-3 xl:mr-3 bg-[#FFFFFF] px-3 py-1.5 rounded-[6px]">
                  <p className="text-[#1F3A5F] text-right text-xs xl:text-lg  font-semibold font-sans">AFTER</p>
                </div>
              </div>
            ))}

          </div>

          <div className="w-full">
            <div className="w-full">
              <div className="w-full grid grid-cols-1 md:grid-cols-2  gap-6 md:gap-4 lg:gap-6 xl:gap-10 2xl:gap-14">
                {REVIEW_CONTENT.testimonialImages.map((image) => {
                  const testimonial = REVIEW_CONTENT.testimonials[image.id - 1]
                  if (!testimonial) return null
                  return (
                    <div
                      key={image.id}
                      className="w-full md:w-auto min-w-0 bg-white border border-[#2563EB] rounded-[15px] flex flex-col items-start justify-start gap-4  p-5 xl:p-7 lg:gap-5.5 xl:gap-7 min-h-[240px] shadow-[2px_2px_15px_0_rgba(31,58,95,0.10)]"
                    >

                      <div className="w-full flex items-center justify-between ">
                        {REVIEW_CONTENT.reviewImages.map((reviewImage) => (
                          <Image
                            key={reviewImage.id}
                            src={reviewImage.testimonialImage.src}
                            alt={reviewImage.testimonialImage.alt}
                            width={40}
                            height={40}
                            className="w-9 h-9 lg:w-10 lg:h-10 xl:w-12 xl:h-12 object-contain"
                            priority
                          />
                        ))}
                      </div>


                      <p className="text-[0.9rem] lg:text-base xl:text-[1.05rem] xl:max-w-[480px] text-[#111827] font-inter flex-1" style={{ lineHeight: 1.5 }}>
                        &quot;{testimonial.quote}&quot;
                      </p>

                      <div className="w-full flex flex-col-reverse items-start justify-start md:flex-row md:items-center md:justify-between gap-3 mt-auto">
                        <div className="flex items-center justify-start gap-3 md:w-[58%] ">
                          <div className="w-10 h-10 xl:w-12 xl:h-12 overflow-hidden flex items-center justify-center flex-shrink-0 relative">
                            <Image
                              src={testimonial.customer.image.src}
                              alt={testimonial.customer.image.alt}
                              fill
                              className="object-cover"
                              priority
                            />
                          </div>
                          <div>
                            <p className="font-semibold text-sm lg:text-base xl:text-lg text-[#111827] font-inter">
                              {testimonial.customer.name}
                            </p>
                            <p className="text-[0.83rem] md:text-[0.83rem] lg:text-[0.88rem] 2xl:text-[0.95rem] text-[#374151] font-inter">
                              {testimonial.customer.status}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-start md:justify-end w-full md:w-[42%] ">
                          <div className="flex items-center justify-start gap-0.5">
                            {[...Array(5)].map((_, index) => (
                              <svg
                                key={index}
                                xmlns="http://www.w3.org/2000/svg"
                                width="26"
                                height="26"
                                viewBox="0 0 26 26"
                                fill="none"
                                className="w-5 h-5 lg:w-6 lg:h-6 xl:w-7.5 xl:h-7.5"
                              >
                                <path
                                  d="M9.35575 8.79725L12.2709 2.89042C12.569 2.28653 13.4301 2.28653 13.7281 2.89042L16.6433 8.79725L23.1619 9.74445C23.8283 9.84129 24.0944 10.6603 23.6122 11.1303L18.8953 15.7282L20.0088 22.2204C20.1227 22.8841 19.426 23.3903 18.8299 23.0769L12.9995 20.0117L7.16916 23.0769C6.57308 23.3903 5.87642 22.8841 5.99026 22.2204L7.10377 15.7282L2.38688 11.1303C1.90465 10.6603 2.17075 9.84129 2.83718 9.74445L9.35575 8.79725Z"
                                  fill="#FFB300"
                                />
                              </svg>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

          </div>


        </div>
      </div>
    </div>
  )
}

