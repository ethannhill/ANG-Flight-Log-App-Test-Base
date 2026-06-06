'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'

type Stats = {
  total_logs: number
  pending_review: number
  total_hours: number
  total_landings: number
  this_month_logs: number
  this_month_hours: number
}

type MonthRow     = { month: string; hours: number; logs: number }
type AircraftRow  = { aircraft_reg: string; hours: number; logs: number }
type OpRow        = { operation: string; hours: number; logs: number }
type StatusRow    = { status: string; count: number }
type RecentLog    = {
  id: string; flight_number: string; aircraft_reg: string
  departure_date: string; captain: string; client: string
  operation: string; total_flight_time: number; total_landings: number
  status: string; created_at: string
}

type DashData = {
  stats: Stats
  byMonth: MonthRow[]
  byAircraft: AircraftRow[]
  byOperation: OpRow[]
  byStatus: StatusRow[]
  recent: RecentLog[]
}

const ORANGE   = '#ee7e2c'
const BLUE     = '#3b82f6'
const VIOLET   = '#8b5cf6'
const TEAL     = '#14b8a6'
const STATUS_COLOR: Record<string, string> = {
  pending:  '#f59e0b',
  reviewed: '#3b82f6',
  approved: '#22c55e',
}
const OP_COLORS: Record<string, string> = {
  AU:      '#3b82f6',
  PNG:     '#8b5cf6',
  Unknown: '#9ca3af',
}

function fmt(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
}

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-6 flex flex-col gap-1 ${accent ? 'bg-[#ee7e2c] border-[#ee7e2c]' : 'bg-white border-gray-200'}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wider ${accent ? 'text-white/70' : 'text-gray-400'}`}>{label}</p>
      <p className={`text-3xl font-bold tabular-nums ${accent ? 'text-white' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className={`text-xs mt-0.5 ${accent ? 'text-white/60' : 'text-gray-400'}`}>{sub}</p>}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: {value: number}[]; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 shadow text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-gray-500">{Number(p.value).toFixed(1)} hrs</p>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
  }, [])

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" style={{ borderTop: '4px solid #ee7e2c' }}>
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    )
  }

  const { stats, byMonth, byAircraft, byOperation, byStatus, recent } = data

  return (
    <div className="min-h-screen bg-gray-50" style={{ borderTop: '4px solid #ee7e2c' }}>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center gap-4">
        <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">←</Link>
        <div>
          <div className="text-xs font-bold tracking-widest uppercase text-gray-900">Air Navigator Group</div>
          <div className="text-xs text-gray-500">Dashboard</div>
        </div>
        <div className="ml-auto">
          <Link href="/upload" className="bg-[#ee7e2c] hover:bg-[#d4691a] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            + Upload Log
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard accent label="This Month" value={`${Number(stats.this_month_hours).toFixed(1)} hrs`} sub={`${stats.this_month_logs} logs`} />
          <StatCard label="Total Hours" value={Number(stats.total_hours).toFixed(1)} sub="all time" />
          <StatCard label="Total Landings" value={stats.total_landings} sub="all time" />
          <StatCard label="Pending Review" value={stats.pending_review} sub={`of ${stats.total_logs} total logs`} />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Hours by month */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Flight Hours — Last 12 Months</p>
            {byMonth.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-gray-400">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={byMonth} barSize={28}>
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={36} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb' }} />
                  <Bar dataKey="hours" fill={ORANGE} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Status + Operation donuts */}
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-5 flex-1">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">By Status</p>
              {byStatus.length === 0 ? (
                <div className="h-32 flex items-center justify-center text-sm text-gray-400">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={130}>
                  <PieChart>
                    <Pie data={byStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={35} outerRadius={55}>
                      {byStatus.map(s => (
                        <Cell key={s.status} fill={STATUS_COLOR[s.status] || '#9ca3af'} />
                      ))}
                    </Pie>
                    <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-[11px] text-gray-600 capitalize">{v}</span>} />
                    <Tooltip formatter={(v) => [`${v} logs`, '']} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5 flex-1">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">By Operation</p>
              {byOperation.length === 0 ? (
                <div className="h-32 flex items-center justify-center text-sm text-gray-400">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={130}>
                  <PieChart>
                    <Pie data={byOperation} dataKey="hours" nameKey="operation" cx="50%" cy="50%" innerRadius={35} outerRadius={55}>
                      {byOperation.map(o => (
                        <Cell key={o.operation} fill={OP_COLORS[o.operation] || TEAL} />
                      ))}
                    </Pie>
                    <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-[11px] text-gray-600">{v}</span>} />
                    <Tooltip formatter={(v) => [`${Number(v).toFixed(1)} hrs`, '']} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Bottom row: aircraft + recent */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Hours by aircraft */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Hours by Aircraft</p>
            {byAircraft.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-gray-400">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byAircraft} layout="vertical" barSize={18} margin={{ left: 12 }}>
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="aircraft_reg" tick={{ fontSize: 11, fill: '#6b7280', fontFamily: 'monospace' }} axisLine={false} tickLine={false} width={64} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb' }} />
                  <Bar dataKey="hours" fill={BLUE} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Recent activity */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Recent Logs</p>
              <Link href="/history" className="text-xs font-semibold text-[#ee7e2c] hover:underline">View all →</Link>
            </div>
            <div className="divide-y divide-gray-50">
              {recent.length === 0 ? (
                <p className="px-6 py-8 text-sm text-gray-400 text-center">No logs yet</p>
              ) : recent.map(log => (
                <div key={log.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#ee7e2c]">{log.aircraft_reg || '—'}</span>
                      <span className="text-xs text-gray-500">{log.flight_number || '—'}</span>
                      {log.operation && (
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                          log.operation === 'AU' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        }`}>{log.operation}</span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5 truncate">
                      {fmt(log.departure_date)} · {log.captain || 'No captain'}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-semibold text-gray-700 tabular-nums">
                      {log.total_flight_time != null ? Number(log.total_flight_time).toFixed(1) : '—'} hrs
                    </div>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                      log.status === 'pending'  ? 'bg-amber-100 text-amber-700' :
                      log.status === 'reviewed' ? 'bg-blue-100 text-blue-700' :
                                                  'bg-green-100 text-green-700'
                    }`}>{log.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
