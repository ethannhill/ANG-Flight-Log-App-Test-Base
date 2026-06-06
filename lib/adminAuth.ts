import { NextRequest } from 'next/server'

export function checkAdminKey(req: NextRequest): boolean {
  const key = process.env.ADMIN_API_KEY
  if (!key) return false
  return req.headers.get('x-admin-key') === key
}
