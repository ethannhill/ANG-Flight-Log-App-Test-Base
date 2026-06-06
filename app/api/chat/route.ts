import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { query } from '@/lib/db'

async function getAnthropicKey(): Promise<string> {
  try {
    const res = await query(`SELECT value FROM app_config WHERE key = 'anthropic_api_key'`)
    if (res.rows[0]?.value) return res.rows[0].value
  } catch { /* fall through */ }
  return process.env.ANTHROPIC_API_KEY || ''
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_flights',
    description: 'Search scanned flight logs. Use for questions about flights, pilots, aircraft, dates, clients, hours. Use q for free-text search across all fields.',
    input_schema: {
      type: 'object' as const,
      properties: {
        q:          { type: 'string',  description: 'Free-text search across flight number, aircraft, captain, first officer, client (optional)' },
        aircraft:   { type: 'string',  description: 'Filter by aircraft registration, e.g. VH-XYZ (optional)' },
        captain:    { type: 'string',  description: 'Filter by captain name, partial match (optional)' },
        client:     { type: 'string',  description: 'Filter by client name, partial match (optional)' },
        operation:  { type: 'string',  description: 'AU for Aerlink (Australia) or PNG for HeviLift (Papua New Guinea) (optional)' },
        status:     { type: 'string',  description: 'pending, reviewed, or approved (optional)' },
        from_date:  { type: 'string',  description: 'Departure date from YYYY-MM-DD (optional)' },
        to_date:    { type: 'string',  description: 'Departure date to YYYY-MM-DD (optional)' },
        limit:      { type: 'integer', description: 'Max rows, default 50' },
      },
      required: [],
    },
  },
  {
    name: 'get_sectors',
    description: 'Get sector-level detail — routes, times, fuel, PAX. Use when asked about specific routes, sector counts, fuel usage, or block times.',
    input_schema: {
      type: 'object' as const,
      properties: {
        log_id:    { type: 'string', description: 'Specific log ID to get sectors for (optional)' },
        aircraft:  { type: 'string', description: 'Filter by aircraft registration (optional)' },
        from_stn:  { type: 'string', description: 'Filter by departure station (optional)' },
        to_stn:    { type: 'string', description: 'Filter by arrival station (optional)' },
        from_date: { type: 'string', description: 'Departure date from YYYY-MM-DD (optional)' },
        to_date:   { type: 'string', description: 'Departure date to YYYY-MM-DD (optional)' },
        limit:     { type: 'integer', description: 'Max rows, default 50' },
      },
      required: [],
    },
  },
  {
    name: 'get_billing_summary',
    description: 'Get aggregated flight hours and landings. Use for questions about totals, rankings, comparisons by client, aircraft, pilot, or operation.',
    input_schema: {
      type: 'object' as const,
      properties: {
        group_by:  { type: 'string',  description: 'client, aircraft_reg, captain, operation, or month (default: client)' },
        operation: { type: 'string',  description: 'AU or PNG to filter by operation (optional)' },
        from_date: { type: 'string',  description: 'Departure date from YYYY-MM-DD (optional)' },
        to_date:   { type: 'string',  description: 'Departure date to YYYY-MM-DD (optional)' },
      },
      required: [],
    },
  },
  {
    name: 'get_overview',
    description: 'Get a high-level operational overview — total logs, pending reviews, hours this month, by operation. Use for general summary questions.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_engine_trend',
    description: 'Get engine trend data (ITT, torque, oil temp/pressure, fuel flow, N1, prop RPM) for one or two aircraft. Use for questions about engine health, temperature trends, or comparing aircraft performance.',
    input_schema: {
      type: 'object' as const,
      properties: {
        aircraft:   { type: 'string', description: 'Aircraft registration, e.g. P2-KSX. Required.' },
        aircraft2:  { type: 'string', description: 'Second aircraft registration for comparison (optional).' },
        from_date:  { type: 'string', description: 'Start date YYYY-MM-DD (optional)' },
        to_date:    { type: 'string', description: 'End date YYYY-MM-DD (optional)' },
      },
      required: ['aircraft'],
    },
  },
]

type ToolInput = Record<string, string | number | undefined>

