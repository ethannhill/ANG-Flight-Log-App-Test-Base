'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'

type TrendRow = {
  departure_date: string
  flight_number: string
  aircraft_reg?: string
  oat: number | null
  pres_alt: number | null
  torq_l: number | null; torq_r: number | null
  itt_l: number | null;  itt_r: number | null
  fuel_flow_l: number | null; fuel_flow_r: number | null
  oil_temp_l: number | null;  oil_temp_r: number | null
  oil_px_l: number | null;    oil_px_r: number | null
  prop_rpm_l: number | null;  prop_rpm_r: number | null
  n1_l: number | null;        n1_r: number | null
}

// Two colour palettes — solid for ac1, dashed for ac2
const PALETTE = [
  { l: '#ee7e2c', r: '#f5a623' },  // orange for ac1
  { l: '#2563eb', r: '#60a5fa' },  // blue for ac2
]

function fmt(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: '2-digit' })
}

function n(v: unknown) {
  const x = Number(v)
  return isNaN(x) ? null : x
}

type MetricKey = keyof Omit<TrendRow, 'departure_date' | 'flight_number' | 'aircraft_reg'>

type ChartDef = {
  title: string
  lKey: MetricKey
  rKey: MetricKey
  unit?: string
}

const CHARTS: ChartDef[] = [
  { title: 'ITT / T5 / T6',    lKey: 'itt_l',       rKey: 'itt_r',       unit: '°' },
  { title: 'Torque',            lKey: 'torq_l',      rKey: 'torq_r' },
  { title: 'Oil Temperature',   lKey: 'oil_temp_l',  rKey: 'oil_temp_r',  unit: '°' },
  { title: 'Oil Pressure',      lKey: 'oil_px_l',    rKey: 'oil_px_r' },
  { title: 'Fuel Flow',         lKey: 'fuel_flow_l', rKey: 'fuel_flow_r' },
  { title: 'N1',                lKey: 'n1_l',        rKey: 'n1_r' },
  { title: 'Prop RPM',          lKey: 'prop_rpm_l',  rKey: 'prop_rpm_r' },
]

