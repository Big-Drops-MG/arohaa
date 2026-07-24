"use client"

import { completeOnboarding } from "@/actions/onboarding.actions"
import { AuthBrandHeader, AuthScreen } from "./AuthScreen"
import { CUSTOM_ROLE_VALUE } from "../model/role-options"
import { useRouter } from "next/navigation"
import type { FormEvent } from "react"
import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

type OnboardingPageProps = {
  roleOptions: string[]
}

export function OnboardingPage({ roleOptions }: OnboardingPageProps) {
  const router = useRouter()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [roleSelection, setRoleSelection] = useState("")
  const [customRole, setCustomRole] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isCustom = roleSelection === CUSTOM_ROLE_VALUE

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return

    const role = isCustom ? customRole.trim() : roleSelection.trim()

    setIsSubmitting(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.set("firstName", firstName)
      formData.set("lastName", lastName)
      formData.set("role", role)
      const result = await completeOnboarding(formData)

      if (result.error) {
        setError(result.error)
        return
      }

      router.replace(result.redirectTo ?? "/pending-access")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthScreen>
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="gap-3 pb-2 text-center sm:pb-4">
          <AuthBrandHeader
            title="Complete your profile"
            description="Add your first name, last name, and role to continue."
          />
        </CardHeader>
        <CardContent>
          <form
            noValidate
            onSubmit={handleSubmit}
            className="flex flex-col gap-5"
          >
            {error ? (
              <p className="text-center text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                name="firstName"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                disabled={isSubmitting}
                placeholder="Enter first name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                name="lastName"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                disabled={isSubmitting}
                placeholder="Enter last name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={roleSelection}
                onValueChange={setRoleSelection}
                disabled={isSubmitting}
              >
                <SelectTrigger id="role" aria-label="Role">
                  <SelectValue placeholder="Select your role" />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_ROLE_VALUE}>
                    Other (add a new role)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isCustom ? (
              <div className="space-y-2">
                <Label htmlFor="customRole">New role</Label>
                <Input
                  id="customRole"
                  name="customRole"
                  value={customRole}
                  onChange={(event) => setCustomRole(event.target.value)}
                  disabled={isSubmitting}
                  placeholder="Enter your role"
                  required
                  maxLength={80}
                />
              </div>
            ) : null}

            <Button type="submit" size="lg" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Continue"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthScreen>
  )
}
