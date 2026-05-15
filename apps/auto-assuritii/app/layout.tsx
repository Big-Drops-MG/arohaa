import { Inter } from "next/font/google"
import { Metadata } from "next"

import "@workspace/ui/globals.css"
import { Analytics } from "@workspace/ui/components/analytics"
import { Providers } from "@/components/providers"

const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "Assuritii - Vehicle Protection & Extended Warranty",
    template: "%s | Assuritii",
  },
  description:
    "Protect your car and your wallet from expensive repair bills. Get a free vehicle protection quote from Assuritii.",
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
    ],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <head>
        <meta
          name="arohaa-verify"
          content="wYjpUDkI7Z4vZeBaNyC_D-ZGympumvll"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(w){if(w.arohaa)return;var s=function(){(s.q=s.q||[]).push(arguments)};s.q=[];s.l=Date.now();w.arohaa=s})(window);`,
          }}
        />
        <script
          id="arohaa-sdk"
          src={process.env.NEXT_PUBLIC_AROHAA_SDK_SCRIPT_URL}
          async
          data-wid="8ca47040-78ac-4ffd-9804-d91e901a32be"
          data-api={process.env.NEXT_PUBLIC_AROHAA_INGEST_API_BASE}
          data-lp-id="lp_p1UfQOJorILpLvaE"
          data-page="localhost"
          data-formtype="zip"
        />
      </head>
      <body
        className={`${fontSans.variable} font-sans antialiased overflow-x-hidden overflow-y-auto`}
      >
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  )
}
