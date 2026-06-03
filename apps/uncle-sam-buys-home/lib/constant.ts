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
  headline: "Need Cash Fast? Get an Instant Cash Offer on Your Home Today!",
  
  partners: [
    
    {
      alt: "Consumer Affairs",
      src: "/partner-3.svg",
      
      
    },
    {
      alt: "2025 Top Rated Consumers",
      src: "/partner-2.svg",
     
    },
  ],

  // image: {
  //   alt: "Hero Image",
  //   src: "/family.webp",
  // },
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
      placeholder: "(123) 4567-890",
    },
    zipCode: {
      label: "Zip Code",
      placeholder: "Enter Zip Code",
    },
  },
  button: "Unlock My Car's Protection Value",
  disclaimer: "By Clicking \"Get Your Free Quote\" You Agree That Assuritii May Contact You At The Number And Email Provided With Calls, Texts, Or Prerecorded/Artificial Voice Messages About Or Products/Services. Consent Is Not A Condition Of Purchase. Message/Data Rates Apply. You Can Withdraw Consent Anytime.",
} as const

export const WORK_CONTENT = {
  header: "How It Works",
  steps: [
    {
      number: "01",
      title: "Enter your ZIP",
      description: "See which insurance options are available where you live.",
    },
    {
      number: "02",
      title: "Answer a few quick questions",
      description: "Tell us about your vehicle and the cover level you want.",
    },
    {
      number: "03",
      title: "View matched quotes",
      description: "See prices and details, then choose the option that suits your budget.",
    },
  ],
  workImage: [
    {
      src: "/step-3.webp",
      alt: "Couple in a modern kitchen discussing their home",
    },
  ],
} as const

export const ABOUT_CONTENT = {
  header: "So, what does a home warranty actually do?",
  description: "A home warranty helps when everyday home systems or appliances stop working from normal wear and tear.",
  features: [
    {
      title: "Helps cover home systems and appliances",
     
      image: {
        src: "/about-1.svg",
        alt: "Cars today cost more to repair",
      },
    },
    {
      title: "Works alongside homeowners insurance",
      image: {
        src: "/about-2.svg",
        alt: "Unexpected repair costs",
      },
    },
    {
      title: "Simple member support when things break",
      image: {
        src: "/about-3.svg",
        alt: "Breakdowns disrupt daily life",
      },
    },
  ],
} as const


export const FEATURES_CONTENT = {
  header: "What's Not Covered in Home Warranty",
  features: [
    {
      title: "Pre-existing conditions",
      image: {
        src: "/feature-icon.svg",
        alt: "Cars today cost more to repair",
      },
    },
    {
      title: "Cosmetic damage",
      image: {
        src: "/feature-icon.svg",
        alt: "Unexpected repair costs",
      },
    },
    {
      title: "Improper maintenance",
      image: {
        src: "/feature-icon.svg",
        alt: "Breakdowns disrupt daily life",
      },
    },
    {
      title: "Items not listed in plan",
      image: {
        src: "/feature-icon.svg",
        alt: "Items not listed in plan",
      },
    },
  ],
} as const

export const COVER_CONTENT = {
  header: "What's Covered",
  homeSystems: {
    header: "HOME SYSTEMS",
    items: [
      {
        title: "Heating And Air Conditioning Systems",
        image: {
          src: "/home-1.svg",
          alt: "Heating And Air Conditioning Systems",
        },
      },
      {
        title: "Plumbing Systems And Accessories",
        image: {
          src: "/home-2.svg",
          alt: "Plumbing Systems And Accessories",
        },
      },
      {
        title: "Electrical Systems And Accessories",
        image: {
          src: "/home-3.svg",
          alt: "Electrical Systems And Accessories",
        },
      },
      {
        title: "Maintenance Services",
        image: {
          src: "/home-4.svg",
          alt: "Maintenance Services",
        },
      },
    ],
  },
  appliances: {
    header: "APPLIANCES",
    items: [
      {
        title: "Refrigerator",
        image: {
          src: "/appliances-1.svg",
          alt: "Refrigerator",
        },
      },
      {
        title: "Oven",
        image: {
          src: "/appliances-2.svg",
          alt: "Oven",
        },
      },
      {
        title: "Washer / Dryer",
        image: {
          src: "/appliances-3.svg",
          alt: "Washer / Dryer",
        },
      },
      {
        title: "Water Heater",
        image: {
          src: "/appliances-4.svg",
          alt: "Water Heater",
        },
      },
    ],
    additionalText: "And More...",
  },
  callToAction: {
    buttonText: "Get Your FREE Quote",
    contactText: "Or give us a call",
    phoneNumber: "1-855-916-3700",
    phoneHref: "tel:+18559163700",
  },
} as const





