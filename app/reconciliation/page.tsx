'use client'

import { useState } from 'react'
import Link from 'next/link'

type ScannedLog = {
  id: string
  flight_number: string
  aircraft_reg: string
  departure_date: string
  captain: string
  total_flight_time: number
  total_landings: number
  status: string
  operation: string
  client: string
}

type SkynetFlight = {
  id: string
  flight_number: string
  flight_reference: string
  aircraft_registration: string
  departure_date: string
  flight_time_hours: number
  billed_flight_time: number
  landings: number
  captain: string
  client: string
  status: string
}

type MatchedRow = {
  scanned: ScannedLog
  skynet: SkynetFlight
  hoursVariance: number
  landingsVariance: number
  hasDiscrepancy: boolean
  skynetGaps: string[]
}

type ReconResult = {
  from: string
  to: string
  skynetAvailable: boolean
  skynetError: string | null
  summary: {
    matched: number
    scannedOnly: number
    skynetOnly: number
    discrepancies: number
  }
  matched: MatchedRow[]
  scannedOnly: ScannedLog[]
  skynetOnly: SkynetFlight[]
}

function fmt(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
}

function defaultRange() {
  const to   = new Date().toISOString().substring(0, 10)
  const from = new Date(Date.now() - 30 * 86400000).toISOString().substring(0, 10)
  return { from, to }
}

const r = defaultRange()

