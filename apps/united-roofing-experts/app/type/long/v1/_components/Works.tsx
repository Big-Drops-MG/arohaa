import Image from "next/image"
import { WORKS_CONTENT } from "@/lib/constant"

export default function Works() {
  return (
    <div className="works w-full bg-white px-4 py-8 md:px-6 md:py-10 lg:px-14 lg:py-12 xl:px-20 xl:py-16">
      <div className="container mx-auto ">
        <div className="works-content w-full flex flex-col items-center justify-center gap-8 md:gap-10 lg:gap-12 xl:gap-14">
          <h2 className="text-2xl md:text-[1.7rem] lg:text-3xl xl:text-4xl font-bold text-[#111827] text-center font-sans ">
            {WORKS_CONTENT.header}
          </h2>

          <div className="w-full flex flex-col items-center gap-10 md:gap-8 lg:gap-10 xl:gap-14 md:flex-row md:justify-between md:items-center">
            {WORKS_CONTENT.steps.map((step) => (
              <div
                key={step.id}
                className="w-full flex flex-col items-center text-center gap-4.5 md:gap-5 xl:gap-6"
              >
                <div
                  className="w-14 h-10  rounded-[100px] bg-[#0D74BA]  flex items-center justify-center "
                  aria-hidden
                >
                  <span className="text-white font-bold text-[1.1rem] lg:text-lg ">
                    {step.number}
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center gap-2">
                  <h3 className="text-base md:text-[0.95rem] lg:text-base xl:text-lg lg:max-w-[200px] xl:max-w-[275px]  font-semibold text-[#111827] font-sans leading-tight ">
                    {step.title}
                  </h3>
                  <p className="text-[#374151] text-[0.8rem] xl:text-[0.95rem] xl:max-w-[350px]  leading-relaxed ">
                    {step.description}
                  </p>
                </div>
                <div className="w-full rounded-[10px] overflow-hidden xl:max-w-[400px] xl:h-[260px]">
                  <Image
                    src={step.image.src}
                    alt={step.image.alt}
                    width={800}
                    height={500}
                    className="w-full h-auto object-cover"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
