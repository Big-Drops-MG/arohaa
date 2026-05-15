import { Metadata } from "next"
import Navbar from "@/app/_components/Navbar"
import PrivacyPolicy from "@/app/_components/PrivacyPolicy"
import Footer from "@/app/_components/Footer"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Assuritii privacy policy. Learn how we collect, use, and protect your personal information.",
}

export default function PrivacyPolicyPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <PrivacyPolicy />
      <Footer />
    </div>
  )
}