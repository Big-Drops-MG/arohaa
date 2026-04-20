import Link from "next/link"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
} from "@workspace/ui/components/card"

const Logo = () => (
  <div className="flex items-center gap-0.5 px-1">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="3" fill="#EF4444"/>
      <circle cx="12" cy="4" r="2" fill="#EF4444"/>
      <circle cx="12" cy="20" r="2" fill="#EF4444"/>
      <circle cx="4" cy="12" r="2" fill="#EF4444"/>
      <circle cx="20" cy="12" r="2" fill="#EF4444"/>
      <circle cx="6.34" cy="6.34" r="2" fill="#EF4444"/>
      <circle cx="17.66" cy="17.66" r="2" fill="#EF4444"/>
      <circle cx="6.34" cy="17.66" r="2" fill="#EF4444"/>
      <circle cx="17.66" cy="6.34" r="2" fill="#EF4444"/>
    </svg>
  </div>
)

export default function SuccessPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F9FAFB] dark:bg-background px-4 py-12">
      <div className="w-full max-w-[440px] space-y-[30px] text-center">
        <div className="flex flex-col items-center">
          <h1 className="text-2xl font-bold tracking-tight font-heading">Arohaa</h1>
          <div className="mt-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground font-sans">
            by <Logo /> <span className="font-extrabold text-red-600">Big Drops MG</span>
          </div>
        </div>

        <Card className="border-none bg-white dark:bg-card shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <CardContent className="px-10 py-[30px] flex flex-col items-center">
            <h2 className="text-xl font-semibold mb-2 font-heading">
              Password Reset Successful
            </h2>
            <Button asChild className="mt-6 h-10 w-32 bg-[#1F2937] text-white hover:bg-[#111827] dark:bg-primary dark:text-primary-foreground font-medium rounded-md font-heading">
              <Link href="/login">Go to Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
