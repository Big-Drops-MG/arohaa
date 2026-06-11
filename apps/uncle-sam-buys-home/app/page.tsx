import { Metadata } from "next"
import HomeContent from "@/app/_components/HomeContent"

export const metadata: Metadata = {
  title: "Uncle Sam Buys Home | Get an Instant Cash Offer on Your Home Today!",
  description:
    "Sell your house fast with Uncle Sam Buys Home and get a fair, no-obligation cash offer without repairs, fees, or delays.",
}

export default function Page() {
  return <HomeContent />
}
