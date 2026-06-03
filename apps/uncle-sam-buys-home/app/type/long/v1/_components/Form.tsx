"use client"

import { Suspense, useState, type FormEvent } from "react"
import Image from "next/image"
import { ProgressBar } from "@workspace/ui/components/progress-bar"
import { ZipCodeInput } from "@workspace/ui/components/zip-code-input"
import { TextInput } from "@workspace/ui/components/text-input"
import { PhoneNumberInput } from "@workspace/ui/components/phone-number-input"
import { TrustedForm, getCookie } from "@workspace/lp-core"
import CashOfferCard from "./Card"


const HOME_TYPE_OPTIONS = [
  { id: "single_family", label: "Single Family Home", Icon: "/family.svg" },
  { id: "condominium", label: "Condominium / Townhome", Icon: "/mall.svg" },
  { id: "mobile", label: "Mobile / Manufactured Home", Icon: "/car.svg" },
  { id: "vacant_land", label: "Vacant Land", Icon: "/land.svg" },
] as const

const PROPERTY_TYPE_OPTIONS = [
  { id: "needs_work", label: "Needs Work", Icon: "/house.svg" },
  { id: "fair", label: "Fair", Icon: "/broken-home.svg" },
  { id: "good", label: "Good", Icon: "/home-renovation.svg" },
  { id: "excellent", label: "Excellent", Icon: "/happy-house.svg" },
] as const

const PROPERTY_LIST_OPTIONS = [
  { id: "yes", label: "Yes", Icon: "/yes.svg" },
  { id: "no", label: "No", Icon: "/no.svg" },
] as const

const SELL_OPTIONS = [
  { id: "late", label: "Behind on Mortgage Payments", Icon: "/mortgage.svg" },
  { id: "job", label: "Job / Income Loss", Icon: "/briefcase.svg" },
  { id: "cash", label: "Need to Access Cash", Icon: "/cash.svg" },
  { id: "repairs", label: "Property Needs Repairs", Icon: "/house-repair.svg" },
  { id: "move", label: "Downsizing / Relocating", Icon: "/property-exchange.svg" },
  { id: "metrics", label: "Research Home Metrics", Icon: "/house-price.svg" }
] as const

const MONEY_OPTIONS = [
  { id: "asap", label: "ASAP", Icon: "/coming-soon.svg" },
  { id: "2_3_months", label: "2-3 Months", Icon: "/calendar-charge.svg" },
  { id: "6_months", label: "6 Months", Icon: "/clock-with-calendar.svg" },
  { id: "no_rush", label: "I Am In No Rush", Icon: "/calendar.svg" }
] as const

const CREDIT_OPTIONS = [
  { id: "poor", label: "Poor (559 Or Less)", Icon: "/poor.svg" },
  { id: "fair", label: "Fair (560–639)", Icon: "/fair.svg" },
  { id: "good", label: "Good (640–700)", Icon: "/good.svg" },
  { id: "excellent", label: "Excellent (701+)", Icon: "/excellant.svg" }
] as const



type HomeTypeId = (typeof HOME_TYPE_OPTIONS)[number]["id"]
type PropertyTypeId = (typeof PROPERTY_TYPE_OPTIONS)[number]["id"]
type PropertyListTypeId = (typeof PROPERTY_LIST_OPTIONS)[number]["id"]
type SellTypeId = (typeof SELL_OPTIONS)[number]["id"]
type MoneyTypeId = (typeof MONEY_OPTIONS)[number]["id"]
type CreditTypeId = (typeof CREDIT_OPTIONS)[number]["id"]

