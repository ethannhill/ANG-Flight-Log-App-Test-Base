import { getIronSession, SessionOptions } from 'iron-session'
import { cookies } from 'next/headers'

export type SessionData = {
  authenticated?: boolean
  username?: string
  role?: string
  entity?: string
}

const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET || 'flight-log-session-secret-2026-xK9mP3',
  cookieName: 'flight_log_session',
  cookieOptions: { secure: process.env.NODE_ENV === 'production', httpOnly: true },
}

export async function getSession() {
  const cookieStore = await cookies()
  return getIronSession<SessionData>(cookieStore, sessionOptions)
}
