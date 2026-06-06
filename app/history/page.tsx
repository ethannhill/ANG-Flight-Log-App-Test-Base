'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import Link from 'next/link'

type Log = {
  id: string
  flight_number: string
  aircraft_reg: string
  operation: string
  departure_date: string
  captain: string
  first_officer: string
  observer: string
  flight_type: string
  client: string
  total_flight_time: number
  total_landings: number
  created_at: string
  remarks: string
  status: string
  source_file: string
}

type Sector = {
  id: string
  sector_number: number
  flight_no: string
  depart_stn: string
  arrival_stn: string
  off_block: string
  take_off: string
  land: string
  on_block: string
  flight_time: number
  block_time: string
  starts: number
  lands: number
  pax: number
  fuel_docket: string
  kgs_fuel_uplift: number
  fuel_depart: number
  fuel_used: number
  fuel_arrival: number
  iata_code: string
  delay_minutes: number
}

type Detail = {
  log: Log & { image_b64?: string; image_url?: string }
  sectors: Sector[]
}

const STATUS_STYLES: Record<string, string> = {
  pending:  'bg-amber-100 text-amber-700',
  reviewed: 'bg-blue-100 text-blue-700', // legacy
  approved: 'bg-green-100 text-green-700',
}

function fmt(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function LogReviewPage() {
  const [logs, setLogs] = useState<Log[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)
  const [trendData, setTrendData] = useState<Record<string, unknown> | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)

  const PAGE_SIZE = 50

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(offset),
      ...(search && { search }),
      ...(statusFilter && { status: statusFilter }),
    })
    const res = await fetch(`/api/logs?${params}`)
    const data = await res.json()
    setLogs(data.logs || [])
    setTotal(data.total || 0)
    setLoading(false)
  }, [search, statusFilter, offset])

  useEffect(() => {
    const t = setTimeout(fetchLogs, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [fetchLogs, search])

  async function toggleExpand(id: string) {
    if (expanded === id) {
      setExpanded(null)
      setDetail(null)
      setTrendData(null)
      return
    }
    setExpanded(id)
    setDetail(null)
    setTrendData(null)
    setDetailLoading(true)
    const [logRes, trendRes] = await Promise.all([
      fetch(`/api/logs/${id}`),
      fetch(`/api/trend?log_id=${id}`),
    ])
    const logData = await logRes.json()
    setDetail(logRes.ok && logData.log ? logData : null)
    if (trendRes.ok) {
      const td = await trendRes.json()
      setTrendData(td || null)
    }
    setDetailLoading(false)
  }

  async function deleteLog(id: string) {
    if (!confirm('Delete this log and its blob image permanently?')) return
    setDeleting(id)
    await fetch(`/api/logs/${id}`, { method: 'DELETE' })
    setDeleting(null)
    setExpanded(null)
    setDetail(null)
    fetchLogs()
  }

  async function setStatus(id: string, status: string) {
    setUpdating(id)
    await fetch(`/api/logs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setLogs(prev => prev.map(l => l.id === id ? { ...l, status } : l))
    if (detail && detail.log.id === id) {
      setDetail(prev => prev ? { ...prev, log: { ...prev.log, status } } : prev)
    }
    setUpdating(null)
  }

  return (
    <div className="min-h-screen bg-gray-50" style={{ borderTop: '4px solid #ee7e2c' }}>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center gap-4">
        <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">←</Link>
        <div>
          <div className="text-xs font-bold tracking-widest uppercase text-gray-900">Air Navigator Group</div>
          <div className="text-xs text-gray-500">Log Review</div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-4">

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="search"
            placeholder="Search aircraft, pilot, flight no, client…"
            value={search}
            onChange={e => { setSearch(e.target.value); setOffset(0) }}
            className="border border-gray-200 rounded-lg px-4 py-2 text-sm w-72 focus:outline-none focus:border-[#ee7e2c]"
          />
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setOffset(0) }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ee7e2c] text-gray-700"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
          </select>
          <span className="text-xs text-gray-400 ml-auto">{total} log{total !== 1 ? 's' : ''}</span>
          <Link href="/upload"
            className="bg-[#ee7e2c] hover:bg-[#d4691a] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            + Upload Log
          </Link>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="px-6 py-16 text-center text-sm text-gray-400">Loading…</div>
          ) : logs.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-gray-400">
              No logs found.{' '}
              <Link href="/upload" className="text-[#ee7e2c] font-semibold hover:underline">Upload one →</Link>
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Date','Aircraft','Flight No','Captain','F/O','Client','Op','Hrs','Ldgs','Status',''].map(h => (
                    <th key={h} className="text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map(log => (
                  <Fragment key={log.id}>
                    <tr
                      onClick={() => toggleExpand(log.id)}
                      className={`cursor-pointer transition-colors ${expanded === log.id ? 'bg-orange-50' : 'hover:bg-gray-50'}`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700 font-medium">{fmt(log.departure_date)}</td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-[#ee7e2c] font-semibold">{log.aircraft_reg || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">{log.flight_number || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">{log.captain || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-500">{log.first_officer || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-500">{log.client || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          log.operation === 'AU' ? 'bg-blue-100 text-blue-700' :
                          log.operation === 'PNG' ? 'bg-purple-100 text-purple-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>{log.operation || '—'}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700 tabular-nums">{log.total_flight_time != null ? Number(log.total_flight_time).toFixed(1) : '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700 tabular-nums">{log.total_landings ?? '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_STYLES[log.status] || 'bg-gray-100 text-gray-500'}`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-xs">{expanded === log.id ? '▲' : '▼'}</td>
                    </tr>

                    {expanded === log.id && (
                      <tr>
                        <td colSpan={11} className="bg-orange-50 border-t border-orange-100 px-6 py-5">
                          {detailLoading ? (
                            <p className="text-sm text-gray-400">Loading…</p>
                          ) : detail ? (
                            <div className="space-y-4">

                              {/* Top row: image + info */}
                              <div className="grid grid-cols-[280px_1fr] gap-6">
                                {/* Thumbnail */}
                                <div className="relative group">
                                  {detail?.log?.image_url ? (
                                    <>
                                      {detail.log.source_file?.toLowerCase().endsWith('.pdf') ? (
                                        <iframe
                                          src={detail.log.image_url}
                                          className="rounded-xl border border-gray-200 w-full"
                                          style={{ height: 260 }}
                                        />
                                      ) : (
                                        <img
                                          src={detail.log.image_url}
                                          alt="Flight log scan"
                                          className="rounded-xl border border-gray-200 object-contain w-full max-h-[260px] cursor-pointer"
                                          onClick={() => window.open(detail.log.image_url!, '_blank')}
                                        />
                                      )}
                                      <a
                                        href={detail.log.image_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                      >
                                        Full size ↗
                                      </a>
                                    </>
                                  ) : detail?.log?.image_b64 ? (
                                    detail.log.source_file?.toLowerCase().endsWith('.pdf') ? (
                                      <iframe
                                        src={`data:application/pdf;base64,${detail.log.image_b64}`}
                                        className="rounded-xl border border-gray-200 w-full"
                                        style={{ height: 260 }}
                                      />
                                    ) : (
                                      <img
                                        src={`data:image/jpeg;base64,${detail.log.image_b64}`}
                                        alt="Flight log scan"
                                        className="rounded-xl border border-gray-200 object-contain w-full max-h-[260px]"
                                      />
                                    )
                                  ) : (
                                    <div className="rounded-xl border border-gray-200 bg-white h-32 flex items-center justify-center text-xs text-gray-400">
                                      No image
                                    </div>
                                  )}
                                </div>

                                {/* Info grid */}
                                <div className="grid grid-cols-3 gap-x-6 gap-y-2 text-sm">
                                  {[
                                    ['Flight Type', detail.log.flight_type],
                                    ['Observer', detail.log.observer],
                                    ['Uploaded', fmt(detail.log.created_at)],
                                    ['Total Hrs', detail.log.total_flight_time != null ? Number(detail.log.total_flight_time).toFixed(2) : '—'],
                                    ['Total Ldgs', String(detail.log.total_landings ?? '—')],
                                    ['Operation', detail.log.operation],
                                  ].map(([label, value]) => (
                                    <div key={label}>
                                      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</div>
                                      <div className="text-gray-700 mt-0.5">{value || '—'}</div>
                                    </div>
                                  ))}
                                  {detail.log.remarks && (
                                    <div className="col-span-3">
                                      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Remarks</div>
                                      <div className="text-gray-700 mt-0.5">{detail.log.remarks}</div>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Sectors */}
                              {detail.sectors.length > 0 && (
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2 pl-1 border-l-2 border-[#ee7e2c]">
                                    Sectors ({detail.sectors.length})
                                  </p>
                                  <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                                    <table className="w-full text-xs border-collapse">
                                      <thead>
                                        <tr className="bg-gray-50 border-b border-gray-100">
                                          {['#','Flt No','From','To','Off Blk','T/O','Land','On Blk','Flt Hrs','Blk','Starts','Ldgs','PAX','Uplift kg','Fuel Dep','Fuel Used','Fuel Arr','Fuel Dkt','IATA','Delay'].map(h => (
                                            <th key={h} className="text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 px-2 py-2 whitespace-nowrap">{h}</th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-50">
                                        {detail.sectors.map(s => (
                                          <tr key={s.id} className="hover:bg-gray-50">
                                            <td className="px-2 py-1.5 text-gray-400">{s.sector_number}</td>
                                            <td className="px-2 py-1.5 font-medium text-gray-700">{s.flight_no || '—'}</td>
                                            <td className="px-2 py-1.5 text-gray-700">{s.depart_stn || '—'}</td>
                                            <td className="px-2 py-1.5 text-gray-700">{s.arrival_stn || '—'}</td>
                                            <td className="px-2 py-1.5 text-gray-500">{s.off_block || '—'}</td>
                                            <td className="px-2 py-1.5 text-gray-500">{s.take_off || '—'}</td>
                                            <td className="px-2 py-1.5 text-gray-500">{s.land || '—'}</td>
                                            <td className="px-2 py-1.5 text-gray-500">{s.on_block || '—'}</td>
                                            <td className="px-2 py-1.5 tabular-nums text-gray-700">{s.flight_time != null ? Number(s.flight_time).toFixed(2) : '—'}</td>
                                            <td className="px-2 py-1.5 text-gray-500">{s.block_time || '—'}</td>
                                            <td className="px-2 py-1.5 tabular-nums text-gray-700">{s.starts ?? '—'}</td>
                                            <td className="px-2 py-1.5 tabular-nums text-gray-700">{s.lands ?? '—'}</td>
                                            <td className="px-2 py-1.5 tabular-nums text-gray-700">{s.pax ?? '—'}</td>
                                            <td className="px-2 py-1.5 tabular-nums text-gray-500">{s.kgs_fuel_uplift ?? '—'}</td>
                                            <td className="px-2 py-1.5 tabular-nums text-gray-500">{s.fuel_depart ?? '—'}</td>
                                            <td className="px-2 py-1.5 tabular-nums text-gray-500">{s.fuel_used ?? '—'}</td>
                                            <td className="px-2 py-1.5 tabular-nums text-gray-500">{s.fuel_arrival ?? '—'}</td>
                                            <td className="px-2 py-1.5 text-gray-500">{s.fuel_docket || '—'}</td>
                                            <td className="px-2 py-1.5 text-gray-500">{s.iata_code || '—'}</td>
                                            <td className="px-2 py-1.5 tabular-nums text-gray-500">{s.delay_minutes ?? '—'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}

                              {/* Trend Data */}
                              {trendData && (
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2 pl-1 border-l-2 border-[#ee7e2c]">
                                    Engine Trend Data
                                  </p>
                                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                                    <div className="grid grid-cols-4 gap-x-6 gap-y-2 text-xs">
                                      {[
                                        ['OAT', trendData.oat, '°C'],
                                        ['Pres Alt', trendData.pres_alt, 'ft'],
                                        ['IAS', trendData.ias, 'kt'],
                                        ['Bleed Air', trendData.bleed_air, ''],
                                        ['Torq L', trendData.torq_l, ''],
                                        ['Torq R', trendData.torq_r, ''],
                                        ['Prop RPM L', trendData.prop_rpm_l, ''],
                                        ['Prop RPM R', trendData.prop_rpm_r, ''],
                                        ['N1 L', trendData.n1_l, ''],
                                        ['N1 R', trendData.n1_r, ''],
                                        ['NL L', trendData.nl_l, ''],
                                        ['NL R', trendData.nl_r, ''],
                                        ['ITT L', trendData.itt_l, '°'],
                                        ['ITT R', trendData.itt_r, '°'],
                                        ['Fuel Flow L', trendData.fuel_flow_l, ''],
                                        ['Fuel Flow R', trendData.fuel_flow_r, ''],
                                        ['Oil Temp L', trendData.oil_temp_l, '°'],
                                        ['Oil Temp R', trendData.oil_temp_r, '°'],
                                        ['Oil Px L', trendData.oil_px_l, ''],
                                        ['Oil Px R', trendData.oil_px_r, ''],
                                        ['Elect Load L', trendData.elect_load_l, ''],
                                        ['Elect Load R', trendData.elect_load_r, ''],
                                        ['Cabin Dif', trendData.cabin_dif, ''],
                                        ['Start ITT L', trendData.start_itt_l, ''],
                                        ['Start ITT R', trendData.start_itt_r, ''],
                                        ['Grd Pwr', trendData.grd_pwr, ''],
                                        ['Anti-Ice', trendData.anti_ice, ''],
                                        ['Comp Wash', trendData.compressor_wash != null ? (trendData.compressor_wash ? 'Yes' : 'No') : null, ''],
                                        ['Det Wash', trendData.detergent_wash != null ? (trendData.detergent_wash ? 'Yes' : 'No') : null, ''],
                                        ['Fuel Litres', trendData.fuel_litres_purchased, 'L'],
                                      ].map(([label, value, unit]) => value != null ? (
                                        <div key={label as string}>
                                          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label as string}</div>
                                          <div className="text-gray-700 tabular-nums mt-0.5">{String(value)}{unit as string}</div>
                                        </div>
                                      ) : null)}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Status actions */}
                              <div className="flex items-center gap-3 pt-1">
                                <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Mark as:</span>
                                {(['pending', 'approved'] as const).map(s => (
                                  <button
                                    key={s}
                                    disabled={detail.log.status === s || updating === log.id}
                                    onClick={() => setStatus(log.id, s)}
                                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-default ${
                                      detail.log.status === s
                                        ? `${STATUS_STYLES[s]} cursor-default`
                                        : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'
                                    }`}
                                  >
                                    {s.charAt(0).toUpperCase() + s.slice(1)}
                                  </button>
                                ))}
                                <button
                                  onClick={() => deleteLog(log.id)}
                                  disabled={deleting === log.id}
                                  className="ml-auto text-xs text-red-400 hover:text-red-600 font-semibold disabled:opacity-40 transition-colors"
                                >
                                  {deleting === log.id ? 'Deleting…' : 'Delete log'}
                                </button>
                              </div>

                            </div>
                          ) : null}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between text-sm">
            <button
              disabled={offset === 0}
              onClick={() => setOffset(o => Math.max(0, o - PAGE_SIZE))}
              className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-default"
            >
              ← Previous
            </button>
            <span className="text-gray-400 text-xs">
              {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
            </span>
            <button
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset(o => o + PAGE_SIZE)}
              className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-default"
            >
              Next →
            </button>
          </div>
        )}

      </main>
    </div>
  )
}
