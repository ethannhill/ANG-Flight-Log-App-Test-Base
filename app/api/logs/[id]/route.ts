import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getSession } from '@/lib/session'
import { BlobServiceClient } from '@azure/storage-blob'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  const restrict = session.role !== 'admin' && session.entity ? session.entity : null

  const entityClause = restrict ? ' AND l.operation = $2' : ''
  const qParams: unknown[] = restrict ? [id, restrict] : [id]

  const logRes = await query(
    `SELECT l.*, i.image_b64, i.image_url
     FROM scanned_flight_logs l
     LEFT JOIN scanned_log_images i ON i.log_id = l.id
     WHERE l.id = $1${entityClause}`,
    qParams
  )
  if (!logRes.rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const sectorsRes = await query(
    `SELECT * FROM scanned_sectors WHERE log_id = $1 ORDER BY sector_number`,
    [id]
  )

  return NextResponse.json({ log: logRes.rows[0], sectors: sectorsRes.rows })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { status } = body

  if (!['pending', 'reviewed', 'approved'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  await query('UPDATE scanned_flight_logs SET status = $1 WHERE id = $2', [status, id])
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session.authenticated || session.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const { id } = await params

  // Get blob URL before deleting
  const imgRes = await query(
    `SELECT image_url FROM scanned_log_images WHERE log_id = $1`,
    [id]
  )
  const imageUrl: string | null = imgRes.rows[0]?.image_url || null

  // Delete blob from Azure — no orphaned storage
  if (imageUrl) {
    try {
      const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING
      if (connStr) {
        const blobName = imageUrl.split('/logs/')[1]
        if (blobName) {
          const serviceClient = BlobServiceClient.fromConnectionString(connStr)
          const containerClient = serviceClient.getContainerClient('logs')
          await containerClient.deleteBlob(blobName, { deleteSnapshots: 'include' })
        }
      }
    } catch (e) {
      console.error('Blob delete failed:', e)
    }
  }

  // Delete record — cascades to sectors, images, trend_data
  await query('DELETE FROM scanned_flight_logs WHERE id = $1', [id])

  return NextResponse.json({ ok: true })
}
