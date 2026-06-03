import { Suspense } from "react"
import type { Metadata } from "next"

import Navbar from "@/app/_components/Navbar"
import Footer from "@/app/_components/Footer"
import { RejectedContent } from "@/app/_components/RejectedContent"

export const metadata: Metadata = {
  title: "Submission not accepted",
  description: "We could not complete your request. Please review your details and try again.",
}

function RejectedLoading() {
  return (
    <main className="flex min-h-[50vh] flex-1 flex-col items-center justify-center bg-slate-50 px-4">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-slate-200 border-t-[#1e3a5f]" />
        <p className="text-sm text-slate-600">Loading...</p>
      </div>
    </main>
  )
}

export default function RejectedPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <Suspense fallback={<RejectedLoading />}>
        <RejectedContent />
      </Suspense>
      <Footer />
    </div>
  )
}
