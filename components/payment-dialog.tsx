"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { cn } from "@/lib/utils"
import type { PricingPlan } from "@/lib/pricing"
import { useAuth } from "./auth-provider"

interface PaymentDialogProps {
  plan: PricingPlan
  trigger: React.ReactNode
}

export function PaymentDialog({ plan, trigger }: PaymentDialogProps) {
  const auth = useAuth()
  const [email, setEmail] = useState(auth.user?.email ?? "")
  const [cardNumber, setCardNumber] = useState("")
  const [expiry, setExpiry] = useState("")
  const [cvc, setCvc] = useState("")
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (auth.user?.email) {
      setEmail(auth.user.email)
    }
  }, [auth.user?.email])

  const amount = plan.yearlyPrice ?? plan.monthlyPrice
  const formattedAmount = amount ? `${amount.toLocaleString('en-US')} DZD` : 'Custom pricing'

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus('loading')
    setMessage('Processing payment...')

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: plan.slug,
          email,
          cardNumber,
          expiry,
          cvc,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setStatus('error')
        setMessage(data.error || 'Payment failed. Please check your details.')
        return
      }

      setStatus('success')
      setMessage(data.message)
    } catch (error) {
      console.error(error)
      setStatus('error')
      setMessage('Payment failed. Please try again.')
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pay for {plan.name}</DialogTitle>
          <DialogDescription>
            Complete your purchase for the {plan.name} plan.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4 py-2" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="payment-email">Email</Label>
            <Input
              id="payment-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              disabled={Boolean(auth.user)}
            />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="payment-card">Card number</Label>
              <span className="text-xs text-muted-foreground">{formattedAmount}</span>
            </div>
            <Input
              id="payment-card"
              type="text"
              value={cardNumber}
              onChange={(event) => setCardNumber(event.target.value)}
              placeholder="4242 4242 4242 4242"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="payment-expiry">Expiry</Label>
              <Input
                id="payment-expiry"
                type="text"
                value={expiry}
                onChange={(event) => setExpiry(event.target.value)}
                placeholder="MM/YY"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="payment-cvc">CVC</Label>
              <Input
                id="payment-cvc"
                type="password"
                value={cvc}
                onChange={(event) => setCvc(event.target.value)}
                placeholder="123"
                required
              />
            </div>
          </div>

          {message && (
            <div
              className={cn(
                'rounded-xl border p-3 text-sm',
                status === 'success'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                  : 'border-rose-300 bg-rose-50 text-rose-900',
              )}
            >
              {message}
            </div>
          )}

          <DialogFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button type="submit" className="w-full sm:w-auto" disabled={status === 'loading'}>
              {status === 'loading' ? 'Paying...' : `Pay ${formattedAmount}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
