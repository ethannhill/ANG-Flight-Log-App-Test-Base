import { NextResponse } from 'next/server'

export async function GET() {
  const token = process.env.MOTHERDUCK_TOKEN
  if (!token) return NextResponse.json({ error: 'No token configured' }, { status: 500 })
  // Return the token — it's a PAT that can be used directly by the WASM client
  return NextResponse.json({ token })
}
