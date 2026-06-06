import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function POST() {
  await query(`
    CREATE TABLE IF NOT EXISTS app_users (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name       TEXT NOT NULL,
      email      TEXT NOT NULL UNIQUE,
      role       TEXT NOT NULL DEFAULT 'reviewer',
      entity     TEXT NOT NULL DEFAULT 'AU',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_login TIMESTAMPTZ
    )
  `)
  return NextResponse.json({ ok: true })
}
