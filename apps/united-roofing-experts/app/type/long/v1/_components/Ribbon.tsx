import { RIBBON_CONTENT } from "@/lib/constant";
import Image from "next/image";


export default function Ribbon() {
    return (
        <div className="w-full h-full bg-[#01357A] px-4 py-6 md:px-6  lg:px-14 lg:py-7  xl:px-20 xl:py-10">
            <div className="container mx-auto">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-2 gap-y-6  md:flex md:flex-row md:justify-center md:items-center md:gap-2 lg:gap-6 xl:gap-20  w-full ">
                    {RIBBON_CONTENT.badges.map((badge) => (
                        <div key={badge.label} className="w-full h-full flex flex-col items-center justify-center md:flex-row gap-2 lg:gap-2.5">
                            <Image src={badge.icon} alt={badge.label} width={20} height={20} className="w-4.5 h-4.5 lg:w-5 lg:h-5 xl:w-6 xl:h-6 object-contain" />
                            <p className="text-white text-center font-sans font-semibold text-[0.75rem] md:text-[0.8rem] lg:text-base xl:text-xl">{badge.label}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}