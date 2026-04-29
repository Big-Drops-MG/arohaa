export function HomePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      <h1 className="text-2xl font-semibold text-foreground">
        Welcome to the dashboard
      </h1>
      <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">
        You are signed in with two-factor authentication enabled.
      </p>
    </div>
  )
}
