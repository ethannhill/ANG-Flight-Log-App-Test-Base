'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const COLORS = ['#ee7e2c','#3b82f6','#8b5cf6','#14b8a6','#f59e0b','#ec4899','#22c55e','#64748b']
const ORANGE = '#ee7e2c'

type KPIs      = { sectors: number; hours: string; pax: number; aircraft: number; earliest: string; latest: string }
type ClientRow = { client: string; hours: string; sectors: number; pax: number }
type YearRow   = { year: number; sectors: number; hours: string; pax: number }
type MonthRow  = { month: string; hours: string; pax: number }
type RouteRow  = { route: string; sectors: number; hours: string }
type FuelRow   = { aircraft_reg: string; fuel_kg: number; sectors: number }
type OnTime    = { total: number; on_time: number; delayed: number; avg_delay: string }
type Results   = { kpis: KPIs; byClient: ClientRow[]; byYear: YearRow[]; byMonth: MonthRow[]; topRoutes: RouteRow[]; byFuel: FuelRow[]; onTime: OnTime }

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function AnalyticsPage() {
  const [year, setYear]         = useState('')
  const [month, setMonth]       = useState('')
  const [operation, setOp]      = useState('')
  const [client, setClient]     = useState('')
  const [loading, setLoading]   = useState(false)
  const [results, setResults]   = useState<Results | null>(null)
  const [error, setError]       = useState('')

  async function runQuery() {
    setLoading(true); setError(''); setResults(null)
    try {
      const res = await fetch('/api/analytics/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: year || null, month: month || null, operation: operation || null, client: client || null }),
      })
      const d = await res.json()
      if (d.error) setError(d.error)
      else setResults(d)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const r = results

  return (
    <div className="min-h-screen bg-gray-50" style={{ borderTop: '4px solid #ee7e2c' }}>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center gap-4">
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← Home</Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-semibold text-gray-800">Analytics</span>
        <span className="text-xs text-gray-400 ml-1">· MotherDuck</span>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Filter panel */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-sm font-bold text-gray-700 mb-4">Select data before running</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Year</label>
              <select value={year} onChange={e => { setYear(e.target.value); setMonth('') }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ee7e2c]">
                <option value="">All years</option>
                {['2024','2025','2026'].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Month</label>
              <select value={month} onChange={e => setMonth(e.target.value)} disabled={!year}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ee7e2c] disabled:opacity-40">
                <option value="">All months</option>
                {MONTHS.map((m, i) => <option key={m} value={String(i+1)}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Operation</label>
              <select value={operation} onChange={e => setOp(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ee7e2c]">
                <option value="">All</option>
                <option value="AU">AU (Aerlink)</option>
                <option value="PNG">PNG (HeliLift)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Client</label>
              <input value={client} onChange={e => setClient(e.target.value)}
                placeholder="Search client…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ee7e2c]" />
            </div>
          </div>
          <button onClick={runQuery} disabled={loading}
            className="bg-[#ee7e2c] text-white text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-[#d4691a] disabled:opacity-50 transition">
            {loading ? 'Running…' : 'Run Analysis'}
          </button>
          {!r && !loading && (
            <p className="text-xs text-gray-400 mt-3">Select filters above then hit Run — data is queried from Azure Blob Storage via MotherDuck.</p>
          )}
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-6 py-4 text-sm">{error}</div>}

        {r && (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total Sectors', value: Number(r.kpis.sectors).toLocaleString() },
                { label: 'Flight Hours',  value: Number(r.kpis.hours).toLocaleString() },
                { label: 'Total PAX',     value: Number(r.kpis.pax).toLocaleString() },
                { label: 'Aircraft',      value: r.kpis.aircraft },
              ].map(k => (
                <div key={k.label} className="bg-white rounded-2xl border border-gray-200 px-5 py-4">
                  <p className="text-xs text-gray-400 mb-1">{k.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{k.value}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400">{r.kpis.earliest} → {r.kpis.latest} · Powered by MotherDuck + Azure Blob Storage</p>

            {/* Monthly trend */}
            {r.byMonth.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="text-sm font-bold text-gray-700 mb-5">Monthly Trend — Hours & PAX</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={r.byMonth} barSize={10}>
                    <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="hrs" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="pax" orientation="right" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Bar yAxisId="hrs" dataKey="hours" name="Hrs" fill={ORANGE} radius={[3,3,0,0]} />
                    <Bar yAxisId="pax" dataKey="pax" name="PAX" fill="#3b82f6" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* On-time */}
              {r.onTime && Number(r.onTime.total) > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                  <h2 className="text-sm font-bold text-gray-700 mb-5">On-Time Performance</h2>
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    {[
                      { label: 'On Time', value: Number(r.onTime.on_time).toLocaleString(), sub: `${Math.round((Number(r.onTime.on_time)/Number(r.onTime.total))*100)}%`, color: 'text-green-700' },
                      { label: 'Delayed', value: Number(r.onTime.delayed).toLocaleString(), sub: `${Math.round((Number(r.onTime.delayed)/Number(r.onTime.total))*100)}%`, color: 'text-red-600' },
                      { label: 'Avg Delay', value: `${r.onTime.avg_delay ?? 0} min`, sub: 'when delayed', color: 'text-gray-900' },
                      { label: 'Total', value: Number(r.onTime.total).toLocaleString(), sub: 'sectors', color: 'text-gray-900' },
                    ].map(k => (
                      <div key={k.label} className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-400 mb-1">{k.label}</p>
                        <p className={`text-lg font-bold ${k.color}`}>{k.value}</p>
                        <p className="text-xs text-gray-400">{k.sub}</p>
                      </div>
                    ))}
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div className="h-3 rounded-full bg-green-500"
                      style={{ width: `${Math.round((Number(r.onTime.on_time)/Number(r.onTime.total))*100)}%` }} />
                  </div>
                </div>
              )}

              {/* Top routes */}
              {r.topRoutes.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                  <h2 className="text-sm font-bold text-gray-700 mb-5">Top Routes</h2>
                  <div className="space-y-2">
                    {r.topRoutes.map((row, i) => {
                      const pct = (row.sectors / r.topRoutes[0].sectors) * 100
                      return (
                        <div key={row.route}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-mono font-medium text-gray-700">{row.route}</span>
                            <span className="text-gray-500">{row.sectors} · {row.hours}h</span>
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

            {/* Fuel by aircraft */}
            {r.byFuel.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="text-sm font-bold text-gray-700 mb-5">Fuel Burn by Aircraft (kg)</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={r.byFuel} layout="vertical" barSize={14}>
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `${(Number(v)/1000).toFixed(0)}t`} />
                    <YAxis type="category" dataKey="aircraft_reg" width={70} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v) => [`${Number(v).toLocaleString()} kg`, 'Fuel']} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="fuel_kg" radius={[0,4,4,0]}>
                      {r.byFuel.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Hours by client */}
            {r.byClient.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="text-sm font-bold text-gray-700 mb-5">Flight Hours by Client</h2>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={r.byClient} layout="vertical" barSize={14}>
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="client" width={130} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="hours" name="Hours" radius={[0,4,4,0]}>
                      {r.byClient.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Year on year */}
            {r.byYear.length > 1 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="text-sm font-bold text-gray-700 mb-5">Year on Year</h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400 border-b border-gray-100">
                      {['Year','Sectors','Hours','PAX','Growth'].map(h => (
                        <th key={h} className={`pb-2 ${h==='Year'?'text-left':'text-right'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {r.byYear.map((row, i) => {
                      const prev = r.byYear[i-1]
                      const growth = prev ? ((Number(row.hours)-Number(prev.hours))/Number(prev.hours))*100 : null
                      return (
                        <tr key={row.year} className="border-b border-gray-50 last:border-0">
                          <td className="py-2 font-bold">{row.year}</td>
                          <td className="py-2 text-right">{Number(row.sectors).toLocaleString()}</td>
                          <td className="py-2 text-right font-semibold">{Number(row.hours).toLocaleString()}</td>
                          <td className="py-2 text-right">{Number(row.pax).toLocaleString()}</td>
                          <td className="py-2 text-right">
                            {growth !== null ? (
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${growth>=0?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>
                                {growth>=0?'+':''}{growth.toFixed(1)}%
                              </span>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
