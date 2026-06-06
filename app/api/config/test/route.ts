import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import Anthropic from '@anthropic-ai/sdk'

async function getKey(name: string): Promise<string> {
  try {
    const res = await query(`SELECT value FROM app_config WHERE key = $1`, [name])
    if (res.rows[0]?.value) return res.rows[0].value
  } catch { /* fall through */ }
  const envMap: Record<string, string> = {
    anthropic_api_key: 'ANTHROPIC_API_KEY',
    skynet_api_key:    'SKYNET_API_KEY',
  }
  return (envMap[name] && process.env[envMap[name]]) ? process.env[envMap[name]]! : ''
}

export async function POST(req: NextRequest) {
  const { service } = await req.json()

  if (service === 'anthropic') {
    const key = await getKey('anthropic_api_key')
    if (!key) return NextResponse.json({ ok: false, error: 'No API key configured' })
    try {
      const client = new Anthropic({ apiKey: key })
      await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'hi' }],
      })
      return NextResponse.json({ ok: true })
    } catch (e) {
      return NextResponse.json({ ok: false, error: String(e) })
    }
  }

  return NextResponse.json({ ok: false, error: 'Unknown service' })
}
