import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function GET() {
  try {
    const res = await query(`
      SELECT id, name, email, role, entity, created_at, last_login,
             (password_hash IS NOT NULL) AS has_password
      FROM app_users
      ORDER BY entity, name
    `)
    return NextResponse.json({ users: res.rows })
  } catch {
    return NextResponse.json({ users: [], tableReady: false })
  }
}

export async function POST(req: NextRequest) {
  const { name, email, password, role, entity } = await req.json()
  if (!name || !email) return NextResponse.json({ error: 'Name and email required' }, { status: 400 })

  const passwordHash = password ? await bcrypt.hash(password, 12) : null

  try {
    const res = await query(
      `INSERT INTO app_users (id, name, email, role, entity, password_hash, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, now())
       ON CONFLICT (email) DO NOTHING
       RETURNING id, name, email, role, entity, created_at`,
      [name, email, role || 'reviewer', entity || 'AU', passwordHash]
    )
    if (!res.rows.length) return NextResponse.json({ error: 'Email already exists' }, { status: 409 })
    return NextResponse.json({ user: res.rows[0] })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
