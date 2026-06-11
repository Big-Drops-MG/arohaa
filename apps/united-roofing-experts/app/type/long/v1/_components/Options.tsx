"use client"

import { OPTIONS_CONTENT } from "@/lib/constant"
import { Button } from "@workspace/ui/components/button"
import { useFormPopup } from "@/app/type/long/v1/_components/FormPopupContext"

export default function Options() {
  const { openFormPopup } = useFormPopup()

  return (
    <div className="options bg-[#2563EB] w-full h-full px-4 py-8 md:px-6 md:py-10 lg:px-14  xl:px-20 xl:py-14">
      <div className="container mx-auto">
        <div className="options-content w-full flex flex-col md:flex-row items-center justify-center md:justify-between gap-8 md:gap-8 lg:gap-10 xl:gap-14">
          <div className="flex flex-col items-center justify-center md:justify-start md:items-start gap-3 lg:gap-4   w-full md:w-[50%] lg:w-[50%] xl:w-[57%]  ">
            <h2 className="text-2xl md:text-[1.7rem] lg:text-3xl xl:text-4xl font-bold text-[#FFFFFF] text-center text-center md:text-left font-sans">
              {OPTIONS_CONTENT.header}
            </h2>
            <p className="text-sm lg:text-base xl:text-xl text-[#FFFFFF]  md:text-left text-center font-sans">{OPTIONS_CONTENT.description}</p>
          </div>



          <div className="flex flex-col items-center md:flex-row md:justify-end  gap-3 md:gap-0  w-full md:w-[40%] lg:w-[50%] xl:w-[43%] ">

            <Button
              type="1"
              variant="default"
              onClick={openFormPopup}
              className="bg-[#DC2626] h-14 md:h-14.5 xl:h-17  md:w-65 lg:w-70 xl:w-83  cursor-pointer text-white font-semibold  rounded-[50px] text-sm xl:text-lg px-8 py-6 md:py-5.5  flex items-center gap-2 transition-all duration-300 w-full max-w-md justify-center shadow-md hover:bg-[#DC2626] disabled:opacity-90 disabled:cursor-not-allowed"
            >
              {OPTIONS_CONTENT.buttonText}
            </Button>
          </div>




        </div>



      </div>
    </div>
  );
}