function TrendChart({
  datasets, labels, chart,
}: {
  datasets: TrendRow[][]
  labels: string[]
  chart: ChartDef
}) {
  // Merge all data points by date (each aircraft tagged)
  const allPoints: Record<string, Record<string, number | null>> = {}

  datasets.forEach((rows, ai) => {
    rows.forEach(r => {
      const key = fmt(r.departure_date)
      if (!allPoints[key]) allPoints[key] = { date: key as unknown as number | null }
      allPoints[key][`${labels[ai]}_L`] = n(r[chart.lKey])
      allPoints[key][`${labels[ai]}_R`] = n(r[chart.rKey])
    })
  })

  const data = Object.values(allPoints).sort((a, b) =>
    String(a.date).localeCompare(String(b.date))
  )

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">{chart.title}</p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={40} unit={chart.unit} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
            formatter={(v: unknown, name: unknown) => [`${v}${chart.unit || ''}`, String(name)]}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {labels.map((label, ai) => (
            <>
              <Line key={`${label}_L`} type="monotone" dataKey={`${label}_L`}
                name={`${label} L`} stroke={PALETTE[ai]?.l || '#666'}
                strokeWidth={2} strokeDasharray={ai === 1 ? '5 3' : undefined}
                dot={{ r: 3 }} connectNulls />
              <Line key={`${label}_R`} type="monotone" dataKey={`${label}_R`}
                name={`${label} R`} stroke={PALETTE[ai]?.r || '#999'}
                strokeWidth={2} strokeDasharray={ai === 1 ? '5 3' : undefined}
                dot={{ r: 3 }} connectNulls />
            </>
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function TrendPage() {
  const [aircraft, setAircraft] = useState<string[]>([])
  const [ac1, setAc1]           = useState('')
  const [ac2, setAc2]           = useState('')
  const [data1, setData1]       = useState<TrendRow[]>([])
  const [data2, setData2]       = useState<TrendRow[]>([])
  const [loading, setLoading]   = useState(false)

  useEffect(() => {
    fetch('/api/trend?aircraft=list').then(r => r.json()).then((list: string[]) => {
      setAircraft(list)
      if (list.length >= 1) setAc1(list[0])
      if (list.length >= 2) setAc2(list[1])
    })
  }, [])

  useEffect(() => {
    if (!ac1) return
    setLoading(true)
    fetch(`/api/trend?aircraft_reg=${encodeURIComponent(ac1)}`)
      .then(r => r.json())
      .then(rows => { setData1(Array.isArray(rows) ? rows : []); setLoading(false) })
  }, [ac1])

  useEffect(() => {
    if (!ac2) { setData2([]); return }
    fetch(`/api/trend?aircraft_reg=${encodeURIComponent(ac2)}`)
      .then(r => r.json())
      .then(rows => setData2(Array.isArray(rows) ? rows : []))
  }, [ac2])

  const datasets = [data1, ...(data2.length ? [data2] : [])]
  const labels   = [ac1,   ...(data2.length ? [ac2]   : [])]
  const hasData  = data1.length > 0

  // Latest reading per aircraft for summary table
  const latest1 = data1[data1.length - 1] || null
  const latest2 = data2[data2.length - 1] || null

  const SUMMARY_ROWS: { label: string; key: MetricKey; unit?: string }[] = [
    { label: 'OAT',          key: 'oat',         unit: '°C' },
    { label: 'Pres Alt',     key: 'pres_alt',    unit: ' ft' },
    { label: 'ITT L',        key: 'itt_l',       unit: '°' },
    { label: 'ITT R',        key: 'itt_r',       unit: '°' },
    { label: 'Torque L',     key: 'torq_l' },
    { label: 'Torque R',     key: 'torq_r' },
    { label: 'Oil Temp L',   key: 'oil_temp_l',  unit: '°' },
    { label: 'Oil Temp R',   key: 'oil_temp_r',  unit: '°' },
    { label: 'Oil Px L',     key: 'oil_px_l' },
    { label: 'Oil Px R',     key: 'oil_px_r' },
    { label: 'Fuel Flow L',  key: 'fuel_flow_l' },
    { label: 'Fuel Flow R',  key: 'fuel_flow_r' },
    { label: 'N1 L',         key: 'n1_l' },
    { label: 'N1 R',         key: 'n1_r' },
    { label: 'Prop RPM L',   key: 'prop_rpm_l' },
    { label: 'Prop RPM R',   key: 'prop_rpm_r' },
  ]

  return (
    <div className="min-h-screen bg-gray-50" style={{ borderTop: '4px solid #ee7e2c' }}>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center gap-4">
        <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">←</Link>
        <div>
          <div className="text-xs font-bold tracking-widest uppercase text-gray-900">Air Navigator Group</div>
          <div className="text-xs text-gray-500">Engine Trend Monitoring</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {/* Selectors */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-[#ee7e2c] shrink-0" />
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Aircraft 1</label>
            <select value={ac1} onChange={e => setAc1(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ee7e2c]">
              <option value="">Select…</option>
              {aircraft.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            {data1.length > 0 && <span className="text-xs text-gray-400">{data1.length} log{data1.length !== 1 ? 's' : ''}</span>}
          </div>
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-[#2563eb] shrink-0" />
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Aircraft 2</label>
            <select value={ac2} onChange={e => setAc2(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ee7e2c]">
              <option value="">None</option>
              {aircraft.filter(a => a !== ac1).map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            {data2.length > 0 && <span className="text-xs text-gray-400">{data2.length} log{data2.length !== 1 ? 's' : ''}</span>}
          </div>
          {data2.length > 0 && (
            <p className="text-xs text-gray-400 ml-2">Solid lines = Aircraft 1 · Dashed = Aircraft 2</p>
          )}
        </div>

        {loading && <p className="text-sm text-gray-400 text-center py-12">Loading…</p>}
        {!loading && ac1 && !hasData && (
          <p className="text-sm text-gray-400 text-center py-12">No trend data for {ac1} yet.</p>
        )}

        {/* Latest readings comparison table */}
        {!loading && hasData && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Latest Readings</p>
              {latest1 && <span className="text-xs text-gray-400">({fmt(latest1.departure_date)})</span>}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 px-5 py-2.5">Parameter</th>
                  <th className="text-right text-[10px] font-bold uppercase tracking-wider px-5 py-2.5" style={{ color: '#ee7e2c' }}>{ac1}</th>
                  {latest2 && <th className="text-right text-[10px] font-bold uppercase tracking-wider text-blue-600 px-5 py-2.5">{ac2}</th>}
                  {latest2 && <th className="text-right text-[10px] font-bold uppercase tracking-wider text-gray-400 px-5 py-2.5">Δ</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {SUMMARY_ROWS.map(row => {
                  const v1 = latest1 ? n(latest1[row.key]) : null
                  const v2 = latest2 ? n(latest2[row.key]) : null
                  const diff = v1 != null && v2 != null ? v1 - v2 : null
                  if (v1 == null && v2 == null) return null
                  return (
                    <tr key={row.label} className="hover:bg-gray-50">
                      <td className="px-5 py-2 text-gray-500 text-xs">{row.label}</td>
                      <td className="px-5 py-2 text-right font-semibold tabular-nums text-gray-800">
                        {v1 != null ? `${v1}${row.unit || ''}` : '—'}
                      </td>
                      {latest2 && (
                        <td className="px-5 py-2 text-right font-semibold tabular-nums text-blue-700">
                          {v2 != null ? `${v2}${row.unit || ''}` : '—'}
                        </td>
                      )}
                      {latest2 && (
                        <td className={`px-5 py-2 text-right text-xs tabular-nums font-semibold ${diff == null ? 'text-gray-300' : diff > 0 ? 'text-red-500' : diff < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                          {diff != null ? `${diff > 0 ? '+' : ''}${diff.toFixed(1)}` : '—'}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && hasData && (
          <div className="grid grid-cols-2 gap-5">
            {CHARTS.map(chart => (
              <TrendChart key={chart.title} datasets={datasets} labels={labels} chart={chart} />
            ))}
          </div>
        )}

      </main>
    </div>
  )
}
