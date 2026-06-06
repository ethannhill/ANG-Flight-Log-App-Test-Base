import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { query } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()
  if (!username || !password) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  try {
    const result = await query(
      'SELECT name, role, entity, password_hash FROM app_users WHERE LOWER(email)=$1',
      [username.trim().toLowerCase()]
    )
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const user = result.rows[0]

    if (user.password_hash) {
      // Per-user password — check bcrypt hash
      const valid = await bcrypt.compare(password, user.password_hash)
      if (!valid) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    } else {
      // Fall back to shared portal password until user sets their own
      const portalPassword = process.env.PORTAL_PASSWORD
      if (!portalPassword || password !== portalPassword) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
      }
    }

    await query('UPDATE app_users SET last_login=NOW() WHERE LOWER(email)=$1', [username.trim().toLowerCase()])
    const session = await getSession()
    session.authenticated = true
    session.username = user.name
    session.role = user.role
    session.entity = user.entity
    await session.save()
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
