import Link from "next/link"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

const loginButtonClass =
  "mt-3 box-border flex h-12 w-full max-w-[360px] shrink-0 items-center justify-center gap-2 rounded-[10px] border p-3 text-base font-medium leading-none shadow-none"

export function ResetPasswordMessageScreen() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-4">
      <Card className="w-full max-w-[590px]">
        <CardHeader>
          <div className="flex w-full flex-col items-center gap-3 text-center">
            <img
              src="/Frame%2030.svg"
              alt="Company Logo"
              width={160.5347137451172}
              height={58}
              className="shrink-0 object-contain opacity-100"
              style={{
                width: "160.5347137451172px",
                height: "58px",
              }}
            />
            <CardTitle className="text-center text-[20px] font-bold">
              Your password has been reset successfully.
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center pt-0 pb-8">
          <Button asChild className={loginButtonClass}>
            <Link href="/LoginPage">Back to login</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
