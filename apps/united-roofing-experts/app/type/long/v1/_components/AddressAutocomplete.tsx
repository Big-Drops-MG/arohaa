"use client"

import React, { useRef, useEffect } from "react"
import { cn } from "@workspace/ui/lib/utils"

interface GooglePlacesAutocompleteInstance {
  getPlace: () => {
    address_components?: Array<{ long_name: string; short_name: string; types: string[] }>
    formatted_address?: string
  }
  addListener: (event: string, fn: () => void) => void
}

declare global {
  interface Window {
    google?: {
      maps: {
        places: {
          Autocomplete: new (
            input: HTMLInputElement,
            opts?: { types?: string[]; componentRestrictions?: { country: string | string[] } }
          ) => GooglePlacesAutocompleteInstance
        }
      }
    }
  }
}

export interface AddressAutocompleteProps {
  id?: string
  label?: string
  value: string
  onChange: (value: string) => void
  onPlaceSelect: (details: { address: string; city: string; state: string; zipCode: string }) => void
  placeholder?: string
  labelClassName?: string
  className?: string
  googleReady: boolean
}

function getComponent(
  components: { long_name: string; short_name: string; types: string[] }[] | undefined,
  type: string,
  useShort = false
): string {
  if (!components) return ""
  const c = components.find((x) => x.types.includes(type))
  return c ? (useShort ? c.short_name : c.long_name) : ""
}

export function AddressAutocomplete({
  id,
  label = "Address",
  value,
  onChange,
  onPlaceSelect,
  placeholder = "Start typing your address...",
  labelClassName,
  className,
  googleReady,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<GooglePlacesAutocompleteInstance | null>(null)

  useEffect(() => {
    if (!googleReady || typeof window === "undefined" || !window.google?.maps?.places || !inputRef.current)
      return
    if (autocompleteRef.current) return

    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ["address"],
      componentRestrictions: { country: "us" },
    })
    autocompleteRef.current = autocomplete

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace()
      const components = place.address_components
      const streetNumber = getComponent(components, "street_number")
      const route = getComponent(components, "route")
      const address = [streetNumber, route].filter(Boolean).join(" ") || place.formatted_address || ""
      const city = getComponent(components, "locality") || getComponent(components, "sublocality_level_1")
      const state = getComponent(components, "administrative_area_level_1", true)
      const zipCode = getComponent(components, "postal_code").replace(/\D/g, "").slice(0, 5)

      onChange(address.trim())
      onPlaceSelect({
        address: address.trim(),
        city: city.trim(),
        state: state.trim().toUpperCase().slice(0, 2),
        zipCode,
      })
    })
  }, [googleReady, onChange, onPlaceSelect])

  return (
    <div className="space-y-1.5">
      {label != null && (
        <label
          htmlFor={id}
          className={cn("text-sm font-medium text-foreground leading-none", labelClassName)}
        >
          {label}
        </label>
      )}
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className={cn(
          "w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-base font-normal text-foreground shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          className
        )}
        aria-autocomplete="list"
      />
    </div>
  )
}
