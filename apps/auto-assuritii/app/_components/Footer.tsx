"use client"

import { Footer as FooterUI } from "@workspace/ui/components/footer"
import Image from "next/image"
import { FOOTER_CONTENT } from "@/lib/constant"

export default function Footer() {
  return (
    <FooterUI
      type="long"
      bgColor="#0F2440"
      logo={<Image src="/assuritii-white.svg" alt="Assuritii" width={120} height={40} className="w-28 h-auto object-contain" />}
      description={FOOTER_CONTENT.description}
      descriptionClassName="max-w-3/4"
      linkHeader={FOOTER_CONTENT.linkHeader}
      links={[...FOOTER_CONTENT.links]}
      copyrightText={FOOTER_CONTENT.copyrightText}
      disclaimer={FOOTER_CONTENT.disclaimer}
      disclaimerClassName="max-w-5xl"
    />
  )
}