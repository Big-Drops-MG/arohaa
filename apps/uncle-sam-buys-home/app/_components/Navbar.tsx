"use client"

import { Navbar as NavbarUI } from "@workspace/ui/components/navbar"
import Image from "next/image"



export default function Navbar() {
  return (
    <NavbarUI
      variant="default"
      type="2"
      className="mx-auto w-full  px-4 py-6 sm:px-6 lg:px-8 border-none"
      logo={
        <>
          <Image
            src="/logo.svg"
            alt="Uncle Sam Buys Homes"
            width={128}
            height={40}
            className="w-auto h-14 xl:h-16 object-contain"
            priority
          />
          
        </>
      }
    />
  )
}
