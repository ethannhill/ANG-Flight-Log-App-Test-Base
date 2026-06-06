'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const tiles = [
  {
    href: '/upload',
    label: 'Upload Log',
    desc: 'Scan and extract paper flight log forms',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.6} className="w-6 h-6">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
    ),
    iconBg: 'bg-white/20',
    primary: true,
    badge: 'Live',
    badgeStyle: 'bg-white/20 text-white',
  },
  {
    href: '/dashboard',
    label: 'Dashboard',
    desc: 'Live flight data, status and billing overview',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth={1.6} className="w-6 h-6">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
    iconBg: 'bg-blue-50',
    badge: 'Live',
    badgeStyle: 'bg-green-100 text-green-700',
  },
  {
    href: '/history',
    label: 'Log Review',
    desc: 'Browse, approve and manage saved logs',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth={1.6} className="w-6 h-6">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
    iconBg: 'bg-violet-50',
    badge: 'Live',
    badgeStyle: 'bg-green-100 text-green-700',
  },
  {
    href: '/billing',
    label: 'Billing Summary',
    desc: 'Flight hours by client and entity, CSV export',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#ca8a04" strokeWidth={1.6} className="w-6 h-6">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
        <line x1="1" y1="10" x2="23" y2="10"/>
      </svg>
    ),
    iconBg: 'bg-yellow-50',
    badge: 'Live',
    badgeStyle: 'bg-green-100 text-green-700',
  },
  {
    href: '/reconciliation',
    label: 'Reconciliation',
    desc: 'Match scanned logs against SKYNET flight data',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth={1.6} className="w-6 h-6">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
    iconBg: 'bg-teal-50',
    badge: 'Live',
    badgeStyle: 'bg-green-100 text-green-700',
  },
  {
    href: '/chat',
    label: 'Ask',
    desc: 'Natural language search across all flight data',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth={1.6} className="w-6 h-6">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    iconBg: 'bg-rose-50',
    badge: 'Live',
    badgeStyle: 'bg-green-100 text-green-700',
  },
  {
    href: '#',
    label: 'Reports',
    desc: 'Monthly ops reports and PDF exports',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth={1.6} className="w-6 h-6">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="12" y1="18" x2="12" y2="12"/>
        <line x1="9" y1="15" x2="15" y2="15"/>
      </svg>
    ),
    iconBg: 'bg-orange-50',
    badge: 'Coming soon',
    badgeStyle: 'bg-gray-100 text-gray-500',
    placeholder: true,
  },
  {
    href: '/fuel-dockets',
    label: 'Fuel Dockets',
    desc: 'Scan and match fuel receipts to flight sectors',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#ee7e2c" strokeWidth={1.6} className="w-6 h-6">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <path d="M8 13h8M8 17h4"/>
      </svg>
    ),
    iconBg: 'bg-orange-50',
    badge: 'New',
    badgeStyle: 'bg-blue-100 text-blue-700',
  },
  {
    href: '/trend',
    label: 'Engine Trends',
    desc: 'ITT, torque, oil temp and fuel flow over time per aircraft',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#ee7e2c" strokeWidth={1.6} className="w-6 h-6">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
    iconBg: 'bg-orange-50',
    badge: 'Live',
    badgeStyle: 'bg-green-100 text-green-700',
  },
  {
    href: '/analytics',
    label: 'Analytics',
    desc: 'MotherDuck-powered KPIs and trends',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth={1.6} className="w-6 h-6">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 8v4l3 3"/>
      </svg>
    ),
    iconBg: 'bg-violet-50',
    badge: 'Live',
    badgeStyle: 'bg-green-100 text-green-700',
  },
  {
    href: '/historical',
    label: 'Historical Data',
    desc: 'Trends and analytics from completed months',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth={1.6} className="w-6 h-6">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
    iconBg: 'bg-violet-50',
    badge: 'Live',
    badgeStyle: 'bg-green-100 text-green-700',
  },
  {
    href: '/settings',
    label: 'Settings',
    desc: 'Users, integrations and app configuration',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={1.6} className="w-6 h-6">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
    iconBg: 'bg-gray-100',
    badge: 'Live',
    badgeStyle: 'bg-green-100 text-green-700',
  },
]

export default function Home() {
  const router = useRouter()
  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }
  return (
    <div className="min-h-screen bg-gray-50" style={{ borderTop: '4px solid #ee7e2c' }}>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 bg-[#ee7e2c] flex-shrink-0" />
          <div>
            <div className="text-xs font-bold tracking-widest uppercase text-gray-900">Air Navigator Group</div>
            <div className="text-xs text-gray-500 mt-0.5">Operations Portal</div>
          </div>
        </div>
        <button onClick={logout} className="text-xs text-gray-400 hover:text-gray-600 transition">
          Sign out
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
          {tiles.map((tile) => {
            const Tag = tile.placeholder ? 'div' : Link
            return (
              <Tag
                key={tile.label}
                href={tile.href as string}
                className={[
                  'flex flex-col gap-4 h-[220px] rounded-2xl border p-7 transition-all duration-150',
                  tile.primary
                    ? 'bg-[#ee7e2c] border-[#ee7e2c] hover:bg-[#d4691a] hover:border-[#d4691a]'
                    : 'bg-white border-gray-200 hover:-translate-y-0.5 hover:shadow-lg',
                  tile.placeholder ? 'opacity-60 cursor-default' : 'cursor-pointer',
                ].join(' ')}
              >
                <div className={`w-13 h-13 rounded-xl flex items-center justify-center flex-shrink-0 ${tile.iconBg}`}
                     style={{ width: 52, height: 52, borderRadius: 14 }}>
                  {tile.icon}
                </div>
                <div className="flex-1">
                  <div className={`text-[15px] font-bold leading-snug ${tile.primary ? 'text-white' : 'text-gray-900'}`}>
                    {tile.label}
                  </div>
                  <div className={`text-[13px] mt-1 leading-relaxed ${tile.primary ? 'text-white/70' : 'text-gray-500'}`}>
                    {tile.desc}
                  </div>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full w-fit ${tile.badgeStyle}`}>
                  {tile.badge}
                </span>
              </Tag>
            )
          })}
        </div>
      </main>

      <footer className="text-center py-5 text-xs text-gray-400 border-t border-gray-200">
        Air Navigator Group · Operations Portal
      </footer>
    </div>
  )
}
