"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"

type FormPopupModalProps = {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
}

export function FormPopupModal({ isOpen, onClose, children }: FormPopupModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const t = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true))
    })
    return () => {
      cancelAnimationFrame(t)
      document.body.style.overflow = prev
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      setVisible(false)
      setClosing(false)
    }
  }, [isOpen])

  const handleClose = () => {
    setClosing(true)
    setVisible(false)
    setTimeout(() => {
      setClosing(false)
      onClose()
    }, 250)
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) handleClose()
  }

  if (!isOpen && !closing) return null

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="form-popup-title"
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-8  overflow-y-auto bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
        visible && !closing ? "opacity-100" : "opacity-0"
      }`}
      onClick={handleOverlayClick}
    >
      <div
        className={`relative w-full max-w-[min(440px,calc(100vw-2rem))] sm:max-w-[440px]  my-auto transition-all duration-300 rounded-[20px] bg-transparent shadow-none ${
          visible && !closing ? "opacity-100 scale-100" : "opacity-0 scale-95"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
