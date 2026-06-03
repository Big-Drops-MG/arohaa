"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

type FormPopupContextValue = {
  isOpen: boolean
  openFormPopup: () => void
  closeFormPopup: () => void
}

const FormPopupContext = createContext<FormPopupContextValue | null>(null)

export function FormPopupProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const openFormPopup = useCallback(() => setIsOpen(true), [])
  const closeFormPopup = useCallback(() => setIsOpen(false), [])
  return (
    <FormPopupContext.Provider value={{ isOpen, openFormPopup, closeFormPopup }}>
      {children}
    </FormPopupContext.Provider>
  )
}

export function useFormPopup() {
  const ctx = useContext(FormPopupContext)
  if (!ctx) throw new Error("useFormPopup must be used within FormPopupProvider")
  return ctx
}
