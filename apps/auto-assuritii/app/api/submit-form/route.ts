import { NextRequest, NextResponse } from "next/server"
import { verifyEmailWithHunter } from "@/lib/hunter-verify-email"
import { verifyPhone } from "@/lib/veriphone-verify-phone"

const REQUIRED_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "phoneNumber",
  "zipCode",
  "carYear",
  "carMake",
  "carModel",
  "currentMileage",
] as const

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      firstName,
      lastName,
      email,
      phoneNumber,
      zipCode,
      carYear,
      carMake,
      carModel,
      currentMileage,
      subid1,
      subid2,
      subid3,
      xxTrustedFormCertUrl,
    } = body

    const missingFields = REQUIRED_FIELDS.filter((field) => !body[field]?.trim?.())
    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: "All fields are required", missingFields: [...missingFields] },
        { status: 400 }
      )
    }

    const emailTrimmed = String(email).trim()
    const hunter = await verifyEmailWithHunter(emailTrimmed)
    if (!hunter.ok) {
      return NextResponse.json(
        { error: hunter.message, invalidField: "email" as const },
        { status: 422 }
      )
    }

    const phoneTrimmed = String(phoneNumber).trim()
    const veriphoneKey = process.env.VERIPHONE_API_KEY
    if (veriphoneKey) {
      const verification = await verifyPhone(phoneTrimmed, veriphoneKey, "US")
      if (!verification.valid) {
        return NextResponse.json(
          {
            error: verification.error ?? "Invalid phone number",
            field: "phoneNumber" as const,
          },
          { status: 400 }
        )
      }
    }

    const forwarded = request.headers.get("x-forwarded-for")
    const firstForwarded = forwarded?.split(",")[0]
    const ip = firstForwarded
      ? firstForwarded.trim()
      : request.headers.get("x-real-ip") || "unknown"

    const submittedPayload = {
      firstName,
      lastName,
      email: emailTrimmed,
      phoneNumber: phoneTrimmed,
      zipCode,
      carYear,
      carMake,
      carModel,
      currentMileage,
      subid1: subid1 ?? "",
      subid2: subid2 ?? "",
      subid3: subid3 ?? "",
      ip,
    }
    console.log("[submit-form] submitted:", JSON.stringify(submittedPayload, null, 2))

    const hasLeadProsper =
      process.env.LEADPROSPER_CAMPAIGN_ID &&
      process.env.LEADPROSPER_SUPPLIER_ID &&
      process.env.LEADPROSPER_API_KEY &&
      process.env.LEADPROSPER_API_URL

    if (hasLeadProsper) {
      const formData = {
        lp_campaign_id: process.env.LEADPROSPER_CAMPAIGN_ID,
        lp_supplier_id: process.env.LEADPROSPER_SUPPLIER_ID,
        lp_key: process.env.LEADPROSPER_API_KEY,
        lp_subid1: subid1 ?? "",
        lp_subid2: subid2 ?? "",
        lp_subid3: subid3 ?? "",
        first_name: String(firstName).trim(),
        last_name: String(lastName).trim(),
        email: emailTrimmed,
        phone: phoneTrimmed.replace(/\D/g, ""),
        zip_code: String(zipCode).trim(),
        Vehicle_Year: String(carYear).trim(),
        Vehicle_Make: String(carMake).trim(),
        Vehicle_Model: String(carModel).trim(),
        Expected_Mileage: String(currentMileage).trim(),
        ip_address: ip,
        user_agent: request.headers.get("user-agent") ?? "",
        landing_page_url: request.headers.get("referer") ?? "",
        trustedform_cert_url: xxTrustedFormCertUrl ?? "",
      }

      const logPayload = { ...formData, lp_key: formData.lp_key ? "[REDACTED]" : "" }
      console.log("[submit-form] formData:", JSON.stringify(logPayload, null, 2))

      const apiResponse = await fetch(process.env.LEADPROSPER_API_URL!, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(formData),
      })

      const rawResponse = await apiResponse.text()
      let result: { status?: string }
      try {
        result = JSON.parse(rawResponse)
      } catch {
        result = { status: "ACCEPTED" }
      }

      const acceptedStatuses = ["ACCEPTED", "DUPLICATED", "ERROR"]
      if (!result.status || !acceptedStatuses.includes(result.status)) {
        return NextResponse.json(
          {
            success: false,
            error: "Lead submission failed",
            leadProsperStatus: result.status,
          },
          { status: 400 }
        )
      }
    }

    const accessToken = crypto.randomUUID()
    const expiresAt = Date.now() + 10 * 60 * 1000

    const successResponse = NextResponse.json(
      {
        success: true,
        message: "Form submitted successfully",
        redirectUrl: `/thankyou?email=${encodeURIComponent(emailTrimmed)}`,
        accessToken,
        expiresAt,
      },
      { status: 200 }
    )

    successResponse.cookies.set("thankyou_access", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 10 * 60,
    })

    return successResponse
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