export default function ReconciliationPage() {
  const [from, setFrom] = useState(r.from)
  const [to,   setTo]   = useState(r.to)
  const [result, setResult] = useState<ReconResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'matched' | 'scanned' | 'skynet'>('matched')

  // Track approvals this session so UI updates immediately without re-fetch
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set())
  const [approving, setApproving] = useState<string | null>(null)

  async function run() {
    setLoading(true)
    setResult(null)
    setApprovedIds(new Set())
    const params = new URLSearchParams({ from, to })
    const res  = await fetch(`/api/reconciliation?${params}`)
    const json = await res.json()
    setResult(json)
    const pendingScanned = (json.scannedOnly as ScannedLog[])?.filter(s => s.status === 'pending').length ?? 0
    if (pendingScanned > 0) setTab('scanned')
    else if ((json.summary?.discrepancies ?? 0) > 0) setTab('matched')
    else setTab('matched')
    setLoading(false)
  }

  async function approve(logId: string) {
    setApproving(logId)
    await fetch(`/api/logs/${logId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    })
    setApprovedIds(prev => new Set([...prev, logId]))
    setApproving(null)
  }

  async function approveAll(logIds: string[]) {
    setApproving('bulk')
    await Promise.all(logIds.map(id =>
      fetch(`/api/logs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      })
    ))
    setApprovedIds(prev => new Set([...prev, ...logIds]))
    setApproving(null)
  }

  function isApproved(log: ScannedLog) {
    return log.status === 'approved' || approvedIds.has(log.id)
  }

  const s = result?.summary

  // Clean matched = no discrepancy and not yet approved
  const cleanPendingIds = result?.matched
    .filter(m => !m.hasDiscrepancy && !isApproved(m.scanned))
    .map(m => m.scanned.id) ?? []

  // Count pending in this session's view
  const pendingCount = result
    ? result.matched.filter(m => !isApproved(m.scanned)).length
        + result.scannedOnly.filter(s => !isApproved(s)).length
    : 0

  const approvedCount = result
    ? result.matched.filter(m => isApproved(m.scanned)).length
        + result.scannedOnly.filter(s => isApproved(s)).length
    : 0

  return (
    <div className="min-h-screen bg-gray-50" style={{ borderTop: '4px solid #ee7e2c' }}>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center gap-4">
        <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">←</Link>
        <div>
          <div className="text-xs font-bold tracking-widest uppercase text-gray-900">Air Navigator Group</div>
          <div className="text-xs text-gray-500">SKYNET Reconciliation</div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* Controls */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 flex items-end gap-4 flex-wrap">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1.5">From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ee7e2c]" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1.5">To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ee7e2c]" />
          </div>
          <button onClick={run} disabled={loading}
            className="bg-[#ee7e2c] hover:bg-[#d4691a] disabled:opacity-50 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors">
            {loading ? 'Running…' : '⇌ Run Reconciliation'}
          </button>
        </div>

        {/* SKYNET status banner */}
        {result && !result.skynetAvailable && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-6 py-4 flex items-start gap-3">
            <span className="text-amber-500 text-lg leading-none mt-0.5">⚠</span>
            <div>
              <p className="text-sm font-semibold text-amber-800">SKYNET not connected — manual approval mode</p>
              <p className="text-xs text-amber-700 mt-0.5">
                {result.skynetError
                  ? `Error: ${result.skynetError}`
                  : 'Add SKYNET_API_URL and SKYNET_API_KEY in Settings to enable live comparison.'}
              </p>
              <p className="text-xs text-amber-600 mt-1">
                You can still approve logs manually below. Approved logs are marked as reconciled.
              </p>
            </div>
          </div>
        )}

        {/* Summary cards */}
        {result && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {[
              { label: 'Matched', value: s?.matched ?? 0, color: 'text-green-700', bg: 'bg-green-50 border-green-100' },
              { label: 'Scanned Only', value: s?.scannedOnly ?? 0, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-100' },
              { label: 'SKYNET Only', value: s?.skynetOnly ?? 0, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-100' },
              { label: 'Discrepancies', value: s?.discrepancies ?? 0, color: 'text-red-700', bg: 'bg-red-50 border-red-100' },
              { label: 'Approved', value: approvedCount, color: 'text-green-700', bg: 'bg-green-100 border-green-200' },
            ].map(c => (
              <div key={c.label} className={`rounded-2xl border px-5 py-4 ${c.bg}`}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{c.label}</p>
                <p className={`text-3xl font-bold tabular-nums mt-1 ${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tab bar + results */}
        {result && (
          <>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
                {([
                  { key: 'matched', label: `Matched (${s?.matched ?? 0})` },
                  { key: 'scanned', label: `Scanned Only (${s?.scannedOnly ?? 0})` },
                  { key: 'skynet',  label: `SKYNET Only (${s?.skynetOnly ?? 0})` },
                ] as const).map(t_ => (
                  <button key={t_.key} onClick={() => setTab(t_.key)}
                    className={`text-xs font-semibold px-4 py-2 rounded-lg transition-colors ${
                      tab === t_.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}>
                    {t_.label}
                  </button>
                ))}
              </div>

              {/* Bulk approve button */}
              {tab === 'matched' && cleanPendingIds.length > 0 && (
                <button
                  onClick={() => approveAll(cleanPendingIds)}
                  disabled={approving === 'bulk'}
                  className="text-xs font-semibold bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors">
                  {approving === 'bulk'
                    ? 'Approving…'
                    : `Approve All Clean Matches (${cleanPendingIds.length})`}
                </button>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">

              {/* Matched */}
              {tab === 'matched' && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {['Date', 'Aircraft', 'DFR / Flight No', 'Client', 'Scanned Hrs', 'SKYNET Hrs', 'Variance', 'Pax', 'Status', ''].map(h => (
                        <th key={h} className="text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 px-4 py-3 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {result.matched.length === 0 ? (
                      <tr><td colSpan={10} className="px-6 py-10 text-center text-sm text-gray-400">No matched flights</td></tr>
                    ) : result.matched.map((m, i) => {
                      const done = isApproved(m.scanned)
                      return (
                        <tr key={i} className={
                          done ? 'bg-green-50 opacity-70' :
                          m.hasDiscrepancy ? 'bg-red-50' : 'hover:bg-gray-50'
                        }>
                          <td className="px-4 py-2.5 whitespace-nowrap text-gray-700">{fmt(m.scanned.departure_date)}</td>
                          <td className="px-4 py-2.5 font-mono font-bold text-[#ee7e2c]">{m.scanned.aircraft_reg}</td>
                          <td className="px-4 py-2.5 text-gray-700">
                            <span className="font-semibold">{m.scanned.flight_number}</span>
                            {m.skynet.flight_reference && m.skynet.flight_reference !== m.scanned.flight_number && (
                              <span className="ml-1 text-gray-400 text-xs">/ {m.skynet.flight_reference}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-gray-600 text-xs">{m.scanned.client || m.skynet.client || '—'}</td>
                          <td className="px-4 py-2.5 tabular-nums text-gray-700">{Number(m.scanned.total_flight_time || 0).toFixed(2)}</td>
                          <td className="px-4 py-2.5 tabular-nums text-gray-700">{Number(m.skynet.billed_flight_time || m.skynet.flight_time_hours || 0).toFixed(2)}</td>
                          <td className="px-4 py-2.5 tabular-nums">
                            {m.hasDiscrepancy
                              ? <span className="text-red-600 font-bold">±{m.hoursVariance.toFixed(2)}</span>
                              : <span className="text-green-600 font-semibold">✓</span>
                            }
                          </td>
                          <td className="px-4 py-2.5 tabular-nums text-gray-600">{m.scanned.total_landings ?? '—'}</td>
                          <td className="px-4 py-2.5">
                            {done ? (
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-green-100 text-green-700">Approved</span>
                            ) : m.hasDiscrepancy ? (
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-100 text-red-700">Discrepancy</span>
                            ) : (
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Pending</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex flex-col gap-1 items-start">
                              {done ? null : (
                                <button
                                  onClick={() => approve(m.scanned.id)}
                                  disabled={approving === m.scanned.id}
                                  className={`text-xs font-semibold px-3 py-1 rounded-lg transition-colors disabled:opacity-50 ${
                                    m.hasDiscrepancy
                                      ? 'bg-orange-100 hover:bg-orange-200 text-orange-700'
                                      : 'bg-green-600 hover:bg-green-700 text-white'
                                  }`}>
                                  {approving === m.scanned.id ? '…' : m.hasDiscrepancy ? 'Approve anyway' : 'Approve'}
                                </button>
                              )}
                              {m.skynetGaps.length > 0 && (
                                <span
                                  title={`Log fills missing SKYNET fields: ${m.skynetGaps.join(', ')}`}
                                  className="text-[10px] font-semibold text-blue-600 cursor-help">
                                  fills {m.skynetGaps.join(', ')}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}

              {/* Scanned only */}
              {tab === 'scanned' && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {['Date', 'Aircraft', 'Flight No', 'Client', 'Hours', 'Status', 'Action'].map(h => (
                        <th key={h} className="text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 px-4 py-3 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {result.scannedOnly.length === 0 ? (
                      <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-gray-400">All scanned logs matched</td></tr>
                    ) : result.scannedOnly.map(log => {
                      const done = isApproved(log)
                      return (
                        <tr key={log.id} className={done ? 'bg-green-50 opacity-70' : 'hover:bg-gray-50'}>
                          <td className="px-4 py-2.5 whitespace-nowrap text-gray-700">{fmt(log.departure_date)}</td>
                          <td className="px-4 py-2.5 font-mono font-bold text-[#ee7e2c]">{log.aircraft_reg || '—'}</td>
                          <td className="px-4 py-2.5 text-gray-700">{log.flight_number || '—'}</td>
                          <td className="px-4 py-2.5 text-gray-600 text-xs">{log.client || '—'}</td>
                          <td className="px-4 py-2.5 tabular-nums text-gray-700">{Number(log.total_flight_time || 0).toFixed(2)}</td>
                          <td className="px-4 py-2.5">
                            {done ? (
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-green-100 text-green-700">Approved</span>
                            ) : (
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Not in SKYNET</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 flex items-center gap-2">
                            {!done && (
                              <button
                                onClick={() => approve(log.id)}
                                disabled={approving === log.id}
                                className="text-xs font-semibold bg-orange-100 hover:bg-orange-200 text-orange-700 px-3 py-1 rounded-lg transition-colors disabled:opacity-50">
                                {approving === log.id ? '…' : 'Approve'}
                              </button>
                            )}
                            <Link href={`/history?id=${log.id}`} className="text-xs text-gray-400 hover:text-[#ee7e2c]">
                              View →
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}

              {/* SKYNET only */}
              {tab === 'skynet' && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {['Date', 'Aircraft', 'DFR / Flight No', 'Client', 'Hours', 'Status', 'Action'].map(h => (
                        <th key={h} className="text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 px-4 py-3 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {result.skynetOnly.length === 0 ? (
                      <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-gray-400">
                        {result.skynetAvailable ? 'All SKYNET flights matched' : 'Connect SKYNET to see unmatched flights'}
                      </td></tr>
                    ) : result.skynetOnly.map(f => (
                      <tr key={f.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 whitespace-nowrap text-gray-700">{fmt(f.departure_date)}</td>
                        <td className="px-4 py-2.5 font-mono font-bold text-blue-600">{f.aircraft_registration || '—'}</td>
                        <td className="px-4 py-2.5 text-gray-700">
                          {f.flight_reference || f.flight_number || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 text-xs">{f.client || '—'}</td>
                        <td className="px-4 py-2.5 tabular-nums text-gray-700">{Number(f.billed_flight_time || f.flight_time_hours || 0).toFixed(2)}</td>
                        <td className="px-4 py-2.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                            Not scanned
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <Link href="/upload" className="text-xs text-[#ee7e2c] font-semibold hover:underline">
                            Upload log →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pending summary footer */}
            {pendingCount > 0 && (
              <p className="text-xs text-gray-500 text-center">
                {pendingCount} log{pendingCount !== 1 ? 's' : ''} still pending approval in this period.
              </p>
            )}
          </>
        )}

        {!result && !loading && (
          <div className="bg-white rounded-2xl border border-gray-200 py-16 text-center text-sm text-gray-400">
            Set a date range and run reconciliation to compare scanned logs against SKYNET.
          </div>
        )}

      </main>
    </div>
  )
}
