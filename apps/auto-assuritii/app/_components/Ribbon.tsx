"use client"

export default function Ribbon() {
    return (
        <div className="bg-[#3498DB] p-4 xl:p-5 min-h-[56px] xl:min-h-[64px] flex items-center justify-center">
            <div className="container mx-auto">
                <div className="ribbon-content flex items-center justify-center gap-4">
                    <div className="flex items-center text-center gap-5 lg:gap-6 xl:gap-7">
                        <p className="text-white font-sans font-bold text-sm lg:text-base xl:text-lg">SPRING SAVINGS EVENT: Save Up to $500 Off Your Auto Coverage Policy!</p>
                    </div>
                </div>
            </div>
        </div>
    );
}