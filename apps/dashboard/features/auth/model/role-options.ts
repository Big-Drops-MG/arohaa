export const ROLE_OPTIONS = [
  "Web Developer",
  "UI/UX Designer",
  "Content Creater",
  "Business Development Manager (BDM)",
  "Graphics Designer",
] as const

export type RoleOption = (typeof ROLE_OPTIONS)[number]
