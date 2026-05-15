export const SUPPORT_PHONE = {
  display: "1-844-310-0460",
  tel: "+18443100460",
  placeholder: "(844) 310-0460",
} as const

export const COLORS_CONSTANTS = {
  white: "#FFFFFF",
  heading: "#111827",
  description: "#374151",
} as const

export const FONT = {
  inter: "Inter",
  interVariable: "--font-sans",
} as const

export const COLORS = {
  textWhite: "text-white",
  textHeading: "text-[#111827]",
  textDescription: "text-[#374151]",
  fontInter: "font-sans",
} as const



//  sections constants


export const HERO_CONTENT = {
  headline: "Save Big on Auto Repairs",
  description: "Protect your car and your wallet from expensive repair bills.",
  
  partners: [
    {
      alt: "Google",
      src: "/partner-1.svg",
     
    },
    {
      alt: "2025 Top Rated Consumers",
      src: "/partner-2.svg",
      
    },
    {
      alt: "Consumer Affairs",
      src: "/partner-3.svg",
     
    },
  ],

  image: {
    alt: "Hero Image",
    src: "/hero.webp",
  },
} as const



export const FORM_CONTENT = {
  header: "Receive Your FREE Vehicle Protection Quote",
  tabs: {
    vehicleDetails: "VEHICLE DETAILS",
    personalDetails: "PERSONAL DETAILS",
  },
  fields: {
    carYear: {
      label: "Car Year",
      placeholder: "Select Year",
    },
    carMake: {
      label: "Car Make",
      placeholder: "Select Make",
    },
    carModel: {
      label: "Car Model",
      placeholder: "Select Model",
    },
    currentMileage: {
      label: "Current Mileage",
      placeholder: "Enter Mileage",
    },
    firstName: {
      label: "First Name",
      placeholder: "Enter First Name",
    },
    lastName: {
      label: "Last Name",
      placeholder: "Enter Last Name",
    },
    email: {
      label: "Email",
      placeholder: "Enter Email",
    },
    phoneNumber: {
      label: "Phone Number",
      placeholder: SUPPORT_PHONE.placeholder,
    },
    zipCode: {
      label: "Zip Code",
      placeholder: "Enter Zip Code",
    },
  },
  button: "Unlock My Car's Protection Value",
  disclaimer: 'By Clicking "Get Your Free Quote" You Agree That Assuritii or the Marketing Partner American Dream Warranty May Contact You At The Number And Email Provided With Calls, Texts, Or Prerecorded/Artificial Voice Messages About Our Products/Services. Consent Is Not A Condition Of Purchase. Message/Data Rates Apply. You Can Withdraw Consent Anytime.',
} as const


export const STEPS_CONTENT = {
  header: "Start Smart. Stay Protected.",
  steps: [
    {
      number: 1,
      title: "Check if your car qualifies",
      description: "One quick form. Instant eligibility check.",
      image: {
        src: "/step-1.svg",
        alt: "Check if your car qualifies",
      },
    },
    {
      number: 2,
      title: "See real plan prices",
      description: "Clear coverage. Clear monthly cost. No guessing.",
      image: {
        src: "/step-2.svg",
        alt: "See real plan prices",
      },
    },
    {
      number: 3,
      title: "Lock in protection",
      description: "Drive knowing repairs won't wreck your budget.",
      image: {
        src: "/step-3.svg",
        alt: "Lock in protection",
      },
    },
  ],
} as const


export const FEATURES_CONTENT = {
  header: "Protect Your Car and Your Wallet",
  description:
    "Car repairs can quickly add up, whether it's for minor parts or major system failures. With American Dream Warranty, you can rest easy knowing that your vehicle is covered when your warranty expires. Say goodbye to unexpected expenses and keep your car running smoothly for years to come.",
  features: [
    {
      title: "Protect Yourself",
      description:
        "Is your auto warranty expired or about to expire? Our Vehicle Protection Plans shield you from the high cost of parts and labor so you are not facing major repair bills on your own.",
      image: {
        src: "/feature-1.svg",
        alt: "Protect Yourself",
      },
    },
    {
      title: "Save Money",
      description:
        "We know that every driver's needs are unique. Choose from three flexible plans: Platinum, Gold, and Silver tailored to your budget and vehicle type, from full coverage to essential parts and labor protection.",
      image: {
        src: "/feature-2.svg",
        alt: "Save Money",
      },
    },
    {
      title: "Peace of Mind",
      description:
        "Know what to expect from your plan. Clear coverage details and support when you need to use your vehicle protection, so you can stay focused on driving.",
      image: {
        src: "/feature-3.svg",
        alt: "Peace of Mind",
      },
    },
  ],
} as const


export const IMAGE_COMPARE_CONTENT = {
  header: "Real Protection For Real Car Problems",
  description: "Coverage built for today's cars and real driving needs",
  imageOne: {
    src: "/unprotected.webp",
    alt: "Unprotected",
  },
  imageTwo: {
    src: "/protected.webp",
    alt: "Protected",
  },
} as const

