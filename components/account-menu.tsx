"use client"

import { useState } from "react"
import { MoreVertical } from "lucide-react"
import { useAuth } from "./auth-provider"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"

type SettingsTab = "general" | "email" | "password"

export function AccountMenu({ mobile = false }: { mobile?: boolean }) {
  const auth = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newEmail, setNewEmail] = useState(auth.user?.email || "")
  const [newPassword, setNewPassword] = useState("")
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("")
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!auth.isAuthenticated) return null

  const handleUpdateEmail = async () => {
    setErrorMessage(null)
    setStatusMessage(null)
    setIsSubmitting(true)

    if (!currentPassword || !newEmail) {
      setErrorMessage("Current password and new email are required.")
      setIsSubmitting(false)
      return
    }

    const result = await auth.updateEmail(currentPassword, newEmail)
    if (!result.success) {
      setErrorMessage(result.error ?? "Failed to update email.")
      setIsSubmitting(false)
      return
    }

    setStatusMessage("Email updated successfully.")
    setCurrentPassword("")
    setIsSubmitting(false)
    setTimeout(() => {
      setSettingsOpen(false)
    }, 1500)
  }

  const handleUpdatePassword = async () => {
    setErrorMessage(null)
    setStatusMessage(null)
    setIsSubmitting(true)

    if (!currentPassword || !newPassword || !newPasswordConfirm) {
      setErrorMessage("All password fields are required.")
      setIsSubmitting(false)
      return
    }

    if (newPassword !== newPasswordConfirm) {
      setErrorMessage("New passwords do not match.")
      setIsSubmitting(false)
      return
    }

    const result = await auth.updatePassword(currentPassword, newPassword)
    if (!result.success) {
      setErrorMessage(result.error ?? "Failed to update password.")
      setIsSubmitting(false)
      return
    }

    setStatusMessage("Password updated successfully.")
    setCurrentPassword("")
    setNewPassword("")
    setNewPasswordConfirm("")
    setIsSubmitting(false)
    setTimeout(() => {
      setSettingsOpen(false)
    }, 1500)
  }

  const handleDisconnect = () => {
    auth.logout()
    setIsOpen(false)
    setSettingsOpen(false)
  }

  const getInitial = (email: string) => {
    return email.charAt(0).toUpperCase()
  }

  return (
    <>
      {/* Avatar/Profile Button */}
      <div className={mobile ? "relative w-full" : "relative"}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={mobile
            ? "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-muted transition-colors"
            : "flex items-center justify-center w-9 h-9 rounded-full bg-primary/20 text-primary hover:bg-primary/30 transition-colors font-semibold text-sm"}
          aria-label="Account menu"
          title={auth.user?.email}
        >
          {mobile ? (
            <>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary">
                {getInitial(auth.user?.email || "")}
              </span>
              <span className="truncate">{auth.user?.email}</span>
            </>
          ) : (
            getInitial(auth.user?.email || "")
          )}
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className={mobile
            ? "relative mt-2 w-full rounded-xl bg-background border border-border shadow-lg z-50 overflow-hidden"
            : "absolute right-0 mt-2 w-56 rounded-xl bg-background border border-border shadow-lg z-50 overflow-hidden"}>
            <div className="p-4 border-b border-border">
              <p className="text-sm text-muted-foreground">Account</p>
              <p className="text-sm font-semibold text-foreground truncate">{auth.user?.email}</p>
              {auth.user?.planId && (
                <p className="text-xs text-muted-foreground mt-2 capitalize">
                  Plan: <strong>{auth.user.planId}</strong>
                </p>
              )}
            </div>

            <div className="flex flex-col">
              <button
                onClick={() => {
                  setSettingsTab("general")
                  setSettingsOpen(true)
                  setIsOpen(false)
                }}
                className="px-4 py-3 text-sm text-foreground hover:bg-muted transition-colors text-left border-b border-border"
              >
                Modify Account
              </button>
              {auth.user?.role === "admin" && (
                <a
                  href="/admin"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-3 text-sm text-foreground hover:bg-muted transition-colors text-left border-b border-border"
                >
                  Admin controls
                </a>
              )}
              <button
                onClick={handleDisconnect}
                className="px-4 py-3 text-sm text-destructive hover:bg-destructive/10 transition-colors text-left"
              >
                Disconnect
              </button>
            </div>
          </div>
        )}

        {/* Click outside to close */}
        {isOpen && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
        )}
      </div>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Modify Account</DialogTitle>
            <DialogDescription>
              Update your account information and security settings.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 mb-4">
            <div className="flex items-center gap-2 rounded-full border border-border bg-muted/50 p-1">
              <button
                type="button"
                onClick={() => {
                  setSettingsTab("general")
                  setErrorMessage(null)
                  setStatusMessage(null)
                }}
                className={cn(
                  "rounded-full px-4 py-1 text-sm font-medium transition-colors",
                  settingsTab === "general"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                General
              </button>
              <button
                type="button"
                onClick={() => {
                  setSettingsTab("email")
                  setErrorMessage(null)
                  setStatusMessage(null)
                }}
                className={cn(
                  "rounded-full px-4 py-1 text-sm font-medium transition-colors",
                  settingsTab === "email"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Email
              </button>
              <button
                type="button"
                onClick={() => {
                  setSettingsTab("password")
                  setErrorMessage(null)
                  setStatusMessage(null)
                }}
                className={cn(
                  "rounded-full px-4 py-1 text-sm font-medium transition-colors",
                  settingsTab === "password"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Password
              </button>
            </div>
          </div>

          <div className="space-y-4 py-2">
            {settingsTab === "general" && (
              <div className="rounded-2xl border border-border bg-muted/70 p-4 space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Email Address</p>
                  <p className="text-sm font-semibold text-foreground">{auth.user?.email}</p>
                </div>
                {auth.user?.planId && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Current Plan</p>
                    <p className="text-sm font-semibold text-foreground capitalize">{auth.user.planId}</p>
                  </div>
                )}
              </div>
            )}

            {settingsTab === "email" && (
              <div className="space-y-3">
                <div className="grid gap-2">
                  <Label htmlFor="current-password-email">Current Password</Label>
                  <Input
                    id="current-password-email"
                    type="password"
                    placeholder="••••••••"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new-email">New Email Address</Label>
                  <Input
                    id="new-email"
                    type="email"
                    placeholder="newemail@example.com"
                    value={newEmail}
                    onChange={(event) => setNewEmail(event.target.value)}
                  />
                </div>
              </div>
            )}

            {settingsTab === "password" && (
              <div className="space-y-3">
                <div className="grid gap-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input
                    id="current-password"
                    type="password"
                    placeholder="••••••••"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirm-new-password">Confirm New Password</Label>
                  <Input
                    id="confirm-new-password"
                    type="password"
                    placeholder="••••••••"
                    value={newPasswordConfirm}
                    onChange={(event) => setNewPasswordConfirm(event.target.value)}
                  />
                </div>
              </div>
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
            {settingsTab === "general" ? (
              <button
                type="button"
                onClick={handleDisconnect}
                className="w-full rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
              >
                Disconnect
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setSettingsTab("general")
                    setCurrentPassword("")
                    if (settingsTab === "email") setNewEmail(auth.user?.email || "")
                    if (settingsTab === "password") {
                      setNewPassword("")
                      setNewPasswordConfirm("")
                    }
                  }}
                  className="flex-1 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <Button
                  type="button"
                  className="flex-1"
                  onClick={settingsTab === "email" ? handleUpdateEmail : handleUpdatePassword}
                  disabled={isSubmitting}
                >
                  {settingsTab === "email" ? "Update Email" : "Update Password"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
