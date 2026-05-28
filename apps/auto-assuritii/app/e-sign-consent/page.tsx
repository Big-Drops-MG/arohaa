import { Metadata } from "next"
import Navbar from "@/app/_components/Navbar"
import ESignConsent from "@/app/_components/esign-consent"
import Footer from "@/app/_components/Footer"

export const metadata: Metadata = {
  title: "E-Sign Consent",
  description:
    "Assuritii e-sign consent. Please read this consent before using our vehicle protection services.",
}

export default function ESignConsentPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <ESignConsent />
      <Footer />
    </div>
  )
}