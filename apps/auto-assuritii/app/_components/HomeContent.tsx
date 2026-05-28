"use client"

import Navbar from "@/app/_components/Navbar"
import Ribbon from "@/app/_components/Ribbon"
import Hero from "@/app/type/long/v1/_components/Hero"
import Steps from "@/app/type/long/v1/_components/Steps"
import Features from "@/app/type/long/v1/_components/Features"
import Review from "@/app/type/long/v1/_components/Review"
import Faq from "@/app/type/long/v1/_components/Faq"
import ImageCompare from "@/app/type/long/v1/_components/ImageCompare"
import Footer from "@/app/_components/Footer"

export default function HomeContent() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <Ribbon />
      <Hero />
      <Steps />
      <ImageCompare />
      <Features />
      <Review />
      <Faq />
      <Footer />
    </div>
  )
}
