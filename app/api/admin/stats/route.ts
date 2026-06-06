import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { checkAdminKey } from '@/lib/adminAuth'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}

export async function GET(req: NextRequest) {
  if (!checkAdminKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const thisMonth = new Date().toISOString().slice(0, 7)

  const [totals, byStatus, byOperation, thisMonthRow, users] = await Promise.all([
    query(`SELECT COUNT(*)::int AS logs, COALESCE(SUM(total_flight_time),0) AS hours, COALESCE(SUM(total_landings),0)::int AS landings FROM scanned_flight_logs`),
    query(`SELECT status, COUNT(*)::int AS count FROM scanned_flight_logs GROUP BY status`),
    query(`SELECT operation, COUNT(*)::int AS logs, COALESCE(SUM(total_flight_time),0) AS hours FROM scanned_flight_logs GROUP BY operation ORDER BY logs DESC`),
    query(`SELECT COUNT(*)::int AS logs, COALESCE(SUM(total_flight_time),0) AS hours FROM scanned_flight_logs WHERE departure_date::text LIKE $1`, [`${thisMonth}%`]),
    query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE entity='AU')::int AS au, COUNT(*) FILTER (WHERE entity='PNG')::int AS png FROM app_users`),
  ])

  return NextResponse.json({
    totals: totals.rows[0],
    byStatus: byStatus.rows,
    byOperation: byOperation.rows,
    thisMonth: thisMonthRow.rows[0],
    users: users.rows[0],
  })
}
