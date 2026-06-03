"use client"

import React, { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { TrustedForm, getCookie } from "@workspace/lp-core"
import PartnerModal from "./Partners-model";
import { TextInput as TextInputUI } from "@workspace/ui/components/text-input"
import { SelectInput as SelectInputUI } from "@workspace/ui/components/select-input"
import { PhoneNumberInput as PhoneNumberInputUI } from "@workspace/ui/components/phone-number-input"
import { ZipCodeInput as ZipCodeInputUI } from "@workspace/ui/components/zip-code-input"
import { Button as ButtonUI } from "@workspace/ui/components/button"
import { RadioButtonGroup } from "@workspace/ui/components/radio-button-group"

const roofTypeOptions = [
  { value: "Sloped", label: "Sloped" },
  { value: "Flat", label: "Flat" },
]

const homeownerOptions = [
  { value: "Yes", label: "Yes" },
  { value: "No", label: "No" },
]

const inputIconClass = "absolute left-3 top-1/2 -translate-y-1/2 z-10 pointer-events-none w-4.5 h-4.5 "
const inputBaseClass =
  "w-full rounded-[10px] pl-9 pr-3 py-3 h-13 mt-0.5 border border-[#D1D5DB] bg-[#FBFBFC] placeholder:text-[#9CA3AF] placeholder:text-[0.8rem] md:placeholder:text-[0.75rem] lg:placeholder:text-sm"

type FormPageProps = {
  onClose?: () => void
  embedInModal?: boolean
}

export default function FormPage({ onClose, embedInModal }: FormPageProps = {}) {
  const router = useRouter()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [zipCode, setZipCode] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [isHomeowner, setIsHomeowner] = useState("")
  const [submitStatus, setSubmitStatus] = useState<"idle" | "loading" | "error">("idle")
  const [submitError, setSubmitError] = useState("")
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({})
  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false)

  const clearFieldError = useCallback((field: string) => {
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next[field]
      return next
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitError("")

    const errors: Partial<Record<string, string>> = {}
    // Apply error messages based on specific field validation, using the error style from @file_context_0:
    if (!firstName.trim()) errors.firstName = ""
    if (!lastName.trim()) errors.lastName = ""
    if (!email.trim()) errors.email = ""
    if (!zipCode.trim()) errors.zipCode = ""
    if (zipCode.replace(/\D/g, "").length !== 5) errors.zipCode = ""
    if (!phoneNumber.trim()) errors.phoneNumber = ""
    if (phoneNumber.replace(/\D/g, "").length < 10) errors.phoneNumber = ""

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setSubmitStatus("error")
      setSubmitError("")
      return
    }

    setFieldErrors({})
    setSubmitStatus("loading")

    const form = e.currentTarget
    const certInput = form.elements.namedItem("xxTrustedFormCertUrl") as HTMLInputElement | null

    const payload = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phoneNumber: phoneNumber.trim(),
      zipCode: zipCode.trim(),
      isHomeowner: isHomeowner || "",
      subid1: getCookie("subid1") ?? "",
      subid2: getCookie("subid2") ?? "",
      subid3: getCookie("subid3") ?? "",
      xxTrustedFormCertUrl: certInput?.value ?? "",
    }

    try {
      const res = await fetch("/api/submit-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      if (!res.ok) {
        setSubmitStatus("error")
        setSubmitError(data.error ?? "Submission failed")
        return
      }

      if (data.success && data.redirectUrl) {
        window.location.href = data.redirectUrl
        return
      }
      router.push(`/thankyou?email=${encodeURIComponent(email.trim())}`)
    } catch {
      setSubmitStatus("error")
      setSubmitError("Something went wrong. Please try again.")
    } finally {
      setSubmitStatus("idle")
    }
  }

  const formCard = (
    <div className={`w-full ${embedInModal ? "max-w-[440px]" : "lg:max-w-[440px] xl:max-w-[460px]"}`}>
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-[20px] py-6 px-4 md:px-5 md:py-7 flex flex-col gap-5 w-full h-full items-center justify-center md:justify-end relative"
        style={{
          boxShadow: "0px 0px 10px 0px rgba(31, 58, 95, 0.15)"
        }}
      >
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close form"
            className="absolute top-4 xl:top-3 xl:right-3 right-4 z-10 w-6 h-6 md:w-7 md:h-7 flex items-center justify-center rounded-full bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#374151] transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden className="w-4 h-4">
              <path d="M13.5 4.5L4.5 13.5M4.5 4.5L13.5 13.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
        <TrustedForm />
        <h2 id="form-popup-title" className="w-full text-lg xl:text-[22px] font-bold text-[#1F3A5F] text-center" style={{ lineHeight: "1.3" }}>
          Start Here For Your FREE Estimate
        </h2>

          <div className="w-full h-full flex flex-col gap-2.5">
            <div className="flex flex-col md:flex-row gap-2.5">
              <div className="relative flex-1">
                <div className={inputIconClass}>
                  <Image src="/user.svg" alt="" width={20} height={20} className="w-5 h-5" />
                </div>
                <TextInputUI
                  placeholder="First Name"
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value)
                    clearFieldError("firstName")
                  }}
                  error={fieldErrors.firstName}
                  containerClassName="mb-0"
                  className={inputBaseClass}
                />
              </div>
              <div className="relative flex-1">
                <div className={inputIconClass}>
                  <Image src="/user.svg" alt="" width={20} height={20} className="w-5 h-5" />
                </div>
                <TextInputUI
                  placeholder="Last Name"
                  value={lastName}
                  onChange={(e) => {
                    setLastName(e.target.value)
                    clearFieldError("lastName")
                  }}
                  error={fieldErrors.lastName}
                  containerClassName="mb-0"
                  className={inputBaseClass}
                />
              </div>
            </div>

            <div className="relative">
              <div className={inputIconClass}>
                <Image src="/email.svg" alt="" width={20} height={20} className="w-5 h-5" />
              </div>
              <TextInputUI
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  clearFieldError("email")
                }}
                error={fieldErrors.email}
                containerClassName="mb-0"
                className={inputBaseClass}
              />
            </div>

            <div className="flex flex-col md:flex-row gap-2.5">
              <div className="relative flex-1">
                <div className={inputIconClass}>
                  <Image src="/location.svg" alt="" width={20} height={20} className="w-5 h-5" />
                </div>
                <ZipCodeInputUI
                  placeholder="Zip Code"
                  value={zipCode}
                  onChange={(value) => {
                    setZipCode(value)
                    clearFieldError("zipCode")
                  }}
                  error={fieldErrors.zipCode}
                  containerClassName="mb-0"
                  className={inputBaseClass}
                />
              </div>
              <div className="relative flex-1">
                <div className={inputIconClass}>
                  <Image src="/call.svg" alt="" width={20} height={20} className="w-5 h-5" />
                </div>
                <PhoneNumberInputUI
                  placeholder="Phone Number"
                  value={phoneNumber}
                  onChange={(value) => {
                    setPhoneNumber(value)
                    clearFieldError("phoneNumber")
                  }}
                  error={fieldErrors.phoneNumber}
                  containerClassName="mb-0"
                  className={inputBaseClass}
                />
              </div>
            </div>

            <RadioButtonGroup
              name="isHomeowner"
              label="Are You a Homeowner?"
              options={homeownerOptions}
              value={isHomeowner}
              onChange={(value) => {
                setIsHomeowner(value)
                clearFieldError("isHomeowner")
              }}
              type="3"
              layout="row"
              labelClassName="text-sm font-medium text-[#374151]"
              containerClassName="mb-0"
              optionClassName="flex-1 flex justify-center items-center"
            />
          </div>

          {submitStatus === "error" && submitError && (
            <p className="text-sm text-red-600" role="alert">
              {submitError}
            </p>
          )}

          <ButtonUI
            type="1"
            htmlType="submit"
            disabled={submitStatus === "loading"}
            className="w-full h-14 my-0.5 bg-[#DC2626] text-white font-semibold text-base rounded-[10px] hover:bg-[#DC2626] cursor-pointer "
          >
            {submitStatus === "loading" ? "Submitting..." : "Get Pricing Now"}
          </ButtonUI>

          <p className="text-[0.68rem] xl:text-[0.75rem] text-[#111827] leading-relaxed ">
            By submitting this form, I agree to the United Roofing Experts{" "}
            <a
              href="/terms-of-use"
              className="text-[#0D74BA] hover:underline font-medium"
              target="_blank"
              rel="noopener noreferrer"
            >
              Terms of Use
            </a>{" "}
            and{" "}
            <a
              href="/privacy-policy"
              className="text-[#0D74BA] hover:underline font-medium"
              target="_blank"
              rel="noopener noreferrer"
            >
              Privacy Policy
            </a>
            . I authorize United Roofing Experts and its{" "}
            <button
              type="button"
              onClick={() => setIsPartnerModalOpen(true)}
              className="text-[#0D74BA] hover:underline font-medium cursor-pointer"
            >
              partners
            </button>{" "}
            to send me marketing text messages or phone calls at the number provided, including
            those made with an autodialer. Standard message and data rates may apply. Message
            frequency varies. Opt-out anytime by replying STOP or using the unsubscribe link.
          </p>
        </form>
      </div>
  )

  return (
    <>
      {embedInModal ? (
        <>
          {formCard}
          <PartnerModal isOpen={isPartnerModalOpen} onClose={() => setIsPartnerModalOpen(false)} />
        </>
      ) : (
        <div className="w-full h-full flex items-center md:justify-end justify-center">
          {formCard}
          <PartnerModal isOpen={isPartnerModalOpen} onClose={() => setIsPartnerModalOpen(false)} />
        </div>
      )}
    </>
  )
}


