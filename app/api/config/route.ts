import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS app_config (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
}

export async function GET() {
  try {
    await ensureTable()
    const res = await query(`SELECT key, value FROM app_config`)
    const config: Record<string, string> = {}
    for (const row of res.rows) config[row.key] = row.value

    return NextResponse.json({
      anthropicKeySource: config['anthropic_api_key'] ? 'db' : process.env.ANTHROPIC_API_KEY ? 'env' : 'none',
      skynetConfigured: !!(config['skynet_api_key'] || process.env.SKYNET_API_KEY),
    })
  } catch {
    return NextResponse.json({ anthropicKeySource: 'none', skynetConfigured: false })
  }
}

export async function POST(req: NextRequest) {
  const { key, value } = await req.json()
  const allowed = ['anthropic_api_key', 'skynet_api_key', 'skynet_api_url']
  if (!allowed.includes(key)) return NextResponse.json({ error: 'Unknown key' }, { status: 400 })

  await ensureTable()
  await query(
    `INSERT INTO app_config (key, value, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, value]
  )
  return NextResponse.json({ ok: true })
}
