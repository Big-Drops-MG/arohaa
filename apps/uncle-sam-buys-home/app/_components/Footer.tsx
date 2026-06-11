"use client"

import { Footer as FooterUI } from "@workspace/ui/components/footer"
import { FOOTER_CONTENT } from "@/lib/constant"

export default function Footer() {
  return (
    <FooterUI
      type="long"
      bgColor="#102E50"
     
      linkHeader={FOOTER_CONTENT.linkHeader}
      links={[...FOOTER_CONTENT.links]}
      
      copyrightText={FOOTER_CONTENT.copyrightText}
      disclaimer={FOOTER_CONTENT.disclaimer}
      disclaimerClassName="max-w-5xl"
    />
  )
}