"use client"

import React, { useEffect, useState, useRef } from "react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { Shield, Building2, CheckCircle } from "lucide-react"
import type { ThankYouType2Content } from "@/lib/constant"

const ICON_MAP = {
  shield: Shield,
  building: Building2,
  check: CheckCircle,
} as const

export interface ThankYouAd {
  image: string
  link: string
}

export interface ThankYouType2Props {
  content: ThankYouType2Content
  ads?: ThankYouAd[]
  adSectionTitle?: string
  redirectPath?: string
  loadingFallback?: React.ReactNode
  requireEmailInParams?: boolean
}

function getCookie(name: string): string {
  if (typeof document === "undefined") return ""
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(";").shift()?.trim() ?? ""
  return ""
}

export function ThankYouType2({
  content,
  ads = [],
  adSectionTitle,
  redirectPath = "/",
  loadingFallback,
  requireEmailInParams = false,
}: ThankYouType2Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [utmParams, setUtmParams] = useState({ utm_source: "", utm_id: "" })
  const accessCheckStartedRef = useRef(false)

  useEffect(() => {
    if (!isAuthorized) return
    const utm_source =
      searchParams.get("utm_source") || getCookie("subid1") || ""
    const utm_id = searchParams.get("utm_id") || getCookie("subid2") || ""
    setUtmParams({ utm_source, utm_id })
  }, [isAuthorized, searchParams])

  useEffect(() => {
    if (accessCheckStartedRef.current) return
    accessCheckStartedRef.current = true

    if (!requireEmailInParams) {
      setIsAuthorized(true)
      setIsLoading(false)
      return
    }

    const emailFromUrl = searchParams.get("email")
    if (emailFromUrl) {
      setIsAuthorized(true)
      setTimeout(() => {
        if (typeof window !== "undefined") {
          const cleanUrl =
            window.location.protocol +
            "//" +
            window.location.host +
            window.location.pathname
          window.history.replaceState({}, document.title, cleanUrl)
        }
      }, 100)
    } else {
      router.replace(redirectPath)
    }
    setIsLoading(false)
  }, [searchParams, router, redirectPath, requireEmailInParams])

  if (isLoading) {
    if (loadingFallback) return <>{loadingFallback}</>
    return (
      <main className="flex min-h-[50vh] items-center justify-center bg-white px-6 py-20">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-gray-200 border-t-sky-600" />
      </main>
    )
  }

  if (!isAuthorized) return null

  const replaceUtm = (link: string) =>
    link
      .replace(/\$\{utm_source\}/g, utmParams.utm_source)
      .replace(/\$\{utm_id\}/g, utmParams.utm_id)

  return (
    <main className="min-h-screen bg-white">
      <section className="px-4 py-10 sm:px-6 sm:py-14 lg:py-20">
        <div className="mx-auto max-w-5xl text-center">
          <h1 className="text-2xl font-bold tracking-tight text-[#1e3a5f] sm:text-3xl">
            {content.title}
          </h1>

          <div className="mt-8 flex justify-center">
            {content.partnerLogo.src ? (
              <Image
                src={content.partnerLogo.src}
                alt={content.partnerLogo.alt}
                width={280}
                height={120}
                className="h-auto w-full max-w-[280px] object-contain"
              />
            ) : (
              <div
                className="flex h-28 w-full max-w-[280px] items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 text-sm font-medium text-gray-500"
                aria-hidden
              >
                Brand Logo
              </div>
            )}
          </div>

          <p className="mt-6 text-base font-medium leading-relaxed text-gray-600 sm:text-lg max-w-[690px] mx-auto">
            {content.confirmationMessage}
          </p>

          {content.confirmationEmailSentNote ? (
            <div className="mt-4 mx-auto max-w-[690px] rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-center text-sm text-green-800 sm:text-base">
              {content.confirmationEmailSentNote}
            </div>
          ) : null}

          {content.aboutSectionTitle && content.featureCards.length > 0 ? (
            <>
              <h2 className="mt-10 text-lg font-bold text-gray-900 sm:mt-12 sm:text-xl">
                {content.aboutSectionTitle}
              </h2>
              <div className="mt-6 grid gap-5 sm:mt-8 sm:grid-cols-3 sm:gap-6">
                {content.featureCards.map((card, index) => {
                  const IconComponent = ICON_MAP[card.icon]
                  return (
                    <div
                      key={index}
                      className="rounded-xl border border-gray-100 bg-white p-5 text-left shadow-[0_2px_12px_rgba(0,0,0,0.06)] sm:p-6"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-600 text-white sm:h-12 sm:w-12">
                        <IconComponent className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2} />
                      </div>
                      <h3 className="mt-4 text-base font-bold text-gray-900 sm:text-lg">
                        {card.title}
                      </h3>
                      <ul className="mt-3 space-y-2">
                        {card.bulletPoints.map((point, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm text-gray-600 sm:text-[0.9375rem]"
                          >
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-600" />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </div>
            </>
          ) : null}
        </div>
      </section>

      {ads.length > 0 && (
        <section className="border-t border-gray-200 bg-gray-50 px-4 py-10 sm:px-6 sm:py-14">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-6 text-center text-base font-semibold text-gray-900 sm:mb-8 sm:text-lg">
              {adSectionTitle ?? `We have handpicked ${ads.length} great offers, just for you.`}
            </h2>
            <div className="grid grid-cols-1 gap-5 sm:gap-6">
              {ads.map((ad, index) => (
                <a
                  key={index}
                  href={replaceUtm(ad.link)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                >
                  <Image
                    src={ad.image}
                    alt="Offer"
                    width={900}
                    height={450}
                    className="h-auto w-full object-cover transition-opacity group-hover:opacity-[0.97]"
                  />
                </a>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  )
}
