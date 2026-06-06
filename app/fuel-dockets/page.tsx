'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

type DocketData = {
  docket_number: string | null
  aircraft_reg: string | null
  docket_date: string | null
  supplier: string | null
  product: string | null
  quantity_litres: number | null
  density: number | null
  quantity_kg: number | null
  unit_price: number | null
  total_amount: number | null
  currency: string | null
  location: string | null
}

type ReviewItem = {
  fileHash: string
  thumbnail: string | null
  thumbnailUrl: string | null
  previewUrl: string
  mediaType: string
  data: DocketData
  status: 'review' | 'saved' | 'duplicate' | 'error'
  matchStatus?: string
  qtyVariance?: number | null
  error?: string
}

type FileStatus = {
  filename: string
  status: 'pending' | 'extracting' | 'done' | 'duplicate' | 'error'
  error?: string
}

type Docket = {
  id: string
  docket_number: string | null
  aircraft_reg: string | null
  docket_date: string | null
  supplier: string | null
  product: string | null
  quantity_litres: number | null
  match_status: string
  qty_variance_kg: number | null
  created_at: string
  flight_number: string | null
  log_aircraft: string | null
}

const MATCH_STYLE: Record<string, string> = {
  matched:     'bg-green-100 text-green-700',
  unmatched:   'bg-amber-100 text-amber-700',
  discrepancy: 'bg-red-100 text-red-700',
}

