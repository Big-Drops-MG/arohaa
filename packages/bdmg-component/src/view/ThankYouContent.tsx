"use client"

import React, { useEffect, useState, useCallback, useRef } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Check, Phone, ArrowRight } from "lucide-react"
import { useSearchParams } from "next/navigation"
import type { ThankYouContentProps } from "../model/thank-you"

const DEFAULT_UTM_COOKIE_NAMES = {
  source: "subid1",
  id: "subid2",
  s1: "subid3",
}

function getCookie(name: string): string {
  if (typeof document === "undefined") return ""
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(";").shift()?.trim() ?? ""
  return ""
}

function setCookie(name: string, value: string, days: number = 30): void {
  if (typeof document === "undefined") return
  const expires = new Date()
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`
}

export function ThankYouContent({
  variant = "1",
  title = "Thank you!",
  subtitle = "Your request has been received. A specialist will contact you shortly.",
  showBuyerLogo = true,
  buyerLogoPath = (buyer) =>
    `/buyer/${buyer.toLowerCase().replace(/\s+/g, "-")}.png`,
  confirmationTitle = "A confirmation message has been sent to your email address.",
  confirmationDescription = "Please check your inbox and spam folder for next steps.",
  contactTitle = "For immediate assistance",
  contactPhoneLabel = "(1800) 123 - 4567",
  contactPhoneHref = "tel:+18001234567",
  redirectPath = "/",
  sendWelcomeEmail = false,
  sendEmailApiPath = "/api/send-email",
  validateAccessApiPath = null,
  useLocalStorageToken = false,
  ads = [],
  adSectionTitle,
  utmCookieNames = DEFAULT_UTM_COOKIE_NAMES,
  formDataStorageKey = "form_data",
  loadingFallback,
}: ThankYouContentProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [utmParams, setUtmParams] = useState({
    utm_source: "",
    utm_id: "",
    utm_s1: "",
  })
  const [emailSent, setEmailSent] = useState(false)
  const [buyer, setBuyer] = useState<string | null>(null)
  const [hasProcessedUrl, setHasProcessedUrl] = useState(false)
  const accessCheckStartedRef = useRef(false)

  const sendWelcomeEmailFromThankYou = useCallback(async () => {
    if (!sendWelcomeEmail) return
    try {
      const emailFromUrl = searchParams.get("email")
      let emailFromStorage: string | null = null
      if (typeof window !== "undefined" && formDataStorageKey) {
        const raw = localStorage.getItem(formDataStorageKey)
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as { email?: string }
            emailFromStorage = parsed?.email ?? null
          } catch {
            // ignore
          }
        }
      }
      const email = emailFromUrl ?? emailFromStorage
      if (!email) return
      const res = await fetch(sendEmailApiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      if (res.ok) setEmailSent(true)
    } catch {
      // ignore
    }
  }, [
    sendWelcomeEmail,
    sendEmailApiPath,
    searchParams,
    formDataStorageKey,
  ])

  useEffect(() => {
    if (hasProcessedUrl || accessCheckStartedRef.current) return
    accessCheckStartedRef.current = true

    const checkAccess = async () => {
      try {
        const emailFromUrl = searchParams.get("email")
        const buyerFromUrl = searchParams.get("buyer")

        if (emailFromUrl) {
          setIsAuthorized(true)
          setIsLoading(false)
          setHasProcessedUrl(true)
          if (buyerFromUrl) setBuyer(buyerFromUrl)
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
          if (!emailSent) sendWelcomeEmailFromThankYou()
          return
        }

        if (useLocalStorageToken && typeof window !== "undefined") {
          const token = localStorage.getItem("thankyou_token")
          const expiresAt = localStorage.getItem("thankyou_expires")
          if (token && expiresAt) {
            const expiry = parseInt(expiresAt, 10)
            if (Date.now() <= expiry) {
              if (validateAccessApiPath) {
                const res = await fetch(validateAccessApiPath, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ token }),
                })
                if (!res.ok) throw new Error("Token validation failed")
              }
              setIsAuthorized(true)
              localStorage.removeItem("thankyou_token")
              localStorage.removeItem("thankyou_expires")
              if (!emailSent) sendWelcomeEmailFromThankYou()
              setIsLoading(false)
              setHasProcessedUrl(true)
              return
            }
          }
        }

        if (validateAccessApiPath) {
          const res = await fetch(validateAccessApiPath, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          })
          if (res.ok) {
            setIsAuthorized(true)
            if (!emailSent) sendWelcomeEmailFromThankYou()
            setIsLoading(false)
            setHasProcessedUrl(true)
            return
          }
        }

        setHasProcessedUrl(true)
        router.replace(redirectPath)
      } catch {
        setHasProcessedUrl(true)
        router.replace(redirectPath)
      } finally {
        setIsLoading(false)
      }
    }

    checkAccess()
  }, [
    router,
    redirectPath,
    emailSent,
    sendWelcomeEmailFromThankYou,
    hasProcessedUrl,
    searchParams,
    validateAccessApiPath,
    useLocalStorageToken,
  ])

  useEffect(() => {
    if (!isAuthorized) return

    const utm_source =
      searchParams.get("utm_source") ||
      getCookie(utmCookieNames.source) ||
      ""
    const utm_id =
      searchParams.get("utm_id") || getCookie(utmCookieNames.id) || ""
    const utm_s1 =
      searchParams.get("utm_s1") || getCookie(utmCookieNames.s1) || ""

    if (searchParams.get("utm_source"))
      setCookie(utmCookieNames.source, searchParams.get("utm_source") ?? "")
    if (searchParams.get("utm_id"))
      setCookie(utmCookieNames.id, searchParams.get("utm_id") ?? "")
    if (searchParams.get("utm_s1"))
      setCookie(utmCookieNames.s1, searchParams.get("utm_s1") ?? "")

    setUtmParams({ utm_source, utm_id, utm_s1 })
  }, [searchParams, isAuthorized, utmCookieNames])

  if (isLoading) {
    if (loadingFallback) return <>{loadingFallback}</>
    return (
      <main className="flex min-h-[50vh] items-center justify-center bg-[#f8fafc] px-6 py-20">
        <div className="flex flex-col items-center gap-6 rounded-2xl border border-[#e2e8f0] bg-white px-12 py-12 shadow-[0_4px_24px_rgba(15,23,42,0.08)]">
          <div
            className="h-12 w-12 animate-spin rounded-full border-2 border-[#e2e8f0] border-t-[#1e293b]"
            aria-hidden
          />
          <p className="text-sm font-medium text-[#64748b]">Loading...</p>
        </div>
      </main>
    )
  }

  if (!isAuthorized) return null

  const replaceUtm = (link: string) =>
    link
      .replace(/\{\{utm_source\}\}/g, utmParams.utm_source)
      .replace(/\{\{utm_id\}\}/g, utmParams.utm_id)
      .replace(/\{\{utm_s1\}\}/g, utmParams.utm_s1)

  if (variant === "2") {
    return (
      <main className="min-h-screen bg-gradient-to-b from-[#EEF2F7] to-[#F0F4F9]">
        <section id="thankyou" className="px-4 py-10 sm:px-6 sm:py-14 lg:py-16">
          <div className="mx-auto w-full max-w-[28rem] xl:max-w-[32rem]">
            <div className="overflow-hidden rounded-[24px] border border-[#E2E8F0]/80 bg-white shadow-[0_4px_6px_-1px_rgba(31,58,95,0.06),0_10px_25px_-5px_rgba(31,58,95,0.12),0_0_0_1px_rgba(31,58,95,0.04)] sm:shadow-[0_8px_30px_-12px_rgba(31,58,95,0.18),0_0_0_1px_rgba(31,58,95,0.04)] p-8 sm:p-10 xl:p-12">
              <div className="flex flex-col items-center text-center">
                <div className="mb-5 flex h-11 w-11 sm:h-12 sm:w-12 xl:h-14 xl:w-14 shrink-0 items-center justify-center rounded-full bg-[#3498DB] shadow-[0_4px_14px_0_rgba(52,152,219,0.4)]">
                  <Check className="h-6 w-6 sm:h-6 sm:w-6 xl:h-7 xl:w-7 text-white" strokeWidth={2.5} />
                </div>
                <p className="text-xs xl:text-sm font-semibold uppercase tracking-[0.12em] text-[#3498DB] mb-4">
                  REQUEST CONFIRMED
                </p>
                <h1 className="text-[1.875rem] xl:text-[2.125rem] font-bold tracking-tight text-[#1C2833]">
                  {title}
                </h1>
                <p className="mt-3 max-w-md text-[0.9375rem] xl:text-[1.0625rem] leading-[1.6] text-[#4A5568]">
                  {subtitle}
                </p>
              </div>

              <a
                href={contactPhoneHref}
                className="mt-8 flex items-center justify-between gap-4 rounded-[16px] bg-[#1F3A5F] px-5 py-4 text-left shadow-[0_2px_8px_0_rgba(31,58,95,0.2)] transition-all hover:shadow-[0_4px_14px_0_rgba(31,58,95,0.28)] hover:bg-[#1a3250] active:scale-[0.99] sm:px-6 sm:py-4 xl:px-6 xl:py-5"
              >
                <div className="flex h-10 w-10 md:h-11 md:w-11 xl:h-12 xl:w-12 shrink-0 items-center justify-center rounded-[12px] bg-white/12">
                  <Phone className="h-4 w-4 md:h-5 md:w-5 xl:h-5 xl:w-5 shrink-0 text-white" strokeWidth={2.5} />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-xs md:text-[0.8125rem] xl:text-[0.9375rem] font-normal text-white/90 mb-0.5">{contactTitle}</span>
                  <span className="text-[0.8125rem] md:text-[0.9375rem] xl:text-[1.0625rem] font-semibold text-white">{contactPhoneLabel}</span>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <ArrowRight className="h-4 w-4 md:h-4.5 md:w-4.5 xl:h-5 xl:w-5 text-white" strokeWidth={2.5} />
                </div>
              </a>
            </div>
          </div>
        </section>

        {ads.length > 0 && (
          <section id="ad" className="border-t border-[#e2e8f0] bg-white px-4 py-10 sm:px-6 sm:py-14">
            <div className="mx-auto w-full max-w-4xl">
              <h2 className="mb-6 text-center text-[1.0625rem] font-semibold text-[#0f172a] sm:mb-8 sm:text-[1.25rem]">
                {adSectionTitle ??
                  `We have handpicked ${ads.length} great offers, just for you.`}
              </h2>
              <div className="grid grid-cols-1 gap-5 sm:gap-6">
                {ads.map((ad, index) => (
                  <a
                    key={index}
                    href={replaceUtm(ad.link)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.06)] transition-shadow hover:shadow-[0_8px_24px_rgba(15,23,42,0.1)]"
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

  return (
    <main className="min-h-screen bg-[#f1f5f9]">
      <section id="thankyou" className="px-4 py-8 sm:px-6 sm:py-12 lg:py-16">
        <div className="mx-auto w-full max-w-[48rem]">
          <div className="overflow-hidden rounded-[1.25rem] border border-[#e2e8f0] bg-white shadow-[0_8px_30px_rgba(15,23,42,0.12)]">
            <div className="flex items-center justify-center bg-[#0f172a] px-6 py-4 sm:px-8 sm:py-5">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.25em] text-[#94a3b8]">
                Submission confirmed
              </p>
            </div>

            <div className="px-6 py-10 sm:px-10 sm:py-12">
              <div className="flex flex-col items-center text-center">
                <div className="mb-6 flex h-[4rem] w-[4rem] shrink-0 items-center justify-center rounded-full bg-[#ecfdf5] sm:mb-8 sm:h-[4.5rem] sm:w-[4.5rem]">
                  <Check className="h-8 w-8 text-[#059669] sm:h-9 sm:w-9" strokeWidth={2.5} />
                </div>
                <h1 className="text-[1.5rem] font-bold tracking-tight text-[#0f172a] sm:text-[1.75rem] md:text-[2rem]">
                  {title}
                </h1>
                <p className="mt-4 max-w-lg text-[0.9375rem] leading-[1.6] text-[#475569] sm:mt-5 sm:text-[1.0625rem] md:text-[1.125rem]">
                  {subtitle}
                </p>
              </div>

              {showBuyerLogo && buyer && buyer.trim() !== "" && (
                <div className="mt-8 border-t border-[#e2e8f0] pt-8 sm:mt-10">
                  <p className="mb-4 text-center text-[0.6875rem] font-medium uppercase tracking-wider text-[#64748b]">
                    Your matched partner
                  </p>
                  <Image
                    src={buyerLogoPath(buyer)}
                    alt={`${buyer} Logo`}
                    width={200}
                    height={100}
                    className="mx-auto h-14 w-auto object-contain"
                  />
                </div>
              )}

              <div className="mt-8 flex flex-col gap-4 sm:mt-10 sm:gap-5">
                {sendWelcomeEmail && (
                  <div className="rounded-xl border border-[#a7f3d0] bg-[#ecfdf5] px-5 py-4 text-left sm:px-6 sm:py-5">
                    <p className="text-[0.9375rem] font-semibold text-[#065f46]">
                      {confirmationTitle}
                    </p>
                    <p className="mt-2 text-[0.875rem] leading-[1.55] text-[#047857]">
                      {confirmationDescription}
                    </p>
                  </div>
                )}

                <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-5 py-4 text-left sm:px-6 sm:py-5">
                  <h2 className="text-[0.9375rem] font-semibold text-[#0f172a] text-center">
                    {contactTitle}
                  </h2>
                  <p className="mt-2 text-[0.875rem] leading-[1.55] text-[#475569] sm:text-[0.9375rem] text-center">
                    Call us at{" "}
                    <a
                      href={contactPhoneHref}
                      className="font-semibold text-[#0f2440] underline decoration-[#cbd5e1] underline-offset-2 hover:decoration-[#64748b] hover:text-[#1e293b]"
                    >
                      {contactPhoneLabel}
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {ads.length > 0 && (
        <section id="ad" className="border-t border-[#e2e8f0] bg-white px-4 py-10 sm:px-6 sm:py-14">
          <div className="mx-auto w-full max-w-4xl">
            <h2 className="mb-6 text-center text-[1.0625rem] font-semibold text-[#0f172a] sm:mb-8 sm:text-[1.25rem]">
              {adSectionTitle ??
                `We have handpicked ${ads.length} great offers, just for you.`}
            </h2>
            <div className="grid grid-cols-1 gap-5 sm:gap-6">
              {ads.map((ad, index) => (
                <a
                  key={index}
                  href={replaceUtm(ad.link)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.06)] transition-shadow hover:shadow-[0_8px_24px_rgba(15,23,42,0.1)]"
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
