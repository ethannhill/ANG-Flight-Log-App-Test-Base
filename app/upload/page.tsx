'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'

type Sector = {
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

type ExtractedLog = {
  flight_number: string
  aircraft_reg: string
  departure_date: string
  captain: string
  first_officer: string
  observer: string
  flight_type: string
  client: string
  remarks: string
  total_flight_time: number
  total_landings: number
  source_file: string
  sectors: Sector[]
}

type ReviewItem = {
  fileHash: string
  thumbnail: string | null
  thumbnailUrl: string | null
  previewUrl: string
  mediaType: string
  data: ExtractedLog
  status: 'review' | 'saved' | 'error'
  rotation: number
  logId?: string
  error?: string
}

function computeCompleteness(data: ExtractedLog) {
  const crewFields = ['captain', 'first_officer', 'client'] as (keyof ExtractedLog)[]
  const detailFields = ['flight_number', 'aircraft_reg', 'departure_date', 'flight_type'] as (keyof ExtractedLog)[]
  const totalFields = ['total_flight_time', 'total_landings'] as (keyof ExtractedLog)[]
  const secKeys = ['flight_no', 'depart_stn', 'arrival_stn', 'off_block', 'on_block', 'block_time', 'pax'] as (keyof Sector)[]

  const filled = (fields: (keyof ExtractedLog)[]) => fields.filter(f => data[f] != null && data[f] !== '').length
  const secTotal = data.sectors?.length ? data.sectors.length * secKeys.length : 1
  const secFilled = data.sectors?.reduce((acc, s) => acc + secKeys.filter(k => s[k] != null && s[k] !== '').length, 0) ?? 0

  const crewF = filled(crewFields)
  const detailF = filled(detailFields)
  const totalF = filled(totalFields)

  const allFilled = crewF + detailF + totalF + secFilled
  const allTotal = crewFields.length + detailFields.length + totalFields.length + secTotal
  const overall = allTotal ? Math.round(allFilled / allTotal * 100) : 0

  function badge(label: string, f: number, t: number) {
    const pct = t ? f / t * 100 : 0
    const missing = t - f
    const note = missing > 0 ? ` · ${missing} missing` : ''
    if (pct === 100) return { label: `✓ ${label}`, color: 'bg-green-100 text-green-700' }
    if (pct >= 50)  return { label: `⚠ ${label}${note}`, color: 'bg-amber-100 text-amber-700' }
    return { label: `! ${label}${note}`, color: 'bg-red-100 text-red-700' }
  }

  return {
    overall,
    overallColor: overall >= 90 ? 'text-green-700' : overall >= 60 ? 'text-amber-700' : 'text-red-700',
    badges: [
      badge('Crew', crewF, crewFields.length),
      badge('Flight Details', detailF, detailFields.length),
      badge(`Sectors (${data.sectors?.length ?? 0})`, secFilled, secTotal),
      badge('Totals', totalF, totalFields.length),
    ],
  }
}

type FileStatus = {
  filename: string
  status: 'pending' | 'extracting' | 'done' | 'duplicate' | 'error'
  logId?: string
  flightNumber?: string
  departureDate?: string
  error?: string
}

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([])
  const [fileStatuses, setFileStatuses] = useState<FileStatus[]>([])
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([])
  const [extracting, setExtracting] = useState(false)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFiles(selected: FileList | null) {
    if (!selected) return
    const valid = Array.from(selected)
      .filter(f => /\.(jpg|jpeg|png|pdf)$/i.test(f.name))
      .slice(0, 3)
    setFiles(valid)
    setFileStatuses([])
    setReviewItems([])
  }

  async function handleExtract() {
    if (!files.length) return
    setExtracting(true)
    setFileStatuses(files.map(f => ({ filename: f.name, status: 'pending' })))
    setReviewItems([])

    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      setFileStatuses(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'extracting' } : s))

      const fd = new FormData()
      fd.append('file', f, f.name)

      try {
        const res = await fetch('/api/extract-preview', { method: 'POST', body: fd })
        const data = await res.json()

        if (res.status === 409) {
          setFileStatuses(prev => prev.map((s, idx) => idx !== i ? s : {
            ...s, status: 'duplicate',
            logId: data.detail?.log_id,
            flightNumber: data.detail?.flight_number,
            departureDate: data.detail?.departure_date,
          }))
        } else if (!res.ok) {
          setFileStatuses(prev => prev.map((s, idx) => idx !== i ? s : {
            ...s, status: 'error', error: data.detail || 'Extraction failed',
          }))
        } else {
          setFileStatuses(prev => prev.map((s, idx) => idx !== i ? s : { ...s, status: 'done' }))
          const mediaType = f.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'
          setReviewItems(prev => [...prev, {
            fileHash: data.file_hash,
            thumbnail: data.thumbnail,
            thumbnailUrl: data.thumbnail_url ?? null,
            previewUrl: URL.createObjectURL(f),
            mediaType,
            data: data.data,
            status: 'review',
            rotation: 0,
          }])
        }
      } catch {
        setFileStatuses(prev => prev.map((s, idx) => idx !== i ? s : {
          ...s, status: 'error', error: 'Network error',
        }))
      }
    }
    setExtracting(false)
  }

  function updateReviewData(idx: number, updates: Partial<ExtractedLog>) {
    setReviewItems(prev => prev.map((item, i) => i !== idx ? item : {
      ...item, data: { ...item.data, ...updates }
    }))
  }

  function updateRotation(idx: number, delta: number) {
    setReviewItems(prev => prev.map((item, i) => i !== idx ? item : {
      ...item, rotation: (item.rotation + delta + 360) % 360
    }))
  }

  function updateSector(reviewIdx: number, sectorIdx: number, updates: Partial<Sector>) {
    setReviewItems(prev => prev.map((item, i) => i !== reviewIdx ? item : {
      ...item,
      data: {
        ...item.data,
        sectors: item.data.sectors.map((s, si) => si !== sectorIdx ? s : { ...s, ...updates })
      }
    }))
  }

  async function handleSave(idx: number) {
    const item = reviewItems[idx]
    try {
      const res = await fetch('/api/save-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_hash: item.fileHash,
          thumbnail: item.thumbnail,
          thumbnail_url: item.thumbnailUrl,
          data: item.data,
        }),
      })
      const data = await res.json()
      if (res.status === 409) {
        setReviewItems(prev => prev.map((r, i) => i !== idx ? r : {
          ...r, status: 'error', error: 'Duplicate — already saved',
        }))
      } else if (!res.ok) {
        setReviewItems(prev => prev.map((r, i) => i !== idx ? r : {
          ...r, status: 'error', error: data.detail || 'Save failed',
        }))
      } else {
        setReviewItems(prev => prev.map((r, i) => i !== idx ? r : {
          ...r, status: 'saved', logId: data.log_id,
        }))
      }
    } catch {
      setReviewItems(prev => prev.map((r, i) => i !== idx ? r : {
        ...r, status: 'error', error: 'Network error',
      }))
    }
  }

  function reset() {
    setFiles([])
    setFileStatuses([])
    setReviewItems([])
    if (inputRef.current) inputRef.current.value = ''
  }

  const allDone = fileStatuses.length > 0 && fileStatuses.every(s => s.status !== 'pending' && s.status !== 'extracting')

  return (
    <div className="min-h-screen bg-gray-50" style={{ borderTop: '4px solid #ee7e2c' }}>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center gap-4">
        <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">←</Link>
        <div>
          <div className="text-xs font-bold tracking-widest uppercase text-gray-900">Air Navigator Group</div>
          <div className="text-xs text-gray-500">Upload Flight Log</div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-6">

        {/* Drop zone */}
        {!extracting && files.length === 0 && reviewItems.length === 0 && fileStatuses.length === 0 && (
          <div
            className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors ${
              dragging ? 'border-[#ee7e2c] bg-orange-50' : 'border-gray-300 bg-white'
            }`}
            onDragEnter={e => { e.preventDefault(); e.stopPropagation(); setDragging(true) }}
            onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragging(true) }}
            onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setDragging(false) }}
            onDrop={e => { e.preventDefault(); e.stopPropagation(); setDragging(false); handleFiles(e.dataTransfer.files) }}
          >
            <svg className="w-10 h-10 mx-auto mb-4 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <p className="text-sm font-semibold text-gray-700">Drop flight log files here</p>
            <p className="text-xs text-gray-400 mt-1">JPG, PNG or PDF · up to 3 files</p>
            <div className="mt-4">
              <input
                ref={inputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                multiple
                onChange={e => handleFiles(e.target.files)}
                className="text-sm text-gray-600 file:mr-4 file:py-2 file:px-5 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#ee7e2c] file:text-white hover:file:bg-[#d4691a] cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* Selected files + extract button */}
        {files.length > 0 && fileStatuses.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs bg-gray-100 text-gray-500 font-mono px-2 py-0.5 rounded">
                    {f.name.split('.').pop()?.toUpperCase()}
                  </span>
                  <span className="text-sm text-gray-700">{f.name}</span>
                </div>
                <span className="text-xs text-gray-400">{(f.size / 1024).toFixed(0)} KB</span>
              </div>
            ))}
            <div className="px-5 py-4">
              <button onClick={handleExtract}
                className="bg-[#ee7e2c] hover:bg-[#d4691a] text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors">
                Extract {files.length} file{files.length > 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}

        {/* Extraction progress */}
        {fileStatuses.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
            {fileStatuses.map((s, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-gray-700">{s.filename}</span>
                <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  s.status === 'extracting' ? 'bg-amber-100 text-amber-700' :
                  s.status === 'done'       ? 'bg-green-100 text-green-700' :
                  s.status === 'duplicate'  ? 'bg-amber-100 text-amber-700' :
                  s.status === 'error'      ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-400'
                }`}>
                  {s.status === 'extracting' ? 'Extracting…' :
                   s.status === 'done'       ? '✓ Extracted' :
                   s.status === 'duplicate'  ? `Duplicate · ${s.flightNumber}` :
                   s.status === 'error'      ? s.error :
                   'Pending'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Review forms */}
        {reviewItems.map((item, idx) => (
          <div key={idx} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {item.status === 'saved'
                    ? <span className="text-[11px] font-bold uppercase tracking-wider bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✓ Saved</span>
                    : <span className="text-[11px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Needs Review</span>
                  }
                  <span className="text-sm font-semibold text-gray-700">
                    {item.data.aircraft_reg} · {item.data.flight_number} · {item.data.departure_date}
                  </span>
                </div>
                {item.status === 'saved' && (
                  <Link href="/history" className="text-xs font-semibold text-[#ee7e2c] hover:underline">
                    View in History →
                  </Link>
                )}
              </div>
              {(() => {
                const c = computeCompleteness(item.data)
                return (
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className={`text-sm font-bold ${c.overallColor}`}>{c.overall}%</span>
                    {c.badges.map((b, bi) => (
                      <span key={bi} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${b.color}`}>{b.label}</span>
                    ))}
                  </div>
                )
              })()}
            </div>

            {item.status !== 'saved' && (
              <div className="grid grid-cols-2 gap-6 p-6">
                {/* Image preview */}
                <div>
                  {item.mediaType !== 'application/pdf' && (
                    <div className="flex items-center gap-2 mb-2">
                      <button onClick={() => updateRotation(idx, -90)}
                        className="text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-2.5 py-1 rounded-lg transition-colors">
                        ↺ Left
                      </button>
                      <button onClick={() => updateRotation(idx, 90)}
                        className="text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-2.5 py-1 rounded-lg transition-colors">
                        ↻ Right
                      </button>
                      <a href={item.previewUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs font-semibold text-[#ee7e2c] hover:underline ml-auto">
                        ⤢ Full size
                      </a>
                    </div>
                  )}
                  {item.mediaType === 'application/pdf'
                    ? <iframe src={item.previewUrl} className="w-full rounded-xl border border-gray-200" style={{ height: 320 }} />
                    : <div className="overflow-hidden rounded-xl border border-gray-200 flex items-center justify-center bg-gray-50" style={{ minHeight: '200px', maxHeight: '320px' }}>
                        <img src={item.previewUrl} alt="Flight log"
                          className="object-contain max-h-[320px] transition-transform duration-200"
                          style={{ transform: `rotate(${item.rotation}deg)` }}
                        />
                      </div>
                  }
                </div>

                {/* Edit form */}
                <div className="space-y-4">
                  {/* Flight details */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2 pl-1 border-l-2 border-[#ee7e2c]">Flight Details</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        ['Flight No', 'flight_number'],
                        ['Aircraft', 'aircraft_reg'],
                        ['Date', 'departure_date'],
                        ['Flight Type', 'flight_type'],
                        ['Client', 'client'],
                      ].map(([label, key]) => (
                        <div key={key}>
                          <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</label>
                          <input
                            className="w-full mt-0.5 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#ee7e2c]"
                            value={(item.data as unknown as Record<string, string>)[key] ?? ''}
                            onChange={e => updateReviewData(idx, { [key]: e.target.value } as Partial<ExtractedLog>)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Crew */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2 pl-1 border-l-2 border-[#ee7e2c]">Crew</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        ['Captain', 'captain'],
                        ['First Officer', 'first_officer'],
                        ['Observer', 'observer'],
                      ].map(([label, key]) => (
                        <div key={key}>
                          <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</label>
                          <input
                            className="w-full mt-0.5 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#ee7e2c]"
                            value={(item.data as unknown as Record<string, string>)[key] ?? ''}
                            onChange={e => updateReviewData(idx, { [key]: e.target.value } as Partial<ExtractedLog>)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Totals */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2 pl-1 border-l-2 border-[#ee7e2c]">Totals</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Flight Hours</label>
                        <input type="number" step="0.01"
                          className="w-full mt-0.5 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#ee7e2c]"
                          value={item.data.total_flight_time ?? 0}
                          onChange={e => updateReviewData(idx, { total_flight_time: parseFloat(e.target.value) })}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Landings</label>
                        <input type="number" step="1"
                          className="w-full mt-0.5 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#ee7e2c]"
                          value={item.data.total_landings ?? 0}
                          onChange={e => updateReviewData(idx, { total_landings: parseInt(e.target.value) })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Remarks */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2 pl-1 border-l-2 border-[#ee7e2c]">Remarks</p>
                    <textarea rows={2}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#ee7e2c] resize-none"
                      value={item.data.remarks ?? ''}
                      onChange={e => updateReviewData(idx, { remarks: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Sectors table */}
            {item.status !== 'saved' && item.data.sectors?.length > 0 && (
              <div className="px-6 pb-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3 pl-1 border-l-2 border-[#ee7e2c]">
                  Sectors ({item.data.sectors.length})
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        {['#','Flt No','From','To','Off Blk','T/O','Land','On Blk','Flt Hrs','Blk Time','Starts','Lands','PAX','Uplift kg','Fuel Dep','Fuel Used','Fuel Arr','Fuel Dkt','IATA','Delay'].map(h => (
                          <th key={h} className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 py-1.5 border-b border-gray-100 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {item.data.sectors.map((s, si) => (
                        <tr key={si} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-2 py-1 text-gray-400">{s.sector_number}</td>
                          {(['flight_no','depart_stn','arrival_stn','off_block','take_off','land','on_block'] as (keyof Sector)[]).map(k => (
                            <td key={String(k)} className="px-1 py-1">
                              <input className="w-16 border border-gray-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-[#ee7e2c]"
                                value={String(s[k] ?? '')}
                                onChange={e => updateSector(idx, si, { [k]: e.target.value })}
                              />
                            </td>
                          ))}
                          <td className="px-1 py-1">
                            <input type="number" step="0.01" className="w-14 border border-gray-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-[#ee7e2c]"
                              value={s.flight_time ?? 0}
                              onChange={e => updateSector(idx, si, { flight_time: parseFloat(e.target.value) })}
                            />
                          </td>
                          <td className="px-1 py-1">
                            <input className="w-14 border border-gray-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-[#ee7e2c]"
                              value={s.block_time ?? ''}
                              onChange={e => updateSector(idx, si, { block_time: e.target.value })}
                            />
                          </td>
                          {(['starts','lands','pax'] as (keyof Sector)[]).map(k => (
                            <td key={String(k)} className="px-1 py-1">
                              <input type="number" className="w-12 border border-gray-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-[#ee7e2c]"
                                value={Number(s[k] ?? 0)}
                                onChange={e => updateSector(idx, si, { [k]: parseInt(e.target.value) })}
                              />
                            </td>
                          ))}
                          {(['kgs_fuel_uplift','fuel_depart','fuel_used','fuel_arrival'] as (keyof Sector)[]).map(k => (
                            <td key={String(k)} className="px-1 py-1">
                              <input type="number" className="w-16 border border-gray-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-[#ee7e2c]"
                                value={Number(s[k] ?? 0)}
                                onChange={e => updateSector(idx, si, { [k]: parseFloat(e.target.value) })}
                              />
                            </td>
                          ))}
                          <td className="px-1 py-1">
                            <input className="w-16 border border-gray-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-[#ee7e2c]"
                              value={s.fuel_docket ?? ''}
                              onChange={e => updateSector(idx, si, { fuel_docket: e.target.value })}
                            />
                          </td>
                          <td className="px-1 py-1">
                            <input className="w-12 border border-gray-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-[#ee7e2c]"
                              value={s.iata_code ?? ''}
                              onChange={e => updateSector(idx, si, { iata_code: e.target.value })}
                            />
                          </td>
                          <td className="px-1 py-1">
                            <input type="number" className="w-12 border border-gray-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-[#ee7e2c]"
                              value={s.delay_minutes ?? 0}
                              onChange={e => updateSector(idx, si, { delay_minutes: parseInt(e.target.value) })}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Save button */}
            {item.status === 'review' && (
              <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-4">
                <button onClick={() => handleSave(idx)}
                  className="bg-[#ee7e2c] hover:bg-[#d4691a] text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors">
                  ✓ Confirm & Save
                </button>
                {item.error && <p className="text-sm text-red-600">{item.error}</p>}
              </div>
            )}
          </div>
        ))}

        {/* Upload another */}
        {allDone && reviewItems.every(r => r.status === 'saved') && (
          <button onClick={reset} className="text-sm font-semibold text-[#ee7e2c] hover:underline">
            ← Upload another log
          </button>
        )}

      </main>
    </div>
  )
}
