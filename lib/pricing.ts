export type PricingPlan = {
  slug: string
  name: string
  description: string
  monthlyPrice: number | null
  yearlyPrice: number | null
  yearlyTotal: number | null
  features: string[]
  popular: boolean
  cta: string
}

export const pricingPlans: PricingPlan[] = [
  {
    slug: 'essential',
    name: 'Essential',
    description: 'One person, one device at a time.',
    monthlyPrice: 1119,
    yearlyPrice: 558,
    yearlyTotal: 6704,
    features: [
      'Up to 3 devices',
      'All 87 server locations',
      'WireGuard® & OpenVPN',
      'Zero-log policy',
      'Kill switch',
      'Email support',
    ],
    popular: false,
    cta: 'Start trial',
  },
  {
    slug: 'standard',
    name: 'Standard',
    description: 'All features. Unlimited devices.',
    monthlyPrice: 1679,
    yearlyPrice: 838,
    yearlyTotal: 10063,
    features: [
      'Unlimited devices',
      'All 87 server locations',
      'WireGuard® & OpenVPN',
      'Zero-log policy',
      'Kill switch',
      'Split tunneling',
      'DNS leak protection',
      'Priority support',
    ],
    popular: true,
    cta: 'Start trial',
  },
  {
    slug: 'team',
    name: 'Team',
    description: 'Centralized billing for 5–50 seats.',
    monthlyPrice: null,
    yearlyPrice: null,
    yearlyTotal: null,
    features: [
      'Everything in Standard',
      'Centralized dashboard',
      'Usage analytics',
      'Dedicated IP option',
      'SSO / SAML support',
      'Account manager',
      'SLA guarantee',
    ],
    popular: false,
    cta: 'Contact us',
  },
]

export type SignupPlan = {
  id: string
  name: string
  priceLabel: string
  description: string
}

export const signupPlans: SignupPlan[] = [
  {
    id: 'essential',
    name: 'Essential',
    priceLabel: '1,119 DZD/mo',
    description: 'One person, one device at a time.',
  },
  {
    id: 'standard',
    name: 'Standard',
    priceLabel: '1,679 DZD/mo',
    description: 'Unlimited devices and premium features.',
  },
  {
    id: 'team',
    name: 'Team',
    priceLabel: 'Custom pricing',
    description: 'Enterprise plans with centralized billing.',
  },
]

export function getPricingPlan(planId: string) {
  return pricingPlans.find((plan) => plan.slug === planId)
}