export const REVIEW_CONTENT = {
  header: "See What Our Customers Have To Say",
  rating: {
    
    image: {
      src: "/review.svg",
      alt: "Google Review Rating",
    },
    reviewText:"Based on 1,500+ reviews",
  },


  reviews: [
    {
     id: 1,
      quote: "Our AC stopped working unexpectedly, and I was worried about the cost. Submitting a request was easy, and a technician was scheduled quickly. It really helped us avoid a big repair bill.",
      customer: {
        name: "Sarah Matthews",
        status: "Dallas, TX",
        image: {
          src: "/profile-1.svg",
          alt: "Sarah Matthews",
        },
      },
    },
    {
      id: 2,
      quote: "As a new homeowner, I wasn’t sure what to expect when our refrigerator broke down. Everything was explained clearly, and the repair process was simple from start to finish",
      customer: {
        name: "David Martinez",
        status: "Orlando, FL",
        image: {
          src: "/profile-2.svg",
          alt: "David Martinez",
        },
      },
    },
    {
     
      id: 3,
      quote: "Having coverage made a stressful situation much easier. Our water heater needed repairs, and the whole experience was smooth and straightforward.",
      customer: {
        name: "Monica Patel",
        status: "Phoenix, AZ",
        image: {
          src: "/profile-3.svg",
          alt: "Monica Patel",
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
      question: "Q1. What does a home warranty help cover?",
      answer: "It helps with covered repairs for home systems and appliances that fail from normal wear and tear.",
    },
    {
      id: 2,
      question: "Q2. What do I pay when I request service?",
      answer: "You pay the service fee when you request help; covered repair or replacement costs are handled by your plan.",
    },
    {
      id: 3,
      question: "Q3. Is this the same as homeowners insurance?",
      answer: "No. Homeowners insurance covers sudden events like fire or storms; a home warranty covers breakdowns of covered items.",
    },
    {
      id: 4,
      question: "Q4. Can I cancel or change my plan later?",
      answer: "Yes. You can cancel or switch plans based on terms; your options are shown clearly before you enrol.",
    },
  ],
} as const

export const FOOTER_CONTENT = {
  description: "Affordable coverage for unexpected home repairs.",
  linkHeader: "Company",
  links: [
    { text: "Privacy Policy", href: "/privacy-policy" },
    { text: "Terms of Use", href: "/terms-of-use" },
  ],
  copyrightText: "Copyright © 2026 Uncle Sam Buys Home. All Rights Reserved.",
  disclaimer:
    'Uncle Sam Buys Home is a marketing platform that connects homeowners with companies involved in real estate transactions. The information you submit on this website is shared in real time with our network of partner companies. If your details match what a partner is looking for, they may contact you directly. In some cases, we may use SMS to help connect you with a provider or facilitate a call. We may receive compensation from these providers when they contact you or offer their services. You are not charged for using our platform. We do not guarantee that you will receive an offer, that any provider will accept your request, or that their services will meet your specific needs. The products or services offered may not always be the best available in the market. Submitting your information does not obligate you to purchase any service or product, and it does not obligate any provider to offer you a service. This website is intended for U.S. citizens only. We do not accept submissions from individuals outside the United States, including Canada and countries in the European Union.',
} as const


export const THANKYOU_CONTENT = {
  title: "Thank you!",
  subtitle:
    "Thank you for requesting information from Assuritii. A Customer Specialist will contact you shortly.",
  confirmationTitle:
    "A confirmation message has been sent to your email address.",
  confirmationDescription:
    "The message contains next steps and how to get your quote. Please check your spam folder if you don't see it in your inbox.",
  contactTitle: "Need help now?",
  contactPhoneLabel: "1-855-916-3700",
  contactPhoneHref: "tel:+18559163700",
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
  /** Shown in a green notice below the main confirmation copy */
  emailConfirmationNotice?: string
  aboutSectionTitle: string
  featureCards: ThankYouType2FeatureCard[]
}

export const THANKYOU_TYPE2_CONTENT: ThankYouType2Content = {
  title: "Thank you!",
  partnerName: "First Premier Home Warranty",
  partnerLogo: { src: "/first-premier.png", alt: "First Premier Home Warranty" },
  confirmationMessage:
    "You're matched with First Premier Home Warranty. A specialist will contact you soon.",
  emailConfirmationNotice:
    "We've sent a confirmation email to your inbox. If you don't see it within a few minutes, check your spam or junk folder.",
  aboutSectionTitle: "Why Choose First Premier Home Warranty",
  featureCards: [
    {
      title: "Our Mission: Budget-friendly Plans",
      icon: "shield",
      bulletPoints: [
        "Getting the best home warranty should not mean stretching your finances.",
        "Plans priced so every homeowner can access solid, reliable coverage.",
        "Whether you are a first-time buyer or a long-time homeowner, there is a plan built for your situation.",
      ],
    },
    {
      title: "Wide Network of Technicians",
      icon: "building",
      bulletPoints: [
        "When things go wrong, we connect you with experienced contractors.",
        "From diagnosis to repair, with efficiency and care your home deserves.",
        "Less stress finding help when you need it most.",
      ],
    },
    {
      title: "Nationwide Coverage",
      icon: "check",
      bulletPoints: [
        "Wherever you own a home, we work to keep you protected.",
        "Coverage options that fit different households, budgets, and needs.",
        "Dependable protection so you can focus on living in your home, not stressing over repairs.",
      ],
    },
  ],
}

export const REJECTED_PAGE_CONTENT = {
  title: "We couldn’t complete your submission",
  leadMessage:
    "Our verification partner wasn’t able to accept this submission. This can happen when information doesn’t pass their checks.",
  defaultDetail:
    "Please confirm your address and contact details are accurate, then try again. If you continue to see this message, try again later or use a different phone number.",
  codeMessages: {
    1013:
      "The lead was rejected by our partner. You may have submitted recently, or your details could not be verified. Please review your information and try again.",
  } as Record<number, string>,
  partnerLogo: { src: "/first-premier.png", alt: "First Premier Home Warranty" },
}
