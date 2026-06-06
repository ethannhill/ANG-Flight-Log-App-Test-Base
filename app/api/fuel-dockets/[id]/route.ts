import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session.authenticated) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { docket_number, aircraft_reg, docket_date, supplier, product, quantity_litres, density, location } = body

  await query(
    `UPDATE scanned_fuel_dockets
     SET docket_number=$1, aircraft_reg=$2, docket_date=$3, supplier=$4, product=$5,
         quantity_litres=$6, density=$7, location=$8
     WHERE id=$9`,
    [docket_number, aircraft_reg, docket_date, supplier, product, quantity_litres, density, location, id]
  )

  // Re-run matching after edit
  const res = await query(
    `SELECT id FROM scanned_fuel_dockets WHERE id=$1`,
    [id]
  )
  if (!res.rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return rematch(id, docket_number, aircraft_reg, Number(quantity_litres), Number(density))
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session.authenticated) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Get current docket fields for rematching
  const res = await query(
    `SELECT docket_number, aircraft_reg, quantity_litres, density FROM scanned_fuel_dockets WHERE id=$1`,
    [id]
  )
  if (!res.rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { docket_number, aircraft_reg, quantity_litres, density } = res.rows[0]
  return rematch(id, docket_number, aircraft_reg, Number(quantity_litres), Number(density))
}

async function rematch(id: string, docketNum: string, aircraftReg: string, qtyLitres: number, density: number) {
  // Match by docket number + tail number
  const params: unknown[] = [docketNum]
  let tailClause = ''
  if (aircraftReg) {
    tailClause = `AND UPPER(REPLACE(l.aircraft_reg,'-','')) = UPPER(REPLACE($2,'-',''))`
    params.push(aircraftReg)
  }

  const match = await query(
    `SELECT s.id AS sector_id, s.log_id, s.kgs_fuel_uplift
     FROM scanned_sectors s
     JOIN scanned_flight_logs l ON l.id = s.log_id
     WHERE LOWER(TRIM(s.fuel_docket)) = LOWER(TRIM($1))
     ${tailClause}
     LIMIT 1`,
    params
  )

  if (!match.rows.length) {
    await query(`UPDATE scanned_fuel_dockets SET match_status='unmatched', sector_id=NULL, log_id=NULL, qty_variance_kg=NULL WHERE id=$1`, [id])
    return NextResponse.json({ match_status: 'unmatched', qty_variance_kg: null })
  }

  const { sector_id, log_id, kgs_fuel_uplift } = match.rows[0]
  const d = density || 0.8
  const qtyKg = qtyLitres * d
  const kgsInLog = Number(kgs_fuel_uplift || 0)
  const variance = kgsInLog > 0 && qtyKg > 0 ? Math.round((qtyKg - kgsInLog) * 10) / 10 : null
  const status = variance == null ? 'matched' : Math.abs(variance) > 50 ? 'discrepancy' : 'matched'

  await query(
    `UPDATE scanned_fuel_dockets
     SET match_status=$1, sector_id=$2, log_id=$3, qty_variance_kg=$4
     WHERE id=$5`,
    [status, sector_id, log_id, variance, id]
  )

  return NextResponse.json({ match_status: status, qty_variance_kg: variance })
}
