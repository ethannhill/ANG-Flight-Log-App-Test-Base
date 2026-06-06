import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

// MotherDuck postgres endpoint — uses token as password
function getMDPool() {
  const token = process.env.MOTHERDUCK_TOKEN!
  return new Pool({
    host: 'pg.us-west-2-aws.motherduck.com',
    port: 5432,
    database: 'my_db',
    user: token,
    password: token,
    ssl: { rejectUnauthorized: false },
    max: 2,
    idleTimeoutMillis: 10000,
  })
}

export async function POST(req: NextRequest) {
  const { year, month, operation, client } = await req.json()

  const conditions: string[] = []
  if (year)      conditions.push(`YEAR(departure_date) = ${Number(year)}`)
  if (month)     conditions.push(`MONTH(departure_date) = ${Number(month)}`)
  if (operation) conditions.push(`operation = '${operation.replace(/'/g, "''")}'`)
  if (client)    conditions.push(`client ILIKE '%${client.replace(/'/g, "''")}%'`)

  const where    = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const whereAnd = conditions.length ? `WHERE ${conditions.join(' AND ')} AND` : 'WHERE'

  const pool = getMDPool()
  try {
    const [r1, r2, r3, r4, r5, r6, r7] = await Promise.all([
      pool.query(`SELECT COUNT(*)::INT AS sectors, ROUND(SUM(flight_time)::numeric,1) AS hours,
        SUM(pax)::INT AS pax, COUNT(DISTINCT aircraft_reg)::INT AS aircraft,
        MIN(departure_date)::VARCHAR AS earliest, MAX(departure_date)::VARCHAR AS latest
        FROM historical_flights ${where}`),
      pool.query(`SELECT client, ROUND(SUM(flight_time)::numeric,1) AS hours,
        COUNT(*)::INT AS sectors, SUM(pax)::INT AS pax
        FROM historical_flights ${where} GROUP BY client ORDER BY hours DESC LIMIT 12`),
      pool.query(`SELECT YEAR(departure_date)::INT AS year, COUNT(*)::INT AS sectors,
        ROUND(SUM(flight_time)::numeric,1) AS hours, SUM(pax)::INT AS pax
        FROM historical_flights ${where} GROUP BY 1 ORDER BY 1`),
      pool.query(`SELECT STRFTIME(departure_date, '%Y-%m') AS month,
        ROUND(SUM(flight_time)::numeric,1) AS hours, SUM(pax)::INT AS pax
        FROM historical_flights ${where} GROUP BY 1 ORDER BY 1`),
      pool.query(`SELECT depart_stn || '→' || arrival_stn AS route,
        COUNT(*)::INT AS sectors, ROUND(SUM(flight_time)::numeric,1) AS hours
        FROM historical_flights
        ${whereAnd} depart_stn IS NOT NULL AND arrival_stn IS NOT NULL
        GROUP BY 1 ORDER BY sectors DESC LIMIT 10`),
      pool.query(`SELECT aircraft_reg, ROUND(SUM(fuel_burn_kg)::numeric,0)::INT AS fuel_kg,
        COUNT(*)::INT AS sectors
        FROM historical_flights
        ${whereAnd} fuel_burn_kg IS NOT NULL AND fuel_burn_kg > 0
        GROUP BY aircraft_reg ORDER BY fuel_kg DESC LIMIT 10`),
      pool.query(`SELECT COUNT(*)::INT AS total,
        COUNT(*) FILTER (WHERE delay_minutes IS NULL OR delay_minutes = 0)::INT AS on_time,
        COUNT(*) FILTER (WHERE delay_minutes > 0)::INT AS delayed,
        ROUND(AVG(delay_minutes) FILTER (WHERE delay_minutes > 0)::numeric,1) AS avg_delay
        FROM historical_flights ${where}`),
    ])

    return NextResponse.json({
      kpis:      r1.rows[0],
      byClient:  r2.rows,
      byYear:    r3.rows,
      byMonth:   r4.rows,
      topRoutes: r5.rows,
      byFuel:    r6.rows,
      onTime:    r7.rows[0],
    })
  } catch (err) {
    console.error('MotherDuck query error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  } finally {
    await pool.end()
  }
}
