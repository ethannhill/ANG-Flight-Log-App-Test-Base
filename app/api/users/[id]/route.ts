import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await query('DELETE FROM app_users WHERE id = $1', [id])
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  if (body.role !== undefined) {
    if (!['admin', 'reviewer', 'viewer'].includes(body.role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }
    await query('UPDATE app_users SET role = $1 WHERE id = $2', [body.role, id])
  }

  if (body.entity !== undefined) {
    if (!['AU', 'PNG'].includes(body.entity)) {
      return NextResponse.json({ error: 'Invalid entity' }, { status: 400 })
    }
    await query('UPDATE app_users SET entity = $1 WHERE id = $2', [body.entity, id])
  }

  if (body.password !== undefined) {
    if (!body.password || body.password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }
    const hash = await bcrypt.hash(body.password, 12)
    await query('UPDATE app_users SET password_hash = $1 WHERE id = $2', [hash, id])
  }

  return NextResponse.json({ ok: true })
}
