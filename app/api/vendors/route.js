import { getDb } from '@/lib/db'

export async function GET() {
  const sql = getDb()
  const vendors = await sql`SELECT id, name, is_admin, pin IS NOT NULL as has_pin FROM vendors ORDER BY is_admin DESC, name ASC`
  return Response.json({ vendors })
}

export async function POST(request) {
  try {
    const sql = getDb()
    const { id, pin, action } = await request.json()
    if (!id || !pin) return Response.json({ error: 'Faltan datos' }, { status: 400 })

    if (action === 'verify') {
      const result = await sql`SELECT id FROM vendors WHERE id = ${id} AND pin = ${pin}`
      return Response.json({ ok: result.length > 0 })
    }

    await sql`UPDATE vendors SET pin = ${pin} WHERE id = ${id}`
    return Response.json({ ok: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
