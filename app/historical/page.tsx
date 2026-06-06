'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, Legend } from 'recharts'

type Summary = { sectors: number; total_hours: string; total_pax: number; aircraft: number; earliest: string; latest: string }
type ClientRow = { client: string; sectors: number; hours: string; pax: number }
type AircraftRow = { aircraft_reg: string; operation: string; sectors: number; hours: string }
type RecentRow = { log_number: string; flight_number: string; aircraft_reg: string; operation: string; departure_date: string; captain: string; client: string; depart_stn: string; arrival_stn: string; off_block: string; take_off: string; land: string; on_block: string; flight_time: string; block_time: string; landings: number; fuel_burn_kg: number; pax: number; delay_minutes: number }

type Quality   = { checked: number; flt_ok: number; blk_ok: number; avg_flt_var: string; avg_blk_var: string; flt_0_5: number; flt_5_15: number; flt_15_30: number; flt_over_30: number }
type MonthRow  = { month: string; sectors: number; hours: string; pax: number; fuel_kg: string }
type RouteRow  = { route: string; sectors: number; hours: string }
type OnTime    = { total: number; on_time: number; delayed: number; avg_delay: string }
type YearRow   = { year: number; sectors: number; hours: string; pax: number; fuel_kg: string; aircraft: number }
type Data = { summary: Summary; byClient: ClientRow[]; byAircraft: AircraftRow[]; recent: RecentRow[]; quality: Quality; byMonth: MonthRow[]; topRoutes: RouteRow[]; onTime: OnTime; byYear: YearRow[] }

const ORANGE = '#ee7e2c'
const COLORS = ['#ee7e2c','#3b82f6','#8b5cf6','#14b8a6','#f59e0b','#ec4899','#22c55e','#64748b']

function fmtDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function HistoricalPage() {
  const [tab, setTab]           = useState<'view' | 'import'>('view')
  const [data, setData]         = useState<Data | null>(null)
  const [loading, setLoading]   = useState(true)
  const [opFilter, setOpFilter] = useState('')
  const [yearFilter, setYearFilter]   = useState('')
  const [monthFilter, setMonthFilter] = useState('')

  // Import state
  const [file, setFile]         = useState<File | null>(null)
  const [type, setType]         = useState<'aerlink' | 'skynet'>('aerlink')
  const [cutoff, setCutoff]     = useState('2026-05-31')
  const [preview, setPreview]   = useState<Record<string, unknown>[] | null>(null)
  const [previewTotal, setPreviewTotal] = useState(0)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ inserted: number; total: number } | null>(null)
  const [previewing, setPreviewing] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (opFilter) params.set('operation', opFilter)
    if (yearFilter && monthFilter) {
      const y = yearFilter, m = monthFilter.padStart(2, '0')
      const lastDay = new Date(Number(y), Number(m), 0).getDate()
      params.set('from', `${y}-${m}-01`)
      params.set('to', `${y}-${m}-${lastDay}`)
    } else if (yearFilter) {
      params.set('from', `${yearFilter}-01-01`)
      params.set('to', `${yearFilter}-12-31`)
    }
    try {
      const res = await fetch(`/api/historical/data?${params}`)
      const d = await res.json()
      setData(d)
    } catch (e) {
      console.error('Failed to load historical data', e)
    } finally {
      setLoading(false)
    }
  }, [opFilter, yearFilter, monthFilter])

  useEffect(() => { loadData() }, [loadData])

  async function handlePreview() {
    if (!file) return
    setPreviewing(true)
    setPreview(null)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('type', type)
    fd.append('cutoff', cutoff)
    fd.append('preview', 'true')
    const res = await fetch('/api/historical/import', { method: 'POST', body: fd })
    const d = await res.json()
    if (d.error) { alert(d.error); setPreviewing(false); return }
    setPreview(d.preview)
    setPreviewTotal(d.total)
    setPreviewing(false)
  }

  async function handleImport() {
    if (!file) return
    setImporting(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('type', type)
    fd.append('cutoff', cutoff)
    const res = await fetch('/api/historical/import', { method: 'POST', body: fd })
    const d = await res.json()
    setImportResult(d)
    setImporting(false)
    setPreview(null)
    loadData()
  }

  async function handleClear() {
    if (!confirm('Delete all historical data? This cannot be undone.')) return
    await fetch('/api/historical/data', { method: 'DELETE' })
    setImportResult(null)
    loadData()
  }

  return (
    <div className="min-h-screen bg-gray-50" style={{ borderTop: '4px solid #ee7e2c' }}>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← Home</Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-semibold text-gray-800">Historical Data</span>
        </div>
        <div className="flex items-center gap-3">
          <select value={yearFilter} onChange={e => { setYearFilter(e.target.value); setMonthFilter('') }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none">
            <option value="">All years</option>
            {['2026','2025','2024'].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
            disabled={!yearFilter}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none disabled:opacity-40">
            <option value="">All months</option>
            {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
              <option key={m} value={String(i+1)}>{m}</option>
            ))}
          </select>
          <select value={opFilter} onChange={e => setOpFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none">
            <option value="">All operations</option>
            <option value="AU">AU (Aerlink)</option>
            <option value="PNG">PNG (HeliLift)</option>
          </select>
          <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1">
            {(['view', 'import'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition ${
                  tab === t ? 'bg-[#ee7e2c] text-white' : 'text-gray-500 hover:text-gray-800'
                }`}>{t}</button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {/* VIEW TAB */}
        {tab === 'view' && (
          <>
            {loading && <div className="text-center py-20 text-gray-400">Loading…</div>}
            {data && (
              <>
                {/* KPI cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Sectors', value: data.summary.sectors?.toLocaleString() ?? '0' },
                    { label: 'Total Hours',   value: data.summary.total_hours ?? '0' },
                    { label: 'Total PAX',     value: data.summary.total_pax?.toLocaleString() ?? '0' },
                    { label: 'Aircraft',      value: data.summary.aircraft ?? '0' },
                  ].map(k => (
                    <div key={k.label} className="bg-white rounded-2xl border border-gray-200 px-5 py-4">
                      <p className="text-xs text-gray-400 mb-1">{k.label}</p>
                      <p className="text-2xl font-bold text-gray-900">{k.value}</p>
                    </div>
                  ))}
                </div>

                {data.summary.earliest && (
                  <p className="text-xs text-gray-400">
                    Data from {fmtDate(data.summary.earliest)} to {fmtDate(data.summary.latest)}
                  </p>
                )}

                {data.summary.sectors === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-6 py-6 text-sm text-center">
                    No historical data imported yet. Use the <button onClick={() => setTab('import')} className="font-semibold underline">Import tab</button> to load spreadsheet data.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* By client chart */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6">
                      <h2 className="text-sm font-bold text-gray-700 mb-4">Hours by Client</h2>
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={data.byClient} layout="vertical" barSize={14}>
                          <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                          <YAxis type="category" dataKey="client" width={110} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                          <Tooltip formatter={(v) => [`${v} hrs`, 'Hours']} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                          <Bar dataKey="hours" radius={[0, 4, 4, 0]}>
                            {data.byClient.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* By aircraft */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6">
                      <h2 className="text-sm font-bold text-gray-700 mb-4">Hours by Aircraft</h2>
                      <div className="space-y-2">
                        {data.byAircraft.map((a, i) => {
                          const max = Math.max(...data.byAircraft.map(x => Number(x.hours)))
                          const pct = max > 0 ? (Number(a.hours) / max) * 100 : 0
                          return (
                            <div key={a.aircraft_reg}>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="font-medium text-gray-700">{a.aircraft_reg}
                                  <span className={`ml-2 text-xs font-bold px-1.5 py-0.5 rounded-full ${a.operation === 'AU' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{a.operation}</span>
                                </span>
                                <span className="text-gray-500">{a.hours} hrs · {a.sectors} sectors</span>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-1.5">
                                <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Year on year growth */}
                {data.byYear.length > 1 && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-6">
                    <h2 className="text-sm font-bold text-gray-700 mb-5">Year on Year Growth</h2>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-gray-400 border-b border-gray-100">
                            <th className="text-left pb-2">Year</th>
                            <th className="text-right pb-2">Sectors</th>
                            <th className="text-right pb-2">Flight Hrs</th>
                            <th className="text-right pb-2">PAX</th>
                            <th className="text-right pb-2">Fuel (kg)</th>
                            <th className="text-right pb-2">Aircraft</th>
                            <th className="text-right pb-2">Hrs Growth</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.byYear.map((r, i) => {
                            const prev = data.byYear[i - 1]
                            const growth = prev ? ((Number(r.hours) - Number(prev.hours)) / Number(prev.hours)) * 100 : null
                            return (
                              <tr key={r.year} className="border-b border-gray-50 last:border-0">
                                <td className="py-2 font-bold text-gray-900">{r.year}</td>
                                <td className="py-2 text-right text-gray-700">{r.sectors.toLocaleString()}</td>
                                <td className="py-2 text-right font-semibold text-gray-900">{r.hours}</td>
                                <td className="py-2 text-right text-gray-700">{r.pax.toLocaleString()}</td>
                                <td className="py-2 text-right text-gray-700">{Number(r.fuel_kg).toLocaleString()}</td>
                                <td className="py-2 text-right text-gray-700">{r.aircraft}</td>
                                <td className="py-2 text-right">
                                  {growth !== null ? (
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${growth >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                      {growth >= 0 ? '+' : ''}{growth.toFixed(1)}%
                                    </span>
                                  ) : <span className="text-gray-300">—</span>}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Monthly trend */}
                {data.byMonth.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-6">
                    <h2 className="text-sm font-bold text-gray-700 mb-5">Monthly Trend — Hours & PAX</h2>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={data.byMonth.map(r => ({ ...r, label: r.month.slice(0,7) }))} barSize={16}>
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="hrs" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="pax" orientation="right" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar yAxisId="hrs" dataKey="hours" name="Flight Hrs" fill={ORANGE} radius={[4,4,0,0]} />
                        <Bar yAxisId="pax" dataKey="pax" name="PAX" fill="#3b82f6" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Fuel burn by month */}
                {data.byMonth.length > 0 && data.byMonth.some(r => Number(r.fuel_kg) > 0) && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-6">
                    <h2 className="text-sm font-bold text-gray-700 mb-5">Monthly Fuel Burn (kg)</h2>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={data.byMonth.map(r => ({ ...r, label: r.month.slice(0,7) }))} barSize={16}>
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}t`} />
                        <Tooltip formatter={(v) => [`${Number(v).toLocaleString()} kg`, 'Fuel']} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                        <Bar dataKey="fuel_kg" name="Fuel kg" fill="#14b8a6" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* On-time performance + Top routes */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {data.onTime && (
                    <div className="bg-white rounded-2xl border border-gray-200 p-6">
                      <h2 className="text-sm font-bold text-gray-700 mb-5">On-Time Performance</h2>
                      <div className="grid grid-cols-2 gap-4 mb-5">
                        {[
                          { label: 'On Time', value: data.onTime.on_time?.toLocaleString(), sub: `${Math.round((data.onTime.on_time / data.onTime.total) * 100)}%`, color: 'text-green-700' },
                          { label: 'Delayed', value: data.onTime.delayed?.toLocaleString(), sub: `${Math.round((data.onTime.delayed / data.onTime.total) * 100)}%`, color: 'text-red-600' },
                          { label: 'Avg Delay', value: `${data.onTime.avg_delay ?? '0'} min`, sub: 'when delayed', color: 'text-gray-900' },
                          { label: 'Total Sectors', value: data.onTime.total?.toLocaleString(), sub: 'analysed', color: 'text-gray-900' },
                        ].map(k => (
                          <div key={k.label} className="bg-gray-50 rounded-xl p-3">
                            <p className="text-xs text-gray-400 mb-1">{k.label}</p>
                            <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
                            <p className="text-xs text-gray-400">{k.sub}</p>
                          </div>
                        ))}
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-3">
                        <div className="h-3 rounded-full bg-green-500 transition-all"
                          style={{ width: `${Math.round((data.onTime.on_time / data.onTime.total) * 100)}%` }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>On time</span><span>Delayed</span>
                      </div>
                    </div>
                  )}

                  {data.topRoutes.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-200 p-6">
                      <h2 className="text-sm font-bold text-gray-700 mb-5">Top Routes</h2>
                      <div className="space-y-2">
                        {data.topRoutes.map((r, i) => {
                          const max = data.topRoutes[0].sectors
                          const pct = (r.sectors / max) * 100
                          return (
                            <div key={r.route}>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="font-mono font-medium text-gray-700">{r.route}</span>
                                <span className="text-gray-500">{r.sectors} sectors · {r.hours} hrs</span>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-1.5">
                                <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Data quality */}
                {data.quality && data.quality.checked > 0 && (() => {
                  const q = data.quality
                  const fltPct = Math.round((q.flt_ok / q.checked) * 100)
                  const blkPct = Math.round((q.blk_ok / q.checked) * 100)
                  const varBars = [
                    { label: '≤5 min', value: q.flt_0_5, color: '#22c55e' },
                    { label: '5–15 min', value: q.flt_5_15, color: '#f59e0b' },
                    { label: '15–30 min', value: q.flt_15_30, color: '#f97316' },
                    { label: '>30 min', value: q.flt_over_30, color: '#ef4444' },
                  ]
                  return (
                    <div className="bg-white rounded-2xl border border-gray-200 p-6">
                      <h2 className="text-sm font-bold text-gray-700 mb-1">Data Quality — Time Consistency</h2>
                      <p className="text-xs text-gray-400 mb-5">Compares recorded flight/block hours against times calculated from Off Blocks, T/O, Landing and On Blocks. Variance &gt;5 min suggests a spreadsheet entry error.</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                        <div className="bg-gray-50 rounded-xl p-4">
                          <p className="text-xs text-gray-400 mb-1">Records checked</p>
                          <p className="text-2xl font-bold text-gray-900">{q.checked.toLocaleString()}</p>
                        </div>
                        <div className={`rounded-xl p-4 ${fltPct >= 90 ? 'bg-green-50' : fltPct >= 70 ? 'bg-amber-50' : 'bg-red-50'}`}>
                          <p className="text-xs text-gray-400 mb-1">Flight time match</p>
                          <p className={`text-2xl font-bold ${fltPct >= 90 ? 'text-green-700' : fltPct >= 70 ? 'text-amber-700' : 'text-red-700'}`}>{fltPct}%</p>
                          <p className="text-xs text-gray-400">avg var {q.avg_flt_var} min</p>
                        </div>
                        <div className={`rounded-xl p-4 ${blkPct >= 90 ? 'bg-green-50' : blkPct >= 70 ? 'bg-amber-50' : 'bg-red-50'}`}>
                          <p className="text-xs text-gray-400 mb-1">Block time match</p>
                          <p className={`text-2xl font-bold ${blkPct >= 90 ? 'text-green-700' : blkPct >= 70 ? 'text-amber-700' : 'text-red-700'}`}>{blkPct}%</p>
                          <p className="text-xs text-gray-400">avg var {q.avg_blk_var} min</p>
                        </div>
                        <div className={`rounded-xl p-4 ${q.flt_over_30 === 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                          <p className="text-xs text-gray-400 mb-1">Errors &gt;30 min</p>
                          <p className={`text-2xl font-bold ${q.flt_over_30 === 0 ? 'text-green-700' : 'text-red-700'}`}>{q.flt_over_30}</p>
                          <p className="text-xs text-gray-400">records flagged</p>
                        </div>
                      </div>
                      <p className="text-xs font-semibold text-gray-500 mb-2">Flight time variance distribution</p>
                      <div className="space-y-2">
                        {varBars.map(b => {
                          const pct = q.checked > 0 ? (b.value / q.checked) * 100 : 0
                          return (
                            <div key={b.label}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-600">{b.label}</span>
                                <span className="text-gray-500">{b.value.toLocaleString()} ({pct.toFixed(1)}%)</span>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-2">
                                <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: b.color }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

                {/* Recent sectors table */}
                {data.recent.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-6">
                    <h2 className="text-sm font-bold text-gray-700 mb-4">Recent Sectors</h2>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-400 border-b border-gray-100">
                            {['Date','Log','Flight','Aircraft','Route','Off Blk','T/O','Land','On Blk','Captain','Client','Flt Hrs','Blk Hrs','Ldgs','Fuel kg','PAX','Delay min'].map(h => (
                              <th key={h} className="text-left pb-2 pr-3 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {data.recent.map((r, i) => (
                            <tr key={i} className="border-b border-gray-50 last:border-0">
                              <td className="py-1.5 pr-3 text-gray-500 whitespace-nowrap">{fmtDate(r.departure_date)}</td>
                              <td className="py-1.5 pr-3 font-mono text-gray-600">{r.log_number ?? '—'}</td>
                              <td className="py-1.5 pr-3">{r.flight_number ?? '—'}</td>
                              <td className="py-1.5 pr-3 whitespace-nowrap">
                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full mr-1 ${r.operation === 'AU' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{r.operation}</span>
                                {r.aircraft_reg}
                              </td>
                              <td className="py-1.5 pr-3 font-mono whitespace-nowrap">{r.depart_stn}→{r.arrival_stn}</td>
                              <td className="py-1.5 pr-3 font-mono">{r.off_block ?? '—'}</td>
                              <td className="py-1.5 pr-3 font-mono">{r.take_off ?? '—'}</td>
                              <td className="py-1.5 pr-3 font-mono">{r.land ?? '—'}</td>
                              <td className="py-1.5 pr-3 font-mono">{r.on_block ?? '—'}</td>
                              <td className="py-1.5 pr-3 text-gray-600 whitespace-nowrap">{r.captain ?? '—'}</td>
                              <td className="py-1.5 pr-3 text-gray-600 max-w-[100px] truncate">{r.client ?? '—'}</td>
                              <td className="py-1.5 pr-3">{r.flight_time ? Number(r.flight_time).toFixed(2) : '—'}</td>
                              <td className="py-1.5 pr-3">{r.block_time ? Number(r.block_time).toFixed(2) : '—'}</td>
                              <td className="py-1.5 pr-3">{r.landings ?? '—'}</td>
                              <td className="py-1.5 pr-3">{r.fuel_burn_kg ?? '—'}</td>
                              <td className="py-1.5 pr-3">{r.pax ?? '—'}</td>
                              <td className="py-1.5">{r.delay_minutes ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* IMPORT TAB */}
        {tab === 'import' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
              <h2 className="text-sm font-bold text-gray-700">Import Spreadsheet</h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Spreadsheet type</label>
                  <select value={type} onChange={e => { setType(e.target.value as 'aerlink' | 'skynet'); setPreview(null); setImportResult(null) }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ee7e2c]">
                    <option value="aerlink">Aerlink AU — OTP Utilisation Spreadsheet</option>
                    <option value="skynet">HeliLift PNG — SKYNET Data Export</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Import up to (cut-off date)</label>
                  <input type="date" value={cutoff} onChange={e => { setCutoff(e.target.value); setPreview(null) }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ee7e2c]" />
                  <p className="text-xs text-gray-400 mt-1">Rows after this date are excluded — live system takes over from June 2026</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">File (.xlsx)</label>
                  <input type="file" accept=".xlsx,.xls"
                    onChange={e => { setFile(e.target.files?.[0] ?? null); setPreview(null); setImportResult(null) }}
                    className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#ee7e2c] file:text-white file:text-xs file:font-semibold hover:file:bg-[#d4691a]" />
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={handlePreview} disabled={!file || previewing || importing}
                  className="text-sm font-semibold border border-gray-300 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition">
                  {previewing ? 'Reading file…' : 'Preview first'}
                </button>
                <button onClick={handleImport} disabled={!file || importing || previewing}
                  className="text-sm font-semibold bg-[#ee7e2c] text-white px-4 py-2 rounded-lg hover:bg-[#d4691a] disabled:opacity-40 transition">
                  {importing ? 'Importing… (please wait)' : 'Import now'}
                </button>
                <button onClick={handleClear} className="text-sm text-gray-400 hover:text-red-500 ml-auto transition">
                  Clear all historical data
                </button>
              </div>

              {importResult && (
                <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl px-4 py-3 text-sm">
                  ✓ Imported {importResult.inserted.toLocaleString()} of {importResult.total.toLocaleString()} rows successfully.
                </div>
              )}
            </div>

            {/* Preview table */}
            {preview && preview.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="text-sm font-bold text-gray-700 mb-1">Preview — first 10 rows of {previewTotal.toLocaleString()}</h2>
                <p className="text-xs text-gray-400 mb-4">Review before importing</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-400 border-b border-gray-100">
                        {['Log','Flight','Aircraft','Op','Date','Captain','Client','From','To','Hrs','PAX','Fuel kg'].map(h => (
                          <th key={h} className="text-left pb-2 pr-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((r, i) => (
                        <tr key={i} className="border-b border-gray-50 last:border-0">
                          <td className="py-1.5 pr-3 font-mono">{String(r.log_number ?? '—')}</td>
                          <td className="py-1.5 pr-3">{String(r.flight_number ?? '—')}</td>
                          <td className="py-1.5 pr-3">{String(r.aircraft_reg ?? '—')}</td>
                          <td className="py-1.5 pr-3">
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${r.operation === 'AU' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{String(r.operation)}</span>
                          </td>
                          <td className="py-1.5 pr-3 text-gray-500">{String(r.departure_date ?? '—')}</td>
                          <td className="py-1.5 pr-3">{String(r.captain ?? '—')}</td>
                          <td className="py-1.5 pr-3 max-w-[100px] truncate">{String(r.client ?? '—')}</td>
                          <td className="py-1.5 pr-3 font-mono">{String(r.depart_stn ?? '—')}</td>
                          <td className="py-1.5 pr-3 font-mono">{String(r.arrival_stn ?? '—')}</td>
                          <td className="py-1.5 pr-3">{r.flight_time ? Number(r.flight_time).toFixed(2) : '—'}</td>
                          <td className="py-1.5 pr-3">{r.pax != null ? String(r.pax) : '—'}</td>
                          <td className="py-1.5">{r.fuel_burn_kg != null ? String(r.fuel_burn_kg) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
