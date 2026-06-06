import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session.authenticated) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const logId       = req.nextUrl.searchParams.get('log_id')
  const aircraftReg = req.nextUrl.searchParams.get('aircraft_reg')
  const aircraft    = req.nextUrl.searchParams.get('aircraft')

  // List distinct aircraft that have trend data
  if (aircraft === 'list') {
    const res = await query(
      `SELECT DISTINCT l.aircraft_reg
       FROM scanned_trend_data t
       JOIN scanned_flight_logs l ON l.id = t.log_id
       ORDER BY l.aircraft_reg`
    )
    return NextResponse.json(res.rows.map(r => r.aircraft_reg))
  }

  // Single log trend data
  if (logId) {
    const res = await query(
      `SELECT t.*, l.departure_date, l.aircraft_reg
       FROM scanned_trend_data t
       JOIN scanned_flight_logs l ON l.id = t.log_id
       WHERE t.log_id = $1`,
      [logId]
    )
    return NextResponse.json(res.rows[0] || null)
  }

  // Aircraft trend series — oldest first for time-series charts
  if (aircraftReg) {
    const res = await query(
      `SELECT t.*, l.departure_date, l.flight_number
       FROM scanned_trend_data t
       JOIN scanned_flight_logs l ON l.id = t.log_id
       WHERE l.aircraft_reg = $1
       ORDER BY l.departure_date ASC
       LIMIT 90`,
      [aircraftReg]
    )
    return NextResponse.json(res.rows)
  }

  return NextResponse.json([])
}