function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function FuelDocketsPage() {
  const [dockets, setDockets]         = useState<Docket[]>([])
  const [loading, setLoading]         = useState(true)
  const [filter, setFilter]           = useState('')
  const [files, setFiles]             = useState<File[]>([])
  const [fileStatuses, setFileStatuses] = useState<FileStatus[]>([])
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([])
  const [extracting, setExtracting]   = useState(false)
  const [dragging, setDragging]       = useState(false)
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [editForm, setEditForm]       = useState<Partial<Docket>>({})
  const [rematching, setRematching]   = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function loadDockets() {
    setLoading(true)
    const res  = await fetch('/api/fuel-dockets')
    const data = await res.json()
    setDockets(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { loadDockets() }, [])

  function handleFiles(selected: FileList | null) {
    if (!selected) return
    const valid = Array.from(selected).filter(f => /\.(jpg|jpeg|png|pdf)$/i.test(f.name))
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
        const res  = await fetch('/api/fuel-dockets', { method: 'POST', body: fd })
        const data = await res.json()

        if (res.status === 409) {
          setFileStatuses(prev => prev.map((s, idx) => idx !== i ? s : { ...s, status: 'duplicate' }))
        } else if (!res.ok) {
          setFileStatuses(prev => prev.map((s, idx) => idx !== i ? s : { ...s, status: 'error', error: data.detail || 'Extraction failed' }))
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
          }])
        }
      } catch {
        setFileStatuses(prev => prev.map((s, idx) => idx !== i ? s : { ...s, status: 'error', error: 'Network error' }))
      }
    }
    setExtracting(false)
  }

  function updateField(idx: number, key: keyof DocketData, value: string | number | null) {
    setReviewItems(prev => prev.map((item, i) => i !== idx ? item : { ...item, data: { ...item.data, [key]: value } }))
  }

  async function handleSave(idx: number) {
    const item = reviewItems[idx]
    const res  = await fetch('/api/fuel-dockets/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_hash: item.fileHash, thumbnail: item.thumbnail, thumbnail_url: item.thumbnailUrl, data: item.data }),
    })
    const data = await res.json()
    if (res.ok) {
      setReviewItems(prev => prev.map((r, i) => i !== idx ? r : {
        ...r, status: 'saved', matchStatus: data.match_status, qtyVariance: data.qty_variance_kg,
      }))
      loadDockets()
    } else {
      setReviewItems(prev => prev.map((r, i) => i !== idx ? r : { ...r, status: 'error', error: data.detail || 'Save failed' }))
    }
  }

  function reset() {
    setFiles([]); setFileStatuses([]); setReviewItems([])
    if (inputRef.current) inputRef.current.value = ''
  }

  async function saveEdit(id: string) {
    await fetch(`/api/fuel-dockets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    setEditingId(null)
    loadDockets()
  }

  async function rematch(id: string) {
    setRematching(id)
    await fetch(`/api/fuel-dockets/${id}`, { method: 'POST' })
    setRematching(null)
    loadDockets()
  }

  const allDone = fileStatuses.length > 0 && fileStatuses.every(s => s.status !== 'pending' && s.status !== 'extracting')
  const visible = filter
    ? dockets.filter(d => [d.docket_number, d.aircraft_reg, d.flight_number, d.supplier].some(v => v?.toLowerCase().includes(filter.toLowerCase())))
    : dockets

  return (
    <div className="min-h-screen bg-gray-50" style={{ borderTop: '4px solid #ee7e2c' }}>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center gap-4">
        <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">←</Link>
        <div>
          <div className="text-xs font-bold tracking-widest uppercase text-gray-900">Air Navigator Group</div>
          <div className="text-xs text-gray-500">Fuel Dockets</div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Drop zone */}
        <div
          className={`rounded-2xl border-2 border-dashed transition-colors p-10 text-center cursor-pointer ${
            dragging ? 'border-[#ee7e2c] bg-orange-50' : 'border-gray-200 bg-white hover:border-[#ee7e2c]'
          }`}
          onClick={() => inputRef.current?.click()}
          onDragEnter={e => { e.preventDefault(); setDragging(true) }}
          onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
        >
          <input ref={inputRef} type="file" accept="image/*,.pdf" multiple className="hidden"
            onChange={e => handleFiles(e.target.files)} />
          <p className="text-sm font-semibold text-gray-600">
            {dragging ? 'Drop to upload' : 'Drop fuel dockets here or click to select'}
          </p>
          <p className="text-xs text-gray-400 mt-1">PNG, JPG or PDF · Puma Energy, Pacific Energy, etc.</p>
        </div>

        {/* File list + extract button */}
        {files.length > 0 && !extracting && fileStatuses.every(s => s.status === 'pending') && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
            {files.map(f => (
              <div key={f.name} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{f.name}</span>
                <span className="text-xs text-gray-400">{(f.size / 1024).toFixed(0)} KB</span>
              </div>
            ))}
            <button onClick={handleExtract}
              className="mt-2 bg-[#ee7e2c] hover:bg-[#d4691a] text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
              Extract {files.length === 1 ? 'Docket' : `${files.length} Dockets`}
            </button>
          </div>
        )}

        {/* File extraction status */}
        {fileStatuses.some(s => s.status !== 'pending') && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-2">
            {fileStatuses.map((s, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-gray-600 truncate">{s.filename}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  s.status === 'done'       ? 'bg-green-100 text-green-700' :
                  s.status === 'extracting' ? 'bg-blue-100 text-blue-700' :
                  s.status === 'duplicate'  ? 'bg-gray-100 text-gray-500' :
                  s.status === 'error'      ? 'bg-red-100 text-red-600' :
                  'bg-gray-100 text-gray-400'
                }`}>
                  {s.status === 'extracting' ? 'Extracting…' : s.status === 'duplicate' ? 'Already saved' : s.status}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Review cards */}
        {reviewItems.map((item, idx) => (
          <div key={item.fileHash} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              {item.status === 'saved' ? (
                <span className="text-[11px] font-bold uppercase tracking-wider bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✓ Saved</span>
              ) : (
                <span className="text-[11px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Review</span>
              )}
              {item.status === 'saved' && item.matchStatus && (
                <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${MATCH_STYLE[item.matchStatus] || ''}`}>
                  {item.matchStatus}{item.qtyVariance != null ? ` · ${item.qtyVariance > 0 ? '+' : ''}${item.qtyVariance} kg` : ''}
                </span>
              )}
            </div>

            {item.status !== 'saved' && (
              <div className="p-6 grid grid-cols-[200px_1fr] gap-6">
                {/* Image preview */}
                <div>
                  {item.mediaType === 'application/pdf' ? (
                    <iframe src={item.previewUrl} className="rounded-xl border border-gray-200 w-full" style={{ height: 260 }} />
                  ) : (
                    <img src={item.previewUrl} alt="Docket" className="rounded-xl border border-gray-200 object-contain w-full max-h-[260px]" />
                  )}
                </div>

                {/* Fields */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {([
                      ['Docket #',   'docket_number',   'text'],
                      ['Aircraft',   'aircraft_reg',    'text'],
                      ['Date',       'docket_date',     'date'],
                      ['Supplier',   'supplier',        'text'],
                      ['Product',    'product',         'text'],
                      ['Qty (L)',    'quantity_litres', 'number'],
                      ['Density',    'density',         'number'],
                      ['Location',   'location',        'text'],
                    ] as [string, keyof DocketData, string][]).map(([label, key, type]) => (
                      <div key={key}>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">{label}</label>
                        <input type={type}
                          value={String(item.data[key] ?? '')}
                          onChange={e => updateField(idx, key, e.target.value || null)}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ee7e2c]" />
                      </div>
                    ))}
                  </div>
                  {item.error && <p className="text-xs text-red-600">{item.error}</p>}
                  <button onClick={() => handleSave(idx)}
                    className="bg-[#ee7e2c] hover:bg-[#d4691a] text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
                    Confirm &amp; Save
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Reset button */}
        {allDone && reviewItems.every(r => r.status === 'saved') && (
          <div className="text-center">
            <button onClick={reset} className="text-sm font-semibold text-[#ee7e2c] hover:underline">
              Upload more dockets
            </button>
          </div>
        )}

        {/* Dockets list */}
        <div className="flex items-center gap-3">
          <input value={filter} onChange={e => setFilter(e.target.value)}
            placeholder="Search docket #, aircraft, supplier…"
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 max-w-xs focus:outline-none focus:border-[#ee7e2c]" />
          <span className="text-xs text-gray-400">{visible.length} docket{visible.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="py-10 text-center text-sm text-gray-400">Loading…</div>
          ) : visible.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-400">No fuel dockets yet. Upload one above.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Docket #', 'Aircraft', 'Date', 'Supplier', 'Product', 'Qty (L)', 'Status', 'Variance kg', 'Matched Flight', ''].map(h => (
                    <th key={h} className="text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {visible.map(d => (
                  <>
                    <tr key={d.id} className={`hover:bg-gray-50 ${editingId === d.id ? 'bg-blue-50' : ''}`}>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">{d.docket_number || '—'}</td>
                      <td className="px-4 py-3 text-gray-700">{d.aircraft_reg || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmt(d.docket_date)}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[140px] truncate">{d.supplier || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{d.product || '—'}</td>
                      <td className="px-4 py-3 tabular-nums text-gray-700">{d.quantity_litres != null ? Number(d.quantity_litres).toLocaleString() : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${MATCH_STYLE[d.match_status] || 'bg-gray-100 text-gray-500'}`}>
                          {d.match_status}
                        </span>
                      </td>
                      <td className={`px-4 py-3 tabular-nums text-xs font-semibold ${!d.qty_variance_kg ? 'text-gray-300' : Math.abs(d.qty_variance_kg) > 50 ? 'text-red-500' : 'text-green-600'}`}>
                        {d.qty_variance_kg != null ? `${d.qty_variance_kg > 0 ? '+' : ''}${d.qty_variance_kg}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {d.flight_number ? `${d.flight_number} · ${d.log_aircraft}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => { setEditingId(editingId === d.id ? null : d.id); setEditForm(d) }}
                            className="text-xs text-gray-400 hover:text-[#ee7e2c]">
                            {editingId === d.id ? 'Cancel' : 'Edit'}
                          </button>
                          <button
                            onClick={() => rematch(d.id)}
                            disabled={rematching === d.id}
                            className="text-xs text-gray-400 hover:text-[#ee7e2c] disabled:opacity-40">
                            {rematching === d.id ? '…' : 'Rematch'}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {editingId === d.id && (
                      <tr key={`${d.id}-edit`} className="bg-blue-50 border-b border-blue-100">
                        <td colSpan={10} className="px-4 py-4">
                          <div className="grid grid-cols-4 gap-3 mb-3">
                            {([
                              ['Docket #',  'docket_number',   'text'],
                              ['Aircraft',  'aircraft_reg',    'text'],
                              ['Date',      'docket_date',     'date'],
                              ['Qty (L)',   'quantity_litres', 'number'],
                              ['Density',   'density',         'number'],
                              ['Supplier',  'supplier',        'text'],
                              ['Product',   'product',         'text'],
                              ['Location',  'location',        'text'],
                            ] as [string, keyof Docket, string][]).map(([label, key, type]) => (
                              <div key={key}>
                                <label className="text-[10px] font-bold uppercase tracking-wider text-[#ee7e2c] block mb-1">{label}</label>
                                <input type={type}
                                  value={String(editForm[key] ?? '')}
                                  onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value || null }))}
                                  className="w-full border border-blue-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ee7e2c]" />
                              </div>
                            ))}
                          </div>
                          <button onClick={() => saveEdit(d.id)}
                            className="bg-[#ee7e2c] hover:bg-[#d4691a] text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors">
                            Save &amp; Rematch
                          </button>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </main>
    </div>
  )
}
