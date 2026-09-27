import { NextResponse } from 'next/server'
export async function GET() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'
  const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/pricing`, { cache: 'no-store' })

  if (!response.ok) {
    return NextResponse.json({ plans: [] }, { status: response.status })
  }

  return NextResponse.json(await response.json())
}
