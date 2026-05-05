import Link from "next/link"
import { Button } from "@workspace/ui/components/button"
import { PlusCircle } from "lucide-react"

export function HomePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      <Button type="button" size="lg" className="gap-2" asChild>
        <Link href="/dashboard/new-landing">
          <PlusCircle className="size-5" aria-hidden />
          Add a Landing Page
        </Link>
      </Button>
    </div>
  )
}
