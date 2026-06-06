import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import * as XLSX from 'xlsx'

export const maxDuration = 120 // 2 minutes

type Row = {
  log_number: string | null
  flight_number: string | null
  aircraft_reg: string | null
  operation: string
  departure_date: string | null
  captain: string | null
  client: string | null
  depart_stn: string | null
  arrival_stn: string | null
  off_block: string | null
  take_off: string | null
  land: string | null
  on_block: string | null
  flight_time: number | null
  block_time: number | null
  landings: number | null
  fuel_burn_kg: number | null
  pax: number | null
  delay_minutes: number | null
  source: string
  source_file: string
}

function excelDateToISO(val: unknown): string | null {
  if (!val) return null
  if (val instanceof Date) return val.toISOString().slice(0, 10)
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val)
    if (!d) return null
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  return String(val).slice(0, 10)
}

function excelTimeToHHMM(val: unknown): string | null {
  if (!val) return null
  if (val instanceof Date) {
    return String(val.getUTCHours()).padStart(2, '0') + String(val.getUTCMinutes()).padStart(2, '0')
  }
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val)
    if (!d) return null
    return String(d.H).padStart(2, '0') + String(d.M).padStart(2, '0')
  }
  return null
}

function parseAerlinkRow(row: unknown[], headers: (string | null)[]): Row | null {
  function col(name: string) {
    const i = headers.indexOf(name)
    return i >= 0 ? row[i] : null
  }

  const reg = col('Aircraft Registration')
  if (!reg || !String(reg).startsWith('VH-')) return null

  const flightTime = col('Flight Time (decimal)')
  if (!flightTime || Number(flightTime) <= 0) return null

  return {
    log_number:    col('Flight\nLog No.') ? String(col('Flight\nLog No.')).trim() : null,
    flight_number: col('Flight No.') ? String(col('Flight No.')).trim() : null,
    aircraft_reg:  String(reg).trim(),
    operation:     'AU',
    departure_date: excelDateToISO(col('Dep. Date (Local Time)')),
    captain:       col('Pilot In Command') ? String(col('Pilot In Command')).trim() : null,
    client:        col('Client') ? String(col('Client')).trim() : null,
    depart_stn:    col('Dep. Airport') ? String(col('Dep. Airport')).trim() : null,
    arrival_stn:   col('Arr. Airport') ? String(col('Arr. Airport')).trim() : null,
    off_block:     excelTimeToHHMM(col('Off Blocks\nUTC')),
    take_off:      excelTimeToHHMM(col('Take Off\nUTC')),
    land:          excelTimeToHHMM(col('Landing\nUTC')),
    on_block:      excelTimeToHHMM(col('On Blocks\nUTC')),
    flight_time:   flightTime ? Number(flightTime) : null,
    block_time:    col('Block Time (decimal)') ? Number(col('Block Time (decimal)')) : null,
    landings:      col('Landings') ? Number(col('Landings')) : null,
    fuel_burn_kg:  col('Fuel Burn (Kg)') ? Number(col('Fuel Burn (Kg)')) : null,
    pax:           col('Total No. of PAX') ? Number(col('Total No. of PAX')) : null,
    delay_minutes: col('Delay (mins)') ? Number(col('Delay (mins)')) : null,
    source:        'aerlink_otp',
    source_file:   '',
  }
}

