import { Metadata } from "next"
import HomeContent from "@/app/_components/HomeContent"

export const metadata: Metadata = {
  title: "Vehicle Protection & Extended Warranty",
  description:
    "Save big on auto repairs. Protect your car and your wallet from expensive repair bills. Get your free vehicle protection quote from Assuritii.",
}

export default function Page() {
  return <HomeContent />
}
