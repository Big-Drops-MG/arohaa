"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

interface PartnerModalProps {
  isOpen: boolean
  onClose: () => void
}

const partners = [
    "Erie Home",
    "Erie Home_BC", 
    "Erie Roofing",
    "Roof Savings Pro",
    "Billy.com",
    "Advanced Roofing, Inc.",
    "American Remodeling",
    "Anderson Windows",
    "Baker Roofing Company",
    "Best Choice Roofing",
    "Bone Dry Roofing",
    "Breezy Roofing LLC",
    "Breezy Roofing powered by Roofix",
    "Burr Roofing, Siding, & Windows",
    "CCX Roofing",
    "Centimark Corporation",
    "Clear Choice Home Improvement",
    "Coastal Windows",
    "Cody Clinger's Roofing",
    "Corey Construction",
    "Crowther Roofing and Cooling",
    "Erie",
    "Future Remodeling",
    "GreenWatt Consulting LLC",
    "Greenwood Industries, Inc.",
    "Home Genius Exteriors",
    "Infinity Home Services",
    "Jolly Roofing & Contracting Company, Inc.",
    "Kalkreuth Roofing and Sheet Metal",
    "Legacy Restoration",
    "Long Home",
    "Mammoth Roofing and Solar",
    "Nations Roof",
    "New Pro",
    "O'Hara's Son Roofing Company",
    "Pointer Leads",
    "Refined Roofing Inc",
    "RestoreMasters",
    "Roofing Corp of America",
    "Roofix Technologies LLC",
    "Stronghouse Solutions",
    "Tecta America",
    "Victory Home Remodeling",
    "Adventum LLC",
    "Homefix",
  
 
]

export default function PartnerModal({ isOpen, onClose }: PartnerModalProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }
    return () => {
      document.body.style.overflow = "unset"
    }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
    }
    return () => {
      document.removeEventListener("keydown", handleEscape)
    }
  }, [isOpen, onClose])

  if (!mounted || !isOpen) {
    return null
  }

  const modalContent = (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998] transition-opacity duration-200 ease-out"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose()
          }
        }}
      >
        <div
          className="relative bg-white rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 md:pt-8 pb-3 sm:pb-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#1e1e1e]">
              Our Partners
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors duration-200 group flex-shrink-0"
              aria-label="Close modal"
            >
              <svg
                className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600 group-hover:text-gray-800"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 py-4 sm:py-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              {partners.map((partner, index) => (
                <div
                  key={index}
                  className="px-3 sm:px-4 py-2 sm:py-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-sky-300 hover:bg-sky-50 transition-all duration-200"
                >
                  <p className="text-xs sm:text-sm md:text-base text-[#1e1e1e] font-medium">
                    {partner}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )

  return createPortal(modalContent, document.body)
}