const HOUSE_VALUE_RANGES: { value: string; label: string }[] = [
  { value: "u100", label: "Under $100K" },
  { value: "100_150", label: "$100K to $150K" },
  { value: "150_200", label: "$150K to $200K" },
  { value: "200_250", label: "$200K to $250K" },
  { value: "250_300", label: "$250K to $300K" },
  { value: "300_350", label: "$300K to $350K" },
  { value: "350_400", label: "$350K to $400K" },
  { value: "400_450", label: "$400K to $450K" },
  { value: "450_500", label: "$450K to $500K" },
  { value: "500_550", label: "$500K to $550K" },
  { value: "550_600", label: "$550K to $600K" },
  { value: "600_700", label: "$600K to $700K" },
  { value: "700_800", label: "$700K to $800K" },
  { value: "800_900", label: "$800K to $900K" },
  { value: "900k_1m", label: "$900K to $1M" },
  { value: "1m_1_1", label: "$1M to $1.1M" },
  { value: "1_1_1_2", label: "$1.1M to $1.2M" },
  { value: "1_2_1_3", label: "$1.2M to $1.3M" },
  { value: "1_3_1_4", label: "$1.3M to $1.4M" },
  { value: "1_4_1_5", label: "$1.4M to $1.5M" },
  { value: "1_5m_plus", label: "$1.5M+" },
]

const TOTAL_STEPS = 10

const defaultFormData = {
  homeType: "condominium" as HomeTypeId,
  zipCode: "",
  propertyType: "needs_work" as PropertyTypeId,
  propertyList: "yes" as PropertyListTypeId,
  sell: "late" as SellTypeId,
  money: "asap" as MoneyTypeId,
  credit: "poor" as CreditTypeId,
  houseValueRange: "500_550",
  first_name: "",
  last_name: "",
  phone_number: "",
  email: "",
  street_address: "",
}

type FormNavigationProps = {
  showBack?: boolean
  showNext?: boolean
  isNextDisabled?: boolean
  nextLabel?: string
  onNext: () => void
  onBack: () => void
}

function FormNavigation({
  showBack = false,
  showNext = true,
  isNextDisabled = false,
  nextLabel = "Next",
  onNext,
  onBack,
}: FormNavigationProps) {
  return (
    <div className="flex w-full max-w-2xl flex-col items-center justify-center gap-4 md:gap-5 ">
      {showNext && (
        <button
          type="button"
          onClick={onNext}
          disabled={isNextDisabled}
          className="w-full max-w-[270px] md:max-w-[180px] xl:max-w-[190px] rounded-[10px] bg-[#C12026] cursor-pointer py-3 text-base xl:text-[1.05rem] font-medium text-white transition-all duration-300 md:py-3.5 "


        >
          {nextLabel}
        </button>
      )}
      {showBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-[0.9rem] xl:text-base cursor-pointer font-semibold text-[#47514F] transition-colors hover:text-[#374151]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 16 16" fill="none" className="w-4 h-4 lg:w-4.5 lg:h-4.5 xl:w-5 xl:h-5 text-[#47514F]">
            <path d="M6.66667 4.66669C6.66667 4.86669 6.6 5.00002 6.46667 5.13335L3.13333 8.46669C2.86667 8.73335 2.46667 8.73335 2.2 8.46669C1.93333 8.20002 1.93333 7.80002 2.2 7.53335L5.53333 4.20002C5.8 3.93335 6.2 3.93335 6.46667 4.20002C6.6 4.33335 6.66667 4.46669 6.66667 4.66669Z" fill="#47514F" />
            <path d="M6.66667 11.3333C6.66667 11.5333 6.6 11.6667 6.46667 11.8C6.2 12.0667 5.8 12.0667 5.53333 11.8L2.2 8.46667C1.93333 8.2 1.93333 7.8 2.2 7.53333C2.46667 7.26667 2.86667 7.26667 3.13333 7.53333L6.46667 10.8667C6.6 11 6.66667 11.1333 6.66667 11.3333Z" fill="#47514F" />
            <path d="M14 8.00002C14 8.40002 13.7333 8.66669 13.3333 8.66669H2.66667C2.26667 8.66669 2 8.40002 2 8.00002C2 7.60002 2.26667 7.33335 2.66667 7.33335H13.3333C13.7333 7.33335 14 7.60002 14 8.00002Z" fill="#47514F" />
          </svg> Back

        </button>
      )}
    </div>
  )
}

function FormPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState(defaultFormData)
  const [houseValueIndex, setHouseValueIndex] = useState(() => {
    const idx = HOUSE_VALUE_RANGES.findIndex((r) => r.value === defaultFormData.houseValueRange)
    return idx >= 0 ? idx : 9
  })

  const [submitStatus, setSubmitStatus] = useState<"idle" | "loading" | "error">("idle")
  const [submitError, setSubmitError] = useState("")

  const handleInputChange = (field: keyof typeof defaultFormData, value: string) => {
    if (field === "zipCode") {
      value = value.replace(/\D/g, "").slice(0, 5)
    }
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const isStepValid = () => {
    if (currentStep === 2) {
      return formData.zipCode.length === 5
    }
    if (currentStep === 9) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      return (
        formData.first_name.trim() !== "" &&
        formData.last_name.trim() !== "" &&
        formData.email.trim() !== "" &&
        emailRegex.test(formData.email.trim())
      )
    }
    return true
  }

  const handleNext = () => {
    if (!isStepValid() || currentStep >= TOTAL_STEPS) return
    setCurrentStep((prev) => prev + 1)
  }

  const handleBack = () => {
    if (currentStep <= 1) return
    setCurrentStep((prev) => prev - 1)
  }

  const handleLeadSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (currentStep !== TOTAL_STEPS) {
      if (currentStep === 2 && isStepValid()) {
        handleNext()
      } else if (currentStep === 9 && isStepValid()) {
        handleNext()
      }
      return
    }

    setSubmitError("")

    const zip = formData.zipCode.trim()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const email = formData.email.trim()

    if (
      !formData.first_name.trim() ||
      !formData.last_name.trim() ||
      !formData.street_address.trim() ||
      !email ||
      !emailRegex.test(email) ||
      !formData.phone_number.trim() ||
      !zip
    ) {
      setSubmitStatus("error")
      setSubmitError("Please complete all required fields with valid details.")
      return
    }

    setSubmitStatus("loading")

    const form = e.currentTarget
    const certInput = form.elements.namedItem("xxTrustedFormCertUrl") as HTMLInputElement | null
    const tokenInput = form.elements.namedItem("xxTrustedFormToken") as HTMLInputElement | null

    const payload = {
      homeType: formData.homeType,
      zipCode: zip,
      propertyType: formData.propertyType,
      propertyList: formData.propertyList,
      sell: formData.sell,
      money: formData.money,
      credit: formData.credit,
      houseValueRange: formData.houseValueRange,
      firstName: formData.first_name.trim(),
      lastName: formData.last_name.trim(),
      address: formData.street_address.trim(),
      city: "",
      state: "",
      email: formData.email.trim(),
      phoneNumber: formData.phone_number.trim(),
      subid1: getCookie("subid1") ?? "",
      subid2: getCookie("subid2") ?? "",
      subid3: getCookie("subid3") ?? "",
      xxTrustedFormCertUrl: certInput?.value ?? "",
      xxTrustedFormToken: tokenInput?.value ?? "",
    }

    try {
      const res = await fetch("/api/submit-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as {
        error?: string
        success?: boolean
        redirectUrl?: string
        field?: string
      }

      if (!res.ok) {
        setSubmitStatus("error")
        setSubmitError(typeof data.error === "string" ? data.error : "Submission failed")
        return
      }

      if (data.success && typeof data.redirectUrl === "string") {
        window.location.href = data.redirectUrl
        return
      }

      setSubmitStatus("idle")
    } catch {
      setSubmitStatus("error")
      setSubmitError("Something went wrong. Please try again.")
    }
  }

  return (
    <div className="w-full min-h-[400px] lg:min-h-[460px] xl:min-h-[580px] flex flex-col items-center justify-center gap-10 md:gap-10 xl:gap-13">
      <h2 className="text-xl lg:text-2xl xl:text-3xl font-bold text-[#182542]  text-center">
        Need to Sell Quickly? Get a Cash Offer Now for Your Home Today!
      </h2>
      <div className="flex w-full flex-col justify-center items-center gap-3">
        <div className="w-full md:max-w-lg xl:max-w-[610px] flex justify-center items-center">
          <ProgressBar
            type="8"
            currentStep={currentStep}
            totalSteps={TOTAL_STEPS}
            backgroundColor="#C1202633"

            foregroundColor="#C12026"
          />
        </div>
        <form
          onSubmit={handleLeadSubmit}
          className="w-full flex flex-col justify-center items-center gap-6 xl:gap-8"
          noValidate
        >
          <TrustedForm />
          {currentStep === 1 && (
            <>
              <h2 className="text-center text-base xl:text-xl font-medium text-[#1C1C1C]">
                Confirm Your Home Type
              </h2>

              <div className="grid grid-cols-2 gap-3 md:gap-4 xl:gap-5 md:max-w-lg xl:max-w-2xl">
                {HOME_TYPE_OPTIONS.map(({ id, label, Icon }) => {
                  const selected = formData.homeType === id
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, homeType: id }))
                        setCurrentStep(2)
                      }}
                      aria-pressed={selected}
                      className="cursor-pointer flex flex-col items-center justify-start gap-4 xl:gap-5 rounded-[10px] border border-[#102E50] bg-white px-3 py-5 text-center transition-colors hover:bg-[#fde9ea] md:px-4 md:py-6 xl:px-6 xl:py-8"
                    >
                      <span className="flex shrink-0 items-center justify-center">
                        <Image
                          src={Icon}
                          alt=""
                          width={48}
                          height={48}
                          aria-hidden
                          className="h-9.5 w-9.5 md:h-10 md:w-10 xl:h-14 xl:w-14 object-contain"
                        />
                      </span>
                      <span className="text-[0.85rem] xl:text-base font-semibold leading-normal text-[#343434]">
                        {label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {currentStep === 2 && (
            <>
              <div className="w-full  md:max-w-sm xl:max-w-xl flex flex-col justify-center items-center gap-5 md:gap-6">
                <ZipCodeInput
                  id="zipCode"
                  label="Zip Code"
                  value={formData.zipCode}
                  onChange={(v) => handleInputChange("zipCode", v)}
                  placeholder="Please Enter Zip Code"
                  containerClassName="w-full md:max-w-[270px] lg:max-w-[320px] "
                  labelClassName="text-sm xl:text-base font-medium text-[#1C1C1C]"
                  className="h-14 xl:h-15 mt-2 w-full rounded-[5px] border border-[#102E50] bg-white px-4 text-sm xl:text-base text-[#111827] placeholder:text-[#8F8E93] focus:border-[#102E50] focus:outline-none"
                />

                <FormNavigation
                  showBack
                  showNext
                  isNextDisabled={!isStepValid()}
                  onNext={handleNext}
                  onBack={handleBack}
                />
              </div>


            </>
          )}

          {currentStep === 3 && (
            <>
              <h2 className="text-center text-base xl:text-xl font-medium text-[#1C1C1C] ">
                Tell Us About Your Property!
              </h2>

              <div className="w-full grid grid-cols-2 gap-3 md:gap-4 xl:gap-5 md:max-w-lg xl:max-w-[610px]">
                {PROPERTY_TYPE_OPTIONS.map(({ id, label, Icon }) => {
                  const selected = formData.propertyType === id
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, propertyType: id }))
                        setCurrentStep(4)
                      }}
                      aria-pressed={selected}
                      className="cursor-pointer flex flex-col items-center justify-center gap-4 xl:gap-5 rounded-[10px] border border-[#102E50] bg-white px-3 py-5 text-center transition-colors hover:bg-[#fde9ea] md:px-4 md:py-6 xl:px-6 xl:py-8"
                    >
                      <span className="flex shrink-0 items-center justify-center">
                        <Image
                          src={Icon}
                          alt=""
                          width={48}
                          height={48}
                          aria-hidden
                          className="h-9.5 w-9.5 md:h-10 md:w-10 xl:h-14 xl:w-14 object-contain"
                        />
                      </span>
                      <span className="text-[0.85rem] xl:text-base font-semibold leading-normal text-[#343434]">
                        {label}
                      </span>
                    </button>
                  )
                })}
              </div>
              <FormNavigation showBack showNext={false} onNext={handleNext} onBack={handleBack} />
            </>
          )}

          {currentStep === 4 && (
            <>
              <h2 className="text-center text-base xl:text-xl font-medium text-[#1C1C1C] ">
                Is Your House Already Listed on the MLS?
              </h2>

              <div className="w-full grid grid-cols-2 gap-3 md:gap-4 xl:gap-5 md:max-w-md xl:max-w-[610px]">
                {PROPERTY_LIST_OPTIONS.map(({ id, label, Icon }) => {
                  const selected = formData.propertyList === id
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, propertyList: id }))
                        setCurrentStep(5)
                      }}
                      aria-pressed={selected}
                      className="cursor-pointer flex flex-col items-center justify-center gap-4 xl:gap-5 rounded-[10px] border border-[#102E50] bg-white px-3 py-5 text-center transition-colors hover:bg-[#fde9ea] md:px-4 md:py-7 xl:px-6 xl:py-10"
                    >
                      <span className="flex shrink-0 items-center justify-center">
                        <Image
                          src={Icon}
                          alt=""
                          width={48}
                          height={48}
                          aria-hidden
                          className="h-5 w-5 xl:h-7 xl:w-7 object-contain"
                        />
                      </span>
                      <span className="text-[0.85rem] lg:text-base xl:text-lg font-semibold leading-normal text-[#343434]">
                        {label}
                      </span>
                    </button>
                  )
                })}
              </div>
              <FormNavigation showBack showNext={false} onNext={handleNext} onBack={handleBack} />
            </>
          )}
          {currentStep === 5 && (
            <>
              <h2 className="text-center text-base xl:text-xl font-medium text-[#1C1C1C] ">
                Why Do You Want To Sell?
              </h2>

              <div className="w-full grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 xl:gap-5 md:max-w-lg lg:max-w-2xl xl:max-w-5xl">
                {SELL_OPTIONS.map(({ id, label, Icon }) => {
                  const selected = formData.sell === id
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, sell: id }))
                        setCurrentStep(6)
                      }}
                      aria-pressed={selected}
                      className="cursor-pointer flex flex-col items-center justify-start gap-4 xl:gap-5 rounded-[10px] border border-[#102E50] bg-white px-3 py-5 text-center transition-colors hover:bg-[#fde9ea] md:px-4 md:py-6 xl:px-6 xl:py-8"
                    >
                      <span className="flex shrink-0 items-center justify-center">
                        <Image
                          src={Icon}
                          alt=""
                          width={48}
                          height={48}
                          aria-hidden
                          className="h-9.5 w-9.5 md:h-10 md:w-10 xl:h-14 xl:w-14 object-contain"
                        />
                      </span>
                      <span className="text-[0.85rem] xl:text-base font-semibold leading-normal text-[#343434]">
                        {label}
                      </span>
                    </button>
                  )
                })}
              </div>
              <FormNavigation showBack showNext={false} onNext={handleNext} onBack={handleBack} />
            </>
          )}
          {currentStep === 6 && (
            <>
              <h2 className="text-center text-base xl:text-xl font-medium text-[#1C1C1C] ">
                How Soon Do You Want Your Money?
              </h2>

              <div className="w-full grid grid-cols-2 gap-3 md:gap-4 xl:gap-5 md:max-w-lg xl:max-w-[610px]">
                {MONEY_OPTIONS.map(({ id, label, Icon }) => {
                  const selected = formData.money === id
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, money: id }))
                        setCurrentStep(7)
                      }}
                      aria-pressed={selected}
                      className="cursor-pointer flex flex-col items-center justify-start gap-4 xl:gap-5 rounded-[10px] border border-[#102E50] bg-white px-3 py-5 text-center transition-colors hover:bg-[#fde9ea] md:px-4 md:py-6 xl:px-6 xl:py-8"
                    >
                      <span className="flex shrink-0 items-center justify-center">
                        <Image
                          src={Icon}
                          alt=""
                          width={48}
                          height={48}
                          aria-hidden
                          className="h-9.5 w-9.5 md:h-10 md:w-10 xl:h-14 xl:w-14 object-contain"
                        />
                      </span>
                      <span className="text-[0.85rem] xl:text-base font-semibold leading-normal text-[#343434]">
                        {label}
                      </span>
                    </button>
                  )
                })}
              </div>
              <FormNavigation showBack showNext={false} onNext={handleNext} onBack={handleBack} />
            </>
          )}

          {currentStep === 7 && (
            <>
              <h2 className="text-center text-base xl:text-xl font-medium text-[#1C1C1C] ">
                How Would You Rate Your Credit?
              </h2>

              <div className="w-full grid grid-cols-2 gap-3 md:gap-4 xl:gap-5 md:max-w-lg xl:max-w-[610px]">
                {CREDIT_OPTIONS.map(({ id, label, Icon }) => {
                  const selected = formData.credit === id
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, credit: id }))
                        setCurrentStep(8)
                      }}
                      aria-pressed={selected}
                      className="cursor-pointer flex flex-col items-center justify-start gap-4 xl:gap-5 rounded-[10px] border border-[#102E50] bg-white px-3 py-5 text-center transition-colors hover:bg-[#fde9ea] md:px-4 md:py-6 xl:px-6 xl:py-8"
                    >
                      <span className="flex shrink-0 items-center justify-center">
                        <Image
                          src={Icon}
                          alt=""
                          width={48}
                          height={48}
                          aria-hidden
                          className="h-9.5 w-9.5 md:h-10 md:w-10 xl:h-14 xl:w-14 object-contain"
                        />
                      </span>
                      <span className="text-[0.85rem] xl:text-base font-semibold leading-normal text-[#343434]">
                        {label}
                      </span>
                    </button>
                  )
                })}
              </div>
              <FormNavigation showBack showNext={false} onNext={handleNext} onBack={handleBack} />
            </>
          )}


          {currentStep === 8 && (
            <>
              <div className="flex w-full flex-col items-center justify-center text-center gap-5 md:gap-6 xl:gap-8 mb-3 lg:mb-4 xl:mb-6">
                <h2 className=" text-base xl:text-xl font-medium text-[#1C1C1C]">
                  Estimate House Value
                </h2>
                <p className=" text-xl font-medium text-[#182542] md:text-2xl xl:text-3xl xl:mb-3">
                  {HOUSE_VALUE_RANGES[houseValueIndex]?.label ?? ""}
                </p>
                <div className="mb-2 w-full md:max-w-lg lg:max-w-xl xl:max-w-3xl">
                  <input
                    type="range"
                    min={0}
                    max={HOUSE_VALUE_RANGES.length - 1}
                    step={1}
                    value={houseValueIndex}
                    aria-label="Estimated house value range"
                    onChange={(e) => {
                      const idx = Number(e.target.value)
                      setHouseValueIndex(idx)
                      const v = HOUSE_VALUE_RANGES[idx]?.value ?? ""
                      setFormData((prev) => ({ ...prev, houseValueRange: v }))
                    }}
                    className="h-2 xl:h-2.5 w-full cursor-pointer appearance-none rounded-full bg-[#E5E7EB] accent-[#182542] [&::-webkit-slider-thumb]:size-5.5 xl:[&::-webkit-slider-thumb]:size-7 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-3 xl:[&::-webkit-slider-thumb]:border-3.5 [&::-webkit-slider-thumb]:border-[#182542] [&::-webkit-slider-thumb]:bg-white [&::-moz-range-thumb]:size-5.5 xl:[&::-moz-range-thumb]:size-7 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-3 xl:[&::-moz-range-thumb]:border-3.5 [&::-moz-range-thumb]:border-[#182542] [&::-moz-range-thumb]:bg-white"
                    style={{
                      background:
                        HOUSE_VALUE_RANGES.length <= 1
                          ? "#102E50"
                          : `linear-gradient(to right, #102E50 0%, #102E50 ${(houseValueIndex / (HOUSE_VALUE_RANGES.length - 1)) * 100}%, #E5E7EB ${(houseValueIndex / (HOUSE_VALUE_RANGES.length - 1)) * 100}%, #E5E7EB 100%)`,
                    }}
                  />
                  <div className="mt-2 flex w-full justify-between text-xs font-medium text-[#343434] xl:text-sm">
                    <span>Under $100K</span>
                    <span>$1.5M+</span>
                  </div>
                </div>
              </div>

              <div className="flex w-full flex-col items-center justify-center gap-5 md:gap-6 md:max-w-sm xl:max-w-xl">
                <FormNavigation
                  showBack
                  showNext
                  isNextDisabled={!isStepValid()}
                  onNext={handleNext}
                  onBack={handleBack}
                />
              </div>
            </>
          )}

          {currentStep === 9 && (
            <>
              <div className="w-full  md:max-w-sm xl:max-w-xl flex flex-col justify-center items-center gap-5 xl:gap-6">
                <div className="w-full md:max-w-xs xl:max-w-sm space-y-2.5 lg:space-y-3 xl:space-y-4.5  text-left mb-3">
                  <TextInput
                    id="step6FirstName"
                    label="First Name"
                    value={formData.first_name}
                    onChange={(e) => handleInputChange("first_name", e.target.value)}
                    placeholder="Enter First Name"
                    labelClassName="text-sm xl:text-base font-medium text-[#1C1C1C]"
                    className="h-14 xl:h-15 mt-2 w-full rounded-[5px] border border-[#102E50] bg-white px-4 text-sm xl:text-base text-[#111827] placeholder:text-[#8F8E93] focus:border-[#102E50] focus:outline-none"
                  />
                  <TextInput
                    id="step6LastName"
                    label="Last Name"
                    value={formData.last_name}
                    onChange={(e) => handleInputChange("last_name", e.target.value)}
                    placeholder="Enter Last Name"
                    labelClassName="text-sm xl:text-base font-medium text-[#1C1C1C]"
                    className="h-14 xl:h-15 mt-2 w-full rounded-[5px] border border-[#102E50] bg-white px-4 text-sm xl:text-base text-[#111827] placeholder:text-[#8F8E93] focus:border-[#102E50] focus:outline-none"
                  />

                  <TextInput
                    id="email"
                    label="Email Address"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    placeholder="Enter Email Address"
                    labelClassName="text-sm xl:text-base font-medium text-[#1C1C1C]"
                    className="h-14 xl:h-15 mt-2 w-full rounded-[5px] border border-[#102E50] bg-white px-4 text-sm xl:text-base text-[#111827] placeholder:text-[#8F8E93] focus:border-[#102E50] focus:outline-none"
                  />
                </div>

                <FormNavigation
                  showBack
                  showNext
                  isNextDisabled={!isStepValid()}
                  onNext={handleNext}
                  onBack={handleBack}
                />
              </div>
            </>
          )}

          {currentStep === TOTAL_STEPS && (
            <>
              <div className="w-full  md:max-w-sm xl:max-w-xl flex flex-col justify-center items-center gap-5 xl:gap-6">
                <div className="w-full md:max-w-xs xl:max-w-sm space-y-3 lg:space-y-3 xl:space-y-5 text-left mb-3 ">
                  <div className="w-full ">
                  <TextInput
                    id="propertyAddress"
                    label="Street Address"
                    value={formData.street_address}
                    onChange={(e) => handleInputChange("street_address", e.target.value)}
                    placeholder="Enter Street Address"
                    labelClassName="text-sm xl:text-base font-medium text-[#1C1C1C]"
                    className="h-14 xl:h-15 mt-2 w-full rounded-[5px] border border-[#102E50] bg-white px-4 text-sm xl:text-base text-[#111827] placeholder:text-[#8F8E93] focus:border-[#102E50] focus:outline-none"

                    
                  />
                  <div className="w-full mt-3 md:mt-2.5 ">
                    <p className="text-[0.7rem] xl:text-[0.8rem] mb-1 font-medium text-left text-[#1C1C1C]">NEW YORK, NY, 10001</p>
                  </div>
                  </div>

                  <PhoneNumberInput
                    id="phoneNumber"
                    label="Phone Number"
                    value={formData.phone_number}
                    onChange={(v) => handleInputChange("phone_number", v)}
                    placeholder="Enter Phone Number"
                    labelClassName="text-sm xl:text-base font-medium text-[#1C1C1C]"
                    className="h-14 xl:h-15 mt-2 w-full rounded-[5px] border border-[#102E50] bg-white px-4 text-sm xl:text-base text-[#111827] placeholder:text-[#8F8E93] focus:border-[#102E50] focus:outline-none"
                  />
           
                  <div className="w-full mt-6 xl:mt-7 flex flex-col items-center justify-center gap-5 xl:gap-7">
                  <p className="text-xs xl:text-[0.85rem] font-normal text-left text-[#343434]" style={{lineHeight: "1.6"}}>
                    By clicking the button below, you acknowledge, consent, and agree to our terms at the bottom of this page.
                  </p>

                  {submitStatus === "error" && submitError ? (
                    <p className="text-sm text-red-600" role="alert">
                      {submitError}
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    disabled={submitStatus === "loading"}
                    className="w-full h-13 xl:h-15  rounded-[10px] bg-[#C12026] cursor-pointer py-3 text-sm xl:text-lg font-medium uppercase text-white transition-all duration-300 md:py-3.5 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {submitStatus === "loading" ? "Submitting..." : "See My Instant Cash Offer"}
                  </button>

                  <p className="text-xs xl:text-[0.85rem] mb-1 font-normal text-left text-[#343434]" style={{lineHeight: "1.6"}}>
                    By clicking &quot;SEE MY INSTANT CASH OFFER&quot; you electronically sign (pursuant to the ESIGN Act) and agree: to share your information with up to  <strong>2 partners</strong>; that you are providing your prior express written consent for those <strong>partners</strong> to contact you at the telephone number you provided (including through an automatic telephone dialing system, pre-recorded or artificial voice, AI, SMS and MMS) even if your telephone number is listed on any state, federal or corporate Do Not Call list; you agree to our <a href="/terms-of-use" className="text-[#343434] font-bold " target="_blank" rel="noopener noreferrer">Terms of Use</a>, including its <strong>Arbitration provision</strong>, and <a href="/privacy-policy" className="text-[#343434] font-bold " target="_blank" rel="noopener noreferrer">Privacy Policy</a>; and that we can use your data for marketing and analytics. Your consent, and e-signature, is not a condition of accessing our services, as you may email consent@unclesambuyshome.com and you can revoke your consent at any time by emailing us
                  </p>
                  </div>
                </div>

                <FormNavigation showBack showNext={false} onNext={handleNext} onBack={handleBack} />
              </div>
            </>
          )}

          <CashOfferCard />
        </form>
      </div>
    </div>
  )
}

export default function Form() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white">
          <div className="text-base font-semibold text-[#102E50] md:text-lg">Loading...</div>
        </div>
      }
    >
      <FormPage />
    </Suspense>
  )
}
