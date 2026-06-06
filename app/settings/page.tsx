'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

type User = {
  id: string
  name: string
  email: string
  role: string
  entity: string
  created_at: string
  last_login: string | null
}

const ROLES = ['admin', 'reviewer', 'viewer'] as const
const ROLE_DESC: Record<string, string> = {
  admin:    'Full access — upload, review, approve, manage users',
  reviewer: 'Upload and review logs',
  viewer:   'Read-only access',
}
const ROLE_BADGE: Record<string, string> = {
  admin:    'bg-red-100 text-red-700',
  reviewer: 'bg-blue-100 text-blue-700',
  viewer:   'bg-gray-100 text-gray-500',
}

function fmt(iso: string | null) {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function SettingsPage() {
  const [users, setUsers]         = useState<User[]>([])
  const [tableReady, setTableReady] = useState(true)
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [settingUp, setSettingUp] = useState(false)

  const [config, setConfig] = useState<{ anthropicKeySource: string; skynetConfigured: boolean } | null>(null)
  const [anthropicKey, setAnthropicKey] = useState('')
  const [savingKey, setSavingKey]       = useState(false)
  const [testingKey, setTestingKey]     = useState(false)
  const [keyMsg, setKeyMsg]             = useState('')

  const [newName,     setNewName]     = useState('')
  const [newEmail,    setNewEmail]    = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole,     setNewRole]     = useState<typeof ROLES[number]>('reviewer')
  const [newEntity,   setNewEntity]   = useState<'AU' | 'PNG'>('AU')
  const [adding,      setAdding]      = useState(false)
  const [addError,    setAddError]    = useState('')

  const [resetUserId,  setResetUserId]  = useState<string | null>(null)
  const [resetPwd,     setResetPwd]     = useState('')
  const [resetting,    setResetting]    = useState(false)
  const [resetMsg,     setResetMsg]     = useState('')

  // Config display
  const skynetKey = typeof window !== 'undefined' ? '' : '' // read-only — set via env
  const [section, setSection] = useState<'users' | 'integrations' | 'about'>('users')

  useEffect(() => {
    loadUsers()
    fetch('/api/config').then(r => r.json()).then(setConfig)
  }, [])

  async function saveKey() {
    if (!anthropicKey.trim()) return
    setSavingKey(true); setKeyMsg('')
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'anthropic_api_key', value: anthropicKey.trim() }),
    })
    const cfg = await fetch('/api/config').then(r => r.json())
    setConfig(cfg)
    setAnthropicKey('')
    setKeyMsg('Key saved.')
    setSavingKey(false)
    setTimeout(() => setKeyMsg(''), 3000)
  }

  async function testKey() {
    setTestingKey(true); setKeyMsg('')
    const res  = await fetch('/api/config/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service: 'anthropic' }),
    })
    const json = await res.json()
    setKeyMsg(json.ok ? '✓ Connection successful' : `✗ ${json.error}`)
    setTestingKey(false)
    setTimeout(() => setKeyMsg(''), 5000)
  }

  async function loadUsers() {
    setLoadingUsers(true)
    const res  = await fetch('/api/users')
    const json = await res.json()
    setUsers(json.users || [])
    setTableReady(json.tableReady !== false)
    setLoadingUsers(false)
  }

  async function setup() {
    setSettingUp(true)
    await fetch('/api/setup', { method: 'POST' })
    setSettingUp(false)
    setTableReady(true)
    loadUsers()
  }

  async function addUser() {
    if (!newName.trim() || !newEmail.trim()) return
    setAdding(true)
    setAddError('')
    const res  = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), email: newEmail.trim(), password: newPassword.trim() || null, role: newRole, entity: newEntity }),
    })
    const json = await res.json()
    if (!res.ok) {
      setAddError(json.error || 'Failed')
    } else {
      setUsers(prev => [json.user, ...prev])
      setNewName(''); setNewEmail(''); setNewPassword(''); setNewRole('reviewer')
    }
    setAdding(false)
  }

  async function changeRole(id: string, role: string) {
    await fetch(`/api/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    setUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u))
  }

  async function changeEntity(id: string, entity: string) {
    await fetch(`/api/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity }),
    })
    setUsers(prev => prev.map(u => u.id === id ? { ...u, entity } : u))
  }

  async function resetPassword(id: string) {
    if (!resetPwd || resetPwd.length < 6) {
      setResetMsg('Min 6 characters')
      return
    }
    setResetting(true)
    setResetMsg('')
    const res = await fetch(`/api/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: resetPwd }),
    })
    const json = await res.json()
    if (!res.ok) {
      setResetMsg(json.error || 'Failed')
    } else {
      setResetMsg('Password updated')
      setTimeout(() => { setResetUserId(null); setResetPwd(''); setResetMsg('') }, 3000)
    }
    setResetting(false)
  }

  async function removeUser(id: string) {
    await fetch(`/api/users/${id}`, { method: 'DELETE' })
    setUsers(prev => prev.filter(u => u.id !== id))
  }

  return (
    <div className="min-h-screen bg-gray-50" style={{ borderTop: '4px solid #ee7e2c' }}>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center gap-4">
        <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">←</Link>
        <div>
          <div className="text-xs font-bold tracking-widest uppercase text-gray-900">Air Navigator Group</div>
          <div className="text-xs text-gray-500">Settings</div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 flex gap-8">

        {/* Sidebar nav */}
        <nav className="w-44 flex-shrink-0 space-y-1">
          {([
            { key: 'users',        label: 'Users' },
            { key: 'integrations', label: 'Integrations' },
            { key: 'about',        label: 'About' },
          ] as const).map(item => (
            <button key={item.key} onClick={() => setSection(item.key)}
              className={`w-full text-left text-sm font-semibold px-3 py-2 rounded-lg transition-colors ${
                section === item.key
                  ? 'bg-[#ee7e2c] text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 space-y-6">

          {/* ── Users ── */}
          {section === 'users' && (
            <>
              <div>
                <h2 className="text-base font-bold text-gray-900">User Management</h2>
                <p className="text-sm text-gray-500 mt-0.5">People who can access the Operations Portal.</p>
              </div>

              {/* First-time setup */}
              {!tableReady && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl px-6 py-5">
                  <p className="text-sm font-semibold text-amber-800">User table not initialised</p>
                  <p className="text-xs text-amber-700 mt-1">The app_users table needs to be created in the database.</p>
                  <button onClick={setup} disabled={settingUp}
                    className="mt-3 bg-[#ee7e2c] hover:bg-[#d4691a] text-white text-xs font-bold px-4 py-2 rounded-lg">
                    {settingUp ? 'Setting up…' : 'Initialise now'}
                  </button>
                </div>
              )}

              {/* Add user */}
              {tableReady && (
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Add User</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block mb-1">Name</label>
                      <input value={newName} onChange={e => setNewName(e.target.value)}
                        placeholder="Full name"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ee7e2c]" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block mb-1">Email</label>
                      <input value={newEmail} onChange={e => setNewEmail(e.target.value)}
                        placeholder="email@example.com" type="email"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ee7e2c]" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block mb-1">Password</label>
                      <input value={newPassword} onChange={e => setNewPassword(e.target.value)}
                        placeholder="Initial password (optional)" type="password"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ee7e2c]" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block mb-1">Entity</label>
                      <select value={newEntity} onChange={e => setNewEntity(e.target.value as 'AU' | 'PNG')}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ee7e2c]">
                        <option value="AU">AU — Australia</option>
                        <option value="PNG">PNG — Papua New Guinea</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block mb-1">Role</label>
                      <select value={newRole} onChange={e => setNewRole(e.target.value as typeof ROLES[number])}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ee7e2c]">
                        {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                      </select>
                    </div>
                  </div>
                  {newRole && (
                    <p className="text-xs text-gray-400 mt-2">{ROLE_DESC[newRole]}</p>
                  )}
                  {addError && <p className="text-xs text-red-600 mt-2">{addError}</p>}
                  <button onClick={addUser} disabled={adding || !newName.trim() || !newEmail.trim()}
                    className="mt-4 bg-[#ee7e2c] hover:bg-[#d4691a] disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
                    {adding ? 'Adding…' : '+ Add User'}
                  </button>
                </div>
              )}

              {/* User list */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                {loadingUsers ? (
                  <div className="py-10 text-center text-sm text-gray-400">Loading…</div>
                ) : users.length === 0 ? (
                  <div className="py-10 text-center text-sm text-gray-400">No users yet. Add one above.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 px-4 py-3">Name</th>
                        <th className="text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 px-4 py-3">Email</th>
                        <th className="text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 px-4 py-3 w-20">Entity</th>
                        <th className="text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 px-4 py-3 w-24">Role</th>
                        <th className="text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 px-4 py-3 whitespace-nowrap w-24">Added</th>
                        <th className="text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 px-4 py-3 whitespace-nowrap w-24">Last Login</th>
                        <th className="px-4 py-3 w-32" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {users.map(u => (
                        <>
                          <tr key={u.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{u.name}</td>
                            <td className="px-4 py-3 text-gray-500 text-xs">{u.email}</td>
                            <td className="px-4 py-3">
                              <select value={u.entity} onChange={e => changeEntity(u.id, e.target.value)}
                                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border-0 cursor-pointer focus:outline-none ${
                                  u.entity === 'AU' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                                }`}>
                                <option value="AU">AU</option>
                                <option value="PNG">PNG</option>
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              <select value={u.role} onChange={e => changeRole(u.id, e.target.value)}
                                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border-0 cursor-pointer focus:outline-none ${ROLE_BADGE[u.role] || 'bg-gray-100 text-gray-500'}`}>
                                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                              </select>
                            </td>
                            <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{fmt(u.created_at)}</td>
                            <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{fmt(u.last_login)}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-3">
                                <button onClick={() => { setResetUserId(resetUserId === u.id ? null : u.id); setResetPwd(''); setResetMsg('') }}
                                  className="text-xs text-gray-400 hover:text-[#ee7e2c] font-semibold whitespace-nowrap">
                                  {resetUserId === u.id ? 'Cancel' : 'Reset pwd'}
                                </button>
                                <button onClick={() => removeUser(u.id)}
                                  className="text-xs text-red-400 hover:text-red-600 font-semibold">
                                  Remove
                                </button>
                              </div>
                            </td>
                          </tr>
                          {resetUserId === u.id && (
                            <tr key={`${u.id}-reset`} className="bg-amber-50">
                              <td colSpan={7} className="px-5 py-3">
                                <div className="flex items-center gap-3">
                                  <span className="text-xs text-amber-700 font-semibold">New password for {u.name}:</span>
                                  <input
                                    type="password"
                                    value={resetPwd}
                                    onChange={e => setResetPwd(e.target.value)}
                                    placeholder="Min 6 characters"
                                    className="border border-amber-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#ee7e2c] w-52"
                                    onKeyDown={e => e.key === 'Enter' && resetPassword(u.id)}
                                  />
                                  <button onClick={() => resetPassword(u.id)} disabled={resetting}
                                    className="bg-[#ee7e2c] hover:bg-[#d4691a] disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                                    {resetting ? 'Saving…' : 'Save'}
                                  </button>
                                  {resetMsg && (
                                    <span className={`text-xs font-semibold ${resetMsg === 'Password updated' ? 'text-green-600' : 'text-red-600'}`}>
                                      {resetMsg}
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {/* ── Integrations ── */}
          {section === 'integrations' && (
            <>
              <div>
                <h2 className="text-base font-bold text-gray-900">Integrations</h2>
                <p className="text-sm text-gray-500 mt-0.5">External API connections and keys.</p>
              </div>

              <div className="space-y-4">
                {/* SKYNET */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-900">SKYNET API</p>
                      <p className="text-xs text-gray-500 mt-0.5">Flight data reconciliation — Air Navigator Group</p>
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      skynetKey ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {skynetKey ? 'Connected' : 'Not configured'}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="font-semibold text-gray-400 uppercase tracking-wider mb-1">API URL</p>
                      <p className="text-gray-600 font-mono">SKYNET_API_URL in .env.local</p>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-400 uppercase tracking-wider mb-1">API Key</p>
                      <p className="text-gray-600 font-mono">SKYNET_API_KEY in .env.local</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-3">Rate limit: 60 req/min · Bearer auth (sn_ prefix)</p>
                </div>

                {/* Anthropic */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-900">Anthropic (Claude)</p>
                      <p className="text-xs text-gray-500 mt-0.5">AI-powered OCR extraction and chat · Claude Sonnet 4.6</p>
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      config?.anthropicKeySource === 'none' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {config?.anthropicKeySource === 'env' ? 'Via environment'
                        : config?.anthropicKeySource === 'db' ? 'Via settings'
                        : 'Not configured'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={anthropicKey}
                      onChange={e => setAnthropicKey(e.target.value)}
                      placeholder={config?.anthropicKeySource !== 'none' ? 'Enter new key to replace…' : 'sk-ant-api03-…'}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ee7e2c]"
                    />
                    <button onClick={saveKey} disabled={savingKey || !anthropicKey.trim()}
                      className="bg-[#ee7e2c] hover:bg-[#d4691a] disabled:opacity-40 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
                      {savingKey ? 'Saving…' : 'Save'}
                    </button>
                    <button onClick={testKey} disabled={testingKey || config?.anthropicKeySource === 'none'}
                      className="border border-gray-200 hover:bg-gray-50 disabled:opacity-40 text-gray-600 text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
                      {testingKey ? 'Testing…' : 'Test'}
                    </button>
                  </div>
                  {keyMsg && (
                    <p className={`text-xs font-semibold ${keyMsg.startsWith('✓') ? 'text-green-600' : keyMsg.startsWith('✗') ? 'text-red-600' : 'text-gray-600'}`}>
                      {keyMsg}
                    </p>
                  )}
                </div>

                {/* Database */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-900">Database</p>
                      <p className="text-xs text-gray-500 mt-0.5">Supabase PostgreSQL (migrating to Azure)</p>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                      Connected
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-4">Connection pool: 3 max · Supabase ap-southeast-2</p>
                </div>
              </div>
            </>
          )}

          {/* ── About ── */}
          {section === 'about' && (
            <>
              <div>
                <h2 className="text-base font-bold text-gray-900">About</h2>
                <p className="text-sm text-gray-500 mt-0.5">Air Navigator Group Operations Portal</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
                {[
                  ['Client', 'Air Navigator Group'],
                  ['Built by', 'Kingsley Hill'],
                  ['Stack', 'Next.js 16 · Supabase · FastAPI · Claude Sonnet 4.6'],
                  ['Version', '1.0.0'],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between px-6 py-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400">{label}</span>
                    <span className="text-sm text-gray-700">{value}</span>
                  </div>
                ))}
              </div>
            </>
          )}

        </div>
      </main>
    </div>
  )
}
