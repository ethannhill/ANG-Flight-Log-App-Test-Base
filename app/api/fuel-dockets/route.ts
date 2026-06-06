import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getSession } from '@/lib/session'

const API_URL = process.env.EXTRACTION_API_URL || 'http://localhost:8001'

// List dockets
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session.authenticated) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const logId   = req.nextUrl.searchParams.get('log_id')
  const status  = req.nextUrl.searchParams.get('status')

  const conditions: string[] = []
  const params: unknown[] = []
  let p = 1

  if (logId)  { conditions.push(`d.log_id = $${p++}`);          params.push(logId) }
  if (status) { conditions.push(`d.match_status = $${p++}`);    params.push(status) }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const res = await query(
    `SELECT d.*, l.flight_number, l.aircraft_reg AS log_aircraft, l.departure_date AS flight_date
     FROM scanned_fuel_dockets d
     LEFT JOIN scanned_flight_logs l ON l.id = d.log_id
     ${where}
     ORDER BY d.created_at DESC
     LIMIT 100`,
    params
  )
  return NextResponse.json(res.rows)
}

// Extract-preview proxy
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.authenticated) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const res = await fetch(`${API_URL}/extract-docket-preview`, {
    method: 'POST',
    body: formData,
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
