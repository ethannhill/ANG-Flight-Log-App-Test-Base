import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getSession()
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status') || ''
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
  const offset = parseInt(searchParams.get('offset') || '0')

  const conditions: string[] = []
  const params: unknown[] = []
  let p = 1

  if (session.role !== 'admin' && session.entity) {
    conditions.push(`operation = $${p}`)
    params.push(session.entity)
    p++
  }

  if (search) {
    conditions.push(`(
      flight_number ILIKE $${p} OR
      aircraft_reg ILIKE $${p} OR
      captain ILIKE $${p} OR
      first_officer ILIKE $${p} OR
      client ILIKE $${p}
    )`)
    params.push(`%${search}%`)
    p++
  }

  if (status) {
    conditions.push(`status = $${p}`)
    params.push(status)
    p++
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const countRes = await query(
    `SELECT COUNT(*) FROM scanned_flight_logs ${where}`,
    params
  )
  const total = parseInt(countRes.rows[0].count)

  const logsRes = await query(
    `SELECT id, flight_number, aircraft_reg, operation, departure_date,
            captain, first_officer, observer, flight_type, client,
            total_flight_time, total_landings, created_at, remarks, status
     FROM scanned_flight_logs
     ${where}
     ORDER BY departure_date DESC, created_at DESC
     LIMIT $${p} OFFSET $${p + 1}`,
    [...params, limit, offset]
  )

  return NextResponse.json({ logs: logsRes.rows, total })
}