async function runTool(name: string, input: ToolInput): Promise<string> {
  try {
    if (name === 'search_flights') {
      const conditions: string[] = []
      const params: unknown[] = []
      let p = 1
      if (input.q) {
        conditions.push(`(flight_number ILIKE $${p} OR aircraft_reg ILIKE $${p} OR captain ILIKE $${p} OR first_officer ILIKE $${p} OR client ILIKE $${p})`)
        params.push(`%${input.q}%`); p++
      }
      if (input.aircraft)  { conditions.push(`aircraft_reg ILIKE $${p++}`);   params.push(`%${input.aircraft}%`) }
      if (input.captain)   { conditions.push(`captain ILIKE $${p++}`);         params.push(`%${input.captain}%`) }
      if (input.client)    { conditions.push(`client ILIKE $${p++}`);          params.push(`%${input.client}%`) }
      if (input.operation) { conditions.push(`operation = $${p++}`);           params.push(input.operation) }
      if (input.status)    { conditions.push(`status = $${p++}`);              params.push(input.status) }
      if (input.from_date) { conditions.push(`departure_date::date >= $${p++}`); params.push(input.from_date) }
      if (input.to_date)   { conditions.push(`departure_date::date <= $${p++}`); params.push(input.to_date) }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
      const limit = Number(input.limit || 50)
      const rows = (await query(
        `SELECT departure_date, aircraft_reg, operation, flight_number, captain, first_officer, client, total_flight_time, total_landings, status
         FROM scanned_flight_logs ${where} ORDER BY departure_date DESC LIMIT ${limit}`,
        params
      )).rows
      if (!rows.length) return 'No flights found matching those criteria.'
      const totalHrs = rows.reduce((s, r) => s + Number(r.total_flight_time || 0), 0)
      const header = `${rows.length} flight${rows.length > 1 ? 's' : ''}, ${totalHrs.toFixed(1)} hrs total`
      return header + '\n' + rows.map(r =>
        `${r.departure_date?.toString().slice(0,10)} | ${r.aircraft_reg} (${r.operation}) | ${r.flight_number || '—'} | ${r.captain || '—'} | ${r.client || '—'} | ${Number(r.total_flight_time||0).toFixed(1)}h | ${r.status}`
      ).join('\n')
    }

    if (name === 'get_sectors') {
      const conditions: string[] = []
      const params: unknown[] = []
      let p = 1
      const joins: string[] = []
      if (input.log_id)   { conditions.push(`s.log_id = $${p++}`);                     params.push(input.log_id) }
      if (input.aircraft) { joins.push('JOIN scanned_flight_logs l ON l.id = s.log_id');
                            conditions.push(`l.aircraft_reg ILIKE $${p++}`);            params.push(`%${input.aircraft}%`) }
      if (input.from_stn) { conditions.push(`s.depart_stn ILIKE $${p++}`);             params.push(`%${input.from_stn}%`) }
      if (input.to_stn)   { conditions.push(`s.arrival_stn ILIKE $${p++}`);            params.push(`%${input.to_stn}%`) }
      if (input.from_date){ conditions.push(`s.log_id IN (SELECT id FROM scanned_flight_logs WHERE departure_date::date >= $${p++})`); params.push(input.from_date) }
      if (input.to_date)  { conditions.push(`s.log_id IN (SELECT id FROM scanned_flight_logs WHERE departure_date::date <= $${p++})`); params.push(input.to_date) }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
      const limit = Number(input.limit || 50)
      const rows = (await query(
        `SELECT s.sector_number, s.flight_no, s.depart_stn, s.arrival_stn, s.off_block, s.on_block, s.flight_time, s.pax, s.kgs_fuel_uplift, s.fuel_used
         FROM scanned_sectors s ${joins.join(' ')} ${where} ORDER BY s.sector_number LIMIT ${limit}`,
        params
      )).rows
      if (!rows.length) return 'No sectors found.'
      const totalHrs = rows.reduce((s, r) => s + Number(r.flight_time || 0), 0)
      const totalPax = rows.reduce((s, r) => s + Number(r.pax || 0), 0)
      const header = `${rows.length} sectors | ${totalHrs.toFixed(1)} hrs | ${totalPax} PAX`
      return header + '\n' + rows.map(r =>
        `Sec ${r.sector_number} | ${r.flight_no || '—'} | ${r.depart_stn || '—'} → ${r.arrival_stn || '—'} | ${r.off_block || '—'}–${r.on_block || '—'} | ${Number(r.flight_time||0).toFixed(2)}h | ${r.pax||0} pax${r.kgs_fuel_uplift ? ' | uplift '+r.kgs_fuel_uplift+'kg' : ''}`
      ).join('\n')
    }

    if (name === 'get_billing_summary') {
      const groupBy = (input.group_by as string) || 'client'
      const validCols = ['client', 'aircraft_reg', 'captain', 'operation', 'month']
      const col = validCols.includes(groupBy) ? groupBy : 'client'
      const conditions: string[] = []
      const params: unknown[] = []
      let p = 1
      if (input.operation) { conditions.push(`operation = $${p++}`); params.push(input.operation) }
      if (input.from_date) { conditions.push(`departure_date::date >= $${p++}`); params.push(input.from_date) }
      if (input.to_date)   { conditions.push(`departure_date::date <= $${p++}`); params.push(input.to_date) }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
      const selectCol = col === 'month'
        ? `to_char(date_trunc('month', departure_date::date), 'Mon YYYY')`
        : `COALESCE(NULLIF(${col}, ''), 'Unknown')`
      const rows = (await query(
        `SELECT ${selectCol} AS label,
                COUNT(*)::int AS logs,
                COALESCE(SUM(total_flight_time), 0) AS hours,
                COALESCE(SUM(total_landings), 0)::int AS landings
         FROM scanned_flight_logs ${where}
         GROUP BY 1 ORDER BY hours DESC`,
        params
      )).rows
      if (!rows.length) return 'No data found.'
      const totalHrs = rows.reduce((s, r) => s + Number(r.hours), 0)
      return `By ${col} — ${totalHrs.toFixed(1)} hrs total\n` +
        rows.map(r => `${r.label}: ${Number(r.hours).toFixed(1)}h | ${r.logs} log${r.logs !== 1 ? 's' : ''} | ${r.landings} landings`).join('\n')
    }

    if (name === 'get_overview') {
      const today = new Date().toISOString().slice(0, 10)
      const thisMonth = today.slice(0, 7)
      const [totals, byOp, pending, thisMonthRow] = await Promise.all([
        query(`SELECT COUNT(*)::int AS logs, COALESCE(SUM(total_flight_time),0) AS hours, COALESCE(SUM(total_landings),0)::int AS landings FROM scanned_flight_logs`),
        query(`SELECT operation, COUNT(*)::int AS logs, COALESCE(SUM(total_flight_time),0) AS hours FROM scanned_flight_logs GROUP BY operation ORDER BY hours DESC`),
        query(`SELECT COUNT(*)::int AS cnt FROM scanned_flight_logs WHERE status = 'pending'`),
        query(`SELECT COUNT(*)::int AS logs, COALESCE(SUM(total_flight_time),0) AS hours FROM scanned_flight_logs WHERE departure_date::text LIKE $1`, [`${thisMonth}%`]),
      ])
      const t = totals.rows[0]
      const tm = thisMonthRow.rows[0]
      const opLines = byOp.rows.map(r => `${r.operation}: ${Number(r.hours).toFixed(1)}h (${r.logs} logs)`).join(', ')
      return `Today: ${today}
Total logs: ${t.logs} | Total hours: ${Number(t.hours).toFixed(1)} | Total landings: ${t.landings}
Pending review: ${pending.rows[0].cnt}
This month (${thisMonth}): ${tm.logs} logs, ${Number(tm.hours).toFixed(1)} hrs
By operation: ${opLines || 'no data'}`
    }

    if (name === 'get_engine_trend') {
      const aircraft = input.aircraft as string
      const aircraft2 = input.aircraft2 as string | undefined
      const conditions = ['l.aircraft_reg = $1']
      const params: unknown[] = [aircraft]
      let p = 2
      if (input.from_date) { conditions.push(`l.departure_date::date >= $${p++}`); params.push(input.from_date) }
      if (input.to_date)   { conditions.push(`l.departure_date::date <= $${p++}`); params.push(input.to_date) }

      const fetchTrend = async (reg: string, ps: unknown[]) => {
        const conds = ['l.aircraft_reg = $1', ...conditions.slice(1)]
        return (await query(
          `SELECT l.departure_date, l.flight_number, t.oat, t.pres_alt,
                  t.torq_l, t.torq_r, t.itt_l, t.itt_r,
                  t.fuel_flow_l, t.fuel_flow_r, t.oil_temp_l, t.oil_temp_r,
                  t.oil_px_l, t.oil_px_r, t.n1_l, t.n1_r
           FROM scanned_trend_data t
           JOIN scanned_flight_logs l ON l.id = t.log_id
           WHERE ${conds.join(' AND ')}
           ORDER BY l.departure_date ASC LIMIT 20`,
          ps
        )).rows
      }

      const rows1 = await fetchTrend(aircraft, params)
      const rows2 = aircraft2 ? await fetchTrend(aircraft2, [aircraft2, ...params.slice(1)]) : []

      if (!rows1.length && !rows2.length) return `No engine trend data found for ${aircraft}${aircraft2 ? ' or ' + aircraft2 : ''}.`

      const fmt = (r: Record<string, unknown>) =>
        `Date: ${String(r.departure_date).slice(0,10)} | OAT: ${r.oat}°C | ITT L/R: ${r.itt_l}/${r.itt_r}° | Torque L/R: ${r.torq_l}/${r.torq_r} | Oil Temp L/R: ${r.oil_temp_l}/${r.oil_temp_r}° | Oil Px L/R: ${r.oil_px_l}/${r.oil_px_r} | Fuel Flow L/R: ${r.fuel_flow_l}/${r.fuel_flow_r}`

      let out = `${aircraft} — ${rows1.length} readings:\n` + rows1.map(fmt).join('\n')
      if (rows2.length) out += `\n\n${aircraft2} — ${rows2.length} readings:\n` + rows2.map(fmt).join('\n')
      return out
    }

    return 'Unknown tool.'
  } catch (e) {
    return `Tool error: ${e}`
  }
}