function parseSkynetRow(row: unknown[], headers: (string | null)[]): Row | null {
  function col(name: string) {
    const i = headers.indexOf(name)
    return i >= 0 ? row[i] : null
  }

  const reg = col('Tail Number')
  if (!reg) return null

  const flightTime = col('Billed Flight Time')
  if (!flightTime || Number(flightTime) <= 0) return null

  return {
    log_number:    col('Flight Reference') ? String(col('Flight Reference')).trim() : null,
    flight_number: col('Flight Number') ? String(col('Flight Number')).trim() : null,
    aircraft_reg:  String(reg).trim(),
    operation:     String(reg).startsWith('VH-') ? 'AU' : 'PNG',
    departure_date: excelDateToISO(col('Scheduled Departure')),
    captain:       col('Command Pilot') ? String(col('Command Pilot')).trim() : null,
    client:        col('Flight Contract') ? String(col('Flight Contract')).trim() : null,
    depart_stn:    col('Departure Point') ? String(col('Departure Point')).trim() : null,
    arrival_stn:   col('Arrival Point') ? String(col('Arrival Point')).trim() : null,
    off_block:     excelTimeToHHMM(col('Engine Start')),
    take_off:      excelTimeToHHMM(col('Actual Departure')),
    land:          excelTimeToHHMM(col('Actual Arrival')),
    on_block:      excelTimeToHHMM(col('Engine Stop')),
    flight_time:   flightTime ? Number(flightTime) : null,
    block_time:    col('Total Block') ? Number(col('Total Block')) : null,
    landings:      1,
    fuel_burn_kg:  col('Sector Burn') ? Number(col('Sector Burn')) : null,
    pax:           col('Passenger Count') ? Number(col('Passenger Count')) : null,
    delay_minutes: col('Depart Delay (Actual)') ? Math.round(Number(col('Depart Delay (Actual)')) * 60) : null,
    source:        'skynet_png',
    source_file:   '',
  }
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const type = formData.get('type') as string | null
  const previewOnly = formData.get('preview') === 'true'
  const cutoffDate = formData.get('cutoff') as string | null // e.g. '2026-05-31'

  if (!file || !type) return NextResponse.json({ error: 'Missing file or type' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })

  const sheetName = type === 'aerlink' ? 'Data Table' : 'Skynet Data'
  const ws = wb.Sheets[sheetName]
  if (!ws) return NextResponse.json({ error: `Sheet "${sheetName}" not found` }, { status: 400 })

  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null })

  // Find header row
  const headerRowIndex = type === 'aerlink' ? 4 : 1
  const headers = (raw[headerRowIndex] as (string | null)[]).map(h => h ? String(h).trim() : null)

  const rows: Row[] = []
  for (let i = headerRowIndex + 1; i < raw.length; i++) {
    const parsed = type === 'aerlink'
      ? parseAerlinkRow(raw[i] as unknown[], headers)
      : parseSkynetRow(raw[i] as unknown[], headers)
    if (parsed) {
      // Apply cutoff date filter
      if (cutoffDate && parsed.departure_date && parsed.departure_date > cutoffDate) continue
      parsed.source_file = file.name
      rows.push(parsed)
    }
  }

  if (previewOnly) {
    return NextResponse.json({ total: rows.length, preview: rows.slice(0, 10) })
  }

  // Bulk insert in chunks of 500 rows
  const CHUNK = 500
  let inserted = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const values: unknown[] = []
    const placeholders = chunk.map((r, j) => {
      const base = j * 21
      values.push(r.log_number, r.flight_number, r.aircraft_reg, r.operation, r.departure_date,
        r.captain, r.client, r.depart_stn, r.arrival_stn, r.off_block, r.take_off,
        r.land, r.on_block, r.flight_time, r.block_time, r.landings,
        r.fuel_burn_kg, r.pax, r.delay_minutes, r.source, r.source_file)
      return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8},$${base+9},$${base+10},$${base+11},$${base+12},$${base+13},$${base+14},$${base+15},$${base+16},$${base+17},$${base+18},$${base+19},$${base+20},$${base+21})`
    }).join(',')
    try {
      await query(
        `INSERT INTO historical_flights
          (log_number, flight_number, aircraft_reg, operation, departure_date, captain, client,
           depart_stn, arrival_stn, off_block, take_off, land, on_block,
           flight_time, block_time, landings, fuel_burn_kg, pax, delay_minutes, source, source_file)
         VALUES ${placeholders}`,
        values
      )
      inserted += chunk.length
    } catch (e) { console.error('Chunk insert error:', e) }
  }

  return NextResponse.json({ inserted, total: rows.length })
}
