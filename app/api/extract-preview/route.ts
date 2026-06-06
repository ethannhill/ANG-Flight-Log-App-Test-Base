import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.EXTRACTION_API_URL || 'http://localhost:8001'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const upstream = new FormData()
  upstream.append('file', file, file.name)

  const res = await fetch(`${API_URL}/extract-preview`, {
    method: 'POST',
    body: upstream,
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
