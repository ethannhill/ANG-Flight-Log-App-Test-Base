import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { checkAdminKey } from '@/lib/adminAuth'
import bcrypt from 'bcryptjs'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}

export async function GET(req: NextRequest) {
  if (!checkAdminKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rows = (await query(`SELECT id, name, email, role, entity, created_at, last_login FROM app_users ORDER BY created_at DESC`)).rows
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  if (!checkAdminKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { name, email, role, entity } = await req.json()
  if (!name || !email) return NextResponse.json({ error: 'name and email required' }, { status: 400 })
  const row = (await query(
    `INSERT INTO app_users (id, name, email, role, entity, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, now())
     ON CONFLICT (email) DO NOTHING
     RETURNING id, name, email, role, entity, created_at`,
    [name, email, role || 'viewer', entity || null]
  )).rows[0]
  return NextResponse.json(row || { error: 'Email already exists' })
}

export async function PATCH(req: NextRequest) {
  if (!checkAdminKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, password } = await req.json()
  if (!id || !password) return NextResponse.json({ error: 'id and password required' }, { status: 400 })
  const hash = await bcrypt.hash(password, 12)
  await query(`UPDATE app_users SET password_hash=$1 WHERE id=$2`, [hash, id])
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  if (!checkAdminKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  await query(`DELETE FROM app_users WHERE id = $1`, [id])
  return NextResponse.json({ ok: true })
}
