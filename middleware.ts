import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { SessionData } from '@/lib/session'

const PUBLIC_PATHS = ['/login', '/api/auth/login']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next()
  if (pathname.startsWith('/api/admin')) return NextResponse.next() // admin API uses its own key auth

  const res = NextResponse.next()
  const session = await getIronSession<SessionData>(req, res, {
    password: process.env.SESSION_SECRET || 'flight-log-session-secret-2026-xK9mP3',
    cookieName: 'flight_log_session',
  })

  if (!session.authenticated) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.svg).*)'],
}
