import { Card, CardHeader, CardTitle } from "@workspace/ui/components/card"

export function ForgotPasswordMessageScreen() {
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
              We've sent a password link to your email address
            </CardTitle>
          </div>
        </CardHeader>
      </Card>
    </div>
  )
}
