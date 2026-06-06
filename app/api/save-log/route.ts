import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.EXTRACTION_API_URL || 'http://localhost:8001'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const res = await fetch(`${API_URL}/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
