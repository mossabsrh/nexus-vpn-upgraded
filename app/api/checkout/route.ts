import { NextResponse, type NextRequest } from 'next/server'
import { getPricingPlan } from '@/lib/pricing'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const planId = body.planId as string
  const email = body.email as string
  const cardNumber = body.cardNumber as string
  const expiry = body.expiry as string
  const cvc = body.cvc as string

  if (!planId || !email || !cardNumber || !expiry || !cvc) {
    return NextResponse.json({ error: 'Missing payment information' }, { status: 400 })
  }

  const plan = getPricingPlan(planId)

  if (!plan) {
    return NextResponse.json({ error: 'Unknown plan' }, { status: 404 })
  }

  if (plan.monthlyPrice === null && plan.yearlyPrice === null) {
    return NextResponse.json({ error: 'This plan requires custom billing' }, { status: 400 })
  }

  const paymentIntent = `pay_${Math.random().toString(36).slice(2, 10)}`

  return NextResponse.json({
    success: true,
    message: `Payment successful for ${plan.name}. Receipt: ${paymentIntent}`,
    plan,
    paymentIntent,
  })
}
