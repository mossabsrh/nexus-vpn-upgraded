"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog"
import { Button } from "./ui/button"
import { apiFetch } from "@/lib/api"
import type { PricingPlan } from "@/lib/pricing"

interface PaymentDialogProps {
  plan: PricingPlan
  billingPeriod: "monthly" | "yearly"
  trigger: React.ReactNode
}

export function PaymentDialog({ plan, billingPeriod, trigger }: PaymentDialogProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const amount = billingPeriod === 'yearly' ? plan.yearlyTotal : plan.monthlyPrice
  const formattedAmount = amount === null ? 'Custom pricing' : `${amount.toLocaleString('en-US')} DZD`

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus('loading')
    setMessage('Creating secure checkout...')

    try {
      const response = await apiFetch('/checkout', {
        method: 'POST',
        body: JSON.stringify({
          plan_slug: plan.slug,
          billing_period: billingPeriod,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setStatus('error')
        setMessage(data.message || 'Unable to create checkout. Please try again.')
        return
      }

      if (!data.checkout_url) {
        setStatus('error')
        setMessage('Chargily did not return a checkout link.')
        return
      }

      setStatus('success')
      setMessage('Redirecting to Chargily...')
      window.location.assign(data.checkout_url)
    } catch (error) {
      console.error(error)
      setStatus('error')
      setMessage('Unable to create checkout. Please try again.')
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Subscribe to {plan.name}</DialogTitle>
          <DialogDescription>
            Continue to Chargily to complete your secure payment.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4 py-2" onSubmit={handleSubmit}>
          <div className="flex items-center justify-between rounded-md border border-border bg-muted/50 px-4 py-3 text-sm">
            <span>{plan.name} · {billingPeriod}</span>
            <strong>{formattedAmount}</strong>
          </div>

          {message && (
            <div className={`rounded-md border p-3 text-sm ${status === 'error' ? 'border-destructive/30 bg-destructive/10 text-destructive' : 'border-border bg-muted/50 text-foreground'}`}>
              {message}
            </div>
          )}

          <DialogFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button type="submit" className="w-full sm:w-auto" disabled={status === 'loading'}>
              {status === 'loading' ? 'Connecting...' : 'Continue to Chargily'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