export const REPAIR_COSTS_CONTENT = {
  header: "AVERAGE REPAIR COSTS",
  withoutLabel: "WITHOUT ASSURITII",
  withLabel: "WITH ASSURITII",
  totalLabel: "TOTAL FOR ALL",
  items: [
    { label: "ENGINE", cost: "$4,800" },
    { label: "TRANSMISSION", cost: "$3,200" },
    { label: "SUSPENSION", cost: "$1,750" },
  ],
  withTotalCost: "$0",
} as const

export const REVIEW_CONTENT = {
  header: "Drivers Who Chose Peace Of Mind, Drivers Who Chose Assuritii!",
  reviews: [
    {
     id: 1,
      quote: "When my transmission failed, American Dream Auto Protect saved me over $2,000. The process was simple & there were no surprise charges.",
      customer: {
        name: "Linda",
        status: "Verified Customer",
        image: {
          src: "/profile-1.svg",
          alt: "Linda Matthews",
        },
      },
    },
    {
      id: 2,
      quote: "I liked that everything was explained clearly before I signed up. No confusing terms and no pressure calls at all.",
      customer: {
        name: "David",
        status: "Verified Customer",
        image: {
          src: "/profile-2.svg",
          alt: "David Lawson",
        },
      },
    },
    {
     
      id: 3,
      quote: "Paying monthly is much easier than facing a huge repair bill at once. It gave me real peace of mind while driving.",
      customer: {
        name: "Susan",
        status: "Verified Customer",
        image: {
          src: "/profile-3.svg",
          alt: "Susan Roberts",
        },
      },
    },
  ],
} as const


export const FAQ_CONTENT = {
  header: "Frequently Asked Questions",
  faqs: [
    {
      id: 1,
      question: "Q1. Is this car insurance or something different?",
      answer: "No. This is vehicle protection, not car insurance. It helps cover unexpected mechanical repair costs after your manufacturer warranty ends, while insurance handles accidents and liability.",
    },
    {
      id: 2,
      question: "Q2. Will my car qualify if it's older or high-mileage?",
      answer: "Many vehicles qualify regardless of age or mileage. Our eligibility check will determine if your specific vehicle meets the requirements for coverage.",
    },
    {
      id: 3,
      question: "Q3. What happens if my car breaks down?",
      answer: "When your covered vehicle experiences a mechanical breakdown, simply contact our claims department. We'll help you get your vehicle repaired at a qualified service center, and your plan will cover the eligible repair costs according to your coverage terms.",
    },
    {
      id: 4,
      question: "Q4. Can I leave or change my plan later?",
      answer: "Yes, you have flexibility with your plan. You can modify or cancel your coverage according to the terms outlined in your agreement. Contact our customer service team to discuss your options.",
    },
  ],
} as const

export const FOOTER_CONTENT = {
  description: "Affordable vehicle protection for unexpected repairs.",
  linkHeader: "Company",
  links: [
    { text: "Privacy Policy", href: "/privacy-policy" },
    { text: "Terms of Use", href: "/terms-of-use" },
  ],
  copyrightText: "Copyright © 2026 Assuritii. All Rights Reserved.",
  disclaimer:
    'Vehicle Protection Coverage and offer is not available in all states and is void when prohibited by law. Vehicle coverage may vary based on manufacturer, model, and year of the vehicle. Pre-existing conditions are not covered.',
} as const

export interface ThankYouType2FeatureCard {
  title: string
  bulletPoints: string[]
  icon: "shield" | "building" | "check"
}

export interface ThankYouType2Content {
  title: string
  partnerName: string
  partnerLogo: { src: string; alt: string }
  confirmationMessage: string
  aboutSectionTitle: string
  featureCards: ThankYouType2FeatureCard[]
}

export const THANKYOU_TYPE2_CONTENT: ThankYouType2Content = {
  title: "Thank you!",
  partnerName: "American Dream Auto Protect",
  partnerLogo: { src: "/american-dream-logo.svg", alt: "American Dream Warranty" },
  confirmationMessage:
    "Congratulations! You have been matched with American Dream Auto Protect (ADAP). A Customer Specialist will be contacting you soon with your quote and next steps.",
  aboutSectionTitle: "Comprehensive Protection Plans for Your Car",
  featureCards: [
    {
      title: "Protect Yourself",
      icon: "shield",
      bulletPoints: [
        "Vehicle Protection Plans for when your factory warranty is expired or ending",
        "Help shield yourself from high parts-and-labor costs on covered repairs",
        "Drive with confidence: coverage designed for real-world breakdowns",
      ],
    },
    {
      title: "Save Money",
      icon: "building",
      bulletPoints: [
        "Three flexible plans (Platinum, Gold, and Silver) for your budget and vehicle",
        "From full coverage to essential parts and labor protection",
        "Plans that keep repair costs low and help maintain your car in top condition",
      ],
    },
    {
      title: "Peace of Mind",
      icon: "check",
      bulletPoints: [
        "Clear information about what your plan covers and how to use it",
        "Support when you need to file a claim or find a qualified repair facility",
        "Protection that helps you manage covered repairs with less financial surprise",
      ],
    },
  ],
}
