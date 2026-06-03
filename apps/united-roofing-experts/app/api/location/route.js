import { NextResponse } from "next/server"

export async function GET(request) {
    try {
        const forwarded = request.headers.get("x-forwarded-for")
        const ip = forwarded ? forwarded.split(",")[0].trim() : null
        const targetIp = !ip || ip === "::1" || ip === "127.0.0.1" ? "8.8.8.8" : ip

        const response = await fetch(`https://ipinfo.io/${targetIp}/json/`, {
            cache: "no-store",
            headers: { "User-Agent": "platinum-window-experts/1.0" },
        })

        const data = await response.json().catch(() => null)

        if (!response.ok) {
            const reason = data?.reason || "RateLimited"
            if (response.status === 429) {
                return NextResponse.json({ city: null, zip: null, message: reason })
            }
            return NextResponse.json({ city: null, zip: null, message: reason || "Unknown Error" })
        }

        if (data && data.error === true) {
            return NextResponse.json({ city: null, zip: null })
        }

        return NextResponse.json({
            city: data?.city ?? null,
            zip: data?.postal ?? null,
        })
    } catch {
        return NextResponse.json({ city: null, zip: null })
    }
}
