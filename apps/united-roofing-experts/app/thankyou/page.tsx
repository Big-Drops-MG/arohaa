import { Suspense } from "react"
import type { Metadata } from "next"
import { THANKYOU_TYPE2_CONTENT, THANKYOU_REQUIRE_EMAIL_IN_PARAMS } from "@/lib/constant"
import Navbar from "@/app/_components/Navbar"
import Footer from "@/app/_components/Footer"
import { ThankYouType2, type ThankYouAd } from "@/app/_components/ThankYouType2"

const THANKYOU_ADS: ThankYouAd[] = [
  {
    image: '/nerdwallet.png',
    link: 'https://www.platinum-home-track.com/28KL6/3GHXJS7/?sub1=ure_${utmParams.utm_source}&sub2=${utmParams.utm_id}&sub3=${utmParams.utm_s1}'
  },
  {
    image: '/adt.png',
    link: 'https://www.platinum-home-track.com/28KL6/49FHNSP/?sub1=ure_${utmParams.utm_source}&sub2=${utmParams.utm_id}&sub3=${utmParams.utm_s1}'
  },
  {
    image: '/ahs.jpg',
    link: 'https://www.platinum-home-track.com/28KL6/49FHNSP/?uid=113&sub1=ure_${utmParams.utm_source}&sub2=${utmParams.utm_id}&sub3=${utmParams.utm_s1}'
  },
]

export const metadata: Metadata = {
  title: "Thank You",
  description: "Your request has been received. A specialist will contact you shortly.",
}

function ThankYouLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-gray-600" />
        <p className="text-gray-600">Loading...</p>
      </div>
    </main>
  )
}

export default function ThankYouPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <Suspense fallback={<ThankYouLoading />}>
        <ThankYouType2
          content={THANKYOU_TYPE2_CONTENT}
          ads={THANKYOU_ADS}
          redirectPath="/"
          loadingFallback={<ThankYouLoading />}
          requireEmailInParams={THANKYOU_REQUIRE_EMAIL_IN_PARAMS}
        />
      </Suspense>
      <Footer />
    </div>
  )
}
