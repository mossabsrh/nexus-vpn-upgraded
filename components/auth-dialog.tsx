"use client"

import { useEffect, useState } from "react"
import { Dialog as RadixDialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { cn } from "@/lib/utils"
import { signupPlans, type SignupPlan } from "@/lib/pricing"
import { useAuth } from "./auth-provider"

interface AuthDialogProps {
  triggerText?: string
  triggerClassName?: string
  onTriggerClick?: () => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
  initialMode?: "sign-in" | "sign-up"
  onSuccess?: () => void
}

export function AuthDialog({
  triggerText = "Sign in",
  triggerClassName,
  onTriggerClick,
  open,
  onOpenChange,
  hideTrigger = false,
  initialMode = "sign-in",
  onSuccess,
}: AuthDialogProps) {
  const auth = useAuth()
  const [internalOpen, setInternalOpen] = useState(false)
  const [mode, setMode] = useState<"sign-in" | "sign-up">(initialMode)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [selectedPlan, setSelectedPlan] = useState("standard")
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const controlledOpen = open ?? internalOpen
  const setOpenState = onOpenChange ?? setInternalOpen

  useEffect(() => {
    setMode(initialMode)
  }, [initialMode])

  const closeDialog = () => {
    setErrorMessage(null)
    setStatusMessage(null)
    setName("")
    setEmail("")
    setPassword("")
    setConfirmPassword("")
    setOpenState(false)
  }

  const handleSubmit = async () => {
    setErrorMessage(null)
    setStatusMessage(null)
    setIsSubmitting(true)

    if (!email || !password) {
      setErrorMessage("Email and password are required.")
      setIsSubmitting(false)
      return
    }

    if (mode === "sign-up") {
      if (!name) {
        setErrorMessage("Name is required.")
        setIsSubmitting(false)
        return
      }
      if (password !== confirmPassword) {
        setErrorMessage("Passwords do not match.")
        setIsSubmitting(false)
        return
      }
      const result = await auth.signup(email.trim(), name.trim(), password, confirmPassword, selectedPlan)
      if (!result.success) {
        setErrorMessage(result.error ?? "Signup failed.")
        setIsSubmitting(false)
        return
      }
      setStatusMessage("Account created and signed in.")
      setIsSubmitting(false)
      closeDialog()
      onSuccess?.()
      return
    }

    const result = await auth.login(email.trim(), password)
    if (!result.success) {
      setErrorMessage(result.error ?? "Sign in failed.")
      setIsSubmitting(false)
      return
    }

    setStatusMessage("Signed in successfully.")
    setIsSubmitting(false)
    closeDialog()
    onSuccess?.()
  }

  const handleLogout = () => {
    auth.logout()
    setStatusMessage("Signed out.")
  }

  return (
    <RadixDialog open={controlledOpen} onOpenChange={setOpenState}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <button
            type="button"
            onClick={() => {
              onTriggerClick?.()
            }}
            className={cn(
              "text-sm transition-colors hover:text-foreground focus:outline-none",
              triggerClassName,
            )}
          >
            {triggerText}
          </button>
        </DialogTrigger>
      )}

      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto overscroll-contain">
        <DialogHeader>
          <DialogTitle>
            {mode === "sign-in" ? "Sign in to NexusVPN" : "Create your NexusVPN account"}
          </DialogTitle>
          <DialogDescription>
            {mode === "sign-in"
              ? "Enter your email and password to sign in."
              : "Choose a password, plan, and secure your NexusVPN account."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <div className="flex items-center gap-2 rounded-full border border-border bg-muted/50 p-1">
              <button
                type="button"
                onClick={() => setMode("sign-in")}
                className={cn(
                  "rounded-full px-4 py-1 text-sm font-medium transition-colors",
                  mode === "sign-in"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => setMode("sign-up")}
                className={cn(
                  "rounded-full px-4 py-1 text-sm font-medium transition-colors",
                  mode === "sign-up"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Sign up
              </button>
            </div>
          </div>

          {auth.isAuthenticated && mode === "sign-in" ? (
            <div className="rounded-2xl border border-border bg-muted/70 p-4">
              <p className="text-sm text-foreground">
                Signed in as <strong>{auth.user?.email}</strong>.
              </p>
              <button
                type="button"
                onClick={handleLogout}
                className="mt-3 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Sign out
              </button>
            </div>
          ) : (
            <>
              {mode === "sign-up" && (
                <div className="grid gap-2">
                  <Label htmlFor="auth-name">Full name</Label>
                  <Input
                    id="auth-name"
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="auth-email">Email</Label>
                <Input
                  id="auth-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="auth-password">Password</Label>
                <Input
                  id="auth-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>

              {mode === "sign-up" && (
                <div className="grid gap-2">
                  <Label htmlFor="auth-confirm-password">Confirm password</Label>
                  <Input
                    id="auth-confirm-password"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                  />
                </div>
              )}

              {mode === "sign-up" && (
                <div className="grid gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Choose your plan</span>
                    <span className="text-xs text-muted-foreground">Pick one to finish signup</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {signupPlans.map((plan: SignupPlan) => (
                      <label
                        key={plan.id}
                        className={cn(
                          "cursor-pointer rounded-2xl border p-3 sm:p-4 transition-all min-h-[112px] sm:min-h-[160px] flex flex-col justify-between",
                          selectedPlan === plan.id
                            ? "border-primary bg-primary/10"
                            : "border-border bg-muted/70 hover:border-foreground",
                        )}
                      >
                        <input
                          type="radio"
                          name="signup-plan"
                          value={plan.id}
                          checked={selectedPlan === plan.id}
                          onChange={() => setSelectedPlan(plan.id)}
                          className="sr-only"
                        />
                        <div className="grid gap-2">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{plan.name}</p>
                            <p className="text-xs text-muted-foreground mt-1">{plan.description}</p>
                          </div>
                          <span className="text-sm font-medium text-foreground">{plan.priceLabel}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {errorMessage && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            {errorMessage}
          </div>
        )}
        {statusMessage && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-100 p-3 text-sm text-emerald-900">
            {statusMessage}
          </div>
        )}

        <DialogFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {mode === "sign-in" ? "New here?" : "Already registered?"}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
              className="font-medium text-primary hover:underline"
            >
              {mode === "sign-in" ? "Create an account" : "Sign in instead"}
            </button>
          </div>
          <Button type="button" className="w-full sm:w-auto" onClick={handleSubmit} disabled={isSubmitting}>
            {mode === "sign-in" ? "Sign in" : "Sign up"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </RadixDialog>
  )
}
