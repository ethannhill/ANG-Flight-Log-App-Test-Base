import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { checkAdminKey } from '@/lib/adminAuth'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}

export async function GET(req: NextRequest) {
  if (!checkAdminKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [totals, byModel, byType, recent] = await Promise.all([
    query(`SELECT
      COUNT(*)::int AS calls,
      COALESCE(SUM(input_tokens),0)::int AS input_tokens,
      COALESCE(SUM(output_tokens),0)::int AS output_tokens,
      COALESCE(SUM(cost_usd),0) AS cost_usd,
      COALESCE(AVG(elapsed_seconds),0) AS avg_elapsed
     FROM api_usage`),
    query(`SELECT model, COUNT(*)::int AS calls, COALESCE(SUM(cost_usd),0) AS cost_usd
     FROM api_usage GROUP BY model ORDER BY cost_usd DESC`),
    query(`SELECT call_type, COUNT(*)::int AS calls, COALESCE(SUM(cost_usd),0) AS cost_usd
     FROM api_usage GROUP BY call_type ORDER BY cost_usd DESC`),
    query(`SELECT id, created_at, source_file, model, input_tokens, output_tokens, cost_usd, elapsed_seconds, call_type
     FROM api_usage ORDER BY created_at DESC LIMIT 20`),
  ])

  return NextResponse.json({
    totals: totals.rows[0],
    byModel: byModel.rows,
    byType: byType.rows,
    recent: recent.rows,
  })
}
