import { getDb } from '@/lib/db'

export async function GET() {
  const sql = getDb()
  const expos = await sql`SELECT * FROM expos ORDER BY created_at DESC`
  return Response.json({ expos })
}

export async function POST(request) {
  try {
    const sql = getDb()
    const { name, location } = await request.json()
    if (!name) return Response.json({ error: 'Nombre requerido' }, { status: 400 })

    const id = name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')

    await sql`UPDATE expos SET is_active = false`
    await sql`INSERT INTO expos (id, name, location, is_active) VALUES (${id}, ${name}, ${location}, true)`

    return Response.json({ ok: true, id })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
