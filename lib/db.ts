import { Pool } from 'pg'

const base = process.env.DATABASE_URL || ''
const connectionString = base + (base.includes('?') ? '&' : '?') + 'options=-c%20search_path%3Dpublic'

const pool = new Pool({ connectionString, max: 8, idleTimeoutMillis: 30000 })

export async function query(text: string, params?: unknown[]) {
  const client = await pool.connect()
  try {
    return await client.query(text, params)
  } finally {
    client.release()
  }
}
