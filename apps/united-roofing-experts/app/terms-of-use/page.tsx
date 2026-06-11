import { Metadata } from "next"
import Navbar from "@/app/_components/Navbar"
import TermsAndConditions from "@/app/_components/TermsAndConditions"
import Footer from "@/app/_components/Footer"

export const metadata: Metadata = {
  title: "Terms of Use",
  description:
    "Assuritii terms of use and conditions. Please read these terms before using our vehicle protection services.",
}

export default function TermsOfUsePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <TermsAndConditions />
      <Footer />
    </div>
  )
}