"use client"

import Navbar from "@/app/_components/Navbar"
import Hero from "@/app/type/long/v1/_components/Hero"
import Review from "../type/long/v1/_components/Review"
import Footer from "@/app/_components/Footer"
import Roof from "@/app/type/long/v1/_components/Roof"
import Ribbon from "@/app/type/long/v1/_components/Ribbon"
import Works from "../type/long/v1/_components/Works"
import Rating from "@/app/type/long/v1/_components/Rating"
import Options from "../type/long/v1/_components/Options"
import { FormPopupProvider, useFormPopup } from "@/app/type/long/v1/_components/FormPopupContext"
import { FormPopupModal } from "@/app/type/long/v1/_components/FormPopupModal"
import FormPage from "@/app/type/long/v1/_components/Form"

function FormPopupGate() {
  const { isOpen, closeFormPopup } = useFormPopup()
  return (
    <FormPopupModal isOpen={isOpen} onClose={closeFormPopup}>
      <FormPage onClose={closeFormPopup} embedInModal />
    </FormPopupModal>
  )
}

export default function HomeContent() {
  return (
    <FormPopupProvider>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <Hero />
        <Ribbon />
        <Works />
        <Roof />
        <Rating />
        <Review />
        <Options />
        <Footer />
      </div>
      <FormPopupGate />
    </FormPopupProvider>
  )
}
