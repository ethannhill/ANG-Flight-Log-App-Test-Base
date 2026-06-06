import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getSession()
  const { searchParams } = new URL(req.url)
  const from  = searchParams.get('from')  || ''
  const to    = searchParams.get('to')    || ''
  const op    = searchParams.get('op')    || ''

  const base: string[] = []
  const params: unknown[] = []
  let p = 1

  if (session.role !== 'admin' && session.entity) {
    base.push(`operation = $${p++}`)
    params.push(session.entity)
  }
  if (from) { base.push(`departure_date::date >= $${p++}`); params.push(from) }
  if (to)   { base.push(`departure_date::date <= $${p++}`); params.push(to) }
  if (op)   { base.push(`operation = $${p++}`); params.push(op) }

  const where        = base.length ? `WHERE ${base.join(' AND ')}` : ''
  const whereReg     = [...base, 'aircraft_reg IS NOT NULL', "aircraft_reg <> ''"]
  const whereRegStr  = `WHERE ${whereReg.join(' AND ')}`
  const whereDate    = [...base, 'departure_date IS NOT NULL']
  const whereDateStr = `WHERE ${whereDate.join(' AND ')}`

  const [byClient, byAircraft, byMonth, totals] = await Promise.all([
    query(`
      SELECT
        COALESCE(NULLIF(client, ''), 'Unknown') AS client,
        operation,
        COUNT(*)::int                           AS logs,
        COALESCE(SUM(total_flight_time), 0)     AS hours,
        COALESCE(SUM(total_landings), 0)::int   AS landings
      FROM scanned_flight_logs ${where}
      GROUP BY 1, 2
      ORDER BY hours DESC
    `, params),

    query(`
      SELECT
        aircraft_reg,
        operation,
        COUNT(*)::int                         AS logs,
        COALESCE(SUM(total_flight_time), 0)   AS hours,
        COALESCE(SUM(total_landings), 0)::int AS landings
      FROM scanned_flight_logs ${whereRegStr}
      GROUP BY 1, 2
      ORDER BY hours DESC
    `, params),

    query(`
      SELECT
        to_char(date_trunc('month', departure_date::date), 'Mon YYYY') AS month,
        date_trunc('month', departure_date::date)                       AS month_sort,
        operation,
        COUNT(*)::int                                                   AS logs,
        COALESCE(SUM(total_flight_time), 0)                            AS hours
      FROM scanned_flight_logs ${whereDateStr}
      GROUP BY 1, 2, 3
      ORDER BY 2
    `, params),

    query(`
      SELECT
        COUNT(*)::int                         AS total_logs,
        COALESCE(SUM(total_flight_time), 0)   AS total_hours,
        COALESCE(SUM(total_landings), 0)::int AS total_landings,
        COUNT(DISTINCT aircraft_reg)::int     AS aircraft_count,
        COUNT(DISTINCT client)::int           AS client_count
      FROM scanned_flight_logs ${where}
    `, params),
  ])

  return NextResponse.json({
    byClient:   byClient.rows,
    byAircraft: byAircraft.rows,
    byMonth:    byMonth.rows,
    totals:     totals.rows[0],
  })
}
