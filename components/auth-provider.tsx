"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { apiFetch } from "@/lib/api"

export type AuthUser = {
  id?: number
  email: string
  name?: string
  role?: "user" | "admin"
  password?: string
  planId?: string
}

type AuthContextType = {
  user: AuthUser | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signup: (email: string, name: string, password: string, passwordConfirmation: string, planId: string) => Promise<{ success: boolean; error?: string }>
  startTrial: (planSlug: string) => Promise<{ success: boolean; error?: string }>
  cancelSubscription: () => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    apiFetch("/me")
      .then(async (response) => {
        if (response.ok) {
          const data = await response.json()
          setUser(data.user)
        }
      })
      .catch(() => undefined)
  }, [])

  const login = async (email: string, password: string) => {
    try {
      const response = await apiFetch("/auth/login", {
        method: "POST",
        skipCsrf: true,
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.error || data.message || "Invalid email or password." }
      }

      const userData: AuthUser = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        role: data.user.role,
        planId: data.user.planId,
      }

      setUser(userData)
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Login failed" }
    }
  }

  const signup = async (email: string, name: string, password: string, passwordConfirmation: string, planId: string) => {
    try {
      const response = await apiFetch("/auth/register", {
        method: "POST",
        skipCsrf: true,
        body: JSON.stringify({
          name,
          email,
          password,
          password_confirmation: passwordConfirmation,
          plan_slug: planId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.error || data.message || "Registration failed" }
      }

      const userData: AuthUser = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        role: data.user.role,
        planId: data.user.planId,
      }

      setUser(userData)
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Registration failed" }
    }
  }

  const startTrial = async (planSlug: string) => {
    try {
      const response = await apiFetch('/subscriptions/trial', {
        method: 'POST',
        body: JSON.stringify({ plan_slug: planSlug }),
      })

      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.message || data.error || 'Unable to start the trial.' }
      }

      setUser((currentUser) => currentUser
        ? { ...currentUser, planId: data.subscription.planId }
        : currentUser)
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unable to start the trial.' }
    }
  }

  const cancelSubscription = async () => {
    try {
      const response = await apiFetch("/subscriptions/cancel", {
        method: "POST",
      })

      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.message || data.error || "Unable to cancel subscription." }
      }

      setUser((currentUser) => currentUser ? { ...currentUser, planId: undefined } : currentUser)
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Unable to cancel subscription." }
    }
  }

  const logout = async () => {
    await apiFetch("/auth/logout", { method: "POST", skipCsrf: true })
    setUser(null)
  }

  const value: AuthContextType = {
    user,
    isAuthenticated: Boolean(user),
    login,
    signup,
    startTrial,
    cancelSubscription,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}
