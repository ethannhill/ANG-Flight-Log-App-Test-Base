import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  void req
  const session = await getSession()
  const restrict = session.role !== 'admin' && session.entity ? session.entity : null

  // Each query gets its own entity param when restriction is active
  const ef  = (alias?: string) => restrict ? `WHERE ${alias ? alias + '.' : ''}operation = $1` : ''
  const eaf = (alias?: string) => restrict ? `AND ${alias ? alias + '.' : ''}operation = $1` : ''
  const ep  = restrict ? [restrict] : []

  const [stats, byMonth, byAircraft, byOperation, byStatus, recent] = await Promise.all([
    query(`
      SELECT
        COUNT(*)::int                                                        AS total_logs,
        COUNT(*) FILTER (WHERE status = 'pending')::int                     AS pending_review,
        COALESCE(SUM(total_flight_time), 0)::float                          AS total_hours,
        COALESCE(SUM(total_landings), 0)::int                               AS total_landings,
        COUNT(*) FILTER (
          WHERE date_trunc('month', created_at) = date_trunc('month', now())
        )::int                                                               AS this_month_logs,
        COALESCE(SUM(total_flight_time) FILTER (
          WHERE date_trunc('month', created_at) = date_trunc('month', now())
        ), 0)::float                                                         AS this_month_hours
      FROM scanned_flight_logs ${ef()}
    `, ep),

    query(`
      SELECT
        to_char(date_trunc('month', departure_date::date), 'Mon YY') AS month,
        date_trunc('month', departure_date::date)                     AS month_sort,
        COALESCE(SUM(total_flight_time), 0)::float                   AS hours,
        COUNT(*)::int                                                 AS logs
      FROM scanned_flight_logs
      WHERE departure_date IS NOT NULL
        AND departure_date::date >= date_trunc('month', now()) - INTERVAL '11 months'
        ${eaf()}
      GROUP BY 1, 2
      ORDER BY 2
    `, ep),

    query(`
      SELECT
        aircraft_reg,
        COALESCE(SUM(total_flight_time), 0)::float AS hours,
        COUNT(*)::int                               AS logs
      FROM scanned_flight_logs
      WHERE aircraft_reg IS NOT NULL AND aircraft_reg <> ''
        ${eaf()}
      GROUP BY aircraft_reg
      ORDER BY hours DESC
      LIMIT 8
    `, ep),

    query(`
      SELECT
        COALESCE(operation, 'Unknown')             AS operation,
        COALESCE(SUM(total_flight_time), 0)::float AS hours,
        COUNT(*)::int                              AS logs
      FROM scanned_flight_logs ${ef()}
      GROUP BY operation
      ORDER BY hours DESC
    `, ep),

    query(`
      SELECT status, COUNT(*)::int AS count
      FROM scanned_flight_logs ${ef()}
      GROUP BY status
      ORDER BY status
    `, ep),

    query(`
      SELECT id, flight_number, aircraft_reg, departure_date,
             captain, client, operation, total_flight_time,
             total_landings, status, created_at
      FROM scanned_flight_logs ${ef()}
      ORDER BY created_at DESC
      LIMIT 8
    `, ep),
  ])

  return NextResponse.json({
    stats:       stats.rows[0],
    byMonth:     byMonth.rows,
    byAircraft:  byAircraft.rows,
    byOperation: byOperation.rows,
    byStatus:    byStatus.rows,
    recent:      recent.rows,
  })
}
