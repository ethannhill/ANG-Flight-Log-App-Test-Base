'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type ClientRow   = { client: string; operation: string; logs: number; hours: number; landings: number }
type AircraftRow = { aircraft_reg: string; operation: string; logs: number; hours: number; landings: number }
type MonthRow    = { month: string; month_sort: string; operation: string; logs: number; hours: number }
type Totals      = { total_logs: number; total_hours: number; total_landings: number; aircraft_count: number; client_count: number }

type BillingData = {
  byClient:   ClientRow[]
  byAircraft: AircraftRow[]
  byMonth:    MonthRow[]
  totals:     Totals
}

const OP_BADGE: Record<string, string> = {
  AU:  'bg-blue-100 text-blue-700',
  PNG: 'bg-purple-100 text-purple-700',
}

function n(v: unknown) { return Number(v) }

function thisMonthRange() {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().substring(0, 10)
  const to   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().substring(0, 10)
  return { from, to }
}

function toCSV(rows: ClientRow[]) {
  const header = 'Client,Operation,Logs,Hours,Landings'
  const lines = rows.map(r => `"${r.client}","${r.operation}",${r.logs},${n(r.hours).toFixed(2)},${r.landings}`)
  return [header, ...lines].join('\n')
}

function downloadCSV(data: string, filename: string) {
  const blob = new Blob([data], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function BillingPage() {
  const init = thisMonthRange()
  const [from, setFrom]   = useState(init.from)
  const [to,   setTo]     = useState(init.to)
  const [op,   setOp]     = useState('')
  const [data, setData]   = useState<BillingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab]     = useState<'client' | 'aircraft' | 'month'>('client')

  const fetch_ = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ from, to, ...(op && { op }) })
    const res  = await fetch(`/api/billing?${params}`)
    const json = await res.json()
    setData(json)
    setLoading(false)
  }, [from, to, op])

  useEffect(() => { fetch_() }, [fetch_])

  const t = data?.totals

  return (
    <div className="min-h-screen bg-gray-50" style={{ borderTop: '4px solid #ee7e2c' }}>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center gap-4">
        <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">←</Link>
        <div>
          <div className="text-xs font-bold tracking-widest uppercase text-gray-900">Air Navigator Group</div>
          <div className="text-xs text-gray-500">Billing Summary</div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {data && (
            <button
              onClick={() => downloadCSV(toCSV(data.byClient), `billing-${from}-${to}.csv`)}
              className="border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              ↓ Export CSV
            </button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ee7e2c]" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ee7e2c]" />
          </div>
          <select value={op} onChange={e => setOp(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ee7e2c] text-gray-700">
            <option value="">All Operations</option>
            <option value="AU">AU</option>
            <option value="PNG">PNG</option>
          </select>
          {/* Quick ranges */}
          {[
            { label: 'This month', ...thisMonthRange() },
            { label: 'Last month', from: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().substring(0, 10), to: new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().substring(0, 10) },
            { label: 'This year', from: `${new Date().getFullYear()}-01-01`, to: new Date().toISOString().substring(0, 10) },
          ].map(r => (
            <button key={r.label} onClick={() => { setFrom(r.from); setTo(r.to) }}
              className={`text-xs font-semibold px-3 py-2 rounded-lg border transition-colors ${
                from === r.from && to === r.to
                  ? 'bg-[#ee7e2c] border-[#ee7e2c] text-white'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              {r.label}
            </button>
          ))}
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { label: 'Total Hours', value: t ? n(t.total_hours).toFixed(1) : '—' },
            { label: 'Total Logs',  value: t?.total_logs ?? '—' },
            { label: 'Landings',    value: t?.total_landings ?? '—' },
            { label: 'Aircraft',    value: t?.aircraft_count ?? '—' },
            { label: 'Clients',     value: t?.client_count ?? '—' },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-2xl border border-gray-200 px-5 py-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{c.label}</p>
              <p className="text-2xl font-bold text-gray-900 tabular-nums mt-1">{c.value}</p>
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {(['client', 'aircraft', 'month'] as const).map(t_ => (
            <button key={t_} onClick={() => setTab(t_)}
              className={`text-xs font-semibold px-4 py-2 rounded-lg capitalize transition-colors ${
                tab === t_ ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              By {t_}
            </button>
          ))}
        </div>

        {/* Tables */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-sm text-gray-400">Loading…</div>
          ) : tab === 'client' ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Client', 'Operation', 'Logs', 'Flight Hours', 'Landings'].map(h => (
                    <th key={h} className="text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(data?.byClient ?? []).map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-800">{r.client}</td>
                    <td className="px-5 py-3">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${OP_BADGE[r.operation] || 'bg-gray-100 text-gray-500'}`}>
                        {r.operation || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3 tabular-nums text-gray-600">{r.logs}</td>
                    <td className="px-5 py-3 tabular-nums font-semibold text-gray-800">{n(r.hours).toFixed(2)}</td>
                    <td className="px-5 py-3 tabular-nums text-gray-600">{r.landings}</td>
                  </tr>
                ))}
                {/* Totals row */}
                {(data?.byClient ?? []).length > 1 && (() => {
                  const rows = data!.byClient
                  return (
                    <tr className="bg-gray-50 border-t border-gray-200 font-bold">
                      <td className="px-5 py-3 text-gray-700" colSpan={2}>Total</td>
                      <td className="px-5 py-3 tabular-nums text-gray-700">{rows.reduce((a, r) => a + r.logs, 0)}</td>
                      <td className="px-5 py-3 tabular-nums text-gray-900">{rows.reduce((a, r) => a + n(r.hours), 0).toFixed(2)}</td>
                      <td className="px-5 py-3 tabular-nums text-gray-700">{rows.reduce((a, r) => a + r.landings, 0)}</td>
                    </tr>
                  )
                })()}
              </tbody>
            </table>
          ) : tab === 'aircraft' ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Aircraft', 'Operation', 'Logs', 'Flight Hours', 'Landings'].map(h => (
                    <th key={h} className="text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(data?.byAircraft ?? []).map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-mono font-bold text-[#ee7e2c]">{r.aircraft_reg}</td>
                    <td className="px-5 py-3">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${OP_BADGE[r.operation] || 'bg-gray-100 text-gray-500'}`}>
                        {r.operation || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3 tabular-nums text-gray-600">{r.logs}</td>
                    <td className="px-5 py-3 tabular-nums font-semibold text-gray-800">{n(r.hours).toFixed(2)}</td>
                    <td className="px-5 py-3 tabular-nums text-gray-600">{r.landings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Month', 'Operation', 'Logs', 'Flight Hours'].map(h => (
                    <th key={h} className="text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(data?.byMonth ?? []).map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-700">{r.month}</td>
                    <td className="px-5 py-3">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${OP_BADGE[r.operation] || 'bg-gray-100 text-gray-500'}`}>
                        {r.operation || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3 tabular-nums text-gray-600">{r.logs}</td>
                    <td className="px-5 py-3 tabular-nums font-semibold text-gray-800">{n(r.hours).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}
