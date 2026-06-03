"use client"

import { Footer as FooterUI } from "@workspace/ui/components/footer"
import Image from "next/image"
import { FOOTER_CONTENT } from "@/lib/constant"

export default function Footer() {
  return (
    <FooterUI
      type="long"
      bgColor="#0F172A"
      logo={<Image src="/ure-footer.svg" alt="United Roofing Experts" width={120} height={40} className="w-40 h-auto object-contain" />}
      links={[...FOOTER_CONTENT.links]}
      copyrightText={FOOTER_CONTENT.copyrightText}
    />
  )
}