"use client"

import React, { useEffect, useState, useRef } from "react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { Shield, Building2, CheckCircle, Mail } from "lucide-react"
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
  }, [searchParams, router, redirectPath])

  if (isLoading) {
    if (loadingFallback) return <>{loadingFallback}</>
    return (
      <main className="flex min-h-[50vh] flex-1 items-center justify-center bg-slate-50 px-6 py-20">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-slate-200 border-t-[#1e3a5f]" />
      </main>
    )
  }

  if (!isAuthorized) return null

  const replaceUtm = (link: string) =>
    link
      .replace(/\$\{utm_source\}/g, utmParams.utm_source)
      .replace(/\$\{utm_id\}/g, utmParams.utm_id)

  return (
    <main className="flex w-full flex-1 flex-col bg-gradient-to-b from-slate-100/90 via-white to-slate-50">
      <section className="px-4 pb-10 pt-6 sm:px-6 sm:pb-14 sm:pt-8">
        <div className="mx-auto max-w-lg sm:max-w-xl">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[0_4px_24px_-4px_rgba(15,36,64,0.08)] sm:p-8 md:p-10">
            <h1 className="text-center text-2xl font-bold tracking-tight text-[#1e3a5f] sm:text-[1.75rem] sm:leading-tight">
              {content.title}
            </h1>

            <div className="mt-6 flex justify-center sm:mt-8">
              <Image
                src={content.partnerLogo.src}
                alt={content.partnerLogo.alt}
                width={320}
                height={140}
                className="h-auto w-full max-w-[300px] object-contain sm:max-w-[320px]"
                priority
              />
            </div>

            <p className="mt-6 text-center text-[0.9375rem] font-medium leading-relaxed text-slate-600 sm:text-base">
              {content.confirmationMessage}
            </p>

            {content.emailConfirmationNotice ? (
              <div className="mt-5 flex gap-3 rounded-xl border border-emerald-200/90 bg-emerald-50/90 px-4 py-3.5 sm:mt-6 sm:px-5 sm:py-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-700">
                  <Mail className="h-4 w-4 sm:h-[18px] sm:w-[18px]" strokeWidth={2} aria-hidden />
                </div>
                <p className="min-w-0 flex-1 text-left text-sm font-medium leading-relaxed text-emerald-950 sm:text-[0.9375rem]">
                  {content.emailConfirmationNotice}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200/80 bg-slate-50/90 px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-8 max-w-2xl text-center sm:mb-10">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {content.partnerName}
            </p>
            <h2 className="mt-2 text-xl font-bold text-[#0f2440] sm:text-2xl">
              {content.aboutSectionTitle}
            </h2>
            <div className="mx-auto mt-4 h-1 w-12 rounded-full bg-sky-600/80" aria-hidden />
          </div>

          <div className="grid gap-5 sm:grid-cols-3 sm:gap-6 lg:gap-8">
            {content.featureCards.map((card, index) => {
              const IconComponent = ICON_MAP[card.icon]
              return (
                <div
                  key={index}
                  className="flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md sm:p-6"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1e3a5f] text-white shadow-sm sm:h-12 sm:w-12">
                    <IconComponent className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2} />
                  </div>
                  <h3 className="mt-4 text-base font-bold leading-snug text-[#0f2440] sm:text-lg">
                    {card.title}
                  </h3>
                  <ul className="mt-3 flex flex-1 flex-col gap-2.5">
                    {card.bulletPoints.map((point, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2.5 text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]"
                      >
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-600" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {ads.length > 0 && (
        <section className="border-t border-slate-200 bg-white px-4 py-10 sm:px-6 sm:py-14">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-6 text-center text-base font-semibold text-[#0f2440] sm:mb-8 sm:text-lg">
              {adSectionTitle ?? `We have handpicked ${ads.length} great offers, just for you.`}
            </h2>
            <div className="grid grid-cols-1 gap-5 sm:gap-6">
              {ads.map((ad, index) => (
                <a
                  key={index}
                  href={replaceUtm(ad.link)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
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
