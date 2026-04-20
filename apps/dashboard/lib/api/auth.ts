export interface User {
  id: string
  email: string
  name: string
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const authApi = {
  login: async (email: string, password: string): Promise<{ user?: User; requires2FA?: boolean; error?: string }> => {
    await sleep(1000)
    if (email === "admin@bigdropsmarketing.com" && password === "BigDrops@2026") {
      return { requires2FA: true }
    }
    return { error: "Invalid email or password" }
  },

  verify2FA: async (code: string): Promise<{ user?: User; error?: string }> => {
    await sleep(1000)
    if (code === "123456") {
      return { user: { id: "1", email: "admin@bigdropsmarketing.com", name: "Admin" } }
    }
    return { error: "Invalid verification code" }
  },

  forgotPassword: async (email: string): Promise<{ success: boolean; error?: string }> => {
    await sleep(1000)
    if (email.includes("@")) {
      return { success: true }
    }
    return { success: false, error: "Invalid email address" }
  },

  resetPassword: async (password: string, code: string): Promise<{ success: boolean; error?: string }> => {
    await sleep(1000)
    if (code === "123456") {
      return { success: true }
    }
    return { success: false, error: "Invalid verification code" }
  }
}