const SYSTEM = `You are an operations assistant for Air Navigator Group. You help ops staff query flight log data.
Two operations: AU = Aerlink (Australia, VH- aircraft prefix), PNG = HeviLift (Papua New Guinea, P2- aircraft prefix).
Always use a tool to look up data before answering — never guess figures.
For vague or natural language queries, use the q parameter to search broadly.
For engine health questions, use get_engine_trend — it returns ITT, torque, oil temp/pressure, fuel flow, N1 per flight.
Answer conversationally and concisely. Plain text only, no markdown. Today's date is ${new Date().toISOString().slice(0, 10)}.`

export async function POST(req: NextRequest) {
  const apiKey = await getAnthropicKey()
  if (!apiKey) return NextResponse.json({ error: 'Anthropic API key not configured. Add it in Settings → Integrations.' }, { status: 500 })

  const client = new Anthropic({ apiKey })

  const { messages } = await req.json()
  if (!messages?.length) return NextResponse.json({ error: 'No messages' }, { status: 400 })

  const trimmed: Anthropic.MessageParam[] = messages.slice(-7)

  const MODEL = 'claude-haiku-4-5-20251001'
  // Pricing per token (USD)
  const PRICE_IN  = 0.80  / 1_000_000
  const PRICE_OUT = 4.00  / 1_000_000

  let reply = ''
  let totalInputTokens  = 0
  let totalOutputTokens = 0
  const started = Date.now()

  try {
    const loop = [...trimmed]
    while (true) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM,
        tools: TOOLS,
        messages: loop,
      })

      totalInputTokens  += response.usage.input_tokens
      totalOutputTokens += response.usage.output_tokens

      if (response.stop_reason === 'tool_use') {
        loop.push({ role: 'assistant', content: response.content })
        const results: Anthropic.ToolResultBlockParam[] = []
        for (const block of response.content) {
          if (block.type === 'tool_use') {
            const result = await runTool(block.name, block.input as ToolInput)
            results.push({ type: 'tool_result', tool_use_id: block.id, content: result })
          }
        }
        loop.push({ role: 'user', content: results })
      } else {
        reply = response.content.find(b => b.type === 'text')?.type === 'text'
          ? (response.content.find(b => b.type === 'text') as Anthropic.TextBlock).text
          : 'No response.'
        break
      }
    }
  } catch (e) {
    reply = `Error: ${e}`
  }

  // Log usage — fire and forget
  const elapsed = (Date.now() - started) / 1000
  const cost    = totalInputTokens * PRICE_IN + totalOutputTokens * PRICE_OUT
  query(
    `INSERT INTO api_usage (id, created_at, source_file, model, input_tokens, output_tokens, cost_usd, elapsed_seconds, call_type)
     VALUES (gen_random_uuid(), now(), 'chat', $1, $2, $3, $4, $5, 'chat')`,
    [MODEL, totalInputTokens, totalOutputTokens, cost, elapsed]
  ).catch(() => {})

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(reply))
      controller.close()
    },
  })

  return new Response(readable, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
