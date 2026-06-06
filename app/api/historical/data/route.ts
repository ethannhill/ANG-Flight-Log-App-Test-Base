import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const operation = searchParams.get('operation') || ''
  const client    = searchParams.get('client') || ''
  const from      = searchParams.get('from') || ''
  const to        = searchParams.get('to') || ''

  const conditions: string[] = []
  const params: unknown[] = []

  if (operation) { params.push(operation); conditions.push(`operation=$${params.length}`) }
  if (client)    { params.push(`%${client}%`); conditions.push(`client ILIKE $${params.length}`) }
  if (from)      { params.push(from); conditions.push(`departure_date>=$${params.length}`) }
  if (to)        { params.push(to); conditions.push(`departure_date<=$${params.length}`) }

  const where    = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const whereAnd = conditions.length ? `WHERE ${conditions.join(' AND ')} AND` : 'WHERE'

  const [summary, byClient, byAircraft, recent, byMonth, topRoutes, onTime, byYear, quality] = await Promise.all([
    query(`SELECT
      COUNT(*)::int AS sectors,
      ROUND(SUM(flight_time)::numeric, 1) AS total_hours,
      SUM(pax)::int AS total_pax,
      COUNT(DISTINCT aircraft_reg) AS aircraft,
      MIN(departure_date) AS earliest,
      MAX(departure_date) AS latest
      FROM historical_flights ${where}`, params),
    query(`SELECT client, COUNT(*)::int AS sectors, ROUND(SUM(flight_time)::numeric,1) AS hours, SUM(pax)::int AS pax
      FROM historical_flights ${where} GROUP BY client ORDER BY hours DESC LIMIT 15`, params),
    query(`SELECT aircraft_reg, operation, COUNT(*)::int AS sectors, ROUND(SUM(flight_time)::numeric,1) AS hours
      FROM historical_flights ${where} GROUP BY aircraft_reg, operation ORDER BY hours DESC`, params),
    query(`SELECT log_number, flight_number, aircraft_reg, operation, departure_date, captain, client,
      depart_stn, arrival_stn, off_block, take_off, land, on_block,
      flight_time, block_time, landings, fuel_burn_kg, pax, delay_minutes
      FROM historical_flights ${where} ORDER BY departure_date DESC LIMIT 100`, params),
    query(`SELECT TO_CHAR(departure_date, 'YYYY-MM') AS month,
        COUNT(*)::int AS sectors,
        ROUND(SUM(flight_time)::numeric, 1) AS hours,
        COALESCE(SUM(pax), 0)::int AS pax,
        ROUND(COALESCE(SUM(fuel_burn_kg), 0)::numeric, 0) AS fuel_kg
      FROM historical_flights ${where}
      GROUP BY 1 ORDER BY 1`, params),
    query(`SELECT depart_stn || '→' || arrival_stn AS route,
        COUNT(*)::int AS sectors,
        ROUND(SUM(flight_time)::numeric, 1) AS hours
      FROM historical_flights
      ${whereAnd} depart_stn IS NOT NULL AND arrival_stn IS NOT NULL
      GROUP BY 1 ORDER BY sectors DESC LIMIT 10`, params),
    query(`SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE delay_minutes IS NULL OR delay_minutes = 0)::int AS on_time,
        COUNT(*) FILTER (WHERE delay_minutes > 0)::int AS delayed,
        ROUND(AVG(delay_minutes) FILTER (WHERE delay_minutes > 0)::numeric, 1) AS avg_delay
      FROM historical_flights ${where}`, params),
    query(`SELECT EXTRACT(YEAR FROM departure_date)::int AS year,
        COUNT(*)::int AS sectors,
        ROUND(SUM(flight_time)::numeric, 1) AS hours,
        COALESCE(SUM(pax), 0)::int AS pax,
        ROUND(COALESCE(SUM(fuel_burn_kg), 0)::numeric, 0) AS fuel_kg,
        COUNT(DISTINCT aircraft_reg) AS aircraft
      FROM historical_flights ${where}
      GROUP BY 1 ORDER BY 1`, params),
    query(`
      WITH parsed AS (
        SELECT
          flight_time, block_time,
          CASE WHEN LENGTH(take_off)=4 AND LENGTH(land)=4
            THEN (
              (CAST(LEFT(land,2) AS INT)*60 + CAST(RIGHT(land,2) AS INT)) -
              (CAST(LEFT(take_off,2) AS INT)*60 + CAST(RIGHT(take_off,2) AS INT))
            ) / 60.0
          END AS calc_flight,
          CASE WHEN LENGTH(off_block)=4 AND LENGTH(on_block)=4
            THEN (
              (CAST(LEFT(on_block,2) AS INT)*60 + CAST(RIGHT(on_block,2) AS INT)) -
              (CAST(LEFT(off_block,2) AS INT)*60 + CAST(RIGHT(off_block,2) AS INT))
            ) / 60.0
          END AS calc_block
        FROM historical_flights
        ${whereAnd} flight_time IS NOT NULL AND block_time IS NOT NULL
          AND take_off IS NOT NULL AND land IS NOT NULL
          AND off_block IS NOT NULL AND on_block IS NOT NULL
      ),
      variances AS (
        SELECT
          ABS(flight_time - calc_flight) * 60 AS flt_var_min,
          ABS(block_time - calc_block) * 60 AS blk_var_min
        FROM parsed
        WHERE calc_flight > 0 AND calc_block > 0
          AND calc_flight < 24 AND calc_block < 24
      )
      SELECT
        COUNT(*)::int AS checked,
        COUNT(*) FILTER (WHERE flt_var_min <= 5)::int AS flt_ok,
        COUNT(*) FILTER (WHERE blk_var_min <= 5)::int AS blk_ok,
        ROUND(AVG(flt_var_min)::numeric, 1) AS avg_flt_var,
        ROUND(AVG(blk_var_min)::numeric, 1) AS avg_blk_var,
        COUNT(*) FILTER (WHERE flt_var_min <= 5)::int AS flt_0_5,
        COUNT(*) FILTER (WHERE flt_var_min > 5 AND flt_var_min <= 15)::int AS flt_5_15,
        COUNT(*) FILTER (WHERE flt_var_min > 15 AND flt_var_min <= 30)::int AS flt_15_30,
        COUNT(*) FILTER (WHERE flt_var_min > 30)::int AS flt_over_30
      FROM variances
    `, params),
  ])

  return NextResponse.json({
    summary: summary.rows[0],
    byClient: byClient.rows,
    byAircraft: byAircraft.rows,
    recent: recent.rows,
    quality: quality.rows[0],
    byMonth: byMonth.rows,
    topRoutes: topRoutes.rows,
    onTime: onTime.rows[0],
    byYear: byYear.rows,
  })
}

export async function DELETE() {
  await query('DELETE FROM historical_flights')
  return NextResponse.json({ ok: true })
}
