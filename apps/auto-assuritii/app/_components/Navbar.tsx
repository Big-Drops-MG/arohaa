"use client"
import { Navbar as NavbarUI } from "@workspace/ui/components/navbar"
import Image from "next/image"
import { SUPPORT_PHONE } from "@/lib/constant"

export default function Navbar() {
    return (
        <NavbarUI
        variant="default"
        type="1"
        className="container mx-auto py-4 px-4 xl:px-0 border-b border-gray-200"
        logo={
            <Image
            src="/assuritii.svg"
            alt="Assuritii"
            width={128}
            height={40}
            className="w-32 h-10 object-contain"
            priority
            />
        }
        contactText="Call Now"
        contactTextClassName="text-lg text-zinc-900 font-semibold hidden md:inline"
        showContactIcon={false}
        contactHref={`tel:${SUPPORT_PHONE.tel}`}
        contactLabel={SUPPORT_PHONE.display}
        contactButton={{
            type: "1",
            variant: "ghost",
            size: "sm",
            className: "text-lg text-[#3498DB] font-bold hover:bg-transparent hover:text-[#3498DB]",
        }}
        />
    )
}