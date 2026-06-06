import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getSession } from '@/lib/session'

const SKYNET_URL = process.env.SKYNET_API_URL || ''
const SKYNET_KEY = process.env.SKYNET_API_KEY || ''

type SkynetFlight = {
  id: string
  // SKYNET uses "Flight Reference" (numeric DFR, e.g. 10071) as the matching key
  // "Flight Number" is a text description (e.g. "NPL ATR") — don't match on this
  flight_reference: string      // Flight Reference column — matches our flight_number
  flight_number: string         // Flight Number column (text description)
  aircraft_registration: string // Tail Number
  departure_date: string        // Actual Departure date portion
  flight_time_hours: number     // Flight Time
  billed_flight_time: number    // Billed Flight Time — the billing figure
  landings: number              // not in SKYNET export directly, derived
  captain: string               // Command Pilot
  other_crew: string            // Other Crew
  passenger_count: number       // Passenger Count
  client: string                // Flight Contract
  fuel_docket: string           // Fuel Docket #
  fuel_qty: number              // Fuel QTY
  departure_point: string       // Departure Point (ICAO)
  arrival_point: string         // Arrival Point (ICAO)
  status: string
}

async function fetchSkynetFlights(from: string, to: string): Promise<SkynetFlight[]> {
  if (!SKYNET_KEY || !SKYNET_URL) return []
  const params = new URLSearchParams({ startDate: from, endDate: to })
  const res = await fetch(`${SKYNET_URL}?${params}`, {
    headers: { Authorization: `Bearer ${SKYNET_KEY}` },
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`SKYNET ${res.status}`)
  const json = await res.json()
  const rows: Record<string, unknown>[] = Array.isArray(json) ? json : (json.legs ?? json.flights ?? json.data ?? [])

  return rows.map(r => {
    const dep = r['Departure'] as Record<string, unknown> | undefined
    const dest = r['Destination'] as Record<string, unknown> | undefined
    const oooi = (r['FlightData'] as Record<string, unknown> | undefined)?.['OOOI'] as Record<string, unknown> | undefined
    const crew = (r['Crew'] as { FullName: string; Position: string }[] | undefined) ?? []
    const captain = crew.find(c => c.Position?.toLowerCase().includes('captain'))?.FullName ?? ''
    const otherCrew = crew.filter(c => !c.Position?.toLowerCase().includes('captain')).map(c => c.FullName).join(', ')
    const departureDate = String(oooi?.['Off'] ?? dep?.['ScheduledDepartureTime'] ?? '').substring(0, 10)
    // FlightTime from Skynet is in minutes — convert to hours for comparison
    const flightTimeHours = Math.round((Number(r['FlightTime'] ?? 0) / 60) * 100) / 100

    const offTime = String(oooi?.['Off'] ?? '').replace(/[^0-9]/g, '')
    return {
      id:                    `${String(r['Reference'] ?? '')}_${String(r['Aircraft'] ?? '')}_${offTime}`,
      flight_reference:      String(r['Reference'] ?? ''),
      flight_number:         String(r['FlightNumber'] ?? ''),
      aircraft_registration: String(r['Aircraft'] ?? ''),
      departure_date:        departureDate,
      flight_time_hours:     flightTimeHours,
      billed_flight_time:    flightTimeHours,
      landings:              0,
      captain,
      other_crew:            otherCrew,
      passenger_count:       0,
      client:                String(r['Contract'] ?? ''),
      fuel_docket:           '',
      fuel_qty:              0,
      departure_point:       String(dep?.['DepartureAirport'] ?? ''),
      arrival_point:         String(dest?.['ArrivalAirport'] ?? ''),
      status:                '',
    }
  })
}

// Match on DFR number + aircraft reg (date can drift by timezone offset)
function matchKey(flightRef: string, reg: string) {
  return `${(flightRef || '').trim()}|${(reg || '').replace(/[-\s]/g, '').toUpperCase()}`
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from') || new Date(Date.now() - 30 * 86400000).toISOString().substring(0, 10)
  const to   = searchParams.get('to')   || new Date().toISOString().substring(0, 10)

  const restrict = session.role !== 'admin' && session.entity ? session.entity : null
  const dbParams: unknown[] = [from, to]
  const entityClause = restrict ? ` AND operation = $3` : ''
  if (restrict) dbParams.push(restrict)

  const dbRes = await query(
    `SELECT id, flight_number, aircraft_reg, departure_date, captain, first_officer,
            total_flight_time, total_landings, status, operation, client, remarks
     FROM scanned_flight_logs
     WHERE departure_date::date BETWEEN $1 AND $2${entityClause}
     ORDER BY departure_date DESC`,
    dbParams
  )

  const scanned = dbRes.rows

  let skynetFlights: SkynetFlight[] = []
  let skynetError: string | null = null
  let skynetAvailable = !!(SKYNET_KEY && SKYNET_URL)

  if (skynetAvailable) {
    try {
      skynetFlights = await fetchSkynetFlights(from, to)
    } catch (e) {
      skynetError = e instanceof Error ? e.message : 'SKYNET fetch failed'
      skynetAvailable = false
    }
  }

  // Build maps keyed by DFR + reg
  const scannedMap = new Map(scanned.map(s => [
    matchKey(s.flight_number, s.aircraft_reg), s
  ]))
  const skynetMap = new Map(skynetFlights.map(f => [
    matchKey(f.flight_reference, f.aircraft_registration), f
  ]))

  const matched: {
    scanned: typeof scanned[0]
    skynet: SkynetFlight
    hoursVariance: number
    landingsVariance: number
    hasDiscrepancy: boolean
    // Fields in our log that SKYNET is missing (for display)
    skynetGaps: string[]
  }[] = []

  const scannedOnly: typeof scanned = []
  const skynetOnly: SkynetFlight[] = []

  for (const [key, s] of scannedMap.entries()) {
    const sky = skynetMap.get(key)
    if (sky) {
      const hoursVariance = Math.abs(Number(s.total_flight_time || 0) - Number(sky.billed_flight_time || sky.flight_time_hours || 0))
      const landingsVariance = Math.abs(Number(s.total_landings || 0) - Number(sky.landings || 0))

      // Identify gaps in SKYNET that our log can fill
      const skynetGaps: string[] = []
      if (!sky.captain && s.captain) skynetGaps.push('Captain')
      if (!sky.other_crew && s.first_officer) skynetGaps.push('F/O')
      if (!sky.passenger_count && s.total_landings) skynetGaps.push('Pax')
      if (!sky.fuel_docket) skynetGaps.push('Fuel docket')

      matched.push({
        scanned: s,
        skynet: sky,
        hoursVariance: Math.round(hoursVariance * 100) / 100,
        landingsVariance,
        hasDiscrepancy: hoursVariance > 0.05 || landingsVariance > 0,
        skynetGaps,
      })
    } else {
      scannedOnly.push(s)
    }
  }

  for (const [key, f] of skynetMap.entries()) {
    if (!scannedMap.has(key)) skynetOnly.push(f)
  }

  return NextResponse.json({
    from,
    to,
    skynetAvailable,
    skynetError,
    summary: {
      matched: matched.length,
      scannedOnly: scannedOnly.length,
      skynetOnly: skynetOnly.length,
      discrepancies: matched.filter(m => m.hasDiscrepancy).length,
    },
    matched,
    scannedOnly,
    skynetOnly,
  })
}
