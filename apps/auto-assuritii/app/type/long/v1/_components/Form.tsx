"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { TextInput as TextInputUI } from "@workspace/ui/components/text-input"
import { SelectInput as SelectInputUI } from "@workspace/ui/components/select-input"
import { PhoneNumberInput as PhoneNumberInputUI } from "@workspace/ui/components/phone-number-input"
import { ZipCodeInput as ZipCodeInputUI } from "@workspace/ui/components/zip-code-input"
import { Button as ButtonUI } from "@workspace/ui/components/button"
import { CarTaxiFront, UserRoundPen } from "lucide-react"
import {
  TrustedForm,
  getCookie,
  arohaaTrackFormStart,
  arohaaTrackFormSuccess,
} from "@workspace/lp-core"
import { FORM_CONTENT } from "@/lib/constant"

type SelectOption = { value: string; label: string }

export default function Form() {
  const [carYear, setCarYear] = useState("")
  const [carMake, setCarMake] = useState("")
  const [carModel, setCarModel] = useState("")
  const [currentMileage, setCurrentMileage] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [zipCode, setZipCode] = useState("")

  const [yearOptions, setYearOptions] = useState<SelectOption[]>([])
  const [makeOptions, setMakeOptions] = useState<SelectOption[]>([])
  const [modelOptions, setModelOptions] = useState<SelectOption[]>([])

  const [yearsLoading, setYearsLoading] = useState(true)
  const [makesLoading, setMakesLoading] = useState(false)
  const [modelsLoading, setModelsLoading] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<"idle" | "loading" | "error">("idle")
  const [submitError, setSubmitError] = useState("")
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({})

  const clearFieldError = useCallback((field: string) => {
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next[field]
      return next
    })
  }, [])

  const makesCache = useRef<Record<string, SelectOption[]>>({})
  const modelsCache = useRef<Record<string, SelectOption[]>>({})
  const formStartedRef = useRef(false)

  const markFormStarted = useCallback(() => {
    if (formStartedRef.current) return
    formStartedRef.current = true
    arohaaTrackFormStart()
  }, [])

  useEffect(() => {
    let cancelled = false
    setYearsLoading(true)
    fetch("/api/vehicle/years")
      .then((res) => res.json())
      .then((data: SelectOption[]) => {
        const options = Array.isArray(data) ? data : []
        if (!cancelled) setYearOptions(options)
        const currentYear = String(new Date().getFullYear())
        if (!cancelled && options.some((o) => o.value === currentYear)) {
          fetch(`/api/vehicle/makes?year=${encodeURIComponent(currentYear)}`)
            .then((r) => r.json())
            .then((makes: SelectOption[]) => {
              if (!cancelled) {
                makesCache.current[currentYear] = Array.isArray(makes) ? makes : []
              }
            })
            .catch(() => {})
        }
      })
      .catch(() => {
        if (!cancelled) setYearOptions([])
      })
      .finally(() => {
        if (!cancelled) setYearsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!carYear) {
      setMakeOptions([])
      setCarMake("")
      setCarModel("")
      setModelOptions([])
      return
    }
    const cached = makesCache.current[carYear]
    if (cached !== undefined) {
      setMakeOptions(cached)
      setCarMake("")
      setCarModel("")
      setModelOptions([])
      return
    }
    let cancelled = false
    setMakesLoading(true)
    setCarMake("")
    setCarModel("")
    setModelOptions([])
    fetch(`/api/vehicle/makes?year=${encodeURIComponent(carYear)}`)
      .then((res) => res.json())
      .then((data: SelectOption[]) => {
        const options = Array.isArray(data) ? data : []
        if (!cancelled) {
          makesCache.current[carYear] = options
          setMakeOptions(options)
        }
      })
      .catch(() => {
        if (!cancelled) setMakeOptions([])
      })
      .finally(() => {
        if (!cancelled) setMakesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [carYear])

  useEffect(() => {
    if (!carMake) {
      setModelOptions([])
      setCarModel("")
      return
    }
    const cached = modelsCache.current[carMake]
    if (cached !== undefined) {
      setModelOptions(cached)
      setCarModel("")
      return
    }
    let cancelled = false
    setModelsLoading(true)
    setCarModel("")
    fetch(`/api/vehicle/models?makeId=${encodeURIComponent(carMake)}`)
      .then((res) => res.json())
      .then((data: SelectOption[]) => {
        const options = Array.isArray(data) ? data : []
        if (!cancelled) {
          modelsCache.current[carMake] = options
          setModelOptions(options)
        }
      })
      .catch(() => {
        if (!cancelled) setModelOptions([])
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [carMake])

  const handleYearChange = useCallback(
    (value: string) => {
      setCarYear(value)
      clearFieldError("carYear")
    },
    [clearFieldError]
  )

  const handleMakeChange = useCallback(
    (value: string) => {
      setCarMake(value)
      clearFieldError("carMake")
    },
    [clearFieldError]
  )

  const handleModelChange = useCallback(
    (value: string) => {
      setCarModel(value)
      clearFieldError("carModel")
    },
    [clearFieldError]
  )

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    markFormStarted()
    setSubmitError("")

    const errors: Partial<Record<string, string>> = {}
    if (!carYear.trim()) errors.carYear = ""
    if (!carMake.trim()) errors.carMake = ""
    if (!carModel.trim()) errors.carModel = ""
    if (!currentMileage.trim()) errors.currentMileage = ""
    if (!firstName.trim()) errors.firstName = ""
    if (!lastName.trim()) errors.lastName = ""
    if (!email.trim()) errors.email = ""
    if (!phoneNumber.trim()) errors.phoneNumber = ""
    if (!zipCode.trim()) errors.zipCode = ""

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
    const tokenInput = form.elements.namedItem("xxTrustedFormToken") as HTMLInputElement | null

    const payload = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phoneNumber: phoneNumber.trim(),
      zipCode: zipCode.trim(),
      carYear,
      carMake,
      carModel,
      currentMileage: currentMileage.trim(),
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
      const data = await res.json()

      if (!res.ok) {
        setSubmitStatus("error")
        const msg = (data.error as string | undefined) ?? "Submission failed"
        if (data.invalidField === "email") {
          setFieldErrors((prev) => ({ ...prev, email: msg }))
          setSubmitError("")
        } else if (data.field === "phoneNumber") {
          setFieldErrors((prev) => ({ ...prev, phoneNumber: msg }))
          setSubmitError("")
        } else {
          setFieldErrors({})
          setSubmitError(msg)
        }
        return
      }

      if (data.success && data.redirectUrl) {
        arohaaTrackFormSuccess()
        window.location.href = data.redirectUrl
        return
      }
      setSubmitStatus("idle")
    } catch {
      setSubmitStatus("error")
      setSubmitError("Something went wrong. Please try again.")
    }
  }

  const makePlaceholder = !carYear
    ? "Select year first"
    : makesLoading
      ? "Loading..."
      : FORM_CONTENT.fields.carMake.placeholder

  const modelPlaceholder = !carMake
    ? "Select make first"
    : modelsLoading
      ? "Loading..."
      : FORM_CONTENT.fields.carModel.placeholder

  return (
    <div className="w-full max-w-4xl overflow-hidden rounded-[10px] border border-[#1F3A5F] shadow-[4px_4px_20px_0_rgba(17,24,39,0.20)]">
      <form
        onSubmit={handleSubmit}
        onPointerDownCapture={markFormStarted}
        className="form w-full flex flex-col items-center justify-center gap-4 font-sans"
      >
        <TrustedForm />
        <h2 className="text-base md:text-lg xl:text-xl w-full font-medium text-white bg-[#1F3A5F] text-center font-sans py-3 px-4 md:py-4 md:px-5">
          {FORM_CONTENT.header}
        </h2>

        <div className="w-full flex flex-col gap-3.5 px-4">
          <div className="inline-flex items-center gap-1.5 bg-[#E8F0FA] rounded-[16px] px-2.5 py-1 w-fit">
            <CarTaxiFront className="w-4 h-4 text-[#0F2440]" />
            <span className="text-[0.75rem] font-semibold text-[#0F2440] uppercase tracking-wide font-sans">
              {FORM_CONTENT.tabs.vehicleDetails}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SelectInputUI
              label={FORM_CONTENT.fields.carYear.label}
              placeholder={
                yearsLoading ? "Loading..." : FORM_CONTENT.fields.carYear.placeholder
              }
              options={yearOptions}
              value={carYear}
              onChange={handleYearChange}
              searchable
              searchPlaceholder="Search options..."
              disabled={yearsLoading}
              error={fieldErrors.carYear}
              className="rounded-[6px] px-3 py-3 mt-0.5 border border-[#D1D5DB] bg-[#FBFBFC] placeholder:text-[#9CA3AF] placeholder:text-sm"
            />
            <SelectInputUI
              label={FORM_CONTENT.fields.carMake.label}
              placeholder={makePlaceholder}
              options={makeOptions}
              value={carMake}
              onChange={handleMakeChange}
              searchable
              searchPlaceholder="Search options..."
              disabled={!carYear || makesLoading}
              error={fieldErrors.carMake}
              className="rounded-[6px] px-3 py-3 mt-0.5 border border-[#D1D5DB] bg-[#FBFBFC] placeholder:text-[#9CA3AF] placeholder:text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SelectInputUI
              label={FORM_CONTENT.fields.carModel.label}
              placeholder={modelPlaceholder}
              options={modelOptions}
              value={carModel}
              onChange={handleModelChange}
              searchable
              searchPlaceholder="Search options..."
              disabled={!carMake || modelsLoading}
              error={fieldErrors.carModel}
              className="rounded-[6px] px-3 py-3 mt-0.5 border border-[#D1D5DB] bg-[#FBFBFC] placeholder:text-[#9CA3AF] placeholder:text-sm"
            />
            <TextInputUI
              label={FORM_CONTENT.fields.currentMileage.label}
              placeholder={FORM_CONTENT.fields.currentMileage.placeholder}
              value={currentMileage}
              onChange={(e) => {
                setCurrentMileage(e.target.value)
                clearFieldError("currentMileage")
              }}
              type="number"
              error={fieldErrors.currentMileage}
              className="rounded-[6px] px-3 py-3 mt-0.5 border border-[#D1D5DB] bg-[#FBFBFC] placeholder:text-[#9CA3AF] placeholder:text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>

          <div className="inline-flex items-center gap-1.5 bg-[#E8F0FA] rounded-[16px] px-2.5 py-1 w-fit">
            <UserRoundPen className="w-4 h-4 text-[#0F2440]" />
            <span className="text-[0.75rem] font-semibold text-[#0F2440] uppercase tracking-wide font-sans">
              {FORM_CONTENT.tabs.personalDetails}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <TextInputUI
              label={FORM_CONTENT.fields.firstName.label}
              placeholder={FORM_CONTENT.fields.firstName.placeholder}
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value)
                clearFieldError("firstName")
              }}
              error={fieldErrors.firstName}
              className="rounded-[6px] px-3 py-3 mt-0.5 border border-[#D1D5DB] bg-[#FBFBFC] placeholder:text-[#9CA3AF] placeholder:text-sm"
            />
            <TextInputUI
              label={FORM_CONTENT.fields.lastName.label}
              placeholder={FORM_CONTENT.fields.lastName.placeholder}
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value)
                clearFieldError("lastName")
              }}
              error={fieldErrors.lastName}
              className="rounded-[6px] px-3 py-3 mt-0.5 border border-[#D1D5DB] bg-[#FBFBFC] placeholder:text-[#9CA3AF] placeholder:text-sm"
            />
          </div>

          <TextInputUI
            label={FORM_CONTENT.fields.email.label}
            placeholder={FORM_CONTENT.fields.email.placeholder}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              clearFieldError("email")
            }}
            type="email"
            error={fieldErrors.email}
            className="rounded-[6px] px-3 py-3 mt-0.5 border border-[#D1D5DB] bg-[#FBFBFC] placeholder:text-[#9CA3AF] placeholder:text-sm"
          />

          <div className="grid grid-cols-2 gap-3">
            <PhoneNumberInputUI
              label={FORM_CONTENT.fields.phoneNumber.label}
              value={phoneNumber}
              placeholder={FORM_CONTENT.fields.phoneNumber.placeholder}
              onChange={(value) => {
                setPhoneNumber(value)
                clearFieldError("phoneNumber")
              }}
              error={fieldErrors.phoneNumber}
              className="rounded-[6px] px-3 py-3 mt-0.5 border border-[#D1D5DB] bg-[#FBFBFC] placeholder:text-[#9CA3AF] placeholder:text-sm"
            />
            <ZipCodeInputUI
              label={FORM_CONTENT.fields.zipCode.label}
              placeholder="Enter Zip Code"
              value={zipCode}
              onChange={(value) => {
                setZipCode(value)
                clearFieldError("zipCode")
              }}
              error={fieldErrors.zipCode}
              className="rounded-[6px] px-3 py-3 mt-0.5 border border-[#D1D5DB] bg-[#FBFBFC] placeholder:text-[#9CA3AF] placeholder:text-sm"
            />
          </div>
        </div>

        <div className="w-full flex flex-col items-center justify-center gap-3 px-4 pb-4">
          {submitStatus === "error" && submitError && (
            <p className="w-full text-sm text-red-600 text-center font-sans" role="alert">
              {submitError}
            </p>
          )}
          <div className="w-full">
            <ButtonUI
              type="1"
              variant="default"
              htmlType="submit"
              disabled={submitStatus === "loading"}
              className="w-full h-12 bg-[#3498DB] text-white py-3.5 text-sm font-semibold font-sans rounded-[8px]"
            >
              {submitStatus === "loading" ? "Submitting..." : FORM_CONTENT.button}
            </ButtonUI>
          </div>

          <p className="w-full text-[0.62rem] xl:text-[0.7rem] text-[#374151] text-center leading-relaxed font-sans">
            {FORM_CONTENT.disclaimer}
          </p>
        </div>
      </form>
    </div>
  )
}
